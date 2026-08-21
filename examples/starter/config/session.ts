import { Env } from '../src/config/Env';

export default {
  // Driver: 'file' (storage/framework/sessions) or 'array' (in-memory, tests).
  driver: Env.get('SESSION_DRIVER', 'file'),
  files: Env.get('SESSION_FILES', 'storage/framework/sessions'),

  cookie: Env.get('SESSION_COOKIE', 'chava_session'),
  lifetime: Env.number('SESSION_LIFETIME', 120), // minutes
  http_only: Env.bool('SESSION_HTTP_ONLY', true),
  secure: Env.bool('SESSION_SECURE', false),
  same_site: Env.get('SESSION_SAME_SITE', 'lax'),
};
