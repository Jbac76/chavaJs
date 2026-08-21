import { Env } from '../src/config/Env';

export default {
  default: Env.get('MAIL_MAILER', 'log'),

  // Where the `log` driver writes messages (relative to the project root).
  path: Env.get('MAIL_LOG_PATH', 'storage/logs/chava-mail.log'),

  from: {
    address: Env.get('MAIL_FROM_ADDRESS', 'hello@chava.dev'),
    name: Env.get('MAIL_FROM_NAME', 'chavaJs'),
  },

  connections: {
    log: { driver: 'log' },
    array: { driver: 'array' },

    // SMTP via Nodemailer — requires `npm i nodemailer`.
    smtp: {
      driver: 'smtp',
      host: Env.get('MAIL_HOST', 'smtp.example.com'),
      port: Env.number('MAIL_PORT', 587),
      secure: Env.bool('MAIL_ENCRYPTION_TLS', false),
      username: Env.get('MAIL_USERNAME', ''),
      password: Env.get('MAIL_PASSWORD', ''),
    },
  },
};
