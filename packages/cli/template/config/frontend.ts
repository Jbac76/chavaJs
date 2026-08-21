import { Env } from '../src/config/Env';

export default {
  /** URL of the Vite dev server (used in development for HMR). */
  vite_url: Env.get('VITE_URL', 'http://localhost:5173'),
  vite_port: Env.number('VITE_PORT', 5173),
  /** Asset version; bump it to force clients to hard-reload after deploys. */
  version: '1.0.0',
};
