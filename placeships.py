import time
from action import*
args, fn = init()
data = getdata(name="placeships")
data["ships"+str(args["player"])] = args["ships"]
write(data, name="placeships")
if not args.get("wait", True): ret(True)
while True:
    sleep(.5)
    data = getdata(name="placeships2")
    ok = True
    for i in range(2):
        if not "ships"+str(i) in data:
            ok = False
            break
    if ok: break
total = 0
for sh in args["ships"]:
    if sh["field"] == 1 and sh["type"] == 0:
        total += 1
ret({"consecturns": 0, "totalturns": total})
