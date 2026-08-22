/**
 * Health Check Controller
 *
 * Provides endpoints for monitoring application health and readiness.
 * Useful for load balancers, orchestrators (Kubernetes), and monitoring systems.
 */

import type { Request } from '../Request';
import { Response } from '../Response';
import { currentApp } from '../../foundation/registry';

export class HealthCheckController {
  /**
   * Basic health check - returns 200 if the application is running
   *
   * Use this for liveness probes in Kubernetes
   * GET /health
   */
  public async index(_request: Request): Promise<Response> {
    return Response.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      pid: process.pid,
      memory: this.getMemoryInfo(),
    });
  }

  /**
   * Detailed health check - includes database connectivity
   *
   * Use this for readiness probes in Kubernetes
   * GET /health/ready
   */
  public async ready(_request: Request): Promise<Response> {
    const checks: Record<string, { status: string; message?: string; latency?: number }> = {};
    let overallStatus = 'ok';

    // Check database connectivity
    try {
      const db = currentApp().make('db');
      const start = Date.now();

      // Simple query to test database connection
      await db.connection().query('SELECT 1 as ping');

      const latency = Date.now() - start;
      checks.database = {
        status: 'ok',
        latency,
      };
    } catch (error) {
      overallStatus = 'error';
      checks.database = {
        status: 'error',
        message: error instanceof Error ? error.message : 'Database connection failed',
      };
    }

    // Check cache/redis connectivity (if configured)
    try {
      const queueConnection = process.env.QUEUE_CONNECTION || 'sync';
      if (queueConnection === 'redis') {
        // You can add redis health check here if needed
        checks.redis = {
          status: 'skipped',
          message: 'Redis health check not implemented',
        };
      }
    } catch (error) {
      // Redis is optional, don't fail health check
      checks.redis = {
        status: 'warning',
        message: 'Redis check failed but not critical',
      };
    }

    const statusCode = overallStatus === 'ok' ? 200 : 503;

    return Response.json(
      {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        checks,
      },
      statusCode
    );
  }

  /**
   * Application info endpoint
   *
   * Returns application configuration and environment info
   * GET /health/info
   */
  public async info(_request: Request): Promise<Response> {
    const app = currentApp();
    const config = app.make('config');

    return Response.json({
      app: {
        name: config.get('app.name'),
        env: config.get('app.env'),
        debug: config.get('app.debug'),
        url: config.get('app.url'),
      },
      node: {
        version: process.version,
        platform: process.platform,
        arch: process.arch,
      },
      system: {
        uptime: process.uptime(),
        memory: this.getMemoryInfo(),
        cpuUsage: process.cpuUsage(),
      },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get memory usage information
   */
  private getMemoryInfo(): Record<string, string> {
    const usage = process.memoryUsage();

    return {
      rss: this.formatBytes(usage.rss),
      heapTotal: this.formatBytes(usage.heapTotal),
      heapUsed: this.formatBytes(usage.heapUsed),
      external: this.formatBytes(usage.external),
    };
  }

  /**
   * Format bytes to human-readable format
   */
  private formatBytes(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';

    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const value = bytes / Math.pow(1024, i);

    return `${value.toFixed(2)} ${sizes[i]}`;
  }
}
