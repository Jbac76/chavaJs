# Deployment

Deploying a chavaJs app is a standard Node.js deployment: install, build the
front end, migrate, then run the server under a process manager.

## Before you ship

- Set `APP_ENV=production` and `APP_DEBUG=false`.
- Set a strong `APP_KEY` (it signs the session cookie) — generate a random
  string and keep it secret.
- Set `DB_CONNECTION` (or the pg/mysql env vars) and run your migrations.
- Set `MAIL_MAILER=smtp` (or a third-party transport) with real credentials.
- Point `APP_URL` at your public domain.
- Behind HTTPS, set `secure: true` for the session cookie in `config/session.ts`.

## Build the front end

```bash
npm ci
npm run build          # typechecks, then `vite build` → public/build/
```

## Migrate

```bash
js migrate             # apply pending migrations
js db:seed             # seed once if needed
```

## Run the server

The server serves the built assets from `public/build` automatically when
`APP_ENV=production` (and `npm run dev` / `js serve` start Vite when not).

Use a process manager so the app restarts on crash and on deploy:

```bash
# pm2
npm i -g pm2
pm2 start bin/chava.js --name my-app -- serve --no-vite
pm2 save && pm2 startup
```

or run it with `js serve --no-vite` under systemd / Docker. The server binds
`127.0.0.1:8080` by default — put a reverse proxy (nginx, Caddy, or a
platform's ingress) in front and terminate TLS there.

## Docker deployment

### Dockerfile

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/public/build ./public/build
COPY . .
ENV APP_ENV=production
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "bin/chava.js", "serve", "--no-vite"]
```

### docker-compose.yml

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "8080:8080"
    env_file: .env
    depends_on:
      - db
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: chava
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: secret
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

## Platform guides

### Railway

1. Connect your GitHub repo
2. Set env vars in the Railway dashboard (`APP_KEY`, `DB_CONNECTION`, etc.)
3. Railway auto-detects Node.js and runs `npm start` — override with:
   ```
   start: node bin/chava.js serve --no-vite
   ```
4. Add a cron service for scheduling: `js schedule:run`

### Fly.io

```bash
fly launch
fly postgres create --name chava-db
fly secrets set APP_KEY=$(openssl rand -hex 32) DB_CONNECTION=pg
fly deploy
```

### Render

1. Create a Web Service → Node
2. Build command: `npm ci && npm run build`
3. Start command: `node bin/chava.js serve --no-vite`
4. Add a Background Worker for queues: `js queue:work`
5. Add a Cron Job for scheduling: `js schedule:run`

## Scheduled tasks

Add the scheduler to cron so `schedule:run` fires every minute (see
[Scheduling](18-scheduling)):

```bash
* * * * * cd /srv/my-app && js schedule:run >> /dev/null 2>&1
```

## Queued work

Switch `QUEUE_CONNECTION=database` (or `redis`) and run at least one worker:

```bash
js queue:work
```

Run it under a process manager too (`pm2 start bin/chava.js --name worker -- queue:work`).

## Health check endpoint

Add a simple health check for load balancers:

```ts
Route.get('/health', () => ({ status: 'ok', timestamp: Date.now() }));
```

## Graceful shutdown

The server handles `SIGTERM` and `SIGINT` for graceful shutdown - important
for zero-downtime deploys:

```bash
kill -SIGTERM <pid>
# server finishes in-flight requests, then exits
```

The full drain sequence:

1. Stop accepting new connections (`server.close()`).
2. Wait for in-flight requests to finish.
3. Idle keep-alive sockets are dropped after 2s so the drain completes.
4. `app.shutdown()` tears down services — cache timers stopped, database
   connection pools closed.
5. A 30-second watchdog force-exits if anything hangs.

```bash
# verify locally
node bin/js.js serve & sleep 2; kill -SIGTERM %1
# → INFO SIGTERM received — draining connections… → INFO Shutdown complete.
```

## Environment summary

| Setting | Production value |
| --- | --- |
| `APP_ENV` | `production` |
| `APP_DEBUG` | `false` |
| `APP_KEY` | a strong random string |
| `DB_CONNECTION` | `pg` or `mysql` (not a local file) |
| `QUEUE_CONNECTION` | `database` or `redis` |
| `MAIL_MAILER` | `smtp` or equivalent |

## Next

- [Configuration](02-configuration) — every env variable
- [Console](20-console) — commands to run in production
