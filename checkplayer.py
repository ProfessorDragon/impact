from action import*
args, fn = init()
data = getdata(force=True, name="checkplayer")
st = data["trigger"]
data["slot"+str(args["player"])] += 1
if args["ingame"]: data["ingame"] += 1
write(data, name="checkplayer")
while True:
    if data["trigger"] != st: break
    sleep(.2)
    data = getdata(force=True)
rd = data["trigdata"]
if rd.get("returnships"):
    for i in range(2):
        rd["ships"+str(i)] = data["ships"+str(i)]
ret(rd)
