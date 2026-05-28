/**
 * Logger Utility
 * Simple structured logger for the application.
 * In production, this can be replaced with Winston, Pino, etc.
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: string;
  data?: unknown;
}

class Logger {
  private context: string;

  constructor(context: string = 'App') {
    this.context = context;
  }

  /**
   * Create a child logger with a specific context
   */
  child(context: string): Logger {
    return new Logger(context);
  }

  info(message: string, data?: unknown): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: unknown): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: unknown): void {
    this.log('error', message, data);
  }

  debug(message: string, data?: unknown): void {
    this.log('debug', message, data);
  }

  private log(level: LogLevel, message: string, data?: unknown): void {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context: this.context,
      ...(data && { data }),
    };

    const prefix = `[${entry.timestamp}] [${level.toUpperCase()}] [${this.context}]`;

    switch (level) {
      case 'error':
        console.error(`${prefix} ${message}`, data ?? '');
        break;
      case 'warn':
        console.warn(`${prefix} ${message}`, data ?? '');
        break;
      case 'debug':
        if (process.env.NODE_ENV === 'development') {
          console.debug(`${prefix} ${message}`, data ?? '');
        }
        break;
      default:
        console.log(`${prefix} ${message}`, data ?? '');
    }
  }
}

// Export singleton default logger and class for child loggers
export const logger = new Logger('App');
export { Logger };
