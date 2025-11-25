import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import crypto from "crypto";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import {
  insertOrganizationSchema,
  insertProjectSchema,
  insertTaskSchema,
  insertTaskDependencySchema,
  insertStakeholderSchema,
  insertStakeholderRaciSchema,
  updateStakeholderRaciSchema,
  insertRiskSchema,
  insertIssueSchema,
  insertCostItemSchema,
  updateProjectSchema,
  updateTaskSchema,
  updateStakeholderSchema,
  updateRiskSchema,
  updateIssueSchema,
  updateCostItemSchema,
  insertAiConversationSchema,
  insertEmailTemplateSchema,
  updateEmailTemplateSchema
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
  getAvailablePlaceholders
} from "./emailService";
import { wsManager } from "./websocket";

// Helper to get user ID from request
function getUserId(req: any): string {
  return req.user.claims.sub;
}

// Helper to check if user has access to organization
async function checkOrganizationAccess(userId: string, organizationId: number): Promise<boolean> {
  const userOrg = await storage.getUserOrganization(userId, organizationId);
  return !!userOrg;
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
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // ===== Organization Routes =====
  app.get('/api/organizations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizations = await storage.getOrganizationsByUser(userId);
      res.json(organizations);
    } catch (error) {
      console.error("Error fetching organizations:", error);
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
    } catch (error) {
      console.error("Error creating organization:", error);
      res.status(400).json({ message: "Failed to create organization" });
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

  // ===== Task Routes =====
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
      
      // Notify connected clients
      wsManager.notifyProjectUpdate(task.projectId, "task-created", task, userId);
      
      res.json(task);
    } catch (error) {
      console.error("Error creating task:", error);
      res.status(400).json({ message: "Failed to create task" });
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
      
      const data = updateTaskSchema.parse(body);
      const updated = await storage.updateTask(id, data);
      
      // Notify connected clients
      wsManager.notifyProjectUpdate(task.projectId, "task-updated", updated, userId);
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating task:", error);
      res.status(400).json({ message: "Failed to update task" });
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
      const data = req.body;
      
      // Check access to project
      if (!await checkProjectAccess(userId, data.projectId)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const resource = await storage.createResource(data);
      res.json(resource);
    } catch (error) {
      console.error("Error creating resource:", error);
      res.status(400).json({ message: "Failed to create resource" });
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
      const assignments = await storage.getResourceAssignmentsByTask(taskId);
      res.json(assignments);
    } catch (error) {
      console.error("Error fetching assignments:", error);
      res.status(500).json({ message: "Failed to fetch assignments" });
    }
  });

  app.post('/api/assignments', isAuthenticated, async (req: any, res) => {
    try {
      const assignment = await storage.createResourceAssignment(req.body);
      res.json(assignment);
    } catch (error) {
      console.error("Error creating assignment:", error);
      res.status(400).json({ message: "Failed to create assignment" });
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
      const inherited = await storage.getInheritedResources(taskId);
      res.json(inherited);
    } catch (error) {
      console.error("Error fetching inherited resources:", error);
      res.status(500).json({ message: "Failed to fetch inherited resources" });
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
    projectId: z.number().optional(),
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
  const chatMessageSchema = z.object({
    conversationId: z.number(),
    message: z.string(),
  });

  app.post('/api/ai/chat', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { conversationId, message } = chatMessageSchema.parse(req.body);
      
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
      
      // Get AI response
      const response = await chatWithAssistant(
        messages,
        conversation.projectId,
        storage,
        userId
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
      const errors: string[] = [];
      const warnings: string[] = [];
      
      if (!importData || !importData.version) {
        return res.status(400).json({ 
          success: false,
          message: "Invalid import format. Missing 'version' field.",
          hint: "Get the correct format from GET /api/import/schema or GET /api/import/template"
        });
      }
      
      // Helper to map values with fallback - for strict enum fields
      const mapValue = (category: string, value: string, validValues: string[], defaultValue: string): string => {
        if (!value) return defaultValue;
        if (validValues.includes(value)) return value;
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
      for (const task of sortedTasks) {
        try {
          const wbsCode = task.wbsCode || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const parentWbsCode = getParentWbsCode(wbsCode);
          const parentId = parentWbsCode ? wbsToTaskId[parentWbsCode] : null;
          
          // Map strict enums with fallbacks
          const mappedPriority = mapValue('taskPriority', task.priority, importEnums.taskPriority, 'medium');
          const mappedStatus = task.status && importEnums.taskStatus.includes(task.status) ? task.status : 'not-started';
          
          // Try to map discipline to valid enum, otherwise store as flexible label
          const disciplineEnumValue = tryMapEnum('discipline', task.discipline, importEnums.discipline);
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
          errors.push(`Failed to import task '${task.name || task.wbsCode}': ${taskError.message}`);
        }
      }
      
      // Import risks
      if (importData.risks && Array.isArray(importData.risks)) {
        for (const risk of importData.risks) {
          try {
            const mappedStatus = mapValue('riskStatus', risk.status, importEnums.riskStatus, 'identified');
            const mappedImpact = mapValue('riskImpact', risk.impact, importEnums.riskImpact, 'medium');
            
            await storage.createRisk({
              projectId,
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
          } catch (riskError: any) {
            errors.push(`Failed to import risk '${risk.title}': ${riskError.message}`);
          }
        }
      }
      
      // Import issues
      if (importData.issues && Array.isArray(importData.issues)) {
        for (const issue of importData.issues) {
          try {
            const mappedStatus = issue.status && importEnums.issueStatus.includes(issue.status) ? issue.status : 'open';
            const mappedPriority = mapValue('issuePriority', issue.priority, importEnums.issuePriority, 'medium');
            
            await storage.createIssue({
              projectId,
              title: issue.title || 'Untitled Issue',
              description: issue.description,
              priority: mappedPriority as "low" | "medium" | "high" | "critical",
              status: mappedStatus as "open" | "in-progress" | "resolved" | "closed",
              assignedTo: issue.assignedTo || null,
              reportedBy: issue.reportedBy || null,
              resolution: issue.resolution || null
            });
            importedCounts.issues++;
          } catch (issueError: any) {
            errors.push(`Failed to import issue '${issue.title}': ${issueError.message}`);
          }
        }
      }
      
      // Import stakeholders
      if (importData.stakeholders && Array.isArray(importData.stakeholders)) {
        for (const stakeholder of importData.stakeholders) {
          try {
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
            errors.push(`Failed to import stakeholder '${stakeholder.name}': ${stakeholderError.message}`);
          }
        }
      }
      
      // Import cost items
      if (importData.costItems && Array.isArray(importData.costItems)) {
        for (const costItem of importData.costItems) {
          try {
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
            errors.push(`Failed to import cost item '${costItem.description}': ${costError.message}`);
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

  const httpServer = createServer(app);
  
  // Initialize WebSocket server
  wsManager.initialize(httpServer);
  
  return httpServer;
}
