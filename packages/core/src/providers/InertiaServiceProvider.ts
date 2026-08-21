import { ServiceProvider } from '../container/ServiceProvider';
import { HtmlRenderer } from '../inertia/HtmlRenderer';
import { Inertia } from '../inertia/Inertia';

/** Binds the Inertia server adapter (the Laravel `inertiajs/inertia-laravel` equivalent). */
export class InertiaServiceProvider extends ServiceProvider {
  public register(): void {
    this.app.singleton('inertia', () => new Inertia(this.app));
    this.app.singleton('inertia.html-renderer', () => new HtmlRenderer(this.app));
    this.app.alias('Inertia', 'inertia');
  }
}
