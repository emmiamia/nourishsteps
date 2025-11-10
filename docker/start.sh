#!/bin/bash

# Start backend in background
cd /app/backend
python app.py &
BACKEND_PID=$!

# Wait for backend to be ready
sleep 3

# Start nginx in foreground
nginx -g 'daemon off;'

# Keep container running
wait $BACKEND_PID

