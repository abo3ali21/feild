# Field Shift --- Production Deployment & Operations Runbook

This guide outlines production deployment, environment configuration, database operations, health monitoring, and rollback procedures for Field Shift v1.0.

---

## 1. System Architecture & Ports

| Component | Technology | Default Port | Internal Service Name |
| :--- | :--- | :--- | :--- |
| **Frontend** | Next.js 15 (Turbopack / Standalone) | `3000` | `frontend` |
| **Backend API** | FastAPI + Uvicorn | `8000` | `backend` |
| **Database** | SQLite WAL mode (Persistent volume) | N/A | `/app/data/sensor_readings.db` |
| **Reverse Proxy** | Nginx / Caddy / Cloudflare | `80` / `443` | `gateway` |

---

## 2. Environment Variables Configuration

Create `/etc/field-shift/production.env` (never commit to source control):

```bash
# Backend Configuration
LOG_LEVEL=INFO
CORS_ORIGINS=https://fieldshift.ag,https://app.fieldshift.ag
SENSOR_STORE_PATH=/app/data/sensor_readings.db
SENSOR_INTERNAL_TOKEN=generate-a-strong-internal-secret-token-here
SENSOR_RATE_LIMIT_PER_MINUTE=10

# Frontend Configuration
NEXT_PUBLIC_API_BASE_URL=https://api.fieldshift.ag
NODE_ENV=production
```

---

## 3. Deployment with Docker Compose

To deploy or update in production:

```bash
# 1. Pull latest verified release tag
git fetch --tags
git checkout tags/v1.0.0

# 2. Build and launch containers in detached mode
docker compose -f docker-compose.yml up -d --build

# 3. Verify container health status
docker compose ps
docker compose logs -f --tail=50
```

---

## 4. HTTPS & Reverse Proxy Configuration (Nginx Example)

```nginx
server {
    listen 443 ssl http2;
    server_name api.fieldshift.ag;

    ssl_certificate /etc/letsencrypt/live/fieldshift.ag/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/fieldshift.ag/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 443 ssl http2;
    server_name app.fieldshift.ag;

    ssl_certificate /etc/letsencrypt/live/fieldshift.ag/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/fieldshift.ag/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 5. Automated Backups & Disaster Recovery

### Daily Cron Job for Backups
Add to root crontab (`crontab -e`):
```bash
0 2 * * * /usr/bin/python3 /opt/field-shift/scripts/backup_db.py >> /var/log/field_shift_backup.log 2>&1
```

### Restoration Procedure
In the event of database corruption or hardware failure:
```bash
# 1. Stop backend service
docker compose stop backend

# 2. Restore from the most recent verified backup file
python3 scripts/restore_db.py backups/sensor_readings_backup_YYYYMMDD_HHMMSS.db

# 3. Restart backend service
docker compose start backend

# 4. Verify health endpoint
curl -s http://127.0.0.1:8000/api/v1/health
```

---

## 6. Rollback Procedure

If a deployed version causes unexpected errors:
```bash
# Roll back to the previous stable git commit or tag
git checkout <previous-commit-sha>
docker compose up -d --build
```
The persistent SQLite volume preserves all sensor ingestion and evaluation records across rollbacks.
