/**
 * Cloud Logging Service
 * Provides structured logging to Google Cloud Logging
 * Falls back to console.log in development or if GCP is not configured
 */

import { Logging } from '@google-cloud/logging';

let loggingClient: Logging | null = null;
let logName = 'projectflow';

// Initialize Cloud Logging client
export function initializeCloudLogging(): void {
  const projectId = process.env.GOOGLE_PROJECT_ID || process.env.GCLOUD_PROJECT;
  
  // Only initialize in production if project ID is set
  if (process.env.NODE_ENV === 'production' && projectId) {
    try {
      loggingClient = new Logging({ projectId });
      logName = process.env.GCP_LOG_NAME || 'projectflow';
      console.log(`[Cloud Logging] Initialized for project: ${projectId}`);
    } catch (error) {
      console.error('[Cloud Logging] Failed to initialize:', error);
      loggingClient = null;
    }
  }
}

// Log severity levels matching Cloud Logging
export enum LogSeverity {
  DEFAULT = 'DEFAULT',
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  NOTICE = 'NOTICE',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
  ALERT = 'ALERT',
  EMERGENCY = 'EMERGENCY',
}

interface LogEntryMetadata {
  severity?: LogSeverity;
  httpRequest?: {
    requestMethod?: string;
    requestUrl?: string;
    status?: number;
    userAgent?: string;
    remoteIp?: string;
  };
  labels?: Record<string, string>;
  [key: string]: any;
}

/**
 * Write log entry to Cloud Logging
 */
async function writeLogEntry(
  severity: LogSeverity,
  message: string,
  metadata: LogEntryMetadata = {}
): Promise<void> {
  // In development or if Cloud Logging is not initialized, use console
  if (!loggingClient || process.env.NODE_ENV !== 'production') {
    const consoleMethod = severity === LogSeverity.ERROR || severity === LogSeverity.CRITICAL 
      ? console.error 
      : severity === LogSeverity.WARNING 
      ? console.warn 
      : console.log;
    
    consoleMethod(`[${severity}] ${message}`, metadata);
    return;
  }

  try {
    const log = loggingClient.log(logName);
    const entry = log.entry(
      {
        severity,
        ...metadata,
      },
      message
    );
    await log.write(entry);
  } catch (error) {
    // Fallback to console if Cloud Logging fails
    console.error('[Cloud Logging] Failed to write log:', error);
    console.log(`[${severity}] ${message}`, metadata);
  }
}

/**
 * Logger class for structured logging
 */
export class Logger {
  private labels: Record<string, string>;

  constructor(labels: Record<string, string> = {}) {
    this.labels = labels;
  }

  /**
   * Create a child logger with additional labels
   */
  child(additionalLabels: Record<string, string>): Logger {
    return new Logger({ ...this.labels, ...additionalLabels });
  }

  /**
   * Log debug message
   */
  debug(message: string, metadata: LogEntryMetadata = {}): void {
    writeLogEntry(LogSeverity.DEBUG, message, { ...metadata, labels: this.labels });
  }

  /**
   * Log info message
   */
  info(message: string, metadata: LogEntryMetadata = {}): void {
    writeLogEntry(LogSeverity.INFO, message, { ...metadata, labels: this.labels });
  }

  /**
   * Log warning message
   */
  warn(message: string, metadata: LogEntryMetadata = {}): void {
    writeLogEntry(LogSeverity.WARNING, message, { ...metadata, labels: this.labels });
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error | any, metadata: LogEntryMetadata = {}): void {
    const errorMetadata: LogEntryMetadata = {
      ...metadata,
      labels: this.labels,
    };

    if (error instanceof Error) {
      errorMetadata.error = {
        message: error.message,
        stack: error.stack,
        name: error.name,
      };
    } else if (error) {
      errorMetadata.error = error;
    }

    writeLogEntry(LogSeverity.ERROR, message, errorMetadata);
  }

  /**
   * Log critical error message
   */
  critical(message: string, error?: Error | any, metadata: LogEntryMetadata = {}): void {
    const errorMetadata: LogEntryMetadata = {
      ...metadata,
      labels: this.labels,
    };

    if (error instanceof Error) {
      errorMetadata.error = {
        message: error.message,
        stack: error.stack,
        name: error.name,
      };
    } else if (error) {
      errorMetadata.error = error;
    }

    writeLogEntry(LogSeverity.CRITICAL, message, errorMetadata);
  }

  /**
   * Log HTTP request
   */
  httpRequest(
    method: string,
    url: string,
    status: number,
    duration: number,
    metadata: LogEntryMetadata = {}
  ): void {
    const severity = status >= 500 
      ? LogSeverity.ERROR 
      : status >= 400 
      ? LogSeverity.WARNING 
      : LogSeverity.INFO;

    writeLogEntry(severity, `${method} ${url} ${status}`, {
      ...metadata,
      labels: this.labels,
      httpRequest: {
        requestMethod: method,
        requestUrl: url,
        status,
      },
      durationMs: duration,
    });
  }
}

// Default logger instance
export const logger = new Logger();

// Initialize on module load
initializeCloudLogging();

