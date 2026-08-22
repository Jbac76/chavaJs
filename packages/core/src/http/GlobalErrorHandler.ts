/**
 * Global error handler for HTTP requests
 *
 * Catches and formats errors consistently, with appropriate logging
 * and user-friendly error messages.
 */

import type { Request } from '../Request';
import { Response } from '../Response';
import { Logger } from '../../support/Logger';

export interface ErrorContext {
  url: string;
  method: string;
  userId?: unknown;
  ip?: string;
  userAgent?: string;
}

export class GlobalErrorHandler {
  /**
   * Handle an error and return appropriate response
   */
  public handle(error: Error | unknown, request: Request): Response {
    const context = this.buildContext(request);

    // Log the error with context
    Logger.error('Request failed', error instanceof Error ? error : undefined, context);

    // Determine response based on error type and environment
    if (this.isValidationError(error)) {
      return this.handleValidationError(error, request);
    }

    if (this.isAuthenticationError(error)) {
      return this.handleAuthenticationError(error, request);
    }

    if (this.isAuthorizationError(error)) {
      return this.handleAuthorizationError(error, request);
    }

    if (this.isNotFoundError(error)) {
      return this.handleNotFoundError(error, request);
    }

    // Default error handling
    return this.handleGenericError(error, request);
  }

  /**
   * Build error context from request
   */
  private buildContext(request: Request): ErrorContext {
    const context: ErrorContext = {
      url: request.fullUrl(),
      method: request.method(),
    };

    // Add user ID if authenticated
    try {
      const user = (request as any)._user;
      if (user) {
        context.userId = (user as any).id || (user as any).getKey?.();
      }
    } catch {
      // Ignore if user not available
    }

    // Add IP address
    context.ip = this.getClientIp(request);

    // Add user agent
    const userAgent = request.header('user-agent');
    if (userAgent) {
      context.userAgent = userAgent;
    }

    return context;
  }

  /**
   * Get client IP address
   */
  private getClientIp(request: Request): string {
    const forwarded = request.header('x-forwarded-for');
    if (forwarded) {
      return forwarded.split(',')[0]?.trim() || 'unknown';
    }

    const realIp = request.header('x-real-ip');
    if (realIp) {
      return realIp;
    }

    return (request as any).socket?.remoteAddress || 'unknown';
  }

  /**
   * Check if error is a validation error
   */
  private isValidationError(error: unknown): boolean {
    return (error as any)?.name === 'ValidationException' || (error as any)?.isValidation === true;
  }

  /**
   * Check if error is an authentication error
   */
  private isAuthenticationError(error: unknown): boolean {
    return (
      (error as any)?.name === 'AuthenticationException' ||
      (error as any)?.status === 401 ||
      (error as any)?.statusCode === 401
    );
  }

  /**
   * Check if error is an authorization error
   */
  private isAuthorizationError(error: unknown): boolean {
    return (
      (error as any)?.name === 'AuthorizationException' ||
      (error as any)?.status === 403 ||
      (error as any)?.statusCode === 403
    );
  }

  /**
   * Check if error is a not found error
   */
  private isNotFoundError(error: unknown): boolean {
    return (
      (error as any)?.name === 'NotFoundException' ||
      (error as any)?.status === 404 ||
      (error as any)?.statusCode === 404
    );
  }

  /**
   * Handle validation errors
   */
  private handleValidationError(error: unknown, request: Request): Response {
    const errors = (error as any).errors || {};
    const message = (error as any).message || 'The given data was invalid.';

    if (request.expectsJson()) {
      return Response.json(
        {
          message,
          errors,
        },
        422
      );
    }

    // For non-JSON requests, redirect back with errors
    return (request as any).back().withErrors(errors);
  }

  /**
   * Handle authentication errors
   */
  private handleAuthenticationError(error: unknown, request: Request): Response {
    const message = (error as any).message || 'Unauthenticated.';

    if (request.expectsJson()) {
      return Response.json({ message }, 401);
    }

    // Redirect to login
    return Response.redirect('/login');
  }

  /**
   * Handle authorization errors
   */
  private handleAuthorizationError(error: unknown, request: Request): Response {
    const message = (error as any).message || 'This action is unauthorized.';

    if (request.expectsJson()) {
      return Response.json({ message }, 403);
    }

    // For non-JSON, show 403 page or redirect
    return Response.json({ message }, 403);
  }

  /**
   * Handle not found errors
   */
  private handleNotFoundError(error: unknown, request: Request): Response {
    const message = (error as any).message || 'Not Found.';

    if (request.expectsJson()) {
      return Response.json({ message }, 404);
    }

    // For non-JSON, could render 404 page
    return Response.json({ message }, 404);
  }

  /**
   * Handle generic errors
   */
  private handleGenericError(error: unknown, request: Request): Response {
    const isProduction =
      process.env.APP_ENV === 'production' || process.env.NODE_ENV === 'production';
    const debug = process.env.APP_DEBUG === 'true';

    // In production with debug off, return generic error
    if (isProduction && !debug) {
      const message = 'An unexpected error occurred. Please try again later.';

      return Response.json(
        {
          message,
          error: 'Internal Server Error',
        },
        500
      );
    }

    // In development or with debug on, return detailed error
    const errorDetails: any = {
      message: error instanceof Error ? error.message : 'An unexpected error occurred.',
      error: 'Internal Server Error',
    };

    if (error instanceof Error) {
      errorDetails.stack = error.stack?.split('\n').map(line => line.trim());
      errorDetails.name = error.name;
    }

    return Response.json(errorDetails, 500);
  }

  /**
   * Report error to external logging service
   * Override this method to integrate with error tracking services like Sentry
   */
  public report(error: Error | unknown, context: ErrorContext): void {
    // Default: already logged via Logger.error in handle()
    // Override to send to Sentry, Rollbar, etc.

    // Example Sentry integration:
    // if (typeof Sentry !== 'undefined') {
    //   Sentry.captureException(error, {
    //     contexts: {
    //       request: context,
    //     },
    //   });
    // }
  }
}

// Export singleton instance
export const errorHandler = new GlobalErrorHandler();
