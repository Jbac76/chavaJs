import { describe, expect, it } from 'vitest';
import { Request } from '../../src/http/Request';

describe('Request', () => {
  it('parses query string parameters', () => {
    const request = Request.create('GET', '/search?q=chava&page=2');
    expect(request.input('q')).toBe('chava');
    expect(request.input('page')).toBe('2');
  });

  it('merges query and body with body taking precedence', () => {
    const request = Request.create('POST', '/users?ref=newsletter', { 'content-type': 'application/json' }, { name: 'Taylor', ref: 'footer' });
    expect(request.input('name')).toBe('Taylor');
    expect(request.input('ref')).toBe('footer');
  });

  it('supports only() and except()', () => {
    const request = Request.create('POST', '/users', {}, { name: 'Taylor', email: 'taylor@example.com', admin: true });
    expect(request.only('name', 'email')).toEqual({ name: 'Taylor', email: 'taylor@example.com' });
    expect(request.except('admin')).toEqual({ name: 'Taylor', email: 'taylor@example.com' });
  });

  it('reads dot-notated nested input', () => {
    const request = Request.create('POST', '/users', {}, { user: { name: 'Taylor' } });
    expect(request.input('user.name')).toBe('Taylor');
  });

  it('reports expectsJson() for JSON/AJAX but not Inertia (Laravel semantics)', () => {
    // Accept: application/json → JSON response expected.
    const json = Request.create('GET', '/', { accept: 'application/json' });
    expect(json.expectsJson()).toBe(true);

    // Inertia requests Accept text/html — Laravel does NOT treat them as JSON.
    const inertia = Request.create('GET', '/', { 'x-inertia': 'true' });
    expect(inertia.isInertia()).toBe(true);
    expect(inertia.expectsJson()).toBe(false);

    // Classic AJAX (X-Requested-With) with no Accept override → JSON.
    const ajax = Request.create('GET', '/', { 'x-requested-with': 'XMLHttpRequest' });
    expect(ajax.expectsJson()).toBe(true);

    const browser = Request.create('GET', '/');
    expect(browser.expectsJson()).toBe(false);
  });

  it('parses cookies', () => {
    const request = Request.create('GET', '/', { cookie: 'theme=dark; session=abc123' });
    expect(request.cookie('theme')).toBe('dark');
    expect(request.cookie('session')).toBe('abc123');
  });

  it('supports _method form spoofing', () => {
    const request = Request.create('POST', '/users/1', {}, { _method: 'PATCH' });
    expect(request.method()).toBe('PATCH');
  });

  it('provides path, fullUrl, header, and bearer token helpers', () => {
    const request = Request.create('GET', '/api/v1/users?x=1', { authorization: 'Bearer token123' });
    expect(request.path()).toBe('/api/v1/users');
    expect(request.fullUrl()).toBe('/api/v1/users?x=1');
    expect(request.header('authorization')).toBe('Bearer token123');
    expect(request.bearerToken()).toBe('token123');
  });
});
