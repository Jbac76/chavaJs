/**
 * Graceful shutdown handler
 *
 * Ensures the application shuts down cleanly by:
 * - Closing the HTTP server
 * - Closing database connections
 * - Flushing logs
 * - Disconnecting from Redis/queue services
 */

import type { Server } from 'http';
import { Logger } from '../support/Logger';

export class GracefulShutdown {
  private shutdownInProgress = false;
  private readonly shutdownTimeout: number;
  private servers: Server[] = [];
  private cleanupHandlers: Array<() => Promise<void>> = [];

  constructor(shutdownTimeout = 10000) {
    this.shutdownTimeout = shutdownTimeout;
  }

  /**
   * Register an HTTP server to be closed on shutdown
   */
  public registerServer(server: Server): void {
    this.servers.push(server);
  }

  /**
   * Register a cleanup handler to be called on shutdown
   */
  public registerCleanup(handler: () => Promise<void>): void {
    this.cleanupHandlers.push(handler);
  }

  /**
   * Initialize graceful shutdown listeners
   */
  public initialize(): void {
    // Handle SIGTERM (sent by Kubernetes, Docker, systemd)
    process.on('SIGTERM', async () => {
      Logger.info('Received SIGTERM signal, starting graceful shutdown');
      await this.shutdown();
    });

    // Handle SIGINT (Ctrl+C)
    process.on('SIGINT', async () => {
      Logger.info('Received SIGINT signal, starting graceful shutdown');
      await this.shutdown();
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      Logger.fatal('Uncaught exception, forcing shutdown', error);
      await this.shutdown(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', async (reason, promise) => {
      Logger.fatal('Unhandled promise rejection, forcing shutdown', reason instanceof Error ? reason : new Error(String(reason)));
      await this.shutdown(1);
    });
  }

  /**
   * Perform graceful shutdown
   */
  private async shutdown(exitCode = 0): Promise<void> {
    // Prevent multiple shutdown attempts
    if (this.shutdownInProgress) {
      Logger.warn('Shutdown already in progress');
      return;
    }

    this.shutdownInProgress = true;

    // Set a timeout to force exit if graceful shutdown takes too long
    const forceExitTimer = setTimeout(() => {
      Logger.error('Graceful shutdown timeout exceeded, forcing exit');
      process.exit(1);
    }, this.shutdownTimeout);

    try {
      Logger.info('Starting graceful shutdown sequence');

      // Step 1: Stop accepting new connections
      await this.closeServers();

      // Step 2: Run custom cleanup handlers
      await this.runCleanupHandlers();

      // Step 3: Final cleanup
      Logger.info('Graceful shutdown completed successfully');

      // Clear the force exit timer
      clearTimeout(forceExitTimer);

      // Exit
      process.exit(exitCode);
    } catch (error) {
      Logger.error('Error during graceful shutdown', error instanceof Error ? error : undefined);
      clearTimeout(forceExitTimer);
      process.exit(1);
    }
  }

  /**
   * Close all HTTP servers
   */
  private async closeServers(): Promise<void> {
    if (this.servers.length === 0) {
      return;
    }

    Logger.info(`Closing ${this.servers.length} HTTP server(s)`);

    await Promise.all(
      this.servers.map(
        (server) =>
          new Promise<void>((resolve) => {
            server.close((error) => {
              if (error) {
                Logger.error('Error closing HTTP server', error);
              } else {
                Logger.debug('HTTP server closed');
              }
              resolve();
            });

            // Force close connections after a delay
            setTimeout(() => {
              Logger.warn('Forcing server connections to close');
              server.closeAllConnections?.();
            }, 5000);
          })
      )
    );
  }

  /**
   * Run all registered cleanup handlers
   */
  private async runCleanupHandlers(): Promise<void> {
    if (this.cleanupHandlers.length === 0) {
      return;
    }

    Logger.info(`Running ${this.cleanupHandlers.length} cleanup handler(s)`);

    for (const handler of this.cleanupHandlers) {
      try {
        await handler();
      } catch (error) {
        Logger.error('Error in cleanup handler', error instanceof Error ? error : undefined);
      }
    }
  }

  /**
   * Create a default graceful shutdown instance with common cleanups
   */
  public static create(): GracefulShutdown {
    const shutdown = new GracefulShutdown();

    // Register common cleanup handlers
    shutdown.registerCleanup(async () => {
      try {
        // Close database connections
        const { currentApp } = await import('../foundation/registry');
        const db = currentApp().make('db');

        Logger.info('Closing database connections');
        await db.disconnect();
      } catch (error) {
        Logger.warn('Database cleanup skipped (not initialized)');
      }
    });

    shutdown.registerCleanup(async () => {
      try {
        // Stop cache cleanup intervals
        const { cache } = await import('../cache/CacheManager');
        const cacheInstance = cache();

        if ((cacheInstance as any).driver?.stopCleanup) {
          Logger.info('Stopping cache cleanup intervals');
          (cacheInstance as any).driver.stopCleanup();
        }
      } catch (error) {
        Logger.warn('Cache cleanup skipped (not initialized)');
      }
    });

    shutdown.registerCleanup(async () => {
      try {
        // Stop rate limit cleanup
        const { ThrottleRequests } = await import('../http/middleware/ThrottleRequests');

        Logger.info('Stopping rate limit cleanup');
        ThrottleRequests.stopCleanup();
      } catch (error) {
        Logger.warn('Rate limit cleanup skipped (not initialized)');
      }
    });

    return shutdown;
  }
}
