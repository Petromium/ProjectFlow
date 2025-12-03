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

    default:
      throw new Error(`Preview not supported for function: ${name}`);
  }
}

// Execute function calls
async function executeFunctionCall(
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

        return JSON.stringify({
          tasks: {
            total: tasks.length,
            byStatus: tasks.reduce((acc, t) => ({ ...acc, [t.status]: (acc[t.status as string] || 0) + 1 }), {} as Record<string, number>),
            byPriority: tasks.reduce((acc, t) => ({ ...acc, [t.priority]: (acc[t.priority as string] || 0) + 1 }), {} as Record<string, number>)
          },
          risks: {
            total: risks.length,
            byStatus: risks.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status as string] || 0) + 1 }), {} as Record<string, number>),
            highImpact: risks.filter(r => r.impact === 'critical' || r.impact === 'high').length
          },
          issues: {
            total: issues.length,
            byStatus: issues.reduce((acc, i) => ({ ...acc, [i.status]: (acc[i.status as string] || 0) + 1 }), {} as Record<string, number>),
            highPriority: issues.filter(i => i.priority === 'critical' || i.priority === 'high').length
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
          wbsCode: 'TBD',
          actualHours: null,
          createdBy: userId
        };

        const task = await storage.createTask(taskData);
        return JSON.stringify({ success: true, task });
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
              wbsCode: 'TBD',
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
          if (name === "create_project_from_ai" && context?.organizationId && !enrichedArgs.organizationId) {
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
  }
): Promise<ChatResponse> {
  // Build context description
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
${projectId ? `Current project context: Project ID ${projectId}` : 'No project selected. Ask user to select a project first.'}`;

  // Special mode for project creation
  if (context?.currentPage === "create-project-ai") {
    const orgIdInfo = context?.organizationId 
      ? `\n\n**IMPORTANT: Organization ID is ${context.organizationId} - you MUST use this organizationId when calling create_project_from_ai. Do NOT ask the user for organizationId - it's already available from context.**`
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
