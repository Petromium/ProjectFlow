/**
 * Google Analytics 4 Data API Service
 * Fetches analytics data from GA4 for marketing dashboard
 * Falls back to placeholder data if API is not configured
 */

import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { getSecret } from './secretManager';
import { logger } from './cloudLogging';

let analyticsClient: BetaAnalyticsDataClient | null = null;
let propertyId: string | null = null;

export interface GA4Metrics {
  pageViews: number;
  uniqueVisitors: number;
  bounceRate: number;
  avgSessionDuration: number; // in seconds
  topPages: Array<{ path: string; views: number }>;
  trafficSources: Array<{ source: string; count: number }>;
}

/**
 * Initialize GA4 Data API client
 */
export async function initializeGA4(): Promise<void> {
  propertyId = process.env.GOOGLE_ANALYTICS_PROPERTY_ID || null;
  
  if (!propertyId) {
    logger.warn('[GA4] Property ID not configured. GA4 API will return placeholder data.');
    return;
  }

  try {
    // Try to get credentials from Secret Manager or environment
    const credentialsJson = await getSecret('GOOGLE_ANALYTICS_CREDENTIALS') || 
                           process.env.GOOGLE_ANALYTICS_CREDENTIALS;
    
    if (credentialsJson) {
      const credentials = JSON.parse(credentialsJson);
      analyticsClient = new BetaAnalyticsDataClient({
        credentials,
      });
      logger.info(`[GA4] Initialized for property: ${propertyId}`);
    } else {
      // Try default credentials (Application Default Credentials)
      analyticsClient = new BetaAnalyticsDataClient();
      logger.info(`[GA4] Initialized with default credentials for property: ${propertyId}`);
    }
  } catch (error) {
    logger.error('[GA4] Failed to initialize:', error);
    analyticsClient = null;
  }
}

/**
 * Get date range for analytics queries (last 30 days)
 */
function getDateRange() {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  
  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
}

/**
 * Fetch GA4 metrics
 */
export async function getGA4Metrics(): Promise<GA4Metrics> {
  if (!analyticsClient || !propertyId) {
    // Return placeholder data if not configured
    return {
      pageViews: 0,
      uniqueVisitors: 0,
      bounceRate: 0,
      avgSessionDuration: 0,
      topPages: [],
      trafficSources: [],
    };
  }

  try {
    const { startDate, endDate } = getDateRange();

    // Run report for overall metrics
    const [response] = await analyticsClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate, endDate }],
      metrics: [
        { name: 'screenPageViews' },
        { name: 'activeUsers' },
        { name: 'bounceRate' },
        { name: 'averageSessionDuration' },
      ],
      dimensions: [],
    });

    // Run report for top pages
    const [topPagesResponse] = await analyticsClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate, endDate }],
      metrics: [{ name: 'screenPageViews' }],
      dimensions: [{ name: 'pagePath' }],
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit: 10,
    });

    // Run report for traffic sources
    const [trafficSourcesResponse] = await analyticsClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate, endDate }],
      metrics: [{ name: 'sessions' }],
      dimensions: [{ name: 'sessionSource' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 10,
    });

    // Parse metrics
    const metrics = response.rows?.[0]?.metricValues || [];
    const pageViews = parseFloat(metrics[0]?.value || '0');
    const uniqueVisitors = parseFloat(metrics[1]?.value || '0');
    const bounceRate = parseFloat(metrics[2]?.value || '0') * 100; // Convert to percentage
    const avgSessionDuration = parseFloat(metrics[3]?.value || '0');

    // Parse top pages
    const topPages = (topPagesResponse.rows || []).map(row => ({
      path: row.dimensionValues?.[0]?.value || '',
      views: parseFloat(row.metricValues?.[0]?.value || '0'),
    }));

    // Parse traffic sources
    const trafficSources = (trafficSourcesResponse.rows || []).map(row => ({
      source: row.dimensionValues?.[0]?.value || 'direct',
      count: parseFloat(row.metricValues?.[0]?.value || '0'),
    }));

    return {
      pageViews,
      uniqueVisitors,
      bounceRate,
      avgSessionDuration,
      topPages,
      trafficSources,
    };
  } catch (error) {
    logger.error('[GA4] Failed to fetch metrics:', error);
    // Return placeholder data on error
    return {
      pageViews: 0,
      uniqueVisitors: 0,
      bounceRate: 0,
      avgSessionDuration: 0,
      topPages: [],
      trafficSources: [],
    };
  }
}

// Initialize on module load
initializeGA4();

