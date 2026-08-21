import { Mail } from '../../src/facades';
import { Job } from '../../src/queue/Job';
import { User } from '../Models/User';
import { WelcomeMail } from '../Mail/WelcomeMail';

/**
 * Sends the welcome email through the queue. Like Laravel, only the user id
 * is serialized — the model is re-retrieved inside handle() so the job stays
 * light and always works with fresh data.
 *
 *   await Queue.push(new SendWelcomeEmailJob(user.id));
 */
export class SendWelcomeEmailJob extends Job {
  // public tries = 3;
  // public backoff = 3;

  public constructor(public readonly userId: number) {
    super();
  }

  public async handle(): Promise<void> {
    const user = (await User.findOrFail(this.userId)) as User;
    await Mail.send(new WelcomeMail(user));
  }
}
