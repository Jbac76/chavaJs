import { Mailable } from '../../src/mail/Mailable';
import type { Envelope, MailableContent } from '../../src/mail/Mailable';
import type { NotifiableModel } from '../../src/notifications/types';

/**
 * The welcome email — Laravel's Mailable, ported. The body renders
 * resources/views/mail/emails/welcome.html with the recipient exposed as
 * `user`.
 */
export class WelcomeMail extends Mailable {
  public constructor(public readonly user: NotifiableModel) {
    super();
  }

  public envelope(): Envelope {
    return {
      subject: 'Welcome to chavaJs!',
      to: {
        address: String(this.user.getAttribute('email') ?? ''),
        name: String(this.user.getAttribute('name') ?? ''),
      },
    };
  }

  public content(): MailableContent {
    return {
      view: 'emails.welcome',
    };
  }
}
