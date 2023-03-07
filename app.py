import os, sys, subprocess, json, ctypes
from threading import Thread
from socket import gethostbyname, gethostname
from flask import Flask, send_file, request, abort
from urllib.request import urlopen
from urllib.error import URLError
try: from waitress import serve
except ImportError: serve = None
try:
    from infi.systray import SysTrayIcon
    from infi.systray.traybar import*
except ImportError: SysTrayIcon = None

app = Flask(__name__)
window_shown = True

def exec_py(path, args, mode="GET"):
    args = {"MODE": mode, "ARGS": args}
    proc = subprocess.run(["py", path, json.dumps(args)], capture_output=True, text=True, shell=True)
    out = proc.stdout
    if proc.stderr and config.get("return_errors", False):
        out += "<pre>%s</pre>"%proc.stderr.replace(os.getcwd()+"\\", "")
    out = out.encode("utf-8")
    return out
def check_ok(path):
    if not os.path.isfile(path): abort(404)
def handle_blacklist(*args, **kwargs):
    abort(403)

@app.route("/", defaults={"path": ""}, methods=["GET"])
@app.route("/<path:path>", methods=["GET"])
def do_get(path):
    if len(path) == 0 or path.endswith("/"):
        for fn in ("index.html", "index.htm", "index.py", "index.pyw"):
            fn = os.path.join(os.path.dirname(path), fn)
            if os.path.isfile(fn): return do_get(fn)
        abort(404)
    else:
        check_ok(path)
        ext = os.path.splitext(path)[1][1:].lower()
        data = request.args.to_dict()
        if ext in ("py", "pyw"): return exec_py(path, data)
        return send_file(path)

@app.route("/<path:path>", methods=["POST"])
def do_post(path):
    check_ok(path)
    ext = os.path.splitext(path)[1][1:].lower()
    if request.is_json: data = request.get_json()
    else: data = None
    if ext in ("py", "pyw"): return exec_py(path, data, mode="POST")
    abort(400)

def print_public_ip():
    try: print(f"Public IP: {urlopen('https://v4.ident.me').read().decode('utf-8')}:{config.get('port', 80)}") # or api.ipify.org
    except URLError: print("Failed to fetch public IP")
def make_systray():
    global hwnd, user32, systray
    if SysTrayIcon != None and config.get("show_tray", False):
        hwnd = ctypes.windll.kernel32.GetConsoleWindow()
        if hwnd != 0:
            user32 = ctypes.WinDLL("user32", use_last_error=True)
            traymenu = (("Show console", None, toggle_console),)
            SysTrayIcon._notify = tray_notify
            systray = SysTrayIcon(config.get("icon"), config["name"], traymenu, on_quit=tray_shutdown)
            systray.start()
def toggle_console(t):
    global window_shown
    window_shown = not window_shown
    user32.ShowWindow(hwnd, 5 if window_shown else 0)
def tray_notify(self, hwnd, msg, wparam, lparam):
    if lparam == WM_LBUTTONUP:
        self._execute_menu_option(self._default_menu_index+SysTrayIcon.FIRST_ID)
    elif lparam == WM_RBUTTONUP:
        self._show_menu()
    return True
def tray_shutdown(t):
    subprocess.call("taskkill /im python.exe", shell=True)
    subprocess.call("taskkill /im py.exe", shell=True)

if __name__ == "__main__":
    if len(sys.argv) > 1: os.chdir(sys.argv[1])
    if os.path.isfile("config.json"):
        with open("config.json") as f:
            config = json.loads(f.read())
    else: config = {}
    config.setdefault("name", os.path.basename(__file__))
    for fn in config.get("blacklist", []):
        new = ""
        for i, char in enumerate(fn):
            if char == "*": new += f"<_{i}>"
            else: new += char
        app.add_url_rule(new, None, view_func=handle_blacklist)
    port = config.get("port", 80)
    print(f"Local IP: {gethostbyname(gethostname())}:{port}")
    systray = None
    if config.get("production", False) and serve != None:
        make_systray()
        Thread(target=print_public_ip).start()
        serve(app, port=port, threads=6)
    else:
        if config.get("production", False):
            print("Install the `waitress` module to run with a production server")
        app.run(port=port, threaded=True, debug=True, extra_files=["config.json"])
    if systray != None: systray.shutdown()
