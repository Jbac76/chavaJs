/**
 * Rate limiting middleware
 *
 * Limits the number of requests a client can make within a time window.
 * Uses in-memory storage (suitable for single-instance deployments).
 *
 * For multi-instance deployments, consider using Redis-backed rate limiting.
 */

import type { Request } from '../Request';
import type { Response } from '../Response';
import type { NextFunction } from '../types';
import { Response as ResponseClass } from '../Response';

interface RateLimitEntry {
  attempts: number[];
  resetAt: number;
}

export class ThrottleRequests {
  private static storage = new Map<string, RateLimitEntry>();
  private static cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start cleanup task to prevent memory leaks
    if (!ThrottleRequests.cleanupInterval) {
      ThrottleRequests.cleanupInterval = setInterval(() => {
        this.cleanup();
      }, 60000); // Cleanup every minute
    }
  }

  /**
   * Handle the incoming request
   *
   * @param request - The incoming HTTP request
   * @param next - The next middleware function
   * @param maxAttempts - Maximum number of requests allowed (default: 60)
   * @param decayMinutes - Time window in minutes (default: 1)
   */
  public async handle(
    request: Request,
    next: NextFunction,
    maxAttempts: number = 60,
    decayMinutes: number = 1
  ): Promise<Response> {
    const key = this.resolveRequestSignature(request);
    const now = Date.now();
    const decayMilliseconds = decayMinutes * 60 * 1000;

    // Get or create rate limit entry
    let entry = ThrottleRequests.storage.get(key);

    if (!entry || now >= entry.resetAt) {
      // Create new window
      entry = {
        attempts: [],
        resetAt: now + decayMilliseconds,
      };
      ThrottleRequests.storage.set(key, entry);
    }

    // Filter out old attempts outside the window
    const windowStart = now - decayMilliseconds;
    entry.attempts = entry.attempts.filter(timestamp => timestamp > windowStart);

    // Check if limit exceeded
    if (entry.attempts.length >= maxAttempts) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);

      return ResponseClass.json(
        {
          message: 'Too Many Requests',
          error: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
        },
        429
      )
        .header('Retry-After', String(retryAfter))
        .header('X-RateLimit-Limit', String(maxAttempts))
        .header('X-RateLimit-Remaining', '0')
        .header('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));
    }

    // Record this attempt
    entry.attempts.push(now);

    const response = await next();

    // Add rate limit headers
    const remaining = Math.max(0, maxAttempts - entry.attempts.length);
    response
      .header('X-RateLimit-Limit', String(maxAttempts))
      .header('X-RateLimit-Remaining', String(remaining))
      .header('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    return response;
  }

  /**
   * Generate a unique key for the request
   */
  private resolveRequestSignature(request: Request): string {
    // Use IP address + user ID (if authenticated) as the key
    const ip = this.getClientIp(request);
    const userId = request.user ? String((request.user as any).id || '') : '';

    return `${ip}:${userId}`;
  }

  /**
   * Extract client IP address from request
   */
  private getClientIp(request: Request): string {
    // Check X-Forwarded-For header (when behind proxy)
    const forwarded = request.header('x-forwarded-for');
    if (forwarded) {
      const ips = forwarded.split(',').map(ip => ip.trim());
      return ips[0] || 'unknown';
    }

    // Check X-Real-IP header
    const realIp = request.header('x-real-ip');
    if (realIp) {
      return realIp;
    }

    // Fall back to remote address
    return (request as any).socket?.remoteAddress || 'unknown';
  }

  /**
   * Clean up expired entries to prevent memory leaks
   */
  private cleanup(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [key, entry] of ThrottleRequests.storage.entries()) {
      if (now >= entry.resetAt && entry.attempts.length === 0) {
        toDelete.push(key);
      }
    }

    for (const key of toDelete) {
      ThrottleRequests.storage.delete(key);
    }
  }

  /**
   * Clear all rate limit data (useful for testing)
   */
  public static clear(): void {
    ThrottleRequests.storage.clear();
  }

  /**
   * Stop the cleanup interval (useful for testing and graceful shutdown)
   */
  public static stopCleanup(): void {
    if (ThrottleRequests.cleanupInterval) {
      clearInterval(ThrottleRequests.cleanupInterval);
      ThrottleRequests.cleanupInterval = null;
    }
  }
}
