/**
 * In-app framework documentation routes.
 *
 * When an app carries a `docs/` directory (opt-in via `chava new --docs`),
 * `registerDocsRoutes()` exposes:
 *   GET /docs          → the index page (00-index.md)
 *   GET /docs/:page    → a specific docs page
 *
 * The routes read the Markdown files at request time and render them to HTML
 * with the shared layout + sidebar. Unknown pages and path-traversal attempts
 * get a 404.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import type { Request } from '../http/Request';
import { Response } from '../http/Response';
import type { Router } from '../http/Router';
import { renderDocsLayout } from './layout';
import { renderMarkdown } from './markdown';

export interface DocsPage {
  slug: string;
  title: string;
}

const INDEX_PAGE = '00-index';

function extractTitle(source: string): string | null {
  const match = source.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

function prettify(slug: string): string {
  return slug
    .replace(/^\d+-/, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/** List the docs pages (slug = filename, title = first H1), in filename order. */
export function collectDocsPages(docsDir: string): DocsPage[] {
  if (!existsSync(docsDir)) return [];
  return readdirSync(docsDir)
    .filter((file) => file.endsWith('.md'))
    .sort()
    .map((file) => {
      const slug = file.replace(/\.md$/, '');
      const source = readFileSync(join(docsDir, file), 'utf8');
      return { slug, title: extractTitle(source) ?? prettify(slug) };
    });
}

function renderDocsResponse(
  docsDir: string,
  pages: DocsPage[],
  slug: string,
  status = 200,
): Response {
  const safeSlug = /^[a-zA-Z0-9_-]+$/.test(slug) ? slug : '';
  const base = resolve(docsDir);
  const file = resolve(base, `${safeSlug}.md`);

  if (!safeSlug || !file.startsWith(base + sep) || !existsSync(file)) {
    const body = renderDocsLayout({
      title: 'Not Found',
      pages,
      active: '',
      body: '<h1>404 — Page Not Found</h1><p>That documentation page does not exist. Use the sidebar to browse the docs.</p>',
    });
    return Response.html(body, 404);
  }

  const source = readFileSync(file, 'utf8');
  const body = renderDocsLayout({
    title: extractTitle(source) ?? prettify(safeSlug),
    pages,
    active: safeSlug,
    body: renderMarkdown(source),
  });
  return Response.html(body, status);
}

/**
 * Register the /docs routes. No-ops when the app doesn't have a docs
 * directory (so a lean `chava new --no-docs` app gets no extra routes).
 */
export function registerDocsRoutes(router: Router, docsDir: string): void {
  const pages = collectDocsPages(docsDir);
  if (pages.length === 0) return;

  const indexSlug = pages.find((page) => page.slug === INDEX_PAGE)?.slug ?? pages[0].slug;

  router.get('/docs', () => renderDocsResponse(docsDir, pages, indexSlug));
  router.get('/docs/{page}', (_request: Request, page: string | object) =>
    renderDocsResponse(docsDir, pages, String(page)),
  );
}