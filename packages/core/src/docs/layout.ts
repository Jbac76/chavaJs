/**
 * The HTML layout for the in-app framework documentation. Renders a full page
 * with a sticky header, a sidebar listing every docs page, and the rendered
 * content. Zero external dependencies — CSS is inline.
 */

import { Application } from '../foundation/Application';

export interface DocsLayoutOptions {
  title: string;
  body: string;
  pages: Array<{ slug: string; title: string }>;
  active: string;
  appName?: string;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function renderDocsLayout(options: DocsLayoutOptions): string {
  const appName = options.appName ?? 'chavaJs';
  const active = options.active;
  const nav = options.pages
    .map((page) => {
      const classes = page.slug === active ? 'active' : '';
      return `<a class="${classes}" href="/docs/${escapeHtml(page.slug)}">${escapeHtml(page.title)}</a>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(options.title)} · ${escapeHtml(appName)} Documentation</title>
<style>
  :root {
    --accent: #4f46e5;
    --accent-dark: #4338ca;
    --bg: #f8fafc;
    --surface: #ffffff;
    --border: #e2e8f0;
    --text: #1e293b;
    --text-muted: #64748b;
    --code-bg: #0f172a;
    --code-text: #e2e8f0;
  }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background: var(--bg);
    color: var(--text);
    line-height: 1.65;
    font-size: 16px;
  }
  header {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 56px;
    padding: 0 24px;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
  }
  .brand { font-weight: 700; font-size: 17px; letter-spacing: -0.01em; }
  .brand .docs-tag {
    color: var(--accent);
    font-weight: 600;
    margin-left: 8px;
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .brand a { color: var(--text); text-decoration: none; }
  header .back a {
    color: var(--text-muted);
    text-decoration: none;
    font-size: 14px;
  }
  header .back a:hover { color: var(--accent); }
  .layout {
    display: grid;
    grid-template-columns: 280px minmax(0, 1fr);
  }
  nav.sidebar {
    position: sticky;
    top: 56px;
    align-self: start;
    height: calc(100vh - 56px);
    overflow-y: auto;
    padding: 16px 12px;
    background: var(--surface);
    border-right: 1px solid var(--border);
  }
  nav.sidebar a {
    display: block;
    padding: 6px 12px;
    margin-bottom: 2px;
    border-radius: 6px;
    color: #334155;
    text-decoration: none;
    font-size: 14px;
  }
  nav.sidebar a:hover { background: #f1f5f9; }
  nav.sidebar a.active { background: #e0e7ff; color: var(--accent-dark); font-weight: 600; }
  main {
    padding: 40px 48px 80px;
    max-width: 860px;
  }
  main h1 { font-size: 2rem; margin: 0 0 0.5em; letter-spacing: -0.02em; }
  main h2 { font-size: 1.5rem; margin: 1.8em 0 0.6em; letter-spacing: -0.01em; }
  main h3 { font-size: 1.2rem; margin: 1.5em 0 0.5em; }
  main h4 { font-size: 1.05rem; margin: 1.3em 0 0.4em; }
  main p { margin: 0.8em 0; }
  main a { color: var(--accent); text-decoration: none; }
  main a:hover { text-decoration: underline; }
  main code {
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
    font-size: 0.88em;
    background: #eef2f7;
    padding: 0.15em 0.4em;
    border-radius: 4px;
  }
  main pre {
    background: var(--code-bg);
    color: var(--code-text);
    border-radius: 8px;
    padding: 16px 20px;
    overflow-x: auto;
    line-height: 1.55;
  }
  main pre code { background: none; padding: 0; font-size: 0.85em; color: inherit; }
  main blockquote {
    margin: 1em 0;
    padding: 10px 18px;
    border-left: 4px solid var(--accent);
    background: #eef2ff;
    border-radius: 0 6px 6px 0;
    color: #3730a3;
  }
  main blockquote p { margin: 0.4em 0; }
  main ul, main ol { padding-left: 1.4em; }
  main li { margin: 0.35em 0; }
  .table-wrap { overflow-x: auto; margin: 1.2em 0; }
  main table {
    width: 100%;
    border-collapse: collapse;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 14px;
  }
  main th, main td {
    text-align: left;
    padding: 10px 14px;
    border-bottom: 1px solid var(--border);
  }
  main th { background: #f1f5f9; font-weight: 600; }
  main tr:last-child td { border-bottom: none; }
  main img { max-width: 100%; border-radius: 8px; }
  main hr { border: none; border-top: 1px solid var(--border); margin: 2em 0; }
  footer {
    margin-top: 3em;
    padding-top: 1em;
    border-top: 1px solid var(--border);
    color: var(--text-muted);
    font-size: 13px;
  }
  @media (max-width: 900px) {
    .layout { grid-template-columns: 1fr; }
    nav.sidebar { position: static; height: auto; border-right: none; border-bottom: 1px solid var(--border); }
    main { padding: 24px 20px 60px; }
  }
</style>
</head>
<body>
<header>
  <div class="brand"><a href="/docs">${escapeHtml(appName)}<span class="docs-tag">Docs</span></a></div>
  <div class="back"><a href="/">&larr; Back to app</a></div>
</header>
<div class="layout">
  <nav class="sidebar">${nav}</nav>
  <main>${options.body}<footer>${escapeHtml(appName)} framework documentation &middot; v${Application.version}</footer></main>
</div>
</body>
</html>`;
}