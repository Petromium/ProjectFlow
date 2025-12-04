import OpenAI from "openai";
import { GoogleGenAI } from '@google/genai';
import * as crypto from "crypto";
import type { IStorage } from "./storage";
import type { InsertTask, InsertRisk, InsertIssue, InsertStakeholder, InsertProject } from "@shared/schema";
import { logger } from "./lib/logger";
import { db } from "./db";
import * as schema from "@shared/schema";
import { eq } from "drizzle-orm";

// Initialize OpenAI (legacy/fallback)
const openaiApiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
const openai = openaiApiKey ? new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: openaiApiKey
}) : null;

// Initialize Gemini API (direct API, not Vertex AI)
const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
const geminiClient = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;

// Available Gemini models (current versions, not discontinued 1.5)
export const GEMINI_MODELS = {
  'gemini-2.5-pro': {
    name: 'gemini-2.5-pro',
    displayName: 'Gemini 2.5 Pro',
    description: 'Best reasoning for complex analysis',
    tier: 'premium' as const,
    limits: '150 RPM, 2M TPM, 10K/day',
    cost: 'Higher cost'
  },
  'gemini-2.5-flash': {
    name: 'gemini-2.5-flash',
    displayName: 'Gemini 2.5 Flash',
    description: 'Balanced performance and speed',
    tier: 'standard' as const,
    limits: '1K RPM, 1M TPM, 10K/day',
    cost: 'Standard cost'
  },
  'gemini-2.5-flash-lite': {
    name: 'gemini-2.5-flash-lite',
    displayName: 'Gemini 2.5 Flash Lite',
    description: 'High throughput for simple queries',
    tier: 'standard' as const,
    limits: '4K RPM, 4M TPM, Unlimited/day',
    cost: 'Standard cost'
  }
} as const;

// Default model (can be overridden by user selection)
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const FALLBACK_GEMINI_MODEL = 'gemini-2.5-flash-lite';

