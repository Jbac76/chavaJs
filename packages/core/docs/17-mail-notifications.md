# Mail & Notifications

Send transactional email with Mailables, and deliver them (or store them in
the database) with Notifications — Laravel's pattern, ported.

## Mailables

Create a mailable with `js make:mail WelcomeMail`. It declares an envelope and
content:

```ts
// app/Mail/WelcomeMail.ts
import { Mailable, Envelope, MailableContent } from '../../src/mail/Mailable';
import { User } from '../../app/Models/User';

export class WelcomeMail extends Mailable {
  public constructor(private readonly user: User) {
    super();
  }

  public envelope(): Envelope {
    return {
      subject: 'Welcome to chavaJs!',
      to: { address: this.user.email, name: this.user.name },
    };
  }

  public content(): MailableContent {
    return {
      view: 'emails.welcome',          // resources/views/mail/emails/welcome.html
      // or html: '<h1>Hi {{ name }}</h1>',
      // or text: 'A plain-text fallback.',
    };
  }
}
```

Email views are simple templates in `resources/views/mail` using `{{ name }}`
syntax; the mailable's own properties are exposed to the template.

## Sending mail

```ts
import { Mail } from '../src/facades';

await Mail.send(new WelcomeMail(user));
await Mail.to('admin@example.com').cc('billing@example.com').send(new WelcomeMail(user));
await Mail.to(user).send(new WelcomeMail(user));
```

`config/mail.ts` (and env) picks the mailer:

| Driver | Behavior |
| --- | --- |
| `log` | write to `storage/logs/chava-mail.log` (default) |
| `array` | collect in memory — ideal for tests |
| `smtp` | send over SMTP (`MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`) |

The default `From` comes from `MAIL_FROM_ADDRESS` / `MAIL_FROM_NAME`.

## Notifications

Notifications deliver to one or more channels. Create one with
`js make:notification WelcomeNotification`:

```ts
// app/Notifications/WelcomeNotification.ts
import { Notification } from '../../src/notifications/types';
import { Mail } from '../../src/facades';
import { WelcomeMail } from '../Mail/WelcomeMail';

export class WelcomeNotification extends Notification {
  public via(): string[] {
    return ['database', 'mail'];
  }

  public toDatabase(notifiable) {
    return { message: `Welcome, ${notifiable.name}!` };
  }

  public toMail(notifiable) {
    return new WelcomeMail(notifiable);
  }
}
```

Deliver it:

```ts
import { Notification } from '../src/facades';
await Notification.send(user, new WelcomeNotification(user));

// or the Notifiable mixin
await user.notify(new WelcomeNotification(user));
```

Models use the `Notifiable` base to gain `notifications()`, `unreadNotifications()`,
and `markAllAsRead()`:

```ts
export class User extends Notifiable { ... }

await user.notifications().get();
await user.unreadNotifications().count();
await user.markAllAsRead();
```

The `database` channel writes a row to the `notifications` table (created by
`migrations`); the `mail` channel builds a `Mailable` from `toMail()` and sends
it. The starter app ships a full notification inbox at `/notifications`.

## Queuing mail & notifications

Wrap delivery in a job for the queue (see [Queues](16-queues)):

```ts
import { Queue } from '../src/facades';
await Queue.push(new SendWelcomeEmailJob(user));
```

## Next

- [Queues](16-queues) — delivering mail in the background
- [Events](15-events) — hooking mail to app events