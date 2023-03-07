import os
from action import*
args, fn = init()
ok = os.path.isfile(fn)
if ok:
    before = getdata(name="getslot1")
    if before == None: ok = False
if ok:
    if args.get("wait", -1) >= 0:
        s = "slot"+str(args["wait"])
        secs = 0
        while True:
            sleep(.2)
            secs += .2
            after = getdata(name="getslot4")
            if before[s] != after[s]: ret(True)
            elif secs > 60: ret(False)
    else:
        trigger(trigdata={"reason": "checkslot"}, threshold=3)
        sleep(2)
        after = getdata(name="getslot3")
        if before["ingame"] == after["ingame"]:
            if before["slot0"] == after["slot0"]:
                ret({"slot": 0, "mode": args["mode"], "ships": args["ships"]}, resetships=after,
                    change={"mode": args["mode"], "shipspreset": args["ships"], "bonus": args["bonus"], "vs": args["vs"]})
            elif before["slot1"] == after["slot1"] and args["vs"] == 0 and after["vs"] == 0:
                ret({"slot": 1, "mode": after["mode"], "ships": after["shipspreset"], "bonus": after["bonus"]})
        ret({"slot": -1})
else:
    write({"trigger": 0, "trigdata": {"reason": "newfile"}, "slot0": 0, "slot1": 0,
        "mode": 0, "shipspreset": 0, "bonus": 0, "vs": 0, "consecturns": 0, "ingame": 0,
        "extraturns": 0},
        name="getslot")
    ret({"slot": 0})
