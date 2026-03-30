#!/bin/bash
set -e

BACKEND_PID=""

cleanup() {
	if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
		kill "$BACKEND_PID" 2>/dev/null || true
	fi
}

trap cleanup EXIT INT TERM

# Expose selected runtime env vars to the browser for static frontend builds.
cat > /app/frontend/dist/env.js <<EOF
window.__ENV__ = {
	VITE_API_URL: "${VITE_API_URL:-/api}",
	VITE_FIREBASE_API_KEY: "${VITE_FIREBASE_API_KEY:-}",
	VITE_FIREBASE_AUTH_DOMAIN: "${VITE_FIREBASE_AUTH_DOMAIN:-}",
	VITE_FIREBASE_PROJECT_ID: "${VITE_FIREBASE_PROJECT_ID:-}",
	VITE_FIREBASE_STORAGE_BUCKET: "${VITE_FIREBASE_STORAGE_BUCKET:-}",
	VITE_FIREBASE_MESSAGING_SENDER_ID: "${VITE_FIREBASE_MESSAGING_SENDER_ID:-}",
	VITE_FIREBASE_APP_ID: "${VITE_FIREBASE_APP_ID:-}"
};
EOF

# Start backend in background
echo "Starting backend..."
cd /app/backend
gunicorn main:app \
  -k uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000 \
  --workers 2 \
  --threads 2 \
  --timeout 30 \
  --preload \
  --access-logfile - \
  --error-logfile - \
  --capture-output \
  --log-level info &
BACKEND_PID=$!

# Warmup backend
echo "Warming up backend..."
sleep 3
curl -s http://127.0.0.1:8000/health || true

# Start Nginx in foreground
echo "Starting Nginx..."
cd /app
exec nginx -g "daemon off;"
