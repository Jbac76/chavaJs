/**
 * A dependency-free Markdown → HTML renderer used by the in-app documentation
 * (served at /docs). Supports the subset of CommonMark/GFM the framework docs
 * use: headings, paragraphs, bold/italic, inline code, links, images, fenced
 * code blocks, nested lists, blockquotes, tables, and horizontal rules.
 *
 * Input is treated as untrusted-adjacent (escaped) even though the docs are
 * framework-authored, so a stray angle bracket can never inject markup.
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Render inline formatting. Inline code spans are extracted first so their
 * contents are escaped verbatim, then the remaining text is HTML-escaped and
 * bold/italic/links/images are applied.
 */
function inline(text: string): string {
  const codeSpans: string[] = [];
  const protectedText = text.replace(/`([^`\n]+)`/g, (_match, code: string) => {
    codeSpans.push(`<code>${escapeHtml(code)}</code>`);
    return `\u0000${codeSpans.length - 1}\u0000`;
  });

  const escaped = escapeHtml(protectedText)
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img alt="$1" src="$2" />')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');

  return escaped.replace(/\u0000(\d+)\u0000/g, (_match, index: string) => codeSpans[Number(index)]);
}

interface ListItem {
  depth: number;
  ordered: boolean;
  content: string;
}

function isTableSeparator(line: string): boolean {
  return /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(line) && line.includes('-') && line.includes('|');
}

function renderTable(headerLine: string, bodyLines: string[]): string {
  const splitRow = (line: string): string[] =>
    line
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((cell) => cell.trim());

  const headers = splitRow(headerLine);
  const body = bodyLines.filter((line) => !isTableSeparator(line)).map(splitRow);

  const thead = `<thead><tr>${headers.map((h) => `<th>${inline(h)}</th>`).join('')}</tr></thead>`;
  const tbody = body
    .map(
      (row) =>
        `<tr>${headers.map((_, i) => `<td>${inline(row[i] ?? '')}</td>`).join('')}</tr>`,
    )
    .join('');
  return `<div class="table-wrap"><table>${thead}<tbody>${tbody}</tbody></table></div>`;
}

function renderList(items: ListItem[]): string {
  const out: string[] = [];
  const stack: Array<{ ordered: boolean; depth: number }> = [];

  const open = (item: ListItem): void => {
    const tag = item.ordered ? 'ol' : 'ul';
    out.push(`<${tag}>`);
    stack.push({ ordered: item.ordered, depth: item.depth });
  };

  const closeAbove = (depth: number): void => {
    while (stack.length > 0 && stack[stack.length - 1].depth >= depth) {
      out.push(`</${stack.pop()!.ordered ? 'ol' : 'ul'}>`);
    }
  };

  for (const item of items) {
    if (stack.length === 0 || item.depth > stack[stack.length - 1].depth) {
      closeAbove(item.depth);
      if (stack.length > 0 && item.depth > stack[stack.length - 1].depth + 1) {
        // Cap runaway indentation to avoid deeply nested empty lists.
        for (let i = stack.length; i < item.depth - 1; i++) open({ ...item, depth: i });
      }
      open(item);
    } else if (item.depth < stack[stack.length - 1].depth) {
      closeAbove(item.depth);
      open(item);
    }
    out.push(`<li>${inline(item.content)}</li>`);
  }
  while (stack.length > 0) out.push(`</${stack.pop()!.ordered ? 'ol' : 'ul'}>`);
  return out.join('');
}

/**
 * Render a Markdown document to an HTML fragment (no <html>/<body> wrapper —
 * the layout module wraps it).
 */
export function renderMarkdown(source: string): string {
  const rawLines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: string[] = [];
  const buffer: string[] = [];
  const flush = (): void => {
    if (buffer.length > 0) {
      blocks.push(buffer.join('\n'));
      buffer.length = 0;
    }
  };

  let i = 0;
  while (i < rawLines.length) {
    const line = rawLines[i];

    if (line.trim() === '') {
      flush();
      i++;
      continue;
    }

    if (/^```/.test(line.trim())) {
      flush();
      const lang = line.trim().replace(/^```/, '').trim();
      const code: string[] = [];
      i++;
      while (i < rawLines.length && !/^```/.test(rawLines[i].trim())) {
        code.push(rawLines[i]);
        i++;
      }
      i++; // closing fence
      blocks.push(`<pre><code${lang ? ` class="language-${lang.replace(/[^a-zA-Z0-9]/g, '')}"` : ''}>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }

    if (/^\s{0,3}(#{1,6})\s+/.test(line)) {
      flush();
      const match = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
      const level = match![1].length;
      blocks.push(`<h${level}>${inline(match![2])}</h${level}>`);
      i++;
      continue;
    }

    if (/^\s{0,3}>\s?/.test(line)) {
      flush();
      const quote: string[] = [];
      while (i < rawLines.length && /^\s{0,3}>\s?/.test(rawLines[i])) {
        quote.push(rawLines[i].replace(/^\s{0,3}>\s?/, ''));
        i++;
      }
      blocks.push(`<blockquote><p>${inline(quote.join(' '))}</p></blockquote>`);
      continue;
    }

    if (/^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flush();
      blocks.push('<hr />');
      i++;
      continue;
    }

    const tableStart = /^\s*\|.*\|/.test(line) || /^\s*[\w`*[].*\|\s/.test(line);
    if (tableStart && i + 1 < rawLines.length && isTableSeparator(rawLines[i + 1])) {
      flush();
      const headerLine = line;
      const body: string[] = [];
      i += 2;
      while (i < rawLines.length && /^\s*\|.*\|\s*$/.test(rawLines[i])) {
        body.push(rawLines[i]);
        i++;
      }
      blocks.push(renderTable(headerLine, body));
      continue;
    }

    const listMatch = line.match(/^\s*((?:[-*+]|\d+\.))\s+(.*)$/);
    if (listMatch) {
      flush();
      const items: ListItem[] = [];
      while (i < rawLines.length) {
        const m = rawLines[i].match(/^(\s*)((?:[-*+]|\d+\.))\s+(.*)$/);
        if (!m) break;
        const depth = Math.floor(m[1].replace(/\t/g, '  ').length / 2);
        items.push({ depth, ordered: /^\d+\./.test(m[2]), content: m[3] });
        i++;
      }
      blocks.push(renderList(items));
      continue;
    }

    buffer.push(line);
    i++;
  }
  flush();

  return blocks
    .map((block) => {
      // Plain paragraphs were buffered as single lines (blank-line separated).
      if (block.startsWith('<')) return block;
      return `<p>${inline(block.replace(/\n+/g, ' '))}</p>`;
    })
    .join('\n');
}