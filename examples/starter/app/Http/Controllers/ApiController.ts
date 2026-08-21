import { Controller } from '../../../src/http/Controller';
import { Request } from '../../../src/http/Request';
import { Response } from '../../../src/http/Response';
import type { User } from '../../Models/User';

/**
 * API token auth — the Sanctum-equivalent flow:
 *
 *   1. POST /api/tokens        (session-authenticated) → issues a Bearer token
 *   2. GET  /api/user          (auth:api, Bearer token) → returns the user
 */
export class ApiController extends Controller {
  /** POST /api/tokens — issue a personal access token for the logged-in user. */
  public async store(request: Request) {
    const data = await request.validate({
      name: 'required|string|max:255',
    });
    const user = (await request.user()) as User | null;
    if (!user) return Response.json({ message: 'Unauthenticated.' }, 401);

    const { plainTextToken, accessToken } = await user.createToken(String(data.name));
    return Response.json(
      {
        token: plainTextToken,
        id: accessToken.getKey(),
        name: String(data.name),
      },
      201,
    );
  }

  /** GET /api/user — the current user, guarded by `auth:api` (Bearer token). */
  public async user(request: Request) {
    const user = await request.user('api');
    if (!user) return Response.json({ message: 'Unauthenticated.' }, 401);
    return Response.json({ data: user.toArray() });
  }
}
