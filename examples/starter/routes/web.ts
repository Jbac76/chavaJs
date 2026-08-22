import { AboutController } from '../app/Http/Controllers/AboutController';
import { ApiController } from '../app/Http/Controllers/ApiController';
import { AuthController } from '../app/Http/Controllers/AuthController';
import { DashboardController } from '../app/Http/Controllers/DashboardController';
import { HomeController } from '../app/Http/Controllers/HomeController';
import { NotificationController } from '../app/Http/Controllers/NotificationController';
import { UserController } from '../app/Http/Controllers/UserController';
import { User } from '../app/Models/User';
import { DatabaseNotification } from '../src/notifications/Notifiable';
import { Route } from '../src/facades';
import { HealthCheckController } from '../src/http/controllers/HealthCheckController';

// Like routes/web.php — everything here is wrapped in the `web` middleware group.

// Laravel 11 style health endpoint (no auth required).
Route.get('/up', [HealthCheckController, 'up']).name('health');
Route.get('/', [HomeController, 'index']).name('home');
Route.get('/about', [AboutController, 'index']).name('about');

// Route model binding: {user} resolves to a User model, 404 when missing.
Route.model('user', User);

Route.get('/users', [UserController, 'index']).name('users.index');
Route.get('/users/{user}', [UserController, 'show']).name('users.show');
Route.delete('/users/{user}', [UserController, 'destroy']).middleware('auth', 'can:delete,user').name('users.destroy');

// ---- Authentication (Laravel Breeze equivalent) ----
Route.get('/login', [AuthController, 'showLogin']).middleware('guest').name('login');
Route.post('/login', [AuthController, 'login']).middleware('guest');
Route.get('/register', [AuthController, 'showRegister']).middleware('guest').name('register');
Route.post('/register', [AuthController, 'register']).middleware('guest');
Route.post('/logout', [AuthController, 'logout']).middleware('auth').name('logout');

Route.get('/dashboard', [DashboardController, 'index']).middleware('auth').name('dashboard');

// ---- Notification inbox (database channel) ----
Route.model('notification', DatabaseNotification);
Route.get('/notifications', [NotificationController, 'index']).middleware('auth').name('notifications.index');
Route.post('/notifications/read-all', [NotificationController, 'markAllRead']).middleware('auth').name('notifications.read-all');
Route.post('/notifications/{notification}/read', [NotificationController, 'markRead']).middleware('auth').name('notifications.read');

// Token issuance is session-authenticated (Sanctum flow), so it lives on the
// web middleware group even though the URL is an API endpoint.
Route.post('/api/tokens', [ApiController, 'store']).middleware('auth').name('api.tokens.store');
