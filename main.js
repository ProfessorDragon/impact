var modedata = [
    ["Standard", "Each player gets one shot per turn."],
    ["Salvo", "Each player gets one shot for each of their ships which is not destroyed."],
    ["Shoot until miss", "Each player keeps shooting until a shot is missed."],
    ["Random turns", "Each player gets a random amount of shots each turn."]
];
var shipsdata = [
    ["Basic", "The standard Battleships layout.", [2, 3, 3, 4, 5]],
    ["One of each", "One ship for each length (1-5).", [1, 2, 3, 4, 5]],
    ["Large fleet", "Smaller ships but there's more of them.", [1, 2, 3, 3, 4, null, 1, null, 1, 2, null, 1, 0, -2]],
    ["Get lucky", "A single 1x1 ship.", [1]],
    ["Random lengths", "Five ships of random lengths, different for each player.", Array(5).fill(8)]
];
var bonusdata = [
    ["None", "No extra changes are made."],
    ["Radar", "Each missed shot will show the proximity to the nearest ship."],
    ["Minesweeper", "Each missed shot will show the number of surrounding hits."],
    ["Powerups", "Place powerup ships around your board. They do not have to be sunk to win the game."+
        " If the opponent sinks one, they get a powerup."]
];
var playerdata = [
    ["Online opponent", "Play against the next person to join the same room."],
    ["CPU - Easy", "A bot which shoots in sequential order starting from the top left."+
        " You can win every time with good ship placement."],
    ["CPU - Medium", "This bot is like the hard CPU (see below), but sinks ships sporadically and sometimes misses."],
    ["CPU - Hard", "This bot will never miss a shot. You would have to get pretty <i>lucky</i> to win."]
];
var alldata = [modedata, shipsdata, bonusdata, playerdata];
var alldataheadings = ["Gamemodes", "Ship layouts", "Bonus modes", "Opponents"];
var minesweepercolors = ["white", "#0100FB", "#027F00", "#FC0002", "#01017D", "#7E0001", "#028786", "black", "#808080"];
var specialshipcolors = [
    ["#ADADAD", "#8B8B8B"], ["#33FF00", "#00D231"], ["#00EAFF", "#00BBFF"], ["#DA00FF", "#AB00FF"],
    ["#FFD400", "#FFA200"], ["#0040FF", "#1300D2"], null, ["white", "lightgray"]
];
var powerupdata = [
    ["Bomb", "Your next shot will cover a 3x3 area."],
    ["Sneak attack", "You gained an extra turn."],
    ["Missile jammer", "The next shot which hits one of your ships will be diverted to a nearby tile instead."],
    ["Instant repairs", "A hit has been taken off one of your ships."],
    ["Super radar", "The location of an opponent's ship has been revealed."]
];
var prefs = {room: 1, mode: 0, ships: 0, bonus: 0, vs: 0};
var turntimerenabled = false;
var coloredships = true;

var playernum = -1;
var stage = 0;
var urlparams = new URLSearchParams(window.location.search);
var draggingshipnum = 0;
var ships = [];
var turnresp = null;
var turntimer = 0;
var turntimerinterval = null;
var shottile = null;
var theirturncount = 0;
var clearshotok = 0;
var hitmap = null;
var notifyshown = false;
var maxextraturns = 0;
var bombshot = false;
var guidenumsshown = false;
var keyboardshot = [];

