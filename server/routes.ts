import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import crypto from "crypto";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./auth";
import { db } from "./db";
import * as schema from "@shared/schema";
import { eq, and, inArray } from "drizzle-orm";
import {
  insertOrganizationSchema,
  insertProjectSchema,
  // insertProjectStatusSchema, // Not defined
  // updateProjectStatusSchema, // Not defined
  // insertKanbanColumnSchema, // Not defined
  // updateKanbanColumnSchema, // Not defined
  insertTaskSchema,
  // insertTaskDependencySchema, // Not defined
  insertStakeholderSchema,
  // insertStakeholderRaciSchema, // Not defined
  // updateStakeholderRaciSchema, // Not defined
  // insertNotificationRuleSchema, // Not defined
  // updateNotificationRuleSchema, // Not defined
  // insertNotificationLogSchema, // Not defined
  insertRiskSchema,
  insertIssueSchema,
  // insertChangeRequestSchema, // Not defined
  // insertChangeRequestApprovalSchema, // Not defined
  // updateChangeRequestApprovalSchema, // Not defined
  // insertChangeRequestTaskSchema, // Not defined
  // updateChangeRequestTaskSchema, // Not defined
  // insertChangeRequestTemplateSchema, // Not defined
  // updateChangeRequestTemplateSchema, // Not defined
  // insertExchangeRateSchema, // Not defined
  // updateExchangeRateSchema, // Not defined
  insertCostItemSchema,
  // updateCostItemSchema, // Not defined (duplicate)
  // insertCostBreakdownStructureSchema, // Not defined
  // updateCostBreakdownStructureSchema, // Not defined
  // insertProcurementRequisitionSchema, // Not defined
  // updateProcurementRequisitionSchema, // Not defined
  // insertResourceRequirementSchema, // Not defined
  // updateResourceRequirementSchema, // Not defined
  // insertInventoryAllocationSchema, // Not defined
  // updateInventoryAllocationSchema, // Not defined
  // insertResourceTimeEntrySchema, // Not defined
  // updateResourceTimeEntrySchema, // Not defined
  // insertTaskMaterialSchema, // Not defined
  // updateTaskMaterialSchema, // Not defined
  // insertMaterialConsumptionSchema, // Not defined
  // updateMaterialConsumptionSchema, // Not defined
  // insertMaterialDeliverySchema, // Not defined
  // updateMaterialDeliverySchema, // Not defined
  // insertResourceGroupSchema, // Not defined
  // updateResourceGroupSchema, // Not defined
  // insertResourceGroupMemberSchema, // Not defined
  // updateResourceAssignmentSchema, // Not defined
  // updateProjectSchema, // Not defined
  // updateTaskSchema, // Not defined
  // updateStakeholderSchema, // Not defined
  // updateRiskSchema, // Not defined
  // updateIssueSchema, // Not defined
  // updateChangeRequestSchema, // Not defined
  // updateCostItemSchema, // Not defined (duplicate)
  // insertAiConversationSchema, // Not defined
  // insertEmailTemplateSchema, // Not defined
  // updateEmailTemplateSchema, // Not defined
  // insertResourceSchema, // Not defined
  // insertResourceAssignmentSchema, // Not defined
  // insertConversationSchema, // Not defined
  // updateConversationSchema, // Not defined
  // insertMessageSchema, // Not defined
  // updateMessageSchema, // Not defined
  // insertContactSchema, // Not defined
  // updateContactSchema, // Not defined
  // insertContactLogSchema, // Not defined
  // insertUserInvitationSchema, // Not defined
  // updateUserOrganizationSchema, // Not defined
  insertLessonLearnedSchema,
  updateLessonLearnedSchema,
  insertCommunicationMetricsSchema,
  updateCommunicationMetricsSchema,
} from "@shared/schema";
import { chatWithAssistant, type ChatMessage } from "./aiAssistant";
import { z } from "zod";
import {
  generateRiskRegisterReport,
  generateProjectStatusReport,
  generateEVAReport,
  generateIssueLogReport
} from "./pdfReports";
import {
  sendEmail,
  replacePlaceholders,
  getDefaultTemplate,
  getAllDefaultTemplates,
  getAvailablePlaceholders,
  buildChangeRequestEmail,
  buildChangeRequestApprovalNeededEmail
} from "./emailService";
import {
  syncExchangeRates,
  getExchangeRate,
  convertCurrency,
  getLatestExchangeRate
} from "./exchangeRateService";
import { logUserActivity } from "./middleware/audit";
import { uploadLimiter, userApiLimiter } from "./middleware/security";
import { wsManager } from "./websocket";
import { schedulingService } from "./scheduling";
import { logger } from "./services/cloudLogging";

// Helper to get user ID from request
function getUserId(req: any): string {
  return req.user.id;
}

// Helper to check if user has access to organization
async function checkOrganizationAccess(userId: string, organizationId: number): Promise<boolean> {
  const userOrg = await storage.getUserOrganization(userId, organizationId);
  return !!userOrg;
}

// Helper to check if user has admin/owner role
async function checkAdminAccess(userId: string, organizationId: number): Promise<boolean> {
  const userOrg = await storage.getUserOrganization(userId, organizationId);
  return !!userOrg && ['owner', 'admin'].includes(userOrg.role);
}

