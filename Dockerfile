# Multi-stage build for NourishSteps

# Stage 1: Backend
FROM python:3.11-slim as backend

WORKDIR /app/backend

# Install dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ .

# Expose backend port
EXPOSE 5001

# Stage 2: Frontend
FROM node:20-alpine as frontend

WORKDIR /app/frontend

# Copy package files
COPY frontend/package*.json ./

# Install dependencies
RUN npm ci

# Copy frontend code
COPY frontend/ .

# Build frontend
RUN npm run build

# Stage 3: Production
FROM python:3.11-slim

WORKDIR /app

# Install nginx for serving frontend
RUN apt-get update && apt-get install -y nginx && rm -rf /var/lib/apt/lists/*

# Copy backend from stage 1
COPY --from=backend /app/backend ./backend

# Copy frontend build from stage 2
COPY --from=frontend /app/frontend/dist /var/www/html

# Copy nginx config
COPY docker/nginx.conf /etc/nginx/sites-available/default

# Create startup script
COPY docker/start.sh /start.sh
RUN chmod +x /start.sh

# Initialize database
RUN cd backend && python -c "from models import Base, engine; Base.metadata.create_all(engine)"

EXPOSE 80

CMD ["/start.sh"]

