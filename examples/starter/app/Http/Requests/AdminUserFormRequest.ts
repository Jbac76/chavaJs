import { FormRequest } from '../../../src/validation/FormRequest';
import { currentRouteParams } from '../../../src/foundation/request-context';
import type { User } from '../../Models/User';

/**
 * Laravel Form Request for creating/updating admin users.
 *
 * chavaJs resolves this class through the container when a controller calls
 * `request.validate(AdminUserFormRequest)` — rules(), authorize() and
 * validated() behave exactly like Laravel's.
 */
export class AdminUserFormRequest extends FormRequest {
  public authorize(): boolean {
    return true; // authorization handled by permission middleware + UserPolicy
  }

  public rules(): Record<string, string> {
    // On update/edit, route-model binding gives us the target user — the
    // unique rule then ignores that record's own email (Laravel parity).
    const target = currentRouteParams()['user'] as User | undefined;
    const editing = target !== undefined && typeof target.getKey === 'function';
    const ignoreSelf = editing ? `,${target!.getKey()}` : '';

    const rules: Record<string, string> = {
      name: 'required|min:2|max:100',
      email: `required|email|unique:users,email${ignoreSelf}`,
      roles: 'array',
    };

    // Creating requires a password; updating leaves it optional
    // ("leave blank to keep the current one").
    rules.password = editing
      ? 'sometimes|nullable|min:8'
      : 'required|min:8|confirmed';

    return rules;
  }

  public messages(): Record<string, string> {
    return {
      'password.confirmed': 'The password confirmation does not match.',
      'email.unique': 'That email address is already registered.',
    };
  }
}
