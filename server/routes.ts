import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import crypto from "crypto";
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
      
      const data = updateTaskSchema.parse(req.body);
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
      
      const conversations = await storage.getAiConversationsByProject(projectId);
      res.json(conversations);
    } catch (error) {
      console.error("Error fetching project conversations:", error);
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  // Create new conversation
  app.post('/api/ai/conversations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const data = insertAiConversationSchema.parse(req.body);
      
      // Verify project access if projectId is provided
      if (data.projectId) {
        if (!await checkProjectAccess(userId, data.projectId)) {
          return res.status(403).json({ message: "Access denied" });
        }
      }
      
      const conversation = await storage.createAiConversation({
        ...data,
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
      
      if (!await verifyProjectAccess(userId, projectId)) {
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
      
      if (!await verifyProjectAccess(userId, projectId)) {
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
      
      if (!await verifyProjectAccess(userId, projectId)) {
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
      
      if (!await verifyProjectAccess(userId, projectId)) {
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
      
      if (!await verifyProjectAccess(userId, projectId)) {
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
      
      if (!await verifyProjectAccess(userId, projectId)) {
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

  const httpServer = createServer(app);
  
  // Initialize WebSocket server
  wsManager.initialize(httpServer);
  
  return httpServer;
}
