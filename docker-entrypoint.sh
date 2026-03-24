#!/bin/bash
set -e

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
gunicorn main:app -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000 --workers 1 --timeout 120 &
BACKEND_PID=$!

# Give backend time to start
sleep 2

# Start Nginx in foreground
echo "Starting Nginx..."
cd /app
nginx -g "daemon off;"

# Cleanup on exit
trap "kill $BACKEND_PID" EXIT
