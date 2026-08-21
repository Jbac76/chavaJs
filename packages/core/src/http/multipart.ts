/**
 * A minimal, dependency-free `multipart/form-data` parser — Laravel's
 * `$request->file()` equivalent. Parses the raw request body into regular
 * fields (with bracket-notation nesting like Laravel's `user[name]`) and
 * uploaded files (`UploadedFile` objects with name/type/size/content).
 *
 * Only used when a request arrives with a multipart Content-Type, so the
 * common JSON / urlencoded paths are untouched.
 */

export interface MultipartField {
  name: string;
  filename?: string;
  contentType?: string;
  content: Buffer;
}

export interface MultipartResult {
  fields: Record<string, unknown>;
  files: MultipartField[];
}

/** Extract the boundary token from `multipart/form-data; boundary=...`. */
export function boundaryFromContentType(contentType: string): string | null {
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;\s]+))/i);
  return match ? (match[1] ?? match[2]) : null;
}

/** Expand a `user[name]` (or `a[b][c]`) field name into a nested object. */
function expandPath(target: Record<string, unknown>, key: string, value: unknown): void {
  const parts = key.split(/[\[\]]+/).filter(Boolean);
  if (parts.length === 1) {
    target[key] = value;
    return;
  }
  let cursor: Record<string, unknown> = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const next = cursor[part];
    if (next === null || typeof next !== 'object' || Array.isArray(next)) {
      const created: Record<string, unknown> = {};
      cursor[part] = created;
      cursor = created;
    } else {
      cursor = next as Record<string, unknown>;
    }
  }
  const last = parts[parts.length - 1];
  const existing = cursor[last];
  if (Array.isArray(existing)) {
    existing.push(value);
  } else if (existing !== undefined) {
    cursor[last] = [existing, value];
  } else {
    cursor[last] = value;
  }
}

/** Parse a multipart body into fields + files. */
export function parseMultipart(contentType: string, raw: Buffer): MultipartResult {
  const boundary = boundaryFromContentType(contentType);
  const fields: Record<string, unknown> = {};
  const files: MultipartField[] = [];
  if (!boundary) return { fields, files };

  // Split on the boundary delimiter. Parts are separated by `--boundary`.
  const delimiter = Buffer.from(`--${boundary}`);
  const segments = splitBuffer(raw, delimiter);
  for (const segment of segments) {
    const part = stripBoundaryTail(segment);
    if (part.length === 0) continue;
    const parsed = parsePart(part);
    if (!parsed) continue;
    if (parsed.filename) {
      files.push({
        name: parsed.name,
        filename: parsed.filename,
        contentType: parsed.contentType,
        content: parsed.content,
      });
    } else {
      expandPath(fields, parsed.name, parsed.content.toString('utf8'));
    }
  }
  return { fields, files };
}

/** Split `raw` on every occurrence of `delimiter` (keeps remainder per part). */
function splitBuffer(raw: Buffer, delimiter: Buffer): Buffer[] {
  const parts: Buffer[] = [];
  let start = 0;
  for (;;) {
    const index = raw.indexOf(delimiter, start);
    if (index === -1) {
      parts.push(raw.subarray(start));
      break;
    }
    parts.push(raw.subarray(start, index));
    start = index + delimiter.length;
  }
  return parts;
}

/** Strip a part's trailing `\r\n` and the final `--` of the closing boundary. */
function stripBoundaryTail(part: Buffer): Buffer {
  let end = part.length;
  // Trailing `--` marks the end of the whole body.
  if (part.subarray(end - 2, end).toString() === '--') end -= 2;
  while (end > 0 && (part[end - 1] === 0x0a || part[end - 1] === 0x0d)) end--;
  return part.subarray(0, end);
}

interface ParsedPart {
  name: string;
  filename?: string;
  contentType?: string;
  content: Buffer;
}

/** Parse one part: header block (`\r\n\r\n`) then content. */
function parsePart(part: Buffer): ParsedPart | null {
  const separator = part.indexOf(Buffer.from('\r\n\r\n'));
  if (separator === -1) return null;
  const headerBlock = part.subarray(0, separator).toString('utf8');
  const content = part.subarray(separator + 4);

  const disposition = headerBlock.match(/content-disposition:\s*form-data;([^\r\n]*)/i)?.[1] ?? '';
  const name = disposition.match(/name="([^"]*)"/i)?.[1];
  if (name === undefined) return null;
  const filename = disposition.match(/filename="([^"]*)"/i)?.[1];
  const contentType = headerBlock.match(/content-type:\s*([^\r\n]*)/i)?.[1]?.trim();

  return { name, filename, contentType, content };
}
