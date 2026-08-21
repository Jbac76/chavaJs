import { Inertia } from '../../../src/facades';
import { Controller } from '../../../src/http/Controller';
import { Request } from '../../../src/http/Request';

export class HomeController extends Controller {
  public index(request: Request) {
    const features = [
      { name: 'Service Container', description: 'Automatic constructor injection with Laravel’s bind/singleton/make semantics.', icon: 'package' },
      { name: 'Config & Env', description: 'config/*.ts files plus .env loading, with dot-notation access.', icon: 'settings' },
      { name: 'Routing', description: 'Route.get/post/resource/group, named routes, route params, 404/405 handling.', icon: 'route' },
      { name: 'Middleware Pipeline', description: 'Global, group and route middleware with Laravel’s handle(request, next).', icon: 'shield' },
      { name: 'Eloquent ORM', description: 'Active Record models, migrations, factories, relationships and eager loading — Laravel’s database layer, ported.', icon: 'database' },
      { name: 'Inertia Adapter', description: 'Controllers return Inertia.render() — no REST API layer needed.', icon: 'zap' },
      { name: 'Facades', description: 'Proxy-based static accessors: Route, Inertia, Config, App, DB, Schema.', icon: 'sparkles' },
    ];

    return Inertia.render('Home', {
      title: 'Welcome',
      welcome: {
        framework: 'chavaJs',
        tagline: 'The Laravel framework for Node.js',
        description:
          'A full-stack framework with a Laravel-style container, router, middleware and ORM on the backend — and React, Inertia, Tailwind CSS, shadcn/ui and Motion on the front.',
        features,
      },
      visitors: request.ip ?? 'unknown',
    });
  }
}
