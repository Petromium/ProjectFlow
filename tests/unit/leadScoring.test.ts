/**
 * Unit tests for Lead Scoring Service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { calculateLeadScore, getAllLeadScores, getPQLs } from '../../server/services/leadScoring';

// Mock storage
vi.mock('../../server/storage', () => ({
  storage: {
    getUser: vi.fn(),
    getUserOrganizations: vi.fn(),
    getOrganization: vi.fn(),
    getUserActivityLogs: vi.fn(),
    getProjectsByOrganization: vi.fn(),
    getTasksByProject: vi.fn(),
    getUsersByOrganization: vi.fn(),
    getOrganizationUsage: vi.fn(),
    getAllUsers: vi.fn(),
  },
}));

import { storage } from '../../server/storage';
const mockStorage = storage as any;

vi.mock('../../server/services/cloudLogging', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Lead Scoring Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculateLeadScore', () => {
    it('should calculate score for a cold lead', async () => {
      mockStorage.getUser.mockResolvedValue({
        id: 'user1',
        email: 'test@example.com',
        createdAt: new Date(),
      });
      mockStorage.getUserOrganizations.mockResolvedValue([]);
      mockStorage.getUserActivityLogs.mockResolvedValue([]);

      const score = await calculateLeadScore('user1');
      
      expect(score.tier).toBe('cold');
      expect(score.score).toBeLessThan(30);
      expect(score.email).toBe('test@example.com');
    });

    it('should calculate score for a warm lead with projects', async () => {
      mockStorage.getUser.mockResolvedValue({
        id: 'user2',
        email: 'warm@example.com',
        createdAt: new Date(),
      });
      mockStorage.getUserOrganizations.mockResolvedValue([
        { organizationId: 1, role: 'owner' },
      ]);
      mockStorage.getOrganization.mockResolvedValue({
        id: 1,
        name: 'Test Org',
      });
      mockStorage.getUserActivityLogs.mockResolvedValue([
        { action: 'login', createdAt: new Date() },
      ]);
      mockStorage.getProjectsByOrganization.mockResolvedValue([
        { id: 1, name: 'Project 1' },
      ]);
      mockStorage.getTasksByProject.mockResolvedValue([
        { id: 1, name: 'Task 1' },
      ]);
      mockStorage.getUsersByOrganization.mockResolvedValue([
        { id: 'user2' },
      ]);
      mockStorage.getOrganizationUsage.mockResolvedValue({
        storageUsedBytes: '0',
        aiTokensUsed: 0,
        emailsSent: 0,
      });

      const score = await calculateLeadScore('user2');
      
      expect(score.signals.projectCreated).toBe(true);
      expect(score.signals.tasksCreated).toBe(true);
      expect(score.score).toBeGreaterThan(0);
    });

    it('should identify PQL with high engagement', async () => {
      mockStorage.getUser.mockResolvedValue({
        id: 'user3',
        email: 'pql@example.com',
        createdAt: new Date(),
      });
      mockStorage.getUserOrganizations.mockResolvedValue([
        { organizationId: 1, role: 'owner' },
        { organizationId: 2, role: 'admin' },
      ]);
      mockStorage.getOrganization.mockResolvedValue({
        id: 1,
        name: 'Test Org',
      });
      mockStorage.getUserActivityLogs.mockResolvedValue(
        Array.from({ length: 10 }, (_, i) => ({
          action: i % 2 === 0 ? 'login' : 'export',
          createdAt: new Date(Date.now() - i * 86400000),
        }))
      );
      mockStorage.getProjectsByOrganization.mockResolvedValue([
        { id: 1, name: 'Project 1' },
        { id: 2, name: 'Project 2' },
      ]);
      mockStorage.getTasksByProject.mockResolvedValue(
        Array.from({ length: 50 }, (_, i) => ({ id: i, name: `Task ${i}` }))
      );
      mockStorage.getUsersByOrganization.mockResolvedValue([
        { id: 'user3' },
        { id: 'user4' },
      ]);
      mockStorage.getOrganizationUsage.mockResolvedValue({
        storageUsedBytes: '1048576', // 1MB
        aiTokensUsed: 1000,
        emailsSent: 10,
      });

      const score = await calculateLeadScore('user3');
      
      expect(score.signals.multipleProjects).toBe(true);
      expect(score.signals.teamInvited).toBe(true);
      expect(score.signals.storageUsed).toBe(true);
      expect(score.signals.aiUsed).toBe(true);
      expect(score.signals.frequentLogin).toBe(true);
      expect(score.score).toBeGreaterThan(60);
    });

    it('should handle errors gracefully', async () => {
      mockStorage.getUser.mockRejectedValue(new Error('User not found'));

      await expect(calculateLeadScore('invalid')).rejects.toThrow();
    });
  });

  describe('getAllLeadScores', () => {
    it('should return all lead scores sorted by score', async () => {
      mockStorage.getAllUsers.mockResolvedValue([
        { id: 'user1', email: 'user1@example.com', createdAt: new Date() },
        { id: 'user2', email: 'user2@example.com', createdAt: new Date() },
      ]);

      // Mock calculateLeadScore for each user
      mockStorage.getUser.mockImplementation((id: string) => {
        return Promise.resolve({
          id,
          email: `${id}@example.com`,
          createdAt: new Date(),
        });
      });
      mockStorage.getUserOrganizations.mockResolvedValue([]);
      mockStorage.getUserActivityLogs.mockResolvedValue([]);

      const scores = await getAllLeadScores();
      
      expect(scores.length).toBeGreaterThan(0);
      // Scores should be sorted descending
      for (let i = 0; i < scores.length - 1; i++) {
        expect(scores[i].score).toBeGreaterThanOrEqual(scores[i + 1].score);
      }
    });
  });

  describe('getPQLs', () => {
    it('should return only PQLs', async () => {
      mockStorage.getAllUsers.mockResolvedValue([
        { id: 'user1', email: 'user1@example.com', createdAt: new Date() },
      ]);

      mockStorage.getUser.mockResolvedValue({
        id: 'user1',
        email: 'user1@example.com',
        createdAt: new Date(),
      });
      mockStorage.getUserOrganizations.mockResolvedValue([]);
      mockStorage.getUserActivityLogs.mockResolvedValue([]);

      const pqls = await getPQLs();
      
      // All returned scores should be PQLs
      pqls.forEach(pql => {
        expect(pql.tier).toBe('pql');
        expect(pql.score).toBeGreaterThanOrEqual(85);
      });
    });
  });
});

