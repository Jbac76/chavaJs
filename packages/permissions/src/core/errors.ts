/**
 * Exceptions — same names and semantics as spatie/laravel-permission.
 */

export class PermissionDoesNotExistError extends Error {
  public constructor(name: string, guardName?: string) {
    super(
      guardName
        ? `There is no permission named \`${name}\` for guard \`${guardName}\`.`
        : `There is no permission named \`${name}\`.`,
    );
    this.name = 'PermissionDoesNotExistError';
  }
}

export class RoleDoesNotExistError extends Error {
  public constructor(name: string, guardName?: string) {
    super(
      guardName
        ? `There is no role named \`${name}\` for guard \`${guardName}\`.`
        : `There is no role named \`${name}\`.`,
    );
    this.name = 'RoleDoesNotExistError';
  }
}

export class GuardDoesNotMatchError extends Error {
  public constructor(expected: string, actual: string) {
    super(`The given role or permission should use guard \`${expected}\` instead of \`${actual}\`.`);
    this.name = 'GuardDoesNotMatchError';
  }
}

/** Thrown by authorize()/middleware when a check fails (Spatie: UnauthorizedException(403)). */
export class UnauthorizedError extends Error {
  public readonly status = 403;
  public constructor(message = 'User does not have the right permissions.') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}
