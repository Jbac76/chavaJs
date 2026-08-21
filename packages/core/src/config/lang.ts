import { Env } from '../config/Env';

export default {
  locale: Env.get('APP_LOCALE', 'en'),
  fallback_locale: Env.get('APP_FALLBACK_LOCALE', 'en'),
  paths: ['lang'],
};
