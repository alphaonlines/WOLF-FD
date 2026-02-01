# WOLF FD Dashboard - Docker Deployment Guide

## Overview
This guide helps you containerize the WOLF FD Dashboard project for production deployment using Docker.

## Project Structure
```
WOLF-FD/
├── Dockerfile.frontend     # Multi-stage React/Vite build
├── Dockerfile.backend      # Multi-stage Node.js + Python backend
├── docker-compose.yml      # Service orchestration
├── nginx.conf              # Frontend nginx configuration
├── deploy.sh               # Automated deployment script
├── .env.production         # Environment variables
├── pos-dashboard-backend/  # Backend source code
└── src/                    # Frontend source code
```

## Prerequisites
- Docker 20.10+
- Docker Compose (included with Docker Desktop)
- Git
- Node.js (for development, not required for deployment)

## Quick Start

### 1. Clone and Navigate
```bash
git clone <repo-url>
cd WOLF-FD
```

### 2. Build and Deploy
```bash
# Build and start all services
./deploy.sh

# Or manually:
docker compose build
docker compose up -d
```

### 3. Access Services
- **Frontend**: http://localhost:8080
- **Backend API**: http://localhost:5057
- **Database**: localhost:5432

## Services

### Frontend
- **Container**: `wolffd-frontend`
- **Port**: 8080 (host) → 80 (container)
- **Tech**: React + Vite + TypeScript
- **Build**: Multi-stage Docker build for optimization

### Backend
- **Container**: `wolffd-backend`
- **Port**: 5057 (host) → 5057 (container)
- **Tech**: Node.js + Express + TypeScript
- **Features**:
  - REST API for sales data
  - Excel file upload/import
  - PostgreSQL integration
  - Health checks

### Database
- **Container**: `wolffd-postgres`
- **Port**: 5432 (host) → 5432 (container)
- **Tech**: PostgreSQL 16
- **Features**:
  - Persistent data storage
  - Health monitoring
  - Schema initialization

## Environment Configuration

### Production Variables
Edit `.env.production` for your environment:
```env
# Frontend
VITE_POS_API_BASE_URL=/fd/api

# Backend
PGHOST=postgres
PGPORT=5432
PGDATABASE=salesdb
PGUSER=salesapp
PGPASSWORD=your_secure_password
PORT=5057
NODE_ENV=production
```

### Security Notes
- Change default passwords before production
- Use environment variables for sensitive data
- Consider adding SSL/HTTPS in production
- Implement proper network security

## Health Checks

### Backend Health
```bash
curl http://localhost:5057/health
```
Response:
```json
{
  "status": "healthy",
  "database": "ok",
  "timestamp": "2026-02-01T11:45:00.000Z"
}
```

### Database Health
```bash
curl http://localhost:5057/api/test
```
Response:
```json
{
  "status": "success",
  "data": {
    "total_sales": 12345
  },
  "timestamp": "2026-02-01T11:45:00.000Z"
}
```

## Volume Mounts

### Data Persistence
- **PostgreSQL Data**: `postgres_data` volume
- **Uploaded Files**: `./pos-dashboard-backend/incoming` → `/app/incoming`
- **Processed Files**: `./pos-dashboard-backend/processed` → `/app/processed`

### Database Schema
- **Initialization**: `./pos-dashboard-backend/db/schema.sql` → `/docker-entrypoint-initdb.d/schema.sql`

## Management Commands

### View Logs
```bash
docker compose logs -f [service-name]
```

### Service Status
```bash
docker compose ps
docker compose top
docker compose stats
```

### Stop Services
```bash
docker compose down
```

### Rebuild Services
```bash
docker compose build --no-cache
docker compose up -d
```

## Import Data

### Upload Excel Files
1. Place Excel files in `pos-dashboard-backend/incoming/`
2. Files are automatically detected and processed
3. Processed files move to `pos-dashboard-backend/processed/`

### Manual Import
```bash
docker compose exec backend npm run import-data
```

## Development vs Production

