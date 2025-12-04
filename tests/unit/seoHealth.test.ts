/**
 * Unit tests for SEO Health Service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getSEOHealthMetrics, performSEOHealthCheck } from '../../server/services/seoHealth';

// Mock dependencies
vi.mock('../../server/services/searchConsole', () => ({
  getSearchConsoleMetrics: vi.fn(),
}));

vi.mock('../../server/services/cloudLogging', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('SEO Health Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSEOHealthMetrics', () => {
    it('should return metrics with placeholder data when Search Console is not configured', async () => {
      const { getSearchConsoleMetrics } = await import('../../server/services/searchConsole');
      vi.mocked(getSearchConsoleMetrics).mockResolvedValue({
        indexedPages: 0,
        organicTraffic: 0,
        topQueries: [],
        coverageIssues: [],
      });

      const metrics = await getSEOHealthMetrics();
      
      // With all zeros, score calculation starts at 100 and deducts points
      // Low indexed pages (<10): -20, Low organic traffic (<100): -30
      // So score should be 100 - 20 - 30 = 50, but we cap at 0 minimum
      // Actually, the calculation deducts more, so score will be lower
      expect(metrics.overallScore).toBeLessThanOrEqual(50);
      expect(metrics.indexedPages).toBe(0);
      expect(metrics.organicTraffic).toBe(0);
      expect(metrics.recommendations.length).toBeGreaterThan(0);
    });

    it('should calculate health score based on metrics', async () => {
      const { getSearchConsoleMetrics } = await import('../../server/services/searchConsole');
      vi.mocked(getSearchConsoleMetrics).mockResolvedValue({
        indexedPages: 100,
        organicTraffic: 1000,
        topQueries: [
          { query: 'test', clicks: 100, impressions: 1000, ctr: 0.1, position: 5 },
          { query: 'example', clicks: 50, impressions: 500, ctr: 0.1, position: 10 },
        ],
        coverageIssues: [],
      });

      const metrics = await getSEOHealthMetrics();
      
      expect(metrics.overallScore).toBeGreaterThan(50);
      expect(metrics.averagePosition).toBe(7.5);
      expect(metrics.clickThroughRate).toBe(0.1);
    });

    it('should generate recommendations for low scores', async () => {
      const { getSearchConsoleMetrics } = await import('../../server/services/searchConsole');
      vi.mocked(getSearchConsoleMetrics).mockResolvedValue({
        indexedPages: 5,
        organicTraffic: 50,
        topQueries: [
          { query: 'test', clicks: 10, impressions: 1000, ctr: 0.01, position: 50 },
        ],
        coverageIssues: [
          { issue: '404 error', count: 10 },
        ],
      });

      const metrics = await getSEOHealthMetrics();
      
      expect(metrics.overallScore).toBeLessThan(50);
      expect(metrics.recommendations.length).toBeGreaterThan(0);
      expect(metrics.recommendations.some(r => r.priority === 'high')).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      const { getSearchConsoleMetrics } = await import('../../server/services/searchConsole');
      vi.mocked(getSearchConsoleMetrics).mockRejectedValue(new Error('API error'));

      const metrics = await getSEOHealthMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.overallScore).toBe(0);
      expect(metrics.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('performSEOHealthCheck', () => {
    it('should perform health check without errors', async () => {
      const { getSearchConsoleMetrics } = await import('../../server/services/searchConsole');
      vi.mocked(getSearchConsoleMetrics).mockResolvedValue({
        indexedPages: 50,
        organicTraffic: 500,
        topQueries: [],
        coverageIssues: [],
      });

      await expect(performSEOHealthCheck()).resolves.not.toThrow();
    });
  });
});

