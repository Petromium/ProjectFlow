/**
 * SEO Health Monitoring Service
 * Monitors SEO health metrics and generates reports
 */

import { logger } from './cloudLogging';
import { getSearchConsoleMetrics, SearchConsoleMetrics } from './searchConsole';

export interface SEOHealthMetrics {
  overallScore: number; // 0-100
  indexedPages: number;
  organicTraffic: number;
  averagePosition: number;
  clickThroughRate: number;
  coverageIssues: Array<{ issue: string; count: number; severity: 'low' | 'medium' | 'high' }>;
  recommendations: Array<{ title: string; description: string; priority: 'low' | 'medium' | 'high' }>;
  lastChecked: Date;
}

/**
 * Calculate SEO health score
 */
function calculateSEOHealthScore(metrics: SearchConsoleMetrics): number {
  let score = 100;

  // Deduct points for low indexed pages
  if (metrics.indexedPages < 10) {
    score -= 20;
  } else if (metrics.indexedPages < 50) {
    score -= 10;
  }

  // Deduct points for low organic traffic
  if (metrics.organicTraffic < 100) {
    score -= 30;
  } else if (metrics.organicTraffic < 500) {
    score -= 15;
  }

  // Deduct points for poor average position
  const avgPosition = metrics.topQueries.length > 0
    ? metrics.topQueries.reduce((sum, q) => sum + q.position, 0) / metrics.topQueries.length
    : 0;
  
  if (avgPosition > 50) {
    score -= 20;
  } else if (avgPosition > 20) {
    score -= 10;
  }

  // Deduct points for low CTR
  const avgCTR = metrics.topQueries.length > 0
    ? metrics.topQueries.reduce((sum, q) => sum + q.ctr, 0) / metrics.topQueries.length
    : 0;
  
  if (avgCTR < 0.01) {
    score -= 15;
  } else if (avgCTR < 0.03) {
    score -= 7;
  }

  // Deduct points for coverage issues
  score -= metrics.coverageIssues.length * 5;

  return Math.max(0, Math.min(100, score));
}

/**
 * Generate SEO recommendations
 */
function generateRecommendations(metrics: SearchConsoleMetrics, healthScore: number): Array<{ title: string; description: string; priority: 'low' | 'medium' | 'high' }> {
  const recommendations: Array<{ title: string; description: string; priority: 'low' | 'medium' | 'high' }> = [];

  if (metrics.indexedPages < 10) {
    recommendations.push({
      title: 'Increase Indexed Pages',
      description: 'Submit a sitemap and ensure all important pages are crawlable. Currently only ' + metrics.indexedPages + ' pages are indexed.',
      priority: 'high',
    });
  }

  if (metrics.organicTraffic < 100) {
    recommendations.push({
      title: 'Improve Organic Traffic',
      description: 'Focus on content marketing and keyword optimization. Current organic traffic is ' + metrics.organicTraffic + ' clicks/month.',
      priority: 'high',
    });
  }

  const avgPosition = metrics.topQueries.length > 0
    ? metrics.topQueries.reduce((sum, q) => sum + q.position, 0) / metrics.topQueries.length
    : 0;

  if (avgPosition > 20) {
    recommendations.push({
      title: 'Improve Search Rankings',
      description: `Average search position is ${avgPosition.toFixed(1)}. Focus on on-page SEO and backlink building.`,
      priority: 'medium',
    });
  }

  const avgCTR = metrics.topQueries.length > 0
    ? metrics.topQueries.reduce((sum, q) => sum + q.ctr, 0) / metrics.topQueries.length
    : 0;

  if (avgCTR < 0.02) {
    recommendations.push({
      title: 'Improve Click-Through Rate',
      description: `Current CTR is ${(avgCTR * 100).toFixed(2)}%. Optimize meta titles and descriptions to be more compelling.`,
      priority: 'medium',
    });
  }

  if (metrics.coverageIssues.length > 0) {
    recommendations.push({
      title: 'Fix Coverage Issues',
      description: `There are ${metrics.coverageIssues.length} coverage issues that need attention. Review Search Console for details.`,
      priority: 'high',
    });
  }

  if (healthScore < 50) {
    recommendations.push({
      title: 'Overall SEO Health Needs Improvement',
      description: 'Multiple SEO factors need attention. Consider a comprehensive SEO audit.',
      priority: 'high',
    });
  }

  return recommendations;
}

/**
 * Get SEO health metrics
 */
export async function getSEOHealthMetrics(): Promise<SEOHealthMetrics> {
  try {
    const searchConsoleMetrics = await getSearchConsoleMetrics();
    const overallScore = calculateSEOHealthScore(searchConsoleMetrics);
    const recommendations = generateRecommendations(searchConsoleMetrics, overallScore);

    const avgPosition = searchConsoleMetrics.topQueries.length > 0
      ? searchConsoleMetrics.topQueries.reduce((sum, q) => sum + q.position, 0) / searchConsoleMetrics.topQueries.length
      : 0;

    const avgCTR = searchConsoleMetrics.topQueries.length > 0
      ? searchConsoleMetrics.topQueries.reduce((sum, q) => sum + q.ctr, 0) / searchConsoleMetrics.topQueries.length
      : 0;

    const coverageIssues = searchConsoleMetrics.coverageIssues.map(issue => ({
      ...issue,
      severity: issue.count > 10 ? 'high' : issue.count > 5 ? 'medium' : 'low' as 'low' | 'medium' | 'high',
    }));

    return {
      overallScore,
      indexedPages: searchConsoleMetrics.indexedPages,
      organicTraffic: searchConsoleMetrics.organicTraffic,
      averagePosition: avgPosition,
      clickThroughRate: avgCTR,
      coverageIssues,
      recommendations,
      lastChecked: new Date(),
    };
  } catch (error) {
    logger.error('[SEO Health] Failed to get SEO health metrics:', error);
    // Return placeholder data on error
    return {
      overallScore: 0,
      indexedPages: 0,
      organicTraffic: 0,
      averagePosition: 0,
      clickThroughRate: 0,
      coverageIssues: [],
      recommendations: [{
        title: 'SEO Monitoring Not Configured',
        description: 'Configure Google Search Console API to enable SEO health monitoring.',
        priority: 'medium',
      }],
      lastChecked: new Date(),
    };
  }
}

/**
 * Schedule SEO health check (to be called by scheduler)
 */
export async function performSEOHealthCheck(): Promise<void> {
  try {
    const metrics = await getSEOHealthMetrics();
    logger.info('[SEO Health] Health check completed', {
      overallScore: metrics.overallScore,
      indexedPages: metrics.indexedPages,
      organicTraffic: metrics.organicTraffic,
      recommendationsCount: metrics.recommendations.length,
    });

    // In the future, could store these metrics in the database for historical tracking
  } catch (error) {
    logger.error('[SEO Health] Failed to perform health check:', error);
  }
}

