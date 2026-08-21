import { ServiceProvider } from '../../src/container/ServiceProvider';
import type { Gate } from '../../src/auth/Gate';
import { User } from '../Models/User';
import { UserPolicy } from '../Policies/UserPolicy';

/**
 * The application's primary service provider (Laravel's AppServiceProvider).
 *
 * register() → bind services into the container
 * boot()     → run code after every provider has registered
 */
export class AppServiceProvider extends ServiceProvider {
  public register(): void {
    // Example binding (uncomment to try it):
    // this.app.singleton('greeter', () => ({ greet: (name: string) => `Hello, ${name}!` }));
  }

  public async boot(): Promise<void> {
    // Register the User policy with the Gate (Laravel: Gate::policy()).
    const gate = this.app.make<Gate>('gate');
    gate.policy(User, UserPolicy);
  }
}
