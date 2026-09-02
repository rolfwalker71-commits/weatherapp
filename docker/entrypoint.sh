#!/bin/sh
set -eu

mkdir -p /data /var/log/nginx /run

export HOST="${HOST:-127.0.0.1}"
export PORT="${PORT:-4426}"
export SQLITE_PATH="${SQLITE_PATH:-/data/push.db}"

node /opt/push-api/src/index.js &
NODE_PID=$!

shutdown() {
	kill "$NODE_PID" 2>/dev/null || true
	wait "$NODE_PID" 2>/dev/null || true
}
trap shutdown EXIT INT TERM

i=0
while [ "$i" -lt 80 ]; do
	if node -e "fetch('http://127.0.0.1:${PORT}/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"; then
		break
	fi
	if ! kill -0 "$NODE_PID" 2>/dev/null; then
		echo "push-api exited before it was ready" >&2
		exit 1
	fi
	i=$((i + 1))
	sleep 0.1
done

nginx -g 'daemon off;' &
NGINX_PID=$!

while kill -0 "$NODE_PID" 2>/dev/null && kill -0 "$NGINX_PID" 2>/dev/null; do
	sleep 1
done

if kill -0 "$NODE_PID" 2>/dev/null; then
	echo "nginx exited" >&2
	kill "$NGINX_PID" 2>/dev/null || true
	exit 1
fi
echo "push-api exited" >&2
kill "$NGINX_PID" 2>/dev/null || true
exit 1
