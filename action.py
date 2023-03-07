import os, sys, json, time, random
def sleep(secs):
    time.sleep(secs)
def write(data, force=True, name="unknown"):
    ok = False
    n = 0
##    if args["room"] == 2:
##        with open("debug.txt", "a") as f:
##            f.write(f"{name} - {data}\n")
    t = fn+".tmp"+str(random.randint(0, 999999)).zfill(6)
    while not ok:
        ok = True
        try:
            with open(t, "w") as f:
                if type(data) == dict: json.dump(data, f)
                else: f.write(data)
                f.flush()
                os.fsync(f.fileno())
            try: os.replace(t, fn)
            except OSError:
                if force: ok = False
        except PermissionError:
            if force: ok = False
        if not ok: sleep(.2)
        n += 1
        if n > 3: raise OSError
def ret(val=None, resetships=None, change={}, lowpriority=False):
    if val != None: print(json.dumps(val))
    if resetships != None:
        new = {}
        for k, v in resetships.items():
            if k in ("ships0", "ships1", "stats0", "stats1"): continue
            if k in change: new[k] = change[k]
            elif k in ("consecturns", "extraturns"): new[k] = 0
            else: new[k] = v
        write(new, force=not lowpriority, name="ret")
    exit()
def getdata(force=False, name="getdata"):
    def testcorrupt(d):
        try: j = json.loads(d)
        except json.decoder.JSONDecodeError:
            try:
                j = json.loads(d[:-1])
                write(d[:-1], name=name)
            except json.decoder.JSONDecodeError:
                j = d
        return j
    dat = None
    while True:
        try:
            with open(fn) as f:
                dat = f.read()
        except PermissionError:
            sleep(.2)
            continue
        if dat or not force: break
        sleep(.2)
    return testcorrupt(dat)
def trigwait(cd, threshold=1.4, update=False):
    ts = time.perf_counter()
    diff = cd["trigdata"].get("timestamp")
    if diff != None and threshold > 0:
        diff = ts-diff
        if diff > 0 and diff < threshold:
            sleep(threshold-diff)
            if update:
                cd["trigdata"]["timestamp"] = ts
                write(cd, name="trigwait")
            return True
    return False
def trigger(cd=None, trigdata=None, incconsec=False, threshold=1, refreshdata=True):
    if cd == None: cd = getdata(force=True)
    if trigwait(cd, threshold=threshold) and refreshdata: cd = getdata(force=True)
    if trigdata == None: trigdata = {"reason": "none"}
    trigdata["timestamp"] = time.perf_counter()
    cd["trigger"] += 1
    cd["trigdata"] = trigdata
    if incconsec: cd["consecturns"] += 1
    else: cd["consecturns"] = 0
    write(cd, name="trigger")
def tile_pos(pos):
    return pos%10, pos//10
def pos_tile(x, y):
    return x+y*10
def ship_size(data):
    if data["vert"]: return 1, len(data["hits"])
    return len(data["hits"]), 1
def ship_shot(pos, ships, field=1):
    x, y = tile_pos(pos)
    for i, data2 in enumerate(ships):
        if field != data2["field"]: continue
        w, h = ship_size(data2)
        x2, y2 = tile_pos(data2["pos"])
        aa = x+1 > x2 and x < x2+w and \
            y < y2+h and y+1 > y2
        if aa: return (x-x2)+(y-y2), i
def map_ships(ships):
    board = [False for _ in range(10*10)]
    for data in ships:
        x, y = tile_pos(data["pos"])
        w, h = ship_size(data)
        for x2 in range(w):
            for y2 in range(h):
                board[pos_tile(x+x2, y+y2)] = True
    return board
def ship_radar(pos, board, radius, count=False):
    x, y = tile_pos(pos)
    n = 0
    for i, isship in enumerate(board):
        if not isship: continue
        x2, y2 = tile_pos(i)
        x2 = x-x2
        y2 = y-y2
        if x2*x2+y2*y2 < radius*radius-1:
            if count: n += 1
            else: return i
    if count: return n
def hit_pos(ship, hit):
    p = ship["pos"]
    if ship["vert"]: p += hit*10
    else: p += hit
    return p
def set_stat(data, name, val, p2=False):
    p = 1-args["player"] if p2 else args["player"]
    data.setdefault("stats"+str(p), {})
    data["stats"+str(p)][name] = val
def get_stat(data, name, df=False, p2=False):
    p = 1-args["player"] if p2 else args["player"]
    return data.get("stats"+str(p), {}).get(name, df)
def init():
    global allargs, args, fn
    allargs = json.loads(sys.argv[1])
    assert allargs["MODE"] != "GET"
    args = allargs["ARGS"]
    assert 1 <= args["room"] <= 10
    fn = f"rooms/{args['room']}.json"
    if "player" in args: assert args["player"] > -1
    return args, fn
if __name__ == "__main__":
    print("no")
