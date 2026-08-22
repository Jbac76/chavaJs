/**
 * Structured logging system for chavaJs
 *
 * Provides a simple, production-ready logging interface with support for
 * different log levels, structured context, and environment-aware formatting.
 *
 * In development: Pretty, colorized output
 * In production: JSON-formatted logs for log aggregation systems
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogContext {
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    message: string;
    stack?: string;
    name?: string;
  };
}

class LoggerService {
  private minLevel: LogLevel = 'info';
  private isProduction = false;

  constructor() {
    this.configure();
  }

  private configure(): void {
    // Read from environment
    const env = process.env.APP_ENV || process.env.NODE_ENV || 'production';
    const debug = process.env.APP_DEBUG === 'true';

    this.isProduction = env === 'production' && !debug;
    this.minLevel = debug ? 'debug' : 'info';
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error', 'fatal'];
    const currentIndex = levels.indexOf(this.minLevel);
    const requestedIndex = levels.indexOf(level);
    return requestedIndex >= currentIndex;
  }

  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  private colorize(level: LogLevel, text: string): string {
    if (this.isProduction) return text;

    const colors: Record<LogLevel, string> = {
      debug: '\x1b[36m',    // Cyan
      info: '\x1b[32m',     // Green
      warn: '\x1b[33m',     // Yellow
      error: '\x1b[31m',    // Red
      fatal: '\x1b[35m',    // Magenta
    };
    const reset = '\x1b[0m';
    return `${colors[level]}${text}${reset}`;
  }

  private formatPretty(entry: LogEntry): string {
    const levelStr = entry.level.toUpperCase().padEnd(5);
    const coloredLevel = this.colorize(entry.level, levelStr);
    const time = new Date(entry.timestamp).toLocaleTimeString();

    let output = `${time} ${coloredLevel} ${entry.message}`;

    if (entry.context && Object.keys(entry.context).length > 0) {
      output += `\n  ${JSON.stringify(entry.context, null, 2)
        .split('\n')
        .join('\n  ')}`;
    }

    if (entry.error) {
      output += `\n  ${this.colorize('error', entry.error.message)}`;
      if (entry.error.stack) {
        output += `\n  ${entry.error.stack.split('\n').join('\n  ')}`;
      }
    }

    return output;
  }

  private formatJson(entry: LogEntry): string {
    return JSON.stringify(entry);
  }

  private write(entry: LogEntry): void {
    const output = this.isProduction
      ? this.formatJson(entry)
      : this.formatPretty(entry);

    const stream = entry.level === 'error' || entry.level === 'fatal'
      ? process.stderr
      : process.stdout;

    stream.write(output + '\n');
  }

  /**
   * Log a debug message (only in debug mode)
   */
  public debug(message: string, context?: LogContext): void {
    if (!this.shouldLog('debug')) return;

    this.write({
      timestamp: this.formatTimestamp(),
      level: 'debug',
      message,
      context,
    });
  }

  /**
   * Log an informational message
   */
  public info(message: string, context?: LogContext): void {
    if (!this.shouldLog('info')) return;

    this.write({
      timestamp: this.formatTimestamp(),
      level: 'info',
      message,
      context,
    });
  }

  /**
   * Log a warning message
   */
  public warn(message: string, context?: LogContext): void {
    if (!this.shouldLog('warn')) return;

    this.write({
      timestamp: this.formatTimestamp(),
      level: 'warn',
      message,
      context,
    });
  }

  /**
   * Log an error message
   */
  public error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (!this.shouldLog('error')) return;

    const entry: LogEntry = {
      timestamp: this.formatTimestamp(),
      level: 'error',
      message,
      context,
    };

    if (error instanceof Error) {
      entry.error = {
        message: error.message,
        stack: error.stack,
        name: error.name,
      };
    } else if (error) {
      entry.error = {
        message: String(error),
      };
    }

    this.write(entry);
  }

  /**
   * Log a fatal error (application cannot continue)
   */
  public fatal(message: string, error?: Error | unknown, context?: LogContext): void {
    const entry: LogEntry = {
      timestamp: this.formatTimestamp(),
      level: 'fatal',
      message,
      context,
    };

    if (error instanceof Error) {
      entry.error = {
        message: error.message,
        stack: error.stack,
        name: error.name,
      };
    } else if (error) {
      entry.error = {
        message: String(error),
      };
    }

    this.write(entry);
  }

  /**
   * Create a child logger with preset context
   */
  public child(context: LogContext): ChildLogger {
    return new ChildLogger(this, context);
  }
}

class ChildLogger {
  constructor(
    private parent: LoggerService,
    private baseContext: LogContext
  ) {}

  private mergeContext(context?: LogContext): LogContext {
    return { ...this.baseContext, ...context };
  }

  public debug(message: string, context?: LogContext): void {
    this.parent.debug(message, this.mergeContext(context));
  }

  public info(message: string, context?: LogContext): void {
    this.parent.info(message, this.mergeContext(context));
  }

  public warn(message: string, context?: LogContext): void {
    this.parent.warn(message, this.mergeContext(context));
  }

  public error(message: string, error?: Error | unknown, context?: LogContext): void {
    this.parent.error(message, error, this.mergeContext(context));
  }

  public fatal(message: string, error?: Error | unknown, context?: LogContext): void {
    this.parent.fatal(message, error, this.mergeContext(context));
  }
}

// Export singleton instance
export const Logger = new LoggerService();
