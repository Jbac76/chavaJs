import type { ServerResponse } from 'node:http';
import type { Application } from '../foundation/Application';
import type { Request } from '../http/Request';
import { Response } from '../http/Response';
import type { HtmlRenderer } from './HtmlRenderer';
import type { Inertia } from './Inertia';

/**
 * The response returned by `Inertia.render()`. Implements the Inertia
 * protocol on top of the plain Response class.
 */
export class InertiaResponse extends Response {
  private readonly inertia: Inertia;
  private readonly component: string;
  private readonly props: Record<string, unknown>;

  public constructor(inertia: Inertia, component: string, props: Record<string, unknown>) {
    super(null, 200);
    this.inertia = inertia;
    this.component = component;
    this.props = props;
  }

  public override async toNode(
    res: ServerResponse,
    request: Request,
    app: Application,
  ): Promise<void> {
    const page = this.inertia.pageData(request, this.component, this.props);

    if (request.isInertia()) {
      // Version mismatch → 409 with X-Inertia-Location so the client hard-reloads.
      const clientVersion = request.header('x-inertia-version');
      if (request.method() === 'GET' && clientVersion !== undefined && clientVersion !== this.inertia.version()) {
        this.status(409);
        this.header('x-inertia-location', request.fullUrl());
        this.body = '';
        this.toNodeBase(res);
        return;
      }
      this.header('x-inertia', 'true');
      this.json(page);
      this.toNodeBase(res);
      return;
    }

    // Full page load: render the HTML shell with the page payload embedded.
    const renderer = app.make<HtmlRenderer>('inertia.html-renderer');
    const html = await renderer.renderPage(page, request);
    this.html(html);
    this.toNodeBase(res);
  }

  private toNodeBase(res: ServerResponse): void {
    super.toNode(res);
  }
}
