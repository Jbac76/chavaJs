import { ApiController } from '../app/Http/Controllers/ApiController';
import { Route } from '../src/facades';

// Like routes/api.php — wrapped in the `api` middleware group.
Route.get('/health', () => ({
  status: 'ok',
  framework: 'chavaJs',
  timestamp: new Date().toISOString(),
})).name('api.health');

// Bearer-token protected (auth:api → TokenGuard).
Route.get('/user', [ApiController, 'user']).middleware('auth:api').name('api.user');

// Token issuance is session-authenticated (Sanctum flow) — registered in
// routes/web.ts so the StartSession middleware is available.
