/**
 * Cloud Monitoring Service
 * Provides custom metrics and monitoring to Google Cloud Monitoring
 * Falls back gracefully if GCP is not configured
 */

import { MetricServiceClient } from '@google-cloud/monitoring';

let monitoringClient: MetricServiceClient | null = null;
let projectId: string | null = null;
let projectPath: string | null = null;

// Initialize Cloud Monitoring client
export function initializeCloudMonitoring(): void {
  projectId = process.env.GOOGLE_PROJECT_ID || process.env.GCLOUD_PROJECT || null;
  
  // Only initialize in production if project ID is set
  if (process.env.NODE_ENV === 'production' && projectId) {
    try {
      monitoringClient = new MetricServiceClient();
      projectPath = monitoringClient.projectPath(projectId);
      console.log(`[Cloud Monitoring] Initialized for project: ${projectId}`);
    } catch (error) {
      console.error('[Cloud Monitoring] Failed to initialize:', error);
      monitoringClient = null;
    }
  }
}

/**
 * Record a custom metric
 */
export async function recordMetric(
  metricType: string,
  value: number,
  labels: Record<string, string> = {}
): Promise<void> {
  if (!monitoringClient || !projectPath) {
    // Silently fail in development or if not configured
    return;
  }

  try {
    const dataPoint = {
      interval: {
        endTime: {
          seconds: Date.now() / 1000,
        },
      },
      value: {
        doubleValue: value,
      },
    };

    const timeSeries = {
      metric: {
        type: `custom.googleapis.com/${metricType}`,
        labels,
      },
      points: [dataPoint],
    };

    await monitoringClient.createTimeSeries({
      name: projectPath,
      timeSeries: [timeSeries],
    });
  } catch (error) {
    // Don't fail the application if monitoring fails
    console.error('[Cloud Monitoring] Failed to record metric:', error);
  }
}

/**
 * Record API response time metric
 */
export async function recordApiResponseTime(
  endpoint: string,
  method: string,
  durationMs: number,
  statusCode: number
): Promise<void> {
  await recordMetric('api/response_time', durationMs, {
    endpoint,
    method,
    status_code: statusCode.toString(),
  });
}

/**
 * Record API request count metric
 */
export async function recordApiRequestCount(
  endpoint: string,
  method: string,
  statusCode: number
): Promise<void> {
  await recordMetric('api/request_count', 1, {
    endpoint,
    method,
    status_code: statusCode.toString(),
  });
}

/**
 * Record error count metric
 */
export async function recordErrorCount(
  errorType: string,
  endpoint?: string
): Promise<void> {
  const labels: Record<string, string> = { error_type: errorType };
  if (endpoint) {
    labels.endpoint = endpoint;
  }
  await recordMetric('errors/count', 1, labels);
}

/**
 * Record database query time metric
 */
export async function recordDatabaseQueryTime(
  queryType: string,
  durationMs: number
): Promise<void> {
  await recordMetric('database/query_time', durationMs, {
    query_type: queryType,
  });
}

/**
 * Record active user count metric
 */
export async function recordActiveUserCount(count: number): Promise<void> {
  await recordMetric('users/active_count', count);
}

/**
 * Record task creation count metric
 */
export async function recordTaskCreationCount(): Promise<void> {
  await recordMetric('tasks/creation_count', 1);
}

/**
 * Record WebSocket connection count metric
 */
export async function recordWebSocketConnectionCount(count: number): Promise<void> {
  await recordMetric('websocket/connection_count', count);
}

// Initialize on module load
initializeCloudMonitoring();

