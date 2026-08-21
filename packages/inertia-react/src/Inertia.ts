import type { Application } from '../foundation/Application';
import { Config } from '../config/Config';
import type { Request } from '../http/Request';
import { InertiaResponse } from './InertiaResponse';

/**
 * The Inertia server adapter — a port of `inertiajs/inertia-laravel`:
 *
 *   Inertia.render('Pages/Users/Index', { users })
 *
 * - For `X-Inertia` requests it responds with the page JSON payload.
 * - For full page loads it renders the HTML shell (via HtmlRenderer).
 * - Handles versioning (409 + X-Inertia-Location) and partial reloads.
 */
export class Inertia {
  private readonly app: Application;
  private readonly sharedProps: Record<string, unknown> = {};

  public constructor(app: Application) {
    this.app = app;
  }

  /** Render an Inertia page. Returns a response the kernel can send. */
  public render(component: string, props: Record<string, unknown> = {}): InertiaResponse {
    return new InertiaResponse(this, component, props);
  }

  /** Share data with every Inertia response (Laravel: Inertia::share()). */
  public share(keyOrProps: string | Record<string, unknown>, value?: unknown): void {
    if (typeof keyOrProps === 'string') {
      this.sharedProps[keyOrProps] = value;
    } else {
      Object.assign(this.sharedProps, keyOrProps);
    }
  }

  public getSharedProps(): Record<string, unknown> {
    return { ...this.sharedProps };
  }

  /** The current asset version (compared against X-Inertia-Version). */
  public version(): string {
    return this.app.make<Config>('config').get('frontend.version', '1');
  }

  /**
   * Resolve the props for this request, honoring Inertia's partial reload
   * protocol (X-Inertia-Partial-Component / X-Inertia-Partial-Data).
   */
  public getProps(
    request: Request,
    component: string,
    props: Record<string, unknown>,
  ): Record<string, unknown> {
    const all = { ...this.sharedProps, ...props };
    const partialComponent = request.header('x-inertia-partial-component');
    const partialData = request.header('x-inertia-partial-data');
    if (partialComponent === component && partialData) {
      const keys = partialData
        .split(',')
        .map((key) => key.trim())
        .filter(Boolean);
      const out: Record<string, unknown> = {};
      for (const key of keys) {
        if (key in all) out[key] = all[key];
      }
      return out;
    }
    return all;
  }

  /** Build the Inertia page payload: { component, props, url, version }. */
  public pageData(
    request: Request,
    component: string,
    props: Record<string, unknown>,
  ): Record<string, unknown> {
    return {
      component,
      props: this.getProps(request, component, props),
      url: request.fullUrl(),
      version: this.version(),
    };
  }
}
