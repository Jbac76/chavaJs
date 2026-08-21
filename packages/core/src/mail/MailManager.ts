import type { Application } from '../foundation/Application';
import { Config } from '../config/Config';
import { RuntimeException } from '../support/exceptions';
import type { MailRecipient, Mailable } from './Mailable';
import type { MailDriver, MailMessage } from './types';
import { ArrayDriver } from './drivers/ArrayDriver';
import { LogDriver } from './drivers/LogDriver';
import { SmtpDriver } from './drivers/SmtpDriver';

/**
 * Laravel's MailManager — resolves the configured transport and is the root
 * of the `Mail` facade:
 *
 *   await Mail.send(new WelcomeMail(user));
 *   await Mail.to('x@y.com').send(new WelcomeMail(user));
 */
export class MailManager {
  private readonly drivers = new Map<string, MailDriver>();
  private readonly defaultFrom: { address: string; name?: string } | undefined;

  public constructor(private readonly app: Application) {
    const config = this.app.make<Config>('config');
    const from = config.get<{ address?: string; name?: string }>('mail.from', {});
    this.defaultFrom = from.address ? { address: from.address, name: from.name } : undefined;
  }

  public connection(name?: string): MailDriver {
    const config = this.app.make<Config>('config');
    const connectionName = name ?? config.get<string>('mail.default', 'log');
    const cached = this.drivers.get(connectionName);
    if (cached) return cached;

    const connectionConfig = config.get<Record<string, unknown>>(
      `mail.connections.${connectionName}`,
      {},
    );
    const driver = String(connectionConfig.driver ?? connectionName);
    let instance: MailDriver;
    switch (driver) {
      case 'log':
        instance = new LogDriver(this.app);
        break;
      case 'array':
        instance = new ArrayDriver();
        break;
      case 'smtp':
        instance = new SmtpDriver(connectionConfig);
        break;
      default:
        throw new RuntimeException(`Mail driver [${driver}] is not supported.`);
    }
    this.drivers.set(connectionName, instance);
    return instance;
  }

  /** Send a mailable on the default transport. */
  public async send(mailable: Mailable): Promise<void> {
    await this.sendMessage(await mailable.buildMessage());
  }

  /** Send a fully-built message (applies the configured default From). */
  public async sendMessage(message: MailMessage): Promise<void> {
    if (!message.from && this.defaultFrom) {
      message.from = this.defaultFrom;
    }
    await this.connection().send(message);
  }

  /** Set default recipients for a chain: Mail.to('a@b.c').send(mailable). */
  public to(recipient: MailRecipient | MailRecipient[] | string): RecipientChain {
    return new RecipientChain(this, recipient);
  }

  /** The array driver's collected messages (tests). */
  public sent(): MailMessage[] {
    const driver = this.connection('array');
    return driver instanceof ArrayDriver ? driver.sent() : [];
  }
}

/** Fluent recipient chain: Mail.to('x@y.com').cc(...).send(mailable). */
class RecipientChain {
  public constructor(
    private readonly manager: MailManager,
    private readonly toList: MailRecipient | MailRecipient[] | string,
  ) {}

  private readonly ccList: Array<MailRecipient | MailRecipient[] | string> = [];
  private readonly bccList: Array<MailRecipient | MailRecipient[] | string> = [];

  public cc(recipient: MailRecipient | MailRecipient[] | string): this {
    this.ccList.push(recipient);
    return this;
  }

  public bcc(recipient: MailRecipient | MailRecipient[] | string): this {
    this.bccList.push(recipient);
    return this;
  }

  public async send(mailable: Mailable): Promise<void> {
    // Recipients on the chain win over the envelope's `to`; cc/bcc append.
    const message = await mailable.buildMessage();
    message.to = flattenRecipients(this.toList);
    message.cc = [...(message.cc ?? []), ...flattenRecipients(this.ccList)];
    message.bcc = [...(message.bcc ?? []), ...flattenRecipients(this.bccList)];
    await this.manager.sendMessage(message);
  }
}

/** Normalize string/recipient/nested-array inputs into a MailRecipient[]. */
function flattenRecipients(value: MailRecipient | string | Array<MailRecipient | string | MailRecipient[]>): MailRecipient[] {
  const list = Array.isArray(value) ? value : [value];
  return list.flatMap((item): MailRecipient[] => {
    if (typeof item === 'string') return [{ address: item }];
    if (Array.isArray(item)) return item;
    return [item];
  });
}
