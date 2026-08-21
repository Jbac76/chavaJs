import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Application } from '../foundation/Application';
import { Config } from '../config/Config';
import type { Request } from '../http/Request';

interface ManifestEntry {
  file: string;
  css?: string[];
  isEntry?: boolean;
}

type Manifest = Record<string, ManifestEntry>;

const ENTRY_POINT = 'resources/js/app.tsx';

/**
 * Renders the HTML document that bootstraps the Inertia React app.
 * - In dev: injects the Vite dev-server client + entry (HMR).
 * - In production: resolves hashed assets from the Vite build manifest
 *   (the laravel-vite-plugin equivalent).
 */
export class HtmlRenderer {
  private readonly app: Application;
  private cachedManifest: Manifest | null = null;

  public constructor(app: Application) {
    this.app = app;
  }

  public async renderPage(page: Record<string, unknown>, request: Request): Promise<string> {
    const config = this.app.make<Config>('config');
    const props = isRecord(page.props) ? page.props : {};
    const title = typeof props.title === 'string' ? props.title : config.get('app.name', 'chavaJs');
    const tags = await this.assetTags();
    // No csrf-token meta tag: like Laravel Breeze, the CSRF token travels in
    // the XSRF-TOKEN cookie (set by VerifyCsrfToken) which Inertia's axios
    // client echoes back as the X-XSRF-TOKEN header on every request.

    const encoded = JSON.stringify(page)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/'/g, '&#039;');

    return `<!DOCTYPE html>
<html lang="en" class="h-full">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    ${tags}
  </head>
  <body class="h-full antialiased">
    <div id="app" data-page='${encoded}'></div>
  </body>
</html>
`;
  }

  private async assetTags(): Promise<string> {
    if (this.app.isProduction()) {
      return this.productionTags();
    }
    return this.devTags();
  }

  private async devTags(): Promise<string> {
    const config = this.app.make<Config>('config');
    const viteUrl = config.get('frontend.vite_url', 'http://localhost:5173');
    const reactRefreshPreamble = `<script type="module">
import RefreshRuntime from '${viteUrl}/@react-refresh'
RefreshRuntime.injectIntoGlobalHook(window)
window.$RefreshReg$ = () => {}
window.$RefreshSig$ = () => (type) => type
window.__vite_plugin_react_preamble_installed__ = true
</script>`;
    const client = `<script type="module" src="${viteUrl}/@vite/client"></script>`;
    const entry = `<script type="module" src="${viteUrl}/${ENTRY_POINT}"></script>`;
    return [reactRefreshPreamble, client, entry].join('\n    ');
  }

  private productionTags(): string {
    const entry = this.readManifest()[ENTRY_POINT];
    if (!entry) return '<!-- vite manifest not found — run `npm run build` -->';
    const css = (entry.css ?? []).map((file) => `<link rel="stylesheet" href="/build/${file}" />`).join('\n    ');
    const js = `<script type="module" crossorigin src="/build/${entry.file}"></script>`;
    return [css, js].filter(Boolean).join('\n    ');
  }

  private readManifest(): Manifest {
    if (this.cachedManifest) return this.cachedManifest;
    // Vite 6 emits the manifest under `.vite/`; older versions (and the
    // laravel-vite-plugin convention) write it at `public/build/manifest.json`.
    const candidates = [
      join(this.app.publicPath(), 'build', 'manifest.json'),
      join(this.app.publicPath(), 'build', '.vite', 'manifest.json'),
    ];
    for (const path of candidates) {
      if (!existsSync(path)) continue;
      this.cachedManifest = JSON.parse(readFileSync(path, 'utf8')) as Manifest;
      return this.cachedManifest;
    }
    return {};
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
