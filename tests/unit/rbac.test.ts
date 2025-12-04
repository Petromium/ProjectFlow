/**
 * RBAC (Role-Based Access Control) Unit Tests
 * Tests for authorization and permission enforcement
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { requireRole, canManageUser } from '../../server/middleware/rbac';
import { storage } from '../../server/storage';
import {
  createTestOrganization,
  createTestUser,
  createTestProject,
  linkUserToOrganization,
  cleanupTestData,
} from '../fixtures/db';
import type { Request, Response, NextFunction } from 'express';

describe('RBAC', () => {
  let testOrgId: number;
  let ownerUserId: string;
  let adminUserId: string;
  let memberUserId: string;
  let viewerUserId: string;
  let testProjectId: number;

  beforeAll(async () => {
    // Set up test organization
    const org = await createTestOrganization('RBAC Test Org');
    testOrgId = org.id;

    // Create users with different roles
    const owner = await createTestUser(`owner-${Date.now()}@example.com`);
    ownerUserId = owner.id;
    await linkUserToOrganization(owner.id, org.id, 'owner');

    const admin = await createTestUser(`admin-${Date.now()}@example.com`);
    adminUserId = admin.id;
    await linkUserToOrganization(admin.id, org.id, 'admin');

    const member = await createTestUser(`member-${Date.now()}@example.com`);
    memberUserId = member.id;
    await linkUserToOrganization(member.id, org.id, 'member');

    const viewer = await createTestUser(`viewer-${Date.now()}@example.com`);
    viewerUserId = viewer.id;
    await linkUserToOrganization(viewer.id, org.id, 'viewer');

    // Create test project
    const project = await createTestProject(org.id, 'RBAC Test Project');
    testProjectId = project.id;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('Role Hierarchy', () => {
    it('should recognize role hierarchy correctly', async () => {
      const ownerOrg = await storage.getUserOrganization(ownerUserId, testOrgId);
      const adminOrg = await storage.getUserOrganization(adminUserId, testOrgId);
      const memberOrg = await storage.getUserOrganization(memberUserId, testOrgId);
      const viewerOrg = await storage.getUserOrganization(viewerUserId, testOrgId);

      expect(ownerOrg?.role).toBe('owner');
      expect(adminOrg?.role).toBe('admin');
      expect(memberOrg?.role).toBe('member');
      expect(viewerOrg?.role).toBe('viewer');
    });
  });

  describe('canManageUser', () => {
    it('should allow owner to manage admin', async () => {
      const canManage = await canManageUser(ownerUserId, adminUserId, testOrgId);
      expect(canManage).toBe(true);
    });

    it('should allow owner to manage member', async () => {
      const canManage = await canManageUser(ownerUserId, memberUserId, testOrgId);
      expect(canManage).toBe(true);
    });

    it('should allow owner to manage viewer', async () => {
      const canManage = await canManageUser(ownerUserId, viewerUserId, testOrgId);
      expect(canManage).toBe(true);
    });

    it('should allow admin to manage member', async () => {
      const canManage = await canManageUser(adminUserId, memberUserId, testOrgId);
      expect(canManage).toBe(true);
    });

    it('should allow admin to manage viewer', async () => {
      const canManage = await canManageUser(adminUserId, viewerUserId, testOrgId);
      expect(canManage).toBe(true);
    });

    it('should NOT allow admin to manage owner', async () => {
      const canManage = await canManageUser(adminUserId, ownerUserId, testOrgId);
      expect(canManage).toBe(false);
    });

    it('should NOT allow admin to manage admin', async () => {
      const anotherAdmin = await createTestUser(`admin2-${Date.now()}@example.com`);
      await linkUserToOrganization(anotherAdmin.id, testOrgId, 'admin');
      const canManage = await canManageUser(adminUserId, anotherAdmin.id, testOrgId);
      expect(canManage).toBe(false);
    });

    it('should NOT allow member to manage anyone', async () => {
      const canManage = await canManageUser(memberUserId, viewerUserId, testOrgId);
      expect(canManage).toBe(false);
    });

    it('should NOT allow viewer to manage anyone', async () => {
      const canManage = await canManageUser(viewerUserId, memberUserId, testOrgId);
      expect(canManage).toBe(false);
    });

    it('should return false for non-existent user', async () => {
      const canManage = await canManageUser(ownerUserId, 'non-existent-user', testOrgId);
      expect(canManage).toBe(false);
    });

    it('should return false for user not in organization', async () => {
      const otherOrg = await createTestOrganization('Other Org');
      const otherUser = await createTestUser(`other-${Date.now()}@example.com`);
      await linkUserToOrganization(otherUser.id, otherOrg.id, 'member');
      
      const canManage = await canManageUser(ownerUserId, otherUser.id, testOrgId);
      expect(canManage).toBe(false);
    });
  });

  describe('requireRole Middleware', () => {
    // Mock request/response objects for middleware testing
    const createMockRequest = (userId: string, orgId?: number, projectId?: number) => {
      return {
        user: { id: userId },
        params: {
          orgId: orgId?.toString(),
          id: projectId?.toString(),
        },
      } as any as Request;
    };

    const createMockResponse = () => {
      const res = {} as Response;
      res.status = vi.fn().mockReturnValue(res);
      res.json = vi.fn().mockReturnValue(res);
      return res;
    };

    const createMockNext = () => {
      return vi.fn() as NextFunction;
    };

    it('should allow owner to access owner-required route', async () => {
      const req = createMockRequest(ownerUserId, testOrgId);
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = requireRole('owner');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow owner to access admin-required route', async () => {
      const req = createMockRequest(ownerUserId, testOrgId);
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = requireRole('admin');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow admin to access admin-required route', async () => {
      const req = createMockRequest(adminUserId, testOrgId);
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = requireRole('admin');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should NOT allow admin to access owner-required route', async () => {
      const req = createMockRequest(adminUserId, testOrgId);
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = requireRole('owner');
      await middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should NOT allow member to access admin-required route', async () => {
      const req = createMockRequest(memberUserId, testOrgId);
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = requireRole('admin');
      await middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should NOT allow viewer to access member-required route', async () => {
      const req = createMockRequest(viewerUserId, testOrgId);
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = requireRole('member');
      await middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should return 401 for unauthenticated user', async () => {
      const req = createMockRequest('', testOrgId);
      req.user = undefined;
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = requireRole('viewer');
      await middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should resolve organization from project ID', async () => {
      const req = createMockRequest(ownerUserId, undefined, testProjectId);
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = requireRole('owner');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.userRole).toBe('owner');
    });

    it('should return 400 when organization context is missing', async () => {
      const req = createMockRequest(ownerUserId);
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = requireRole('owner');
      await middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 403 when user is not in organization', async () => {
      const otherOrg = await createTestOrganization('Other Org');
      const otherUser = await createTestUser(`other-${Date.now()}@example.com`);
      await linkUserToOrganization(otherUser.id, otherOrg.id, 'owner');

      const req = createMockRequest(otherUser.id, testOrgId);
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = requireRole('viewer');
      await middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });
});
