import type { Request } from '../http/Request';
import { AuthorizationException, ValidationException } from '../support/exceptions';
import { Validator } from './Validator';

/**
 * Laravel's Form Request, ported. TypeScript erases method-signature types at
 * runtime, so instead of container injection chavaJs resolves form requests
 * explicitly:
 *
 *   const data = await request.validate(CreatePostRequest);
 *
 * The class still carries everything Laravel's does — rules(), authorize(),
 * messages(), attributes() — and throws the same ValidationException /
 * AuthorizationException on failure.
 */
export abstract class FormRequest {
  protected request!: Request;

  public withRequest(request: Request): this {
    this.request = request;
    return this;
  }

  /** Laravel: authorize(). Return false to throw a 403. */
  public authorize(): boolean {
    return true;
  }

  /** Laravel: rules() — `{ 'email': 'required|email|max:255' }`. */
  public abstract rules(): Record<string, string>;

  /** Laravel: messages() — custom per-field messages. */
  public messages(): Record<string, string> {
    return {};
  }

  /** Laravel: attributes() — human-readable attribute names. */
  public attributes(): Record<string, string> {
    return {};
  }

  /** Validate and return the validated data (throws on failure). */
  public async validated(): Promise<Record<string, unknown>> {
    if (!this.authorize()) {
      throw new AuthorizationException('This action is unauthorized.');
    }
    const validator = Validator.make(
      this.request.all(),
      this.rules(),
      this.messages(),
      this.attributes(),
    );
    if (await validator.fails()) {
      throw new ValidationException(validator.errors());
    }
    return validator.validated();
  }
}
