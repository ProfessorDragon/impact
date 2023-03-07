import random
from action import*

args, fn = init()
near = [(-1, -1), (0, -1), (1, -1), (-1, 0), (1, 0), (-1, 1), (0, 1), (1, 1)]
checkposes = [(0, 0)]

def getsunk(sid):
    total = 0
    sunk = 0
    for sh in data[sid]:
        if sh["field"] == 1 and sh["type"] == 0:
            total += 1
            if all(sh["hits"]): sunk += 1
    return sunk, total
def addret(val):
    global oresp, resp
    if val.get("redirect") == None:
        if args["pos"] != shotpos: val["redirect"] = shotpos
    if resp["data"][-1].get("redirect") == None:
        if args["pos"] != shotpos: resp["data"][-1]["redirect"] = shotpos
    oresp.append(val)
def trigret(val):
    global resp, data
    if resp["switchturn"] and data["extraturns"] > 0:
        data["extraturns"] -= 1
        resp["switchturn"] = False
        resp["extraturn"] = True
    if not resp["switchturn"]:
        resp["consecturns"] = data["consecturns"]+1
    if mode == 1:
        sunk = getsunk(sid if resp["switchturn"] else osid)
        resp["totalturns"] = sunk[1]-sunk[0]
        resp["extraturns"] = data["extraturns"]
    trigger(data, trigdata=resp, incconsec=not resp["switchturn"], threshold=0)
    ret(val)

data = getdata(force=True, name="sendattack")
if trigwait(data, update=True): data = getdata(force=True, name="sendattack")
p2 = 1-args["player"]
sid = "ships"+str(p2)
osid = "ships"+str(args["player"])
mode, bonus = data["mode"], data["bonus"]
resp = {
    "reason": "registershot", "player": p2, "pos": args.get("pos"), "switchturn": True,
    "win": -1, "consecturns": 0, "powerup": None, "extraturn": False, "data": []
    }
oresp = []
if args.get("pos") == None: trigret({"ship": None})
if get_stat(data, "bomb"):
    checkposes.extend(near)
    set_stat(data, "bomb", False)

for shotx, shoty in checkposes:
    shotpos = tile_pos(args["pos"])
    if not 0 <= shotpos[0]+shotx <= 9 or not 0 <= shotpos[1]+shoty <= 9: continue
    shotpos = args["pos"]+pos_tile(shotx, shoty)
    resp["data"].append({"loc": None, "ship": None, "redirect": None})
    hit = ship_shot(shotpos, data[sid])
    if mode == 1:
        sunk = getsunk(osid)
        resp["switchturn"] = data["consecturns"] >= sunk[1]-sunk[0]-1
    elif mode == 3:
        resp["switchturn"] = bool(random.randint(0, 1))
    if hit == None:
        rv = {"ship": None, "redirect": None}
        if bonus == 1:
            board = map_ships(data[sid])
            r = 0
            while hit == None:
                r += 1
                hit = ship_radar(shotpos, board, r)
            rv["radius"] = r
        elif bonus == 2:
            board = map_ships(data[sid])
            hit = ship_radar(shotpos, board, 2, count=True)
            rv["count"] = hit
        addret(rv)
        continue
    if get_stat(data, "shield", p2=True):
        random.shuffle(near)
        shieldx, shieldy = tile_pos(shotpos)
        for altx, alty in near:
            if not 0 <= shieldx+altx <= 9 or not 0 <= shieldy+alty <= 9: continue
            p = pos_tile(shieldx+altx, shieldy+alty)
            if ship_shot(p, data[sid]) == None:
                resp["data"][-1]["redirect"] = p
                set_stat(data, "shield", False, p2=True)
                addret({"ship": None, "redirect": p})
                break
        continue
    loc, n = hit
    data[sid][n]["hits"][loc] = True
    sunk = getsunk(sid)
    if sunk[0] == sunk[1]:
        resp["win"] = args["player"]
        resp["returnships"] = True
    resp["data"][-1]["loc"] = loc
    resp["data"][-1]["ship"] = n
    if mode == 2: resp["switchturn"] = False
    sh = data[sid][n].copy()
    iss = all(sh["hits"])
    if iss and sh["type"] == 1:
        if args["pos"] != shotpos:
            resp["data"][-1]["reveal"] = True
            sh["reveal"] = True
            data[sid][n]["hits"][loc] = False
            ok = True
        else: ok = False
        sh["length"] = 0
        pn = None
        while not ok:
            pn = random.randint(0, 4)
            ok = True
            if pn == 0:
                if get_stat(data, "bomb"): ok = False
                else: set_stat(data, "bomb", True)
            elif pn == 1:
                data["extraturns"] += 1
            elif pn == 2:
                if get_stat(data, "shield"): ok = False
                else: set_stat(data, "shield", True)
            elif pn == 3:
                avail = [ns for ns in enumerate(data[osid]) if True in ns[1]["hits"] and ns[1]["type"] == 0]
                if len(avail) == 0:
                    ok = False
                    continue
                newshipnum, newship = random.choice(avail)
                avail = [i for i, h in enumerate(newship["hits"]) if h]
                h = random.choice(avail)
                data[osid][newshipnum]["hits"][h] = False
                resp["remship"] = newshipnum
                resp["remloc"] = h
                resp["rempos"] = hit_pos(newship, h)
                if mode == 1:
                    sunk = getsunk(osid)
                    resp["switchturn"] = data["consecturns"] >= sunk[1]-sunk[0]-1
            elif pn == 4:
                avail = [ns for ns in data[sid] if False in ns["hits"] and ns["type"] == 0]
                if len(avail) == 0:
                    ok = False
                    continue
                avail.sort(key=lambda a: a["hits"].count(False), reverse=True)
                newship = random.choice(avail[:3])
                avail = [i for i, h in enumerate(newship["hits"]) if not h]
                h = random.choice(avail)
                resp["hitpos"] = hit_pos(newship, h)
        resp["powerup"] = pn
    addret({"loc": loc, "ship": n, "data": sh if iss else None, "redirect": None})

trigret(oresp)
