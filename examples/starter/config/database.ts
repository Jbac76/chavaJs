import { Env } from '../src/config/Env';

export default {
  default: Env.get('DB_CONNECTION', 'sqlite'),

  connections: {
    sqlite: {
      driver: 'sqlite',
      // ':memory:' for tests; a file path for development (created on demand).
      database: Env.get('DB_DATABASE', 'database/database.sqlite'),
    },

    pg: {
      driver: 'pg',
      host: Env.get('DB_HOST', '127.0.0.1'),
      port: Env.number('DB_PORT', 5432),
      database: Env.get('DB_DATABASE', 'chava'),
      username: Env.get('DB_USERNAME', 'postgres'),
      password: Env.get('DB_PASSWORD', ''),
      ssl: Env.bool('DB_SSL', false),
    },

    mysql: {
      driver: 'mysql',
      host: Env.get('DB_HOST', '127.0.0.1'),
      port: Env.number('DB_PORT', 3306),
      database: Env.get('DB_DATABASE', 'chava'),
      username: Env.get('DB_USERNAME', 'root'),
      password: Env.get('DB_PASSWORD', ''),
      ssl: Env.bool('DB_SSL', false),
    },
  },
};
