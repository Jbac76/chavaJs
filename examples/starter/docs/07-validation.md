# Validation

Validation uses Laravel's exact rule-string syntax. Rules are pipe-delimited,
parameters follow a colon, and multiple values are comma-separated.

```ts
const data = await request.validate({
  name: 'required|string|max:255',
  email: 'required|email|unique:users,email',
  age: 'nullable|integer|min:18',
  role: 'in:admin,user',
});
```

A failed validation throws, and the framework responds with a redirect back,
flashing the input and errors (Inertia requests receive the errors as props).

## Available rules

| Rule | Notes |
| --- | --- |
| `required` | present and non-empty |
| `nullable` | skip other rules when the value is null/empty |
| `required_if:other,value` | required when another field equals a value |
| `string` / `numeric` / `integer` / `boolean` / `array` / `json` / `ip` / `uuid` | type checks |
| `email` / `url` / `date` | format checks |
| `alpha` / `alpha_num` / `alpha_dash` | character sets |
| `min:n` / `max:n` | length (strings/arrays) or value (numbers) |
| `between:n,m` / `size:n` | range / exact length |
| `digits:n` / `digits_between:n,m` | numeric string length |
| `in:a,b,c` / `not_in:a,b,c` | whitelist / blacklist |
| `same:field` / `different:field` / `confirmed` | cross-field checks |
| `exists:table,column` | value exists in a table |
| `unique:table,column` | value is unique in a table |
| `regex:pattern` | custom regular expression |

Multiple values use `*` syntax on arrays — `request.validate({ tags: 'array' })`
then per-item rules such as `tags.*:string` if you need them.

## Custom rules

Pass a function (async supported) as a rule value:

```ts
const data = await request.validate({
  slug: ['required', async (value) => (await isTaken(value)) ? 'That slug is already taken.' : true],
});
```

Return `true` to pass, a string message to fail. Rule strings can also be mixed
with custom functions in the same array.

## Custom messages

```ts
await request.validate(
  { email: 'required|email' },
  { 'email.required': 'Please enter an email address.' },
);
```

## Form Requests

Encapsulate validation (and authorization) in a class for reuse across
controllers — generated with `js make:request StoreUserRequest`:

```ts
import { FormRequest } from '../../src/validation/FormRequest';

export class UpdateUserRequest extends FormRequest {
  public authorize(): boolean {
    return (await this.request.user())?.id === Number(this.request.input('user'));
  }

  public rules(): Record<string, string> {
    return {
      name: 'required|string|max:255',
      email: `required|email|unique:users,email,${this.request.input('user')}`,
    };
  }
}
```

`authorize()` returning `false` throws an `AuthorizationException` (403).

## Next

- [Requests](06-requests) — the full `Request` API
- [Middleware](08-middleware) — running checks before controllers