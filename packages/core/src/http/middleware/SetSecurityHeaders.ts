/**
 * Security headers middleware
 *
 * Sets recommended security headers to protect against common web vulnerabilities.
 *
 * Headers set:
 * - X-Content-Type-Options: Prevent MIME type sniffing
 * - X-Frame-Options: Prevent clickjacking
 * - X-XSS-Protection: Enable XSS filter (legacy browsers)
 * - Referrer-Policy: Control referrer information
 * - Permissions-Policy: Restrict browser features
 * - Strict-Transport-Security: Force HTTPS (production only)
 */

import type { Request } from '../Request';
import type { Response } from '../Response';
import type { NextFunction } from '../types';

export interface SecurityHeadersOptions {
  /**
   * Enable HSTS header (only works over HTTPS)
   * Default: true in production, false in development
   */
  hsts?: boolean;

  /**
   * HSTS max age in seconds
   * Default: 31536000 (1 year)
   */
  hstsMaxAge?: number;

  /**
   * Include subdomains in HSTS
   * Default: true
   */
  hstsIncludeSubdomains?: boolean;

  /**
   * Enable HSTS preload
   * Default: false
   */
  hstsPreload?: boolean;

  /**
   * X-Frame-Options value
   * Default: 'SAMEORIGIN'
   */
  frameOptions?: 'DENY' | 'SAMEORIGIN' | string;

  /**
   * Referrer-Policy value
   * Default: 'strict-origin-when-cross-origin'
   */
  referrerPolicy?: string;

  /**
   * Custom Content-Security-Policy
   * Default: none (should be configured per-app)
   */
  contentSecurityPolicy?: string;

  /**
   * Permissions-Policy directives
   * Default: restricts geolocation, microphone, camera
   */
  permissionsPolicy?: string;
}

export class SetSecurityHeaders {
  private options: Required<Omit<SecurityHeadersOptions, 'contentSecurityPolicy'>> & {
    contentSecurityPolicy?: string;
  };

  constructor(options: SecurityHeadersOptions = {}) {
    const isProduction = process.env.APP_ENV === 'production' || process.env.NODE_ENV === 'production';

    this.options = {
      hsts: options.hsts ?? isProduction,
      hstsMaxAge: options.hstsMaxAge ?? 31536000, // 1 year
      hstsIncludeSubdomains: options.hstsIncludeSubdomains ?? true,
      hstsPreload: options.hstsPreload ?? false,
      frameOptions: options.frameOptions ?? 'SAMEORIGIN',
      referrerPolicy: options.referrerPolicy ?? 'strict-origin-when-cross-origin',
      contentSecurityPolicy: options.contentSecurityPolicy,
      permissionsPolicy: options.permissionsPolicy ?? 'geolocation=(), microphone=(), camera=()',
    };
  }

  public async handle(request: Request, next: NextFunction): Promise<Response> {
    const response = await next();

    // X-Content-Type-Options: Prevent MIME type sniffing
    response.header('X-Content-Type-Options', 'nosniff');

    // X-Frame-Options: Prevent clickjacking
    response.header('X-Frame-Options', this.options.frameOptions);

    // X-XSS-Protection: Enable XSS filter in older browsers
    // Note: Modern browsers use CSP instead, but this helps legacy browsers
    response.header('X-XSS-Protection', '1; mode=block');

    // Referrer-Policy: Control referrer information leakage
    response.header('Referrer-Policy', this.options.referrerPolicy);

    // Permissions-Policy: Restrict access to browser features
    response.header('Permissions-Policy', this.options.permissionsPolicy);

    // Strict-Transport-Security: Force HTTPS connections
    if (this.options.hsts && this.isSecureConnection(request)) {
      let hstsValue = `max-age=${this.options.hstsMaxAge}`;

      if (this.options.hstsIncludeSubdomains) {
        hstsValue += '; includeSubDomains';
      }

      if (this.options.hstsPreload) {
        hstsValue += '; preload';
      }

      response.header('Strict-Transport-Security', hstsValue);
    }

    // Content-Security-Policy: Define allowed content sources
    if (this.options.contentSecurityPolicy) {
      response.header('Content-Security-Policy', this.options.contentSecurityPolicy);
    }

    return response;
  }

  /**
   * Check if the connection is secure (HTTPS)
   */
  private isSecureConnection(request: Request): boolean {
    // Check if request is over HTTPS
    if ((request as any).secure || (request as any).protocol === 'https') {
      return true;
    }

    // Check X-Forwarded-Proto header (when behind a proxy)
    const proto = request.header('x-forwarded-proto');
    if (proto === 'https') {
      return true;
    }

    return false;
  }
}
