/**
 * chavaJs exception hierarchy — mirrors Illuminate's core exceptions.
 */
export class RuntimeException extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'RuntimeException';
  }
}

export class BindingResolutionException extends RuntimeException {
  public constructor(message: string) {
    super(message);
    this.name = 'BindingResolutionException';
  }
}

export class NotFoundException extends RuntimeException {
  public constructor(message = 'Not Found') {
    super(message);
    this.name = 'NotFoundException';
  }
}

export class MethodNotAllowedException extends RuntimeException {
  public constructor(message = 'Method Not Allowed') {
    super(message);
    this.name = 'MethodNotAllowedException';
  }
}

export class ValidationException extends RuntimeException {
  public readonly errors: Record<string, string[]>;
  /** The original submitted input, attached by the kernel before responding. */
  public input?: Record<string, unknown>;

  public constructor(errors: Record<string, string[]>, message = 'The given data was invalid.') {
    super(message);
    this.name = 'ValidationException';
    this.errors = errors;
  }
}

export class AuthorizationException extends RuntimeException {
  public constructor(message = 'This action is unauthorized.') {
    super(message);
    this.name = 'AuthorizationException';
  }
}
