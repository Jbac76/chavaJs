import type { MailDriver, MailMessage } from '../types';

/**
 * Laravel's `array` mail driver: collects sent messages in memory so tests
 * can assert on them. Also available at runtime for debugging.
 */
export class ArrayDriver implements MailDriver {
  public readonly messages: MailMessage[] = [];

  public async send(message: MailMessage): Promise<void> {
    this.messages.push(message);
  }

  /** All messages sent so far (Laravel: Mail::sent()). */
  public sent(): MailMessage[] {
    return this.messages;
  }

  /** Forget every collected message. */
  public clear(): void {
    this.messages.length = 0;
  }
}
