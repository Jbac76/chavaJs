import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Application } from '../foundation/Application';
import { currentApp } from '../foundation/registry';
import { renderTemplate } from './Template';
import type { MailMessage } from './types';

/** A message recipient. */
export interface MailRecipient {
  address: string;
  name?: string;
}

/** The mailable's envelope: who it's addressed to and the subject. */
export interface Envelope {
  from?: MailRecipient;
  to?: MailRecipient | MailRecipient[];
  cc?: MailRecipient | MailRecipient[];
  bcc?: MailRecipient | MailRecipient[];
  replyTo?: MailRecipient;
  subject: string;
}

/** The mailable's content: an HTML string or a view file in resources/views/mail. */
export interface MailableContent {
  view?: string; // e.g. 'emails.welcome' → resources/views/mail/emails/welcome.html
  html?: string;
  text?: string;
}

/**
 * Laravel's Mailable, ported:
 *
 *   export class WelcomeMail extends Mailable {
 *     public constructor(private readonly user: User) { super(); }
 *     public envelope(): Envelope {
 *       return { subject: 'Welcome!', to: { address: this.user.email, name: this.user.name } };
 *     }
 *     public content(): MailableContent {
 *       return { view: 'emails.welcome', html: ... };
 *     }
 *   }
 */
export abstract class Mailable {
  private readonly toQueue: MailRecipient[] = [];
  private readonly ccQueue: MailRecipient[] = [];
  private readonly bccQueue: MailRecipient[] = [];

  public abstract envelope(): Envelope;
  public abstract content(): MailableContent;

  /** Compose the envelope (subject, recipients) — Laravel's buildEnvelope(). */
  public buildEnvelope(): Envelope {
    const envelope = this.envelope();
    const to = [...(envelope.to ? asArray(envelope.to) : []), ...this.toQueue];
    return {
      ...envelope,
      from: envelope.from,
      to: to.length > 0 ? to : undefined,
      cc: [...(envelope.cc ? asArray(envelope.cc) : []), ...this.ccQueue],
      bcc: [...(envelope.bcc ? asArray(envelope.bcc) : []), ...this.bccQueue],
      replyTo: envelope.replyTo,
    };
  }

  /** Render the body into a complete MailMessage (Laravel's buildContent). */
  public async buildMessage(): Promise<MailMessage> {
    const envelope = this.buildEnvelope();
    const content = this.content();
    const html = content.html ?? (content.view ? await this.renderView(content.view) : '');
    const subject = envelope.subject;
    const text = content.text;
    return {
      subject,
      html,
      text,
      to: (envelope.to ? asArray(envelope.to) : []).map(normalize),
      cc: (envelope.cc ? asArray(envelope.cc) : []).map(normalize),
      bcc: (envelope.bcc ? asArray(envelope.bcc) : []).map(normalize),
      from: envelope.from ? normalize(envelope.from) : undefined,
      replyTo: envelope.replyTo ? normalize(envelope.replyTo) : undefined,
    };
  }

  // -------------------------------------------------------------- fluent API

  public to(recipient: MailRecipient | MailRecipient[] | string): this {
    for (const item of asArray(recipient)) this.toQueue.push(typeof item === 'string' ? { address: item } : item);
    return this;
  }

  public cc(recipient: MailRecipient | MailRecipient[] | string): this {
    for (const item of asArray(recipient)) this.ccQueue.push(typeof item === 'string' ? { address: item } : item);
    return this;
  }

  public bcc(recipient: MailRecipient | MailRecipient[] | string): this {
    for (const item of asArray(recipient)) this.bccQueue.push(typeof item === 'string' ? { address: item } : item);
    return this;
  }

  // -------------------------------------------------------------- internals

  private async renderView(view: string): Promise<string> {
    const app = currentApp();
    const path = this.resolveViewPath(app, view);
    const source = readFileSync(path, 'utf8');
    const vars = this.viewData();
    return renderTemplate(source, vars);
  }

  private resolveViewPath(app: Application, view: string): string {
    // 'emails.welcome' → resources/views/mail/emails/welcome.html
    const relative = `${view.replaceAll('.', '/')}.html`;
    return join(app.path('resources', 'views', 'mail'), relative);
  }

  /** Data exposed to the template (Laravel: with() / viewData). */
  protected viewData(): Record<string, unknown> {
    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(this)) {
      if (key.startsWith('_') || key === 'toQueue' || key === 'ccQueue' || key === 'bccQueue') continue;
      data[key] = value;
    }
    return data;
  }
}

function asArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value];
}

function normalize(recipient: MailRecipient | string): MailRecipient {
  return typeof recipient === 'string' ? { address: recipient } : recipient;
}
