# Docker Development Environment

This directory contains Docker configuration for chavaJs development.

## Quick Start

1. Start all services:
   ```bash
   docker-compose -f docker-compose.dev.yml up -d
   ```

2. Check service health:
   ```bash
   docker-compose -f docker-compose.dev.yml ps
   ```

3. Copy environment file:
   ```bash
   cp .env.docker examples/starter/.env
   ```

4. Run migrations:
   ```bash
   cd examples/starter
   npm run migrate
   npm run db:seed
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

## Services

### PostgreSQL (Port 5432)
- **Database**: `chava_dev`, `chava_test`
- **User**: `chava`
- **Password**: `chava`

**Connect via CLI:**
```bash
docker exec -it chavajs-postgres psql -U chava -d chava_dev
```

### MySQL (Port 3306)
- **Database**: `chava_dev`, `chava_test`
- **User**: `chava`
- **Password**: `chava`
- **Root Password**: `root`

**Connect via CLI:**
```bash
docker exec -it chavajs-mysql mysql -u chava -pchava chava_dev
```

### Redis (Port 6379)
- **Password**: `chava`

**Connect via CLI:**
```bash
docker exec -it chavajs-redis redis-cli
AUTH chava
PING
```

### MailHog
- **SMTP**: Port 1025
- **Web UI**: http://localhost:8025

View all emails sent by your application in the web interface.

### Adminer (Database Management)
- **URL**: http://localhost:8090
- **System**: PostgreSQL or MySQL
- **Server**: postgres or mysql
- **Username**: chava
- **Password**: chava
- **Database**: chava_dev

## Common Commands

### Start Services
```bash
docker-compose -f docker-compose.dev.yml up -d
```

### Stop Services
```bash
docker-compose -f docker-compose.dev.yml stop
```

### Restart Services
```bash
docker-compose -f docker-compose.dev.yml restart
```

### View Logs
```bash
# All services
docker-compose -f docker-compose.dev.yml logs -f

# Specific service
docker-compose -f docker-compose.dev.yml logs -f postgres
```

### Remove Everything (including volumes)
```bash
docker-compose -f docker-compose.dev.yml down -v
```

## Switching Database Drivers

### Use PostgreSQL
Update `.env`:
```bash
DB_CONNECTION=postgres
DB_HOST=127.0.0.1
DB_PORT=5432
```

### Use MySQL
Update `.env`:
```bash
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
```

### Use SQLite (no Docker needed)
Update `.env`:
```bash
DB_CONNECTION=sqlite
DB_DATABASE=database/database.sqlite
```

## Troubleshooting

### Port Already in Use
If ports 5432, 3306, or 6379 are already in use, you can either:

1. Stop the conflicting service
2. Change the port mapping in `docker-compose.dev.yml`:
   ```yaml
   ports:
     - "5433:5432"  # Use 5433 instead of 5432
   ```

### Container Won't Start
Check logs:
```bash
docker-compose -f docker-compose.dev.yml logs [service-name]
```

### Reset Database
```bash
docker-compose -f docker-compose.dev.yml down -v
docker-compose -f docker-compose.dev.yml up -d
cd examples/starter
npm run migrate:fresh --seed
```

### Connection Refused
Ensure services are healthy:
```bash
docker-compose -f docker-compose.dev.yml ps
```

All services should show "healthy" status.

## Using Redis Queue

1. Update `.env`:
   ```bash
   QUEUE_CONNECTION=redis
   REDIS_HOST=127.0.0.1
   REDIS_PORT=6379
   REDIS_PASSWORD=chava
   ```

2. Install Redis dependencies:
   ```bash
   npm install bullmq ioredis
   ```

3. Start queue worker:
   ```bash
   npm run queue:work
   ```

## Production Considerations

This Docker setup is for **development only**. For production:

- Use proper secret management (not hardcoded passwords)
- Configure proper backup strategies
- Use persistent volumes with backup policies
- Implement monitoring and alerting
- Use production-grade database configurations
- Enable SSL/TLS for all connections
- Set resource limits on containers
- Use orchestration (Kubernetes, Docker Swarm)

## Network Details

All services are connected via the `chavajs-network` bridge network, allowing them to communicate using service names:

- From app to postgres: `postgres:5432`
- From app to redis: `redis:6379`
- From app to mailhog: `mailhog:1025`

However, from your host machine (where Node.js runs), use `127.0.0.1` or `localhost`.
