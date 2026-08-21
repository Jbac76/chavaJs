import { join } from 'node:path';
import { Command } from 'commander';
import { classWithSuffix, write } from '../helpers/generators';

const EVENT_STUB = (name: string): string => `export class ${name} {
  public constructor(
    // public readonly user: User,
  ) {}
}
`;

const LISTENER_STUB = (name: string): string => `import type { UserRegistered } from '../Events/UserRegistered';

// For a queued listener (runs via queue:work, never in the request):
// import { ShouldQueue } from '../../../src/events/queue';
// export class ${name} extends ShouldQueue {
export class ${name} {
  public async handle(event: UserRegistered): Promise<void> {
    // Handle the event...
    void event;
  }
}
`;

const JOB_STUB = (name: string): string => `import { Job } from '../../../src/queue/Job';

export class ${name} extends Job {
  // public tries = 3;
  // public backoff = 3;

  public constructor(
    // public readonly userId: number,
  ) {
    super();
  }

  public async handle(): Promise<void> {
    // Do the work...
  }
}
`;

const NOTIFICATION_STUB = (name: string): string => `import { Notification } from '../../../src/notifications/types';
import type { Mailable } from '../../../src/mail/Mailable';
import type { NotifiableModel, DatabaseNotificationData } from '../../../src/notifications/types';

export class ${name} extends Notification {
  public via(_notifiable: NotifiableModel): string[] {
    return ['mail', 'database'];
  }

  public toMail(notifiable: NotifiableModel): Mailable {
    throw new Error('toMail() not implemented');
  }

  public toDatabase(_notifiable: NotifiableModel): DatabaseNotificationData {
    return {
      title: 'New notification',
      body: 'Body text',
    };
  }
}
`;

const MAIL_STUB = (name: string): string => `import { Mailable } from '../../../src/mail/Mailable';
import type { Envelope, MailableContent } from '../../../src/mail/Mailable';

export class ${name} extends Mailable {
  public envelope(): Envelope {
    return {
      subject: 'Hello from chavaJs',
      // to: { address: 'user@example.com', name: 'User' },
    };
  }

  public content(): MailableContent {
    return {
      html: '<h1>Hello!</h1>',
    };
  }
}
`;

export function makeEventCommand(): Command {
  return new Command('make:event')
    .description('Create a new event class')
    .argument('<name>', 'The event name (e.g. UserRegistered)')
    .action(async (name: string) => {
      const className = classWithSuffix(name, 'Event');
      write(join(process.cwd(), 'app', 'Events', `${className}.ts`), EVENT_STUB(className));
    });
}

export function makeListenerCommand(): Command {
  return new Command('make:listener')
    .description('Create a new event listener class')
    .argument('<name>', 'The listener name (e.g. SendWelcomeNotification)')
    .action(async (name: string) => {
      const className = classWithSuffix(name, 'Listener');
      write(join(process.cwd(), 'app', 'Listeners', `${className}.ts`), LISTENER_STUB(className));
    });
}

export function makeJobCommand(): Command {
  return new Command('make:job')
    .description('Create a new job class')
    .argument('<name>', 'The job name (e.g. SendWelcomeEmail)')
    .action(async (name: string) => {
      const className = classWithSuffix(name, 'Job');
      write(join(process.cwd(), 'app', 'Jobs', `${className}.ts`), JOB_STUB(className));
    });
}

export function makeNotificationCommand(): Command {
  return new Command('make:notification')
    .description('Create a new notification class')
    .argument('<name>', 'The notification name (e.g. WelcomeNotification)')
    .action(async (name: string) => {
      const className = classWithSuffix(name, 'Notification');
      write(join(process.cwd(), 'app', 'Notifications', `${className}.ts`), NOTIFICATION_STUB(className));
    });
}

export function makeMailCommand(): Command {
  return new Command('make:mail')
    .description('Create a new mailable class')
    .argument('<name>', 'The mailable name (e.g. WelcomeMail)')
    .action(async (name: string) => {
      const className = classWithSuffix(name, 'Mail');
      write(join(process.cwd(), 'app', 'Mail', `${className}.ts`), MAIL_STUB(className));
    });
}
