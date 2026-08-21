import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Application } from '../../foundation/Application';
import { Config } from '../../config/Config';
import type { MailDriver, MailMessage } from '../types';

/**
 * Laravel's `log` mail driver: writes every message to a log file (default
 * storage/logs/chava-mail.log), so email can be developed without an SMTP
 * server.
 */
export class LogDriver implements MailDriver {
  private readonly app: Application;

  public constructor(app: Application) {
    this.app = app;
  }

  public async send(message: MailMessage): Promise<void> {
    const config = this.app.make<Config>('config');
    const relativePath = String(config.get('mail.path', 'storage/logs/chava-mail.log'));
    const filePath = join(this.app.basePathDir(), relativePath);
    mkdirSync(join(filePath, '..'), { recursive: true });

    const recipients = [...message.to, ...(message.cc ?? []), ...(message.bcc ?? [])]
      .map((r) => r.address)
      .join(', ');
    const entry = [
      `\n--- ${new Date().toISOString()} ---`,
      `To: ${recipients}`,
      `From: ${message.from ? `${message.from.name ?? ''} <${message.from.address}>`.trim() : '(default)'}`,
      `Subject: ${message.subject}`,
      '',
      message.html,
      '',
      '--- end ---',
    ].join('\n');

    appendFileSync(filePath, entry, 'utf8');
  }
}
