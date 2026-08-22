import { AboutController } from '../app/Http/Controllers/AboutController';
import { HomeController } from '../app/Http/Controllers/HomeController';
import { Route } from '../src/facades';

// Like routes/web.php — wrapped in the `web` middleware group. This is the
// auth-free variant swapped in by `chava new --no-auth`. No database-backed
// routes here: tables are not migrated in auth-free scaffolds.
Route.get('/', [HomeController, 'index']).name('home');
Route.get('/about', [AboutController, 'index']).name('about');