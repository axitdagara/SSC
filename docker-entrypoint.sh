#!/bin/bash
set -e

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
