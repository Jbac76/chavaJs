import { FormRequest } from '../../../src/validation/FormRequest';

export class RegisterRequest extends FormRequest {
  public rules(): Record<string, string> {
    return {
      name: 'required|string|max:255',
      email: 'required|email|max:255|unique:users,email',
      password: 'required|string|min:8|confirmed',
    };
  }

  public messages(): Record<string, string> {
    return {
      'email.unique': 'That email address is already registered.',
      'password.confirmed': 'The password confirmation does not match.',
    };
  }
}
