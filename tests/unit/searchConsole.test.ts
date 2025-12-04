/**
 * Unit tests for Search Console Service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getSearchConsoleMetrics, initializeSearchConsole } from '../../server/services/searchConsole';

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

vi.mock('googleapis', () => ({
  google: {
    webmasters: vi.fn().mockReturnValue({
      searchanalytics: {
        query: vi.fn(),
      },
      sitemaps: {
        list: vi.fn(),
      },
    }),
  },
}));

describe('Search Console Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL = undefined;
  });

  describe('initializeSearchConsole', () => {
    it('should initialize with placeholder data when site URL is not configured', async () => {
      const metrics = await getSearchConsoleMetrics();
      
      expect(metrics.indexedPages).toBe(0);
      expect(metrics.organicTraffic).toBe(0);
      expect(metrics.topQueries).toEqual([]);
      expect(metrics.coverageIssues).toEqual([]);
    });
  });

  describe('getSearchConsoleMetrics', () => {
    it('should return placeholder data when not configured', async () => {
      const metrics = await getSearchConsoleMetrics();
      
      expect(metrics).toMatchObject({
        indexedPages: 0,
        organicTraffic: 0,
        topQueries: [],
        coverageIssues: [],
      });
    });

    it('should handle errors gracefully', async () => {
      const metrics = await getSearchConsoleMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.indexedPages).toBe(0);
    });
  });
});

