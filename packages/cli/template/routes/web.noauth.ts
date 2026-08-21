import { AboutController } from '../app/Http/Controllers/AboutController';
import { HomeController } from '../app/Http/Controllers/HomeController';
import { UserController } from '../app/Http/Controllers/UserController';
import { User } from '../app/Models/User';
import { Route } from '../src/facades';

// Like routes/web.php — wrapped in the `web` middleware group. This is the
// auth-free variant swapped in by `chava new --no-auth`.
Route.get('/', [HomeController, 'index']).name('home');
Route.get('/about', [AboutController, 'index']).name('about');

// Route model binding: {user} resolves to a User model, 404 when missing.
Route.model('user', User);

Route.get('/users', [UserController, 'index']).name('users.index');
Route.get('/users/{user}', [UserController, 'show']).name('users.show');