function post(url, data, func, errfunc){
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
        if (this.readyState != 4) return;
        if (this.status == 200 && func != null) {
            r = this.responseText;
            if (r.length > 0){
                try {
                    r = JSON.parse(r);
                } catch (e) {
                    console.error("Cannot parse:\n"+this.responseText);
					if (errfunc === true){
						setTimeout(function(){
							post(url, data, func, errfunc);
						}, 500);
						return
                    } else if (errfunc != null){
                        errfunc(r);
                        return;
                    }
                    r = null;
                }
            } else r = null;
            func(r);
        }
    }
    xhr.onerror = function(){
		if (errfunc === true){
			setTimeout(function(){
				post(url, data, func, errfunc);
			}, 500);
		} else if (errfunc != null){
			errfunc();
		}
    }
    xhr.open("POST", url, true);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.send(JSON.stringify(data));
}
function change_room(rn){
    silent = true;
    if (rn === undefined){
        rn = prompt("Enter the room number (1-10)", prefs.room);
        silent = false;
    }
    rn = parseInt(rn);
    if (isNaN(rn)) return;
    if (rn < 1 || rn > 10){
        if (!silent) alert("Invalid room number.")
    } else {
        prefs.room = rn;
        rn = "Change room";
        if (prefs.room != 1) rn += " ("+prefs.room+")";
        document.getElementById("changeroombtn").innerText = rn;
    }
}
function enable_close_dialog(){
    window.onbeforeunload = function() {
        return confirm("Are you sure you want to quit the game?")?null:0;
    }
}
function goto_chapter(n){
    document.querySelector("#guide .chapter[value='"+n+"']").scrollIntoView();
}
function show_layout(n){
    document.getElementById("menu").style.display = (n == 0)?"":"none";
    document.getElementById("game").style.display = (n == 1)?"":"none";
    document.getElementById("help").style.display = (n == 2)?"":"none";
    document.body.style.overflow = (n == 1)?"hidden":"";
}
function decrement_timer(){
    turntimer--;
    if (stage == 3){
        if (turntimer < 0){
            document.getElementById("turntext").innerText = "Place your ships";
            btn = document.getElementById("finishedplacingbtn");
            if (btn.onclick) btn.click();
            else cancel_wait();
        } else {
            document.getElementById("turntext").innerText = "Place your ships - "+turntimer;
        }
    } else if (stage == 4){
        if (turntimer < 0){
            shottile = true;
            post("sendattack.py", {room: prefs.room, player: playernum, pos: null}, function() {
                shottile = null;
            }, true);
        } else {
            document.getElementById("turntext").innerText = get_turn_text()+" - "+turntimer;
        }
    }
}
function being(){
    stage = 1;
    btns = document.getElementById("buttonsdiv");
    btns.style.display = "none";
    st = document.getElementById("statustext");
    st.innerText = "Loading...";
    st.style.marginTop = "";
    st.style.display = "block";
    sh = function() {
        btns.style.display = "";
        st.style.marginTop = "0px";
        stage = 0;
    }
    post("getslot.py", prefs, function(resp){
        playernum = resp.slot;
        if (playernum < 0){
            st.innerText = "This room is full";
            sh();
            return;
        }
        stage = 2;
        return_check_player({"reason": "begin"});
        if (playernum < 1){
            if (prefs.vs == 0){
                t = "Waiting for another player";
                if (prefs.room != 1) t += " in room "+prefs.room;
                st.innerText = t;
            }
            document.getElementById("backbtn").style.display = "";
            if (prefs.vs == 0){
                post("getslot.py", {player: playernum, room: prefs.room, wait: 1}, function(resp){
                    if (resp == true){
						player_ready();
                    } else {
                        turntimerinterval = true;
                        cancel_wait();
                    }
                }, function(resp){
					turntimerinterval = true;
					cancel_wait();
				});
            } else {
				player_ready();
			}
        } else {
            set_option(1, resp.ships);
            prefs.ships = resp.ships;
            if (resp.mode != prefs.mode || resp.bonus != prefs.bonus){
                t = "";
                if (resp.mode != prefs.mode){
                    set_option(0, resp.mode);
                    t += "The gamemode has been updated to "+modedata[prefs.mode][0];
                }
                if (resp.bonus != prefs.bonus){
                    set_option(2, resp.bonus);
                    if (t) t += "\n";
                    t += "The bonus mode has been updated to "+bonusdata[prefs.bonus][0];
                }
                st.innerText = t;
                setTimeout(player_ready, 3000);
            } else player_ready();
        }
    }, function(){
        st.innerText = "Cannot connect to server";
        sh();
    });
}
function cancel_wait(){
    stage = 0;
    playernum = -1;
    document.getElementById("buttonsdiv").style.display = "";
    document.getElementById("backbtn").style.display = "none";
    show_layout(0);
    st = document.getElementById("statustext");
    if (turntimerinterval != null){
        st.style.display = "";
        st.innerText = "Game timed out";
        if (turntimerinterval != true) clearInterval(turntimerinterval);
        turntimerinterval = null;
    } else st.style.display = "none";
	if (guidenumsshown) hide_guide_nums();
    fields = document.getElementsByClassName("field");
    for (i = 0; i < fields.length; i++){
        fields[i].innerHTML = "";
    }
    window.onbeforeunload = null;
    turnresp = null;
    shottile = null;
    theirturncount = 0;
    clearshotok = 0;
}
function handle_key(e){
	num = !isNaN(parseInt(e.key));
	if (guidenumsshown && stage == 4 && num && keyboardshot.length < 2 && !notifyshown){
		keyboardshot.push(parseInt(e.key)); // (parseInt(e.key)+9)%10
		if (keyboardshot.length == 2){
			p = pos_tile(...keyboardshot);
			tile = get_tile(p, 2);
			keyboardshot = [];
			if (tile == null || tile.parentElement == null || tile.parentElement.id != "field2") return;
			if (shottile != null || notifyshown) return;
			if (has_shot(tile) > 0 && !bombshot) return;
			remove_tile_highlights("curtile");
			tile.classList.add("curtile");
			tile_click({target: tile});
		}
	} else if (e.code == "Enter" || num){
		if (notifyshown) hide_notify();
        else if (stage == 0) being();
        else if (stage == 3){
            b = document.getElementById("finishedplacingbtn");
            if (b == null) return;
            if (b.onclick != null) finished_ship_placing();
            else randomize_ship_placing();
		} else if (stage == 4 || stage == 5){
			if (num) show_guide_nums();
        } else if (stage == 6) cancel_wait();
    }
}
function resize_fields(){
    fieldconts = document.getElementsByClassName("container");
    d = document.getElementById("divider");
    tt = document.getElementById("turntext");
    if (window.innerHeight > window.innerWidth){
        w = window.innerWidth-100;
        h = window.innerHeight/2-150;
        if (w < h){
            a = window.innerHeight/4+w/2+90;
            for (i = 0; i < fieldconts.length; i++){
                f = fieldconts[i];
                f.style.width = w+"px";
                f.style.height = w+"px";
                if (i == 1) f.style.top = window.innerHeight/2+55+"px";
                else f.style.top = "75px";
                f.style.left = "50%";
                f.style.transform = "translateX(-50%)";
            }
            d.style.width = w+"px";
            d.style.top = a+"px";
        } else {
            a = window.innerHeight/4+h/2+90;
            for (i = 0; i < fieldconts.length; i++){
                f = fieldconts[i];
                f.style.width = h+"px";
                f.style.height = h+"px";
                if (i == 1) f.style.top = window.innerHeight/2+55+"px";
                else f.style.top = "75px";
                f.style.left = "50%";
                f.style.transform = "translateX(-50%)";
            }
            d.style.width = h+"px";
            d.style.top = a+"px";
        }
        d.style.height = "";
        tt.style.top = "20px";
        tt.style.left = "160px";
        tt.style.transform = "none";
        document.getElementById("field1label").classList.add("alt");
        document.getElementById("field2label").classList.add("alt");
    } else {
        w = window.innerWidth/2-100;
        h = window.innerHeight-150;
        if (w < h){
            a = window.innerHeight/2-w/2+25-28;
            for (i = 0; i < fieldconts.length; i++){
                f = fieldconts[i];
                f.style.width = w+"px";
                f.style.height = w+"px";
                f.style.top = a+"px";
                f.style.right = "";
                f.style.left = "";
                f.style.transform = "";
            }
            d.style.height = w+"px";
            dt = a;
        } else {
            a = window.innerWidth/4-h/2;
            for (i = 0; i < fieldconts.length; i++){
                f = fieldconts[i];
                f.style.width = h+"px";
                f.style.height = h+"px";
                f.style.top = "";
                if (i == 1){
                    f.style.left = "";
                    f.style.right = a+"px";
                } else {
                    f.style.left = a+"px";
                    f.style.right = "";
                }
                f.style.transform = "";
            }
            d.style.height = h+"px";
            dt = 73;
        }
        d.style.top = dt+49+"px";
        d.style.width = "";
        tt.style.top = dt-4+"px";
        tt.style.left = "";
        tt.style.transform = "";
        document.getElementById("field1label").classList.remove("alt");
        document.getElementById("field2label").classList.remove("alt");
    }
    n = document.getElementById("notifybox");
    if (parseInt(window.getComputedStyle(n).width) > window.innerWidth*.9) n.style.width = window.innerWidth*.9+"px";
    else n.style.width = "";
}
function make_retry_button(){
    retrybtn = document.createElement("div");
    retrybtn.id = "retrybtn";
    retrybtn.onclick = cancel_wait;
    document.getElementById("turntext").appendChild(retrybtn);
}
function show_missed_ships(resp){
    remove_tile_highlights("revealhit");
    if (resp == null) return;
    data = resp["ships"+(1-playernum)];
    for (i = 0; i < data.length; i++){
        skip = false;
        for (j = 0; j < ships.length; j++){
            if (ships[j] != null && ships[j].field == 2 && ships[j].pos == data[i].pos){
                skip = true;
                break;
            }
        }
        if (!skip){
            l = data[i].hits.length;
            if (data[i].type == 1) l = 0;
            make_ship(data[i].pos, 2, l, data[i].vert).classList.add("ghost");
        }
    }
}
function win(resp){
    stage = 6;
    document.getElementById("turntext").innerText = "You win!";
    make_retry_button();
    show_missed_ships(resp);
}
function lose(resp){
    stage = 6;
    document.getElementById("turntext").innerText = "You lose...";
    make_retry_button();
    show_missed_ships(resp);
}
function remove_tile_highlights(cn){
    if (cn == null) cn = "forcecurtile";
    tiles = document.querySelectorAll("."+cn);
    for (i = 0; i < tiles.length; i++){
        tiles[i].classList.remove(cn);
    }
}
function clear_shot_tile(){
    clearshotok++;
    if (clearshotok == 2){
        shottile = null;
        clearshotok = 0;
    }
}
function ship_shot(pos, field){
    return ship_collision(null, {hits: [false], pos: pos, field: field, vert: false, type: 0});
}
function return_check_player(resp){
    if (resp == null || stage == 0 || stage == 6) return;
    if (resp.reason == "registershot"){
        if (turntimerinterval != null) clearInterval(turntimerinterval);
        recvplayer = resp.player == playernum;
        if (recvplayer){
            for (rn = 0; rn < resp.data.length; rn++){
                mresp = resp.data[rn];
                if (mresp.reveal) continue;
                tile = get_tile((mresp.redirect != null)?mresp.redirect:resp.pos, 1);
                if (!has_shot(tile) > 0) tile.classList.add("forcecurtile");
                if (mresp.ship != null){
                    tile.classList.add("hit");
                    ships[mresp.ship].hits[mresp.loc] = true;
                } else {
                    tile.classList.add("miss");
                }
            }
        } else clear_shot_tile();
        if (resp.win > -1){
            remove_tile_highlights();
            window.onbeforeunload = null;
            if (resp.win == playernum) win(resp);
            else lose(resp);
            return;
        }
        if (resp.powerup != null){
            if (resp.powerup == 0 && !recvplayer) bombshot = true;
            else if (resp.powerup == 3){
                ships[resp.remship].hits[resp.remloc] = false;
                get_tile(resp.rempos, recvplayer?2:1).classList.remove("hit", "miss", "mineval");
                if (recvplayer){
                    c = ship_shot(resp.rempos, 2);
                    if (c != null){
                        ships[c] = null;
                        get_ship(c).remove();
                    }
                }
            } else if (resp.powerup == 4){
                if (!recvplayer) get_tile(resp.hitpos, 2).classList.add("revealhit");
            }
            if (!recvplayer) show_notify(powerupdata[resp.powerup][0], powerupdata[resp.powerup][1]);
        }
        if (resp.switchturn) maxextraturns = 0;
        if (resp.switchturn == recvplayer) my_turn(resp);
        else their_turn(resp);
    }
    post("checkplayer.py", {player: playernum, room: prefs.room, ingame: stage > 2}, return_check_player, true);
}
function make_radar(n, r, cn, field){
    if (field == null) field = 2;
    if (cn == null) cn = "radar";
    tp = tile_pos(n);
    els = get_tiles(field);
    for (i = 0; i < els.length; i++){
        tile = els[i];
        n = parseInt(tile.getAttribute("value"));
        pos = tile_pos(n);
        x = tp[0]-pos[0];
        y = tp[1]-pos[1];
        if (x*x+y*y < r*r-1){
            if (cn) tile.classList.add("radar");
            else tile.classList.remove("radar");
        }
    }
}
function has_shot(tile){
    if (tile.classList.contains("miss") || tile.classList.contains("mineval")) return 1;
    if (tile.classList.contains("hit")) return 2;
    return 0;
}
function show_notify(title, body){
    n = document.getElementById("notifybox");
    n.style.display = "block";
    notifyshown = true;
    h = document.querySelector("#notifybox h2");
    h.innerText = title;
    p = document.querySelector("#notifybox p");
    p.innerText = body;
    if (parseInt(window.getComputedStyle(n).width) > window.innerWidth*.9) n.style.width = window.innerWidth*.9+"px";
    else n.style.width = "";
}
function hide_notify(){
    document.getElementById("notifybox").style.display = "";
    notifyshown = false;
}
function show_guide_nums(){
	fields = document.getElementsByClassName("field");
	for (i = 0; i < fields.length; i++){
		fields[i].style.borderRadius = "0px";
	}
	document.querySelector("#fieldcont2 .rows").style.display = "";
	document.querySelector("#fieldcont2 .cols").style.display = "";
	guidenumsshown = true;
}
function hide_guide_nums(){
	fields = document.getElementsByClassName("field");
	for (i = 0; i < fields.length; i++){
		fields[i].style.borderRadius = "";
	}
	document.querySelector("#fieldcont2 .rows").style.display = "none";
	document.querySelector("#fieldcont2 .cols").style.display = "none";
	guidenumsshown = false;
}
function tile_click(e){
    if (stage != 4 || e.target.parentElement == null) return;
    if (!e.target.classList.contains("curtile")) return;
    shottile = e.target;
    shottile.classList.remove("curtile");
    n = parseInt(tile.getAttribute("value"));
    post("sendattack.py", {room: prefs.room, player: playernum, pos: n}, function(mresp){
        if (prefs.bonus == 1) remove_tile_highlights("radar");
        for (rn = 0; rn < mresp.length; rn++){
            resp = mresp[rn];
            if (resp.redirect != null) shottile = get_tile(resp.redirect, 2);
            rd = resp.data;
            if (resp.ship != null){
                if (rd != null && rd.reveal){
                    shottile.classList.add("revealhit");
                    shottile.classList.add("blackshot");
                } else {
                    shottile.classList.add("hit");
                    shottile.classList.remove("revealhit", "blackshot");
                    if (rd != null){
                        l = rd.hits.length;
                        if (rd.type == 1) l = 0;
                        make_ship(rd.pos, 2, l, rd.vert);
                        ships[ships.length-1].hits.fill(true);
                    }
                }
            } else {
                if (prefs.bonus == 1) make_radar(n, resp.radius);
                else if (prefs.bonus == 2){
                    shottile.setAttribute("data-content", resp.count);
                    shottile.style.color = minesweepercolors[resp.count];
                }
                shottile.classList.add((prefs.bonus == 2)?"mineval":"miss");
            }
        }
        clear_shot_tile();
        bombshot = false;
    }, true);
}
function tile_enter(e){
    if (stage != 4) return;
    tile = null;
    els = document.elementsFromPoint(e.clientX, e.clientY);
    for (i = 0; i < els.length; i++){
        if (els[i].classList.contains("tile")){
            tile = els[i];
            break;
        }
    }
    remove_tile_highlights("curtile");
    if (tile == null || tile.parentElement == null || tile.parentElement.id != "field2") return;
    if (shottile != null || notifyshown) return;
    if (has_shot(tile) > 0 && !bombshot) return;
    tile.classList.add("curtile");
}
function get_turn_text(){
    if (stage == 4) tt = "Your turn";
    else if (stage == 5) tt = "Their turn";
    else return;
    if (prefs.mode == 1){
        if (turnresp.extraturns > maxextraturns) maxextraturns = turnresp.extraturns;
        if (turnresp.consecturns+1 > turnresp.totalturns+maxextraturns){
            maxextraturns = turnresp.consecturns+1-turnresp.totalturns;
        }
        tt += " ("+(turnresp.consecturns+1)+"/"+(turnresp.totalturns+maxextraturns)+")";
    } else if (turnresp.extraturn){
        tt += " (Bonus)"
    }
    return tt;
}
function my_turn(resp){
    stage = 4;
    turnresp = resp;
    document.getElementById("turntext").innerText = get_turn_text();
    if (turntimerenabled){
        turntimer = 31;
        decrement_timer();
        turntimerinterval = setInterval(decrement_timer, 1000);
    }
}
function their_turn(resp){
    stage = 5;
    turnresp = resp;
    document.getElementById("turntext").innerText = get_turn_text();
    if (resp != null && resp.consecturns == 0) remove_tile_highlights();
    if (prefs.vs > 0){
        p = null;
        if (prefs.vs == 1){
			p = theirturncount;
        } else if (prefs.vs == 2){
            if (Math.floor(Math.random()*3) == 0){
                while (p == null){
                    p = hitmap[Math.floor(Math.random()*hitmap.length)];
                    if (Math.floor(Math.random()*4) == 0){
                        pos = tile_pos(p);
                        pos[Math.floor(Math.random()*2)] += Math.floor(Math.random()*2)*2-1;
                        if (!(pos[0] < 0 || pos[0] > 9 || pos[1] < 0 || pos[1] > 9)){
                            p = pos_tile(pos[0], pos[1]);
                        }
                    }
                    if (has_shot(get_tile(p, 1)) > 0) p = null;
                }
            } else {
                while (p == null){
                    p = Math.floor(Math.random()*100);
                    if (has_shot(get_tile(p, 1)) > 0) p = null;
                }
            }
        } else if (prefs.vs == 3){
            if (theirturncount > hitmap.length-1){
                while (p == null){
                    p = hitmap[Math.floor(Math.random()*hitmap.length)];
                    if (has_shot(get_tile(p, 1)) > 0) p = null;
                }
            } else p = hitmap[theirturncount];
        }
        setTimeout(function(){
            post("sendattack.py", {room: prefs.room, player: 1, pos: p}, null, true);
        }, 200+(theirturncount == 0)?500:0);
    }
    theirturncount++;
}
function player_ready(){
    if (stage != 2) return;
    stage = 3;
    st = document.getElementById("statustext");
    st.innerText = "An error has occurred";
    gen_boards();
    if (prefs.vs > 0){
        randomize_ship_placing();
        post("placeships.py", {player: 1, room: prefs.room, ships: ships, wait: false}, null, true);
        randomize_ship_lengths();
        reset_ship_placing();
    }
    document.getElementById("turntext").innerText = "Place your ships";
    document.getElementById("field2label").innerText = "Ships";
    show_layout(1);
    enable_close_dialog();
    document.getElementById("backbtn").style.display = "none";
}
function finished_ship_placing(){
    if (turntimerinterval != null) clearInterval(turntimerinterval);
    els = document.getElementsByClassName("ship");
    for (i = 0; i < els.length; i++){
        els[i].draggable = false;
        els[i].onclick = null;
    }
    document.getElementById("finishedplacingbtn").remove();
    document.getElementById("resetplacingbtn").remove();
    document.getElementById("randomizeplacingbtn").remove();
    document.getElementById("turntext").innerText = (prefs.vs == 0)?"Waiting for opponent":"Their turn";
    document.getElementById("field2label").innerText = "Opponent's board";
    hitmap = [];
    shipssorted = ships.slice();
    shipssorted.sort(function(a, b){return (a.hits.length > b.hits.length)?1:((b.hits.length > a.hits.length)?-1:0);});
    for (n = 0; n < shipssorted.length; n++){
        data = shipssorted[n];
        if (data.field != 1 || data.type != 0) continue;
        p = data.pos;
        for (h = 0; h < data.hits.length; h++){
            hitmap.push(p);
            if (data.vert) p += 10;
            else p += 1;
        }
    }
    post("placeships.py", {room: prefs.room, player: playernum, ships: ships}, function(resp){
        if (playernum == 1) my_turn(resp);
        else their_turn(resp);
    }, true);
}
function randomize_ship_lengths(){
    sd = [];
    for (i = 0; i < 5; i++){
        n = Math.floor(Math.random()*10)+1;
        if (n == 1) len = 1;
        else if (n == 2) len = 8;
        else len = Math.floor(Math.random()*5)+2;
        sd.push(len);
    }
    sd.sort(function(a, b){return a-b;});
    shipsdata[shipsdata.length-1][2] = sd;
}
function randomize_ship_placing(){
    for (n = 0; n < ships.length; n++){
        data = ships[n];
        sh = get_ship(n);
        data.pos = Math.floor(Math.random()*99);
        data.field = 1;
        data.vert = Boolean(Math.floor(Math.random()*2));
        if (ship_collision(n, data, (Math.floor(Math.random()*ships.length*2) > 1)?1:0) != null){
            n--;
            continue;
        }
        tile = get_tile(data.pos, data.field);
        tile.appendChild(sh);
        update_ship_size(sh, data.hits.length, data.vert);
    }
    fin = document.getElementById("finishedplacingbtn");
    fin.classList.remove("disabledbtn");
    fin.onclick = finished_ship_placing;
}
function event_tile(path){
    for (i = 0; i < path.length; i++){
        if (path[i].classList.contains("tile")){
            return path[i];
        }
    }
}
function tile_pos(pos){return [pos%10, Math.floor(pos/10)];}
function pos_tile(x, y){return x+y*10;}
function get_ship(n){return document.querySelector(".ship[value='"+n+"']");}
function get_tile(n, field){return document.querySelector("#field"+field+" .tile[value='"+n+"']");}
function get_tiles(field){return document.querySelectorAll("#field"+field+" .tile");}
function ship_size(data){
    if (data.vert) return [1, data.hits.length];
    return [data.hits.length, 1];
}
function ship_collision(n, data, edges){
    if (data == null) data = ships[n];
    size = ship_size(data);
    pos = tile_pos(data.pos);
    if (pos[0]+size[0]-1 > 9 || pos[1]+size[1]-1 > 9) return -1;
    if (edges != null && edges > 0){
        pos[0] -= edges;
        pos[1] -= edges;
        size[0] += edges*2;
        size[1] += edges*2;
    }
    for (i = 0; i < ships.length; i++){
        data2 = ships[i];
        if (i == n || data2 == null || data.field != data2.field) continue;
        size2 = ship_size(data2);
        pos2 = tile_pos(data2.pos);
        AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA = pos[0]+size[0] > pos2[0] &&
            pos[0] < pos2[0]+size2[0] &&
            pos[1] < pos2[1]+size2[1] &&
            pos[1]+size[1] > pos2[1];
        if (AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA) return i;
    }
}
function drop_ship(e){
    tile.appendChild(get_ship(draggingshipnum));
    fin = document.getElementById("finishedplacingbtn");
    for (i = 0; i < ships.length; i++){
        if (ships[i].field != 1){
            fin = null;
            break;
        }
    }
    if (fin != null){
        fin.classList.remove("disabledbtn");
        fin.onclick = finished_ship_placing;
    }
    e.preventDefault();
}
function drag_ship(e){
    data = ships[draggingshipnum];
    tile = event_tile(document.elementsFromPoint(e.clientX, e.clientY));
    prev = [data.pos, data.field];
    data.pos = parseInt(tile.getAttribute("value"));
    data.field = parseInt(tile.parentElement.getAttribute("value"));
    if (data.field != 1 || ship_collision(draggingshipnum, data) != null){
        data.pos = prev[0];
        data.field = prev[1];
        return;
    }
    e.preventDefault();
}
function update_ship_size(sh, len, vert){
    if (vert){
        sh.style.height = 100*len-20+"%";
        sh.style.width = "";
    } else {
        sh.style.width = 100*len-20+"%";
        sh.style.height = "";
    }
    if (coloredships){
        if (sh.classList.contains("powerup")) c = ["gray", "black"];
        else c = specialshipcolors[len-1];
        sh.style.background = "radial-gradient("+c[0]+", "+c[1]+")";
    }
}
function rotate_ship(e){
    n = e.target.getAttribute("value");
    data = ships[n];
    data.vert = !data.vert;
    if (data.field != 1 || ship_collision(n, data) != null){
        data.vert = !data.vert;
        return;
    }
    sh = get_ship(n);
    update_ship_size(sh, data.hits.length, data.vert);
}
function make_ship(tile, field, len, vert){
    sh = document.createElement("div");
    sh.classList = "ship";
    t = 0;
    if (len == 0){
        t = 1;
        sh.classList.add("powerup");
        len = 1;
    }
    update_ship_size(sh, len, (vert == null)?true:vert);
    sh.setAttribute("value", ships.length);
    sh.ondragstart = function(e){
        n = e.target.getAttribute("value");
        draggingshipnum = n;
        if (ships[n].vert) p = e.target.offsetWidth*.6
        else p = e.target.offsetHeight*.6
        e.dataTransfer.setDragImage(e.target, p, p);
    }
    sh.onclick = rotate_ship;
    document.querySelector("#field"+field+" .tile[value='"+tile+"']").appendChild(sh);
    ships.push({hits: Array(len).fill(false), pos: tile, field: field, vert: vert, type: t});
    return sh;
}
function reset_ship_placing(){
    els = document.querySelectorAll(".ship");
    for (i = 0; i < els.length; i++){
        els[i].remove();
    }
    ships = [];
    sd = shipsdata[prefs.ships][2];
    y = 11;
    p = y;
    for (i = 0; i < sd.length; i++){
        len = sd[i];
        if (len == null){
            y += 10;
            p = y;
        } else if (len == 0) p++;
        else {
            make_ship(p, 2, Math.abs(len), len > 0).draggable = true;
            p++;
        }
    }
    if (prefs.bonus == 3){
        sd = [57, 58, 67, 68, 77, 78, 87, 88];
        for (i = 0; i < sd.length; i++){
            make_ship(sd[i], 2, 0, false).draggable = true;
        }
    }
    fin = document.getElementById("finishedplacingbtn");
    fin.classList.add("disabledbtn");
    fin.onclick = null;
}
function gen_boards(){
    resize_fields();
    fields = document.getElementsByClassName("field");
    for (i = 0; i < fields.length; i++){
        ofs = 1;
        for (j = 0; j < 100; j++){
            if (j%10 == 0) ofs = 1-ofs;
            el = document.createElement("div");
            el.classList = "tile";
            if ((j+ofs)%2 == 1) el.classList.add("alt");
            el.setAttribute("value", j);
            el.ondrop = drop_ship;
            el.ondragover = drag_ship;
            el.onclick = tile_click;
            el.onmousemove = tile_enter;
            el.onmousedown = tile_enter;
            if (j == 0) el.style.borderTopLeftRadius = "10px";
            else if (j == 9) el.style.borderTopRightRadius = "10px";
            else if (j == 90) el.style.borderBottomLeftRadius = "10px";
            else if (j == 99) el.style.borderBottomRightRadius = "10px";
            else if (j == 17 && i == 1){
                btn = document.createElement("div");
                btn.innerText = "OK";
                btn.classList = "button2x1 disabledbtn";
                btn.id = "finishedplacingbtn";
                el.appendChild(btn);
            } else if (j == 27 && i == 1){
                btn = document.createElement("div");
                btn.innerText = "Random";
                btn.classList = "button2x1";
                btn.id = "randomizeplacingbtn";
                btn.onclick = randomize_ship_placing;
                el.appendChild(btn);
            } else if (j == 37 && i == 1){
                btn = document.createElement("div");
                btn.innerText = "Reset";
                btn.classList = "button2x1";
                btn.id = "resetplacingbtn";
                btn.onclick = reset_ship_placing;
                el.appendChild(btn);
            }
            fields[i].onmouseleave = tile_enter;
            fields[i].appendChild(el);
        }
    }
    if (stage == 3){
        randomize_ship_lengths();
        reset_ship_placing();
    }
}
function click_option(e){
    sel = e.target;
    n = parseInt(sel.parentElement.parentElement.getAttribute("value"));
    set_option(n, sel.getAttribute("value"), sel);
}
function prefs_idx(n, v){
    if (n == 0){
        if (v === undefined) return prefs.mode;
        prefs.mode = v;
    } else if (n == 1){
        if (v === undefined) return prefs.ships;
        prefs.ships = v;
    } else if (n == 2){
        if (v === undefined) return prefs.bonus;
        prefs.bonus = v;
    } else if (n == 3){
        if (v === undefined) return prefs.vs;
        prefs.vs = v;
    }
}
function set_option(n, v, sel){
    if (v == null) return;
    v = parseInt(v);
    if (sel == null){
        sel = document.querySelector("#prefselect .col[value='"+n+"'] .options .option[value='"+v+"']");
        if (sel == null) return;
    }
    prev = document.querySelector("#prefselect .col[value='"+n+"'] .options .option.selected");
    prev.classList.remove("selected");
    sel.classList.add("selected");
    prefs_idx(n, v);
}
function make_menu(){
    cols = document.querySelectorAll("#prefselect .col");
    for (c = 0; c < cols.length; c++){
        n = parseInt(cols[c].getAttribute("value"));
        d = alldata[n];
        opts = document.createElement("div");
        opts.classList = "options";
        for (s = 0; s < d.length; s++){
            sel = document.createElement("div");
            sel.innerText = d[s][0];
            sel.classList.add("option");
            if (s == 0) sel.classList.add("selected");
            sel.setAttribute("value", s)
            sel.onclick = click_option;
            opts.appendChild(sel);
        }
        cols[c].appendChild(opts);
    }
    document.getElementById("prefselect").style.display = "";
    guide = document.getElementById("guide");
    for (m = 0; m < alldataheadings.length; m++){
        sect = document.createElement("div");
        sect.classList.add("chapter");
        sect.setAttribute("value", m);
        h = document.createElement("h2");
        h.innerText = alldataheadings[m];
        sect.appendChild(h);
        t = "";
        for (i = 0; i < alldata[m].length; i++){
            d = alldata[m][i];
            t += d[0]+":<br>"+d[1]+"<br><br>";
        }
        d = document.createElement("div");
        d.innerHTML = t;
        sect.appendChild(d);
        guide.appendChild(sect);
    }
}
document.body.onkeyup = handle_key;
document.body.onresize = resize_fields;
make_menu();
change_room(urlparams.get("room"));
set_option(0, urlparams.get("mode"));
set_option(1, urlparams.get("ships"));
set_option(2, urlparams.get("bonus"));
set_option(3, urlparams.get("vs"));
