import { AboutController } from '../app/Http/Controllers/AboutController';
import { HomeController } from '../app/Http/Controllers/HomeController';
import { Route } from '../src/facades';
import { HealthCheckController } from '../src/http/controllers/HealthCheckController';

// Like routes/web.php — wrapped in the `web` middleware group. This is the
// auth-free variant swapped in by `chava new --no-auth`. No database-backed
// routes here: tables are not migrated in auth-free scaffolds.
Route.get('/', [HomeController, 'index']).name('home');
Route.get('/about', [AboutController, 'index']).name('about');

// Laravel 11 style health endpoint.
Route.get('/up', [HealthCheckController, 'up']).name('health');