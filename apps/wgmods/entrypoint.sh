#!/bin/sh
# The display, the VNC server on it and the websocket bridge to that server,
# then the publisher. x11vnc and websockify bind to loopback only: the one way
# to the screen from outside is remote.ts, which checks the login token.
set -eu
rm -f /tmp/.X99-lock
Xvfb :99 -screen 0 1280x800x24 -nolisten tcp &
sleep 1
x11vnc -display :99 -localhost -forever -shared -nopw -quiet &
websockify 127.0.0.1:6080 127.0.0.1:5900 &
exec npm start
