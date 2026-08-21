import { describe, expect, it } from 'vitest';
import { Application } from '../../src/foundation/Application';
import { Router } from '../../src/http/Router';
import { Response } from '../../src/http/Response';

class DummyController {
  public index() {
    return Response.json({ ok: true });
  }
  public show() {
    return Response.json({ ok: true });
  }
}

function makeRouter(): Router {
  const app = new Application({ basePath: process.cwd() });
  return new Router(app);
}

describe('Router', () => {
  it('registers and matches a GET route with named params', () => {
    const router = makeRouter();
    router.get('/users/{id}', [DummyController, 'show']);

    const match = router.findRoute('GET', '/users/42');
    expect(match).not.toBeNull();
    if (match === null || 'notAllowed' in match) throw new Error('expected match');
    expect(match.route.action).toEqual([DummyController, 'show']);
    expect(match.params).toEqual({ id: '42' });
  });

  it('does not match the wrong method and reports allowed methods', () => {
    const router = makeRouter();
    router.get('/users', [DummyController, 'index']);

    const match = router.findRoute('POST', '/users');
    expect(match).not.toBeNull();
    if (match === null || !('notAllowed' in match)) throw new Error('expected 405');
    expect(match.allowedMethods).toContain('GET');
  });

  it('returns null when nothing matches', () => {
    const router = makeRouter();
    router.get('/users', [DummyController, 'index']);
    expect(router.findRoute('GET', '/nope')).toBeNull();
  });

  it('names routes and supports lookup by name', () => {
    const router = makeRouter();
    router.get('/users', [DummyController, 'index']).name('users.index');
    expect(router.has('users.index')).toBe(true);
    expect(router.route('users.index')?.getName()).toBe('users.index');
  });

  it('applies group prefixes and middleware', () => {
    const router = makeRouter();
    router.group({ prefix: 'admin', middleware: ['auth'] }, () => {
      router.get('/dashboard', [DummyController, 'index']);
    });
    const route = router.getRoutes()[0];
    expect(route.uri).toBe('/admin/dashboard');
    expect(route.getMiddleware()).toEqual(['auth']);
  });

  it('does not leak registrar state across fluent chains', () => {
    const router = makeRouter();
    router.middleware('auth').get('/one', [DummyController, 'index']);
    router.get('/two', [DummyController, 'index']);

    expect(router.getRoutes()[0].getMiddleware()).toEqual(['auth']);
    expect(router.getRoutes()[1].getMiddleware()).toEqual([]);
  });

  it('registers the seven resource routes with names', () => {
    const router = makeRouter();
    router.resource('users', DummyController);

    const routes = router.getRoutes();
    expect(routes).toHaveLength(7);
    expect(routes.map((route) => route.getName())).toEqual([
      'users.index',
      'users.create',
      'users.store',
      'users.show',
      'users.edit',
      'users.update',
      'users.destroy',
    ]);
    expect(routes[3].uri).toBe('/users/{user}');
  });

  it('supports optional route parameters', () => {
    const router = makeRouter();
    router.get('/posts/{slug?}', [DummyController, 'index']);

    const withSlug = router.findRoute('GET', '/posts/hello-world');
    const withoutSlug = router.findRoute('GET', '/posts');
    if (withSlug === null || 'notAllowed' in withSlug) throw new Error('expected match');
    if (withoutSlug === null || 'notAllowed' in withoutSlug) throw new Error('expected match');
    expect(withSlug.params).toEqual({ slug: 'hello-world' });
    expect(withoutSlug.params).toEqual({ slug: undefined });
  });

  it('enforces where() parameter constraints', () => {
    const router = makeRouter();
    router.get('/users/{id}', [DummyController, 'show']).where({ id: '[0-9]+' });

    expect(router.findRoute('GET', '/users/42')).not.toBeNull();
    expect(router.findRoute('GET', '/users/abc')).toBeNull();
  });
});
