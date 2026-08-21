import { currentApp } from '../../../src/foundation/registry';
import { Event, Inertia } from '../../../src/facades';
import { Controller } from '../../../src/http/Controller';
import { Request } from '../../../src/http/Request';
import { Response } from '../../../src/http/Response';
import type { AuthManager } from '../../../src/auth/AuthManager';
import { Hash } from '../../../src/auth/Hash';
import { ValidationException } from '../../../src/support/exceptions';
import { User } from '../../Models/User';
import { UserRegistered } from '../../Events/UserRegistered';
import { LoginRequest } from '../Requests/LoginRequest';
import { RegisterRequest } from '../Requests/RegisterRequest';

/**
 * Session-based authentication — Laravel Breeze's AuthController, ported.
 */
export class AuthController extends Controller {
  /** GET /login */
  public async showLogin() {
    return Inertia.render('Auth/Login');
  }

  /** POST /login */
  public async login(request: Request) {
    const data = await request.validate(LoginRequest);
    const auth = currentApp().make<AuthManager>('auth');

    const ok = await auth.attempt({
      email: data.email,
      password: data.password,
    });
    if (!ok) {
      throw new ValidationException({
        email: ['These credentials do not match our records.'],
      });
    }
    return Response.redirect('/dashboard');
  }

  /** GET /register */
  public async showRegister() {
    return Inertia.render('Auth/Register');
  }

  /** POST /register */
  public async register(request: Request) {
    const data = await request.validate(RegisterRequest);
    const auth = currentApp().make<AuthManager>('auth');

    const user = await User.create({
      name: data.name,
      email: data.email,
      password: await Hash.make(String(data.password)),
    });
    await Event.dispatch(new UserRegistered(user as User));
    await auth.login(user);
    return Response.redirect('/dashboard');
  }

  /** POST /logout */
  public async logout(request: Request) {
    const auth = currentApp().make<AuthManager>('auth');
    await auth.logout();
    return Response.redirect('/');
  }
}
