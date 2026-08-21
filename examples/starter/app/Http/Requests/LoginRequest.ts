import { FormRequest } from '../../../src/validation/FormRequest';

export class LoginRequest extends FormRequest {
  public rules(): Record<string, string> {
    return {
      email: 'required|email|max:255',
      password: 'required|string',
    };
  }

  public messages(): Record<string, string> {
    return {
      'email.required': 'Please enter your email address.',
      'password.required': 'Please enter your password.',
    };
  }
}
