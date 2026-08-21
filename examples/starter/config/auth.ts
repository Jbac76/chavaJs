import { User } from '../app/Models/User';
import { PersonalAccessToken } from '../app/Models/PersonalAccessToken';

export default {
  // Default guard for Auth::check() / Auth::user().
  defaults: {
    guard: 'web',
  },

  // Guards: 'web' = session-backed, 'api' = Bearer token.
  guards: {
    web: {
      driver: 'session',
      provider: 'users',
    },
    api: {
      driver: 'token',
      provider: 'users',
      // Personal access token model + the relation pointing at the user.
      token_model: PersonalAccessToken,
      user_relation: 'user',
    },
  },

  // User providers: how users are retrieved (Eloquent by default).
  providers: {
    users: {
      driver: 'eloquent',
      model: User,
    },
  },

  password_timeout: 10800, // seconds a password stays valid in the session
};