// Define available functions for the AI assistant (OpenAI Format)
const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_project_overview",
      description: "Get comprehensive overview of a project including tasks, risks, issues, stakeholders, and cost data",
      parameters: {
        type: "object",
        properties: {
          projectId: {
            type: "number",
            description: "The project ID"
          }
        },
        required: ["projectId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_lessons_learned",
      description: "Search the organization's Lessons Learned knowledge base. Use this to find past solutions, risks, and best practices before suggesting actions.",
      parameters: {
        type: "object",
        properties: {
          organizationId: { type: "number", description: "The organization ID" },
          query: { type: "string", description: "Search query (e.g., 'concrete', 'vendor delay', 'safety audit')" }
        },
        required: ["organizationId", "query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "analyze_project_risks",
      description: "Analyze project risks and provide risk assessment with high-priority items",
      parameters: {
        type: "object",
        properties: {
          projectId: {
            type: "number",
            description: "The project ID"
          }
        },
        required: ["projectId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "analyze_resource_workload",
      description: "Analyze resource allocation and workload distribution across tasks",
      parameters: {
        type: "object",
        properties: {
          projectId: {
            type: "number",
            description: "The project ID"
          }
        },
        required: ["projectId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_task",
      description: "Create a new task in the project",
      parameters: {
        type: "object",
        properties: {
          projectId: { type: "number" },
          title: { type: "string" },
          description: { type: "string" },
          assignee: { type: "string" },
          status: { type: "string", enum: ["not-started", "in-progress", "review", "completed", "on-hold"] },
          priority: { type: "string", enum: ["low", "medium", "high", "critical"] },
          estimatedHours: { type: "number" },
          startDate: { type: "string", format: "date-time" },
          endDate: { type: "string", format: "date-time" }
        },
        required: ["projectId", "title"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_task",
      description: "Update an existing task's properties like estimatedHours, name, description, priority, status, dates, etc. Always set previewMode=true to show preview first.",
      parameters: {
        type: "object",
        properties: {
          taskId: { type: "number", description: "The task ID to update" },
          changes: {
            type: "object",
            properties: {
              name: { type: "string" },
              description: { type: "string" },
              estimatedHours: { type: "number", description: "Estimated hours for the task" },
              actualHours: { type: "number" },
              status: { type: "string", enum: ["not-started", "in-progress", "review", "completed", "on-hold"] },
              priority: { type: "string", enum: ["low", "medium", "high", "critical"] },
              startDate: { type: "string", format: "date-time" },
              endDate: { type: "string", format: "date-time" },
              progress: { type: "number", minimum: 0, maximum: 100 },
            }
          },
          previewMode: { type: "boolean", default: true }
        },
        required: ["taskId", "changes"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "bulk_update_tasks",
      description: "Update multiple tasks at once. Useful for updating estimatedHours for many tasks. Always set previewMode=true to show preview first. Parent task estimatedHours will be automatically calculated as sum of children if updateParentHours=true.",
      parameters: {
        type: "object",
        properties: {
          projectId: { type: "number", description: "The project ID" },
          updates: {
            type: "array",
            description: "Array of task updates",
            items: {
              type: "object",
              properties: {
                taskId: { type: "number" },
                changes: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    description: { type: "string" },
                    estimatedHours: { type: "number" },
                    actualHours: { type: "number" },
                    status: { type: "string", enum: ["not-started", "in-progress", "review", "completed", "on-hold"] },
                    priority: { type: "string", enum: ["low", "medium", "high", "critical"] },
                    startDate: { type: "string", format: "date-time" },
                    endDate: { type: "string", format: "date-time" },
                    progress: { type: "number", minimum: 0, maximum: 100 },
                  }
                }
              },
              required: ["taskId", "changes"]
            }
          },
          updateParentHours: { type: "boolean", default: true, description: "If true, automatically calculate parent task estimatedHours as sum of children" },
          previewMode: { type: "boolean", default: true }
        },
        required: ["projectId", "updates"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_risk",
      description: "Create a new risk in the project. Always set previewMode=true to show preview first.",
      parameters: {
        type: "object",
        properties: {
          projectId: { type: "number" },
          title: { type: "string" },
          description: { type: "string" },
          category: { type: "string" },
          probability: { type: "number", minimum: 1, maximum: 5 },
          impact: { type: "string", enum: ["low", "medium", "high", "critical"] },
          mitigationPlan: { type: "string" },
          previewMode: { type: "boolean", default: true }
        },
        required: ["projectId", "title"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_risk",
      description: "Update an existing risk. Always set previewMode=true to show preview first.",
      parameters: {
        type: "object",
        properties: {
          riskId: { type: "number" },
          changes: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              status: { type: "string", enum: ["identified", "assessed", "mitigating", "closed"] },
              probability: { type: "number", minimum: 1, maximum: 5 },
              impact: { type: "string", enum: ["low", "medium", "high", "critical"] },
              mitigationPlan: { type: "string" },
            }
          },
          previewMode: { type: "boolean", default: true }
        },
        required: ["riskId", "changes"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_risk",
      description: "Delete a risk. Always set previewMode=true to show preview first. WARNING: This cannot be undone.",
      parameters: {
        type: "object",
        properties: {
          riskId: { type: "number" },
          previewMode: { type: "boolean", default: true }
        },
        required: ["riskId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_issue",
      description: "Create a new issue in the project. Always set previewMode=true to show preview first.",
      parameters: {
        type: "object",
        properties: {
          projectId: { type: "number" },
          title: { type: "string" },
          description: { type: "string" },
          priority: { type: "string", enum: ["low", "medium", "high", "critical"] },
          category: { type: "string" },
          assignedTo: { type: "string" },
          previewMode: { type: "boolean", default: true }
        },
        required: ["projectId", "title"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_issue",
      description: "Update an existing issue. Always set previewMode=true to show preview first.",
      parameters: {
        type: "object",
        properties: {
          issueId: { type: "number" },
          changes: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              status: { type: "string", enum: ["open", "in-progress", "resolved", "closed"] },
              priority: { type: "string", enum: ["low", "medium", "high", "critical"] },
              assignedTo: { type: "string" },
              resolution: { type: "string" },
            }
          },
          previewMode: { type: "boolean", default: true }
        },
        required: ["issueId", "changes"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_issue",
      description: "Delete an issue. Always set previewMode=true to show preview first. WARNING: This cannot be undone.",
      parameters: {
        type: "object",
        properties: {
          issueId: { type: "number" },
          previewMode: { type: "boolean", default: true }
        },
        required: ["issueId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "assign_resource_to_task",
      description: "Assign a resource to a task. Always set previewMode=true to show preview first.",
      parameters: {
        type: "object",
        properties: {
          taskId: { type: "number" },
          resourceId: { type: "number" },
          allocation: { type: "number", minimum: 1, maximum: 200, default: 100 },
          effortHours: { type: "number" },
          previewMode: { type: "boolean", default: true }
        },
        required: ["taskId", "resourceId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_project_from_ai",
      description: "Create a new EPC project based on user description, attached files, and conversation. Always uses previewMode=true to show preview first. Can generate comprehensive project structure including initial tasks (up to 200), risks (up to 200), and milestones based on project type and requirements.",
      parameters: {
        type: "object",
        properties: {
          organizationId: { type: "number", description: "The organization ID for the project" },
          name: { type: "string", description: "Project name" },
          code: { type: "string", description: "Project code (e.g., PRJ-2024-001)" },
          description: { type: "string", description: "Detailed project description" },
          startDate: { type: "string", format: "date-time", description: "Project start date" },
          endDate: { type: "string", format: "date-time", description: "Project end date" },
          budget: { type: "number", description: "Project budget" },
          currency: { type: "string", description: "Currency code (default: USD)" },
          status: { type: "string", enum: ["planning", "active", "on-hold", "completed", "archived"], description: "Initial project status" },
          initialTasks: {
            type: "array",
            description: "Initial tasks to create with the project (up to 200 tasks). Should be comprehensive and cover all project phases.",
            maxItems: 200,
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                description: { type: "string" },
                estimatedHours: { type: "number" },
                priority: { type: "string", enum: ["low", "medium", "high", "critical"] },
                startDate: { type: "string", format: "date-time" },
                endDate: { type: "string", format: "date-time" },
                parentTaskIndex: { type: "number", description: "Index of parent task in initialTasks array (for hierarchy)" }
              },
              required: ["title"]
            }
          },
          initialRisks: {
            type: "array",
            description: "Initial risks to create with the project (up to 200 risks). Should cover common EPC project risks for the project type.",
            maxItems: 200,
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                description: { type: "string" },
                category: { type: "string", description: "Risk category (e.g., Technical, Financial, Schedule, Safety, Environmental)" },
                probability: { type: "number", minimum: 1, maximum: 5, description: "Probability rating 1-5" },
                impact: { type: "string", enum: ["low", "medium", "high", "critical"] },
                mitigationPlan: { type: "string", description: "Mitigation strategy" }
              },
              required: ["title"]
            }
          },
          questions: {
            type: "array",
            description: "Questions the AI needs answered before creating the project",
            items: { type: "string" }
          },
          previewMode: { type: "boolean", default: true }
        },
        required: ["organizationId", "name", "code", "previewMode"]
      }
    }
  }
];

// Helper to verify project access
async function verifyProjectAccess(
  projectId: number,
  userId: string,
  storage: IStorage
): Promise<void> {
  const project = await storage.getProject(projectId);
  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  const userOrg = await storage.getUserOrganization(userId, project.organizationId);
  if (!userOrg) {
    throw new Error(`Access denied to project ${projectId}`);
  }
}

// Execution mode enum
export enum ExecutionMode {
  PREVIEW = 'preview',    // Return preview, don't execute
  EXECUTE = 'execute'     // Actually perform the action
}

// Action preview interface
export interface ActionPreview {
  actionId: string;
  type: 'create' | 'update' | 'delete' | 'bulk';
  entity: string;
  description: string;
  changes: ActionChange[];
  affectedIds?: number[];
  warnings?: string[];
  preview?: any;
}

export interface ActionChange {
  field: string;
  oldValue?: any;
  newValue: any;
  type: 'add' | 'modify' | 'remove';
}

// Generate preview for an action
export async function generatePreview(
  name: string,
  args: any,
  storage: IStorage,
  userId: string
): Promise<ActionPreview> {
  const actionId = `ai_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  
  switch (name) {
    case "create_task": {
      await verifyProjectAccess(args.projectId, userId, storage);
      
      return {
        actionId,
        type: 'create',
        entity: 'task',
        description: `Create new task "${args.title}"`,
        changes: [
          { field: 'name', newValue: args.title, type: 'add' },
          { field: 'description', newValue: args.description || null, type: 'add' },
          { field: 'status', newValue: args.status || 'not-started', type: 'add' },
          { field: 'priority', newValue: args.priority || 'medium', type: 'add' },
          { field: 'assignedTo', newValue: args.assignee || null, type: 'add' },
          { field: 'estimatedHours', newValue: args.estimatedHours || null, type: 'add' },
          { field: 'startDate', newValue: args.startDate || null, type: 'add' },
          { field: 'endDate', newValue: args.endDate || null, type: 'add' },
        ],
        warnings: args.assignee ? [] : ['Task will be created without an assignee'],
        preview: {
          name: args.title,
          description: args.description,
          status: args.status || 'not-started',
          priority: args.priority || 'medium',
          assignedTo: args.assignee,
          estimatedHours: args.estimatedHours,
          startDate: args.startDate,
          endDate: args.endDate,
        }
      };
    }

    case "create_risk": {
      await verifyProjectAccess(args.projectId, userId, storage);
      
      const existingRisks = await storage.getRisksByProject(args.projectId);
      const nextNumber = existingRisks.length + 1;
      const code = `RISK-${String(nextNumber).padStart(3, '0')}`;
      
      return {
        actionId,
        type: 'create',
        entity: 'risk',
        description: `Create new risk "${args.title}"`,
        changes: [
          { field: 'code', newValue: code, type: 'add' },
          { field: 'title', newValue: args.title, type: 'add' },
          { field: 'description', newValue: args.description || null, type: 'add' },
          { field: 'category', newValue: args.category || null, type: 'add' },
          { field: 'status', newValue: 'identified', type: 'add' },
          { field: 'probability', newValue: args.probability || 3, type: 'add' },
          { field: 'impact', newValue: args.impact || 'medium', type: 'add' },
          { field: 'mitigationPlan', newValue: args.mitigationPlan || null, type: 'add' },
        ],
        preview: {
          code,
          title: args.title,
          description: args.description,
          category: args.category,
          status: 'identified',
          probability: args.probability || 3,
          impact: args.impact || 'medium',
          mitigationPlan: args.mitigationPlan,
        }
      };
    }

    case "create_issue": {
      await verifyProjectAccess(args.projectId, userId, storage);
      
      const existingIssues = await storage.getIssuesByProject(args.projectId);
      const nextNumber = existingIssues.length + 1;
      const code = `ISS-${String(nextNumber).padStart(3, '0')}`;
      
      return {
        actionId,
        type: 'create',
        entity: 'issue',
        description: `Create new issue "${args.title}"`,
        changes: [
          { field: 'code', newValue: code, type: 'add' },
          { field: 'title', newValue: args.title, type: 'add' },
          { field: 'description', newValue: args.description || null, type: 'add' },
          { field: 'status', newValue: 'open', type: 'add' },
          { field: 'priority', newValue: args.priority || 'medium', type: 'add' },
          { field: 'category', newValue: args.category || null, type: 'add' },
          { field: 'assignedTo', newValue: args.assignedTo || null, type: 'add' },
        ],
        warnings: args.assignedTo ? [] : ['Issue will be created without an assignee'],
        preview: {
          code,
          title: args.title,
          description: args.description,
          status: 'open',
          priority: args.priority || 'medium',
          category: args.category,
          assignedTo: args.assignedTo,
        }
      };
    }

    case "create_project_from_ai": {
      const { organizationId, name, code, description, startDate, endDate, budget, currency, status, initialTasks, initialRisks, questions } = args;
      
      // Verify organization access
      const userOrg = await storage.getUserOrganization(userId, organizationId);
      if (!userOrg) {
        throw new Error("Access denied to organization");
      }
      
      // Validate limits (safety check)
      const tasksCount = initialTasks?.length || 0;
      const risksCount = initialRisks?.length || 0;
      
      if (tasksCount > 200) {
        throw new Error("Maximum 200 initial tasks allowed");
      }
      if (risksCount > 200) {
        throw new Error("Maximum 200 initial risks allowed");
      }
      
      return {
        actionId,
        type: 'create',
        entity: 'project',
        description: `Create new project: ${name}`,
        changes: [
          { field: 'name', newValue: name, type: 'add' },
          { field: 'code', newValue: code, type: 'add' },
          { field: 'description', newValue: description || '', type: 'add' },
          { field: 'startDate', newValue: startDate || null, type: 'add' },
          { field: 'endDate', newValue: endDate || null, type: 'add' },
          { field: 'budget', newValue: budget || null, type: 'add' },
          { field: 'currency', newValue: currency || 'USD', type: 'add' },
          { field: 'status', newValue: status || 'planning', type: 'add' },
          { field: 'initialTasks', newValue: `${tasksCount} tasks`, type: 'add' },
          { field: 'initialRisks', newValue: `${risksCount} risks`, type: 'add' }
        ],
        preview: {
          project: { 
            name, 
            code, 
            description, 
            startDate, 
            endDate, 
            budget, 
            currency: currency || 'USD', 
            status: status || 'planning' 
          },
          initialTasks: initialTasks || [],
          initialRisks: initialRisks || [],
          questions: questions || [],
          summary: {
            tasksCount,
            risksCount,
            totalItems: tasksCount + risksCount
          }
        }
      };
    }

    case "update_task": {
      const { taskId, changes } = args;
      
      // Verify task exists and user has access
      const task = await storage.getTask(taskId);
      if (!task) {
        throw new Error(`Task ${taskId} not found`);
      }
      await verifyProjectAccess(task.projectId, userId, storage);
      
      const changeList: ActionChange[] = [];
      if (changes.name !== undefined) {
        changeList.push({ field: 'name', oldValue: task.name, newValue: changes.name, type: 'modify' });
      }
      if (changes.description !== undefined) {
        changeList.push({ field: 'description', oldValue: task.description || null, newValue: changes.description || null, type: 'modify' });
      }
      if (changes.estimatedHours !== undefined) {
        changeList.push({ field: 'estimatedHours', oldValue: task.estimatedHours ? parseFloat(task.estimatedHours.toString()) : null, newValue: changes.estimatedHours, type: 'modify' });
      }
      if (changes.actualHours !== undefined) {
        changeList.push({ field: 'actualHours', oldValue: task.actualHours ? parseFloat(task.actualHours.toString()) : null, newValue: changes.actualHours, type: 'modify' });
      }
      if (changes.status !== undefined) {
        changeList.push({ field: 'status', oldValue: task.status, newValue: changes.status, type: 'modify' });
      }
      if (changes.priority !== undefined) {
        changeList.push({ field: 'priority', oldValue: task.priority, newValue: changes.priority, type: 'modify' });
      }
      if (changes.startDate !== undefined) {
        changeList.push({ field: 'startDate', oldValue: task.startDate || null, newValue: changes.startDate || null, type: 'modify' });
      }
      if (changes.endDate !== undefined) {
        changeList.push({ field: 'endDate', oldValue: task.endDate || null, newValue: changes.endDate || null, type: 'modify' });
      }
      if (changes.progress !== undefined) {
        changeList.push({ field: 'progress', oldValue: task.progress, newValue: changes.progress, type: 'modify' });
      }
      
      return {
        actionId,
        type: 'update',
        entity: 'task',
        description: `Update task "${task.name}" (ID: ${taskId})`,
        changes: changeList,
        affectedIds: [taskId],
        preview: {
          taskId,
          taskName: task.name,
          wbsCode: task.wbsCode,
          changes: changes,
          currentValues: {
            name: task.name,
            description: task.description,
            estimatedHours: task.estimatedHours ? parseFloat(task.estimatedHours.toString()) : null,
            status: task.status,
            priority: task.priority,
          }
        }
      };
    }

    case "bulk_update_tasks": {
      const { projectId, updates, updateParentHours } = args;
      
      // Verify project access
      await verifyProjectAccess(projectId, userId, storage);
      
      // Get all tasks in project to build hierarchy
      const allTasks = await storage.getTasksByProject(projectId);
      const taskMap = new Map(allTasks.map(t => [t.id!, t]));
      
      const changeList: ActionChange[] = [];
      const affectedTaskIds: number[] = [];
      const taskUpdates: Array<{ taskId: number; taskName: string; wbsCode: string; changes: any; currentValues: any }> = [];
      const warnings: string[] = [];
      
      // Process each update
      for (const update of updates) {
        const task = taskMap.get(update.taskId);
        if (!task) {
          warnings.push(`Task ${update.taskId} not found - skipping update`);
          continue; // Skip missing tasks instead of throwing
        }
        
        affectedTaskIds.push(update.taskId);
        const taskChanges: any = {};
        const currentValues: any = {
          name: task.name,
          estimatedHours: task.estimatedHours ? parseFloat(task.estimatedHours.toString()) : null,
        };
        
        if (update.changes.name !== undefined) {
          changeList.push({ field: `task_${update.taskId}_name`, oldValue: task.name, newValue: update.changes.name, type: 'modify' });
          taskChanges.name = update.changes.name;
        }
        if (update.changes.description !== undefined) {
          changeList.push({ field: `task_${update.taskId}_description`, oldValue: task.description || null, newValue: update.changes.description || null, type: 'modify' });
          taskChanges.description = update.changes.description;
        }
        if (update.changes.estimatedHours !== undefined) {
          const oldHours = task.estimatedHours ? parseFloat(task.estimatedHours.toString()) : null;
          changeList.push({ field: `task_${update.taskId}_estimatedHours`, oldValue: oldHours, newValue: update.changes.estimatedHours, type: 'modify' });
          taskChanges.estimatedHours = update.changes.estimatedHours;
        }
        if (update.changes.actualHours !== undefined) {
          const oldHours = task.actualHours ? parseFloat(task.actualHours.toString()) : null;
          changeList.push({ field: `task_${update.taskId}_actualHours`, oldValue: oldHours, newValue: update.changes.actualHours, type: 'modify' });
          taskChanges.actualHours = update.changes.actualHours;
        }
        if (update.changes.status !== undefined) {
          changeList.push({ field: `task_${update.taskId}_status`, oldValue: task.status, newValue: update.changes.status, type: 'modify' });
          taskChanges.status = update.changes.status;
        }
        if (update.changes.priority !== undefined) {
          changeList.push({ field: `task_${update.taskId}_priority`, oldValue: task.priority, newValue: update.changes.priority, type: 'modify' });
          taskChanges.priority = update.changes.priority;
        }
        if (update.changes.startDate !== undefined) {
          changeList.push({ field: `task_${update.taskId}_startDate`, oldValue: task.startDate || null, newValue: update.changes.startDate || null, type: 'modify' });
          taskChanges.startDate = update.changes.startDate;
        }
        if (update.changes.endDate !== undefined) {
          changeList.push({ field: `task_${update.taskId}_endDate`, oldValue: task.endDate || null, newValue: update.changes.endDate || null, type: 'modify' });
          taskChanges.endDate = update.changes.endDate;
        }
        if (update.changes.progress !== undefined) {
          changeList.push({ field: `task_${update.taskId}_progress`, oldValue: task.progress, newValue: update.changes.progress, type: 'modify' });
          taskChanges.progress = update.changes.progress;
        }
        
        taskUpdates.push({
          taskId: update.taskId,
          taskName: task.name,
          wbsCode: task.wbsCode,
          changes: taskChanges,
          currentValues
        });
      }
      
      // Calculate parent task hours if requested
      const parentUpdates: Array<{ taskId: number; taskName: string; wbsCode: string; newEstimatedHours: number }> = [];
      if (updateParentHours) {
        // Build parent-child map
        const childrenByParent = new Map<number, typeof allTasks>();
        for (const task of allTasks) {
          if (task.parentId) {
            if (!childrenByParent.has(task.parentId)) {
              childrenByParent.set(task.parentId, []);
            }
            childrenByParent.get(task.parentId)!.push(task);
          }
        }
        
        // Calculate parent hours for all affected parents
        const affectedParents = new Set<number>();
        for (const update of updates) {
          const task = taskMap.get(update.taskId);
          if (task?.parentId) {
            affectedParents.add(task.parentId);
          }
        }
        
        for (const parentId of Array.from(affectedParents)) {
          const parent = taskMap.get(parentId);
          if (!parent) continue;
          
          const children = childrenByParent.get(parentId) || [];
          // Use updated hours from updates array if available, otherwise use current task hours
          const childrenHours = children.map(child => {
            const update = updates.find((u: { taskId: number }) => u.taskId === child.id);
            if (update?.changes?.estimatedHours !== undefined) {
              return update.changes.estimatedHours;
            }
            return child.estimatedHours ? parseFloat(child.estimatedHours.toString()) : 0;
          });
          
          const totalHours = childrenHours.reduce((sum, hours) => sum + (hours || 0), 0);
          const currentHours = parent.estimatedHours ? parseFloat(parent.estimatedHours.toString()) : 0;
          
          if (totalHours !== currentHours) {
            parentUpdates.push({
              taskId: parentId,
              taskName: parent.name,
              wbsCode: parent.wbsCode,
              newEstimatedHours: totalHours
            });
            changeList.push({
              field: `task_${parentId}_estimatedHours`,
              oldValue: currentHours,
              newValue: totalHours,
              type: 'modify'
            });
            affectedTaskIds.push(parentId);
          }
        }
      }
      
      // Combine warnings
      const allWarnings: string[] = [];
      if (warnings.length > 0) {
        allWarnings.push(...warnings);
      }
      if (parentUpdates.length > 0) {
        allWarnings.push(`${parentUpdates.length} parent task(s) will have estimatedHours updated to sum of children`);
      }
      
      return {
        actionId,
        type: 'bulk',
        entity: 'task',
        description: `Update ${taskUpdates.length} task(s)${parentUpdates.length > 0 ? ` and ${parentUpdates.length} parent task(s)` : ''}${warnings.length > 0 ? ` (${warnings.length} task(s) skipped - not found)` : ''}`,
        changes: changeList,
        affectedIds: affectedTaskIds,
        warnings: allWarnings.length > 0 ? allWarnings : undefined,
        preview: {
          taskUpdates,
          parentUpdates: parentUpdates.length > 0 ? parentUpdates : undefined,
          updateParentHours,
          skippedTasks: warnings.length > 0 ? warnings : undefined
        }
      };
    }

    default:
      throw new Error(`Preview not supported for function: ${name}`);
  }
}

// Helper function to generate WBS code for a task
async function generateWbsCodeForTask(
  storage: IStorage,
  projectId: number,
  parentId: number | null
): Promise<string> {
  // Get all tasks in the project
  const allTasks = await storage.getTasksByProject(projectId);
  
  // Filter tasks with the same parent
  const siblings = allTasks.filter(t => (t.parentId || null) === parentId);
  
  // Sort siblings by existing WBS code or creation order
  siblings.sort((a, b) => {
    if (a.wbsCode && b.wbsCode && a.wbsCode !== 'TBD' && b.wbsCode !== 'TBD') {
      return a.wbsCode.localeCompare(b.wbsCode);
    }
    return (a.id || 0) - (b.id || 0);
  });
  
  // If parent exists, get parent's WBS code
  if (parentId) {
    const parent = allTasks.find(t => t.id === parentId);
    if (parent && parent.wbsCode && parent.wbsCode !== 'TBD') {
      const nextIndex = siblings.length + 1;
      return `${parent.wbsCode}.${nextIndex}`;
    }
  }
  
  // Root level: find the highest root-level number
  const rootTasks = siblings.filter(t => !t.parentId);
  const rootNumbers = rootTasks
    .map(t => {
      if (t.wbsCode && t.wbsCode !== 'TBD') {
        const match = t.wbsCode.match(/^(\d+)/);
        return match ? parseInt(match[1]) : 0;
      }
      return 0;
    })
    .filter(n => n > 0);
  
  const nextRootNumber = rootNumbers.length > 0 ? Math.max(...rootNumbers) + 1 : siblings.length + 1;
  return `${nextRootNumber}`;
}

// Execute function calls
export async function executeFunctionCall(
  name: string,
  args: any,
  storage: IStorage,
  userId: string,
  mode: ExecutionMode = ExecutionMode.EXECUTE
): Promise<string> {
  // If preview mode, return preview instead of executing
  if (mode === ExecutionMode.PREVIEW) {
    const preview = await generatePreview(name, args, storage, userId);
    return JSON.stringify({ preview, actionId: preview.actionId });
  }
  try {
    switch (name) {
      case "get_project_overview": {
        const { projectId } = args;
        // Verify access
        await verifyProjectAccess(projectId, userId, storage);

        const [tasks, risks, issues, stakeholders, costItems] = await Promise.all([
          storage.getTasksByProject(projectId),
          storage.getRisksByProject(projectId),
          storage.getIssuesByProject(projectId),
          storage.getStakeholdersByProject(projectId),
          storage.getCostItemsByProject(projectId)
        ]);

        // Fetch tags for project and entities
        const project = await storage.getProject(projectId);
        const projectTags = project ? await storage.getTagsForEntity("project", projectId) : [];
        
        // Fetch tags for tasks, risks, and issues
        const taskTagsPromises = tasks.map(t => storage.getTagsForEntity("task", t.id));
        const riskTagsPromises = risks.map(r => storage.getTagsForEntity("risk", r.id));
        const issueTagsPromises = issues.map(i => storage.getTagsForEntity("issue", i.id));
        
        const [taskTagsArray, riskTagsArray, issueTagsArray] = await Promise.all([
          Promise.all(taskTagsPromises),
          Promise.all(riskTagsPromises),
          Promise.all(issueTagsPromises)
        ]);

        return JSON.stringify({
          project: {
            tags: projectTags.map(t => t.name)
          },
          tasks: {
            total: tasks.length,
            byStatus: tasks.reduce((acc, t) => ({ ...acc, [t.status]: (acc[t.status as string] || 0) + 1 }), {} as Record<string, number>),
            byPriority: tasks.reduce((acc, t) => ({ ...acc, [t.priority]: (acc[t.priority as string] || 0) + 1 }), {} as Record<string, number>),
            list: tasks.map((t, idx) => ({
              id: t.id,
              name: t.name,
              wbsCode: t.wbsCode || `#${t.id}`,
              status: t.status,
              priority: t.priority,
              estimatedHours: t.estimatedHours ? parseFloat(t.estimatedHours.toString()) : null,
              tags: taskTagsArray[idx]?.map(tag => tag.name) || []
            }))
          },
          risks: {
            total: risks.length,
            byStatus: risks.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status as string] || 0) + 1 }), {} as Record<string, number>),
            highImpact: risks.filter(r => r.impact === 'critical' || r.impact === 'high').length,
            list: risks.map((r, idx) => ({
              id: r.id,
              code: r.code,
              title: r.title,
              status: r.status,
              impact: r.impact,
              probability: r.probability,
              tags: riskTagsArray[idx]?.map(tag => tag.name) || []
            }))
          },
          issues: {
            total: issues.length,
            byStatus: issues.reduce((acc, i) => ({ ...acc, [i.status]: (acc[i.status as string] || 0) + 1 }), {} as Record<string, number>),
            highPriority: issues.filter(i => i.priority === 'critical' || i.priority === 'high').length,
            list: issues.map((i, idx) => ({
              id: i.id,
              code: i.code,
              title: i.title,
              status: i.status,
              priority: i.priority,
              issueType: i.issueType,
              tags: issueTagsArray[idx]?.map(tag => tag.name) || []
            }))
          },
          stakeholders: {
            total: stakeholders.length,
            byRole: stakeholders.reduce((acc, s) => ({ ...acc, [s.role]: (acc[s.role as string] || 0) + 1 }), {} as Record<string, number>)
          },
          costs: {
            totalBudgeted: costItems.reduce((sum, c) => sum + parseFloat(c.budgeted.toString()), 0),
            totalActual: costItems.reduce((sum, c) => sum + parseFloat(c.actual.toString()), 0)
          }
        });
      }

      case "search_lessons_learned": {
        const { organizationId, query } = args;
        // Verify access (using getUserOrganization directly as getOrganization doesn't check user access)
        const userOrg = await storage.getUserOrganization(userId, organizationId);
        if (!userOrg) {
          throw new Error(`Access denied to organization ${organizationId}`);
        }

        const lessons = await storage.searchLessonsLearned(organizationId, query);
        return JSON.stringify({
          query,
          count: lessons.length,
          lessons: lessons.map(l => ({
            title: l.title,
            category: l.category,
            description: l.description,
            rootCause: l.rootCause,
            actionTaken: l.actionTaken,
            outcome: l.outcome,
            impactRating: l.impactRating,
            tags: l.tags
          }))
        });
      }

      case "analyze_project_risks": {
        const { projectId } = args;
        // Verify access
        await verifyProjectAccess(projectId, userId, storage);

        const risks = await storage.getRisksByProject(projectId);

        const riskScore = (r: any) => r.probability * (r.impact === 'critical' ? 5 : r.impact === 'high' ? 4 : r.impact === 'medium' ? 3 : r.impact === 'low' ? 2 : 1);
        const sortedRisks = risks.sort((a, b) => riskScore(b) - riskScore(a));

        return JSON.stringify({
          totalRisks: risks.length,
          highPriorityRisks: sortedRisks.slice(0, 5).map(r => ({
            code: r.code,
            title: r.title,
            probability: r.probability,
            impact: r.impact,
            status: r.status,
            score: riskScore(r)
          })),
          byCategory: risks.reduce((acc, r) => {
            const cat = r.category || 'uncategorized';
            return { ...acc, [cat]: (acc[cat] || 0) + 1 };
          }, {} as Record<string, number>),
          unmitigated: risks.filter(r => r.status === 'identified').length
        });
      }

      case "analyze_resource_workload": {
        const { projectId } = args;
        // Verify access
        await verifyProjectAccess(projectId, userId, storage);

        const tasks = await storage.getTasksByProject(projectId);

        const workloadByAssignee = tasks.reduce((acc, t) => {
          if (t.assignedTo) {
            if (!acc[t.assignedTo]) {
              acc[t.assignedTo] = {
                totalTasks: 0,
                totalHours: 0,
                byStatus: {} as Record<string, number>
              };
            }
            acc[t.assignedTo].totalTasks++;
            acc[t.assignedTo].totalHours += parseFloat(t.estimatedHours?.toString() || '0');
            acc[t.assignedTo].byStatus[t.status] = (acc[t.assignedTo].byStatus[t.status] || 0) + 1;
          }
          return acc;
        }, {} as Record<string, any>);

        return JSON.stringify({
          totalAssigned: tasks.filter(t => t.assignedTo).length,
          unassigned: tasks.filter(t => !t.assignedTo).length,
          workloadByAssignee
        });
      }

      case "create_task": {
        // Verify access
        await verifyProjectAccess(args.projectId, userId, storage);

        const taskData: InsertTask = {
          projectId: args.projectId,
          name: args.title,
          description: args.description || null,
          assignedTo: args.assignee || null,
          status: args.status || 'not-started',
          priority: args.priority || 'medium',
          estimatedHours: args.estimatedHours || null,
          startDate: args.startDate ? new Date(args.startDate) : null,
          endDate: args.endDate ? new Date(args.endDate) : null,
          progress: 0,
          parentId: null,
          wbsCode: await generateWbsCodeForTask(storage, args.projectId, null),
          actualHours: null,
          createdBy: userId
        };

        const task = await storage.createTask(taskData);
        return JSON.stringify({ success: true, task });
      }

      case "update_task": {
        const { taskId, changes } = args;
        
        // Verify task exists and user has access
        const task = await storage.getTask(taskId);
        if (!task) {
          throw new Error(`Task ${taskId} not found`);
        }
        await verifyProjectAccess(task.projectId, userId, storage);

        // Build update data
        const updateData: any = {};
        if (changes.name !== undefined) updateData.name = changes.name;
        if (changes.description !== undefined) updateData.description = changes.description || null;
        if (changes.estimatedHours !== undefined) updateData.estimatedHours = changes.estimatedHours?.toString() || null;
        if (changes.actualHours !== undefined) updateData.actualHours = changes.actualHours?.toString() || null;
        if (changes.status !== undefined) updateData.status = changes.status;
        if (changes.priority !== undefined) updateData.priority = changes.priority;
        if (changes.startDate !== undefined) updateData.startDate = changes.startDate ? new Date(changes.startDate) : null;
        if (changes.endDate !== undefined) updateData.endDate = changes.endDate ? new Date(changes.endDate) : null;
        if (changes.progress !== undefined) updateData.progress = changes.progress;

        const updated = await storage.updateTask(taskId, updateData);
        return JSON.stringify({ success: true, task: updated });
      }

      case "bulk_update_tasks": {
        const { projectId, updates, updateParentHours } = args;
        
        // Verify project access
        await verifyProjectAccess(projectId, userId, storage);
        
        // Get all tasks in project to build hierarchy
        const allTasks = await storage.getTasksByProject(projectId);
        const taskMap = new Map(allTasks.map(t => [t.id!, t]));
        
        const updatedTasks: any[] = [];
        const errors: Array<{ taskId: number; error: string }> = [];
        
        // Process each update
        for (const update of updates) {
          try {
            const task = taskMap.get(update.taskId);
            if (!task) {
              errors.push({ taskId: update.taskId, error: "Task not found" });
              continue;
            }
            
            // Build update data
            const updateData: any = {};
            if (update.changes.name !== undefined) updateData.name = update.changes.name;
            if (update.changes.description !== undefined) updateData.description = update.changes.description || null;
            if (update.changes.estimatedHours !== undefined) updateData.estimatedHours = update.changes.estimatedHours?.toString() || null;
            if (update.changes.actualHours !== undefined) updateData.actualHours = update.changes.actualHours?.toString() || null;
            if (update.changes.status !== undefined) updateData.status = update.changes.status;
            if (update.changes.priority !== undefined) updateData.priority = update.changes.priority;
            if (update.changes.startDate !== undefined) updateData.startDate = update.changes.startDate ? new Date(update.changes.startDate) : null;
            if (update.changes.endDate !== undefined) updateData.endDate = update.changes.endDate ? new Date(update.changes.endDate) : null;
            if (update.changes.progress !== undefined) updateData.progress = update.changes.progress;
            
            const updated = await storage.updateTask(update.taskId, updateData);
            updatedTasks.push(updated);
            
            // Update taskMap with new values for parent calculation
            if (updated) {
              taskMap.set(update.taskId, updated);
            }
          } catch (error) {
            errors.push({ taskId: update.taskId, error: error instanceof Error ? error.message : String(error) });
          }
        }
        
        // Calculate and update parent task hours if requested
        const parentUpdates: any[] = [];
        if (updateParentHours) {
          // Build parent-child map
          const childrenByParent = new Map<number, typeof allTasks>();
          for (const task of allTasks) {
            if (task.parentId) {
              if (!childrenByParent.has(task.parentId)) {
                childrenByParent.set(task.parentId, []);
              }
              childrenByParent.get(task.parentId)!.push(task);
            }
          }
          
          // Find all affected parents
          const affectedParents = new Set<number>();
          for (const update of updates) {
            const task = taskMap.get(update.taskId);
            if (task?.parentId) {
              affectedParents.add(task.parentId);
            }
          }
          
          // Update each affected parent
          for (const parentId of Array.from(affectedParents)) {
            const parent = taskMap.get(parentId);
            if (!parent) continue;
            
            const children = childrenByParent.get(parentId) || [];
            // Calculate sum of children hours (use updated values from taskMap)
            const childrenHours = children.map(child => {
              const updatedChild = taskMap.get(child.id!);
              return updatedChild?.estimatedHours ? parseFloat(updatedChild.estimatedHours.toString()) : 0;
            });
            
            const totalHours = childrenHours.reduce((sum, hours) => sum + (hours || 0), 0);
            const currentHours = parent.estimatedHours ? parseFloat(parent.estimatedHours.toString()) : 0;
            
            if (totalHours !== currentHours) {
              const updated = await storage.updateTask(parentId, {
                estimatedHours: totalHours.toString()
              });
              if (updated) {
                parentUpdates.push(updated);
                taskMap.set(parentId, updated);
              }
            }
          }
        }
        
        return JSON.stringify({
          success: true,
          updatedTasks: updatedTasks.length,
          parentUpdates: parentUpdates.length,
          tasks: updatedTasks,
          parentTasks: parentUpdates,
          errors: errors.length > 0 ? errors : undefined
        });
      }

      case "create_risk": {
        // Verify access
        await verifyProjectAccess(args.projectId, userId, storage);

        const existingRisks = await storage.getRisksByProject(args.projectId);
        const nextNumber = existingRisks.length + 1;
        const code = `RISK-${String(nextNumber).padStart(3, '0')}`;

        const riskData: InsertRisk = {
          projectId: args.projectId,
          code,
          title: args.title,
          description: args.description || null,
          category: args.category || null,
          status: 'identified',
          probability: args.probability || 3,
          impact: args.impact || 'medium',
          mitigationPlan: args.mitigationPlan || null,
          owner: null,
          identifiedDate: new Date()
        };

        const risk = await storage.createRisk(riskData);
        return JSON.stringify({ success: true, risk });
      }

      case "update_risk": {
        const { riskId, changes } = args;
        
        // Verify risk exists and user has access
        const risk = await storage.getRisk(riskId);
        if (!risk) {
          throw new Error(`Risk ${riskId} not found`);
        }
        await verifyProjectAccess(risk.projectId, userId, storage);

        // Build update data
        const updateData: any = {};
        if (changes.title !== undefined) updateData.title = changes.title;
        if (changes.description !== undefined) updateData.description = changes.description;
        if (changes.status !== undefined) updateData.status = changes.status;
        if (changes.probability !== undefined) updateData.probability = changes.probability;
        if (changes.impact !== undefined) updateData.impact = changes.impact;
        if (changes.mitigationPlan !== undefined) updateData.mitigationPlan = changes.mitigationPlan;

        const updated = await storage.updateRisk(riskId, updateData);
        return JSON.stringify({ success: true, risk: updated });
      }

      case "delete_risk": {
        const { riskId } = args;
        
        // Verify risk exists and user has access
        const risk = await storage.getRisk(riskId);
        if (!risk) {
          throw new Error(`Risk ${riskId} not found`);
        }
        await verifyProjectAccess(risk.projectId, userId, storage);

        await storage.deleteRisk(riskId);
        return JSON.stringify({ success: true, deletedRiskId: riskId });
      }

      case "create_issue": {
        // Verify access
        await verifyProjectAccess(args.projectId, userId, storage);

        const existingIssues = await storage.getIssuesByProject(args.projectId);
        const nextNumber = existingIssues.length + 1;
        const code = `ISS-${String(nextNumber).padStart(3, '0')}`;

        const issueData: InsertIssue = {
          projectId: args.projectId,
          code,
          title: args.title,
          description: args.description || null,
          status: 'open',
          priority: args.priority || 'medium',
          category: args.category || null,
          assignedTo: args.assignedTo || null,
          reportedBy: userId,
          reportedDate: new Date(),
          resolvedDate: null,
          resolution: null
        };

        const issue = await storage.createIssue(issueData);
        return JSON.stringify({ success: true, issue });
      }

      case "update_issue": {
        const { issueId, changes } = args;
        
        // Verify issue exists and user has access
        const issue = await storage.getIssue(issueId);
        if (!issue) {
          throw new Error(`Issue ${issueId} not found`);
        }
        await verifyProjectAccess(issue.projectId, userId, storage);

        // Build update data
        const updateData: any = {};
        if (changes.title !== undefined) updateData.title = changes.title;
        if (changes.description !== undefined) updateData.description = changes.description;
        if (changes.status !== undefined) {
          updateData.status = changes.status;
          if (changes.status === 'resolved' || changes.status === 'closed') {
            updateData.resolvedDate = new Date();
          }
        }
        if (changes.priority !== undefined) updateData.priority = changes.priority;
        if (changes.assignedTo !== undefined) updateData.assignedTo = changes.assignedTo;
        if (changes.resolution !== undefined) updateData.resolution = changes.resolution;

        const updated = await storage.updateIssue(issueId, updateData);
        return JSON.stringify({ success: true, issue: updated });
      }

      case "delete_issue": {
        const { issueId } = args;
        
        // Verify issue exists and user has access
        const issue = await storage.getIssue(issueId);
        if (!issue) {
          throw new Error(`Issue ${issueId} not found`);
        }
        await verifyProjectAccess(issue.projectId, userId, storage);

        await storage.deleteIssue(issueId);
        return JSON.stringify({ success: true, deletedIssueId: issueId });
      }

      case "assign_resource_to_task": {
        const { taskId, resourceId, allocation, effortHours } = args;
        
        // Verify task exists and user has access
        const task = await storage.getTask(taskId);
        if (!task) {
          throw new Error(`Task ${taskId} not found`);
        }
        await verifyProjectAccess(task.projectId, userId, storage);

        // Verify resource exists and belongs to same project
        const resource = await storage.getResource(resourceId);
        if (!resource) {
          throw new Error(`Resource ${resourceId} not found`);
        }
        if (resource.projectId !== task.projectId) {
          throw new Error("Resource belongs to different project");
        }

        // Check if assignment already exists
        const existingAssignments = await storage.getResourceAssignmentsByTask(taskId);
        const existing = existingAssignments.find(a => a.resourceId === resourceId);
        
        if (existing) {
          // Update existing assignment
          const updated = await db.update(schema.resourceAssignments)
            .set({
              allocation: allocation || existing.allocation,
              effortHours: effortHours !== undefined ? effortHours.toString() : existing.effortHours,
              updatedAt: new Date(),
            })
            .where(eq(schema.resourceAssignments.id, existing.id))
            .returning();
          return JSON.stringify({ success: true, assignment: updated[0], action: 'updated' });
        } else {
          // Create new assignment
          const assignment = await storage.createResourceAssignment({
            taskId,
            resourceId,
            allocation: allocation || 100,
            effortHours: effortHours !== undefined ? effortHours.toString() : null,
          });
          return JSON.stringify({ success: true, assignment, action: 'created' });
        }
      }

      case "create_project_from_ai": {
        const { organizationId, name, code, description, startDate, endDate, budget, currency, status, initialTasks, initialRisks } = args;
        
        // Verify organization access
        const userOrg = await storage.getUserOrganization(userId, organizationId);
        if (!userOrg) {
          throw new Error("Access denied to organization");
        }
        
        // Validate limits
        const tasksCount = initialTasks?.length || 0;
        const risksCount = initialRisks?.length || 0;
        
        if (tasksCount > 200) {
          throw new Error("Maximum 200 initial tasks allowed");
        }
        if (risksCount > 200) {
          throw new Error("Maximum 200 initial risks allowed");
        }
        
        // Execute creation
        const projectData: InsertProject = {
          organizationId,
          name,
          code,
          description: description || undefined,
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : undefined,
          budget: budget ? budget.toString() : undefined,
          currency: currency || 'USD',
          status: status || 'planning'
        };
        
        const project = await storage.createProject(projectData);
        
        let tasksCreated = 0;
        let risksCreated = 0;
        
        // Create initial tasks if provided (support hierarchy via parentTaskIndex)
        if (initialTasks && initialTasks.length > 0) {
          const taskMap = new Map<number, number>(); // Maps array index to created task ID
          
          // First pass: Create all tasks
          for (let i = 0; i < initialTasks.length; i++) {
            const task = initialTasks[i];
            const parentId = task.parentTaskIndex !== undefined && task.parentTaskIndex >= 0 && task.parentTaskIndex < i
              ? taskMap.get(task.parentTaskIndex) || null
              : null;
            
            const createdTask = await storage.createTask({
              projectId: project.id,
              name: task.title,
              description: task.description || null,
              estimatedHours: task.estimatedHours || null,
              priority: task.priority || 'medium',
              startDate: task.startDate ? new Date(task.startDate) : null,
              endDate: task.endDate ? new Date(task.endDate) : null,
              status: 'not-started',
              progress: 0,
              parentId,
              wbsCode: await generateWbsCodeForTask(storage, project.id, parentId),
              actualHours: null,
              createdBy: userId
            });
            
            taskMap.set(i, createdTask.id);
            tasksCreated++;
          }
        }
        
        // Create initial risks if provided
        if (initialRisks && initialRisks.length > 0) {
          for (const risk of initialRisks) {
            const existingRisks = await storage.getRisksByProject(project.id);
            const nextNumber = existingRisks.length + 1;
            const riskCode = `RISK-${String(nextNumber).padStart(3, '0')}`;
            
            const riskData: InsertRisk = {
              projectId: project.id,
              code: riskCode,
              title: risk.title,
              description: risk.description || null,
              category: risk.category || null,
              status: 'identified',
              probability: risk.probability || 3,
              impact: risk.impact || 'medium',
              mitigationPlan: risk.mitigationPlan || null,
              owner: null,
              identifiedDate: new Date()
            };
            
            await storage.createRisk(riskData);
            risksCreated++;
          }
        }
        
        return JSON.stringify({ 
          success: true, 
          project, 
          tasksCreated,
          risksCreated,
          summary: {
            projectId: project.id,
            projectName: project.name,
            tasksCreated,
            risksCreated,
            totalItemsCreated: tasksCreated + risksCreated
          }
        });
      }

      default:
        throw new Error(`Unknown or unauthorized function: ${name}`);
    }
  } catch (error: any) {
    console.error(`Error executing function ${name}:`, error);
    // Re-throw authorization errors to prevent silent failures
    if (error.message?.includes('Access denied') || error.message?.includes('not found')) {
      throw error;
    }
    return JSON.stringify({ error: error.message || "Function execution failed" });
  }
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatResponse {
  message: string;
  tokensUsed: number;
  functionCalls?: Array<{ name: string; args: any; result: string }>;
}

// Convert OpenAI tools to Gemini tools
function convertToolsToGemini(tools: any[]) {
  // Gemini API expects tools as array with functionDeclarations
  return [{
    functionDeclarations: tools.map(tool => ({
      name: tool.function.name,
      description: tool.function.description,
      parameters: tool.function.parameters // Gemini accepts JSON Schema directly
    }))
  }];
}

// Helper function for Gemini API chat with model fallback
async function chatWithGemini(
  messages: ChatMessage[],
  systemContent: string,
  storage: IStorage,
  userId: string,
  modelName: string = DEFAULT_GEMINI_MODEL,
  context?: {
    currentPage?: string;
    selectedTaskId?: number;
    selectedRiskId?: number;
    selectedIssueId?: number;
    selectedResourceId?: number;
    selectedItemIds?: number[];
    modelName?: string;
    organizationId?: number;
  }
): Promise<ChatResponse> {
  if (!geminiClient) {
    throw new Error("Gemini API not initialized - GEMINI_API_KEY not set");
  }

  // Validate model name
  const selectedModel = GEMINI_MODELS[modelName as keyof typeof GEMINI_MODELS];
  if (!selectedModel) {
    throw new Error(`Invalid model: ${modelName}. Available models: ${Object.keys(GEMINI_MODELS).join(', ')}`);
  }

  // Try primary model first, fallback to flash-lite if rate limited
  const modelsToTry = [modelName];
  if (modelName !== FALLBACK_GEMINI_MODEL) {
    modelsToTry.push(FALLBACK_GEMINI_MODEL);
  }
  
  let lastError: Error | null = null;

  for (const currentModel of modelsToTry) {
    try {
      const geminiTools = convertToolsToGemini(tools);
      
      // Convert messages format for Gemini API
      const chatHistory: any[] = [];
      let lastUserMessage = "";

      // Build history (skip system message and last user message)
      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        if (msg.role === 'system') continue;

        if (i === messages.length - 1 && msg.role === 'user') {
          lastUserMessage = msg.content;
          continue;
        }

        chatHistory.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        });
      }

      // Create chat session with system instruction and tools
      const chat = geminiClient.chats.create({
        model: currentModel,
        config: {
          systemInstruction: systemContent,
          tools: geminiTools.length > 0 && geminiTools[0].functionDeclarations.length > 0 ? geminiTools : undefined
        },
        history: chatHistory.length > 0 ? chatHistory : undefined
      });

      const result = await chat.sendMessage({
        message: lastUserMessage
      });
      
      let response = result;
      let totalTokens = result.usageMetadata?.totalTokenCount || 0;
      const functionCallsExecuted: Array<{ name: string; args: any; result: string }> = [];

      // Handle function calls loop (multi-step reasoning)
      while (response.candidates?.[0]?.content?.parts?.some((p: any) => p.functionCall)) {
        const parts = response.candidates?.[0]?.content?.parts;
        if (!parts) {
          logger.warn("[Gemini API] No parts found in response");
          break;
        }
        const functionCallPart = parts.find((p: any) => p.functionCall);

        if (functionCallPart && functionCallPart.functionCall) {
          const { name, args } = functionCallPart.functionCall;
          
          if (!name || !args) {
            logger.warn("[Gemini API] Invalid function call - missing name or args");
            break;
          }
          
          // Inject organizationId from context if available and function needs it
          // This ensures AI doesn't need to ask for organizationId
          const enrichedArgs = { ...args };
          if ((name === "create_project_from_ai" || name === "search_lessons_learned") && context?.organizationId && !enrichedArgs.organizationId) {
            enrichedArgs.organizationId = context.organizationId;
          }
          
          // Check if this is a preview request
          const executionMode = enrichedArgs.previewMode === true ? ExecutionMode.PREVIEW : ExecutionMode.EXECUTE;
          const executionResult = await executeFunctionCall(name, enrichedArgs, storage, userId, executionMode);
          functionCallsExecuted.push({ name, args: enrichedArgs, result: executionResult });

          // Send result back to model using function response format
          const functionResponse = await chat.sendMessage({
            message: [{
              functionResponse: {
                name: name,
                response: { content: executionResult }
              }
            }]
          });
          
          response = functionResponse;
          totalTokens += functionResponse.usageMetadata?.totalTokenCount || 0;
        } else {
          break;
        }
      }

      const finalText = response.candidates?.[0]?.content?.parts
        ?.map((p: any) => p.text)
        .filter(Boolean)
        .join(' ') || "No response generated";

      // Log which model was used (if fallback)
      if (currentModel !== modelName) {
        logger.debug(`[Gemini API] Used fallback model: ${currentModel} (primary ${modelName} unavailable)`);
      }

      return {
        message: finalText,
        tokensUsed: totalTokens,
        functionCalls: functionCallsExecuted.length > 0 ? functionCallsExecuted : undefined
      };
    } catch (error: any) {
      const errorInfo: any = {
        message: error?.message || String(error)
      };
      if (error?.code !== undefined) errorInfo.code = error.code;
      if (error?.status !== undefined) errorInfo.status = error.status;
      
      logger.error(`[Gemini API] Error with model ${currentModel}:`, errorInfo);

      // Check if it's a rate limit error
      const isRateLimit = error?.message?.includes('429') || 
                         error?.message?.toLowerCase().includes('rate limit') ||
                         error?.code === 429 ||
                         error?.status === 429;

      if (isRateLimit && currentModel !== modelsToTry[modelsToTry.length - 1]) {
        // Try fallback model
        lastError = error;
        logger.warn(`[Gemini API] Rate limit on ${currentModel}, trying fallback...`);
        continue;
      }
      
      // Not a rate limit or last model, throw error
      throw error;
    }
  }

  throw lastError || new Error("All Gemini models failed");
}

