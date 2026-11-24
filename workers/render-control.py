"""Hanya dipanggil dengan PID worker milik server, tanpa input PID dari API."""
import sys
import psutil

root = psutil.Process(int(sys.argv[1]))
action = sys.argv[2]
if action not in ("pause", "resume", "cancel"):
    raise ValueError(action)
if action != "resume":
    root.suspend()
children = root.children(recursive=True)
for child in reversed(children):
    try:
        if action == "pause":
            child.suspend()
        elif action == "cancel":
            child.kill()
        else:
            child.resume()
    except psutil.NoSuchProcess:
        pass
if action == "cancel":
    root.kill()
elif action == "resume":
    root.resume()
