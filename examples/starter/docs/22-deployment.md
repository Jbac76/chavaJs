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