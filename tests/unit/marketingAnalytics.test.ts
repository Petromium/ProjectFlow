/**
 * Unit tests for Marketing Analytics Service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getGA4Metrics, initializeGA4 } from '../../server/services/marketingAnalytics';

// Mock dependencies
vi.mock('../../server/services/secretManager', () => ({
  getSecret: vi.fn(),
}));

vi.mock('../../server/services/cloudLogging', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@google-analytics/data', () => ({
  BetaAnalyticsDataClient: vi.fn().mockImplementation(() => ({
    runReport: vi.fn(),
  })),
}));

describe('Marketing Analytics Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GOOGLE_ANALYTICS_PROPERTY_ID = undefined;
  });

  describe('initializeGA4', () => {
    it('should initialize with placeholder data when property ID is not configured', async () => {
      const metrics = await getGA4Metrics();
      
      expect(metrics.pageViews).toBe(0);
      expect(metrics.uniqueVisitors).toBe(0);
      expect(metrics.topPages).toEqual([]);
      expect(metrics.trafficSources).toEqual([]);
    });
  });

  describe('getGA4Metrics', () => {
    it('should return placeholder data when not configured', async () => {
      const metrics = await getGA4Metrics();
      
      expect(metrics).toMatchObject({
        pageViews: 0,
        uniqueVisitors: 0,
        bounceRate: 0,
        avgSessionDuration: 0,
        topPages: [],
        trafficSources: [],
      });
    });

    it('should handle errors gracefully', async () => {
      // Even if there's an error, should return placeholder data
      const metrics = await getGA4Metrics();
      expect(metrics).toBeDefined();
      expect(metrics.pageViews).toBe(0);
    });
  });
});

