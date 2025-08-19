# W.I.T. Deployment Guide

## Overview

This guide covers deploying W.I.T. in production environments, from single-workshop installations to multi-site deployments.

## Deployment Options

### 1. Single Workshop (Recommended Start)
- One server machine
- Local network only
- SQLite or PostgreSQL
- Suitable for up to 20 devices

### 2. Small Business
- Dedicated server
- PostgreSQL database
- Redis caching
- SSL/TLS encryption
- 20-100 devices

### 3. Enterprise/Multi-Site
- Kubernetes cluster
- PostgreSQL cluster
- Redis cluster
- Load balancing
- 100+ devices

## Single Workshop Deployment

### Hardware Requirements

**Minimum**:
- CPU: 2 cores
- RAM: 4GB
- Storage: 20GB SSD
- Network: 100Mbps

**Recommended**:
- CPU: 4+ cores
- RAM: 8GB+
- Storage: 100GB SSD
- Network: 1Gbps

### Quick Deploy Script

```bash
#!/bin/bash
# W.I.T. Quick Deploy

# Install dependencies
sudo apt update
sudo apt install -y python3.10 python3-pip nodejs npm postgresql nginx

# Clone repository
git clone https://github.com/yourusername/wit.git
cd wit

# Setup backend
cd software/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Setup database
sudo -u postgres createdb wit_production
sudo -u postgres createuser wit_user -P

# Configure environment
cp .env.production.example .env
# Edit .env with your settings

# Run migrations
alembic upgrade head

# Build frontend
cd ../frontend/web
npm install
npm run build

# Setup systemd service
sudo cp deployment/wit-backend.service /etc/systemd/system/
sudo systemctl enable wit-backend
sudo systemctl start wit-backend

# Configure nginx
sudo cp deployment/nginx.conf /etc/nginx/sites-available/wit
sudo ln -s /etc/nginx/sites-available/wit /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

echo "W.I.T. deployed! Access at http://your-server-ip"
```

### Systemd Service File

Create `/etc/systemd/system/wit-backend.service`:

```ini
[Unit]
Description=W.I.T. Backend Service
After=network.target postgresql.service

[Service]
Type=simple
User=wit
Group=wit
WorkingDirectory=/opt/wit/software/backend
Environment="PATH=/opt/wit/software/backend/venv/bin"
ExecStart=/opt/wit/software/backend/venv/bin/python dev_server.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Nginx Configuration

Create `/etc/nginx/sites-available/wit`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        root /opt/wit/software/frontend/web/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket
    location /ws {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }
}
```

## Docker Deployment

### Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: wit
      POSTGRES_USER: wit_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - wit_network

  redis:
    image: redis:7-alpine
    networks:
      - wit_network

  backend:
    build: ./software/backend
    depends_on:
      - postgres
      - redis
    environment:
      DATABASE_URL: postgresql://wit_user:${DB_PASSWORD}@postgres/wit
      REDIS_URL: redis://redis:6379
      SECRET_KEY: ${SECRET_KEY}
    volumes:
      - ./wit_storage:/app/wit_storage
    networks:
      - wit_network
    ports:
      - "8000:8000"

  frontend:
    build: ./software/frontend/web
    networks:
      - wit_network
    ports:
      - "80:80"

  mqtt:
    image: eclipse-mosquitto:2
    volumes:
      - ./deployment/mosquitto/config:/mosquitto/config
      - mosquitto_data:/mosquitto/data
      - mosquitto_log:/mosquitto/log
    networks:
      - wit_network
    ports:
      - "1883:1883"
      - "9001:9001"

volumes:
  postgres_data:
  mosquitto_data:
  mosquitto_log:

networks:
  wit_network:
```

### Backend Dockerfile

Create `software/backend/Dockerfile`:

```dockerfile
FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Create non-root user
RUN useradd -m -u 1000 wit && chown -R wit:wit /app
USER wit

# Run application
CMD ["uvicorn", "dev_server:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Frontend Dockerfile

Create `software/frontend/web/Dockerfile`:

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Build application
COPY . .
RUN npm run build

# Production image
FROM nginx:alpine

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config
COPY deployment/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
```

## Kubernetes Deployment

### Namespace and ConfigMap

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: wit

---
apiVersion: v1
kind: ConfigMap
metadata:
  name: wit-config
  namespace: wit
data:
  REDIS_URL: "redis://redis-service:6379"
  MQTT_BROKER: "mqtt-service:1883"
```

### Backend Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: wit-backend
  namespace: wit
spec:
  replicas: 3
  selector:
    matchLabels:
      app: wit-backend
  template:
    metadata:
      labels:
        app: wit-backend
    spec:
      containers:
      - name: backend
        image: your-registry/wit-backend:latest
        ports:
        - containerPort: 8000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: wit-secrets
              key: database-url
        - name: SECRET_KEY
          valueFrom:
            secretKeyRef:
              name: wit-secrets
              key: secret-key
        envFrom:
        - configMapRef:
            name: wit-config
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 5
```

### Service and Ingress

```yaml
apiVersion: v1
kind: Service
metadata:
  name: wit-backend-service
  namespace: wit
spec:
  selector:
    app: wit-backend
  ports:
  - port: 80
    targetPort: 8000
  type: ClusterIP

---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: wit-ingress
  namespace: wit
  annotations:
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"
    nginx.ingress.kubernetes.io/websocket-services: "wit-backend-service"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - wit.yourdomain.com
    secretName: wit-tls
  rules:
  - host: wit.yourdomain.com
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: wit-backend-service
            port:
              number: 80
      - path: /ws
        pathType: Prefix
        backend:
          service:
            name: wit-backend-service
            port:
              number: 80
      - path: /
        pathType: Prefix
        backend:
          service:
            name: wit-frontend-service
            port:
              number: 80
```

## SSL/TLS Configuration

### Let's Encrypt with Certbot

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo systemctl enable certbot.timer
```

### Manual SSL Configuration

Update nginx configuration:

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/ssl/certs/wit.crt;
    ssl_certificate_key /etc/ssl/private/wit.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # ... rest of configuration
}

