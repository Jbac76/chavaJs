# Requests

The `Request` object is the chavaJs equivalent of Laravel's `Illuminate\Http\Request`.
It is injected as the first argument of every controller method, invokable
controller, and route closure.

```ts
import type { Request } from '../../src/http/Request';

export class UserController {
  public index(request: Request) {
    const q = request.query('search', '');
    // ...
  }
}
```

## Retrieving input

```ts
request.input('name', 'default');      // body + query, with fallback
request.query('page', 1);              // query string only
request.all();                          // every input value
request.only(['email', 'password']);   // just these keys
request.except(['password']);          // everything but these
request.has('name');                   // boolean
request.filled('name');                // present and non-empty
request.json();                         // parsed JSON body (or {})
```

For method spoofing, a `_method` field (or header) switches `request.method()`:

```ts
request.method();         // 'GET' | 'POST' | ...
request.isMethod('POST'); // boolean
```

## Query, headers, cookies

```ts
request.header('Accept', 'text/html');   // header, with fallback
request.bearerToken();                   // the Authorization: Bearer token
request.cookie('session');               // cookie value
request.path();                          // '/users/5' (no query string)
request.fullUrl();                       // full URL including query
request.is('/users/*');                  // path wildcard match
request.wantsJson();                     // Accept: application/json
request.expectsJson();
request.isInertia();                     // X-Inertia: true
```

## Files

Uploaded files are available on multipart requests:

```ts
request.hasFile('avatar');                     // boolean
request.file('avatar');                        // UploadedFile | undefined
request.filesFor('photos');                    // UploadedFile[]
request.allFiles();

const file = request.file('avatar');
file.getClientOriginalName();   // 'me.png'
file.getClientMimeType();       // 'image/png'
file.getSize();                 // bytes
file.store('public/avatars');   // save to storage/app/..., returns relative path
```

## Validation & Form Requests

Validate inline or with a Form Request class — both throw on failure (a 419/422
style `ValidationException` that the framework turns into a redirect back with
errors):

```ts
const data = await request.validate({
  email: 'required|email|unique:users,email',
  password: 'required|min:8|confirmed',
});
```

```ts
import { FormRequest } from '../../src/validation/FormRequest';

export class CreatePostRequest extends FormRequest {
  public authorize(): boolean {
    return this.request.user() !== null;
  }

  public rules(): Record<string, string> {
    return {
      title: 'required|string|max:255',
      body: 'required|string',
    };
  }
}

// In the controller:
const data = await request.validate(CreatePostRequest);
```

See [Validation](07-validation) for the full rule reference.

## The authenticated user

```ts
const user = await request.user();     // Model | null
const id = await request.userId();     // the user's key, or null
```

## The session

The `StartSession` middleware attaches the session store:

```ts
request.session()?.get('cart');        // value | undefined
request.session()?.flash('status', 'Saved!');
request.old('name');                    // old input from flash
request.back();                         // redirect to the previous URL
```

See [Sessions & CSRF](14-sessions).

## Creating requests in tests

```ts
import { Request } from '../../src/http/Request';

const req = Request.create('GET', '/users?page=2', { Accept: 'application/json' }, {});
```

## Next

- [Validation](07-validation) — the rule reference
- [Middleware](08-middleware) — inspecting requests before they reach your code