export async function chatWithAssistant(
  messages: ChatMessage[],
  projectId: number | null,
  storage: IStorage,
  userId: string,
  context?: {
    currentPage?: string;
    selectedTaskId?: number;
    selectedRiskId?: number;
    selectedIssueId?: number;
    selectedResourceId?: number;
    selectedItemIds?: number[];
    modelName?: string; // User-selected model
    organizationId?: number; // Organization ID from context
    terminology?: { topLevel: string; program: string }; // Custom terminology
  }
): Promise<ChatResponse> {
  // Fetch organization terminology if organizationId is available
  let terminology = context?.terminology || { topLevel: "Organization", program: "Program" };
  if (context?.organizationId && !context?.terminology) {
    try {
      const org = await storage.getOrganization(context.organizationId);
      if (org) {
        terminology = {
          topLevel: org.topLevelEntityLabel === "custom" 
            ? org.topLevelEntityLabelCustom || "Organization"
            : org.topLevelEntityLabel || "Organization",
          program: org.programEntityLabel === "custom"
            ? org.programEntityLabelCustom || "Program"
            : org.programEntityLabel || "Program",
        };
      }
    } catch (error) {
      // Fallback to defaults if fetch fails
      logger.warn(`Failed to fetch terminology for org ${context.organizationId}:`, error);
    }
  }

  // Build context description
  if (context?.organizationId) {
    contextParts.push(`Organization ID: ${context.organizationId} (use for searching lessons learned)`);
  }
  
  const contextParts: string[] = [];
  if (projectId) {
    contextParts.push(`Current project: Project ID ${projectId}`);
  }
  if (context?.currentPage) {
    contextParts.push(`User is viewing: ${context.currentPage} page`);
  }
  if (context?.selectedTaskId) {
    contextParts.push(`User has selected task ID ${context.selectedTaskId} - use "this task" to refer to it`);
  }
  if (context?.selectedRiskId) {
    contextParts.push(`User has selected risk ID ${context.selectedRiskId} - use "this risk" to refer to it`);
  }
  if (context?.selectedIssueId) {
    contextParts.push(`User has selected issue ID ${context.selectedIssueId} - use "this issue" to refer to it`);
  }
  if (context?.selectedResourceId) {
    contextParts.push(`User has selected resource ID ${context.selectedResourceId} - use "this resource" to refer to it`);
  }
  if (context?.selectedItemIds && context.selectedItemIds.length > 0) {
    contextParts.push(`User has selected ${context.selectedItemIds.length} item(s): ${context.selectedItemIds.join(", ")}`);
  }

  let systemContent = `You are an expert EPC (Engineering, Procurement, Construction) project management assistant. 
You help project managers with:
- Analyzing project data (tasks, risks, issues, resources, costs)
- Identifying performance issues and bottlenecks
- Creating and managing project items (tasks, risks, issues, resources)
- Providing actionable insights and recommendations
- **Leveraging Organizational Knowledge:** You have access to the organization's "Lessons Learned" database. 
  - BEFORE suggesting solutions to complex problems or creating risk registers, ALWAYS search for relevant lessons learned using 'search_lessons_learned'.
  - If a user reports a problem (e.g., "concrete cracking"), search for it first to see if it happened before.
  - When creating projects or plans, check for lessons related to similar project types.

**IMPORTANT: Terminology**
This organization uses custom terminology:
- Top-level entity: "${terminology.topLevel}" (instead of "Organization")
- Program/Group entity: "${terminology.program}" (instead of "Program")
When referring to these entities, use the organization's terminology. For example, say "${terminology.program}" instead of "Program", and "${terminology.topLevel}" instead of "Organization".

**IMPORTANT: Tags System**
- Projects, tasks, risks, issues, and other entities can have tags assigned to them
- Tags are organization-level and help with categorization, filtering, and search
- When analyzing data, consider tags as important metadata for understanding context
- Tags can indicate project types (e.g., "construction", "software-development"), issue types (e.g., "quality-issue", "HSE"), risk categories, etc.
- Use tags to provide more contextual recommendations and insights

**IMPORTANT: Action Execution Rules**
- For ALL create, update, delete, and bulk operations, you MUST set previewMode=true in function arguments
- This shows the user a preview before executing, building trust and preventing mistakes
- Only analysis functions (get_project_overview, analyze_project_risks, analyze_resource_workload) execute immediately
- When calling action functions, always include previewMode: true in the arguments

**Context Awareness:**
${contextParts.length > 0 ? contextParts.join("\n") : "No specific context available."}
- When user says "this task", "this risk", "this issue", etc., use the selected IDs from context
- When user says "update this" or "delete this", infer the entity type from context
- Be proactive in using context to make interactions more natural

When analyzing data, be specific and provide actionable recommendations.
Focus on EPC industry best practices and PMI standards.
${projectId ? `Current project context: Project ID ${projectId}` : `No project selected. Ask user to select a project first.`}`;

  // Special mode for project creation
  if (context?.currentPage === "create-project-ai") {
    const orgIdInfo = context?.organizationId 
      ? `\n\n**IMPORTANT: ${terminology.topLevel} ID is ${context.organizationId} - you MUST use this organizationId when calling create_project_from_ai. Do NOT ask the user for organizationId - it's already available from context.**`
      : '';
    
    systemContent += `

**SPECIAL MODE: Project Creation Assistant**

You are helping the user create a new EPC project.${orgIdInfo}

Your role:
1. Ask clarifying questions about:
   - Project name and type (e.g., Solar Power Plant, Refinery, Pipeline)
   - Capacity/size specifications
   - Timeline (start date, duration, milestones)
   - Budget and currency
   - Key stakeholders and team structure
   - Regulatory requirements
   - Technical specifications

2. Analyze attached files (specifications, requirements, contracts) to extract project details

3. Generate a COMPREHENSIVE project structure including:
   - Project metadata (name, code, description, dates, budget)
   - **EXTENSIVE initial tasks (up to 200 tasks)** organized by phases:
     * Engineering phase tasks (design, engineering, documentation)
     * Procurement phase tasks (vendor selection, purchase orders, logistics)
     * Construction phase tasks (site preparation, installation, commissioning)
     * Quality and safety tasks
     * Project management tasks
   - **COMPREHENSIVE initial risks (up to 200 risks)** covering:
     * Technical risks (design flaws, equipment failures)
     * Schedule risks (delays, resource constraints)
     * Financial risks (cost overruns, currency fluctuations)
     * Safety risks (accidents, environmental incidents)
     * Regulatory risks (permits, compliance)
     * Supply chain risks (vendor delays, material shortages)
   - Key milestones and deliverables

4. Be THOROUGH - for large EPC projects, generate 50-200 tasks and 30-200 risks as appropriate for the project scope

5. Present a preview using create_project_from_ai function with previewMode=true
   ${context?.organizationId ? `- CRITICAL: Always include organizationId=${context.organizationId} in the function call - it's provided from context` : ''}
   - Use "${terminology.program}" terminology when referring to program/group entities
   - Use "${terminology.topLevel}" terminology when referring to the top-level entity

6. Only proceed after user confirms the preview

Be thorough but conversational. Ask one question at a time if needed. For large projects, don't hesitate to generate comprehensive task lists and risk registers.`;
  }

  // Prefer Gemini API if configured
  const selectedModel = context?.modelName || DEFAULT_GEMINI_MODEL;
  
  if (geminiApiKey) {
    try {
      return await chatWithGemini(messages, systemContent, storage, userId, selectedModel, context);
    } catch (error: any) {
      logger.error("Gemini API Error:", error);
      // Fallback to OpenAI if Gemini fails
      if (!openai) throw error;
      logger.info("Falling back to OpenAI...");
    }
  }

  // Legacy OpenAI Implementation
  try {
    const systemMessage: ChatMessage = {
      role: "system",
      content: systemContent
    };

    const allMessages = [systemMessage, ...messages];

    if (!openai) {
      return {
        message: "AI Assistant is not configured. Please set GEMINI_API_KEY (for Gemini API) or OPENAI_API_KEY in your environment variables.",
        tokensUsed: 0
      };
    }

    // ... (Rest of OpenAI implementation remains same)
    let response = await openai.chat.completions.create({
      model: "gpt-5", 
      messages: allMessages,
      tools,
      tool_choice: "auto",
      max_completion_tokens: 8192
    });

    const functionCalls: Array<{ name: string; args: any; result: string }> = [];
    let totalTokens = response.usage?.total_tokens || 0;

    while (response.choices[0]?.finish_reason === "tool_calls") {
      const toolCalls = response.choices[0].message.tool_calls || [];

      for (const toolCall of toolCalls) {
        if (toolCall.type !== 'function') continue;

        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);

        // Check if this is a preview request (args.previewMode === true)
        const executionMode = functionArgs.previewMode === true ? ExecutionMode.PREVIEW : ExecutionMode.EXECUTE;
        const result = await executeFunctionCall(functionName, functionArgs, storage, userId, executionMode);
        functionCalls.push({ name: functionName, args: functionArgs, result });

        allMessages.push({
          role: "assistant",
          content: response.choices[0].message.content || ""
        });

        allMessages.push({
          role: "user" as any, // Casting to user role for function response simulation in OpenAI
          content: `Function ${functionName} result: ${result}`
        });
      }

      if (!openai) break;

      response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: allMessages,
        tools,
        tool_choice: "auto",
        max_completion_tokens: 8192
      });

      totalTokens += response.usage?.total_tokens || 0;
    }

    return {
      message: response.choices[0]?.message?.content || "No response generated",
      tokensUsed: totalTokens,
      functionCalls: functionCalls.length > 0 ? functionCalls : undefined
    };
  } catch (error: any) {
    logger.error("Error in chatWithAssistant", error instanceof Error ? error : new Error(String(error)));
    throw new Error(error.message || "Failed to get AI response");
  }
}
