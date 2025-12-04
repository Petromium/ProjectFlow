/**
 * Google Search Console API Service
 * Fetches SEO data from Google Search Console
 * Falls back to placeholder data if API is not configured
 */

import { google } from 'googleapis';
import { getSecret } from './secretManager';
import { logger } from './cloudLogging';

let searchConsoleClient: any = null;
let siteUrl: string | null = null;

export interface SearchConsoleMetrics {
  indexedPages: number;
  organicTraffic: number;
  topQueries: Array<{ query: string; clicks: number; impressions: number; ctr: number; position: number }>;
  coverageIssues: Array<{ issue: string; count: number }>;
}

/**
 * Initialize Search Console API client
 */
export async function initializeSearchConsole(): Promise<void> {
  siteUrl = process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL || null;
  
  if (!siteUrl) {
    logger.warn('[Search Console] Site URL not configured. Search Console API will return placeholder data.');
    return;
  }

  try {
    // Try to get credentials from Secret Manager or environment
    const credentialsJson = await getSecret('GOOGLE_SEARCH_CONSOLE_CREDENTIALS') || 
                           process.env.GOOGLE_SEARCH_CONSOLE_CREDENTIALS;
    
    if (credentialsJson) {
      const credentials = JSON.parse(credentialsJson);
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
      });
      
      searchConsoleClient = google.webmasters({ version: 'v3', auth });
      logger.info(`[Search Console] Initialized for site: ${siteUrl}`);
    } else {
      // Try default credentials (Application Default Credentials)
      const auth = new google.auth.GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
      });
      searchConsoleClient = google.webmasters({ version: 'v3', auth });
      logger.info(`[Search Console] Initialized with default credentials for site: ${siteUrl}`);
    }
  } catch (error) {
    logger.error('[Search Console] Failed to initialize:', error);
    searchConsoleClient = null;
  }
}

/**
 * Get date range for Search Console queries (last 30 days)
 */
function getSearchConsoleDateRange() {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  
  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
}

/**
 * Fetch Search Console metrics
 */
export async function getSearchConsoleMetrics(): Promise<SearchConsoleMetrics> {
  if (!searchConsoleClient || !siteUrl) {
    // Return placeholder data if not configured
    return {
      indexedPages: 0,
      organicTraffic: 0,
      topQueries: [],
      coverageIssues: [],
    };
  }

  try {
    const { startDate, endDate } = getSearchConsoleDateRange();

    // Get search analytics (top queries)
    const searchAnalyticsResponse = await searchConsoleClient.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ['query'],
        rowLimit: 10,
      },
    });

    const topQueries = (searchAnalyticsResponse.data.rows || []).map((row: any) => ({
      query: row.keys[0] || '',
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: row.ctr || 0,
      position: row.position || 0,
    }));

    const organicTraffic = topQueries.reduce((sum: number, q: any) => sum + q.clicks, 0);

    // Get sitemap status (for indexed pages estimate)
    let indexedPages = 0;
    try {
      const sitemapsResponse = await searchConsoleClient.sitemaps.list({ siteUrl });
      const sitemaps = sitemapsResponse.data.sitemap || [];
      // Estimate indexed pages from sitemap submissions
      indexedPages = sitemaps.length * 10; // Rough estimate
    } catch (error) {
      logger.warn('[Search Console] Failed to fetch sitemap data:', error);
    }

    // Get coverage issues (if available)
    const coverageIssues: Array<{ issue: string; count: number }> = [];
    // Note: Coverage issues require Search Console API v3 which has limited access
    // This is a placeholder for future implementation

    return {
      indexedPages,
      organicTraffic,
      topQueries,
      coverageIssues,
    };
  } catch (error) {
    logger.error('[Search Console] Failed to fetch metrics:', error);
    // Return placeholder data on error
    return {
      indexedPages: 0,
      organicTraffic: 0,
      topQueries: [],
      coverageIssues: [],
    };
  }
}

// Initialize on module load
initializeSearchConsole();

