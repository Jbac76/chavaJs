import { Env } from './Env';

export default {
  default: Env.get('FILESYSTEM_DISK', 'local'),
  disks: {
    local: {
      driver: 'local' as const,
      root: Env.get('STORAGE_PATH', 'storage/app'),
      visibility: 'public' as const,
    },
  },
};
