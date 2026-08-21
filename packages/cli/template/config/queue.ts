import { Env } from '../src/config/Env';

export default {
  default: Env.get('QUEUE_CONNECTION', 'sync'),

  connections: {
    sync: {
      driver: 'sync',
    },

    // Database-backed queue — consumed by `chava queue:work`.
    database: {
      driver: 'database',
      table: 'jobs',
      failed: 'failed_jobs',
      queue: 'default',
      retry_after: 90,
    },

    // Redis queue (BullMQ) — requires `npm i bullmq ioredis`.
    redis: {
      driver: 'redis',
      queue: 'default',
      connection: {
        host: Env.get('REDIS_HOST', '127.0.0.1'),
        port: Env.number('REDIS_PORT', 6379),
      },
    },
  },
};