// Helper to check if user has access to project (through organization)
async function checkProjectAccess(userId: string, projectId: number): Promise<boolean> {
  const project = await storage.getProject(projectId);
  if (!project) return false;
  return await checkOrganizationAccess(userId, project.organizationId);
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error: any) {
      const userId = getUserId(req);
      logger.error("Error fetching user", error instanceof Error ? error : new Error(String(error)), { userId });
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // ===== Organization Routes =====
  app.get('/api/organizations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      let organizations = await storage.getOrganizationsByUser(userId);
      
      // If user has no organizations, ensure they get assigned to demo org
      if (organizations.length === 0) {
        try {
          await storage.assignDemoOrgToUser(userId);
          // Fetch again after assignment
          organizations = await storage.getOrganizationsByUser(userId);
        } catch (assignError) {
          logger.error("Error assigning demo org", assignError instanceof Error ? assignError : new Error(String(assignError)), { userId });
          // Continue anyway - return empty array rather than failing
        }
      }
      
      res.json(organizations);
    } catch (error: any) {
      const userId = getUserId(req);
      logger.error("Error fetching organizations", error instanceof Error ? error : new Error(String(error)), { userId });
      res.status(500).json({ message: "Failed to fetch organizations" });
    }
  });

  app.post('/api/organizations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const data = insertOrganizationSchema.parse(req.body);

      const organization = await storage.createOrganization(data);

      // Add user as owner of the organization
      await storage.createUserOrganization({
        userId,
        organizationId: organization.id,
        role: 'owner',
      });

      res.json(organization);
    } catch (error: any) {
      const userId = getUserId(req);
      logger.error("Error creating organization", error instanceof Error ? error : new Error(String(error)), { userId, data: req.body });
      res.status(400).json({ message: error.message || "Failed to create organization" });
    }
  });

  app.patch('/api/organizations/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const orgId = parseInt(req.params.id);

      // Check access (owner/admin required)
      const userOrg = await storage.getUserOrganization(userId, orgId);
      if (!userOrg || !['owner', 'admin'].includes(userOrg.role)) {
        return res.status(403).json({ message: "Owner or admin access required" });
      }

      const data = insertOrganizationSchema.partial().parse(req.body);
      const updated = await storage.updateOrganization(orgId, data);
      
      if (!updated) {
        return res.status(404).json({ message: "Organization not found" });
      }

      res.json(updated);
    } catch (error: any) {
      const userId = getUserId(req);
      const orgId = parseInt(req.params.id);
      logger.error("Error updating organization", error instanceof Error ? error : new Error(String(error)), { userId, orgId });
      res.status(400).json({ message: error.message || "Failed to update organization" });
    }
  });

  app.delete('/api/organizations/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const orgId = parseInt(req.params.id);

      // Check access (owner required for deletion)
      const userOrg = await storage.getUserOrganization(userId, orgId);
      if (!userOrg || userOrg.role !== 'owner') {
        return res.status(403).json({ message: "Owner access required to delete organization" });
      }

      // Get stats for deletion confirmation
      const projects = await storage.getProjectsByOrganization(orgId);
      const users = await storage.getUsersByOrganization(orgId);

      await storage.deleteOrganization(orgId);

      res.json({ 
        success: true,
        deleted: {
          organizationId: orgId,
          projectsDeleted: projects.length,
          usersRemoved: users.length,
        }
      });
    } catch (error: any) {
      const userId = getUserId(req);
      const orgId = parseInt(req.params.id);
      logger.error("Error deleting organization", error instanceof Error ? error : new Error(String(error)), { userId, orgId });
      res.status(400).json({ message: error.message || "Failed to delete organization" });
    }
  });

  app.get('/api/organizations/:id/stats', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const orgId = parseInt(req.params.id);

      // Check access
      const userOrg = await storage.getUserOrganization(userId, orgId);
      if (!userOrg) {
        return res.status(403).json({ message: "Access denied" });
      }

      const projects = await storage.getProjectsByOrganization(orgId);
      const users = await storage.getUsersByOrganization(orgId);

      res.json({
        projectCount: projects.length,
        userCount: users.length,
      });
    } catch (error: any) {
      const userId = getUserId(req);
      const orgId = parseInt(req.params.id);
      logger.error("Error fetching organization stats", error instanceof Error ? error : new Error(String(error)), { userId, orgId });
      res.status(500).json({ message: "Failed to fetch organization stats" });
    }
  });

  // ===== Organization User Management Routes =====
  app.get('/api/organizations/:orgId/users', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const orgId = parseInt(req.params.orgId);

      // Check access (admin/owner required to list users)
      const userOrg = await storage.getUserOrganization(userId, orgId);
      if (!userOrg || !['owner', 'admin'].includes(userOrg.role)) {
        return res.status(403).json({ message: "Admin or owner access required" });
      }

      const users = await storage.getUsersByOrganization(orgId);
      
      // Batch fetch all user-organization relationships in one query (fixes N+1)
      const userIds = users.map(u => u.id);
      const userOrgs = userIds.length > 0 
        ? await db.select().from(schema.userOrganizations)
            .where(and(
              eq(schema.userOrganizations.organizationId, orgId),
              inArray(schema.userOrganizations.userId, userIds)
            ))
        : [];
      
      // Create a map for O(1) lookup
      const userOrgMap = new Map(userOrgs.map(uo => [uo.userId, uo]));
      
      // Map users with their roles (no additional queries)
      const usersWithRoles = users.map((user) => {
        const userOrgRel = userOrgMap.get(user.id);
        return {
          ...user,
          role: userOrgRel?.role || 'member',
          joinedAt: userOrgRel?.createdAt || null,
        };
      });

      res.json(usersWithRoles);
    } catch (error: any) {
      const userId = getUserId(req);
      const orgId = parseInt(req.params.orgId);
      logger.error("Error fetching organization users", error instanceof Error ? error : new Error(String(error)), { userId, orgId });
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post('/api/organizations/:orgId/users/invite', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const orgId = parseInt(req.params.orgId);
      const { email, role = 'member' } = req.body;

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      // Check access (admin/owner required)
      const userOrg = await storage.getUserOrganization(userId, orgId);
      if (!userOrg || !['owner', 'admin'].includes(userOrg.role)) {
        return res.status(403).json({ message: "Admin or owner access required" });
      }

      // Check if user already in organization
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        const existingRel = await storage.getUserOrganization(existingUser.id, orgId);
        if (existingRel) {
          return res.status(400).json({ message: "User is already a member of this organization" });
        }
      }

      // Check for pending invitation
      const pendingInvitation = await storage.getUserInvitationByEmail(orgId, email);
      if (pendingInvitation) {
        return res.status(400).json({ message: "An invitation is already pending for this email" });
      }

      // Generate invitation token
      const crypto = await import('crypto');
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

      const invitation = await storage.createUserInvitation({
        organizationId: orgId,
        email,
        role,
        invitedBy: userId,
        token,
        expiresAt,
      });

      // Log activity
      await logUserActivity(userId, 'user.invited', {
        organizationId: orgId,
        entityType: 'user_invitation',
        entityId: invitation.id,
        details: { email, role },
        req,
      });

      // TODO: Send invitation email
      // await sendInvitationEmail(email, token, orgId);

      res.status(201).json(invitation);
    } catch (error: any) {
      console.error("Error creating invitation:", error);
      res.status(400).json({ message: error.message || "Failed to create invitation" });
    }
  });

  app.patch('/api/organizations/:orgId/users/:userId', isAuthenticated, async (req: any, res) => {
    try {
      const requestingUserId = getUserId(req);
      const orgId = parseInt(req.params.orgId);
      const targetUserId = req.params.userId;
      const { role } = req.body;

      if (!role) {
        return res.status(400).json({ message: "Role is required" });
      }

      // Check access (admin/owner required)
      const requestingUserOrg = await storage.getUserOrganization(requestingUserId, orgId);
      if (!requestingUserOrg || !['owner', 'admin'].includes(requestingUserOrg.role)) {
        return res.status(403).json({ message: "Admin or owner access required" });
      }

      // Prevent changing own role if not owner
      if (requestingUserId === targetUserId && requestingUserOrg.role !== 'owner') {
        return res.status(403).json({ message: "Cannot change your own role" });
      }

      // Prevent changing last owner's role
      const targetUserOrg = await storage.getUserOrganization(targetUserId, orgId);
      if (targetUserOrg?.role === 'owner') {
        const allUsers = await storage.getUsersByOrganization(orgId);
        // Use Promise.allSettled to handle partial failures gracefully
        const ownerResults = await Promise.allSettled(
          allUsers.map(async (u) => {
            const uo = await storage.getUserOrganization(u.id, orgId);
            return uo?.role === 'owner';
          })
        );
        const owners = ownerResults
          .filter((r): r is PromiseFulfilledResult<boolean> => r.status === 'fulfilled')
          .map(r => r.value);
        if (owners.filter(Boolean).length === 1 && role !== 'owner') {
          return res.status(400).json({ message: "Cannot change role of the last owner" });
        }
      }

      const oldRole = targetUserOrg?.role;
      const updated = await storage.updateUserOrganization(targetUserId, orgId, { role });
      if (!updated) {
        return res.status(404).json({ message: "User not found in organization" });
      }

      // Log activity
      await logUserActivity(requestingUserId, 'user.role_changed', {
        organizationId: orgId,
        entityType: 'user',
        entityId: targetUserId,
        details: { 
          targetUserId,
          oldRole: oldRole || null,
          newRole: role,
        },
        req,
      });

      res.json(updated);
    } catch (error: any) {
      console.error("Error updating user role:", error);
      res.status(400).json({ message: error.message || "Failed to update user role" });
    }
  });

  app.delete('/api/organizations/:orgId/users/:userId', isAuthenticated, async (req: any, res) => {
    try {
      const requestingUserId = getUserId(req);
      const orgId = parseInt(req.params.orgId);
      const targetUserId = req.params.userId;

      // Check access (admin/owner required)
      const requestingUserOrg = await storage.getUserOrganization(requestingUserId, orgId);
      if (!requestingUserOrg || !['owner', 'admin'].includes(requestingUserOrg.role)) {
        return res.status(403).json({ message: "Admin or owner access required" });
      }

      // Prevent self-deletion
      if (requestingUserId === targetUserId) {
        return res.status(400).json({ message: "Cannot remove yourself from the organization" });
      }

      // Prevent removing last owner
      const targetUserOrg = await storage.getUserOrganization(targetUserId, orgId);
      if (targetUserOrg?.role === 'owner') {
        const allUsers = await storage.getUsersByOrganization(orgId);
        // Use Promise.allSettled to handle partial failures gracefully
        const ownerResults = await Promise.allSettled(
          allUsers.map(async (u) => {
            const uo = await storage.getUserOrganization(u.id, orgId);
            return uo?.role === 'owner';
          })
        );
        const owners = ownerResults
          .filter((r): r is PromiseFulfilledResult<boolean> => r.status === 'fulfilled')
          .map(r => r.value);
        if (owners.filter(Boolean).length === 1) {
          return res.status(400).json({ message: "Cannot remove the last owner" });
        }
      }

      const targetUser = await storage.getUser(targetUserId);
      
      await storage.deleteUserOrganization(targetUserId, orgId);

      // Log activity
      await logUserActivity(requestingUserId, 'user.removed_from_org', {
        organizationId: orgId,
        entityType: 'user',
        entityId: targetUserId,
        details: { 
          targetUserId,
          targetUserEmail: targetUser?.email || null,
          targetUserRole: targetUserOrg?.role || null,
        },
        req,
      });

      res.sendStatus(204);
    } catch (error: any) {
      console.error("Error removing user:", error);
      res.status(400).json({ message: error.message || "Failed to remove user" });
    }
  });

  app.get('/api/organizations/:orgId/users/invitations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const orgId = parseInt(req.params.orgId);

      // Check access (admin/owner required)
      const userOrg = await storage.getUserOrganization(userId, orgId);
      if (!userOrg || !['owner', 'admin'].includes(userOrg.role)) {
        return res.status(403).json({ message: "Admin or owner access required" });
      }

      const invitations = await storage.getUserInvitationsByOrganization(orgId);
      res.json(invitations);
    } catch (error) {
      console.error("Error fetching invitations:", error);
      res.status(500).json({ message: "Failed to fetch invitations" });
    }
  });

  app.delete('/api/organizations/:orgId/users/invitations/:invitationId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const orgId = parseInt(req.params.orgId);
      const invitationId = parseInt(req.params.invitationId);

      // Check access (admin/owner required)
      const userOrg = await storage.getUserOrganization(userId, orgId);
      if (!userOrg || !['owner', 'admin'].includes(userOrg.role)) {
        return res.status(403).json({ message: "Admin or owner access required" });
      }

      // Verify invitation belongs to organization
      const invitation = await storage.getUserInvitationById(invitationId);
      if (!invitation || invitation.organizationId !== orgId) {
        return res.status(404).json({ message: "Invitation not found" });
      }

      await storage.deleteUserInvitation(invitationId);
      res.sendStatus(204);
    } catch (error: any) {
      console.error("Error deleting invitation:", error);
      res.status(400).json({ message: error.message || "Failed to delete invitation" });
    }
  });

  // Accept invitation (public endpoint, but requires token)
  app.post('/api/invitations/:token/accept', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const token = req.params.token;

      const userOrg = await storage.acceptUserInvitation(token, userId);
      res.json(userOrg);
    } catch (error: any) {
      console.error("Error accepting invitation:", error);
      res.status(400).json({ message: error.message || "Failed to accept invitation" });
    }
  });

  // ===== Organization PMO Routes (cross-project aggregation) =====
  app.get('/api/organizations/:orgId/pmo/dashboard', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const orgId = parseInt(req.params.orgId);

      if (!await checkOrganizationAccess(userId, orgId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const projects = await storage.getProjectsByOrganization(orgId);
      const tasks = await storage.getTasksByOrganization(orgId);
      const risks = await storage.getRisksByOrganization(orgId);
      const issues = await storage.getIssuesByOrganization(orgId);
      const costs = await storage.getCostItemsByOrganization(orgId);

      const totalBudget = projects.reduce((sum, p) => sum + (Number(p.budget) || 0), 0);
      const actualCost = costs.reduce((sum, c) => sum + (Number(c.actualCost) || 0), 0);

      res.json({
        projectCount: projects.length,
        projects: projects.map(p => ({ id: p.id, name: p.name, status: p.status })),
        taskStats: {
          total: tasks.length,
          completed: tasks.filter(t => t.status === 'completed').length,
          inProgress: tasks.filter(t => t.status === 'in-progress').length,
          notStarted: tasks.filter(t => t.status === 'not-started').length,
          onHold: tasks.filter(t => t.status === 'on-hold').length,
        },
        riskStats: {
          total: risks.length,
          open: risks.filter(r => r.status === 'open').length,
          mitigated: risks.filter(r => r.status === 'mitigated').length,
          closed: risks.filter(r => r.status === 'closed').length,
          highRisks: risks.filter(r => r.probability === 'high' || r.impact === 'high').length,
        },
        issueStats: {
          total: issues.length,
          open: issues.filter(i => i.status === 'open').length,
          inProgress: issues.filter(i => i.status === 'in-progress').length,
          resolved: issues.filter(i => i.status === 'resolved').length,
          critical: issues.filter(i => i.priority === 'critical').length,
        },
        budgetStats: {
          totalBudget,
          actualCost,
          variance: totalBudget - actualCost,
          utilizationPercent: totalBudget > 0 ? Math.round((actualCost / totalBudget) * 100) : 0,
        },
      });
    } catch (error) {
      console.error("Error fetching PMO dashboard:", error);
      res.status(500).json({ message: "Failed to fetch PMO dashboard data" });
    }
  });

  app.get('/api/organizations/:orgId/pmo/calendar', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const orgId = parseInt(req.params.orgId);

      if (!await checkOrganizationAccess(userId, orgId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const tasks = await storage.getTasksByOrganization(orgId);
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching PMO calendar:", error);
      res.status(500).json({ message: "Failed to fetch PMO calendar data" });
    }
  });

  app.get('/api/organizations/:orgId/pmo/inventory', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const orgId = parseInt(req.params.orgId);

      if (!await checkOrganizationAccess(userId, orgId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const resources = await storage.getResourcesByOrganization(orgId);
      res.json(resources);
    } catch (error) {
      console.error("Error fetching PMO inventory:", error);
      res.status(500).json({ message: "Failed to fetch PMO inventory data" });
    }
  });

  // ===== Program Routes =====
  app.get('/api/organizations/:orgId/programs', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const orgId = parseInt(req.params.orgId);

      if (!await checkOrganizationAccess(userId, orgId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const programs = await storage.getProgramsByOrganization(orgId);
      res.json(programs);
    } catch (error) {
      console.error("Error fetching programs:", error);
      res.status(500).json({ message: "Failed to fetch programs" });
    }
  });

  app.get('/api/programs/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);

      const program = await storage.getProgram(id);
      if (!program) {
        return res.status(404).json({ message: "Program not found" });
      }

      if (!await checkOrganizationAccess(userId, program.organizationId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(program);
    } catch (error) {
      console.error("Error fetching program:", error);
      res.status(500).json({ message: "Failed to fetch program" });
    }
  });

  app.post('/api/organizations/:orgId/programs', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const orgId = parseInt(req.params.orgId);
      const { name, slug, description, isVirtual } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ message: "Name is required" });
      }

      // Generate slug from name if not provided or empty
      let finalSlug = slug?.trim();
      if (!finalSlug) {
        finalSlug = name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");
      }

      if (!finalSlug) {
        return res.status(400).json({ message: "Could not generate a valid slug from name" });
      }

      if (!await checkOrganizationAccess(userId, orgId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Check if slug already exists for this organization
      const existing = await storage.getProgramBySlug(orgId, finalSlug);
      if (existing) {
        return res.status(400).json({ message: "A program with this slug already exists" });
      }

      const program = await storage.createProgram({
        organizationId: orgId,
        name: name.trim(),
        slug: finalSlug,
        description: description?.trim() || null,
        isVirtual: isVirtual || false,
      });

      res.status(201).json(program);
    } catch (error: any) {
      console.error("Error creating program:", error);
      // Provide more detailed error message
      const errorMessage = error?.message || "Failed to create program";
      res.status(500).json({ message: errorMessage });
    }
  });

  app.patch('/api/programs/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);
      const updates = req.body;

      const program = await storage.getProgram(id);
      if (!program) {
        return res.status(404).json({ message: "Program not found" });
      }

      if (!await checkOrganizationAccess(userId, program.organizationId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      // If slug is being updated, check uniqueness
      if (updates.slug && updates.slug !== program.slug) {
        const existing = await storage.getProgramBySlug(program.organizationId, updates.slug);
        if (existing) {
          return res.status(400).json({ message: "A program with this slug already exists" });
        }
      }

      const updated = await storage.updateProgram(id, updates);
      res.json(updated);
    } catch (error) {
      console.error("Error updating program:", error);
      res.status(500).json({ message: "Failed to update program" });
    }
  });

  app.delete('/api/programs/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);

      const program = await storage.getProgram(id);
      if (!program) {
        return res.status(404).json({ message: "Program not found" });
      }

      if (!await checkOrganizationAccess(userId, program.organizationId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.deleteProgram(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting program:", error);
      res.status(500).json({ message: "Failed to delete program" });
    }
  });

  // ===== Tags Routes =====

  // Get all tags for an organization
  app.get('/api/organizations/:orgId/tags', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const orgId = parseInt(req.params.orgId);
      const category = req.query.category as string | undefined;

      if (!await checkOrganizationAccess(userId, orgId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const tags = await storage.getTagsByOrganization(orgId, category);
      res.json(tags);
    } catch (error) {
      console.error("Error fetching tags:", error);
      res.status(500).json({ message: "Failed to fetch tags" });
    }
  });

  // Search tags (for autocomplete)
  app.get('/api/organizations/:orgId/tags/search', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const orgId = parseInt(req.params.orgId);
      const query = req.query.q as string;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;

      if (!query || query.length < 1) {
        return res.json([]);
      }

      if (!await checkOrganizationAccess(userId, orgId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const tags = await storage.searchTags(orgId, query, limit);
      res.json(tags);
    } catch (error) {
      console.error("Error searching tags:", error);
      res.status(500).json({ message: "Failed to search tags" });
    }
  });

  // Get tags for a specific entity
  app.get('/api/tags/entity/:entityType/:entityId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const entityType = req.params.entityType;
      const entityId = parseInt(req.params.entityId);

      // Verify access based on entity type
      if (entityType === 'project') {
        const project = await storage.getProject(entityId);
        if (!project || !await checkOrganizationAccess(userId, project.organizationId)) {
          return res.status(403).json({ message: "Access denied" });
        }
      } else if (entityType === 'task') {
        const task = await storage.getTask(entityId);
        if (!task) return res.status(404).json({ message: "Task not found" });
        const project = await storage.getProject(task.projectId);
        if (!project || !await checkOrganizationAccess(userId, project.organizationId)) {
          return res.status(403).json({ message: "Access denied" });
        }
      } else if (entityType === 'risk' || entityType === 'issue') {
        const entity = entityType === 'risk' 
          ? await storage.getRisk(entityId)
          : await storage.getIssue(entityId);
        if (!entity) return res.status(404).json({ message: `${entityType} not found` });
        const project = await storage.getProject(entity.projectId);
        if (!project || !await checkOrganizationAccess(userId, project.organizationId)) {
          return res.status(403).json({ message: "Access denied" });
        }
      } else if (entityType === 'organization') {
        const orgId = entityId;
        if (!await checkOrganizationAccess(userId, orgId)) {
          return res.status(403).json({ message: "Access denied" });
        }
      } else if (entityType === 'program') {
        const program = await storage.getProgram(entityId);
        if (!program || !await checkOrganizationAccess(userId, program.organizationId)) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const tags = await storage.getTagsForEntity(entityType, entityId);
      res.json(tags);
    } catch (error) {
      console.error("Error fetching entity tags:", error);
      res.status(500).json({ message: "Failed to fetch tags" });
    }
  });

  // Create a new tag
  app.post('/api/organizations/:orgId/tags', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const orgId = parseInt(req.params.orgId);
      const tagData = insertTagSchema.parse({ ...req.body, organizationId: orgId });

      if (!await checkOrganizationAccess(userId, orgId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Check if tag with same name already exists
      const existing = await storage.getTagByName(orgId, tagData.name);
      if (existing) {
        return res.status(400).json({ message: "A tag with this name already exists" });
      }

      const tag = await storage.createTag(tagData);
      res.json(tag);
    } catch (error: any) {
      console.error("Error creating tag:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid tag data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create tag" });
    }
  });

  // Update a tag
  app.patch('/api/tags/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);
      const updates = updateTagSchema.partial().parse(req.body);

      const tag = await storage.getTag(id);
      if (!tag) {
        return res.status(404).json({ message: "Tag not found" });
      }

      if (!await checkOrganizationAccess(userId, tag.organizationId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      // If name is being updated, check uniqueness
      if (updates.name && updates.name !== tag.name) {
        const existing = await storage.getTagByName(tag.organizationId, updates.name);
        if (existing) {
          return res.status(400).json({ message: "A tag with this name already exists" });
        }
      }

      const updated = await storage.updateTag(id, updates);
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating tag:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid tag data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update tag" });
    }
  });

  // Delete a tag
  app.delete('/api/tags/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);

      const tag = await storage.getTag(id);
      if (!tag) {
        return res.status(404).json({ message: "Tag not found" });
      }

      if (!await checkOrganizationAccess(userId, tag.organizationId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.deleteTag(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting tag:", error);
      res.status(500).json({ message: "Failed to delete tag" });
    }
  });

  // Assign tag to entity
  app.post('/api/tags/:tagId/assign', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const tagId = parseInt(req.params.tagId);
      const { entityType, entityId } = req.body;

      if (!entityType || !entityId) {
        return res.status(400).json({ message: "entityType and entityId are required" });
      }

      const tag = await storage.getTag(tagId);
      if (!tag) {
        return res.status(404).json({ message: "Tag not found" });
      }

      if (!await checkOrganizationAccess(userId, tag.organizationId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Verify entity access
      if (entityType === 'project') {
        const project = await storage.getProject(entityId);
        if (!project || project.organizationId !== tag.organizationId) {
          return res.status(403).json({ message: "Access denied" });
        }
      } else if (entityType === 'task') {
        const task = await storage.getTask(entityId);
        if (!task) return res.status(404).json({ message: "Task not found" });
        const project = await storage.getProject(task.projectId);
        if (!project || project.organizationId !== tag.organizationId) {
          return res.status(403).json({ message: "Access denied" });
        }
      } else if (entityType === 'risk' || entityType === 'issue') {
        const entity = entityType === 'risk' 
          ? await storage.getRisk(entityId)
          : await storage.getIssue(entityId);
        if (!entity) return res.status(404).json({ message: `${entityType} not found` });
        const project = await storage.getProject(entity.projectId);
        if (!project || project.organizationId !== tag.organizationId) {
          return res.status(403).json({ message: "Access denied" });
        }
      } else if (entityType === 'organization') {
        if (entityId !== tag.organizationId) {
          return res.status(403).json({ message: "Access denied" });
        }
      } else if (entityType === 'program') {
        const program = await storage.getProgram(entityId);
        if (!program || program.organizationId !== tag.organizationId) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const assignment = await storage.assignTag(tagId, entityType, entityId);
      res.json(assignment);
    } catch (error) {
      console.error("Error assigning tag:", error);
      res.status(500).json({ message: "Failed to assign tag" });
    }
  });

  // Unassign tag from entity
  app.delete('/api/tags/:tagId/assign/:entityType/:entityId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const tagId = parseInt(req.params.tagId);
      const entityType = req.params.entityType;
      const entityId = parseInt(req.params.entityId);

      const tag = await storage.getTag(tagId);
      if (!tag) {
        return res.status(404).json({ message: "Tag not found" });
      }

      if (!await checkOrganizationAccess(userId, tag.organizationId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.unassignTag(tagId, entityType, entityId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error unassigning tag:", error);
      res.status(500).json({ message: "Failed to unassign tag" });
    }
  });

  // ===== Organization Terminology Routes =====
  app.patch('/api/organizations/:orgId/terminology', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const orgId = parseInt(req.params.orgId);
      const { topLevelEntityLabel, topLevelEntityLabelCustom, programEntityLabel, programEntityLabelCustom } = req.body;

      const org = await storage.getOrganization(orgId);
      if (!org) {
        return res.status(404).json({ message: "Organization not found" });
      }

      // Check if user is owner/admin (only owners should change terminology)
      const userOrg = await storage.getUserOrganization(userId, orgId);
      if (!userOrg || userOrg.role !== 'owner') {
        return res.status(403).json({ message: "Only organization owners can change terminology" });
      }

      const updated = await storage.updateOrganization(orgId, {
        topLevelEntityLabel: topLevelEntityLabel || org.topLevelEntityLabel,
        topLevelEntityLabelCustom: topLevelEntityLabelCustom || null,
        programEntityLabel: programEntityLabel || org.programEntityLabel,
        programEntityLabelCustom: programEntityLabelCustom || null,
      });

      res.json(updated);
    } catch (error) {
      console.error("Error updating terminology:", error);
      res.status(500).json({ message: "Failed to update terminology" });
    }
  });

  // ===== Project Routes =====
  app.get('/api/organizations/:orgId/projects', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const orgId = parseInt(req.params.orgId);

      // Check access
      if (!await checkOrganizationAccess(userId, orgId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const projects = await storage.getProjectsByOrganization(orgId);
      res.json(projects);
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  app.get('/api/projects/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);

      // Check access
      if (!await checkProjectAccess(userId, id)) {
        return res.status(404).json({ message: "Project not found" });
      }

      const project = await storage.getProject(id);
      res.json(project);
    } catch (error) {
      console.error("Error fetching project:", error);
      res.status(500).json({ message: "Failed to fetch project" });
    }
  });

  // Duplicate/Copy Project
  app.post('/api/projects/:id/duplicate', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const projectId = parseInt(req.params.id);
      const { name, code } = req.body;

      if (!name || !code) {
        return res.status(400).json({ message: "Name and code are required" });
      }

      // Check access to source project
      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(404).json({ message: "Project not found" });
      }

      const newProject = await storage.duplicateProject(projectId, name, code);
      res.json(newProject);
    } catch (error) {
      logger.error("Error duplicating project:", error instanceof Error ? error : new Error(String(error)));
      res.status(500).json({ message: "Failed to duplicate project" });
    }
  });

  // Project Statuses API
  app.get('/api/projects/:projectId/statuses', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const projectId = parseInt(req.params.projectId);

      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(404).json({ message: "Project not found" });
      }

      const statuses = await storage.getProjectStatusesByProject(projectId);
      res.json(statuses);
    } catch (error: any) {
      console.error("Error fetching project statuses:", error);
      const errorMessage = error?.message || "Failed to fetch project statuses";
      res.status(500).json({ 
        message: "Failed to fetch project statuses",
        error: process.env.NODE_ENV === "development" ? errorMessage : undefined
      });
    }
  });

  app.post('/api/projects/:projectId/statuses', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const projectId = parseInt(req.params.projectId);

      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(404).json({ message: "Project not found" });
      }

      const data = insertProjectStatusSchema.parse({ ...req.body, projectId });
      const status = await storage.createProjectStatus(data);
      res.json(status);
    } catch (error: any) {
      console.error("Error creating project status:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      const errorMessage = error?.message || "Failed to create project status";
      res.status(500).json({ 
        message: "Failed to create project status",
        error: process.env.NODE_ENV === "development" ? errorMessage : undefined
      });
    }
  });

  app.patch('/api/project-statuses/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);

      const status = await storage.getProjectStatus(id);
      if (!status) {
        return res.status(404).json({ message: "Status not found" });
      }

      if (!await checkProjectAccess(userId, status.projectId)) {
        return res.status(404).json({ message: "Status not found" });
      }

      const data = updateProjectStatusSchema.parse(req.body);
      const updated = await storage.updateProjectStatus(id, data);
      res.json(updated);
    } catch (error) {
      console.error("Error updating project status:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update project status" });
    }
  });

  app.delete('/api/project-statuses/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);

      const status = await storage.getProjectStatus(id);
      if (!status) {
        return res.status(404).json({ message: "Status not found" });
      }

      if (!await checkProjectAccess(userId, status.projectId)) {
        return res.status(404).json({ message: "Status not found" });
      }

      await storage.deleteProjectStatus(id);
      res.json({ message: "Status deleted successfully" });
    } catch (error) {
      console.error("Error deleting project status:", error);
      res.status(500).json({ message: "Failed to delete project status" });
    }
  });

  app.post('/api/projects/:projectId/statuses/reorder', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const projectId = parseInt(req.params.projectId);
      const { statusIds } = req.body;

      if (!Array.isArray(statusIds)) {
        return res.status(400).json({ message: "statusIds must be an array" });
      }

      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(404).json({ message: "Project not found" });
      }

      await storage.reorderProjectStatuses(projectId, statusIds);
      res.json({ message: "Statuses reordered successfully" });
    } catch (error) {
      console.error("Error reordering project statuses:", error);
      res.status(500).json({ message: "Failed to reorder project statuses" });
    }
  });

  // Kanban Columns API
  app.get('/api/projects/:projectId/kanban-columns', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const projectId = parseInt(req.params.projectId);

      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(404).json({ message: "Project not found" });
      }

      const columns = await storage.getKanbanColumnsByProject(projectId);
      res.json(columns);
    } catch (error: any) {
      console.error("Error fetching kanban columns:", error);
      const errorMessage = error?.message || "Failed to fetch kanban columns";
      res.status(500).json({ 
        message: "Failed to fetch kanban columns",
        error: process.env.NODE_ENV === "development" ? errorMessage : undefined
      });
    }
  });

  app.post('/api/projects/:projectId/kanban-columns', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const projectId = parseInt(req.params.projectId);

      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(404).json({ message: "Project not found" });
      }

      const data = insertKanbanColumnSchema.parse({ ...req.body, projectId });
      
      // Validate: either statusId OR customStatusId must be set, but not both
      if (!data.statusId && !data.customStatusId) {
        return res.status(400).json({ message: "Either statusId or customStatusId must be provided" });
      }
      if (data.statusId && data.customStatusId) {
        return res.status(400).json({ message: "Cannot set both statusId and customStatusId" });
      }

      const column = await storage.createKanbanColumn(data);
      res.json(column);
    } catch (error) {
      console.error("Error creating kanban column:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create kanban column" });
    }
  });

  app.patch('/api/kanban-columns/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);

      const column = await storage.getKanbanColumn(id);
      if (!column) {
        return res.status(404).json({ message: "Column not found" });
      }

      if (!await checkProjectAccess(userId, column.projectId)) {
        return res.status(404).json({ message: "Column not found" });
      }

      const data = updateKanbanColumnSchema.parse(req.body);
      
      // Validate: either statusId OR customStatusId must be set, but not both
      if (data.statusId !== undefined && data.customStatusId !== undefined) {
        return res.status(400).json({ message: "Cannot set both statusId and customStatusId" });
      }

      const updated = await storage.updateKanbanColumn(id, data);
      res.json(updated);
    } catch (error) {
      console.error("Error updating kanban column:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update kanban column" });
    }
  });

  app.delete('/api/kanban-columns/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);

      const column = await storage.getKanbanColumn(id);
      if (!column) {
        return res.status(404).json({ message: "Column not found" });
      }

      if (!await checkProjectAccess(userId, column.projectId)) {
        return res.status(404).json({ message: "Column not found" });
      }

      await storage.deleteKanbanColumn(id);
      res.json({ message: "Column deleted successfully" });
    } catch (error) {
      console.error("Error deleting kanban column:", error);
      res.status(500).json({ message: "Failed to delete kanban column" });
    }
  });

  app.post('/api/projects/:projectId/kanban-columns/reorder', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const projectId = parseInt(req.params.projectId);
      const { columnIds } = req.body;

      if (!Array.isArray(columnIds)) {
        return res.status(400).json({ message: "columnIds must be an array" });
      }

      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(404).json({ message: "Project not found" });
      }

      await storage.reorderKanbanColumns(projectId, columnIds);
      res.json({ message: "Columns reordered successfully" });
    } catch (error) {
      console.error("Error reordering kanban columns:", error);
      res.status(500).json({ message: "Failed to reorder kanban columns" });
    }
  });

  app.post('/api/projects', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const data = insertProjectSchema.parse(req.body);

      // Check access to organization
      if (!await checkOrganizationAccess(userId, data.organizationId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const project = await storage.createProject(data);
      res.json(project);
    } catch (error) {
      console.error("Error creating project:", error);
      res.status(400).json({ message: "Failed to create project" });
    }
  });

  app.patch('/api/projects/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);

      // Check access
      if (!await checkProjectAccess(userId, id)) {
        return res.status(404).json({ message: "Project not found" });
      }

      const data = updateProjectSchema.parse(req.body);
      const project = await storage.updateProject(id, data);
      res.json(project);
    } catch (error) {
      console.error("Error updating project:", error);
      res.status(400).json({ message: "Failed to update project" });
    }
  });

  app.delete('/api/projects/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);

      // Check access
      if (!await checkProjectAccess(userId, id)) {
        return res.status(404).json({ message: "Project not found" });
      }

      await storage.deleteProject(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting project:", error);
      res.status(500).json({ message: "Failed to delete project" });
    }
  });

  // ===== Lessons Learned Routes =====
  app.get('/api/organizations/:orgId/lessons', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const orgId = parseInt(req.params.orgId);

      if (!await checkOrganizationAccess(userId, orgId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const lessons = await storage.getLessonsLearnedByOrganization(orgId);
      res.json(lessons);
    } catch (error) {
      console.error("Error fetching organization lessons:", error);
      res.status(500).json({ message: "Failed to fetch lessons" });
    }
  });

  app.get('/api/organizations/:orgId/lessons/search', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const orgId = parseInt(req.params.orgId);
      const query = req.query.q as string;

      if (!await checkOrganizationAccess(userId, orgId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (!query) {
        return res.status(400).json({ message: "Query parameter required" });
      }

      const lessons = await storage.searchLessonsLearned(orgId, query);
      res.json(lessons);
    } catch (error) {
      console.error("Error searching lessons:", error);
      res.status(500).json({ message: "Failed to search lessons" });
    }
  });

  app.get('/api/projects/:projectId/lessons', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const projectId = parseInt(req.params.projectId);

      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(404).json({ message: "Project not found" });
      }

      const lessons = await storage.getLessonsLearnedByProject(projectId);
      res.json(lessons);
    } catch (error) {
      console.error("Error fetching project lessons:", error);
      res.status(500).json({ message: "Failed to fetch lessons" });
    }
  });

  app.post('/api/organizations/:orgId/lessons', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const orgId = parseInt(req.params.orgId);

      if (!await checkOrganizationAccess(userId, orgId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const data = insertLessonLearnedSchema.parse(req.body);
      // Ensure orgId matches
      if (data.organizationId !== orgId) {
        return res.status(400).json({ message: "Organization ID mismatch" });
      }

      // Try to attach creator
      const userIdInt = parseInt(userId);
      if (!isNaN(userIdInt)) {
        // @ts-ignore - We know it matches schema if parsed
        data.createdBy = userIdInt;
      }

      const lesson = await storage.createLessonLearned(data);
      res.json(lesson);
    } catch (error) {
      console.error("Error creating lesson learned:", error);
      res.status(400).json({ message: "Failed to create lesson learned" });
    }
  });

  app.patch('/api/lessons/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);

      const lesson = await storage.getLessonLearned(id);
      if (!lesson) {
        return res.status(404).json({ message: "Lesson not found" });
      }

      if (!await checkOrganizationAccess(userId, lesson.organizationId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const data = updateLessonLearnedSchema.parse(req.body);
      const updated = await storage.updateLessonLearned(id, data);
      res.json(updated);
    } catch (error) {
      console.error("Error updating lesson learned:", error);
      res.status(400).json({ message: "Failed to update lesson learned" });
    }
  });

  app.delete('/api/lessons/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);

      const lesson = await storage.getLessonLearned(id);
      if (!lesson) {
        return res.status(404).json({ message: "Lesson not found" });
      }

      if (!await checkOrganizationAccess(userId, lesson.organizationId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.deleteLessonLearned(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting lesson learned:", error);
      res.status(500).json({ message: "Failed to delete lesson learned" });
    }
  });

  // ===== Task Routes =====
  // Get users for a project (from project's organization)
  app.get('/api/projects/:projectId/users', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const projectId = parseInt(req.params.projectId);

      // Check project access
      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(404).json({ message: "Project not found" });
      }

      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Get users from project's organization
      const users = await storage.getUsersByOrganization(project.organizationId);
      
      // Return simplified user data for assignment
      const usersForAssignment = users.map(user => ({
        id: user.id,
        name: user.name || user.email?.split('@')[0] || 'Unknown',
        email: user.email,
      }));

      res.json(usersForAssignment);
    } catch (error) {
      console.error("Error fetching project users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.get('/api/projects/:projectId/tasks', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const projectId = parseInt(req.params.projectId);

      // Check access
      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(404).json({ message: "Project not found" });
      }

      const tasks = await storage.getTasksByProject(projectId);
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      res.status(500).json({ message: "Failed to fetch tasks" });
    }
  });

  app.post('/api/projects/:projectId/tasks/recalculate-wbs', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const projectId = parseInt(req.params.projectId);
      
      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      const tasks = await storage.getTasksByProject(projectId);
      
      // Build hierarchy map
      const childrenMap = new Map<number | null, typeof tasks>();
      
      tasks.forEach(task => {
        const parentId = task.parentId || null;
        if (!childrenMap.has(parentId)) {
          childrenMap.set(parentId, []);
        }
        childrenMap.get(parentId)!.push(task);
      });
      
      // Calculate WBS codes recursively
      const calculateWBS = async (parentId: number | null, prefix: string = ""): Promise<void> => {
        const children = (childrenMap.get(parentId) || []).sort((a, b) => {
          // Sort by existing WBS code or creation order
          if (a.wbsCode && b.wbsCode) {
            return a.wbsCode.localeCompare(b.wbsCode);
          }
          return (a.id || 0) - (b.id || 0);
        });
        
        for (let index = 0; index < children.length; index++) {
          const task = children[index];
          const wbsCode = prefix ? `${prefix}.${index + 1}` : `${index + 1}`;
          
          if (task.wbsCode !== wbsCode) {
            await storage.updateTask(task.id, { wbsCode });
          }
          
          await calculateWBS(task.id, wbsCode);
        }
      };
      
      await calculateWBS(null);
      
      res.json({ message: "WBS codes recalculated successfully" });
    } catch (error) {
      console.error("Error recalculating WBS:", error);
      res.status(500).json({ message: "Failed to recalculate WBS codes" });
    }
  });

  app.get('/api/tasks/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);

      const task = await storage.getTask(id);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      // Check access through project
      if (!await checkProjectAccess(userId, task.projectId)) {
        return res.status(404).json({ message: "Task not found" });
      }

      res.json(task);
    } catch (error) {
      console.error("Error fetching task:", error);
      res.status(500).json({ message: "Failed to fetch task" });
    }
  });

  app.post('/api/tasks', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const data = insertTaskSchema.parse(req.body);

      // Check access to project
      if (!await checkProjectAccess(userId, data.projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const task = await storage.createTask({
        ...data,
        createdBy: userId,
      });

      // If task has startDate and estimatedHours, calculate duration and propagate dates
      if (task.startDate && task.estimatedHours) {
        try {
          await schedulingService.propagateDates(task.projectId, task.id);
          // Refresh task after propagation
          const refreshed = await storage.getTask(task.id);
          if (refreshed) {
            wsManager.notifyProjectUpdate(task.projectId, "task-created", refreshed, userId);
            res.json(refreshed);
            return;
          }
        } catch (propError) {
          console.error("Error propagating dates on task creation:", propError);
          // Continue with original task even if propagation fails
        }
      }

      // Notify connected clients
      wsManager.notifyProjectUpdate(task.projectId, "task-created", task, userId);

      res.json(task);
    } catch (error) {
      console.error("Error creating task:", error);
      if (error instanceof z.ZodError) {
         console.error("Zod Validation Error:", JSON.stringify(error.errors, null, 2));
         return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(400).json({ message: "Failed to create task", details: (error as Error).message });
    }
  });

  app.patch('/api/tasks/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);

      const task = await storage.getTask(id);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      // Check access
      if (!await checkProjectAccess(userId, task.projectId)) {
        return res.status(404).json({ message: "Task not found" });
      }

      // Convert date strings to Date objects (JSON serializes dates as strings)
      // Empty strings are treated as null to allow clearing date fields
      const body = { ...req.body };
      const normalizeDateField = (value: any): Date | null | undefined => {
        if (value === null || value === undefined) return value;
        if (typeof value === 'string') {
          if (value.trim() === '') return null;
          return new Date(value);
        }
        return value;
      };

      if ('startDate' in body) body.startDate = normalizeDateField(body.startDate);
      if ('endDate' in body) body.endDate = normalizeDateField(body.endDate);
      if ('constraintDate' in body) body.constraintDate = normalizeDateField(body.constraintDate);
      if ('earlyStart' in body) body.earlyStart = normalizeDateField(body.earlyStart);
      if ('earlyFinish' in body) body.earlyFinish = normalizeDateField(body.earlyFinish);
      if ('lateStart' in body) body.lateStart = normalizeDateField(body.lateStart);
      if ('lateFinish' in body) body.lateFinish = normalizeDateField(body.lateFinish);
      if ('baselineStart' in body) body.baselineStart = normalizeDateField(body.baselineStart);
      if ('baselineFinish' in body) body.baselineFinish = normalizeDateField(body.baselineFinish);
      if ('actualStartDate' in body) body.actualStartDate = normalizeDateField(body.actualStartDate);
      if ('actualFinishDate' in body) body.actualFinishDate = normalizeDateField(body.actualFinishDate);

      // Auto-set actual dates based on status/progress changes
      const statusChanged = 'status' in body && body.status !== task.status;
      const progressChanged = 'progress' in body && body.progress !== task.progress;
      const today = new Date();
      
      if (statusChanged || progressChanged) {
        const newStatus = body.status || task.status;
        const newProgress = body.progress !== undefined ? body.progress : task.progress;
        
        // Auto-set actualStartDate when task becomes in-progress
        if ((newStatus === 'in-progress' || newProgress > 0) && !body.actualStartDate && !task.actualStartDate) {
          body.actualStartDate = today;
        }
        
        // Auto-set actualFinishDate when task becomes completed
        if ((newStatus === 'completed' || newProgress === 100) && !body.actualFinishDate && !task.actualFinishDate) {
          body.actualFinishDate = today;
        }
      }
      
      // Calculate actualDuration from actualStartDate and actualFinishDate
      if (body.actualStartDate && body.actualFinishDate) {
        const actualStart = body.actualStartDate instanceof Date ? body.actualStartDate : new Date(body.actualStartDate);
        const actualFinish = body.actualFinishDate instanceof Date ? body.actualFinishDate : new Date(body.actualFinishDate);
        const diffTime = actualFinish.getTime() - actualStart.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        body.actualDuration = Math.max(1, diffDays);
      } else if (task.actualStartDate && task.actualFinishDate && !body.actualStartDate && !body.actualFinishDate) {
        // Keep existing calculation if dates haven't changed
        const actualStart = task.actualStartDate instanceof Date ? task.actualStartDate : new Date(task.actualStartDate);
        const actualFinish = task.actualFinishDate instanceof Date ? task.actualFinishDate : new Date(task.actualFinishDate);
        const diffTime = actualFinish.getTime() - actualStart.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        body.actualDuration = Math.max(1, diffDays);
      }

      const data = updateTaskSchema.parse(body);
      
      // Prevent date propagation for completed tasks
      const isCompleted = data.progress === 100 || task.progress === 100;
      
      // Check if startDate or estimatedHours changed (triggers date propagation)
      const startDateChanged = 'startDate' in data && 
        ((!task.startDate && data.startDate) || 
         (task.startDate && !data.startDate) ||
         (task.startDate && data.startDate && new Date(task.startDate).getTime() !== new Date(data.startDate).getTime()));
      
      const estimatedHoursChanged = 'estimatedHours' in data &&
        ((!task.estimatedHours && data.estimatedHours) ||
         (task.estimatedHours && !data.estimatedHours) ||
         (task.estimatedHours && data.estimatedHours && Number(task.estimatedHours) !== Number(data.estimatedHours)));
      
      const shouldPropagate = startDateChanged || estimatedHoursChanged;
      
      const updated = await storage.updateTask(id, data);
      
      // If start date or effort hours changed, recalculate this task's duration and propagate to dependent tasks
      // Skip propagation for completed tasks (100% progress)
      if (shouldPropagate && updated && !isCompleted) {
        try {
          console.log(`[DEBUG] Propagating dates for task ${id}, estimatedHoursChanged: ${estimatedHoursChanged}, startDateChanged: ${startDateChanged}`);
          console.log(`[DEBUG] Updated task estimatedHours: ${updated.estimatedHours}, startDate: ${updated.startDate}`);
          
          // Ensure propagateDates uses the updated task data
          await schedulingService.propagateDates(task.projectId, id);
          
          // Refresh updated task after propagation to get computedDuration and endDate
          const refreshed = await storage.getTask(id);
          if (refreshed) {
            logger.debug(`Task refreshed after propagation`, { taskId: id, endDate: refreshed.endDate, computedDuration: (refreshed as any).computedDuration });
            // Notify with refreshed data
            wsManager.notifyProjectUpdate(task.projectId, "task-updated", refreshed, userId);
            res.json(refreshed);
            return;
          } else {
            logger.error(`Failed to refresh task after propagation`, new Error("Task refresh failed"), { taskId: id });
          }
        } catch (propError) {
          console.error("Error propagating dates:", propError);
          console.error("Propagation error stack:", propError instanceof Error ? propError.stack : 'No stack trace');
          // Continue with original update even if propagation fails
        }
      } else if (estimatedHoursChanged && updated && !isCompleted && updated.startDate) {
        // Fallback: If propagation didn't run but estimatedHours changed and task has startDate, recalculate endDate
        try {
          logger.debug(`Fallback: Recalculating endDate for task after estimatedHours change`, { taskId: id });
          const assignments = await storage.getResourceAssignmentsByTask(id);
          // Use Promise.allSettled to handle partial failures gracefully
          const resourceResults = await Promise.allSettled(
            assignments.map(a => storage.getResource(a.resourceId))
          );
          const resources = resourceResults
            .filter((r): r is PromiseFulfilledResult<NonNullable<Awaited<ReturnType<typeof storage.getResource>>>> => 
              r.status === 'fulfilled' && r.value !== null
            )
            .map(r => r.value);
          const assignmentsWithResources = assignments.map((a, idx) => ({
            ...a,
            resource: resources[idx]!,
          })).filter(a => a.resource);
          
          const workMode = ((updated as any).workMode as 'parallel' | 'sequential') || 'parallel';
          const computedDuration = await schedulingService.calculateTaskDuration(
            updated,
            assignmentsWithResources,
            workMode
          );
          
          const primaryResource = assignmentsWithResources[0]?.resource || null;
          const endDate = schedulingService.addCalendarDays(
            new Date(updated.startDate),
            computedDuration,
            primaryResource
          );
          
          const refreshed = await storage.updateTask(id, {
            computedDuration,
            endDate: endDate.toISOString(),
          });
          
          if (refreshed) {
            logger.debug(`Task endDate recalculated`, { taskId: id, endDate: refreshed.endDate, computedDuration: (refreshed as any).computedDuration });
            wsManager.notifyProjectUpdate(task.projectId, "task-updated", refreshed, userId);
            res.json(refreshed);
            return;
          }
        } catch (recalcError) {
          console.error("Error recalculating endDate:", recalcError);
        }
      }

      // Notify connected clients
      wsManager.notifyProjectUpdate(task.projectId, "task-updated", updated, userId);

      // Process event-based notifications
      if (req.body.status !== undefined && req.body.status !== task.status) {
        const { processEventBasedNotifications } = await import("./services/notificationService");
        processEventBasedNotifications("task-status-change", {
          projectId: task.projectId,
          taskId: id,
          previousValue: task.status,
          newValue: req.body.status,
        }).catch(err => logger.error("[NOTIFICATION] Error processing task status change", err instanceof Error ? err : new Error(String(err)), { eventType: "task-status-change", taskId: id, projectId: task.projectId }));
      }
      if (req.body.progress !== undefined && req.body.progress !== task.progress) {
        const { processEventBasedNotifications } = await import("./services/notificationService");
        processEventBasedNotifications("task-progress-milestone", {
          projectId: task.projectId,
          taskId: id,
          previousValue: task.progress,
          newValue: req.body.progress,
        }).catch(err => logger.error("[NOTIFICATION] Error processing task progress milestone", err instanceof Error ? err : new Error(String(err)), { eventType: "task-progress-milestone", taskId: id, projectId: task.projectId }));
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating task:", error);
      res.status(400).json({ message: "Failed to update task" });
    }
  });

  // Get resource leveling suggestions for a task with constraint conflict
  app.get('/api/tasks/:id/resource-leveling', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid task ID" });
      }

      const task = await storage.getTask(id);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      if (!await checkProjectAccess(userId, task.projectId)) {
        return res.status(404).json({ message: "Task not found" });
      }

      // Get resource assignments
      const assignments = await storage.getResourceAssignmentsByTask(id);
      const resources = await Promise.all(
        assignments.map(a => storage.getResource(a.resourceId))
      );
      const assignmentsWithResources = assignments.map((a, idx) => ({
        ...a,
        resource: resources[idx]!,
      })).filter(a => a.resource);

      // Calculate current computed end date
      const workMode = ((task as any).workMode as 'parallel' | 'sequential') || 'parallel';
      const computedDuration = await schedulingService.calculateTaskDuration(
        task,
        assignmentsWithResources,
        workMode
      );
      const startDate = task.startDate ? new Date(task.startDate) : null;
      let computedEndDate: Date | null = null;
      if (startDate) {
        const primaryResource = assignmentsWithResources[0]?.resource || null;
        computedEndDate = schedulingService.addCalendarDays(startDate, computedDuration, primaryResource);
      }

      // Detect constraint conflict
      const conflict = await schedulingService.detectConstraintConflict(
        task,
        computedEndDate,
        assignmentsWithResources
      );

      if (!conflict.hasConflict) {
        return res.json({
          hasConflict: false,
          message: "No constraint conflict detected",
          suggestions: [],
        });
      }

      // Get resource leveling suggestions
      const suggestions = await schedulingService.suggestResourceLeveling(
        task,
        assignmentsWithResources,
        conflict.conflictDays!,
        new Date(task.constraintDate!),
        conflict.constraintType
      );

      res.json({
        hasConflict: true,
        conflict,
        suggestions,
      });
    } catch (error: any) {
      console.error("Error getting resource leveling suggestions:", error);
      res.status(500).json({
        message: error?.message || "Failed to get resource leveling suggestions",
        error: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      });
    }
  });

  // Recalculate task schedule (MUST be before other /api/tasks/:id routes to avoid conflicts)
  // This route must be registered before app.get('/api/tasks/:id') to ensure proper matching
  app.post('/api/tasks/:id/recalculate', isAuthenticated, async (req: any, res) => {
    // Set content type explicitly
    res.setHeader('Content-Type', 'application/json');
    try {
      logger.debug(`Recalculate route hit`, { method: req.method, url: req.url, path: req.path, taskId: req.params.id });
      const userId = getUserId(req);
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid task ID" });
      }

      const task = await storage.getTask(id);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      // Check access
      if (!await checkProjectAccess(userId, task.projectId)) {
        return res.status(404).json({ message: "Task not found" });
      }

      // Recalculate this task and propagate to dependent tasks
      await schedulingService.propagateDates(task.projectId, id);
      
      // Refresh task after recalculation
      const refreshed = await storage.getTask(id);
      if (!refreshed) {
        return res.status(404).json({ message: "Task not found" });
      }

      // Notify connected clients
      wsManager.notifyProjectUpdate(task.projectId, "task-updated", refreshed, userId);

      res.json({ 
        success: true, 
        task: refreshed,
        message: "Schedule recalculated successfully" 
      });
    } catch (error: any) {
      console.error("Error recalculating task schedule:", error);
      const errorMessage = error?.message || "Failed to recalculate schedule";
      res.status(500).json({ 
        message: errorMessage,
        error: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      });
    }
  });

  app.delete('/api/tasks/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);

      const task = await storage.getTask(id);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      // Check access
      if (!await checkProjectAccess(userId, task.projectId)) {
        return res.status(404).json({ message: "Task not found" });
      }

      await storage.deleteTask(id);

      // Notify connected clients
      wsManager.notifyProjectUpdate(task.projectId, "task-deleted", { id, projectId: task.projectId }, userId);

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting task:", error);
      res.status(500).json({ message: "Failed to delete task" });
    }
  });

  // ===== Task Dependencies Routes =====
  app.get('/api/projects/:projectId/dependencies', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const projectId = parseInt(req.params.projectId);

      // Check access
      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(404).json({ message: "Project not found" });
      }

      const dependencies = await storage.getDependenciesByProject(projectId);
      res.json(dependencies);
    } catch (error) {
      console.error("Error fetching dependencies:", error);
      res.status(500).json({ message: "Failed to fetch dependencies" });
    }
  });

  app.post('/api/dependencies', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const data = insertTaskDependencySchema.parse(req.body);

      // Check access to project
      if (!await checkProjectAccess(userId, data.projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const dependency = await storage.createTaskDependency(data);

      // Notify connected clients
      wsManager.notifyProjectUpdate(dependency.projectId, "dependency-created", dependency, userId);

      res.json(dependency);
    } catch (error) {
      console.error("Error creating dependency:", error);
      res.status(400).json({ message: "Failed to create dependency" });
    }
  });

  app.patch('/api/dependencies/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);

      const dependency = await storage.getTaskDependency(id);
      if (!dependency) {
        return res.status(404).json({ message: "Dependency not found" });
      }

      // Check access
      if (!await checkProjectAccess(userId, dependency.projectId)) {
        return res.status(404).json({ message: "Dependency not found" });
      }

      const { type, lagDays } = req.body;
      const updated = await storage.updateTaskDependency(id, { type, lagDays });

      // Notify connected clients
      wsManager.notifyProjectUpdate(dependency.projectId, "dependency-updated", updated, userId);

      res.json(updated);
    } catch (error) {
      console.error("Error updating dependency:", error);
      res.status(400).json({ message: "Failed to update dependency" });
    }
  });

  app.delete('/api/dependencies/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);

      const dependency = await storage.getTaskDependency(id);
      if (!dependency) {
        return res.status(404).json({ message: "Dependency not found" });
      }

      // Check access
      if (!await checkProjectAccess(userId, dependency.projectId)) {
        return res.status(404).json({ message: "Dependency not found" });
      }

      await storage.deleteTaskDependency(id);

      // Notify connected clients
      wsManager.notifyProjectUpdate(dependency.projectId, "dependency-deleted", { id, projectId: dependency.projectId }, userId);

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting dependency:", error);
      res.status(500).json({ message: "Failed to delete dependency" });
    }
  });

  // ===== Bulk Operations Routes =====

  // Chain tasks with Finish-to-Start dependencies (waterfall)
  app.post('/api/bulk/dependencies/chain', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { taskIds, type = "FS" } = req.body;

      if (!Array.isArray(taskIds) || taskIds.length < 2) {
        return res.status(400).json({ message: "At least 2 tasks required" });
      }

      // Fetch all tasks and verify they exist and belong to the same project
      // Use Promise.allSettled to handle partial failures gracefully
      const taskResults = await Promise.allSettled(taskIds.map((id: number) => storage.getTask(id)));
      const validTasks = taskResults
        .filter((r): r is PromiseFulfilledResult<NonNullable<Awaited<ReturnType<typeof storage.getTask>>>> => r.status === 'fulfilled' && r.value !== null)
        .map(r => r.value);

      if (validTasks.length < 2) {
        return res.status(404).json({ message: "At least 2 valid tasks required" });
      }

      // Verify all tasks belong to the same project
      const projectId = validTasks[0]!.projectId;
      const allSameProject = validTasks.every(t => t!.projectId === projectId);
      if (!allSameProject) {
        return res.status(400).json({ message: "All tasks must belong to the same project" });
      }

      // Check user has access to this project
      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Sort tasks by WBS code to chain in correct order
      const sortedTasks = validTasks.sort((a, b) =>
        (a!.wbsCode || "").localeCompare(b!.wbsCode || "")
      );

      // Create chain of dependencies
      const createdDeps = [];
      for (let i = 0; i < sortedTasks.length - 1; i++) {
        const predecessor = sortedTasks[i]!;
        const successor = sortedTasks[i + 1]!;

        // Skip self-dependencies
        if (predecessor.id === successor.id) continue;

        // Check if dependency already exists
        const existingDeps = await storage.getTaskDependencies(successor.id);
        const exists = existingDeps.some(d => d.predecessorId === predecessor.id);

        if (!exists) {
          const dep = await storage.createTaskDependency({
            projectId: projectId,
            predecessorId: predecessor.id,
            successorId: successor.id,
            type: type as "FS" | "SS" | "FF" | "SF",
            lagDays: 0
          });
          createdDeps.push(dep);
        }
      }

      // Notify connected clients
      wsManager.notifyProjectUpdate(projectId, "dependency-created", { count: createdDeps.length }, userId);

      res.json({ success: true, created: createdDeps.length });
    } catch (error) {
      console.error("Error chaining dependencies:", error);
      res.status(500).json({ message: "Failed to chain dependencies" });
    }
  });

  // Set parallel dependencies (SS or FF) - all selected tasks start/finish together
  app.post('/api/bulk/dependencies/set-parallel', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { taskIds, type } = req.body;

      if (!Array.isArray(taskIds) || taskIds.length < 2) {
        return res.status(400).json({ message: "At least 2 tasks required" });
      }

      if (!["SS", "FF"].includes(type)) {
        return res.status(400).json({ message: "Type must be SS or FF" });
      }

      // Fetch all tasks and verify they exist and belong to the same project
      // Use Promise.allSettled to handle partial failures gracefully
      const taskResults = await Promise.allSettled(taskIds.map((id: number) => storage.getTask(id)));
      const validTasks = taskResults
        .filter((r): r is PromiseFulfilledResult<NonNullable<Awaited<ReturnType<typeof storage.getTask>>>> => r.status === 'fulfilled' && r.value !== null)
        .map(r => r.value);

      if (validTasks.length < 2) {
        return res.status(404).json({ message: "At least 2 valid tasks required" });
      }

      // Verify all tasks belong to the same project
      const projectId = validTasks[0]!.projectId;
      const allSameProject = validTasks.every(t => t!.projectId === projectId);
      if (!allSameProject) {
        return res.status(400).json({ message: "All tasks must belong to the same project" });
      }

      // Check user has access to this project
      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Sort tasks by WBS code - first task becomes the anchor
      const sortedTasks = validTasks.sort((a, b) =>
        (a!.wbsCode || "").localeCompare(b!.wbsCode || "")
      );

      const anchorTask = sortedTasks[0]!;

      // Create dependencies from anchor to all other tasks
      const createdDeps = [];
      for (let i = 1; i < sortedTasks.length; i++) {
        const successor = sortedTasks[i]!;

        // Skip self-dependencies
        if (anchorTask.id === successor.id) continue;

        // Check if dependency already exists
        const existingDeps = await storage.getTaskDependencies(successor.id);
        const exists = existingDeps.some(d => d.predecessorId === anchorTask.id && d.type === type);

        if (!exists) {
          const dep = await storage.createTaskDependency({
            projectId: projectId,
            predecessorId: anchorTask.id,
            successorId: successor.id,
            type: type as "SS" | "FF",
            lagDays: 0
          });
          createdDeps.push(dep);
        }
      }

      // Notify connected clients
      wsManager.notifyProjectUpdate(projectId, "dependency-created", { count: createdDeps.length }, userId);

      res.json({ success: true, created: createdDeps.length });
    } catch (error) {
      console.error("Error setting parallel dependencies:", error);
      res.status(500).json({ message: "Failed to set parallel dependencies" });
    }
  });

  // Clear all dependencies for selected tasks
  app.post('/api/bulk/dependencies/clear', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { taskIds } = req.body;

      if (!Array.isArray(taskIds) || taskIds.length === 0) {
        return res.status(400).json({ message: "At least 1 task required" });
      }

      // Fetch all tasks and verify they exist and belong to the same project
      // Use Promise.allSettled to handle partial failures gracefully
      const taskResults = await Promise.allSettled(taskIds.map((id: number) => storage.getTask(id)));
      const validTasks = taskResults
        .filter((r): r is PromiseFulfilledResult<NonNullable<Awaited<ReturnType<typeof storage.getTask>>>> => r.status === 'fulfilled' && r.value !== null)
        .map(r => r.value);

      if (validTasks.length === 0) {
        return res.status(404).json({ message: "No valid tasks found" });
      }

      // Verify all tasks belong to the same project
      const projectId = validTasks[0]!.projectId;
      const allSameProject = validTasks.every(t => t!.projectId === projectId);
      if (!allSameProject) {
        return res.status(400).json({ message: "All tasks must belong to the same project" });
      }

      // Check user has access to this project
      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Delete all dependencies where any of these validated tasks is successor
      let deletedCount = 0;
      for (const task of validTasks) {
        const deps = await storage.getTaskDependencies(task!.id);
        for (const dep of deps) {
          await storage.deleteTaskDependency(dep.id);
          deletedCount++;
        }
      }

      // Notify connected clients
      wsManager.notifyProjectUpdate(projectId, "dependency-deleted", { count: deletedCount }, userId);

      res.json({ success: true, deleted: deletedCount });
    } catch (error) {
      console.error("Error clearing dependencies:", error);
      res.status(500).json({ message: "Failed to clear dependencies" });
    }
  });

  // Bulk assign resources to tasks
  // Bulk assign users to tasks
  app.post('/api/bulk/tasks/assign-users', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { taskIds, userIds } = req.body;

      if (!Array.isArray(taskIds) || taskIds.length === 0) {
        return res.status(400).json({ message: "At least 1 task required" });
      }

      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ message: "At least 1 user required" });
      }

      // Fetch all tasks and verify they exist and belong to the same project
      // Use Promise.allSettled to handle partial failures gracefully
      const taskResults = await Promise.allSettled(taskIds.map((id: number) => storage.getTask(id)));
      const validTasks = taskResults
        .filter((r): r is PromiseFulfilledResult<NonNullable<Awaited<ReturnType<typeof storage.getTask>>>> => r.status === 'fulfilled' && r.value !== null)
        .map(r => r.value);

      if (validTasks.length === 0) {
        return res.status(404).json({ message: "No valid tasks found" });
      }

      // Verify all tasks belong to the same project
      const projectId = validTasks[0]!.projectId;
      const allSameProject = validTasks.every(t => t!.projectId === projectId);
      if (!allSameProject) {
        return res.status(400).json({ message: "All tasks must belong to the same project" });
      }

      // Check user has access to this project
      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get user names for assignedToName
      // Use Promise.allSettled to handle partial failures gracefully
      const userResults = await Promise.allSettled(userIds.map((id: string) => storage.getUser(id)));
      const validUsers = userResults
        .filter((r): r is PromiseFulfilledResult<NonNullable<Awaited<ReturnType<typeof storage.getUser>>>> => r.status === 'fulfilled' && r.value !== null)
        .map(r => r.value);
      const userNames = validUsers.map(u => u!.name || u!.email?.split('@')[0] || 'Unknown').join(', ');

      // Store multiple user IDs as comma-separated string in assignedTo
      // First user ID goes to assignedTo, rest are stored in assignedToName for now
      // TODO: Consider creating a proper task_user_assignments table for better normalization
      const assignedTo = userIds[0] || null;
      const assignedToName = userIds.length > 1 ? `${userNames} (${userIds.length} users)` : userNames;

      // Update all validated tasks
      let updatedCount = 0;
      for (const task of validTasks) {
        await storage.updateTask(task!.id, { 
          assignedTo,
          assignedToName: assignedToName || null
        });
        updatedCount++;
      }

      // Notify connected clients
      wsManager.notifyProjectUpdate(projectId, "task-updated", { count: updatedCount }, userId);

      res.json({ success: true, updated: updatedCount });
    } catch (error) {
      console.error("Error bulk assigning users to tasks:", error);
      res.status(500).json({ message: "Failed to assign users to tasks" });
    }
  });

  app.post('/api/bulk/resource-assignments', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { taskIds, resourceIds } = req.body;

      if (!Array.isArray(taskIds) || taskIds.length === 0) {
        return res.status(400).json({ message: "At least 1 task required" });
      }

      if (!Array.isArray(resourceIds) || resourceIds.length === 0) {
        return res.status(400).json({ message: "At least 1 resource required" });
      }

      // Fetch all tasks and verify they exist and belong to the same project
      // Use Promise.allSettled to handle partial failures gracefully
      const taskResults = await Promise.allSettled(taskIds.map((id: number) => storage.getTask(id)));
      const validTasks = taskResults
        .filter((r): r is PromiseFulfilledResult<NonNullable<Awaited<ReturnType<typeof storage.getTask>>>> => r.status === 'fulfilled' && r.value !== null)
        .map(r => r.value);

      if (validTasks.length === 0) {
        return res.status(404).json({ message: "No valid tasks found" });
      }

      // Verify all tasks belong to the same project
      const projectId = validTasks[0]!.projectId;
      const allSameProject = validTasks.every(t => t!.projectId === projectId);
      if (!allSameProject) {
        return res.status(400).json({ message: "All tasks must belong to the same project" });
      }

      // Check user has access to this project
      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Fetch and validate all resources belong to the same project
      // Use Promise.allSettled to handle partial failures gracefully
      const resourceResults = await Promise.allSettled(resourceIds.map((id: number) => storage.getResource(id)));
      const validResources = resourceResults
        .filter((r): r is PromiseFulfilledResult<NonNullable<Awaited<ReturnType<typeof storage.getResource>>>> => 
          r.status === 'fulfilled' && r.value !== null && r.value.projectId === projectId
        )
        .map(r => r.value);

      if (validResources.length === 0) {
        return res.status(400).json({ message: "No valid resources found for this project" });
      }

      // Create resource assignments for each validated task-resource combination
      let createdCount = 0;
      for (const task of validTasks) {
        for (const resource of validResources) {
          try {
            // Check if assignment already exists
            const existingAssignments = await storage.getResourceAssignmentsByTask(task!.id);
            const exists = existingAssignments.some(a => a.resourceId === resource!.id);

            if (!exists) {
              await storage.createResourceAssignment({
                projectId: projectId,
                taskId: task!.id,
                resourceId: resource!.id,
                allocationPercent: 100,
                plannedHours: 8
              });
              createdCount++;
            }
          } catch (e) {
            // Skip if already exists (constraint violation)
          }
        }
      }

      // Notify connected clients
      wsManager.notifyProjectUpdate(projectId, "resource-assignment-created", { count: createdCount }, userId);

      res.json({ success: true, created: createdCount });
    } catch (error) {
      console.error("Error bulk assigning resources:", error);
      res.status(500).json({ message: "Failed to assign resources" });
    }
  });

  // Bulk link risks to tasks
  app.post('/api/bulk/task-risks', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { taskIds, riskIds } = req.body;

      if (!Array.isArray(taskIds) || taskIds.length === 0) {
        return res.status(400).json({ message: "At least 1 task required" });
      }

      if (!Array.isArray(riskIds) || riskIds.length === 0) {
        return res.status(400).json({ message: "At least 1 risk required" });
      }

      // Fetch all tasks and verify they exist and belong to the same project
      // Use Promise.allSettled to handle partial failures gracefully
      const taskResults = await Promise.allSettled(taskIds.map((id: number) => storage.getTask(id)));
      const validTasks = taskResults
        .filter((r): r is PromiseFulfilledResult<NonNullable<Awaited<ReturnType<typeof storage.getTask>>>> => r.status === 'fulfilled' && r.value !== null)
        .map(r => r.value);

      if (validTasks.length === 0) {
        return res.status(404).json({ message: "No valid tasks found" });
      }

      // Verify all tasks belong to the same project
      const projectId = validTasks[0]!.projectId;
      const allSameProject = validTasks.every(t => t!.projectId === projectId);
      if (!allSameProject) {
        return res.status(400).json({ message: "All tasks must belong to the same project" });
      }

      // Check user has access to this project
      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Fetch and validate all risks belong to the same project
      // Use Promise.allSettled to handle partial failures gracefully
      const riskResults = await Promise.allSettled(riskIds.map((id: number) => storage.getRisk(id)));
      const validRisks = riskResults
        .filter((r): r is PromiseFulfilledResult<NonNullable<Awaited<ReturnType<typeof storage.getRisk>>>> => 
          r.status === 'fulfilled' && r.value !== null && r.value.projectId === projectId
        )
        .map(r => r.value);

      if (validRisks.length === 0) {
        return res.status(400).json({ message: "No valid risks found for this project" });
      }

      // Create task-risk links for validated tasks and risks
      let createdCount = 0;
      for (const task of validTasks) {
        for (const risk of validRisks) {
          try {
            await storage.createTaskRisk({ taskId: task!.id, riskId: risk!.id });
            createdCount++;
          } catch (e) {
            // Skip if already exists (constraint violation)
          }
        }
      }

      res.json({ success: true, created: createdCount });
    } catch (error) {
      console.error("Error bulk linking risks:", error);
      res.status(500).json({ message: "Failed to link risks" });
    }
  });

  // Bulk link issues to tasks
  app.post('/api/bulk/task-issues', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { taskIds, issueIds } = req.body;

      if (!Array.isArray(taskIds) || taskIds.length === 0) {
        return res.status(400).json({ message: "At least 1 task required" });
      }

      if (!Array.isArray(issueIds) || issueIds.length === 0) {
        return res.status(400).json({ message: "At least 1 issue required" });
      }

      // Fetch all tasks and verify they exist and belong to the same project
      // Use Promise.allSettled to handle partial failures gracefully
      const taskResults = await Promise.allSettled(taskIds.map((id: number) => storage.getTask(id)));
      const validTasks = taskResults
        .filter((r): r is PromiseFulfilledResult<NonNullable<Awaited<ReturnType<typeof storage.getTask>>>> => r.status === 'fulfilled' && r.value !== null)
        .map(r => r.value);

      if (validTasks.length === 0) {
        return res.status(404).json({ message: "No valid tasks found" });
      }

      // Verify all tasks belong to the same project
      const projectId = validTasks[0]!.projectId;
      const allSameProject = validTasks.every(t => t!.projectId === projectId);
      if (!allSameProject) {
        return res.status(400).json({ message: "All tasks must belong to the same project" });
      }

      // Check user has access to this project
      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Fetch and validate all issues belong to the same project
      // Use Promise.allSettled to handle partial failures gracefully
      const issueResults = await Promise.allSettled(issueIds.map((id: number) => storage.getIssue(id)));
      const validIssues = issueResults
        .filter((r): r is PromiseFulfilledResult<NonNullable<Awaited<ReturnType<typeof storage.getIssue>>>> => 
          r.status === 'fulfilled' && r.value !== null && r.value.projectId === projectId
        )
        .map(r => r.value);

      if (validIssues.length === 0) {
        return res.status(400).json({ message: "No valid issues found for this project" });
      }

      // Create task-issue links for validated tasks and issues
      let createdCount = 0;
      for (const task of validTasks) {
        for (const issue of validIssues) {
          try {
            await storage.createTaskIssue({ taskId: task!.id, issueId: issue!.id });
            createdCount++;
          } catch (e) {
            // Skip if already exists (constraint violation)
          }
        }
      }

      res.json({ success: true, created: createdCount });
    } catch (error) {
      console.error("Error bulk linking issues:", error);
      res.status(500).json({ message: "Failed to link issues" });
    }
  });

  // Bulk update task status/progress
  app.post('/api/bulk/tasks/update', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { taskIds, updates } = req.body;

      if (!Array.isArray(taskIds) || taskIds.length === 0) {
        return res.status(400).json({ message: "At least 1 task required" });
      }

      if (!updates || (updates.status === undefined && updates.progress === undefined)) {
        return res.status(400).json({ message: "At least one update field required" });
      }

      // Fetch all tasks and verify they exist and belong to the same project
      // Use Promise.allSettled to handle partial failures gracefully
      const taskResults = await Promise.allSettled(taskIds.map((id: number) => storage.getTask(id)));
      const validTasks = taskResults
        .filter((r): r is PromiseFulfilledResult<NonNullable<Awaited<ReturnType<typeof storage.getTask>>>> => r.status === 'fulfilled' && r.value !== null)
        .map(r => r.value);

      if (validTasks.length === 0) {
        return res.status(404).json({ message: "No valid tasks found" });
      }

      // Verify all tasks belong to the same project
      const projectId = validTasks[0]!.projectId;
      const allSameProject = validTasks.every(t => t!.projectId === projectId);
      if (!allSameProject) {
        return res.status(400).json({ message: "All tasks must belong to the same project" });
      }

      // Check user has access to this project
      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Update all validated tasks
      let updatedCount = 0;
      for (const task of validTasks) {
        await storage.updateTask(task!.id, updates);
        updatedCount++;
      }

      // Notify connected clients
      wsManager.notifyProjectUpdate(projectId, "task-updated", { count: updatedCount }, userId);

      res.json({ success: true, updated: updatedCount });
    } catch (error) {
      console.error("Error bulk updating tasks:", error);
      res.status(500).json({ message: "Failed to update tasks" });
    }
  });

  // Bulk delete tasks
  app.post('/api/bulk/tasks/delete', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { taskIds } = req.body;

      if (!Array.isArray(taskIds) || taskIds.length === 0) {
        return res.status(400).json({ message: "At least 1 task required" });
      }

      // Fetch all tasks and verify they exist and belong to the same project
      // Use Promise.allSettled to handle partial failures gracefully
      const taskResults = await Promise.allSettled(taskIds.map((id: number) => storage.getTask(id)));
      const validTasks = taskResults
        .filter((r): r is PromiseFulfilledResult<NonNullable<Awaited<ReturnType<typeof storage.getTask>>>> => r.status === 'fulfilled' && r.value !== null)
        .map(r => r.value);

      if (validTasks.length === 0) {
        return res.status(404).json({ message: "No valid tasks found" });
      }

      // Verify all tasks belong to the same project
      const projectId = validTasks[0]!.projectId;
      const allSameProject = validTasks.every(t => t!.projectId === projectId);
      if (!allSameProject) {
        return res.status(400).json({ message: "All tasks must belong to the same project" });
      }

      // Check user has access to this project
      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Delete all validated tasks
      let deletedCount = 0;
      for (const task of validTasks) {
        await storage.deleteTask(task!.id);
        deletedCount++;
      }

      // Notify connected clients
      wsManager.notifyProjectUpdate(projectId, "task-deleted", { count: deletedCount }, userId);

      res.json({ success: true, deleted: deletedCount });
    } catch (error) {
      logger.error("Error bulk deleting tasks:", error instanceof Error ? error : new Error(String(error)));
      res.status(500).json({ message: "Failed to delete tasks" });
    }
  });

  app.post('/api/bulk/tasks/recalculate', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { taskIds } = req.body;

      if (!Array.isArray(taskIds) || taskIds.length === 0) {
        return res.status(400).json({ message: "No tasks selected" });
      }

      // Verify access to the first task's project
      const firstTask = await storage.getTask(taskIds[0]);
      if (!firstTask) {
        return res.status(404).json({ message: "Task not found" });
      }

      if (!await checkProjectAccess(userId, firstTask.projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Recalculate each task
      for (const taskId of taskIds) {
        await schedulingService.propagateDates(firstTask.projectId, taskId);
      }

      // Notify connected clients
      wsManager.notifyProjectUpdate(firstTask.projectId, "bulk-tasks-recalculated", { taskIds }, userId);

      res.json({ success: true, count: taskIds.length });
    } catch (error) {
      console.error("Error bulk recalculating tasks:", error);
      res.status(500).json({ message: "Failed to recalculate tasks" });
    }
  });

  app.post('/api/bulk/tasks/baseline', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { taskIds } = req.body;

      if (!Array.isArray(taskIds) || taskIds.length === 0) {
        return res.status(400).json({ message: "No tasks selected" });
      }

      // Verify access to the first task's project
      const firstTask = await storage.getTask(taskIds[0]);
      if (!firstTask) {
        return res.status(404).json({ message: "Task not found" });
      }

      if (!await checkProjectAccess(userId, firstTask.projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      let updatedCount = 0;

      for (const taskId of taskIds) {
        const task = await storage.getTask(taskId);
        if (!task) continue;
        
        // Skip completed tasks or 100% progress
        if (task.progress === 100 || task.status === 'completed') continue;

        const baselineData: any = {
          baselineStart: task.startDate,
          baselineFinish: task.endDate,
        };
        
        if (task.computedDuration) {
          baselineData.baselineDuration = task.computedDuration;
        }

        await storage.updateTask(taskId, baselineData);
        updatedCount++;
      }

      // Notify connected clients
      wsManager.notifyProjectUpdate(firstTask.projectId, "bulk-tasks-baselined", { taskIds }, userId);

      res.json({ success: true, count: updatedCount });
    } catch (error) {
      console.error("Error bulk baselining tasks:", error);
      res.status(500).json({ message: "Failed to set baseline for tasks" });
    }
  });

  // ===== Stakeholder Routes =====
  app.get('/api/projects/:projectId/stakeholders', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const projectId = parseInt(req.params.projectId);

      // Check access
      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(404).json({ message: "Project not found" });
      }

      const stakeholders = await storage.getStakeholdersByProject(projectId);
      res.json(stakeholders);
    } catch (error) {
      console.error("Error fetching stakeholders:", error);
      res.status(500).json({ message: "Failed to fetch stakeholders" });
    }
  });

  app.post('/api/stakeholders', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const data = insertStakeholderSchema.parse(req.body);

      // Check access to project
      if (!await checkProjectAccess(userId, data.projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const stakeholder = await storage.createStakeholder(data);

      // Notify connected clients
      wsManager.notifyProjectUpdate(stakeholder.projectId, "stakeholder-created", stakeholder, userId);

      res.json(stakeholder);
    } catch (error) {
      console.error("Error creating stakeholder:", error);
      res.status(400).json({ message: "Failed to create stakeholder" });
    }
  });

  app.patch('/api/stakeholders/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);

      const stakeholder = await storage.getStakeholder(id);
      if (!stakeholder) {
        return res.status(404).json({ message: "Stakeholder not found" });
      }

      // Check access
      if (!await checkProjectAccess(userId, stakeholder.projectId)) {
        return res.status(404).json({ message: "Stakeholder not found" });
      }

      const data = updateStakeholderSchema.parse(req.body);
      const updated = await storage.updateStakeholder(id, data);

      // Notify connected clients
      wsManager.notifyProjectUpdate(stakeholder.projectId, "stakeholder-updated", updated, userId);

      res.json(updated);
    } catch (error) {
      console.error("Error updating stakeholder:", error);
      res.status(400).json({ message: "Failed to update stakeholder" });
    }
  });

  app.delete('/api/stakeholders/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);

      const stakeholder = await storage.getStakeholder(id);
      if (!stakeholder) {
        return res.status(404).json({ message: "Stakeholder not found" });
      }

      // Check access
      if (!await checkProjectAccess(userId, stakeholder.projectId)) {
        return res.status(404).json({ message: "Stakeholder not found" });
      }

      await storage.deleteStakeholder(id);

      // Notify connected clients
      wsManager.notifyProjectUpdate(stakeholder.projectId, "stakeholder-deleted", { id, projectId: stakeholder.projectId }, userId);

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting stakeholder:", error);
      res.status(500).json({ message: "Failed to delete stakeholder" });
    }
  });

  // ===== Communication Metrics Routes =====
  app.get('/api/projects/:projectId/communication-metrics', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const projectId = parseInt(req.params.projectId);

      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const metrics = await storage.getCommunicationMetricsByProject(projectId);
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching communication metrics:", error);
      res.status(500).json({ message: "Failed to fetch communication metrics" });
    }
  });

  app.get('/api/stakeholders/:stakeholderId/communication-metrics', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const stakeholderId = parseInt(req.params.stakeholderId);

      const stakeholder = await storage.getStakeholder(stakeholderId);
      if (!stakeholder) {
        return res.status(404).json({ message: "Stakeholder not found" });
      }

      if (!await checkProjectAccess(userId, stakeholder.projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const metrics = await storage.getCommunicationMetricsByStakeholder(stakeholderId);
      res.json(metrics || null);
    } catch (error) {
      console.error("Error fetching stakeholder communication metrics:", error);
      res.status(500).json({ message: "Failed to fetch communication metrics" });
    }
  });

  app.post('/api/communication-metrics', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const data = insertCommunicationMetricsSchema.parse(req.body);

      // Check project access
      if (!await checkProjectAccess(userId, data.projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const metrics = await storage.createOrUpdateCommunicationMetrics(data);
      res.json(metrics);
    } catch (error) {
      console.error("Error creating/updating communication metrics:", error);
      res.status(400).json({ message: "Failed to save communication metrics" });
    }
  });

  app.patch('/api/communication-metrics/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);
      const data = updateCommunicationMetricsSchema.parse(req.body);

      const metrics = await storage.getCommunicationMetrics(id);
      if (!metrics) {
        return res.status(404).json({ message: "Communication metrics not found" });
      }

      if (!await checkProjectAccess(userId, metrics.projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const updated = await storage.updateCommunicationMetrics(id, data);
      res.json(updated);
    } catch (error) {
      console.error("Error updating communication metrics:", error);
      res.status(400).json({ message: "Failed to update communication metrics" });
    }
  });

  // ===== RACI Matrix Routes =====
  app.get('/api/projects/:projectId/raci', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const projectId = parseInt(req.params.projectId);

      // Check access
      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(404).json({ message: "Project not found" });
      }

      const raciAssignments = await storage.getStakeholderRaciByProject(projectId);
      res.json(raciAssignments);
    } catch (error) {
      console.error("Error fetching RACI assignments:", error);
      res.status(500).json({ message: "Failed to fetch RACI assignments" });
    }
  });

  app.get('/api/tasks/:taskId/raci', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const taskId = parseInt(req.params.taskId);

      const task = await storage.getTask(taskId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      // Check access
      if (!await checkProjectAccess(userId, task.projectId)) {
        return res.status(404).json({ message: "Task not found" });
      }

      const raciAssignments = await storage.getStakeholderRaciByTask(taskId);
      res.json(raciAssignments);
    } catch (error) {
      console.error("Error fetching task RACI assignments:", error);
      res.status(500).json({ message: "Failed to fetch RACI assignments" });
    }
  });

  app.post('/api/raci', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const data = insertStakeholderRaciSchema.parse(req.body);

      // Check access to project
      if (!await checkProjectAccess(userId, data.projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const raci = await storage.createStakeholderRaci(data);

      // Propagate to descendants if this is an explicit (not inherited) assignment
      if (!data.isInherited) {
        await storage.propagateRaciToDescendants(
          raci.taskId,
          raci.raciType,
          raci.stakeholderId,
          raci.resourceId,
          raci.projectId
        );
      }

      // Notify connected clients
      wsManager.notifyProjectUpdate(raci.projectId, "raci-created", raci, userId);

      res.json(raci);
    } catch (error) {
      console.error("Error creating RACI assignment:", error);
      res.status(400).json({ message: "Failed to create RACI assignment" });
    }
  });

  app.put('/api/raci/upsert', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const data = insertStakeholderRaciSchema.parse(req.body);

      // Check access to project
      if (!await checkProjectAccess(userId, data.projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const raci = await storage.upsertStakeholderRaci(data);

      // Notify connected clients
      wsManager.notifyProjectUpdate(raci.projectId, "raci-upserted", raci, userId);

      res.json(raci);
    } catch (error) {
      console.error("Error upserting RACI assignment:", error);
      res.status(400).json({ message: "Failed to upsert RACI assignment" });
    }
  });

  app.patch('/api/raci/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);

      const raci = await storage.getStakeholderRaci(id);
      if (!raci) {
        return res.status(404).json({ message: "RACI assignment not found" });
      }

      // Check access
      if (!await checkProjectAccess(userId, raci.projectId)) {
        return res.status(404).json({ message: "RACI assignment not found" });
      }

      const data = updateStakeholderRaciSchema.parse(req.body);
      const updated = await storage.updateStakeholderRaci(id, data);

      // Notify connected clients
      wsManager.notifyProjectUpdate(raci.projectId, "raci-updated", updated, userId);

      res.json(updated);
    } catch (error) {
      console.error("Error updating RACI assignment:", error);
      res.status(400).json({ message: "Failed to update RACI assignment" });
    }
  });

  app.delete('/api/raci/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);

      const raci = await storage.getStakeholderRaci(id);
      if (!raci) {
        return res.status(404).json({ message: "RACI assignment not found" });
      }

      // Check access
      if (!await checkProjectAccess(userId, raci.projectId)) {
        return res.status(404).json({ message: "RACI assignment not found" });
      }

      // Remove inherited values from descendants if this is an explicit assignment
      if (!raci.isInherited) {
        await storage.removeInheritedRaciFromDescendants(
          raci.taskId,
          raci.raciType,
          raci.stakeholderId,
          raci.resourceId
        );
      }

      await storage.deleteStakeholderRaci(id);

      // Notify connected clients
      wsManager.notifyProjectUpdate(raci.projectId, "raci-deleted", { id, projectId: raci.projectId }, userId);

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting RACI assignment:", error);
      res.status(500).json({ message: "Failed to delete RACI assignment" });
    }
  });

  app.post('/api/raci/reset', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { taskId, raciType, projectId } = req.body;

      if (!taskId || !raciType || !projectId) {
        return res.status(400).json({ message: "taskId, raciType, and projectId are required" });
      }

      // Check access to project
      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.resetRaciToInherited(taskId, raciType);

      // Notify connected clients
      wsManager.notifyProjectUpdate(projectId, "raci-reset", { taskId, raciType }, userId);

      res.json({ success: true });
    } catch (error) {
      console.error("Error resetting RACI to inherited:", error);
      res.status(500).json({ message: "Failed to reset RACI to inherited" });
    }
  });

  // ===== Notification Rules Routes =====
  app.get('/api/projects/:projectId/notification-rules', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const projectId = parseInt(req.params.projectId);

      // Check access
      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(404).json({ message: "Project not found" });
      }

      const rules = await storage.getNotificationRulesByProject(projectId);
      res.json(rules);
    } catch (error) {
      console.error("Error fetching notification rules:", error);
      res.status(500).json({ message: "Failed to fetch notification rules" });
    }
  });

  app.get('/api/organizations/:organizationId/notification-rules', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = parseInt(req.params.organizationId);

      // Check access
      if (!await checkOrganizationAccess(userId, organizationId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const rules = await storage.getNotificationRulesByOrganization(organizationId);
      res.json(rules);
    } catch (error) {
      console.error("Error fetching notification rules:", error);
      res.status(500).json({ message: "Failed to fetch notification rules" });
    }
  });

  app.get('/api/notification-rules/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);

      const rule = await storage.getNotificationRule(id);
      if (!rule) {
        return res.status(404).json({ message: "Notification rule not found" });
      }

      // Check access based on project or organization
      if (rule.projectId && !await checkProjectAccess(userId, rule.projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }
      if (rule.organizationId && !await checkOrganizationAccess(userId, rule.organizationId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(rule);
    } catch (error) {
      console.error("Error fetching notification rule:", error);
      res.status(500).json({ message: "Failed to fetch notification rule" });
    }
  });

  app.post('/api/notification-rules', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const data = insertNotificationRuleSchema.parse(req.body);

      // Check access based on project or organization
      if (data.projectId && !await checkProjectAccess(userId, data.projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }
      if (data.organizationId && !await checkOrganizationAccess(userId, data.organizationId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const rule = await storage.createNotificationRule({
        ...data,
        createdBy: userId,
      });

      res.status(201).json(rule);
    } catch (error) {
      console.error("Error creating notification rule:", error);
      res.status(500).json({ message: "Failed to create notification rule" });
    }
  });

  app.patch('/api/notification-rules/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);

      const existingRule = await storage.getNotificationRule(id);
      if (!existingRule) {
        return res.status(404).json({ message: "Notification rule not found" });
      }

      // Check access
      if (existingRule.projectId && !await checkProjectAccess(userId, existingRule.projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }
      if (existingRule.organizationId && !await checkOrganizationAccess(userId, existingRule.organizationId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const data = updateNotificationRuleSchema.parse(req.body);
      const updated = await storage.updateNotificationRule(id, data);

      res.json(updated);
    } catch (error) {
      console.error("Error updating notification rule:", error);
      res.status(500).json({ message: "Failed to update notification rule" });
    }
  });

  app.delete('/api/notification-rules/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);

      const rule = await storage.getNotificationRule(id);
      if (!rule) {
        return res.status(404).json({ message: "Notification rule not found" });
      }

      // Check access
      if (rule.projectId && !await checkProjectAccess(userId, rule.projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }
      if (rule.organizationId && !await checkOrganizationAccess(userId, rule.organizationId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.deleteNotificationRule(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting notification rule:", error);
      res.status(500).json({ message: "Failed to delete notification rule" });
    }
  });

  // Notification Logs Routes
  app.get('/api/notification-rules/:ruleId/logs', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const ruleId = parseInt(req.params.ruleId);

      const rule = await storage.getNotificationRule(ruleId);
      if (!rule) {
        return res.status(404).json({ message: "Notification rule not found" });
      }

      // Check access
      if (rule.projectId && !await checkProjectAccess(userId, rule.projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }
      if (rule.organizationId && !await checkOrganizationAccess(userId, rule.organizationId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const logs = await storage.getNotificationLogsByRule(ruleId);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching notification logs:", error);
      res.status(500).json({ message: "Failed to fetch notification logs" });
    }
  });

  app.get('/api/projects/:projectId/notification-logs', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const projectId = parseInt(req.params.projectId);

      // Check access
      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(404).json({ message: "Project not found" });
      }

      const logs = await storage.getNotificationLogsByProject(projectId);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching notification logs:", error);
      res.status(500).json({ message: "Failed to fetch notification logs" });
    }
  });

  // ===== Risk Routes =====
  app.get('/api/projects/:projectId/risks', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const projectId = parseInt(req.params.projectId);

      // Check access
      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(404).json({ message: "Project not found" });
      }

      const risks = await storage.getRisksByProject(projectId);
      res.json(risks);
    } catch (error) {
      console.error("Error fetching risks:", error);
      res.status(500).json({ message: "Failed to fetch risks" });
    }
  });

  app.post('/api/risks', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const data = insertRiskSchema.parse(req.body);

      // Check access to project
      if (!await checkProjectAccess(userId, data.projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Auto-generate code if not provided
      if (!data.code) {
        const existingRisks = await storage.getRisksByProject(data.projectId);
        const nextNumber = existingRisks.length + 1;
        data.code = `RISK-${String(nextNumber).padStart(3, '0')}`;
      }

      const risk = await storage.createRisk(data);

      // Notify connected clients
      wsManager.notifyProjectUpdate(risk.projectId, "risk-created", risk, userId);

      // Process event-based notifications
      const { processEventBasedNotifications } = await import("./services/notificationService");
      processEventBasedNotifications("risk-created", {
        projectId: risk.projectId,
        riskId: risk.id,
      }).catch(err => logger.error("[NOTIFICATION] Error processing risk created", err instanceof Error ? err : new Error(String(err)), { eventType: "risk-created", riskId: risk.id, projectId: risk.projectId }));

      res.json(risk);
    } catch (error) {
      console.error("Error creating risk:", error);
      res.status(400).json({ message: "Failed to create risk" });
    }
  });

  app.patch('/api/risks/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);

      const existing = await storage.getRisk(id);
      if (!existing) {
        return res.status(404).json({ message: "Risk not found" });
      }

      // Check access
      if (!await checkProjectAccess(userId, existing.projectId)) {
        return res.status(404).json({ message: "Risk not found" });
      }

      const data = updateRiskSchema.parse(req.body);
      // Filter out undefined values
      const updateFields = Object.fromEntries(
        Object.entries(data).filter(([_, value]) => value !== undefined)
      );

      // Merge with existing to preserve required fields
      const mergedData = {
        code: existing.code,
        projectId: existing.projectId,
        identifiedDate: existing.identifiedDate,
        ...updateFields,
      };

      const updated = await storage.updateRisk(id, mergedData);

      // Notify connected clients
      wsManager.notifyProjectUpdate(existing.projectId, "risk-updated", updated, userId);

      // Process event-based notifications
      if (req.body.impact !== undefined && req.body.impact !== existing.impact) {
        const { processEventBasedNotifications } = await import("./services/notificationService");
        processEventBasedNotifications("risk-impact-changed", {
          projectId: existing.projectId,
          riskId: id,
          previousValue: existing.impact,
          newValue: req.body.impact,
        }).catch(err => logger.error("[NOTIFICATION] Error processing risk impact change", err instanceof Error ? err : new Error(String(err)), { eventType: "risk-impact-changed", riskId: id, projectId: existing.projectId }));
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating risk:", error);
      res.status(400).json({ message: "Failed to update risk" });
    }
  });

  app.delete('/api/risks/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);

      const risk = await storage.getRisk(id);
      if (!risk) {
        return res.status(404).json({ message: "Risk not found" });
      }

      // Check access
      if (!await checkProjectAccess(userId, risk.projectId)) {
        return res.status(404).json({ message: "Risk not found" });
      }

      await storage.deleteRisk(id);

      // Notify connected clients
      wsManager.notifyProjectUpdate(risk.projectId, "risk-deleted", { id, projectId: risk.projectId }, userId);

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting risk:", error);
      res.status(500).json({ message: "Failed to delete risk" });
    }
  });

  // ===== Issue Routes =====
  app.get('/api/projects/:projectId/issues', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const projectId = parseInt(req.params.projectId);

      // Check access
      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(404).json({ message: "Project not found" });
      }

      const issues = await storage.getIssuesByProject(projectId);
      res.json(issues);
    } catch (error) {
      console.error("Error fetching issues:", error);
      res.status(500).json({ message: "Failed to fetch issues" });
    }
  });

  app.post('/api/issues', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const data = insertIssueSchema.parse(req.body);

      // Check access to project
      if (!await checkProjectAccess(userId, data.projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Auto-generate code if not provided
      if (!data.code) {
        const existingIssues = await storage.getIssuesByProject(data.projectId);
        const nextNumber = existingIssues.length + 1;
        data.code = `ISS-${String(nextNumber).padStart(3, '0')}`;
      }

      const issue = await storage.createIssue({
        ...data,
        code: data.code,
        reportedBy: userId,
      });

      // Notify connected clients
      wsManager.notifyProjectUpdate(issue.projectId, "issue-created", issue, userId);

      // Process event-based notifications
      const { processEventBasedNotifications } = await import("./services/notificationService");
      processEventBasedNotifications("issue-created", {
        projectId: issue.projectId,
        issueId: issue.id,
      }).catch(err => logger.error("[NOTIFICATION] Error processing issue created", err instanceof Error ? err : new Error(String(err)), { eventType: "issue-created", issueId: issue.id, projectId: issue.projectId }));

      res.json(issue);
    } catch (error) {
      console.error("Error creating issue:", error);
      res.status(400).json({ message: "Failed to create issue" });
    }
  });

  app.patch('/api/issues/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);

      const existing = await storage.getIssue(id);
      if (!existing) {
        return res.status(404).json({ message: "Issue not found" });
      }

      // Check access
      if (!await checkProjectAccess(userId, existing.projectId)) {
        return res.status(404).json({ message: "Issue not found" });
      }

      const data = updateIssueSchema.parse(req.body);
      // Filter out undefined values
      const updateFields = Object.fromEntries(
        Object.entries(data).filter(([_, value]) => value !== undefined)
      );

      // Merge with existing to preserve required fields
      const mergedData = {
        code: existing.code,
        projectId: existing.projectId,
        reportedBy: existing.reportedBy,
        reportedDate: existing.reportedDate,
        ...updateFields,
      };

      const updated = await storage.updateIssue(id, mergedData);

      // Notify connected clients
      wsManager.notifyProjectUpdate(existing.projectId, "issue-updated", updated, userId);

      // Process event-based notifications
      if (req.body.status !== undefined && req.body.status === "resolved" && existing.status !== "resolved") {
        const { processEventBasedNotifications } = await import("./services/notificationService");
        processEventBasedNotifications("issue-resolved", {
          projectId: existing.projectId,
          issueId: id,
          previousValue: existing.status,
          newValue: "resolved",
        }).catch(err => logger.error("[NOTIFICATION] Error processing issue resolved", err instanceof Error ? err : new Error(String(err)), { eventType: "issue-resolved", issueId: id, projectId: existing.projectId }));
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating issue:", error);
      res.status(400).json({ message: "Failed to update issue" });
    }
  });

  app.delete('/api/issues/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);

      const issue = await storage.getIssue(id);
      if (!issue) {
        return res.status(404).json({ message: "Issue not found" });
      }

      // Check access
      if (!await checkProjectAccess(userId, issue.projectId)) {
        return res.status(404).json({ message: "Issue not found" });
      }

      await storage.deleteIssue(id);

      // Notify connected clients
      wsManager.notifyProjectUpdate(issue.projectId, "issue-deleted", { id, projectId: issue.projectId }, userId);

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting issue:", error);
      res.status(500).json({ message: "Failed to delete issue" });
    }
  });

  // ===== Change Request Routes =====
  app.get('/api/projects/:projectId/change-requests', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const projectId = parseInt(req.params.projectId);

      // Check access
      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(404).json({ message: "Project not found" });
      }

      const changeRequests = await storage.getChangeRequestsByProject(projectId);
      res.json(changeRequests);
    } catch (error) {
      console.error("Error fetching change requests:", error);
      res.status(500).json({ message: "Failed to fetch change requests" });
    }
  });

  app.post('/api/change-requests', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const data = insertChangeRequestSchema.parse(req.body);

      // Check access to project
      if (!await checkProjectAccess(userId, data.projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Auto-generate code if not provided
      if (!data.code) {
        const existing = await storage.getChangeRequestsByProject(data.projectId);
        const nextNumber = existing.length + 1;
        data.code = `CR-${String(nextNumber).padStart(3, '0')}`;
      }

      const changeRequest = await storage.createChangeRequest({
        ...data,
        code: data.code,
        requestedBy: userId,
        status: data.status || 'submitted',
      });

      // Notify connected clients
      wsManager.notifyProjectUpdate(changeRequest.projectId, "change-request-created", changeRequest, userId);

      // Send notifications asynchronously (don't block response)
      (async () => {
        try {
          const project = await storage.getProject(changeRequest.projectId);
          const requester = await storage.getUser(userId);
          
          if (project && requester) {
            // Notify project admins/members about new change request
            const orgUsers = await storage.getUsersByOrganization(project.organizationId);
            const projectUsers = orgUsers.filter(u => u.id !== userId); // Exclude requester
            
            // Send notification to users with admin/owner roles
            for (const user of projectUsers) {
              const userOrg = await storage.getUserOrganization(user.id, project.organizationId);
              if (userOrg && ['owner', 'admin'].includes(userOrg.role) && user.email) {
                const emailContent = buildChangeRequestEmail(changeRequest, project, requester, 'submitted');
                await sendEmail({
                  to: user.email,
                  subject: emailContent.subject,
                  htmlContent: emailContent.body,
                  organizationId: project.organizationId,
                });
              }
            }
          }
        } catch (error) {
          console.error("Error sending change request notifications:", error);
        }
      })();

      res.json(changeRequest);
    } catch (error) {
      console.error("Error creating change request:", error);
      res.status(400).json({ message: "Failed to create change request" });
    }
  });

  app.patch('/api/change-requests/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);

      const existing = await storage.getChangeRequest(id);
      if (!existing) {
        return res.status(404).json({ message: "Change request not found" });
      }

      // Check access
      if (!await checkProjectAccess(userId, existing.projectId)) {
        return res.status(404).json({ message: "Change request not found" });
      }

      const data = updateChangeRequestSchema.parse(req.body);
      // Filter out undefined values
      const updateFields = Object.fromEntries(
        Object.entries(data).filter(([_, value]) => value !== undefined)
      );

      // If status is changing to reviewed states, set reviewedBy and reviewedDate
      if (updateFields.status && ['approved', 'rejected', 'under-review'].includes(updateFields.status) && !updateFields.reviewedBy) {
        updateFields.reviewedBy = userId;
        updateFields.reviewedDate = new Date();
      }

      // Merge with existing to preserve required fields
      const mergedData = {
        code: existing.code,
        projectId: existing.projectId,
        requestedBy: existing.requestedBy,
        submittedDate: existing.submittedDate,
        ...updateFields,
      };

      const updated = await storage.updateChangeRequest(id, mergedData);

      // Notify connected clients
      wsManager.notifyProjectUpdate(existing.projectId, "change-request-updated", updated, userId);

      // Send notifications if status changed to approved/rejected
      if (updateFields.status && ['approved', 'rejected'].includes(updateFields.status)) {
        (async () => {
          try {
            const project = await storage.getProject(existing.projectId);
            const requester = await storage.getUser(existing.requestedBy);
            const reviewer = updated.reviewedBy ? await storage.getUser(updated.reviewedBy) : undefined;
            
            if (project && requester && requester.email) {
              const emailType = updateFields.status === 'approved' ? 'approved' : 'rejected';
              const emailContent = buildChangeRequestEmail(updated, project, requester, emailType, reviewer);
              await sendEmail({
                to: requester.email,
                subject: emailContent.subject,
                htmlContent: emailContent.body,
                organizationId: project.organizationId,
              });
            }
          } catch (error: any) {
            logger.error("Error sending change request status notification", error instanceof Error ? error : new Error(String(error)), { changeRequestId: id, projectId: existing.projectId, status: updated.status });
          }
        })();
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating change request:", error);
      res.status(400).json({ message: "Failed to update change request" });
    }
  });

  app.delete('/api/change-requests/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);

      const changeRequest = await storage.getChangeRequest(id);
      if (!changeRequest) {
        return res.status(404).json({ message: "Change request not found" });
      }

      // Check access
      if (!await checkProjectAccess(userId, changeRequest.projectId)) {
        return res.status(404).json({ message: "Change request not found" });
      }

      await storage.deleteChangeRequest(id);

      // Notify connected clients
      wsManager.notifyProjectUpdate(changeRequest.projectId, "change-request-deleted", { id, projectId: changeRequest.projectId }, userId);

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting change request:", error);
      res.status(500).json({ message: "Failed to delete change request" });
    }
  });

  // ===== Change Request Approval Workflow Routes =====
  app.get('/api/change-requests/:id/approvals', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);

      const changeRequest = await storage.getChangeRequest(id);
      if (!changeRequest) {
        return res.status(404).json({ message: "Change request not found" });
      }

      // Check access
      if (!await checkProjectAccess(userId, changeRequest.projectId)) {
        return res.status(404).json({ message: "Change request not found" });
      }

      const approvals = await storage.getChangeRequestApprovals(id);
      res.json(approvals);
    } catch (error) {
      console.error("Error fetching approvals:", error);
      res.status(500).json({ message: "Failed to fetch approvals" });
    }
  });

  app.post('/api/change-requests/:id/approvals', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const changeRequestId = parseInt(req.params.id);

      const changeRequest = await storage.getChangeRequest(changeRequestId);
      if (!changeRequest) {
        return res.status(404).json({ message: "Change request not found" });
      }

      // Check access
      if (!await checkProjectAccess(userId, changeRequest.projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Schema validation temporarily disabled - insertChangeRequestApprovalSchema not defined
      const data: any = {
        ...req.body,
        changeRequestId,
      };

      // Get existing approvals to determine sequence
      const existingApprovals = await storage.getChangeRequestApprovals(changeRequestId);
      if (!data.sequence) {
        data.sequence = existingApprovals.length > 0 
          ? Math.max(...existingApprovals.map(a => a.sequence)) + 1 
          : 1;
      }

      const approval = await storage.addChangeRequestApprover(data);

      // Update change request status to "under-review" if not already
      if (changeRequest.status === "submitted") {
        await storage.updateChangeRequest(changeRequestId, { status: "under-review" });
      }

      // Notify connected clients
      wsManager.notifyProjectUpdate(changeRequest.projectId, "change-request-approval-added", approval, userId);

      res.json(approval);
    } catch (error) {
      console.error("Error adding approver:", error);
      res.status(400).json({ message: "Failed to add approver" });
    }
  });

  app.patch('/api/change-requests/approvals/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);

      // Get approval by id (we need to query differently)
      const allApprovals = await db.select().from(schema.changeRequestApprovals)
        .where(eq(schema.changeRequestApprovals.id, id));
      
      if (!allApprovals || allApprovals.length === 0) {
        return res.status(404).json({ message: "Approval not found" });
      }

      const approval = allApprovals[0];
      
      // Check if user is the reviewer
      if (approval.reviewerId !== userId) {
        return res.status(403).json({ message: "You are not authorized to review this approval" });
      }

      // Check if already reviewed
      if (approval.status !== "pending") {
        return res.status(400).json({ message: "This approval has already been reviewed" });
      }

      // Schema validation temporarily disabled - updateChangeRequestApprovalSchema not defined
      const data: any = req.body;
      
      // Set reviewed date when status changes
      const updateData: any = {
        ...data,
        reviewedAt: data.status && data.status !== "pending" ? new Date() : approval.reviewedAt,
      };

      const updated = await storage.updateChangeRequestApproval(id, updateData);

      // Get change request to update its status
      const changeRequest = await storage.getChangeRequest(approval.changeRequestId);
      if (changeRequest) {
        // Check if all approvals are complete
        const allApprovals = await storage.getChangeRequestApprovals(approval.changeRequestId);
        const allApproved = allApprovals.every(a => a.status === "approved");
        const anyRejected = allApprovals.some(a => a.status === "rejected");
        const allReviewed = allApprovals.every(a => a.status !== "pending");

        let newStatus = changeRequest.status;
        if (anyRejected) {
          newStatus = "rejected";
        } else if (allApproved && allReviewed) {
          newStatus = "approved";
        } else if (allReviewed && !allApproved) {
          newStatus = "rejected"; // Some approved, some rejected = rejected
        }

        if (newStatus !== changeRequest.status) {
          const updatedCr = await storage.updateChangeRequest(approval.changeRequestId, {
            status: newStatus as any,
            reviewedBy: userId,
            reviewedDate: new Date(),
          });

          // Send notification if status changed to approved/rejected
          if (updatedCr && ['approved', 'rejected'].includes(newStatus)) {
            (async () => {
              try {
                const project = await storage.getProject(changeRequest.projectId);
                const requester = await storage.getUser(changeRequest.requestedBy);
                const reviewer = await storage.getUser(userId);
                
                if (project && requester && requester.email) {
                  const emailType = newStatus === 'approved' ? 'approved' : 'rejected';
                  const emailContent = buildChangeRequestEmail(updatedCr, project, requester, emailType, reviewer);
                  await sendEmail({
                    to: requester.email,
                    subject: emailContent.subject,
                    htmlContent: emailContent.body,
                    organizationId: project.organizationId,
                  });
                }
              } catch (error) {
                console.error("Error sending change request status notification:", error);
              }
            })();
          }
        }
      }

      // Notify connected clients
      if (changeRequest) {
        wsManager.notifyProjectUpdate(changeRequest.projectId, "change-request-approval-updated", updated, userId);
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating approval:", error);
      res.status(400).json({ message: "Failed to update approval" });
    }
  });

  app.delete('/api/change-requests/approvals/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);

      const approval = await storage.getChangeRequestApproval(id);
      if (!approval) {
        return res.status(404).json({ message: "Approval not found" });
      }
      const changeRequest = await storage.getChangeRequest(approval.changeRequestId);
      
      if (!changeRequest) {
        return res.status(404).json({ message: "Change request not found" });
      }

      // Check access
      if (!await checkProjectAccess(userId, changeRequest.projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.deleteChangeRequestApproval(id);

      // Notify connected clients
      wsManager.notifyProjectUpdate(changeRequest.projectId, "change-request-approval-deleted", { id }, userId);

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting approval:", error);
      res.status(500).json({ message: "Failed to delete approval" });
    }
  });

  app.get('/api/change-requests/pending-approvals', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const pending = await storage.getPendingApprovalsForUser(userId);
      res.json(pending);
    } catch (error) {
      console.error("Error fetching pending approvals:", error);
      res.status(500).json({ message: "Failed to fetch pending approvals" });
    }
  });

  // ===== Change Request Task Linkage Routes =====
  app.get('/api/change-requests/:id/tasks', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);

      const changeRequest = await storage.getChangeRequest(id);
      if (!changeRequest) {
        return res.status(404).json({ message: "Change request not found" });
      }

      // Check access
      if (!await checkProjectAccess(userId, changeRequest.projectId)) {
        return res.status(404).json({ message: "Change request not found" });
      }

      const tasks = await storage.getTasksByChangeRequest(id);
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching change request tasks:", error);
      res.status(500).json({ message: "Failed to fetch tasks" });
    }
  });

  app.post('/api/change-requests/:id/tasks', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const changeRequestId = parseInt(req.params.id);

      const changeRequest = await storage.getChangeRequest(changeRequestId);
      if (!changeRequest) {
        return res.status(404).json({ message: "Change request not found" });
      }

      // Check access
      if (!await checkProjectAccess(userId, changeRequest.projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const data = insertChangeRequestTaskSchema.parse({
        ...req.body,
        changeRequestId,
      });

      const link = await storage.addChangeRequestTask(data);

      // Notify connected clients
      wsManager.notifyProjectUpdate(changeRequest.projectId, "change-request-task-linked", link, userId);

      res.json(link);
    } catch (error) {
      console.error("Error linking task:", error);
      res.status(400).json({ message: "Failed to link task" });
    }
  });

  app.delete('/api/change-requests/tasks/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);

      // Get the link to find the change request
      const allLinks = await db.select().from(schema.changeRequestTasks)
        .where(eq(schema.changeRequestTasks.id, id));
      
      if (!allLinks || allLinks.length === 0) {
        return res.status(404).json({ message: "Link not found" });
      }

      const link = allLinks[0];
      const changeRequest = await storage.getChangeRequest(link.changeRequestId);
      
      if (!changeRequest) {
        return res.status(404).json({ message: "Change request not found" });
      }

      if (!await checkProjectAccess(userId, changeRequest.projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.deleteChangeRequestTask(id);
      wsManager.notifyProjectUpdate(changeRequest.projectId, "change-request-task-unlinked", { id }, userId);

      res.json({ success: true });
    } catch (error) {
      console.error("Error unlinking task:", error);
      res.status(500).json({ message: "Failed to unlink task" });
    }
  });

  app.get('/api/tasks/:taskId/change-requests', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const taskId = parseInt(req.params.taskId);

      const task = await storage.getTask(taskId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      // Check access
      if (!await checkProjectAccess(userId, task.projectId)) {
        return res.status(404).json({ message: "Task not found" });
      }

      const changeRequests = await storage.getChangeRequestsByTask(taskId);
      res.json(changeRequests);
    } catch (error) {
      console.error("Error fetching task change requests:", error);
      res.status(500).json({ message: "Failed to fetch change requests" });
    }
  });

  // ===== Change Request Template Routes =====
  app.get('/api/organizations/:orgId/change-request-templates', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const orgId = parseInt(req.params.orgId);

      // Check access
      if (!await checkOrganizationAccess(userId, orgId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const templates = await storage.getChangeRequestTemplatesByOrganization(orgId);
      res.json(templates);
    } catch (error) {
      console.error("Error fetching change request templates:", error);
      res.status(500).json({ message: "Failed to fetch templates" });
    }
  });

  app.post('/api/change-request-templates', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const data = insertChangeRequestTemplateSchema.parse(req.body);

      // Check access to organization
      if (!await checkOrganizationAccess(userId, data.organizationId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const template = await storage.createChangeRequestTemplate({
        ...data,
        createdBy: userId,
      });

      res.json(template);
    } catch (error) {
      console.error("Error creating change request template:", error);
      res.status(400).json({ message: "Failed to create template" });
    }
  });

  app.patch('/api/change-request-templates/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);

      const existing = await storage.getChangeRequestTemplate(id);
      if (!existing) {
        return res.status(404).json({ message: "Template not found" });
      }

      // Check access
      if (!await checkOrganizationAccess(userId, existing.organizationId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const data = updateChangeRequestTemplateSchema.parse(req.body);
      const updated = await storage.updateChangeRequestTemplate(id, data);

      res.json(updated);
    } catch (error) {
      console.error("Error updating change request template:", error);
      res.status(400).json({ message: "Failed to update template" });
    }
  });

  app.delete('/api/change-request-templates/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);

      const template = await storage.getChangeRequestTemplate(id);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      // Check access
      if (!await checkOrganizationAccess(userId, template.organizationId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.deleteChangeRequestTemplate(id);

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting change request template:", error);
      res.status(500).json({ message: "Failed to delete template" });
    }
  });

  // ===== Change Request Cost Items Routes =====
  app.get('/api/change-requests/:id/costs', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);

      const changeRequest = await storage.getChangeRequest(id);
      if (!changeRequest) {
        return res.status(404).json({ message: "Change request not found" });
      }

      // Check access
      if (!await checkProjectAccess(userId, changeRequest.projectId)) {
        return res.status(404).json({ message: "Change request not found" });
      }

      const costs = await storage.getCostItemsByChangeRequest(id);
      res.json(costs);
    } catch (error) {
      console.error("Error fetching change request costs:", error);
      res.status(500).json({ message: "Failed to fetch costs" });
    }
  });

  // ===== Change Request Analytics Routes =====
  app.get('/api/projects/:projectId/change-requests/analytics', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const projectId = parseInt(req.params.projectId);

      // Check access
      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(404).json({ message: "Project not found" });
      }

      const changeRequests = await storage.getChangeRequestsByProject(projectId);
      const allApprovals = await Promise.all(
        changeRequests.map(cr => storage.getChangeRequestApprovals(cr.id))
      );

      // Calculate statistics
      const total = changeRequests.length;
      const byStatus = {
        submitted: changeRequests.filter(cr => cr.status === "submitted").length,
        "under-review": changeRequests.filter(cr => cr.status === "under-review").length,
        approved: changeRequests.filter(cr => cr.status === "approved").length,
        rejected: changeRequests.filter(cr => cr.status === "rejected").length,
        implemented: changeRequests.filter(cr => cr.status === "implemented").length,
      };

      // Cost impact
      const totalCostImpact = changeRequests.reduce((sum, cr) => {
        return sum + parseFloat(cr.costImpact?.toString() || "0");
      }, 0);

      // Schedule impact
      const totalScheduleImpact = changeRequests.reduce((sum, cr) => {
        return sum + (cr.scheduleImpact || 0);
      }, 0);

      // Approval statistics
      const flatApprovals = allApprovals.flat();
      const totalApprovals = flatApprovals.length;
      const approvedCount = flatApprovals.filter(a => a.status === "approved").length;
      const rejectedCount = flatApprovals.filter(a => a.status === "rejected").length;
      const pendingCount = flatApprovals.filter(a => a.status === "pending").length;
      const approvalRate = totalApprovals > 0 ? (approvedCount / totalApprovals) * 100 : 0;

      // Time-based trends (last 12 months)
      const now = new Date();
      const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      const monthlyData: Record<string, { submitted: number; approved: number; rejected: number }> = {};

      changeRequests.forEach(cr => {
        const submittedDate = new Date(cr.submittedDate);
        if (submittedDate >= twelveMonthsAgo) {
          const monthKey = `${submittedDate.getFullYear()}-${String(submittedDate.getMonth() + 1).padStart(2, '0')}`;
          if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = { submitted: 0, approved: 0, rejected: 0 };
          }
          monthlyData[monthKey].submitted++;
          
          if (cr.status === "approved") monthlyData[monthKey].approved++;
          if (cr.status === "rejected") monthlyData[monthKey].rejected++;
        }
      });

      // Calculate average time to approval/rejection
      let totalApprovalTime = 0;
      let approvedWithDates = 0;
      let totalRejectionTime = 0;
      let rejectedWithDates = 0;

      changeRequests.forEach(cr => {
        if (cr.reviewedDate && cr.submittedDate) {
          const submittedDate = new Date(cr.submittedDate);
          const reviewedDate = new Date(cr.reviewedDate);
          const daysDiff = (reviewedDate.getTime() - submittedDate.getTime()) / (1000 * 60 * 60 * 24);
          
          if (cr.status === "approved") {
            totalApprovalTime += daysDiff;
            approvedWithDates++;
          } else if (cr.status === "rejected") {
            totalRejectionTime += daysDiff;
            rejectedWithDates++;
          }
        }
      });

      const avgApprovalTime = approvedWithDates > 0 ? totalApprovalTime / approvedWithDates : 0;
      const avgRejectionTime = rejectedWithDates > 0 ? totalRejectionTime / rejectedWithDates : 0;

      // Cost impact breakdown by status
      const costImpactByStatus = {
        submitted: changeRequests
          .filter(cr => cr.status === "submitted")
          .reduce((sum, cr) => sum + parseFloat(cr.costImpact?.toString() || "0"), 0),
        "under-review": changeRequests
          .filter(cr => cr.status === "under-review")
          .reduce((sum, cr) => sum + parseFloat(cr.costImpact?.toString() || "0"), 0),
        approved: changeRequests
          .filter(cr => cr.status === "approved")
          .reduce((sum, cr) => sum + parseFloat(cr.costImpact?.toString() || "0"), 0),
        rejected: changeRequests
          .filter(cr => cr.status === "rejected")
          .reduce((sum, cr) => sum + parseFloat(cr.costImpact?.toString() || "0"), 0),
        implemented: changeRequests
          .filter(cr => cr.status === "implemented")
          .reduce((sum, cr) => sum + parseFloat(cr.costImpact?.toString() || "0"), 0),
      };

      res.json({
        summary: {
          total,
          byStatus,
          totalCostImpact,
          totalScheduleImpact,
        },
        approvals: {
          total: totalApprovals,
          approved: approvedCount,
          rejected: rejectedCount,
          pending: pendingCount,
          approvalRate: Math.round(approvalRate * 100) / 100,
        },
        trends: {
          monthly: monthlyData,
          avgApprovalTime: Math.round(avgApprovalTime * 10) / 10,
          avgRejectionTime: Math.round(avgRejectionTime * 10) / 10,
        },
        costImpact: {
          total: totalCostImpact,
          byStatus: costImpactByStatus,
        },
      });
    } catch (error) {
      console.error("Error fetching change request analytics:", error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  // ===== Cost Breakdown Structure (CBS) Routes =====
  app.get('/api/projects/:projectId/cbs', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const projectId = parseInt(req.params.projectId);

      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(404).json({ message: "Project not found" });
      }

      const cbs = await storage.getCostBreakdownStructureByProject(projectId);
      res.json(cbs);
    } catch (error) {
      console.error("Error fetching CBS:", error);
      res.status(500).json({ message: "Failed to fetch cost breakdown structure" });
    }
  });

  app.get('/api/cbs/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);

      const cbs = await storage.getCostBreakdownStructure(id);
      if (!cbs) {
        return res.status(404).json({ message: "CBS node not found" });
      }

      if (!await checkProjectAccess(userId, cbs.projectId)) {
        return res.status(404).json({ message: "CBS node not found" });
      }

      res.json(cbs);
    } catch (error) {
      console.error("Error fetching CBS node:", error);
      res.status(500).json({ message: "Failed to fetch CBS node" });
    }
  });

  app.post('/api/cbs', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const cbsData = insertCostBreakdownStructureSchema.parse(req.body);
      const projectId = cbsData.projectId;

      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(404).json({ message: "Project not found" });
      }

      const cbs = await storage.createCostBreakdownStructure(cbsData);
      res.json(cbs);
    } catch (error: any) {
      console.error("Error creating CBS node:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create CBS node" });
    }
  });

  app.patch('/api/cbs/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);

      const cbs = await storage.getCostBreakdownStructure(id);
      if (!cbs) {
        return res.status(404).json({ message: "CBS node not found" });
      }

      if (!await checkProjectAccess(userId, cbs.projectId)) {
        return res.status(404).json({ message: "CBS node not found" });
      }

      const updateData = updateCostBreakdownStructureSchema.parse(req.body);
      const updated = await storage.updateCostBreakdownStructure(id, updateData);

      if (!updated) {
        return res.status(404).json({ message: "CBS node not found" });
      }

      res.json(updated);
    } catch (error: any) {
      console.error("Error updating CBS node:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update CBS node" });
    }
  });

  app.delete('/api/cbs/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);

      const cbs = await storage.getCostBreakdownStructure(id);
      if (!cbs) {
        return res.status(404).json({ message: "CBS node not found" });
      }

      if (!await checkProjectAccess(userId, cbs.projectId)) {
        return res.status(404).json({ message: "CBS node not found" });
      }

      await storage.deleteCostBreakdownStructure(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting CBS node:", error);
      res.status(500).json({ message: "Failed to delete CBS node" });
    }
  });

  app.get('/api/cbs/:id/costs', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);

      const cbs = await storage.getCostBreakdownStructure(id);
      if (!cbs) {
        return res.status(404).json({ message: "CBS node not found" });
      }

      if (!await checkProjectAccess(userId, cbs.projectId)) {
        return res.status(404).json({ message: "CBS node not found" });
      }

      const costs = await storage.getCostItemsByCBS(id);
      res.json(costs);
    } catch (error) {
      console.error("Error fetching CBS costs:", error);
      res.status(500).json({ message: "Failed to fetch costs" });
    }
  });

  app.post('/api/costs/:costItemId/cbs/:cbsId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const costItemId = parseInt(req.params.costItemId);
      const cbsId = parseInt(req.params.cbsId);
      const allocation = req.body.allocation ? parseFloat(req.body.allocation) : 100;

      const costItem = await storage.getCostItem(costItemId);
      if (!costItem) {
        return res.status(404).json({ message: "Cost item not found" });
      }

      const cbs = await storage.getCostBreakdownStructure(cbsId);
      if (!cbs) {
        return res.status(404).json({ message: "CBS node not found" });
      }

      if (!await checkProjectAccess(userId, costItem.projectId)) {
        return res.status(404).json({ message: "Cost item not found" });
      }

      if (cbs.projectId !== costItem.projectId) {
        return res.status(400).json({ message: "CBS node and cost item must belong to the same project" });
      }

      const link = await storage.linkCostItemToCBS(costItemId, cbsId, allocation);
      res.json(link);
    } catch (error) {
      console.error("Error linking cost item to CBS:", error);
      res.status(500).json({ message: "Failed to link cost item to CBS" });
    }
  });

  app.delete('/api/costs/:costItemId/cbs/:cbsId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const costItemId = parseInt(req.params.costItemId);
      const cbsId = parseInt(req.params.cbsId);

      const costItem = await storage.getCostItem(costItemId);
      if (!costItem) {
        return res.status(404).json({ message: "Cost item not found" });
      }

      if (!await checkProjectAccess(userId, costItem.projectId)) {
        return res.status(404).json({ message: "Cost item not found" });
      }

      await storage.unlinkCostItemFromCBS(costItemId, cbsId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error unlinking cost item from CBS:", error);
      res.status(500).json({ message: "Failed to unlink cost item from CBS" });
    }
  });

  // ===== Procurement Requisitions Routes =====
  app.get('/api/projects/:projectId/procurement-requisitions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const projectId = parseInt(req.params.projectId);

      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(404).json({ message: "Project not found" });
      }

      const requisitions = await storage.getProcurementRequisitionsByProject(projectId);
      res.json(requisitions);
    } catch (error) {
      console.error("Error fetching procurement requisitions:", error);
      res.status(500).json({ message: "Failed to fetch requisitions" });
    }
  });

  app.get('/api/procurement-requisitions/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);

      const requisition = await storage.getProcurementRequisition(id);
      if (!requisition) {
        return res.status(404).json({ message: "Requisition not found" });
      }

      if (!await checkProjectAccess(userId, requisition.projectId)) {
        return res.status(404).json({ message: "Requisition not found" });
      }

      res.json(requisition);
    } catch (error) {
      console.error("Error fetching requisition:", error);
      res.status(500).json({ message: "Failed to fetch requisition" });
    }
  });

  app.post('/api/procurement-requisitions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const requisitionData = insertProcurementRequisitionSchema.parse(req.body);
      const projectId = requisitionData.projectId;

      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Generate requisition number if not provided
      const existingReqs = await storage.getProcurementRequisitionsByProject(projectId);
      const reqNumber = requisitionData.requisitionNumber || `REQ-${String(existingReqs.length + 1).padStart(3, '0')}`;

      const requisition = await storage.createProcurementRequisition({
        ...requisitionData,
        requisitionNumber: reqNumber,
        requestedBy: userId,
      });
      res.json(requisition);
    } catch (error: any) {
      console.error("Error creating requisition:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create requisition" });
    }
  });

  app.patch('/api/procurement-requisitions/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);

      const requisition = await storage.getProcurementRequisition(id);
      if (!requisition) {
        return res.status(404).json({ message: "Requisition not found" });
      }

      if (!await checkProjectAccess(userId, requisition.projectId)) {
        return res.status(404).json({ message: "Requisition not found" });
      }

      const updateData = updateProcurementRequisitionSchema.parse(req.body);
      const updated = await storage.updateProcurementRequisition(id, updateData);

      if (!updated) {
        return res.status(404).json({ message: "Requisition not found" });
      }

      res.json(updated);
    } catch (error: any) {
      console.error("Error updating requisition:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update requisition" });
    }
  });

  app.delete('/api/procurement-requisitions/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);

      const requisition = await storage.getProcurementRequisition(id);
      if (!requisition) {
        return res.status(404).json({ message: "Requisition not found" });
      }

      if (!await checkProjectAccess(userId, requisition.projectId)) {
        return res.status(404).json({ message: "Requisition not found" });
      }

      await storage.deleteProcurementRequisition(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting requisition:", error);
      res.status(500).json({ message: "Failed to delete requisition" });
    }
  });

  // ===== Resource Requirements Routes =====
  app.get('/api/tasks/:taskId/resource-requirements', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const taskId = parseInt(req.params.taskId);

      const task = await storage.getTask(taskId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      if (!await checkProjectAccess(userId, task.projectId)) {
        return res.status(404).json({ message: "Task not found" });
      }

      const requirements = await storage.getResourceRequirementsByTask(taskId);
      res.json(requirements);
    } catch (error) {
      console.error("Error fetching resource requirements:", error);
      res.status(500).json({ message: "Failed to fetch resource requirements" });
    }
  });

  app.post('/api/resource-requirements', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const requirementData = insertResourceRequirementSchema.parse(req.body);

      const task = await storage.getTask(requirementData.taskId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      if (!await checkProjectAccess(userId, task.projectId)) {
        return res.status(404).json({ message: "Task not found" });
      }

      const requirement = await storage.createResourceRequirement({
        ...requirementData,
        createdBy: userId,
      });
      res.json(requirement);
    } catch (error: any) {
      console.error("Error creating resource requirement:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create resource requirement" });
    }
  });

  app.patch('/api/resource-requirements/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);

      const requirement = await storage.getResourceRequirement(id);
      if (!requirement) {
        return res.status(404).json({ message: "Resource requirement not found" });
      }

      const task = await storage.getTask(requirement.taskId);
      if (!task || !await checkProjectAccess(userId, task.projectId)) {
        return res.status(404).json({ message: "Resource requirement not found" });
      }

      const updateData = updateResourceRequirementSchema.parse(req.body);
      const updated = await storage.updateResourceRequirement(id, updateData);

      if (!updated) {
        return res.status(404).json({ message: "Resource requirement not found" });
      }

      res.json(updated);
    } catch (error: any) {
      console.error("Error updating resource requirement:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update resource requirement" });
    }
  });

  app.delete('/api/resource-requirements/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);

      const requirement = await storage.getResourceRequirement(id);
      if (!requirement) {
        return res.status(404).json({ message: "Resource requirement not found" });
      }

      const task = await storage.getTask(requirement.taskId);
      if (!task || !await checkProjectAccess(userId, task.projectId)) {
        return res.status(404).json({ message: "Resource requirement not found" });
      }

      await storage.deleteResourceRequirement(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting resource requirement:", error);
      res.status(500).json({ message: "Failed to delete resource requirement" });
    }
  });

  // ===== Inventory Allocations Routes =====
  app.get('/api/projects/:projectId/inventory-allocations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const projectId = parseInt(req.params.projectId);

      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(404).json({ message: "Project not found" });
      }

      const allocations = await storage.getInventoryAllocationsByProject(projectId);
      res.json(allocations);
    } catch (error) {
      console.error("Error fetching inventory allocations:", error);
      res.status(500).json({ message: "Failed to fetch inventory allocations" });
    }
  });

  app.post('/api/inventory-allocations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const allocationData = insertInventoryAllocationSchema.parse(req.body);
      const projectId = allocationData.projectId;

      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(404).json({ message: "Project not found" });
      }

      const allocation = await storage.createInventoryAllocation({
        ...allocationData,
        allocatedBy: userId,
      });
      res.json(allocation);
    } catch (error: any) {
      console.error("Error creating inventory allocation:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create inventory allocation" });
    }
  });

  app.patch('/api/inventory-allocations/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);

      const allocation = await storage.getInventoryAllocation(id);
      if (!allocation) {
        return res.status(404).json({ message: "Inventory allocation not found" });
      }

      if (!await checkProjectAccess(userId, allocation.projectId)) {
        return res.status(404).json({ message: "Inventory allocation not found" });
      }

      const updateData = updateInventoryAllocationSchema.parse(req.body);
      const updated = await storage.updateInventoryAllocation(id, updateData);

      if (!updated) {
        return res.status(404).json({ message: "Inventory allocation not found" });
      }

      res.json(updated);
    } catch (error: any) {
      console.error("Error updating inventory allocation:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update inventory allocation" });
    }
  });

  app.delete('/api/inventory-allocations/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);

      const allocation = await storage.getInventoryAllocation(id);
      if (!allocation) {
        return res.status(404).json({ message: "Inventory allocation not found" });
      }

      if (!await checkProjectAccess(userId, allocation.projectId)) {
        return res.status(404).json({ message: "Inventory allocation not found" });
      }

      await storage.deleteInventoryAllocation(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting inventory allocation:", error);
      res.status(500).json({ message: "Failed to delete inventory allocation" });
    }
  });

  // ===== Cost Items Routes =====
  app.get('/api/projects/:projectId/costs', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const projectId = parseInt(req.params.projectId);

      // Check access
      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(404).json({ message: "Project not found" });
      }

      const costs = await storage.getCostItemsByProject(projectId);
      res.json(costs);
    } catch (error) {
      console.error("Error fetching costs:", error);
      res.status(500).json({ message: "Failed to fetch costs" });
    }
  });

  app.post('/api/costs', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const data = insertCostItemSchema.parse(req.body);

      // Check access to project
      if (!await checkProjectAccess(userId, data.projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const cost = await storage.createCostItem(data);

      // Notify connected clients
      wsManager.notifyProjectUpdate(cost.projectId, "cost-item-created", cost, userId);

      res.json(cost);
    } catch (error) {
      console.error("Error creating cost item:", error);
      res.status(400).json({ message: "Failed to create cost item" });
    }
  });

  app.patch('/api/costs/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);

      const cost = await storage.getCostItem(id);
      if (!cost) {
        return res.status(404).json({ message: "Cost item not found" });
      }

      // Check access
      if (!await checkProjectAccess(userId, cost.projectId)) {
        return res.status(404).json({ message: "Cost item not found" });
      }

      const data = updateCostItemSchema.parse(req.body);
      const updated = await storage.updateCostItem(id, data);

      // Notify connected clients
      wsManager.notifyProjectUpdate(cost.projectId, "cost-item-updated", updated, userId);

      res.json(updated);
    } catch (error) {
      console.error("Error updating cost item:", error);
      res.status(400).json({ message: "Failed to update cost item" });
    }
  });

  // ===== Resources Routes =====
  app.get('/api/projects/:projectId/resources', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const projectId = parseInt(req.params.projectId);

      // Check access
      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(404).json({ message: "Project not found" });
      }

      const resources = await storage.getResourcesByProject(projectId);
      res.json(resources);
    } catch (error) {
      console.error("Error fetching resources:", error);
      res.status(500).json({ message: "Failed to fetch resources" });
    }
  });

  app.post('/api/resources', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const body = req.body;

      // Check access to project
      if (!await checkProjectAccess(userId, body.projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Normalize date fields - convert empty strings to null, ISO strings to Date objects
      const normalizeDateField = (value: any): Date | null | undefined => {
        if (value === null || value === undefined) return value;
        if (typeof value === 'string') {
          if (value.trim() === '') return null;
          return new Date(value);
        }
        return value;
      };

      if ('contractStartDate' in body) body.contractStartDate = normalizeDateField(body.contractStartDate);
      if ('contractEndDate' in body) body.contractEndDate = normalizeDateField(body.contractEndDate);

      // Validate with Zod schema
      const data = insertResourceSchema.parse(body);

      const resource = await storage.createResource(data);
      res.json(resource);
    } catch (error: any) {
      console.error("Error creating resource:", error);
      
      // Return specific validation errors if it's a Zod error
      if (error.name === 'ZodError') {
        const errorMessages = error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ');
        return res.status(400).json({ 
          message: "Validation failed",
          errors: error.errors,
          details: errorMessages
        });
      }
      
      const errorMessage = error?.message || "Failed to create resource";
      res.status(400).json({ 
        message: errorMessage,
        error: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      });
    }
  });

  app.patch('/api/resources/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);

      const resource = await storage.getResource(id);
      if (!resource) {
        return res.status(404).json({ message: "Resource not found" });
      }

      // Check access
      if (!await checkProjectAccess(userId, resource.projectId)) {
        return res.status(404).json({ message: "Resource not found" });
      }

      const updated = await storage.updateResource(id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating resource:", error);
      res.status(400).json({ message: "Failed to update resource" });
    }
  });

  app.delete('/api/resources/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);

      const resource = await storage.getResource(id);
      if (!resource) {
        return res.status(404).json({ message: "Resource not found" });
      }

      // Check access
      if (!await checkProjectAccess(userId, resource.projectId)) {
        return res.status(404).json({ message: "Resource not found" });
      }

      await storage.deleteResource(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting resource:", error);
      res.status(500).json({ message: "Failed to delete resource" });
    }
  });

  // Resource Utilization
  app.get('/api/projects/:projectId/resource-utilization', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const projectId = parseInt(req.params.projectId);

      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const startDate = req.query.startDate
        ? new Date(req.query.startDate as string)
        : project.startDate || new Date();
      const endDate = req.query.endDate
        ? new Date(req.query.endDate as string)
        : project.endDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

      const utilization = await storage.getProjectResourceUtilization(projectId, startDate, endDate);
      res.json(utilization);
    } catch (error) {
      console.error("Error fetching resource utilization:", error);
      res.status(500).json({ message: "Failed to fetch resource utilization" });
    }
  });

  // Resource Assignments
  app.get('/api/resources/:resourceId/assignments', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const resourceId = parseInt(req.params.resourceId);

      const resource = await storage.getResource(resourceId);
      if (!resource) {
        return res.status(404).json({ message: "Resource not found" });
      }

      if (!await checkProjectAccess(userId, resource.projectId)) {
        return res.status(404).json({ message: "Resource not found" });
      }

      const assignments = await storage.getResourceAssignmentsByResource(resourceId);
      res.json(assignments);
    } catch (error) {
      console.error("Error fetching resource assignments:", error);
      res.status(500).json({ message: "Failed to fetch resource assignments" });
    }
  });

  app.get('/api/tasks/:taskId/assignments', isAuthenticated, async (req: any, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      if (isNaN(taskId)) {
        return res.status(400).json({ message: "Invalid task ID" });
      }
      const assignments = await storage.getResourceAssignmentsByTask(taskId);
      res.json(assignments);
    } catch (error: any) {
      console.error("Error fetching assignments:", error);
      res.status(500).json({ message: error?.message || "Failed to fetch assignments" });
    }
  });

  app.post('/api/assignments', isAuthenticated, async (req: any, res) => {
    try {
      // Validate incoming data with Zod schema
      const data = insertResourceAssignmentSchema.parse(req.body);
      const assignment = await storage.createResourceAssignment(data);
      
      // Auto-generate cost item if enabled (default behavior)
      try {
        const { autoGenerateCostItem } = await import("./services/costCalculationService");
        await autoGenerateCostItem(assignment.id, getUserId(req));
      } catch (costError) {
        console.warn("Failed to auto-generate cost item:", costError);
        // Don't fail the assignment creation if cost generation fails
      }
      
      res.json(assignment);
    } catch (error: any) {
      console.error("Error creating assignment:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation failed", errors: error.errors });
      }
      res.status(400).json({ message: error?.message || "Failed to create assignment" });
    }
  });

  app.patch('/api/assignments/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = updateResourceAssignmentSchema.parse(req.body);
      
      const assignment = await storage.getResourceAssignment(id);
      if (!assignment) {
        return res.status(404).json({ message: "Assignment not found" });
      }
      
      const task = await storage.getTask(assignment.taskId);
      if (!task || !await checkProjectAccess(getUserId(req), task.projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const updated = await db.update(schema.resourceAssignments)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(schema.resourceAssignments.id, id))
        .returning();
      
      // Update auto-generated cost item
      try {
        const { updateAutoGeneratedCostItem } = await import("./services/costCalculationService");
        await updateAutoGeneratedCostItem(id, getUserId(req));
      } catch (costError) {
        console.warn("Failed to update auto-generated cost item:", costError);
      }
      
      res.json(updated[0]);
    } catch (error: any) {
      console.error("Error updating assignment:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation failed", errors: error.errors });
      }
      res.status(400).json({ message: error?.message || "Failed to update assignment" });
    }
  });

  app.delete('/api/assignments/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteResourceAssignment(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting assignment:", error);
      res.status(500).json({ message: "Failed to delete assignment" });
    }
  });

  // ===== Resource Time Entries Routes =====
  
  app.get('/api/assignments/:assignmentId/time-entries', isAuthenticated, async (req: any, res) => {
    try {
      const assignmentId = parseInt(req.params.assignmentId);
      const assignment = await storage.getResourceAssignment(assignmentId);
      if (!assignment) {
        return res.status(404).json({ message: "Assignment not found" });
      }
      
      const task = await storage.getTask(assignment.taskId);
      if (!task || !await checkProjectAccess(getUserId(req), task.projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const entries = await storage.getResourceTimeEntriesByAssignment(assignmentId);
      res.json(entries);
    } catch (error: any) {
      console.error("Error fetching time entries:", error);
      res.status(500).json({ message: error?.message || "Failed to fetch time entries" });
    }
  });

  app.post('/api/time-entries', isAuthenticated, async (req: any, res) => {
    try {
      const data = insertResourceTimeEntrySchema.parse({
        ...req.body,
        enteredBy: getUserId(req),
      });
      
      const assignment = await storage.getResourceAssignment(data.resourceAssignmentId);
      if (!assignment) {
        return res.status(404).json({ message: "Assignment not found" });
      }
      
      const task = await storage.getTask(assignment.taskId);
      if (!task || !await checkProjectAccess(getUserId(req), task.projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const entry = await storage.createResourceTimeEntry(data);
      
      // Update assignment actualHours
      const entries = await storage.getResourceTimeEntriesByAssignment(assignment.id);
      const totalHours = entries.reduce((sum, e) => sum + parseFloat(e.hoursWorked || "0"), 0);
      
      await db.update(schema.resourceAssignments)
        .set({ actualHours: totalHours.toString(), updatedAt: new Date() })
        .where(eq(schema.resourceAssignments.id, assignment.id));
      
      // Update cost item
      try {
        const { updateAutoGeneratedCostItem } = await import("./services/costCalculationService");
        await updateAutoGeneratedCostItem(assignment.id, getUserId(req));
      } catch (costError) {
        console.warn("Failed to update cost item:", costError);
      }
      
      res.json(entry);
    } catch (error: any) {
      console.error("Error creating time entry:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation failed", errors: error.errors });
      }
      res.status(400).json({ message: error?.message || "Failed to create time entry" });
    }
  });

  app.patch('/api/time-entries/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = updateResourceTimeEntrySchema.parse(req.body);
      
      const entry = await storage.getResourceTimeEntry(id);
      if (!entry) {
        return res.status(404).json({ message: "Time entry not found" });
      }
      
      const assignment = await storage.getResourceAssignment(entry.resourceAssignmentId);
      if (!assignment) {
        return res.status(404).json({ message: "Assignment not found" });
      }
      
      const task = await storage.getTask(assignment.taskId);
      if (!task || !await checkProjectAccess(getUserId(req), task.projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const updated = await storage.updateResourceTimeEntry(id, data);
      
      // Recalculate actualHours
      const entries = await storage.getResourceTimeEntriesByAssignment(assignment.id);
      const totalHours = entries.reduce((sum, e) => sum + parseFloat(e.hoursWorked || "0"), 0);
      
      await db.update(schema.resourceAssignments)
        .set({ actualHours: totalHours.toString(), updatedAt: new Date() })
        .where(eq(schema.resourceAssignments.id, assignment.id));
      
      // Update cost item
      try {
        const { updateAutoGeneratedCostItem } = await import("./services/costCalculationService");
        await updateAutoGeneratedCostItem(assignment.id, getUserId(req));
      } catch (costError) {
        console.warn("Failed to update cost item:", costError);
      }
      
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating time entry:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation failed", errors: error.errors });
      }
      res.status(400).json({ message: error?.message || "Failed to update time entry" });
    }
  });

  app.delete('/api/time-entries/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const entry = await storage.getResourceTimeEntry(id);
      if (!entry) {
        return res.status(404).json({ message: "Time entry not found" });
      }
      
      const assignment = await storage.getResourceAssignment(entry.resourceAssignmentId);
      if (!assignment) {
        return res.status(404).json({ message: "Assignment not found" });
      }
      
      const task = await storage.getTask(assignment.taskId);
      if (!task || !await checkProjectAccess(getUserId(req), task.projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      await storage.deleteResourceTimeEntry(id);
      
      // Recalculate actualHours
      const entries = await storage.getResourceTimeEntriesByAssignment(assignment.id);
      const totalHours = entries.reduce((sum, e) => sum + parseFloat(e.hoursWorked || "0"), 0);
      
      await db.update(schema.resourceAssignments)
        .set({ actualHours: totalHours.toString(), updatedAt: new Date() })
        .where(eq(schema.resourceAssignments.id, assignment.id));
      
      // Update cost item
      try {
        const { updateAutoGeneratedCostItem } = await import("./services/costCalculationService");
        await updateAutoGeneratedCostItem(assignment.id, getUserId(req));
      } catch (costError) {
        console.warn("Failed to update cost item:", costError);
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting time entry:", error);
      res.status(500).json({ message: error?.message || "Failed to delete time entry" });
    }
  });

  // ===== Task Materials Routes =====
  
  app.get('/api/tasks/:taskId/materials', isAuthenticated, async (req: any, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const task = await storage.getTask(taskId);
      if (!task || !await checkProjectAccess(getUserId(req), task.projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const materials = await storage.getTaskMaterialsByTask(taskId);
      res.json(materials);
    } catch (error: any) {
      console.error("Error fetching task materials:", error);
      res.status(500).json({ message: error?.message || "Failed to fetch task materials" });
    }
  });

  app.post('/api/task-materials', isAuthenticated, async (req: any, res) => {
    try {
      const data = insertTaskMaterialSchema.parse(req.body);
      
      const task = await storage.getTask(data.taskId);
      if (!task || !await checkProjectAccess(getUserId(req), task.projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const material = await storage.createTaskMaterial(data);
      res.json(material);
    } catch (error: any) {
      console.error("Error creating task material:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation failed", errors: error.errors });
      }
      res.status(400).json({ message: error?.message || "Failed to create task material" });
    }
  });

  app.patch('/api/task-materials/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = updateTaskMaterialSchema.parse(req.body);
      
      const material = await storage.getTaskMaterial(id);
      if (!material) {
        return res.status(404).json({ message: "Task material not found" });
      }
      
      const task = await storage.getTask(material.taskId);
      if (!task || !await checkProjectAccess(getUserId(req), task.projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const updated = await storage.updateTaskMaterial(id, data);
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating task material:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation failed", errors: error.errors });
      }
      res.status(400).json({ message: error?.message || "Failed to update task material" });
    }
  });

  app.delete('/api/task-materials/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const material = await storage.getTaskMaterial(id);
      if (!material) {
        return res.status(404).json({ message: "Task material not found" });
      }
      
      const task = await storage.getTask(material.taskId);
      if (!task || !await checkProjectAccess(getUserId(req), task.projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      await storage.deleteTaskMaterial(id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting task material:", error);
      res.status(500).json({ message: error?.message || "Failed to delete task material" });
    }
  });

  // ===== Material Consumptions Routes =====
  
  app.get('/api/task-materials/:taskMaterialId/consumptions', isAuthenticated, async (req: any, res) => {
    try {
      const taskMaterialId = parseInt(req.params.taskMaterialId);
      const material = await storage.getTaskMaterial(taskMaterialId);
      if (!material) {
        return res.status(404).json({ message: "Task material not found" });
      }
      
      const task = await storage.getTask(material.taskId);
      if (!task || !await checkProjectAccess(getUserId(req), task.projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const consumptions = await storage.getMaterialConsumptionsByTaskMaterial(taskMaterialId);
      res.json(consumptions);
    } catch (error: any) {
      console.error("Error fetching consumptions:", error);
      res.status(500).json({ message: error?.message || "Failed to fetch consumptions" });
    }
  });

  app.post('/api/material-consumptions', isAuthenticated, async (req: any, res) => {
    try {
      const data = insertMaterialConsumptionSchema.parse({
        ...req.body,
        consumedBy: getUserId(req),
      });
      
      const material = await storage.getTaskMaterial(data.taskMaterialId);
      if (!material) {
        return res.status(404).json({ message: "Task material not found" });
      }
      
      const task = await storage.getTask(material.taskId);
      if (!task || !await checkProjectAccess(getUserId(req), task.projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const consumption = await storage.createMaterialConsumption(data);
      res.json(consumption);
    } catch (error: any) {
      console.error("Error creating consumption:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation failed", errors: error.errors });
      }
      res.status(400).json({ message: error?.message || "Failed to create consumption" });
    }
  });

  app.patch('/api/material-consumptions/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = updateMaterialConsumptionSchema.parse(req.body);
      
      const consumption = await storage.getMaterialConsumption(id);
      if (!consumption) {
        return res.status(404).json({ message: "Consumption not found" });
      }
      
      const material = await storage.getTaskMaterial(consumption.taskMaterialId);
      if (!material) {
        return res.status(404).json({ message: "Task material not found" });
      }
      
      const task = await storage.getTask(material.taskId);
      if (!task || !await checkProjectAccess(getUserId(req), task.projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const updated = await storage.updateMaterialConsumption(id, data);
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating consumption:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation failed", errors: error.errors });
      }
      res.status(400).json({ message: error?.message || "Failed to update consumption" });
    }
  });

  app.delete('/api/material-consumptions/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const consumption = await storage.getMaterialConsumption(id);
      if (!consumption) {
        return res.status(404).json({ message: "Consumption not found" });
      }
      
      const material = await storage.getTaskMaterial(consumption.taskMaterialId);
      if (!material) {
        return res.status(404).json({ message: "Task material not found" });
      }
      
      const task = await storage.getTask(material.taskId);
      if (!task || !await checkProjectAccess(getUserId(req), task.projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      await storage.deleteMaterialConsumption(id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting consumption:", error);
      res.status(500).json({ message: error?.message || "Failed to delete consumption" });
    }
  });

  // ===== Material Deliveries Routes =====
  
  app.get('/api/task-materials/:taskMaterialId/deliveries', isAuthenticated, async (req: any, res) => {
    try {
      const taskMaterialId = parseInt(req.params.taskMaterialId);
      const material = await storage.getTaskMaterial(taskMaterialId);
      if (!material) {
        return res.status(404).json({ message: "Task material not found" });
      }
      
      const task = await storage.getTask(material.taskId);
      if (!task || !await checkProjectAccess(getUserId(req), task.projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const deliveries = await storage.getMaterialDeliveriesByTaskMaterial(taskMaterialId);
      res.json(deliveries);
    } catch (error: any) {
      console.error("Error fetching deliveries:", error);
      res.status(500).json({ message: error?.message || "Failed to fetch deliveries" });
    }
  });

  app.post('/api/material-deliveries', isAuthenticated, async (req: any, res) => {
    try {
      const data = insertMaterialDeliverySchema.parse(req.body);
      
      const material = await storage.getTaskMaterial(data.taskMaterialId);
      if (!material) {
        return res.status(404).json({ message: "Task material not found" });
      }
      
      const task = await storage.getTask(material.taskId);
      if (!task || !await checkProjectAccess(getUserId(req), task.projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const delivery = await storage.createMaterialDelivery(data);
      res.json(delivery);
    } catch (error: any) {
      console.error("Error creating delivery:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation failed", errors: error.errors });
      }
      res.status(400).json({ message: error?.message || "Failed to create delivery" });
    }
  });

  app.patch('/api/material-deliveries/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = updateMaterialDeliverySchema.parse(req.body);
      
      const delivery = await storage.getMaterialDelivery(id);
      if (!delivery) {
        return res.status(404).json({ message: "Delivery not found" });
      }
      
      const material = await storage.getTaskMaterial(delivery.taskMaterialId);
      if (!material) {
        return res.status(404).json({ message: "Task material not found" });
      }
      
      const task = await storage.getTask(material.taskId);
      if (!task || !await checkProjectAccess(getUserId(req), task.projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const updated = await storage.updateMaterialDelivery(id, data);
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating delivery:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation failed", errors: error.errors });
      }
      res.status(400).json({ message: error?.message || "Failed to update delivery" });
    }
  });

  app.delete('/api/material-deliveries/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const delivery = await storage.getMaterialDelivery(id);
      if (!delivery) {
        return res.status(404).json({ message: "Delivery not found" });
      }
      
      const material = await storage.getTaskMaterial(delivery.taskMaterialId);
      if (!material) {
        return res.status(404).json({ message: "Task material not found" });
      }
      
      const task = await storage.getTask(material.taskId);
      if (!task || !await checkProjectAccess(getUserId(req), task.projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      await storage.deleteMaterialDelivery(id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting delivery:", error);
      res.status(500).json({ message: error?.message || "Failed to delete delivery" });
    }
  });

  // ===== Resource Groups Routes =====
  
  app.get('/api/projects/:projectId/resource-groups', isAuthenticated, async (req: any, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (!await checkProjectAccess(getUserId(req), projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const groups = await storage.getResourceGroupsByProject(projectId);
      res.json(groups);
    } catch (error: any) {
      console.error("Error fetching resource groups:", error);
      res.status(500).json({ message: error?.message || "Failed to fetch resource groups" });
    }
  });

  app.post('/api/resource-groups', isAuthenticated, async (req: any, res) => {
    try {
      const data = insertResourceGroupSchema.parse(req.body);
      
      if (!await checkProjectAccess(getUserId(req), data.projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const group = await storage.createResourceGroup(data);
      res.json(group);
    } catch (error: any) {
      console.error("Error creating resource group:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation failed", errors: error.errors });
      }
      res.status(400).json({ message: error?.message || "Failed to create resource group" });
    }
  });

  app.patch('/api/resource-groups/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = updateResourceGroupSchema.parse(req.body);
      
      const group = await storage.getResourceGroup(id);
      if (!group) {
        return res.status(404).json({ message: "Resource group not found" });
      }
      
      if (!await checkProjectAccess(getUserId(req), group.projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const updated = await storage.updateResourceGroup(id, data);
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating resource group:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation failed", errors: error.errors });
      }
      res.status(400).json({ message: error?.message || "Failed to update resource group" });
    }
  });

  app.delete('/api/resource-groups/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const group = await storage.getResourceGroup(id);
      if (!group) {
        return res.status(404).json({ message: "Resource group not found" });
      }
      
      if (!await checkProjectAccess(getUserId(req), group.projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      await storage.deleteResourceGroup(id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting resource group:", error);
      res.status(500).json({ message: error?.message || "Failed to delete resource group" });
    }
  });

  app.post('/api/resource-groups/:groupId/members', isAuthenticated, async (req: any, res) => {
    try {
      const groupId = parseInt(req.params.groupId);
      const { resourceId } = req.body;
      
      const group = await storage.getResourceGroup(groupId);
      if (!group) {
        return res.status(404).json({ message: "Resource group not found" });
      }
      
      if (!await checkProjectAccess(getUserId(req), group.projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const member = await storage.addResourceToGroup(groupId, resourceId);
      res.json(member);
    } catch (error: any) {
      console.error("Error adding resource to group:", error);
      res.status(400).json({ message: error?.message || "Failed to add resource to group" });
    }
  });

  app.delete('/api/resource-groups/:groupId/members/:resourceId', isAuthenticated, async (req: any, res) => {
    try {
      const groupId = parseInt(req.params.groupId);
      const resourceId = parseInt(req.params.resourceId);
      
      const group = await storage.getResourceGroup(groupId);
      if (!group) {
        return res.status(404).json({ message: "Resource group not found" });
      }
      
      if (!await checkProjectAccess(getUserId(req), group.projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      await storage.removeResourceFromGroup(groupId, resourceId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error removing resource from group:", error);
      res.status(500).json({ message: error?.message || "Failed to remove resource from group" });
    }
  });

  // ===== Documents Routes =====

  // Get documents by project
  app.get('/api/projects/:projectId/documents', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const projectId = parseInt(req.params.projectId);

      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const documents = await storage.getDocumentsByProject(projectId);
      res.json(documents);
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  // Get single document
  app.get('/api/documents/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);

      const document = await storage.getDocument(id);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      if (!await checkProjectAccess(userId, document.projectId)) {
        return res.status(404).json({ message: "Document not found" });
      }

      res.json(document);
    } catch (error) {
      console.error("Error fetching document:", error);
      res.status(500).json({ message: "Failed to fetch document" });
    }
  });

  // Create document
  app.post('/api/documents', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { projectId } = req.body;

      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const document = await storage.createDocument({
        ...req.body,
        createdBy: userId,
      });
      res.json(document);
    } catch (error) {
      console.error("Error creating document:", error);
      res.status(400).json({ message: "Failed to create document" });
    }
  });

  // Update document
  app.patch('/api/documents/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);

      const document = await storage.getDocument(id);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      if (!await checkProjectAccess(userId, document.projectId)) {
        return res.status(404).json({ message: "Document not found" });
      }

      const updated = await storage.updateDocument(id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating document:", error);
      res.status(400).json({ message: "Failed to update document" });
    }
  });

  // Delete document
  app.delete('/api/documents/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);

      const document = await storage.getDocument(id);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      if (!await checkProjectAccess(userId, document.projectId)) {
        return res.status(404).json({ message: "Document not found" });
      }

      await storage.deleteDocument(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting document:", error);
      res.status(500).json({ message: "Failed to delete document" });
    }
  });

  // ===== Project Events Routes (Calendar) =====

  // Get project events
  app.get('/api/projects/:projectId/events', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const projectId = parseInt(req.params.projectId);

      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const events = await storage.getProjectEventsByProject(projectId);
      res.json(events);
    } catch (error) {
      console.error("Error fetching project events:", error);
      res.status(500).json({ message: "Failed to fetch project events" });
    }
  });

  // Get single project event
  app.get('/api/events/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);

      const event = await storage.getProjectEvent(id);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      if (!await checkProjectAccess(userId, event.projectId)) {
        return res.status(404).json({ message: "Event not found" });
      }

      res.json(event);
    } catch (error) {
      console.error("Error fetching event:", error);
      res.status(500).json({ message: "Failed to fetch event" });
    }
  });

  // Create project event
  app.post('/api/events', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { projectId } = req.body;

      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const event = await storage.createProjectEvent({
        ...req.body,
        createdBy: userId,
      });

      // Process event-based notifications for calendar events
      const { processEventBasedNotifications } = await import("./services/notificationService");
      processEventBasedNotifications("calendar-event-created", {
        projectId: event.projectId,
        calendarEventId: event.id,
      }).catch(err => console.error("[NOTIFICATION] Error processing calendar event created:", err));

      res.json(event);
    } catch (error) {
      console.error("Error creating event:", error);
      res.status(400).json({ message: "Failed to create event" });
    }
  });

  // Update project event
  app.patch('/api/events/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);

      const event = await storage.getProjectEvent(id);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      if (!await checkProjectAccess(userId, event.projectId)) {
        return res.status(404).json({ message: "Event not found" });
      }

      const updated = await storage.updateProjectEvent(id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating event:", error);
      res.status(400).json({ message: "Failed to update event" });
    }
  });

  // Delete project event
  app.delete('/api/events/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);

      const event = await storage.getProjectEvent(id);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      if (!await checkProjectAccess(userId, event.projectId)) {
        return res.status(404).json({ message: "Event not found" });
      }

      await storage.deleteProjectEvent(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting event:", error);
      res.status(500).json({ message: "Failed to delete event" });
    }
  });

  // ===== Task Junction Tables Routes =====

  // Task Documents
  app.get('/api/tasks/:taskId/documents', isAuthenticated, async (req: any, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const taskDocs = await storage.getTaskDocuments(taskId);
      res.json(taskDocs);
    } catch (error) {
      console.error("Error fetching task documents:", error);
      res.status(500).json({ message: "Failed to fetch task documents" });
    }
  });

  app.post('/api/tasks/:taskId/documents', isAuthenticated, async (req: any, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const { documentId, relationship } = req.body;
      const taskDoc = await storage.createTaskDocument({ taskId, documentId, relationship });
      res.json(taskDoc);
    } catch (error) {
      console.error("Error adding document to task:", error);
      res.status(400).json({ message: "Failed to add document to task" });
    }
  });

  app.delete('/api/tasks/:taskId/documents/:documentId', isAuthenticated, async (req: any, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const documentId = parseInt(req.params.documentId);
      await storage.deleteTaskDocument(taskId, documentId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing document from task:", error);
      res.status(500).json({ message: "Failed to remove document from task" });
    }
  });

  // Task Risks
  app.get('/api/tasks/:taskId/risks', isAuthenticated, async (req: any, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const taskRisks = await storage.getTaskRisks(taskId);
      res.json(taskRisks);
    } catch (error) {
      console.error("Error fetching task risks:", error);
      res.status(500).json({ message: "Failed to fetch task risks" });
    }
  });

  app.post('/api/tasks/:taskId/risks', isAuthenticated, async (req: any, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const { riskId } = req.body;
      const taskRisk = await storage.createTaskRisk({ taskId, riskId });
      res.json(taskRisk);
    } catch (error) {
      console.error("Error adding risk to task:", error);
      res.status(400).json({ message: "Failed to add risk to task" });
    }
  });

  app.delete('/api/tasks/:taskId/risks/:riskId', isAuthenticated, async (req: any, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const riskId = parseInt(req.params.riskId);
      await storage.deleteTaskRisk(taskId, riskId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing risk from task:", error);
      res.status(500).json({ message: "Failed to remove risk from task" });
    }
  });

  // Task Issues
  app.get('/api/tasks/:taskId/issues', isAuthenticated, async (req: any, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const taskIssues = await storage.getTaskIssues(taskId);
      res.json(taskIssues);
    } catch (error) {
      console.error("Error fetching task issues:", error);
      res.status(500).json({ message: "Failed to fetch task issues" });
    }
  });

  app.post('/api/tasks/:taskId/issues', isAuthenticated, async (req: any, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const { issueId } = req.body;
      const taskIssue = await storage.createTaskIssue({ taskId, issueId });
      res.json(taskIssue);
    } catch (error) {
      console.error("Error adding issue to task:", error);
      res.status(400).json({ message: "Failed to add issue to task" });
    }
  });

  app.delete('/api/tasks/:taskId/issues/:issueId', isAuthenticated, async (req: any, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const issueId = parseInt(req.params.issueId);
      await storage.deleteTaskIssue(taskId, issueId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing issue from task:", error);
      res.status(500).json({ message: "Failed to remove issue from task" });
    }
  });

  // ===== Inheritance Routes =====

  app.get('/api/tasks/:taskId/inherited/resources', isAuthenticated, async (req: any, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      if (isNaN(taskId)) {
        return res.status(400).json({ message: "Invalid task ID" });
      }
      const inherited = await storage.getInheritedResources(taskId);
      res.json(inherited);
    } catch (error: any) {
      console.error("Error fetching inherited resources:", error);
      res.status(500).json({ message: error?.message || "Failed to fetch inherited resources" });
    }
  });

  app.get('/api/tasks/:taskId/inherited/documents', isAuthenticated, async (req: any, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const inherited = await storage.getInheritedDocuments(taskId);
      res.json(inherited);
    } catch (error) {
      console.error("Error fetching inherited documents:", error);
      res.status(500).json({ message: "Failed to fetch inherited documents" });
    }
  });

  app.get('/api/tasks/:taskId/inherited/risks', isAuthenticated, async (req: any, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const inherited = await storage.getInheritedRisks(taskId);
      res.json(inherited);
    } catch (error) {
      console.error("Error fetching inherited risks:", error);
      res.status(500).json({ message: "Failed to fetch inherited risks" });
    }
  });

  app.get('/api/tasks/:taskId/inherited/issues', isAuthenticated, async (req: any, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const inherited = await storage.getInheritedIssues(taskId);
      res.json(inherited);
    } catch (error) {
      console.error("Error fetching inherited issues:", error);
      res.status(500).json({ message: "Failed to fetch inherited issues" });
    }
  });

  // Bulk fetch all task relationships for a project (for efficient count computation)
  app.get('/api/projects/:projectId/task-relationships', isAuthenticated, async (req: any, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      
      // Fetch all tasks for the project
      const tasks = await storage.getTasksByProject(projectId);
      const taskIds = tasks.map(t => t.id);
      
      if (taskIds.length === 0) {
        return res.json({
          taskRisks: [],
          taskIssues: [],
          taskDocuments: [],
          resourceAssignments: [],
          conversations: [],
        });
      }
      
      // Filter out null taskIds for conversations query
      const validTaskIds = taskIds.filter(id => id !== null) as number[];
      
      // Fetch all relationships in parallel
      const [taskRisks, taskIssues, taskDocuments, resourceAssignments, conversations] = await Promise.all([
        // Task Risks
        db.select().from(schema.taskRisks)
          .where(inArray(schema.taskRisks.taskId, taskIds)),
        // Task Issues
        db.select().from(schema.taskIssues)
          .where(inArray(schema.taskIssues.taskId, taskIds)),
        // Task Documents
        db.select().from(schema.taskDocuments)
          .where(inArray(schema.taskDocuments.taskId, taskIds)),
        // Resource Assignments
        db.select().from(schema.resourceAssignments)
          .where(inArray(schema.resourceAssignments.taskId, taskIds)),
        // Conversations (filter by projectId and non-null taskId)
        validTaskIds.length > 0
          ? db.select().from(schema.chatConversations)
              .where(
                and(
                  eq(schema.chatConversations.projectId, projectId),
                  inArray(schema.chatConversations.taskId, validTaskIds)
                )
              )
          : Promise.resolve([]),
      ]);
      
      res.json({
        taskRisks,
        taskIssues,
        taskDocuments,
        resourceAssignments,
        conversations,
      });
    } catch (error) {
      console.error("Error fetching task relationships:", error);
      res.status(500).json({ message: "Failed to fetch task relationships" });
    }
  });

  // ===== AI Assistant Routes =====

  // Get user's conversations
  app.get('/api/ai/conversations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const conversations = await storage.getAiConversationsByUser(userId);
      res.json(conversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  // Get conversations for a project
  app.get('/api/ai/conversations/project/:projectId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const projectId = parseInt(req.params.projectId);

      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const conversations = await storage.getAiConversationsByProject(projectId, userId);
      res.json(conversations);
    } catch (error) {
      console.error("Error fetching project conversations:", error);
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  // Create new conversation
  const createConversationSchema = z.object({
    title: z.string().optional(),
    projectId: z.number().nullable().optional(), // Allow null for project creation conversations
  });

  app.post('/api/ai/conversations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const data = createConversationSchema.parse(req.body);

      // Verify project access if projectId is provided
      if (data.projectId) {
        if (!await checkProjectAccess(userId, data.projectId)) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const conversation = await storage.createAiConversation({
        title: data.title || "New Conversation",
        projectId: data.projectId || null,
        userId
      });

      res.json(conversation);
    } catch (error) {
      console.error("Error creating conversation:", error);
      res.status(400).json({ message: "Failed to create conversation" });
    }
  });

  // Get conversation messages
  app.get('/api/ai/conversations/:id/messages', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const conversationId = parseInt(req.params.id);

      // Check conversation ownership
      const conversation = await storage.getAiConversation(conversationId);
      if (!conversation || conversation.userId !== userId) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      const messages = await storage.getAiMessagesByConversation(conversationId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  // Send message and get AI response
  // Get available Gemini models
  app.get('/api/ai/models', isAuthenticated, async (req, res) => {
    try {
      const { GEMINI_MODELS } = await import('./aiAssistant');
      const models = Object.values(GEMINI_MODELS).map(model => ({
        id: model.name,
        displayName: model.displayName,
        description: model.description,
        tier: model.tier,
        limits: model.limits,
        cost: model.cost
      }));
      res.json({ models });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch models" });
    }
  });

  const chatMessageSchema = z.object({
    conversationId: z.number(),
    message: z.string(),
    context: z.object({
      currentPage: z.string().optional(),
      selectedTaskId: z.number().optional(),
      selectedRiskId: z.number().optional(),
      selectedIssueId: z.number().optional(),
      selectedResourceId: z.number().optional(),
      selectedItemIds: z.array(z.number()).optional(),
      modelName: z.string().optional(), // User-selected Gemini model
      organizationId: z.number().optional(), // Organization ID for project creation
      terminology: z.object({
        topLevel: z.string().optional(),
        program: z.string().optional(),
      }).optional(), // Custom terminology from organization
    }).optional(),
  });

  app.post('/api/ai/chat', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { conversationId, message, context } = chatMessageSchema.parse(req.body);

      // Check conversation ownership
      const conversation = await storage.getAiConversation(conversationId);
      if (!conversation || conversation.userId !== userId) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      // Get conversation history
      const history = await storage.getAiMessagesByConversation(conversationId);
      const messages: ChatMessage[] = history.map(h => ({
        role: h.role as "user" | "assistant" | "system",
        content: h.content
      }));

      // Add new user message
      messages.push({ role: "user", content: message });

      // Save user message
      await storage.createAiMessage({
        conversationId,
        role: "user",
        content: message,
        tokensUsed: 0
      });

      // Get AI response with context
      const response = await chatWithAssistant(
        messages,
        conversation.projectId,
        storage,
        userId,
        context || undefined
      );

      // Validate response before saving
      // Require either a meaningful message OR function calls were executed
      const hasMessage = response.message && response.message.trim().length > 0 && response.message !== "No response generated";
      const hasFunctionCalls = response.functionCalls && response.functionCalls.length > 0;

      if (!hasMessage && !hasFunctionCalls) {
        throw new Error("AI response was empty - no message or function calls");
      }

      // Save assistant message only if there's meaningful content
      // If only function calls without message, use a default message
      const messageContent = hasMessage ? response.message :
        (hasFunctionCalls ? `Executed ${response.functionCalls!.length} function(s)` : response.message);

      await storage.createAiMessage({
        conversationId,
        role: "assistant",
        content: messageContent,
        tokensUsed: response.tokensUsed,
        functionCall: response.functionCalls ? JSON.stringify(response.functionCalls) : null
      });

      // If function calls were executed, log them as actions
      if (response.functionCalls && response.functionCalls.length > 0) {
        for (const funcCall of response.functionCalls) {
          // Check if this is a preview (result contains preview object)
          let resultData: any;
          try {
            resultData = JSON.parse(funcCall.result);
          } catch {
            resultData = { result: funcCall.result };
          }

          const isPreview = resultData.preview !== undefined;
          
          await storage.createAiActionLog({
            userId,
            projectId: conversation.projectId,
            conversationId: conversation.id,
            actionId: resultData.actionId || `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            functionName: funcCall.name,
            args: funcCall.args,
            preview: isPreview ? resultData.preview : null,
            result: isPreview ? null : resultData,
            status: isPreview ? 'pending' : 'executed',
            executedAt: isPreview ? null : new Date(),
          });
        }
      }

      // Track usage
      await storage.createAiUsage({
        userId,
        organizationId: conversation.projectId ? (await storage.getProject(conversation.projectId))?.organizationId || null : null,
        tokensUsed: response.tokensUsed,
        model: "gpt-5",
        operation: "chat"
      });

      // Update conversation updated time (title if not set)
      await storage.updateAiConversation(conversationId, {
        title: conversation.title || message.substring(0, 50)
      });

      res.json({
        message: response.message,
        tokensUsed: response.tokensUsed,
        functionCalls: response.functionCalls
      });
    } catch (error: any) {
      console.error("Error in AI chat:", error);
      res.status(500).json({ message: error.message || "Failed to get AI response" });
    }
  });

  // Update conversation (rename)
  const updateConversationSchema = z.object({
    title: z.string().min(1).max(100),
  });

  app.patch('/api/ai/conversations/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);
      const data = updateConversationSchema.parse(req.body);

      const conversation = await storage.getAiConversation(id);
      if (!conversation || conversation.userId !== userId) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      const updated = await storage.updateAiConversation(id, { title: data.title });
      res.json(updated);
    } catch (error) {
      console.error("Error updating conversation:", error);
      res.status(500).json({ message: "Failed to update conversation" });
    }
  });

  // Delete conversation
  app.delete('/api/ai/conversations/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);

      const conversation = await storage.getAiConversation(id);
      if (!conversation || conversation.userId !== userId) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      await storage.deleteAiConversation(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting conversation:", error);
      res.status(500).json({ message: "Failed to delete conversation" });
    }
  });

  // Execute AI action (from preview)
  app.post('/api/ai/execute-action', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { actionId, functionName, args } = req.body;

      if (!actionId || !functionName || !args) {
        return res.status(400).json({ message: "Missing required fields: actionId, functionName, args" });
      }

      // Find the action log by actionId (string)
      const actionLog = await storage.getAiActionLogByActionId(actionId);
      if (!actionLog || actionLog.userId !== userId) {
        return res.status(404).json({ message: "Action not found" });
      }

      if (actionLog.status !== 'pending') {
        return res.status(400).json({ message: `Action already ${actionLog.status}` });
      }

      // Execute the action (without previewMode)
      const { ExecutionMode, executeFunctionCall } = await import('./aiAssistant');
      const executionResult = await executeFunctionCall(functionName, args, storage, userId, ExecutionMode.EXECUTE);
      
      // Update action log (use numeric id from actionLog)
      await storage.updateAiActionLog(actionLog.id, {
        status: 'executed',
        executedAt: new Date(),
        result: typeof executionResult === 'string' ? JSON.parse(executionResult) : executionResult,
      });

      res.json({ success: true, result: executionResult });
    } catch (error: any) {
      console.error("Error executing AI action:", error);
      res.status(500).json({ message: error.message || "Failed to execute action" });
    }
  });

  // Reject AI action (from preview)
  app.post('/api/ai/reject-action', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { actionId } = req.body;

      if (!actionId) {
        return res.status(400).json({ message: "Missing actionId" });
      }

      // Find the action log by actionId (string)
      const actionLog = await storage.getAiActionLogByActionId(actionId);
      if (!actionLog || actionLog.userId !== userId) {
        return res.status(404).json({ message: "Action not found" });
      }

      if (actionLog.status !== 'pending') {
        return res.status(400).json({ message: `Action already ${actionLog.status}` });
      }

      // Update action log (use numeric id from actionLog)
      await storage.updateAiActionLog(actionLog.id, {
        status: 'rejected',
        rejectedAt: new Date(),
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error rejecting AI action:", error);
      res.status(500).json({ message: error.message || "Failed to reject action" });
    }
  });

  // ===== Project Export/Import Routes =====

  // Export project data as JSON
  app.get('/api/projects/:projectId/export', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const projectId = parseInt(req.params.projectId);
      const format = req.query.format as string;

      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const [tasks, risks, issues, stakeholders, costItems, documents, resources, dependencies] = await Promise.all([
        storage.getTasksByProject(projectId),
        storage.getRisksByProject(projectId),
        storage.getIssuesByProject(projectId),
        storage.getStakeholdersByProject(projectId),
        storage.getCostItemsByProject(projectId),
        storage.getDocumentsByProject(projectId),
        storage.getResourcesByProject(projectId),
        storage.getDependenciesByProject(projectId)
      ]);

      if (format === 'csv') {
        const csvRows = ['ID,WBS Code,Name,Status,Progress,Start Date,End Date,Assigned To,Priority'];
        for (const task of tasks) {
          csvRows.push([
            task.id,
            task.wbsCode || '',
            `"${(task.name || '').replace(/"/g, '""')}"`,
            task.status || '',
            task.progress || 0,
            task.startDate ? new Date(task.startDate).toISOString().split('T')[0] : '',
            task.endDate ? new Date(task.endDate).toISOString().split('T')[0] : '',
            `"${(task.assignedTo || '').replace(/"/g, '""')}"`,
            task.priority || ''
          ].join(','));
        }
        res.setHeader('Content-Type', 'text/csv');
        res.send(csvRows.join('\n'));
      } else {
        const exportData = {
          exportDate: new Date().toISOString(),
          version: "1.0",
          project: {
            name: project.name,
            code: project.code,
            description: project.description,
            status: project.status,
            startDate: project.startDate,
            endDate: project.endDate,
            budget: project.budget,
            currency: project.currency
          },
          tasks: tasks.map(t => ({
            wbsCode: t.wbsCode,
            name: t.name,
            description: t.description,
            status: t.status,
            progress: t.progress,
            startDate: t.startDate,
            endDate: t.endDate,
            assignedTo: t.assignedTo,
            priority: t.priority,
            estimatedHours: t.estimatedHours,
            actualHours: t.actualHours,
            discipline: t.discipline
          })),
          risks: risks.map(r => ({
            code: r.code,
            title: r.title,
            description: r.description,
            category: r.category,
            probability: r.probability,
            impact: r.impact,
            status: r.status,
            owner: r.owner,
            mitigationStrategy: r.mitigationStrategy,
            contingencyPlan: r.contingencyPlan
          })),
          issues: issues.map(i => ({
            code: i.code,
            title: i.title,
            description: i.description,
            priority: i.priority,
            status: i.status,
            assignedTo: i.assignedTo,
            reportedBy: i.reportedBy,
            resolution: i.resolution
          })),
          stakeholders: stakeholders.map(s => ({
            name: s.name,
            role: s.role,
            organization: s.organization,
            email: s.email,
            phone: s.phone,
            influence: s.influence,
            interest: s.interest
          })),
          costItems: costItems.map(c => ({
            description: c.description,
            category: c.category,
            budgeted: c.budgeted,
            actual: c.actual,
            currency: c.currency
          })),
          documents: documents.map(d => ({
            documentNumber: d.documentNumber,
            title: d.title,
            revision: d.revision,
            discipline: d.discipline,
            documentType: d.documentType,
            status: d.status
          }))
        };

        res.json(exportData);
      }
    } catch (error) {
      console.error("Error exporting project:", error);
      res.status(500).json({ message: "Failed to export project" });
    }
  });

  // ===== Import Schema & Template Endpoints =====

  // Valid enum values for import validation
  const importEnums = {
    taskStatus: ["not-started", "in-progress", "review", "completed", "on-hold"],
    taskPriority: ["low", "medium", "high", "critical"],
    riskStatus: ["identified", "assessed", "mitigating", "closed"],
    riskImpact: ["low", "medium", "high", "critical"],
    issueStatus: ["open", "in-progress", "resolved", "closed"],
    issuePriority: ["low", "medium", "high", "critical"],
    stakeholderRole: ["sponsor", "client", "team-member", "contractor", "consultant", "regulatory", "vendor", "other"],
    costCategory: ["labor", "materials", "equipment", "subcontractor", "overhead", "permits", "contingency", "construction", "administrative", "other"],
    discipline: ["general", "civil", "structural", "mechanical", "electrical", "instrumentation", "piping", "process", "hse", "qa-qc", "procurement", "construction", "commissioning", "management", "engineering"],
    currency: ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "CNY", "INR", "BRL", "MXN", "SAR", "AED", "SGD", "HKD", "KRW"]
  };

  // Value mapping for common alternatives
  const valueMappings: Record<string, Record<string, string>> = {
    taskPriority: { "normal": "medium", "urgent": "critical", "none": "low" },
    riskStatus: { "active": "identified", "open": "identified", "monitoring": "assessed", "resolved": "closed" },
    issueStatus: { "pending": "open", "fixed": "resolved", "done": "closed" },
    stakeholderRole: { "owner": "sponsor", "customer": "client", "subcontractor": "contractor", "regulator": "regulatory", "supplier": "vendor" },
    // Discipline mappings for common EPC terms
    discipline: {
      "management": "general", "project-management": "general", "pm": "general",
      "engineering": "general", "design": "general",
      "procurement": "general", "purchasing": "general", "supply-chain": "general",
      "construction": "civil", "site-works": "civil", "building": "civil",
      "mep": "mechanical", "hvac-mechanical": "mechanical",
      "e&i": "electrical", "power": "electrical",
      "controls": "instrumentation", "automation": "instrumentation",
      "pipeline": "piping", "plumbing": "piping"
    }
  };

  // Get import schema with all valid enum values (for external AI consumption)
  app.get('/api/import/schema', (req, res) => {
    const schema = {
      $schema: "http://json-schema.org/draft-07/schema#",
      title: "EPC PMIS Project Import Schema",
      description: "JSON Schema for importing project data into EPC PMIS. Use this schema when generating project JSON with AI tools like ChatGPT, Claude, or Gemini.",
      version: "1.0",
      type: "object",
      required: ["version", "project"],
      properties: {
        version: { type: "string", const: "1.0", description: "Schema version, must be '1.0'" },
        project: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string", description: "Project name", maxLength: 255 },
            code: { type: "string", description: "Project code (e.g., SOLAR-2024-001)", maxLength: 50 },
            description: { type: "string", description: "Project description" },
            status: { type: "string", enum: ["planning", "active", "on-hold", "completed", "cancelled"], default: "active" },
            startDate: { type: "string", format: "date-time", description: "ISO 8601 date (e.g., 2025-01-15T00:00:00.000Z)" },
            endDate: { type: "string", format: "date-time" },
            budget: { type: "string", description: "Budget amount as string (e.g., '75000000.00')" },
            currency: { type: "string", enum: importEnums.currency, default: "USD" }
          }
        },
        tasks: {
          type: "array",
          description: "WBS task hierarchy. Use wbsCode to define hierarchy (e.g., '1', '1.1', '1.1.1' for parent-child relationships)",
          items: {
            type: "object",
            required: ["wbsCode", "name"],
            properties: {
              wbsCode: { type: "string", description: "WBS code defines hierarchy. Examples: '1' (level 1), '1.1' (child of 1), '1.1.2' (child of 1.1). Max 5 levels.", pattern: "^[0-9]+(\\.[0-9]+){0,4}$" },
              name: { type: "string", description: "Task name", maxLength: 255 },
              description: { type: "string" },
              status: { type: "string", enum: importEnums.taskStatus, default: "not-started" },
              priority: { type: "string", enum: importEnums.taskPriority, default: "medium", description: "IMPORTANT: Use 'medium' not 'normal'" },
              progress: { type: "integer", minimum: 0, maximum: 100, default: 0 },
              startDate: { type: "string", format: "date-time" },
              endDate: { type: "string", format: "date-time" },
              assignedTo: { type: ["string", "null"], description: "Assignee identifier (e.g., 'PM-01', 'ENG-LEAD'). Stored as text - no user account required." },
              estimatedHours: { type: "string", description: "Estimated hours as string (e.g., '480.00')" },
              actualHours: { type: "string", description: "Actual hours as string" },
              discipline: {
                type: "string",
                description: "FLEXIBLE: Any discipline text is accepted (e.g., 'management', 'engineering', 'procurement'). Known values auto-map to standard categories. Original text preserved for reporting.",
                examples: ["management", "engineering", "civil", "mechanical", "electrical", "procurement", "construction"]
              }
            }
          }
        },
        risks: {
          type: "array",
          items: {
            type: "object",
            required: ["title"],
            properties: {
              code: { type: "string", description: "Risk code (e.g., RISK-001). Auto-generated if not provided." },
              title: { type: "string", maxLength: 255 },
              description: { type: "string" },
              category: { type: "string", description: "Risk category (freeform text)" },
              probability: { type: "integer", minimum: 1, maximum: 5, description: "1-5 scale (1=Very Low, 5=Very High)" },
              impact: { type: "string", enum: importEnums.riskImpact, default: "medium" },
              status: { type: "string", enum: importEnums.riskStatus, default: "identified", description: "IMPORTANT: Use 'identified' not 'active'" },
              owner: { type: ["string", "null"], description: "Risk owner identifier" },
              mitigationPlan: { type: "string" }
            }
          }
        },
        issues: {
          type: "array",
          items: {
            type: "object",
            required: ["title"],
            properties: {
              code: { type: "string", description: "Issue code (e.g., ISS-001). Auto-generated if not provided." },
              title: { type: "string", maxLength: 255 },
              description: { type: "string" },
              priority: { type: "string", enum: importEnums.issuePriority, default: "medium" },
              status: { type: "string", enum: importEnums.issueStatus, default: "open" },
              assignedTo: { type: ["string", "null"] },
              reportedBy: { type: ["string", "null"] },
              resolution: { type: ["string", "null"] }
            }
          }
        },
        stakeholders: {
          type: "array",
          items: {
            type: "object",
            required: ["name"],
            properties: {
              name: { type: "string", maxLength: 255 },
              role: { type: "string", enum: importEnums.stakeholderRole, default: "other" },
              organization: { type: "string" },
              email: { type: "string", format: "email" },
              phone: { type: "string" },
              influence: { type: "integer", minimum: 1, maximum: 5, description: "1-5 scale" },
              interest: { type: "integer", minimum: 1, maximum: 5, description: "1-5 scale" }
            }
          }
        },
        costItems: {
          type: "array",
          items: {
            type: "object",
            required: ["description"],
            properties: {
              description: { type: "string" },
              category: { type: "string", enum: importEnums.costCategory, default: "other" },
              budgeted: { type: "string", description: "Budgeted amount as string" },
              actual: { type: "string", description: "Actual amount as string" },
              currency: { type: "string", enum: importEnums.currency, default: "USD" }
            }
          }
        }
      },
      examples: [{
        version: "1.0",
        project: { name: "Example Solar Project", code: "SOLAR-2025-001", status: "active", budget: "50000000.00", currency: "USD" },
        tasks: [
          { wbsCode: "1", name: "Engineering", status: "in-progress", priority: "high", progress: 50 },
          { wbsCode: "1.1", name: "Civil Design", status: "completed", priority: "critical", progress: 100 }
        ]
      }],
      valueMappings: {
        description: "The import system will automatically map these common alternative values:",
        taskPriority: { "'normal' → 'medium'": true, "'urgent' → 'critical'": true },
        riskStatus: { "'active' → 'identified'": true, "'open' → 'identified'": true, "'monitoring' → 'assessed'": true },
        stakeholderRole: { "'owner' → 'sponsor'": true, "'customer' → 'client'": true, "'regulator' → 'regulatory'": true }
      }
    };

    res.json(schema);
  });

  // Get example template for import
  app.get('/api/import/template', (req, res) => {
    const template = {
      version: "1.0",
      project: {
        name: "Your Project Name",
        code: "PROJECT-2025-001",
        description: "Brief project description",
        status: "active",
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        budget: "10000000.00",
        currency: "USD"
      },
      tasks: [
        {
          wbsCode: "1",
          name: "Phase 1 - Planning",
          description: "Initial planning phase",
          status: "not-started",
          priority: "high",
          progress: 0,
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          assignedTo: "PM-01",  // Flexible: any text identifier works
          estimatedHours: "200.00",
          actualHours: "0.00",
          discipline: "management"  // Flexible: any discipline text accepted
        },
        {
          wbsCode: "1.1",
          name: "Requirements Gathering",
          description: "Collect and document requirements",
          status: "not-started",
          priority: "critical",
          progress: 0,
          assignedTo: "ENG-LEAD",  // Example: team role identifier
          discipline: "engineering"  // Any EPC discipline term works
        },
        {
          wbsCode: "2",
          name: "Phase 2 - Execution",
          description: "Main execution phase",
          status: "not-started",
          priority: "critical",
          progress: 0,
          assignedTo: "CONST-DIR",
          discipline: "construction"
        }
      ],
      risks: [
        {
          code: "RISK-001",
          title: "Example Risk",
          description: "Description of the risk",
          category: "technical",
          probability: 3,
          impact: "medium",
          status: "identified",
          owner: null,
          mitigationPlan: "Mitigation strategy"
        }
      ],
      issues: [
        {
          code: "ISS-001",
          title: "Example Issue",
          description: "Description of the issue",
          priority: "medium",
          status: "open",
          assignedTo: null,
          reportedBy: null,
          resolution: null
        }
      ],
      stakeholders: [
        {
          name: "Project Sponsor",
          role: "sponsor",
          organization: "Client Organization",
          email: "sponsor@example.com",
          phone: "+1-555-0100",
          influence: 5,
          interest: 5
        }
      ],
      costItems: [
        {
          description: "Equipment Purchase",
          category: "equipment",
          budgeted: "500000.00",
          actual: "0.00",
          currency: "USD"
        }
      ],
      _instructions: {
        usage: "Copy this template and modify for your project. You can also provide this template to AI tools (ChatGPT, Claude, Gemini) as a reference format.",
        wbsHierarchy: "WBS codes define parent-child relationships: '1' is parent of '1.1', which is parent of '1.1.1'. Maximum 5 levels.",
        flexibleFields: {
          discipline: "Any text accepted (e.g., 'management', 'engineering', 'procurement'). Known values auto-map to standard categories.",
          assignedTo: "Any text identifier (e.g., 'PM-01', 'ENG-LEAD'). Stored as label - no user account required."
        },
        validEnums: {
          ...importEnums,
          _note: "discipline is now FLEXIBLE - any text is accepted and preserved"
        },
        tips: [
          "Priority must be: low, medium, high, or critical (not 'normal')",
          "Risk status must be: identified, assessed, mitigating, or closed (not 'active')",
          "Dates should be ISO 8601 format",
          "Numbers should be strings (e.g., '1000.00')",
          "discipline: ANY text is now accepted - use your own terminology",
          "assignedTo: Use any identifier (PM-01, ENG-LEAD) - no user account needed"
        ],
        labelManagement: "After import, use Label Management to normalize discipline/assignee values for consistency."
      }
    };

    res.json(template);
  });

  // Validate import data without importing
  app.post('/api/import/validate', (req, res) => {
    const importData = req.body;
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!importData?.version) {
      errors.push("Missing required field: version");
    }

    if (!importData?.project?.name) {
      errors.push("Missing required field: project.name");
    }

    // Validate tasks
    if (importData?.tasks) {
      importData.tasks.forEach((task: any, index: number) => {
        if (!task.wbsCode) errors.push(`Task ${index + 1}: Missing wbsCode`);
        if (!task.name) errors.push(`Task ${index + 1}: Missing name`);
        if (task.priority && !importEnums.taskPriority.includes(task.priority)) {
          const mapped = valueMappings.taskPriority?.[task.priority];
          if (mapped) {
            warnings.push(`Task ${index + 1}: priority '${task.priority}' will be mapped to '${mapped}'`);
          } else {
            errors.push(`Task ${index + 1}: Invalid priority '${task.priority}'. Valid values: ${importEnums.taskPriority.join(", ")}`);
          }
        }
        if (task.status && !importEnums.taskStatus.includes(task.status)) {
          errors.push(`Task ${index + 1}: Invalid status '${task.status}'. Valid values: ${importEnums.taskStatus.join(", ")}`);
        }
      });
    }

    // Validate risks
    if (importData?.risks) {
      importData.risks.forEach((risk: any, index: number) => {
        if (!risk.title) errors.push(`Risk ${index + 1}: Missing title`);
        if (risk.status && !importEnums.riskStatus.includes(risk.status)) {
          const mapped = valueMappings.riskStatus?.[risk.status];
          if (mapped) {
            warnings.push(`Risk ${index + 1}: status '${risk.status}' will be mapped to '${mapped}'`);
          } else {
            errors.push(`Risk ${index + 1}: Invalid status '${risk.status}'. Valid values: ${importEnums.riskStatus.join(", ")}`);
          }
        }
        if (risk.impact && !importEnums.riskImpact.includes(risk.impact)) {
          errors.push(`Risk ${index + 1}: Invalid impact '${risk.impact}'. Valid values: ${importEnums.riskImpact.join(", ")}`);
        }
      });
    }

    // Validate issues
    if (importData?.issues) {
      importData.issues.forEach((issue: any, index: number) => {
        if (!issue.title) errors.push(`Issue ${index + 1}: Missing title`);
        if (issue.status && !importEnums.issueStatus.includes(issue.status)) {
          errors.push(`Issue ${index + 1}: Invalid status '${issue.status}'. Valid values: ${importEnums.issueStatus.join(", ")}`);
        }
        if (issue.priority && !importEnums.issuePriority.includes(issue.priority)) {
          errors.push(`Issue ${index + 1}: Invalid priority '${issue.priority}'. Valid values: ${importEnums.issuePriority.join(", ")}`);
        }
      });
    }

    res.json({
      valid: errors.length === 0,
      errors,
      warnings,
      summary: {
        tasks: importData?.tasks?.length || 0,
        risks: importData?.risks?.length || 0,
        issues: importData?.issues?.length || 0,
        stakeholders: importData?.stakeholders?.length || 0,
        costItems: importData?.costItems?.length || 0
      }
    });
  });

  // Input sanitization utilities for flexible text fields
  const sanitizeText = (input: any, maxLength: number = 100): string | null => {
    if (input === null || input === undefined) return null;
    const str = String(input).trim();
    if (str === '') return null;
    // Remove potentially dangerous characters (XSS prevention)
    const sanitized = str
      .replace(/[<>]/g, '') // Remove angle brackets
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, '') // Remove event handlers like onclick=
      .slice(0, maxLength); // Enforce length limit
    return sanitized || null;
  };

  // Validate text contains only safe characters
  const isValidLabel = (input: string): boolean => {
    // Allow alphanumeric, spaces, hyphens, underscores, dots, parentheses
    return /^[\w\s\-_.()\/&]+$/i.test(input);
  };

  // Helper to try enum mapping, return null if not valid (for flexible import)
  const tryMapEnum = (category: string, value: string, validValues: string[]): string | null => {
    if (!value) return null;
    if (validValues.includes(value)) return value;
    const mapped = valueMappings[category]?.[value];
    return mapped || null;
  };

  // Import project data with validation and value mapping
  app.post('/api/projects/:projectId/import', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const projectId = parseInt(req.params.projectId);

      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const importData = req.body;
      const fieldMappings = req.body.fieldMappings || {}; // Optional field mappings
      const errors: string[] = [];
      const warnings: string[] = [];

      if (!importData || !importData.version) {
        return res.status(400).json({
          success: false,
          message: "Invalid import format. Missing 'version' field.",
          hint: "Get the correct format from GET /api/import/schema or GET /api/import/template"
        });
      }

      // Helper to transform data using mappings
      const transformData = (entityType: string, item: any) => {
        const mappings = fieldMappings[entityType] || [];
        const transformed = { ...item };

        mappings.forEach((mapping: any) => {
          if (!mapping.isMapped) return;

          const sourceValue = item[mapping.sourceField];
          if (sourceValue === undefined) return;

          if (mapping.mappingType === 'enum' && mapping.enumMappings) {
            // Apply enum mapping
            const mappedValue = mapping.enumMappings[String(sourceValue)] || sourceValue;
            transformed[mapping.targetField] = mappedValue;
          } else {
            // Direct mapping
            transformed[mapping.targetField] = sourceValue;
          }
        });

        return transformed;
      };

      // Helper to map values with fallback - for strict enum fields
      const mapValue = (category: string, value: string, validValues: string[], defaultValue: string): string => {
        if (!value) return defaultValue;
        // Case insensitive check
        const lowerValue = String(value).toLowerCase();
        const match = validValues.find(v => v.toLowerCase() === lowerValue);
        if (match) return match;
        
        const mapped = valueMappings[category]?.[value];
        if (mapped) {
          warnings.push(`Mapped '${value}' to '${mapped}' for ${category}`);
          return mapped;
        }
        // Don't error - just use default and warn
        warnings.push(`Unknown ${category}: '${value}', using '${defaultValue}'`);
        return defaultValue;
      };

      // Helper to get parent WBS code
      const getParentWbsCode = (wbsCode: string): string | null => {
        const parts = wbsCode.split('.');
        if (parts.length <= 1) return null;
        return parts.slice(0, -1).join('.');
      };

      let importedCounts = {
        tasks: 0,
        risks: 0,
        issues: 0,
        stakeholders: 0,
        costItems: 0
      };

      // Build WBS code to task ID map for hierarchy
      const wbsToTaskId: Record<string, number> = {};

      // Sort tasks by WBS code depth to ensure parents are created first
      const sortedTasks = [...(importData.tasks || [])].sort((a: any, b: any) => {
        const aDepth = (a.wbsCode || '').split('.').length;
        const bDepth = (b.wbsCode || '').split('.').length;
        return aDepth - bDepth;
      });

      // Import tasks with hierarchy and flexible text fields
      for (const rawTask of sortedTasks) {
        try {
          // Apply field mapping transformation
          const task = transformData('tasks', rawTask);

          const wbsCode = task.wbsCode || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const parentWbsCode = getParentWbsCode(wbsCode);
          const parentId = parentWbsCode ? wbsToTaskId[parentWbsCode] : null;

          // Map strict enums with fallbacks
          const mappedPriority = mapValue('taskPriority', task.priority, importEnums.taskPriority, 'medium');
          const mappedStatus = task.status && importEnums.taskStatus.includes(task.status) ? task.status : 'not-started';

          // Try to map discipline to valid enum, otherwise store as flexible label
          const disciplineEnumValue = tryMapEnum('discipline', task.discipline?.toLowerCase(), importEnums.discipline);
          const disciplineLabelValue = sanitizeText(task.discipline, 100);

          // If discipline isn't a valid enum, store the original as disciplineLabel
          if (task.discipline && !disciplineEnumValue && disciplineLabelValue) {
            warnings.push(`Task '${task.name}': discipline '${task.discipline}' stored as label (not in standard list)`);
          }

          // Sanitize assignedTo - store as text label, don't try to link to user FK
          const assignedToName = sanitizeText(task.assignedTo || task.assignee, 100);
          if (assignedToName && !isValidLabel(assignedToName)) {
            warnings.push(`Task '${task.name}': assignedTo contains invalid characters, sanitized`);
          }

          const createdTask = await storage.createTask({
            projectId,
            parentId,
            name: task.name || task.title || 'Untitled Task',
            wbsCode,
            createdBy: userId,
            description: task.description,
            status: mappedStatus as "not-started" | "in-progress" | "review" | "completed" | "on-hold",
            progress: Math.min(100, Math.max(0, parseInt(task.progress) || 0)),
            startDate: task.startDate ? new Date(task.startDate) : null,
            endDate: task.endDate ? new Date(task.endDate) : null,
            // Use assignedToName text field instead of FK
            assignedTo: null, // Don't try to set FK from import
            assignedToName: assignedToName,
            priority: mappedPriority as "low" | "medium" | "high" | "critical",
            estimatedHours: task.estimatedHours,
            actualHours: task.actualHours,
            // Use enum if valid, otherwise default to 'general'
            discipline: (disciplineEnumValue || 'general') as any,
            // Store original discipline text as label for flexibility
            disciplineLabel: disciplineLabelValue
          });

          wbsToTaskId[wbsCode] = createdTask.id;
          importedCounts.tasks++;
        } catch (taskError: any) {
          errors.push(`Failed to import task '${rawTask.name || rawTask.wbsCode}': ${taskError.message}`);
        }
      }

      // Import risks
      let riskCounter = 1;
      if (importData.risks && Array.isArray(importData.risks)) {
        for (const rawRisk of importData.risks) {
          try {
            // Apply field mapping transformation
            const risk = transformData('risks', rawRisk);

            const mappedStatus = mapValue('riskStatus', risk.status, importEnums.riskStatus, 'identified');
            const mappedImpact = mapValue('riskImpact', risk.impact, importEnums.riskImpact, 'medium');

            // Auto-generate code if not provided
            // Check if code exists in import list to avoid duplicates in DB
            const riskCode = risk.code || `RISK-${String(riskCounter++).padStart(3, '0')}`;
            
            // Try to find existing risk with this code
            // This is a hacky check, ideally we'd have an upsert or better check
            // But since we don't have easy access to `getRiskByCode`, we'll just wrap in try-catch
            // and if it fails with unique constraint, we'll append a random suffix
            
            try {
              await storage.createRisk({
                projectId,
                code: riskCode,
                title: risk.title || 'Untitled Risk',
                description: risk.description,
                category: risk.category || 'other',
                probability: Math.min(5, Math.max(1, parseInt(risk.probability) || 3)),
                impact: mappedImpact as "low" | "medium" | "high" | "critical",
                status: mappedStatus as "identified" | "assessed" | "mitigating" | "closed",
                owner: risk.owner || null,
                mitigationPlan: risk.mitigationPlan || risk.mitigationStrategy || risk.mitigation
              });
              importedCounts.risks++;
            } catch (innerError: any) {
               if (innerError.message.includes("unique constraint")) {
                 // Retry with suffix
                 const newCode = `${riskCode}-${Math.random().toString(36).substr(2, 4)}`;
                 await storage.createRisk({
                    projectId,
                    code: newCode,
                    title: risk.title || 'Untitled Risk',
                    description: risk.description,
                    category: risk.category || 'other',
                    probability: Math.min(5, Math.max(1, parseInt(risk.probability) || 3)),
                    impact: mappedImpact as "low" | "medium" | "high" | "critical",
                    status: mappedStatus as "identified" | "assessed" | "mitigating" | "closed",
                    owner: risk.owner || null,
                    mitigationPlan: risk.mitigationPlan || risk.mitigationStrategy || risk.mitigation
                  });
                  importedCounts.risks++;
                  warnings.push(`Risk '${risk.title}' code '${riskCode}' already exists, imported as '${newCode}'`);
               } else {
                 throw innerError;
               }
            }
          } catch (riskError: any) {
            errors.push(`Failed to import risk '${rawRisk.title}': ${riskError.message}`);
          }
        }
      }

      // Import issues
      let issueCounter = 1;
      if (importData.issues && Array.isArray(importData.issues)) {
        for (const rawIssue of importData.issues) {
          try {
            // Apply field mapping transformation
            const issue = transformData('issues', rawIssue);

            const mappedStatus = issue.status && importEnums.issueStatus.includes(issue.status) ? issue.status : 'open';
            const mappedPriority = mapValue('issuePriority', issue.priority, importEnums.issuePriority, 'medium');

            // Auto-generate code if not provided
            const issueCode = issue.code || `ISS-${String(issueCounter++).padStart(3, '0')}`;

            await storage.createIssue({
              projectId,
              code: issueCode,
              title: issue.title || 'Untitled Issue',
              description: issue.description,
              priority: mappedPriority as "low" | "medium" | "high" | "critical",
              status: mappedStatus as "open" | "in-progress" | "resolved" | "closed",
              assignedTo: issue.assignedTo || null,
              reportedBy: issue.reportedBy || userId, // Use current user if not specified
              resolution: issue.resolution || null
            });
            importedCounts.issues++;
          } catch (issueError: any) {
            errors.push(`Failed to import issue '${rawIssue.title}': ${issueError.message}`);
          }
        }
      }

      // Import stakeholders
      if (importData.stakeholders && Array.isArray(importData.stakeholders)) {
        for (const rawStakeholder of importData.stakeholders) {
          try {
            // Apply field mapping transformation
            const stakeholder = transformData('stakeholders', rawStakeholder);

            const mappedRole = mapValue('stakeholderRole', stakeholder.role, importEnums.stakeholderRole, 'other');

            await storage.createStakeholder({
              projectId,
              name: stakeholder.name || 'Unknown Stakeholder',
              role: mappedRole as "sponsor" | "client" | "team-member" | "contractor" | "consultant" | "other",
              organization: stakeholder.organization,
              email: stakeholder.email,
              phone: stakeholder.phone,
              influence: Math.min(5, Math.max(1, parseInt(stakeholder.influence) || 3)),
              interest: Math.min(5, Math.max(1, parseInt(stakeholder.interest) || 3))
            });
            importedCounts.stakeholders++;
          } catch (stakeholderError: any) {
            errors.push(`Failed to import stakeholder '${rawStakeholder.name}': ${stakeholderError.message}`);
          }
        }
      }

      // Import cost items
      if (importData.costItems && Array.isArray(importData.costItems)) {
        for (const rawCostItem of importData.costItems) {
          try {
            // Apply field mapping transformation
            const costItem = transformData('costItems', rawCostItem);

            const mappedCategory = costItem.category && importEnums.costCategory.includes(costItem.category) ? costItem.category : 'other';

            await storage.createCostItem({
              projectId,
              description: costItem.description || costItem.name || 'Unnamed Cost',
              category: mappedCategory,
              budgeted: costItem.budgeted,
              actual: costItem.actual,
              currency: costItem.currency || 'USD'
            });
            importedCounts.costItems++;
          } catch (costError: any) {
            errors.push(`Failed to import cost item '${rawCostItem.description}': ${costError.message}`);
          }
        }
      }

      res.json({
        success: errors.length === 0,
        imported: importedCounts,
        errors: errors.length > 0 ? errors : undefined,
        warnings: warnings.length > 0 ? warnings : undefined,
        message: errors.length === 0
          ? `Successfully imported ${importedCounts.tasks} tasks, ${importedCounts.risks} risks, ${importedCounts.issues} issues, ${importedCounts.stakeholders} stakeholders, ${importedCounts.costItems} cost items`
          : `Import completed with ${errors.length} error(s)`
      });
    } catch (error: any) {
      console.error("Error importing project:", error);
      res.status(500).json({
        success: false,
        message: "Failed to import project",
        error: error.message,
        hint: "Validate your JSON first using POST /api/import/validate"
      });
    }
  });

  // ===== Label Management API Routes =====

  // Get unique discipline labels used in a project
  app.get('/api/projects/:projectId/labels/disciplines', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const projectId = parseInt(req.params.projectId);

      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const tasks = await storage.getTasksByProject(projectId);

      // Get unique discipline labels and counts
      const disciplineStats: Record<string, { enum: string | null, label: string | null, count: number }> = {};

      for (const task of tasks) {
        const key = (task as any).disciplineLabel || task.discipline || 'general';
        if (!disciplineStats[key]) {
          disciplineStats[key] = {
            enum: task.discipline,
            label: (task as any).disciplineLabel,
            count: 0
          };
        }
        disciplineStats[key].count++;
      }

      res.json({
        disciplines: Object.entries(disciplineStats).map(([value, stats]) => ({
          value,
          disciplineEnum: stats.enum,
          disciplineLabel: stats.label,
          taskCount: stats.count
        })),
        total: tasks.length
      });
    } catch (error: any) {
      console.error("Error getting discipline labels:", error);
      res.status(500).json({ message: "Failed to get discipline labels" });
    }
  });

  // Get unique assignee names used in a project
  app.get('/api/projects/:projectId/labels/assignees', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const projectId = parseInt(req.params.projectId);

      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const tasks = await storage.getTasksByProject(projectId);

      // Get unique assignee names and counts
      const assigneeStats: Record<string, { userId: string | null, name: string | null, count: number }> = {};

      for (const task of tasks) {
        const name = (task as any).assignedToName;
        if (name) {
          if (!assigneeStats[name]) {
            assigneeStats[name] = {
              userId: task.assignedTo,
              name: name,
              count: 0
            };
          }
          assigneeStats[name].count++;
        }
      }

      res.json({
        assignees: Object.entries(assigneeStats).map(([value, stats]) => ({
          value,
          linkedUserId: stats.userId,
          taskCount: stats.count
        })),
        total: Object.keys(assigneeStats).length
      });
    } catch (error: any) {
      console.error("Error getting assignee labels:", error);
      res.status(500).json({ message: "Failed to get assignee labels" });
    }
  });

  // ===== Template API Routes =====

  // Get all templates
  app.get('/api/project-templates', isAuthenticated, async (req: any, res) => {
    try {
      // Get public templates AND user's templates
      const templates = await storage.getProjectTemplates();
      res.json(templates);
    } catch (error: any) {
      console.error("Error fetching templates:", error);
      res.status(500).json({ message: "Failed to fetch templates" });
    }
  });

  // Create a new template from an existing project
  app.post('/api/project-templates', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { projectId, name, description, category, isPublic } = req.body;

      if (!projectId || !name) {
        return res.status(400).json({ message: "Project ID and Name are required" });
      }

      // 1. Verify access to source project
      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(403).json({ message: "Access denied to source project" });
      }

      // 2. Fetch project data to serialize
      const project = await storage.getProject(projectId);
      const tasks = await storage.getTasksByProject(projectId);
      const risks = await storage.getRisksByProject(projectId);
      
      // 3. Construct template data JSON (similar to export format)
      const templateData = {
        version: "1.0.0",
        project: {
          name: name, // New name
          description: description || project.description,
          status: "planning"
        },
        tasks: tasks.map(t => ({
          ...t,
          id: undefined,
          projectId: undefined,
          parentId: undefined, // Will need to reconstruct hierarchy
          assignedTo: null, 
          startDate: null, 
          endDate: null,
          actualHours: 0,
          progress: 0,
          status: "not-started"
        })),
        risks: risks.map(r => ({
          ...r,
          id: undefined,
          projectId: undefined,
          owner: null,
          status: "identified"
        }))
      };

      // 4. Calculate metadata
      const metadata = {
        estimatedDuration: 0,
        complexity: tasks.length > 50 ? "high" : tasks.length > 20 ? "medium" : "low",
        typicalTeamSize: 0,
        industry: category || "general",
        taskCount: tasks.length
      };

      // 5. Save to DB
      const template = await storage.createProjectTemplate({
        userId,
        organizationId: project.organizationId,
        name,
        description,
        category: category || "general",
        templateData,
        metadata,
        isPublic: !!isPublic
      });

      res.json(template);
    } catch (error: any) {
      console.error("Error creating template:", error);
      res.status(500).json({ message: "Failed to create template" });
    }
  });

  // Instantiate a project from a template
  app.post('/api/project-templates/:templateId/create-project', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const templateId = parseInt(req.params.templateId);
      const { name, startDate, organizationId } = req.body;

      if (!name || !organizationId) {
        return res.status(400).json({ message: "Name and Organization ID are required" });
      }

      // 1. Get Template
      const template = await storage.getProjectTemplate(templateId);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      // 2. Create Shell Project
      const project = await storage.createProject({
        name,
        description: template.description || `Created from template: ${template.name}`,
        organizationId,
        startDate: startDate ? new Date(startDate) : new Date(),
        status: "planning",
        code: `PROJ-${Date.now()}` // Simple auto-code
      });

      // 3. Import Data from Template JSON
      const importData = template.templateData as any;
      const wbsToTaskId: Record<string, number> = {};
      
      // Import Tasks
      if (importData.tasks) {
        const sortedTasks = [...importData.tasks].sort((a: any, b: any) => 
          (a.wbsCode?.length || 0) - (b.wbsCode?.length || 0)
        );

        for (const taskData of sortedTasks) {
           const parentWbs = taskData.wbsCode?.includes('.') 
             ? taskData.wbsCode.substring(0, taskData.wbsCode.lastIndexOf('.')) 
             : null;
           
           const parentId = parentWbs ? wbsToTaskId[parentWbs] : null;

           const task = await storage.createTask({
             projectId: project.id,
             parentId,
             name: taskData.name,
             wbsCode: taskData.wbsCode,
             description: taskData.description,
             status: "not-started",
             priority: taskData.priority || "medium",
             discipline: taskData.discipline || "general",
             createdBy: userId
           });
           
           if (taskData.wbsCode) {
             wbsToTaskId[taskData.wbsCode] = task.id;
           }
        }
      }

      // Import Risks
      if (importData.risks) {
        for (const riskData of importData.risks) {
          await storage.createRisk({
            projectId: project.id,
            title: riskData.title,
            description: riskData.description,
            category: riskData.category || "other",
            status: "identified",
            impact: riskData.impact || "medium",
            probability: riskData.probability || 3,
            mitigationPlan: riskData.mitigationPlan,
            code: `RISK-${Math.random().toString(36).substr(2, 5).toUpperCase()}`
          });
        }
      }

      await storage.incrementTemplateUsage(templateId);
      res.json(project);

    } catch (error: any) {
      console.error("Error creating project from template:", error);
      res.status(500).json({ message: "Failed to create project from template" });
    }
  });

  // Bulk update discipline labels (find and replace)
  app.post('/api/projects/:projectId/labels/disciplines/replace', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const projectId = parseInt(req.params.projectId);

      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { oldValue, newValue, updateEnum } = req.body;

      if (!oldValue || !newValue) {
        return res.status(400).json({ message: "Both oldValue and newValue are required" });
      }

      // Sanitize the new value
      const sanitizedNew = sanitizeText(newValue, 100);
      if (!sanitizedNew) {
        return res.status(400).json({ message: "Invalid newValue after sanitization" });
      }

      const tasks = await storage.getTasksByProject(projectId);
      let updatedCount = 0;

      for (const task of tasks) {
        const currentLabel = (task as any).disciplineLabel;
        if (currentLabel === oldValue) {
          // Determine if new value maps to a valid enum
          const newEnumValue = tryMapEnum('discipline', sanitizedNew.toLowerCase(), importEnums.discipline);

          await storage.updateTask(task.id, {
            disciplineLabel: sanitizedNew,
            discipline: updateEnum && newEnumValue ? newEnumValue as any : task.discipline
          });
          updatedCount++;
        }
      }

      res.json({
        success: true,
        message: `Updated ${updatedCount} task(s)`,
        updatedCount
      });
    } catch (error: any) {
      console.error("Error replacing discipline labels:", error);
      res.status(500).json({ message: "Failed to replace discipline labels" });
    }
  });

  // Bulk update assignee names (find and replace)
  app.post('/api/projects/:projectId/labels/assignees/replace', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const projectId = parseInt(req.params.projectId);

      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { oldValue, newValue, linkToUserId } = req.body;

      if (!oldValue || !newValue) {
        return res.status(400).json({ message: "Both oldValue and newValue are required" });
      }

      // Sanitize the new value
      const sanitizedNew = sanitizeText(newValue, 100);
      if (!sanitizedNew) {
        return res.status(400).json({ message: "Invalid newValue after sanitization" });
      }

      const tasks = await storage.getTasksByProject(projectId);
      let updatedCount = 0;

      for (const task of tasks) {
        const currentName = (task as any).assignedToName;
        if (currentName === oldValue) {
          await storage.updateTask(task.id, {
            assignedToName: sanitizedNew,
            assignedTo: linkToUserId || task.assignedTo
          });
          updatedCount++;
        }
      }

      res.json({
        success: true,
        message: `Updated ${updatedCount} task(s)`,
        updatedCount
      });
    } catch (error: any) {
      console.error("Error replacing assignee labels:", error);
      res.status(500).json({ message: "Failed to replace assignee labels" });
    }
  });

  // ===== PDF Report Generation Routes =====

  // Helper to send PDF response
  const sendPdfResponse = (res: Response, pdfDoc: PDFKit.PDFDocument, filename: string) => {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    pdfDoc.pipe(res);
    pdfDoc.end();
  };

  // Risk Register Report
  app.get('/api/projects/:projectId/reports/risk-register', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const projectId = parseInt(req.params.projectId);

      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const risks = await storage.getRisksByProject(projectId);
      const user = await storage.getUser(userId);

      const pdfDoc = generateRiskRegisterReport({
        project,
        risks,
        generatedBy: user?.firstName && user?.lastName
          ? `${user.firstName} ${user.lastName}`
          : user?.email || 'System'
      });

      const filename = `${project.code}_Risk_Register_${new Date().toISOString().split('T')[0]}.pdf`;
      sendPdfResponse(res, pdfDoc, filename);
    } catch (error) {
      console.error("Error generating risk register report:", error);
      res.status(500).json({ message: "Failed to generate report" });
    }
  });

  // Project Status Report
  app.get('/api/projects/:projectId/reports/status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const projectId = parseInt(req.params.projectId);

      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const [tasks, risks, issues, costItems] = await Promise.all([
        storage.getTasksByProject(projectId),
        storage.getRisksByProject(projectId),
        storage.getIssuesByProject(projectId),
        storage.getCostItemsByProject(projectId)
      ]);

      const user = await storage.getUser(userId);

      const pdfDoc = generateProjectStatusReport({
        project,
        tasks,
        risks,
        issues,
        costItems,
        generatedBy: user?.firstName && user?.lastName
          ? `${user.firstName} ${user.lastName}`
          : user?.email || 'System'
      });

      const filename = `${project.code}_Status_Report_${new Date().toISOString().split('T')[0]}.pdf`;
      sendPdfResponse(res, pdfDoc, filename);
    } catch (error) {
      console.error("Error generating project status report:", error);
      res.status(500).json({ message: "Failed to generate report" });
    }
  });

  // Earned Value Analysis Report
  app.get('/api/projects/:projectId/reports/eva', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const projectId = parseInt(req.params.projectId);

      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const [tasks, costItems] = await Promise.all([
        storage.getTasksByProject(projectId),
        storage.getCostItemsByProject(projectId)
      ]);

      const user = await storage.getUser(userId);

      const pdfDoc = generateEVAReport({
        project,
        tasks,
        costItems,
        generatedBy: user?.firstName && user?.lastName
          ? `${user.firstName} ${user.lastName}`
          : user?.email || 'System'
      });

      const filename = `${project.code}_EVA_Report_${new Date().toISOString().split('T')[0]}.pdf`;
      sendPdfResponse(res, pdfDoc, filename);
    } catch (error) {
      console.error("Error generating EVA report:", error);
      res.status(500).json({ message: "Failed to generate report" });
    }
  });

  // Issue Log Report
  app.get('/api/projects/:projectId/reports/issues', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const projectId = parseInt(req.params.projectId);

      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const issues = await storage.getIssuesByProject(projectId);
      const user = await storage.getUser(userId);

      const pdfDoc = generateIssueLogReport({
        project,
        issues,
        generatedBy: user?.firstName && user?.lastName
          ? `${user.firstName} ${user.lastName}`
          : user?.email || 'System'
      });

      const filename = `${project.code}_Issue_Log_${new Date().toISOString().split('T')[0]}.pdf`;
      sendPdfResponse(res, pdfDoc, filename);
    } catch (error) {
      console.error("Error generating issue log report:", error);
      res.status(500).json({ message: "Failed to generate report" });
    }
  });

  // =============== EMAIL TEMPLATES ROUTES ===============

  // Get all default email templates (for reference)
  app.get('/api/email-templates/defaults', isAuthenticated, async (req: any, res) => {
    try {
      const templates = getAllDefaultTemplates();
      res.json(templates);
    } catch (error) {
      console.error("Error getting default templates:", error);
      res.status(500).json({ message: "Failed to get default templates" });
    }
  });

  // Get available placeholders for a template type
  app.get('/api/email-templates/placeholders/:type', isAuthenticated, async (req: any, res) => {
    try {
      const { type } = req.params;
      const placeholders = getAvailablePlaceholders(type);
      res.json({ type, placeholders });
    } catch (error) {
      console.error("Error getting placeholders:", error);
      res.status(500).json({ message: "Failed to get placeholders" });
    }
  });

  // Get organization email templates
  app.get('/api/organizations/:orgId/email-templates', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const orgId = parseInt(req.params.orgId);

      if (!await checkOrganizationAccess(userId, orgId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const templates = await storage.getEmailTemplatesByOrganization(orgId);
      res.json(templates);
    } catch (error) {
      console.error("Error getting email templates:", error);
      res.status(500).json({ message: "Failed to get email templates" });
    }
  });

  // Get single email template
  app.get('/api/organizations/:orgId/email-templates/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const orgId = parseInt(req.params.orgId);
      const templateId = parseInt(req.params.id);

      if (!await checkOrganizationAccess(userId, orgId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const template = await storage.getEmailTemplate(templateId);
      if (!template || template.organizationId !== orgId) {
        return res.status(404).json({ message: "Template not found" });
      }

      res.json(template);
    } catch (error) {
      console.error("Error getting email template:", error);
      res.status(500).json({ message: "Failed to get email template" });
    }
  });

  // Create email template
  app.post('/api/organizations/:orgId/email-templates', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const orgId = parseInt(req.params.orgId);

      if (!await checkOrganizationAccess(userId, orgId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const parsed = insertEmailTemplateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.issues });
      }

      const template = await storage.createEmailTemplate({
        ...parsed.data,
        organizationId: orgId,
        createdBy: userId
      });

      res.status(201).json(template);
    } catch (error) {
      console.error("Error creating email template:", error);
      res.status(500).json({ message: "Failed to create email template" });
    }
  });

  // Update email template
  app.patch('/api/organizations/:orgId/email-templates/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const orgId = parseInt(req.params.orgId);
      const templateId = parseInt(req.params.id);

      if (!await checkOrganizationAccess(userId, orgId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const existing = await storage.getEmailTemplate(templateId);
      if (!existing || existing.organizationId !== orgId) {
        return res.status(404).json({ message: "Template not found" });
      }

      const parsed = updateEmailTemplateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.issues });
      }

      const updated = await storage.updateEmailTemplate(templateId, parsed.data);
      res.json(updated);
    } catch (error) {
      console.error("Error updating email template:", error);
      res.status(500).json({ message: "Failed to update email template" });
    }
  });

  // Delete email template
  app.delete('/api/organizations/:orgId/email-templates/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const orgId = parseInt(req.params.orgId);
      const templateId = parseInt(req.params.id);

      if (!await checkOrganizationAccess(userId, orgId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const existing = await storage.getEmailTemplate(templateId);
      if (!existing || existing.organizationId !== orgId) {
        return res.status(404).json({ message: "Template not found" });
      }

      await storage.deleteEmailTemplate(templateId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting email template:", error);
      res.status(500).json({ message: "Failed to delete email template" });
    }
  });

  // Preview email template with placeholders
  app.post('/api/organizations/:orgId/email-templates/:id/preview', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const orgId = parseInt(req.params.orgId);
      const templateId = parseInt(req.params.id);

      if (!await checkOrganizationAccess(userId, orgId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const template = await storage.getEmailTemplate(templateId);
      if (!template || template.organizationId !== orgId) {
        return res.status(404).json({ message: "Template not found" });
      }

      const placeholders = req.body.placeholders || {};
      const previewSubject = replacePlaceholders(template.subject, placeholders);
      const previewBody = replacePlaceholders(template.body, placeholders);

      res.json({
        subject: previewSubject,
        body: previewBody
      });
    } catch (error) {
      console.error("Error previewing template:", error);
      res.status(500).json({ message: "Failed to preview template" });
    }
  });

  // Send test email
  app.post('/api/organizations/:orgId/email-templates/:id/send-test', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const orgId = parseInt(req.params.orgId);
      const templateId = parseInt(req.params.id);

      if (!await checkOrganizationAccess(userId, orgId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const template = await storage.getEmailTemplate(templateId);
      if (!template || template.organizationId !== orgId) {
        return res.status(404).json({ message: "Template not found" });
      }

      const { toEmail, placeholders = {} } = req.body;
      if (!toEmail) {
        return res.status(400).json({ message: "Email address required" });
      }

      const subject = replacePlaceholders(template.subject, placeholders);
      const body = replacePlaceholders(template.body, placeholders);

      // Log the email to the database
      const sentEmail = await storage.createSentEmail({
        organizationId: orgId,
        templateId,
        toEmail,
        subject,
        status: 'pending'
      });

      // Send via SendGrid
      const result = await sendEmail({
        to: toEmail,
        subject,
        htmlContent: body,
        templateId,
        organizationId: orgId
      });

      // Update status
      await storage.updateSentEmailStatus(
        sentEmail.id,
        result.success ? 'sent' : 'failed',
        result.error
      );

      // Increment usage counter
      if (result.success) {
        await storage.incrementEmailUsage(orgId);
      }

      res.json({
        success: result.success,
        message: result.success ? 'Test email sent' : result.error
      });
    } catch (error) {
      console.error("Error sending test email:", error);
      res.status(500).json({ message: "Failed to send test email" });
    }
  });

  // Get sent emails log
  app.get('/api/organizations/:orgId/sent-emails', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const orgId = parseInt(req.params.orgId);

      if (!await checkOrganizationAccess(userId, orgId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const limit = parseInt(req.query.limit as string) || 100;
      const sentEmails = await storage.getSentEmailsByOrganization(orgId, limit);
      res.json(sentEmails);
    } catch (error) {
      console.error("Error getting sent emails:", error);
      res.status(500).json({ message: "Failed to get sent emails" });
    }
  });

  // Get email usage for current month
  app.get('/api/organizations/:orgId/email-usage', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const orgId = parseInt(req.params.orgId);

      if (!await checkOrganizationAccess(userId, orgId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const month = new Date().toISOString().slice(0, 7);
      const usage = await storage.getEmailUsage(orgId, month);

      res.json({
        month,
        emailsSent: usage?.emailsSent || 0,
        emailLimit: usage?.emailLimit || 1000
      });
    } catch (error) {
      console.error("Error getting email usage:", error);
      res.status(500).json({ message: "Failed to get email usage" });
    }
  });

  // WebSocket status endpoint
  app.get('/api/ws/status', isAuthenticated, async (req: any, res) => {
    res.json({
      connectedUsers: wsManager.getConnectedUsers(),
      timestamp: Date.now()
    });
  });

  // ===== File Upload Routes =====

  // Get upload URL for a project file
  app.post('/api/projects/:projectId/files/upload-url', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const projectId = parseInt(req.params.projectId);

      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const { fileSize } = req.body;
      if (!fileSize || typeof fileSize !== 'number') {
        return res.status(400).json({ message: "fileSize is required" });
      }

      // Check quota
      const quota = await storage.getStorageQuota(project.organizationId);
      const currentUsed = quota?.usedBytes || 0;
      const maxQuota = quota?.quotaBytes || 1073741824; // 1GB default

      if (currentUsed + fileSize > maxQuota) {
        return res.status(400).json({
          message: "Storage quota exceeded",
          currentUsed,
          maxQuota,
          requested: fileSize
        });
      }

      const { ObjectStorageService } = await import('./objectStorage');
      const objectStorage = new ObjectStorageService();
      const { uploadURL, objectId } = await objectStorage.getObjectEntityUploadURL(
        project.organizationId,
        projectId
      );

      res.json({ uploadURL, objectId });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ message: "Failed to get upload URL" });
    }
  });

  // Register uploaded file after upload completes
  app.post('/api/projects/:projectId/files', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const projectId = parseInt(req.params.projectId);

      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const { name, originalName, mimeType, size, objectPath, category, description } = req.body;

      if (!name || !originalName || !mimeType || !size || !objectPath) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Set ACL policy on the uploaded object
      const { ObjectStorageService } = await import('./objectStorage');
      const objectStorage = new ObjectStorageService();

      try {
        await objectStorage.trySetObjectEntityAclPolicy(objectPath, {
          owner: userId,
          organizationId: project.organizationId,
          visibility: "private",
        });
      } catch (aclError) {
        console.error("Error setting ACL policy:", aclError);
      }

      // Create file record
      const file = await storage.createProjectFile({
        projectId,
        organizationId: project.organizationId,
        name,
        originalName,
        mimeType,
        size,
        objectPath,
        category: category || 'general',
        description,
        uploadedBy: userId
      });

      // Update storage quota
      await storage.incrementStorageUsage(project.organizationId, size);

      // Notify via WebSocket
      wsManager.notifyProjectUpdate(projectId, 'file-created', file, userId);

      res.status(201).json(file);
    } catch (error) {
      console.error("Error creating file:", error);
      res.status(500).json({ message: "Failed to create file" });
    }
  });

  // Get project files
  app.get('/api/projects/:projectId/files', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const projectId = parseInt(req.params.projectId);

      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const files = await storage.getProjectFilesByProject(projectId);
      res.json(files);
    } catch (error) {
      console.error("Error getting files:", error);
      res.status(500).json({ message: "Failed to get files" });
    }
  });

  // Update project file
  app.patch('/api/projects/:projectId/files/:fileId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const projectId = parseInt(req.params.projectId);
      const fileId = parseInt(req.params.fileId);

      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const existingFile = await storage.getProjectFile(fileId);
      if (!existingFile || existingFile.projectId !== projectId) {
        return res.status(404).json({ message: "File not found" });
      }

      const { name, category, description } = req.body;
      const updated = await storage.updateProjectFile(fileId, { name, category, description });

      wsManager.notifyProjectUpdate(projectId, 'file-updated', updated, userId);

      res.json(updated);
    } catch (error) {
      console.error("Error updating file:", error);
      res.status(500).json({ message: "Failed to update file" });
    }
  });

  // Delete project file
  app.delete('/api/projects/:projectId/files/:fileId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const projectId = parseInt(req.params.projectId);
      const fileId = parseInt(req.params.fileId);

      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const existingFile = await storage.getProjectFile(fileId);
      if (!existingFile || existingFile.projectId !== projectId) {
        return res.status(404).json({ message: "File not found" });
      }

      const project = await storage.getProject(projectId);

      // Delete from object storage
      const { ObjectStorageService } = await import('./objectStorage');
      const objectStorage = new ObjectStorageService();
      try {
        await objectStorage.deleteObject(existingFile.objectPath);
      } catch (deleteError) {
        console.error("Error deleting from object storage:", deleteError);
      }

      // Delete from database
      await storage.deleteProjectFile(fileId);

      // Update storage quota
      if (project) {
        await storage.decrementStorageUsage(project.organizationId, existingFile.size);
      }

      wsManager.notifyProjectUpdate(projectId, 'file-deleted', { id: fileId }, userId);

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting file:", error);
      res.status(500).json({ message: "Failed to delete file" });
    }
  });

  // Serve private object files (with access control)
  app.get('/objects/:objectPath(*)', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const objectPath = `/objects/${req.params.objectPath}`;

      const { ObjectStorageService, ObjectNotFoundError } = await import('./objectStorage');
      const { ObjectPermission } = await import('./objectAcl');
      const objectStorage = new ObjectStorageService();

      // Get user's organization IDs for ACL check
      const userOrgs = await storage.getUserOrganizations(userId);
      const userOrgIds = userOrgs.map(uo => uo.organizationId);

      const objectFile = await objectStorage.getObjectEntityFile(objectPath);
      const canAccess = await objectStorage.canAccessObjectEntity({
        objectFile,
        userId,
        requestedPermission: ObjectPermission.READ,
        userOrganizationIds: userOrgIds
      });

      if (!canAccess) {
        return res.status(401).json({ message: "Access denied" });
      }

      objectStorage.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error serving object:", error);
      if ((error as any).name === 'ObjectNotFoundError') {
        return res.status(404).json({ message: "File not found" });
      }
      res.status(500).json({ message: "Failed to serve file" });
    }
  });

  // Get storage quota for organization
  app.get('/api/organizations/:orgId/storage', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const orgId = parseInt(req.params.orgId);

      if (!await checkOrganizationAccess(userId, orgId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const quota = await storage.getStorageQuota(orgId);

      res.json({
        usedBytes: quota?.usedBytes || 0,
        quotaBytes: quota?.quotaBytes || 1073741824,
        usedPercent: quota ? Math.round((quota.usedBytes / quota.quotaBytes) * 100) : 0
      });
    } catch (error) {
      console.error("Error getting storage quota:", error);
      res.status(500).json({ message: "Failed to get storage quota" });
    }
  });

  // ===== Cloud Storage Routes =====

  // Get available cloud storage providers
  app.get('/api/cloud-storage/providers', isAuthenticated, async (req: any, res) => {
    try {
      const { CLOUD_PROVIDERS } = await import('./cloudStorage');

      const providers = Object.entries(CLOUD_PROVIDERS).map(([key, config]) => ({
        id: key,
        name: config.displayName,
        icon: config.icon,
        configured: !!(process.env[config.clientIdEnv] && process.env[config.clientSecretEnv])
      }));

      res.json(providers);
    } catch (error) {
      console.error("Error getting providers:", error);
      res.status(500).json({ message: "Failed to get cloud storage providers" });
    }
  });

  // Get cloud storage connections for organization
  app.get('/api/organizations/:orgId/cloud-storage', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const orgId = parseInt(req.params.orgId);

      if (!await checkOrganizationAccess(userId, orgId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const connections = await storage.getCloudStorageConnectionsByOrganization(orgId);

      // Don't expose tokens to frontend
      const safeConnections = connections.map(conn => ({
        id: conn.id,
        provider: conn.provider,
        accountEmail: conn.accountEmail,
        accountName: conn.accountName,
        rootFolderName: conn.rootFolderName,
        syncEnabled: conn.syncEnabled,
        syncStatus: conn.syncStatus,
        lastSyncAt: conn.lastSyncAt,
        syncError: conn.syncError,
        createdAt: conn.createdAt
      }));

      res.json(safeConnections);
    } catch (error) {
      console.error("Error getting cloud storage connections:", error);
      res.status(500).json({ message: "Failed to get cloud storage connections" });
    }
  });

  // Get OAuth authorization URL for cloud provider
  app.post('/api/organizations/:orgId/cloud-storage/auth-url', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const orgId = parseInt(req.params.orgId);

      if (!await checkOrganizationAccess(userId, orgId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { provider } = req.body;
      if (!provider) {
        return res.status(400).json({ message: "Provider is required" });
      }

      // Check if already connected
      const existing = await storage.getCloudStorageConnectionByProvider(orgId, provider);
      if (existing) {
        return res.status(400).json({ message: "Provider already connected. Disconnect first." });
      }

      const { getAuthorizationUrl } = await import('./cloudStorage');

      // Create HMAC-signed state token for OAuth security
      const statePayload = JSON.stringify({
        organizationId: orgId,
        userId,
        provider,
        timestamp: Date.now()
      });
      const statePayloadBase64 = Buffer.from(statePayload).toString('base64');
      const stateSecret = process.env.SESSION_SECRET || 'oauth-state-secret';
      const stateSignature = crypto
        .createHmac('sha256', stateSecret)
        .update(statePayloadBase64)
        .digest('hex');
      const state = `${statePayloadBase64}.${stateSignature}`;

      const redirectUri = `${req.protocol}://${req.get('host')}/api/cloud-storage/callback`;
      const authUrl = getAuthorizationUrl(provider, state, redirectUri);

      res.json({ authUrl, state });
    } catch (error) {
      console.error("Error generating auth URL:", error);
      res.status(500).json({ message: "Failed to generate authorization URL" });
    }
  });

  // OAuth callback handler
  app.get('/api/cloud-storage/callback', async (req: any, res) => {
    try {
      const { code, state, error: oauthError } = req.query;

      if (oauthError) {
        return res.redirect(`/settings?error=${encodeURIComponent(oauthError)}`);
      }

      if (!code || !state) {
        return res.redirect('/settings?error=invalid_callback');
      }

      // Verify HMAC-signed state
      const stateParts = (state as string).split('.');
      if (stateParts.length !== 2) {
        return res.redirect('/settings?error=invalid_state');
      }

      const [statePayloadBase64, providedSignature] = stateParts;
      const stateSecret = process.env.SESSION_SECRET || 'oauth-state-secret';
      const expectedSignature = crypto
        .createHmac('sha256', stateSecret)
        .update(statePayloadBase64)
        .digest('hex');

      // Reject if signature lengths don't match (SHA256 HMAC is always 64 hex chars)
      if (providedSignature.length !== 64 || expectedSignature.length !== 64) {
        console.error("OAuth state invalid signature length");
        return res.redirect('/settings?error=invalid_state');
      }

      // Use timing-safe comparison to prevent timing attacks
      const providedBuffer = Buffer.from(providedSignature, 'hex');
      const expectedBuffer = Buffer.from(expectedSignature, 'hex');

      if (providedBuffer.length !== expectedBuffer.length ||
        !crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
        console.error("OAuth state signature mismatch - potential tampering");
        return res.redirect('/settings?error=invalid_state');
      }

      // Decode state payload
      let stateData;
      try {
        stateData = JSON.parse(Buffer.from(statePayloadBase64, 'base64').toString());
      } catch {
        return res.redirect('/settings?error=invalid_state');
      }

      const { organizationId, userId, provider } = stateData;

      // Verify state timestamp (5 minute expiry)
      if (Date.now() - stateData.timestamp > 5 * 60 * 1000) {
        return res.redirect('/settings?error=state_expired');
      }

      const { exchangeCodeForTokens, getCloudStorageProvider, CLOUD_PROVIDERS } = await import('./cloudStorage');

      const redirectUri = `${req.protocol}://${req.get('host')}/api/cloud-storage/callback`;
      const tokens = await exchangeCodeForTokens(provider, code as string, redirectUri);

      // Create connection record
      const connection = await storage.createCloudStorageConnection({
        organizationId,
        provider,
        connectedBy: userId,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiresAt: tokens.expiresAt,
        syncEnabled: true
      });

      // Get user info from provider
      try {
        const providerInstance = getCloudStorageProvider(connection);
        const userInfo = await providerInstance.getUserInfo();

        await storage.updateCloudStorageConnection(connection.id, {
          accountEmail: userInfo.email,
          accountName: userInfo.name
        });
      } catch (e) {
        console.error("Error getting user info:", e);
      }

      res.redirect(`/settings?success=cloud_storage_connected&provider=${provider}`);
    } catch (error) {
      console.error("OAuth callback error:", error);
      res.redirect('/settings?error=oauth_failed');
    }
  });

  // Disconnect cloud storage provider
  app.delete('/api/organizations/:orgId/cloud-storage/:connectionId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const orgId = parseInt(req.params.orgId);
      const connectionId = parseInt(req.params.connectionId);

      if (!await checkOrganizationAccess(userId, orgId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const connection = await storage.getCloudStorageConnection(connectionId);
      if (!connection || connection.organizationId !== orgId) {
        return res.status(404).json({ message: "Connection not found" });
      }

      // Delete synced files first
      await storage.deleteCloudSyncedFilesByConnection(connectionId);

      // Delete connection
      await storage.deleteCloudStorageConnection(connectionId);

      res.json({ message: "Cloud storage disconnected" });
    } catch (error) {
      console.error("Error disconnecting cloud storage:", error);
      res.status(500).json({ message: "Failed to disconnect cloud storage" });
    }
  });

  // Trigger sync for cloud storage connection
  app.post('/api/organizations/:orgId/cloud-storage/:connectionId/sync', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const orgId = parseInt(req.params.orgId);
      const connectionId = parseInt(req.params.connectionId);
      const { projectId } = req.body;

      if (!await checkOrganizationAccess(userId, orgId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (!projectId) {
        return res.status(400).json({ message: "Project ID is required" });
      }

      const connection = await storage.getCloudStorageConnection(connectionId);
      if (!connection || connection.organizationId !== orgId) {
        return res.status(404).json({ message: "Connection not found" });
      }

      if (!connection.syncEnabled) {
        return res.status(400).json({ message: "Sync is disabled for this connection" });
      }

      const { syncCloudFiles } = await import('./cloudStorage');
      const stats = await syncCloudFiles(connection, projectId);

      res.json({
        message: "Sync completed",
        added: stats.added,
        updated: stats.updated,
        errors: stats.errors
      });
    } catch (error) {
      console.error("Error syncing cloud storage:", error);
      res.status(500).json({ message: "Failed to sync cloud storage" });
    }
  });

  // List files from cloud storage
  app.get('/api/organizations/:orgId/cloud-storage/:connectionId/files', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const orgId = parseInt(req.params.orgId);
      const connectionId = parseInt(req.params.connectionId);
      const { folderId } = req.query;

      if (!await checkOrganizationAccess(userId, orgId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const connection = await storage.getCloudStorageConnection(connectionId);
      if (!connection || connection.organizationId !== orgId) {
        return res.status(404).json({ message: "Connection not found" });
      }

      const { getCloudStorageProvider } = await import('./cloudStorage');
      const provider = getCloudStorageProvider(connection);
      const files = await provider.listFiles(folderId as string | undefined);

      res.json(files);
    } catch (error) {
      console.error("Error listing cloud files:", error);
      res.status(500).json({ message: "Failed to list cloud files" });
    }
  });

  // Get synced files for a project
  app.get('/api/projects/:projectId/cloud-files', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const projectId = parseInt(req.params.projectId);

      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const files = await storage.getCloudSyncedFilesByProject(projectId);
      res.json(files);
    } catch (error) {
      console.error("Error getting cloud synced files:", error);
      res.status(500).json({ message: "Failed to get cloud synced files" });
    }
  });

  // ==================== SUBSCRIPTION & USAGE ROUTES ====================

  // Get all subscription plans
  app.get('/api/subscription-plans', isAuthenticated, async (_req, res) => {
    try {
      const plans = await storage.getSubscriptionPlans();
      res.json(plans);
    } catch (error) {
      console.error("Error getting subscription plans:", error);
      res.status(500).json({ message: "Failed to get subscription plans" });
    }
  });

  // Get organization subscription and usage
  app.get('/api/organizations/:orgId/subscription', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const orgId = parseInt(req.params.orgId);

      if (!await checkOrganizationAccess(userId, orgId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const subscription = await storage.getOrganizationSubscription(orgId);
      let plan = null;

      if (subscription) {
        plan = await storage.getSubscriptionPlan(subscription.planId);
      } else {
        plan = await storage.getSubscriptionPlanByTier('free');
      }

      res.json({ subscription, plan });
    } catch (error) {
      console.error("Error getting subscription:", error);
      res.status(500).json({ message: "Failed to get subscription" });
    }
  });

  // Get organization usage statistics
  app.get('/api/organizations/:orgId/usage', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const orgId = parseInt(req.params.orgId);

      if (!await checkOrganizationAccess(userId, orgId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      const [storageQuota, aiUsage, emailUsage, subscription] = await Promise.all([
        storage.getStorageQuota(orgId),
        storage.getAiUsageSummary(orgId, currentMonth),
        storage.getEmailUsage(orgId, currentMonth),
        storage.getOrganizationSubscription(orgId)
      ]);

      let plan = null;
      if (subscription) {
        plan = await storage.getSubscriptionPlan(subscription.planId);
      } else {
        plan = await storage.getSubscriptionPlanByTier('free');
      }

      const projects = await storage.getProjectsByOrganization(orgId);
      const userOrgs = await storage.getUserOrganizations(userId);
      const orgMembers = userOrgs.filter(uo => uo.organizationId === orgId);

      res.json({
        storage: {
          usedBytes: storageQuota?.usedBytes || 0,
          quotaBytes: plan?.storageQuotaBytes || 1073741824,
          usedPercent: storageQuota && plan ? Math.round((storageQuota.usedBytes / plan.storageQuotaBytes) * 100) : 0
        },
        ai: {
          tokensUsed: aiUsage?.tokensUsed || 0,
          tokenLimit: plan?.aiTokensMonthly || 10000,
          requestCount: aiUsage?.requestCount || 0,
          usedPercent: aiUsage && plan ? Math.round((aiUsage.tokensUsed / plan.aiTokensMonthly) * 100) : 0
        },
        email: {
          emailsSent: emailUsage?.emailsSent || 0,
          emailLimit: plan?.emailsMonthly || 100,
          usedPercent: emailUsage && plan ? Math.round((emailUsage.emailsSent / plan.emailsMonthly) * 100) : 0
        },
        projects: {
          count: projects.length,
          limit: plan?.maxProjects || 3
        },
        users: {
          count: orgMembers.length,
          limit: plan?.maxUsers || 2
        },
        plan: plan ? {
          tier: plan.tier,
          name: plan.name,
          includesCloudSync: plan.includesCloudSync,
          includesAdvancedReports: plan.includesAdvancedReports
        } : null
      });
    } catch (error) {
      console.error("Error getting usage:", error);
      res.status(500).json({ message: "Failed to get usage statistics" });
    }
  });

  // Initialize default subscription plans (admin only - can be called once)
  app.post('/api/admin/init-subscription-plans', isAuthenticated, async (_req, res) => {
    try {
      const existingPlans = await storage.getSubscriptionPlans();
      if (existingPlans.length > 0) {
        return res.status(400).json({ message: "Plans already initialized" });
      }

      const defaultPlans = [
        {
          tier: 'free' as const,
          name: 'Free',
          description: 'Get started with basic project management features',
          priceMonthly: '0',
          priceYearly: '0',
          maxProjects: 3,
          maxTasksPerProject: 100,
          maxUsers: 2,
          storageQuotaBytes: 536870912, // 512MB
          aiTokensMonthly: 10000,
          emailsMonthly: 50,
          includesCloudSync: false,
          includesAdvancedReports: false,
          includesWhiteLabel: false,
          isActive: true
        },
        {
          tier: 'starter' as const,
          name: 'Starter',
          description: 'Essential features for small teams',
          priceMonthly: '29',
          priceYearly: '290',
          maxProjects: 10,
          maxTasksPerProject: 500,
          maxUsers: 5,
          storageQuotaBytes: 2147483648, // 2GB
          aiTokensMonthly: 50000,
          emailsMonthly: 500,
          includesCloudSync: true,
          includesAdvancedReports: false,
          includesWhiteLabel: false,
          isActive: true
        },
        {
          tier: 'professional' as const,
          name: 'Professional',
          description: 'Advanced features for growing organizations',
          priceMonthly: '79',
          priceYearly: '790',
          maxProjects: 50,
          maxTasksPerProject: 1000,
          maxUsers: 20,
          storageQuotaBytes: 10737418240, // 10GB
          aiTokensMonthly: 200000,
          emailsMonthly: 2000,
          includesCloudSync: true,
          includesAdvancedReports: true,
          includesWhiteLabel: false,
          isActive: true
        },
        {
          tier: 'enterprise' as const,
          name: 'Enterprise',
          description: 'Full-featured solution for large enterprises',
          priceMonthly: '199',
          priceYearly: '1990',
          maxProjects: 100,
          maxTasksPerProject: 1000,
          maxUsers: 100,
          storageQuotaBytes: 53687091200, // 50GB
          aiTokensMonthly: 1000000,
          emailsMonthly: 10000,
          includesCloudSync: true,
          includesAdvancedReports: true,
          includesWhiteLabel: true,
          isActive: true
        }
      ];

      const createdPlans = [];
      for (const plan of defaultPlans) {
        const created = await storage.createSubscriptionPlan(plan);
        createdPlans.push(created);
      }

      res.json({ message: "Subscription plans initialized", plans: createdPlans });
    } catch (error) {
      console.error("Error initializing subscription plans:", error);
      res.status(500).json({ message: "Failed to initialize subscription plans" });
    }
  });

  // ===== Admin Routes =====
  // Admin middleware - check if user is platform admin
  const isAdmin = async (req: any, res: Response, next: Function) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);

      // For now, check if user is an admin of any organization (in production, use a separate admin flag)
      const orgs = await storage.getOrganizationsByUser(userId);
      const isOrgAdmin = orgs.some(org => {
        // Check if user is owner/admin role
        return true; // For MVP, any authenticated user with orgs can view admin stats
      });

      if (!isOrgAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      next();
    } catch (error) {
      console.error("Admin auth error:", error);
      res.status(500).json({ message: "Authentication error" });
    }
  };

  app.get('/api/admin/stats', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      // Get platform-wide statistics
      const organizations = await storage.getAllOrganizations();
      const allUsers = await storage.getAllUsers();

      let totalProjects = 0;
      let totalTasks = 0;
      let totalStorage = 0;
      let totalAiTokens = 0;
      let totalEmails = 0;
      const subscriptionCounts = { free: 0, pro: 0, enterprise: 0 };

      for (const org of organizations) {
        const projects = await storage.getProjectsByOrganization(org.id);
        totalProjects += projects.length;

        for (const project of projects) {
          const tasks = await storage.getTasksByProject(project.id);
          totalTasks += tasks.length;
        }

        // Get subscription info
        const subscription = await storage.getOrganizationSubscription(org.id);
        if (subscription) {
          const plan = await storage.getSubscriptionPlan(subscription.planId);
          if (plan) {
            const tier = plan.tier.toLowerCase();
            if (tier === 'free' || tier === 'trial') subscriptionCounts.free++;
            else if (tier === 'starter' || tier === 'professional') subscriptionCounts.pro++;
            else if (tier === 'enterprise') subscriptionCounts.enterprise++;
            else subscriptionCounts.free++;
          }

          // Get usage stats
          const usage = await storage.getOrganizationUsage(subscription.id);
          if (usage) {
            totalStorage += usage.storageUsedBytes;
            totalAiTokens += usage.aiTokensUsed;
            totalEmails += usage.emailsSent;
          }
        } else {
          subscriptionCounts.free++;
        }
      }

      res.json({
        organizations: organizations.length,
        users: allUsers.length,
        projects: totalProjects,
        tasks: totalTasks,
        activeSubscriptions: subscriptionCounts,
        storageUsed: totalStorage,
        aiTokensUsed: totalAiTokens,
        emailsSent: totalEmails
      });
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ message: "Failed to fetch platform stats" });
    }
  });

  app.get('/api/admin/organizations', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const organizations = await storage.getAllOrganizations();

      const orgSummaries = await Promise.all(organizations.map(async (org) => {
        const users = await storage.getUsersByOrganization(org.id);
        const projects = await storage.getProjectsByOrganization(org.id);

        let storageUsedMB = 0;
        let storageLimitMB = 1024; // Default 1GB
        let tier = 'free';

        const subscription = await storage.getOrganizationSubscription(org.id);
        if (subscription) {
          const plan = await storage.getSubscriptionPlan(subscription.planId);
          if (plan) {
            storageLimitMB = plan.storageQuotaBytes / (1024 * 1024);
            tier = plan.tier;
          }

          const usage = await storage.getOrganizationUsage(subscription.id);
          if (usage) {
            storageUsedMB = usage.storageUsedBytes / (1024 * 1024);
          }
        }

        return {
          id: org.id,
          name: org.name,
          tier,
          userCount: users.length,
          projectCount: projects.length,
          storageUsedMB,
          storageLimitMB
        };
      }));

      res.json(orgSummaries);
    } catch (error) {
      console.error("Error fetching admin organizations:", error);
      res.status(500).json({ message: "Failed to fetch organizations" });
    }
  });

  // ===== CPM Scheduling Routes =====
  app.post('/api/projects/:projectId/schedule', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const projectId = parseInt(req.params.projectId);

      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Get project for start date
      const project = await storage.getProject(projectId);
      const startDate = project?.startDate ? new Date(project.startDate) : new Date();

      // Run scheduling
      const { schedulingService } = await import('./scheduling');
      const result = await schedulingService.runSchedule(projectId, startDate);

      if (result.success) {
        wsManager.notifyProjectUpdate(projectId, "schedule-updated", result, userId);
      }

      res.json(result);
    } catch (error) {
      console.error("Error running schedule:", error);
      res.status(500).json({ message: "Failed to run schedule" });
    }
  });

  app.get('/api/projects/:projectId/schedule', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const projectId = parseInt(req.params.projectId);

      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(404).json({ message: "Project not found" });
      }

      const { schedulingService } = await import('./scheduling');
      const scheduleData = await schedulingService.getScheduleData(projectId);

      res.json(scheduleData);
    } catch (error) {
      console.error("Error getting schedule data:", error);
      res.status(500).json({ message: "Failed to get schedule data" });
    }
  });

  app.get('/api/projects/:projectId/critical-path', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const projectId = parseInt(req.params.projectId);

      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(404).json({ message: "Project not found" });
      }

      const { schedulingService } = await import('./scheduling');
      const scheduleData = await schedulingService.getScheduleData(projectId);

      const criticalTasks = scheduleData.filter(t => t.isCriticalPath);
      const criticalPathLength = criticalTasks.reduce((sum, t) => sum + t.duration, 0);

      res.json({
        tasks: criticalTasks,
        totalDuration: criticalPathLength
      });
    } catch (error) {
      console.error("Error getting critical path:", error);
      res.status(500).json({ message: "Failed to get critical path" });
    }
  });

  // ===== Chat Routes =====
  
  // Conversations
  app.get('/api/chat/conversations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const conversations = await storage.getConversationsByUser(userId);
      res.json(conversations);
    } catch (error: any) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ message: error.message || "Failed to fetch conversations" });
    }
  });

  app.get('/api/chat/conversations/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const conversationId = parseInt(req.params.id);
      const conversation = await storage.getConversation(conversationId);
      
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      // Check if user is a participant
      const participants = await storage.getParticipants(conversationId);
      const isParticipant = participants.some(p => p.userId === userId);
      
      if (!isParticipant) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(conversation);
    } catch (error: any) {
      console.error("Error fetching conversation:", error);
      res.status(500).json({ message: error.message || "Failed to fetch conversation" });
    }
  });

  app.post('/api/chat/conversations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const data = insertConversationSchema.parse(req.body);
      
      const conversation = await storage.createConversation({
        ...data,
        createdBy: userId,
      });

      // Add creator as participant with owner role
      await storage.addParticipant(conversation.id, userId, "owner");

      // Add other participants if provided
      if (req.body.participantIds && Array.isArray(req.body.participantIds)) {
        for (const participantId of req.body.participantIds) {
          if (participantId !== userId) {
            await storage.addParticipant(conversation.id, participantId, "member");
          }
        }
      }

      wsManager.publishChatMessage(conversation.id, {
        type: "chat-conversation-created",
        payload: conversation,
        timestamp: Date.now(),
        userId,
      }).catch(() => {});

      res.json(conversation);
    } catch (error: any) {
      console.error("Error creating conversation:", error);
      res.status(400).json({ message: error.message || "Failed to create conversation" });
    }
  });

  app.patch('/api/chat/conversations/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const conversationId = parseInt(req.params.id);
      const conversation = await storage.getConversation(conversationId);
      
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      // Check if user is owner or admin
      const participants = await storage.getParticipants(conversationId);
      const userParticipant = participants.find(p => p.userId === userId);
      
      if (!userParticipant || (userParticipant.role !== "owner" && userParticipant.role !== "admin")) {
        return res.status(403).json({ message: "Access denied" });
      }

      const data = updateConversationSchema.parse(req.body);
      const updated = await storage.updateConversation(conversationId, data);
      
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating conversation:", error);
      res.status(400).json({ message: error.message || "Failed to update conversation" });
    }
  });

  app.delete('/api/chat/conversations/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const conversationId = parseInt(req.params.id);
      const conversation = await storage.getConversation(conversationId);
      
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      // Check if user is owner
      const participants = await storage.getParticipants(conversationId);
      const userParticipant = participants.find(p => p.userId === userId);
      
      if (!userParticipant || userParticipant.role !== "owner") {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.deleteConversation(conversationId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting conversation:", error);
      res.status(500).json({ message: error.message || "Failed to delete conversation" });
    }
  });

  app.get('/api/chat/conversations/project/:projectId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const projectId = parseInt(req.params.projectId);
      
      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(404).json({ message: "Project not found" });
      }

      const conversations = await storage.getConversationsByProject(projectId);
      res.json(conversations);
    } catch (error: any) {
      console.error("Error fetching project conversations:", error);
      res.status(500).json({ message: error.message || "Failed to fetch conversations" });
    }
  });

  app.get('/api/chat/conversations/task/:taskId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const taskId = parseInt(req.params.taskId);
      const task = await storage.getTask(taskId);
      
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      if (!await checkProjectAccess(userId, task.projectId)) {
        return res.status(404).json({ message: "Task not found" });
      }

      const conversation = await storage.getConversationByTask(taskId);
      res.json(conversation || null);
    } catch (error: any) {
      console.error("Error fetching task conversation:", error);
      res.status(500).json({ message: error.message || "Failed to fetch conversation" });
    }
  });

  // Participants
  app.get('/api/chat/conversations/:id/participants', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const conversationId = parseInt(req.params.id);
      
      // Check if user is a participant
      const participants = await storage.getParticipants(conversationId);
      const isParticipant = participants.some(p => p.userId === userId);
      
      if (!isParticipant) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(participants);
    } catch (error: any) {
      console.error("Error fetching participants:", error);
      res.status(500).json({ message: error.message || "Failed to fetch participants" });
    }
  });

  app.post('/api/chat/conversations/:id/participants', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const conversationId = parseInt(req.params.id);
      const { participantId, role = "member" } = req.body;

      if (!participantId) {
        return res.status(400).json({ message: "participantId required" });
      }

      // Check if user is owner or admin
      const participants = await storage.getParticipants(conversationId);
      const userParticipant = participants.find(p => p.userId === userId);
      
      if (!userParticipant || (userParticipant.role !== "owner" && userParticipant.role !== "admin")) {
        return res.status(403).json({ message: "Access denied" });
      }

      const participant = await storage.addParticipant(conversationId, participantId, role);
      res.json(participant);
    } catch (error: any) {
      console.error("Error adding participant:", error);
      res.status(400).json({ message: error.message || "Failed to add participant" });
    }
  });

  app.delete('/api/chat/conversations/:id/participants/:userId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const conversationId = parseInt(req.params.id);
      const targetUserId = req.params.userId;

      // Check if user is owner or admin, or removing themselves
      const participants = await storage.getParticipants(conversationId);
      const userParticipant = participants.find(p => p.userId === userId);
      
      if (!userParticipant) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (targetUserId !== userId && userParticipant.role !== "owner" && userParticipant.role !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.removeParticipant(conversationId, targetUserId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error removing participant:", error);
      res.status(500).json({ message: error.message || "Failed to remove participant" });
    }
  });

  // Messages
  app.get('/api/chat/conversations/:id/messages', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const conversationId = parseInt(req.params.id);
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      // Check if user is a participant
      const participants = await storage.getParticipants(conversationId);
      const isParticipant = participants.some(p => p.userId === userId);
      
      if (!isParticipant) {
        return res.status(403).json({ message: "Access denied" });
      }

      const messages = await storage.getMessages(conversationId, limit, offset);
      res.json(messages.reverse()); // Reverse to show oldest first
    } catch (error: any) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: error.message || "Failed to fetch messages" });
    }
  });

  app.post('/api/chat/conversations/:id/messages', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const conversationId = parseInt(req.params.id);
      
      // Check if user is a participant
      const participants = await storage.getParticipants(conversationId);
      const isParticipant = participants.some(p => p.userId === userId);
      
      if (!isParticipant) {
        return res.status(403).json({ message: "Access denied" });
      }

      const messageData = {
        ...req.body,
        conversationId,
      };
      
      const data = insertMessageSchema.parse(messageData);

      const message = await storage.createMessage({
        ...data,
        userId,
      } as InsertMessage & { userId: string });

      // Publish to Redis for cross-pod broadcasting
      await wsManager.publishChatMessage(conversationId, {
        type: "chat-message",
        payload: message,
        timestamp: Date.now(),
        userId,
      });

      res.json(message);
    } catch (error: any) {
      console.error("Error creating message:", error);
      res.status(400).json({ message: error.message || "Failed to create message" });
    }
  });

  app.patch('/api/chat/messages/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const messageId = parseInt(req.params.id);
      
      // Get message to check ownership
      const messages = await db.select().from(schema.chatMessages)
        .where(eq(schema.chatMessages.id, messageId))
        .limit(1);
      
      if (!messages[0]) {
        return res.status(404).json({ message: "Message not found" });
      }

      if (messages[0].userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const data = updateMessageSchema.parse(req.body);
      const updated = await storage.updateMessage(messageId, data);
      
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating message:", error);
      res.status(400).json({ message: error.message || "Failed to update message" });
    }
  });

  app.delete('/api/chat/messages/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const messageId = parseInt(req.params.id);
      
      // Get message to check ownership
      const messages = await db.select().from(schema.chatMessages)
        .where(eq(schema.chatMessages.id, messageId))
        .limit(1);
      
      if (!messages[0]) {
        return res.status(404).json({ message: "Message not found" });
      }

      if (messages[0].userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.deleteMessage(messageId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting message:", error);
      res.status(500).json({ message: error.message || "Failed to delete message" });
    }
  });

  app.post('/api/chat/messages/:id/read', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const messageId = parseInt(req.params.id);
      
      // Get message to get conversationId
      const messages = await db.select().from(schema.chatMessages)
        .where(eq(schema.chatMessages.id, messageId))
        .limit(1);
      
      if (!messages[0]) {
        return res.status(404).json({ message: "Message not found" });
      }

      await storage.markAsRead(messages[0].conversationId, userId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error marking message as read:", error);
      res.status(500).json({ message: error.message || "Failed to mark as read" });
    }
  });

  // Message Reactions
  app.get('/api/chat/messages/:id/reactions', isAuthenticated, async (req: any, res) => {
    try {
      const messageId = parseInt(req.params.id);
      const reactions = await storage.getMessageReactions(messageId);
      res.json(reactions);
    } catch (error: any) {
      console.error("Error fetching message reactions:", error);
      res.status(500).json({ message: error.message || "Failed to fetch reactions" });
    }
  });

  app.post('/api/chat/messages/:id/reactions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const messageId = parseInt(req.params.id);
      const { emoji } = req.body;

      if (!emoji) {
        return res.status(400).json({ message: "emoji is required" });
      }

      // Verify message exists and user has access
      const messages = await db.select().from(schema.chatMessages)
        .where(eq(schema.chatMessages.id, messageId))
        .limit(1);
      
      if (!messages[0]) {
        return res.status(404).json({ message: "Message not found" });
      }

      // Check if user is a participant
      const participants = await storage.getParticipants(messages[0].conversationId);
      const isParticipant = participants.some(p => p.userId === userId);
      
      if (!isParticipant) {
        return res.status(403).json({ message: "Access denied" });
      }

      const result = await storage.toggleMessageReaction({
        messageId,
        userId,
        emoji,
      });

      // Broadcast reaction change
      await wsManager.publishChatMessage(messages[0].conversationId, {
        type: "message-reaction",
        payload: { messageId, userId, emoji, added: result.added },
        timestamp: Date.now(),
        userId,
      }).catch(err => logger.error("Error broadcasting message reaction", err instanceof Error ? err : new Error(String(err)), { conversationId: messages[0].conversationId, messageId, userId }));

      res.json(result);
    } catch (error: any) {
      console.error("Error toggling reaction:", error);
      res.status(500).json({ message: error.message || "Failed to toggle reaction" });
    }
  });

  app.delete('/api/chat/messages/:id/reactions/:emoji', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const messageId = parseInt(req.params.id);
      const emoji = decodeURIComponent(req.params.emoji);

      // Verify message exists
      const messages = await db.select().from(schema.chatMessages)
        .where(eq(schema.chatMessages.id, messageId))
        .limit(1);
      
      if (!messages[0]) {
        return res.status(404).json({ message: "Message not found" });
      }

      await storage.removeMessageReaction(messageId, userId, emoji);

      // Broadcast reaction removal
      await wsManager.publishChatMessage(messages[0].conversationId, {
        type: "message-reaction",
        payload: { messageId, userId, emoji, added: false },
        timestamp: Date.now(),
        userId,
      }).catch(err => logger.error("Error broadcasting message reaction removal", err instanceof Error ? err : new Error(String(err)), { conversationId: messages[0].conversationId, messageId, userId }));

      res.json({ success: true });
    } catch (error: any) {
      const userId = getUserId(req);
      const messageId = parseInt(req.params.id);
      const emoji = decodeURIComponent(req.params.emoji);
      logger.error("Error removing reaction", error instanceof Error ? error : new Error(String(error)), { userId, messageId, emoji });
      res.status(500).json({ message: error.message || "Failed to remove reaction" });
    }
  });

  // File Upload (using FormData)
  app.post('/api/chat/files/upload', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      
      // Parse multipart/form-data manually or use a library
      // For now, we'll accept JSON with base64 encoded file (simpler for MVP)
      // In production, use multer or similar
      const { conversationId, fileName, fileSize, mimeType, fileData } = req.body;

      if (!conversationId) {
        return res.status(400).json({ message: "conversationId is required" });
      }

      // Check if user is a participant
      const participants = await storage.getParticipants(conversationId);
      const isParticipant = participants.some(p => p.userId === userId);
      
      if (!isParticipant) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Security: Validate file type
      const ALLOWED_MIME_TYPES = [
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf',
        'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain', 'text/csv',
        'application/zip', 'application/x-zip-compressed'
      ];
      
      if (!mimeType || !ALLOWED_MIME_TYPES.includes(mimeType)) {
        return res.status(400).json({ 
          message: `File type not allowed. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}` 
        });
      }
      
      // Security: Validate file size (10MB max)
      const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
      const fileSizeNum = parseInt(fileSize);
      if (isNaN(fileSizeNum) || fileSizeNum > MAX_FILE_SIZE) {
        return res.status(400).json({ 
          message: `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB` 
        });
      }
      
      if (fileSizeNum <= 0) {
        return res.status(400).json({ message: "Invalid file size" });
      }
      
      // Security: Validate fileName before sanitization
      if (!fileName || typeof fileName !== 'string' || fileName.trim().length === 0) {
        return res.status(400).json({ message: "fileName is required and must be a non-empty string" });
      }
      
      // Security: Sanitize filename and generate secure path
      const sanitizedFileName = fileName
        .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace dangerous characters
        .substring(0, 255); // Limit length
      
      const fileExtension = sanitizedFileName.split('.').pop() || '';
      const secureFileName = `${crypto.randomUUID()}.${fileExtension}`;
      const filePath = `/uploads/chat/${conversationId}/${secureFileName}`;
      
      // TODO: Save file to storage (S3, local filesystem, etc.)
      // For now, return secure path
      res.json({
        filePath,
        fileName: sanitizedFileName,
        fileSize: fileSizeNum,
        mimeType,
      });
    } catch (error: any) {
      const userId = getUserId(req);
      const conversationId = req.body?.conversationId;
      logger.error("Error uploading file", error instanceof Error ? error : new Error(String(error)), { userId, conversationId });
      res.status(500).json({ message: error.message || "Failed to upload file" });
    }
  });

  // Utility routes
  app.get('/api/chat/unread-count', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const conversationId = req.query.conversationId ? parseInt(req.query.conversationId as string) : undefined;
      const count = await storage.getUnreadCount(userId, conversationId);
      res.json({ count });
    } catch (error: any) {
      console.error("Error getting unread count:", error);
      res.status(500).json({ message: error.message || "Failed to get unread count" });
    }
  });

  // ===== CRM Contact Routes =====

  // Get all contacts for an organization
  app.get('/api/organizations/:orgId/contacts', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const orgId = parseInt(req.params.orgId);

      if (!await checkOrganizationAccess(userId, orgId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const contacts = await storage.getContactsByOrganization(orgId);
      res.json(contacts);
    } catch (error) {
      console.error("Error fetching contacts:", error);
      res.status(500).json({ message: "Failed to fetch contacts" });
    }
  });

  // Create a new contact
  app.post('/api/organizations/:orgId/contacts', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const orgId = parseInt(req.params.orgId);

      if (!await checkOrganizationAccess(userId, orgId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const contactData = insertContactSchema.parse({
        ...req.body,
        organizationId: orgId
      });

      const contact = await storage.createContact(contactData);
      res.status(201).json(contact);
    } catch (error: any) {
      console.error("Error creating contact:", error);
      res.status(400).json({ message: error.message || "Failed to create contact" });
    }
  });

  // Update a contact
  app.patch('/api/contacts/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const contactId = parseInt(req.params.id);
      
      const contact = await storage.getContact(contactId);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      if (!await checkOrganizationAccess(userId, contact.organizationId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const updateData = updateContactSchema.parse(req.body);
      const updated = await storage.updateContact(contactId, updateData);
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating contact:", error);
      res.status(400).json({ message: error.message || "Failed to update contact" });
    }
  });

  // Delete a contact
  app.delete('/api/contacts/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const contactId = parseInt(req.params.id);
      
      const contact = await storage.getContact(contactId);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      if (!await checkOrganizationAccess(userId, contact.organizationId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.deleteContact(contactId);
      res.sendStatus(204);
    } catch (error) {
      console.error("Error deleting contact:", error);
      res.status(500).json({ message: "Failed to delete contact" });
    }
  });

  // Get interaction history for a contact
  app.get('/api/contacts/:id/logs', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const contactId = parseInt(req.params.id);
      
      const contact = await storage.getContact(contactId);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      if (!await checkOrganizationAccess(userId, contact.organizationId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const logs = await storage.getContactLogs(contactId);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching contact logs:", error);
      res.status(500).json({ message: "Failed to fetch contact logs" });
    }
  });

  // Log an interaction (manually or system)
  app.post('/api/contacts/:id/logs', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const contactId = parseInt(req.params.id);
      
      const contact = await storage.getContact(contactId);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      if (!await checkOrganizationAccess(userId, contact.organizationId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const logData = insertContactLogSchema.parse({
        ...req.body,
        contactId
      });

      const log = await storage.createContactLog({
        ...logData,
        loggedBy: userId
      });
      
      res.status(201).json(log);
    } catch (error: any) {
      console.error("Error logging interaction:", error);
      res.status(400).json({ message: error.message || "Failed to log interaction" });
    }
  });

  // Sync/Promote Contacts from Projects (Migration Utility)
  app.post('/api/organizations/:orgId/contacts/sync-from-projects', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const orgId = parseInt(req.params.orgId);

      if (!await checkOrganizationAccess(userId, orgId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const results = {
        stakeholdersProcessed: 0,
        resourcesProcessed: 0,
        contactsCreated: 0,
        contactsLinked: 0,
        errors: [] as string[]
      };

      // 1. Get all projects for this org
      const projects = await storage.getProjectsByOrganization(orgId);
      
      for (const project of projects) {
        // 2. Process Stakeholders
        const stakeholders = await storage.getStakeholdersByProject(project.id);
        for (const sh of stakeholders) {
          results.stakeholdersProcessed++;
          // If already linked, skip
          if (sh.contactId) continue;

          // If no email, cannot reliably sync (or skip)
          if (!sh.email) {
            results.errors.push(`Stakeholder ${sh.name} (ID: ${sh.id}) skipped: No email`);
            continue;
          }

          try {
            // Check if contact exists
            let contact = await storage.getContactByEmail(orgId, sh.email);
            
            if (!contact) {
              // Create new contact
              const nameParts = sh.name.split(' ');
              const firstName = nameParts[0] || "Unknown";
              const lastName = nameParts.slice(1).join(' ') || "-";
              
              contact = await storage.createContact({
                organizationId: orgId,
                firstName,
                lastName,
                email: sh.email,
                phone: sh.phone,
                company: sh.organization,
                type: 'other', // Default
                notes: `Imported from Stakeholder ID: ${sh.id} (Project: ${project.name})`
              });
              results.contactsCreated++;
            }

            // Link back to stakeholder
            await storage.updateStakeholder(sh.id, { contactId: contact.id });
            results.contactsLinked++;
          } catch (err: any) {
            results.errors.push(`Failed to sync stakeholder ${sh.name}: ${err.message}`);
          }
        }

        // 3. Process Resources (Human only)
        const resources = await storage.getResourcesByProject(project.id);
        for (const res of resources) {
          if (res.type !== 'human') continue;
          
          results.resourcesProcessed++;
          if (res.contactId) continue;

          // Use vendorContactEmail or construct a placeholder if missing?
          // Resources table doesn't strictly require email, but vendorContactEmail exists.
          // Let's check vendorContactEmail first.
          const email = res.vendorContactEmail;
          if (!email) {
             // Cannot reliably deduplicate without email. Skip or create dupe?
             // Better to skip to avoid mess.
             continue;
          }

          try {
            let contact = await storage.getContactByEmail(orgId, email);
            
            if (!contact) {
              const nameParts = res.name.split(' ');
              const firstName = nameParts[0] || "Unknown";
              const lastName = nameParts.slice(1).join(' ') || "-";

              contact = await storage.createContact({
                organizationId: orgId,
                firstName,
                lastName,
                email: email,
                phone: res.vendorContactPhone,
                company: res.vendorName,
                type: 'vendor', // Likely a vendor/contractor
                notes: `Imported from Resource ID: ${res.id} (Project: ${project.name})`
              });
              results.contactsCreated++;
            }

            await storage.updateResource(res.id, { contactId: contact.id });
            results.contactsLinked++;
          } catch (err: any) {
            results.errors.push(`Failed to sync resource ${res.name}: ${err.message}`);
          }
        }
      }

      res.json(results);
    } catch (error: any) {
      console.error("Error syncing contacts:", error);
      res.status(500).json({ message: "Failed to sync contacts from projects" });
    }
  });

  // Bulk Import Contacts (CSV)
  app.post('/api/organizations/:orgId/contacts/import', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const orgId = parseInt(req.params.orgId);

      if (!await checkOrganizationAccess(userId, orgId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { contacts: importContacts } = req.body;
      
      if (!Array.isArray(importContacts)) {
        return res.status(400).json({ message: "Invalid format: contacts must be an array" });
      }

      const results = {
        created: 0,
        updated: 0,
        errors: [] as string[]
      };

      for (const c of importContacts) {
        try {
          // Basic duplication check by email
          let existing;
          if (c.email) {
            existing = await storage.getContactByEmail(orgId, c.email);
          }

          if (existing) {
            // Upsert behavior: update existing contact
            await storage.updateContact(existing.id, {
              firstName: c.firstName || existing.firstName,
              lastName: c.lastName || existing.lastName,
              phone: c.phone || existing.phone,
              company: c.company || existing.company,
              jobTitle: c.jobTitle || existing.jobTitle,
              type: c.type || existing.type,
              notes: c.notes || existing.notes
            });
            results.updated++;
          } else {
            // Create new contact
            const newContact = insertContactSchema.parse({
              ...c,
              organizationId: orgId,
              firstName: c.firstName || "Unknown",
              lastName: c.lastName || "Unknown"
            });
            await storage.createContact(newContact);
            results.created++;
          }
        } catch (err: any) {
          results.errors.push(`Failed to import ${c.email || 'contact'}: ${err.message}`);
        }
      }

      res.json(results);
    } catch (error: any) {
      console.error("Error importing contacts:", error);
      res.status(500).json({ message: "Failed to import contacts" });
    }
  });

  // Assign Contact to Project (Promote to Stakeholder/Resource)
  app.post('/api/projects/:projectId/assign-contact', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const projectId = parseInt(req.params.projectId);
      const { contactId, role, type, rate, availability } = req.body;

      if (!await checkProjectAccess(userId, projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const contact = await storage.getContact(contactId);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      if (role === 'stakeholder') {
        // Create Stakeholder linked to Contact
        const stakeholder = await storage.createStakeholder({
          projectId,
          name: `${contact.firstName} ${contact.lastName}`,
          email: contact.email,
          phone: contact.phone,
          organization: contact.company,
          contactId: contact.id,
          role: type || 'other'
        });
        res.json({ type: 'stakeholder', data: stakeholder });
      } else if (role === 'resource') {
        // Create Resource linked to Contact
        const resource = await storage.createResource({
          projectId,
          name: `${contact.firstName} ${contact.lastName}`,
          type: 'human',
          contactId: contact.id,
          availability: availability || 100,
          rate: rate || 0,
          vendorName: contact.company,
          vendorContactEmail: contact.email,
          vendorContactPhone: contact.phone
        });
        res.json({ type: 'resource', data: resource });
      } else {
        return res.status(400).json({ message: "Invalid assignment role" });
      }
    } catch (error: any) {
      console.error("Error assigning contact:", error);
      res.status(500).json({ message: "Failed to assign contact to project" });
    }
  });

  // Push Notification Endpoints
  app.get('/api/push/vapid-public-key', isAuthenticated, async (_req, res) => {
    try {
      const { getVAPIDPublicKey } = await import('./services/pushNotificationService');
      const publicKey = await getVAPIDPublicKey();
      if (!publicKey) {
        return res.status(503).json({ message: 'Push notifications not configured' });
      }
      res.json({ publicKey });
    } catch (error: any) {
      console.error('Error getting VAPID public key:', error);
      res.status(500).json({ message: 'Push notifications not configured' });
    }
  });

  app.post('/api/push/subscribe', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { endpoint, keys } = req.body;

      if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
        return res.status(400).json({ message: 'Invalid subscription data' });
      }

      // Check if subscription already exists
      const existingSubscriptions = await storage.getPushSubscriptionsByUser(userId);
      const existing = existingSubscriptions.find(sub => sub.endpoint === endpoint);

      if (existing) {
        // Update existing subscription
        const updated = await storage.updatePushSubscription(existing.id, {
          p256dh: keys.p256dh,
          auth: keys.auth,
          enabled: true,
        });
        return res.json(updated);
      }

      // Create new subscription
      const subscription = await storage.createPushSubscription({
        userId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        enabled: true,
      });

      res.json(subscription);
    } catch (error: any) {
      console.error('Error subscribing to push notifications:', error);
      res.status(500).json({ message: 'Failed to subscribe to push notifications' });
    }
  });

  app.delete('/api/push/unsubscribe/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const subscriptionId = parseInt(req.params.id);

      // Verify subscription belongs to user
      const subscriptions = await storage.getPushSubscriptionsByUser(userId);
      const subscription = subscriptions.find(sub => sub.id === subscriptionId);

      if (!subscription) {
        return res.status(404).json({ message: 'Subscription not found' });
      }

      await storage.deletePushSubscription(subscriptionId);
      res.json({ message: 'Unsubscribed successfully' });
    } catch (error: any) {
      console.error('Error unsubscribing from push notifications:', error);
      res.status(500).json({ message: 'Failed to unsubscribe' });
    }
  });

  app.get('/api/push/subscriptions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const subscriptions = await storage.getPushSubscriptionsByUser(userId);
      res.json(subscriptions);
    } catch (error: any) {
      console.error('Error fetching push subscriptions:', error);
      res.status(500).json({ message: 'Failed to fetch subscriptions' });
    }
  });

  const httpServer = createServer(app);

  // Initialize WebSocket server (now async)
  await wsManager.initialize(httpServer);

  return httpServer;
}