### Development
```bash
# Frontend development
cd /home/alphahs/WOLF-FD
npm run dev

# Backend development
cd pos-dashboard-backend
npm run dev
```

### Production (Docker)
```bash
# Start all services
./deploy.sh

# Access via nginx proxy
# Frontend: http://localhost:8080
# Backend API: http://localhost:5057
```

## Troubleshooting

### Common Issues

#### 1. Port Conflicts
```bash
# Check what's using ports
sudo ss -tulnp | grep -E ':(8080|5057|5432)'

# Stop conflicting services
# Example: sudo systemctl stop nginx
```

#### 2. Database Connection Issues
```bash
# Check database logs
docker compose logs postgres

# Test database connection
docker compose exec postgres psql -U salesapp -d salesdb
```

#### 3. Build Failures
```bash
# Clean build
docker compose build --no-cache

# Check Dockerfile issues
docker run --rm -it wolffd-backend /bin/sh
```

#### 4. Health Check Failures
```bash
# Check backend health
docker compose exec backend wget --no-verbose --tries=1 --spider http://localhost:5057/health

# Check database health
docker compose exec postgres pg_isready -U salesapp -d salesdb
```

### Debug Mode
```bash
# Start with debug logs
docker compose up -d && docker compose logs -f

# Access container shell
docker compose exec backend /bin/sh
docker compose exec postgres /bin/bash
```

## Monitoring

### Resource Usage
```bash
docker compose stats
docker compose top
```

### Log Analysis
```bash
docker compose logs --tail=100 --follow
```

### Health Monitoring
```bash
# Check all health statuses
docker compose ps -a
```

## Backup and Restore

### Database Backup
```bash
# Create backup
docker compose exec postgres pg_dump -U salesapp salesdb > backup.sql

# Restore backup
docker compose exec postgres psql -U salesapp salesdb < backup.sql
```

### Data Volume Backup
```bash
# Backup volume
docker run --rm -v wolffd_postgres_data:/volume -v $(pwd):/backup alpine tar czf /backup/postgres_backup.tar.gz -C /volume .

# Restore volume
docker run --rm -v wolffd_postgres_data:/volume -v $(pwd):/backup alpine tar xzf /backup/postgres_backup.tar.gz -C /volume
```

## Security Best Practices

### 1. Network Security
- Use Docker bridge networking
- Implement firewall rules
- Limit exposed ports

### 2. Data Security
- Encrypt sensitive data
- Use environment variables for secrets
- Implement access controls

### 3. Application Security
- Keep dependencies updated
- Use HTTPS in production
- Implement authentication/authorization

### 4. Container Security
- Use minimal base images
- Run as non-root user
- Regular security scanning

## Performance Optimization

### 1. Resource Limits
```yaml
# In docker-compose.yml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M
```

### 2. Caching
- Use Docker layer caching
- Implement build optimization
- Use CDN for static assets

### 3. Database Optimization
- Index frequently queried columns
- Use connection pooling
- Implement query optimization

## Scaling

### Horizontal Scaling
```bash
# Scale backend instances
docker compose up -d --scale backend=3
```

### Load Balancing
- Use nginx reverse proxy
- Implement session affinity
- Configure health checks

## Migration Guide

### From Development to Production
1. Update environment variables
2. Configure SSL/HTTPS
3. Set up monitoring
4. Implement backup strategy
5. Test failover procedures

### From Docker Compose to Kubernetes
1. Create Kubernetes manifests
2. Set up ingress controller
3. Configure persistent volumes
4. Implement service discovery
5. Add monitoring and logging

## Support

### Logs and Debugging
```bash
# View all logs
docker compose logs

# View specific service logs
docker compose logs [service-name]

# Real-time logs
docker compose logs -f
```

### Health Status
```bash
docker compose ps
docker compose exec backend wget --no-verbose --tries=1 --spider http://localhost:5057/health
```

### Community
- Check GitHub issues
- Review documentation
- Join community forums

---

**Note**: Always test deployments in a staging environment before production deployment.

**Last Updated**: 2026-02-01
**Version**: 1.0