import OpenAI from "openai";
import type { IStorage } from "./storage";
import type { InsertTask, InsertRisk, InsertIssue, InsertStakeholder } from "@shared/schema";

// This is using Replit's AI Integrations service, which provides OpenAI-compatible API access without requiring your own OpenAI API key.
// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
});

// Define available functions for the AI assistant
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
      description: "Create a new risk in the project",
      parameters: {
        type: "object",
        properties: {
          projectId: { type: "number" },
          title: { type: "string" },
          description: { type: "string" },
          category: { type: "string" },
          probability: { type: "number", minimum: 1, maximum: 5 },
          impact: { type: "string", enum: ["low", "medium", "high", "critical"] },
          mitigationPlan: { type: "string" }
        },
        required: ["projectId", "title"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_issue",
      description: "Create a new issue in the project",
      parameters: {
        type: "object",
        properties: {
          projectId: { type: "number" },
          title: { type: "string" },
          description: { type: "string" },
          priority: { type: "string", enum: ["low", "medium", "high", "critical"] },
          category: { type: "string" },
          assignedTo: { type: "string" }
        },
        required: ["projectId", "title"]
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

// Execute function calls
async function executeFunctionCall(
  name: string,
  args: any,
  storage: IStorage,
  userId: string
): Promise<string> {
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

export async function chatWithAssistant(
  messages: ChatMessage[],
  projectId: number | null,
  storage: IStorage,
  userId: string
): Promise<ChatResponse> {
  try {
    // Add system message with project context
    const systemMessage: ChatMessage = {
      role: "system",
      content: `You are an expert EPC (Engineering, Procurement, Construction) project management assistant. 
You help project managers with:
- Analyzing project data (tasks, risks, issues, resources, costs)
- Identifying performance issues and bottlenecks
- Creating and managing project items (tasks, risks, issues)
- Providing actionable insights and recommendations

When analyzing data, be specific and provide actionable recommendations.
Focus on EPC industry best practices and PMI standards.
${projectId ? `Current project context: Project ID ${projectId}` : 'No project selected. Ask user to select a project first.'}`
    };
    
    const allMessages = [systemMessage, ...messages];
    
    // Initial API call
    let response = await openai.chat.completions.create({
      model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
      messages: allMessages,
      tools,
      tool_choice: "auto",
      max_completion_tokens: 8192
    });
    
    const functionCalls: Array<{ name: string; args: any; result: string }> = [];
    let totalTokens = response.usage?.total_tokens || 0;
    
    // Handle function calls iteratively
    while (response.choices[0]?.finish_reason === "tool_calls") {
      const toolCalls = response.choices[0].message.tool_calls || [];
      
      // Execute all function calls
      for (const toolCall of toolCalls) {
        if (toolCall.type !== 'function') continue;
        
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);
        
        const result = await executeFunctionCall(functionName, functionArgs, storage, userId);
        functionCalls.push({ name: functionName, args: functionArgs, result });
        
        // Add function result to messages
        allMessages.push({
          role: "assistant",
          content: response.choices[0].message.content || ""
        });
        
        allMessages.push({
          role: "user" as any,
          content: `Function ${functionName} result: ${result}`
        });
      }
      
      // Call API again with function results
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
    console.error("Error in chatWithAssistant:", error);
    throw new Error(error.message || "Failed to get AI response");
  }
}
