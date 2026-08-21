import { describe, expect, it } from 'vitest';
import { Readable } from 'node:stream';
import { Request } from '../../src/http/Request';
import { parseMultipart, boundaryFromContentType } from '../../src/http/multipart';

const BOUNDARY = '----chavaBoundary1234';

function multipartBody(parts: Array<{ headers: string[]; body: string | Buffer }>): Buffer {
  const chunks: Buffer[] = [];
  for (const part of parts) {
    chunks.push(Buffer.from(`--${BOUNDARY}\r\n`));
    chunks.push(Buffer.from(part.headers.join('\r\n') + '\r\n\r\n'));
    chunks.push(typeof part.body === 'string' ? Buffer.from(part.body) : part.body);
    chunks.push(Buffer.from('\r\n'));
  }
  chunks.push(Buffer.from(`--${BOUNDARY}--\r\n`));
  return Buffer.concat(chunks);
}

async function requestFromBody(body: Buffer, contentType: string): Promise<Request> {
  const req = new Readable({ read() {} });
  (req as unknown as Record<string, unknown>).method = 'POST';
  (req as unknown as Record<string, unknown>).headers = { 'content-type': contentType };
  (req as unknown as Record<string, unknown>).socket = { remoteAddress: '127.0.0.1' };
  req.push(body);
  req.push(null);
  return Request.fromNode(req as never);
}

describe('multipart parser', () => {
  it('extracts the boundary token from the content type', () => {
    expect(boundaryFromContentType(`multipart/form-data; boundary=${BOUNDARY}`)).toBe(BOUNDARY);
    expect(boundaryFromContentType('multipart/form-data; boundary="quoted"')).toBe('quoted');
    expect(boundaryFromContentType('application/json')).toBeNull();
  });

  it('parses regular fields and bracket-notation nesting', () => {
    const raw = multipartBody([
      { headers: ['Content-Disposition: form-data; name="name"'], body: 'Ada' },
      { headers: ['Content-Disposition: form-data; name="user[email]"'], body: 'ada@chava.dev' },
    ]);
    const { fields, files } = parseMultipart(`multipart/form-data; boundary=${BOUNDARY}`, raw);
    expect(fields.name).toBe('Ada');
    expect(fields).toMatchObject({ user: { email: 'ada@chava.dev' } });
    expect(files).toHaveLength(0);
  });

  it('parses file uploads with name/type/content', () => {
    const image = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
    const raw = multipartBody([
      {
        headers: ['Content-Disposition: form-data; name="avatar"; filename="me.png"', 'Content-Type: image/png'],
        body: image,
      },
    ]);
    const { files } = parseMultipart(`multipart/form-data; boundary=${BOUNDARY}`, raw);
    expect(files).toHaveLength(1);
    expect(files[0].name).toBe('avatar');
    expect(files[0].filename).toBe('me.png');
    expect(files[0].contentType).toBe('image/png');
    expect(files[0].content).toEqual(image);
  });
});

describe('request.file() (Laravel file()/hasFile()/allFiles())', () => {
  it('exposes uploaded files through the Request API', async () => {
    const raw = multipartBody([
      { headers: ['Content-Disposition: form-data; name="caption"'], body: 'Hello' },
      {
        headers: ['Content-Disposition: form-data; name="avatar"; filename="me.png"', 'Content-Type: image/png'],
        body: Buffer.from([1, 2, 3, 4]),
      },
    ]);
    const request = await requestFromBody(raw, `multipart/form-data; boundary=${BOUNDARY}`);

    expect(request.input('caption')).toBe('Hello');
    expect(request.hasFile('avatar')).toBe(true);
    expect(request.hasFile('missing')).toBe(false);
    const avatar = request.file('avatar');
    expect(avatar?.getClientOriginalName()).toBe('me.png');
    expect(avatar?.getClientMimeType()).toBe('image/png');
    expect(avatar?.getSize()).toBe(4);
    expect(request.allFiles()).toHaveProperty('avatar');
  });

  it('collects multiple files for the same field into an array', async () => {
    const raw = multipartBody([
      {
        headers: ['Content-Disposition: form-data; name="photos"; filename="a.jpg"', 'Content-Type: image/jpeg'],
        body: Buffer.from([1]),
      },
      {
        headers: ['Content-Disposition: form-data; name="photos"; filename="b.jpg"', 'Content-Type: image/jpeg'],
        body: Buffer.from([2]),
      },
    ]);
    const request = await requestFromBody(raw, `multipart/form-data; boundary=${BOUNDARY}`);
    expect(request.filesFor('photos')).toHaveLength(2);
    expect(request.file('photos')?.getClientOriginalName()).toBe('a.jpg');
  });

  it('leaves JSON bodies untouched (no multipart path)', async () => {
    const request = await requestFromBody(Buffer.from('{"name":"Ada"}'), 'application/json');
    expect(request.input('name')).toBe('Ada');
    expect(request.hasFile('name')).toBe(false);
    expect(request.allFiles()).toEqual({});
  });
});
