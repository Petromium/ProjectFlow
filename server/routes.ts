import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import {
  insertOrganizationSchema,
  insertProjectSchema,
  insertTaskSchema,
  insertStakeholderSchema,
  insertRiskSchema,
  insertIssueSchema,
  insertCostItemSchema,
  updateProjectSchema,
  updateTaskSchema,
  updateStakeholderSchema,
  updateRiskSchema,
  updateIssueSchema,
  updateCostItemSchema
} from "@shared/schema";

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
      
      const data = updateTaskSchema.parse(req.body);
      const updated = await storage.updateTask(id, data);
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
      res.json(updated);
    } catch (error) {
      console.error("Error updating stakeholder:", error);
      res.status(400).json({ message: "Failed to update stakeholder" });
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
      
      const risk = await storage.createRisk(data);
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
      
      const risk = await storage.getRisk(id);
      if (!risk) {
        return res.status(404).json({ message: "Risk not found" });
      }
      
      // Check access
      if (!await checkProjectAccess(userId, risk.projectId)) {
        return res.status(404).json({ message: "Risk not found" });
      }
      
      const data = updateRiskSchema.parse(req.body);
      const updated = await storage.updateRisk(id, data);
      res.json(updated);
    } catch (error) {
      console.error("Error updating risk:", error);
      res.status(400).json({ message: "Failed to update risk" });
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
      
      const issue = await storage.createIssue({
        ...data,
        reportedBy: userId,
      });
      
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
      
      const issue = await storage.getIssue(id);
      if (!issue) {
        return res.status(404).json({ message: "Issue not found" });
      }
      
      // Check access
      if (!await checkProjectAccess(userId, issue.projectId)) {
        return res.status(404).json({ message: "Issue not found" });
      }
      
      const data = updateIssueSchema.parse(req.body);
      const updated = await storage.updateIssue(id, data);
      res.json(updated);
    } catch (error) {
      console.error("Error updating issue:", error);
      res.status(400).json({ message: "Failed to update issue" });
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
      res.json(updated);
    } catch (error) {
      console.error("Error updating cost item:", error);
      res.status(400).json({ message: "Failed to update cost item" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
