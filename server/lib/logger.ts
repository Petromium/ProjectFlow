/**
 * Structured Logging Utility
 * Provides consistent logging across the application
 */

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, any>;
  error?: {
    message: string;
    stack?: string;
    name?: string;
  };
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  private isProduction = process.env.NODE_ENV === 'production';

  private formatLog(level: LogLevel, message: string, context?: Record<string, any>, error?: Error): LogEntry {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
    };

    if (context && Object.keys(context).length > 0) {
      entry.context = context;
    }

    if (error) {
      entry.error = {
        message: error.message,
        name: error.name,
        ...(this.isDevelopment && { stack: error.stack }),
      };
    }

    return entry;
  }

  private output(entry: LogEntry): void {
    if (this.isProduction) {
      // In production, output JSON for log aggregation tools
      console.log(JSON.stringify(entry));
    } else {
      // In development, output formatted for readability
      const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}]`;
      console.log(prefix, entry.message);
      if (entry.context) {
        console.log('  Context:', entry.context);
      }
      if (entry.error) {
        console.error('  Error:', entry.error.message);
        if (entry.error.stack) {
          console.error(entry.error.stack);
        }
      }
    }
  }

  error(message: string, error?: Error, context?: Record<string, any>): void {
    this.output(this.formatLog('error', message, context, error));
  }

  warn(message: string, context?: Record<string, any>): void {
    this.output(this.formatLog('warn', message, context));
  }

  info(message: string, context?: Record<string, any>): void {
    this.output(this.formatLog('info', message, context));
  }

  debug(message: string, context?: Record<string, any>): void {
    if (this.isDevelopment) {
      this.output(this.formatLog('debug', message, context));
    }
  }
}

export const logger = new Logger();