server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}
```

## Environment Configuration

### Production .env file

```bash
# Database
DATABASE_URL=postgresql://wit_user:secure_password@localhost/wit_production

# Security
SECRET_KEY=your-very-secure-secret-key-generate-with-openssl
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Redis
REDIS_URL=redis://localhost:6379

# File Storage
UPLOAD_FOLDER=/var/wit/uploads
PROJECT_FOLDER=/var/wit/projects

# MQTT
MQTT_BROKER=localhost
MQTT_PORT=1883

# AI Providers (optional)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# Email (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Monitoring
SENTRY_DSN=https://...@sentry.io/...
```

## Backup and Recovery

### Automated Backup Script

```bash
#!/bin/bash
# W.I.T. Backup Script

BACKUP_DIR="/backup/wit"
DATE=$(date +%Y%m%d_%H%M%S)

# Backup database
pg_dump wit_production > $BACKUP_DIR/database_$DATE.sql

# Backup files
tar -czf $BACKUP_DIR/files_$DATE.tar.gz /var/wit/uploads /var/wit/projects

# Backup configuration
tar -czf $BACKUP_DIR/config_$DATE.tar.gz /opt/wit/.env /etc/nginx/sites-available/wit

# Keep only last 30 days
find $BACKUP_DIR -type f -mtime +30 -delete

# Upload to S3 (optional)
aws s3 sync $BACKUP_DIR s3://your-backup-bucket/wit/
```

### Restore Procedure

```bash
# Restore database
psql wit_production < backup.sql

# Restore files
tar -xzf files_backup.tar.gz -C /

# Restore configuration
tar -xzf config_backup.tar.gz -C /

# Restart services
sudo systemctl restart wit-backend
sudo systemctl restart nginx
```

## Monitoring

### Health Checks

Backend health endpoint:
```python
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow(),
        "version": "1.0.0"
    }
```

### Prometheus Metrics

```python
from prometheus_client import Counter, Histogram, generate_latest

request_count = Counter('wit_requests_total', 'Total requests')
request_duration = Histogram('wit_request_duration_seconds', 'Request duration')

@app.get("/metrics")
async def metrics():
    return Response(generate_latest(), media_type="text/plain")
```

### Logging

Configure structured logging:

```python
import structlog

logger = structlog.get_logger()

logger.info("server_started", port=8000, environment="production")
```

## Security Hardening

### Firewall Rules

```bash
# Allow only necessary ports
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp  # SSH
sudo ufw allow 80/tcp  # HTTP
sudo ufw allow 443/tcp # HTTPS
sudo ufw allow 1883/tcp # MQTT (if needed externally)
sudo ufw enable
```

### Security Headers

Add to nginx:

```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "no-referrer-when-downgrade" always;
add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
```

## Performance Tuning

### PostgreSQL Optimization

```sql
-- Adjust based on available RAM
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;
ALTER SYSTEM SET random_page_cost = 1.1;
```

### Redis Configuration

```conf
# /etc/redis/redis.conf
maxmemory 256mb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
```

### Nginx Optimization

```nginx
worker_processes auto;
worker_connections 1024;

http {
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss application/rss+xml application/atom+xml image/svg+xml;
}
```

## Troubleshooting

### Common Issues

1. **WebSocket Connection Failures**
   - Check nginx proxy settings
   - Verify firewall allows WebSocket
   - Check client/server protocol match

2. **Database Connection Pool Exhausted**
   - Increase max connections in PostgreSQL
   - Check for connection leaks
   - Implement connection pooling

3. **High Memory Usage**
   - Enable Redis memory limits
   - Check for memory leaks
   - Scale horizontally

4. **Slow Response Times**
   - Enable query logging
   - Add database indexes
   - Implement caching

### Debug Mode

Enable detailed logging:
```bash
export WIT_DEBUG=true
export LOG_LEVEL=DEBUG
```

## Maintenance

### Update Procedure

```bash
# Backup first!
./backup.sh

# Pull latest code
cd /opt/wit
git pull

# Update backend
cd software/backend
source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head

# Update frontend
cd ../frontend/web
npm install
npm run build

# Restart services
sudo systemctl restart wit-backend
sudo systemctl restart nginx
```

### Database Maintenance

```sql
-- Regular maintenance
VACUUM ANALYZE;

-- Full vacuum (requires downtime)
VACUUM FULL;

-- Reindex
REINDEX DATABASE wit_production;
```

## Support

For deployment support:
- Check deployment logs: `journalctl -u wit-backend -f`
- Review nginx logs: `/var/log/nginx/error.log`
- Database logs: `/var/log/postgresql/`
- Join Discord #deployment channel