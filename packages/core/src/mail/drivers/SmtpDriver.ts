import { createRequire } from 'node:module';
import type { MailDriver, MailMessage } from '../types';

/** Minimal Nodemailer surface used by this driver (types only). */
interface NodemailerLike {
  createTransport(config: unknown): {
    sendMail(message: unknown): Promise<unknown>;
    close(): void;
  };
}

/**
 * Laravel's `smtp` mail driver, backed by Nodemailer. Nodemailer is an
 * optional dependency (`npm i nodemailer`) — this driver is only instantiated
 * when config/mail.ts selects it.
 */
export class SmtpDriver implements MailDriver {
  public constructor(private readonly config: Record<string, unknown>) {}

  public async send(message: MailMessage): Promise<void> {
    const require = createRequire(import.meta.url);
    let nodemailer: NodemailerLike;
    try {
      nodemailer = require('nodemailer') as NodemailerLike;
    } catch {
      throw new Error(
        'The smtp mail driver requires nodemailer - run `npm i nodemailer` ' +
          'and configure config/mail.ts with your SMTP settings.',
      );
    }

    const transport = nodemailer.createTransport({
      host: String(this.config.host ?? 'smtp.example.com'),
      port: Number(this.config.port ?? 587),
      secure: Boolean(this.config.secure ?? false),
      auth:
        this.config.username && this.config.password
          ? { user: String(this.config.username), pass: String(this.config.password) }
          : undefined,
    });

    await transport.sendMail({
      from: message.from ? `"${message.from.name ?? ''}" <${message.from.address}>` : undefined,
      to: message.to.map((r) => `"${r.name ?? ''}" <${r.address}>`).join(', '),
      cc: (message.cc ?? []).map((r) => `"${r.name ?? ''}" <${r.address}>`).join(', ') || undefined,
      bcc: (message.bcc ?? []).map((r) => `"${r.name ?? ''}" <${r.address}>`).join(', ') || undefined,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });

    transport.close();
  }
}
