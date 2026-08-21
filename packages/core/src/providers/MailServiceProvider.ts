import { ServiceProvider } from '../container/ServiceProvider';
import { MailManager } from '../mail/MailManager';

/** Binds the `mail` manager that backs the `Mail` facade. */
export class MailServiceProvider extends ServiceProvider {
  public register(): void {
    this.app.singleton('mail', () => new MailManager(this.app));
    this.app.alias('Mail', 'mail');
  }
}
