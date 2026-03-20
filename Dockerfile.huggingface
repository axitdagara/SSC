FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ .

ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

# ============================================

FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install Nginx
RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ ./backend/

# Copy frontend built files from builder stage
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Copy Nginx config for Hugging Face
COPY nginx-huggingface.conf /etc/nginx/conf.d/default.conf

# Copy startup script
COPY docker-entrypoint.sh /app/
RUN chmod +x /app/docker-entrypoint.sh

# Create data directory for SQLite
RUN mkdir -p /app/data

EXPOSE 7860

# Start both backend and frontend
ENTRYPOINT ["/app/docker-entrypoint.sh"]
