import { Env } from '../src/config/Env';

export default {
  name: Env.get('APP_NAME', 'chavaJs'),
  env: Env.get('APP_ENV', 'production'),
  debug: Env.bool('APP_DEBUG', false),
  url: Env.get('APP_URL', 'http://localhost:8080'),
  key: Env.get('APP_KEY', ''),
  timezone: 'UTC',
};
