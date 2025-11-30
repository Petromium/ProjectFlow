import OpenAI from "openai";
import { VertexAI, FunctionDeclarationSchemaType, Content, Part } from '@google-cloud/vertexai';
import type { IStorage } from "./storage";
import type { InsertTask, InsertRisk, InsertIssue, InsertStakeholder } from "@shared/schema";

// Initialize OpenAI (legacy/fallback)
const openaiApiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
const openai = openaiApiKey ? new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: openaiApiKey
}) : null;

// Initialize Google Vertex AI (Gemini)
const googleProjectId = process.env.GOOGLE_PROJECT_ID || process.env.GCLOUD_PROJECT;
const GEMINI_MODEL = 'gemini-1.5-flash-001';

// Region selection: Automatically determines best regions based on user location
// TODO: Enhance to use user's actual location from profile/settings when available
function getPreferredRegions(userLocation?: string | null): string[] {
  // If user location is provided, prioritize regions closest to user
  // For now, we use intelligent defaults that try all major regions
  // Future: Map user location (country/timezone) to nearest GCP regions
  
  // Smart default: Try all major regions in order of global coverage
  // This ensures best availability regardless of where the user is located
  return [
    'us-central1',      // United States (Iowa) - Most reliable, best model availability
    'europe-west1',     // Belgium - Good for Europe/Middle East
    'me-central1',      // Qatar - Closest to Middle East
    'asia-southeast1', // Singapore - Good for Asia-Pacific
  ];
}

// Create VertexAI instances for each region (lazy initialization)
const vertexAIClients: Map<string, VertexAI> = new Map();

function getVertexAIClient(location: string): VertexAI {
  if (!googleProjectId) return null as any;
  
  if (!vertexAIClients.has(location)) {
    vertexAIClients.set(location, new VertexAI({ 
      project: googleProjectId, 
      location: location 
    }));
  }
  return vertexAIClients.get(location)!;
}

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

// Convert OpenAI tools to Gemini tools
function convertToolsToGemini(tools: any[]) {
  return tools.map(tool => {
    return {
      name: tool.function.name,
      description: tool.function.description,
      parameters: tool.function.parameters // Gemini accepts JSON Schema directly in parameters
    };
  });
}

// Helper function for Gemini chat with region fallback
async function chatWithGemini(
  messages: ChatMessage[],
  systemContent: string,
  storage: IStorage,
  userId: string
): Promise<ChatResponse> {
  if (!googleProjectId) throw new Error("Vertex AI not initialized - GOOGLE_PROJECT_ID not set");

  // Get user location if available (future enhancement)
  // TODO: Fetch user's location/preference from database when user profile includes location field
  const userLocation: string | null = null; // Placeholder for future user location

  const preferredRegions = getPreferredRegions(userLocation);
  let lastError: Error | null = null;

  // Try each region in order until one works
  for (const region of preferredRegions) {
    try {
      const vertexAI = getVertexAIClient(region);
      const generativeModel = vertexAI.getGenerativeModel({
        model: GEMINI_MODEL,
        systemInstruction: { parts: [{ text: systemContent }] },
        tools: [{ functionDeclarations: convertToolsToGemini(tools) }]
      });

      const history: Content[] = [];
      let lastUserMessage = "";

      // Construct history. Skip the last user message as it's sent in sendMessage
      // Also separate system message (passed in init)
      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        if (msg.role === 'system') continue; // System instruction handled separately

        if (i === messages.length - 1 && msg.role === 'user') {
          lastUserMessage = msg.content;
          continue;
        }

        history.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        });
      }

      const chatSession = generativeModel.startChat({
        history: history,
      });

      let result = await chatSession.sendMessage(lastUserMessage);
      let response = result.response;
      let totalTokens = result.response.usageMetadata?.totalTokenCount || 0;
      
      const functionCallsExecuted: Array<{ name: string; args: any; result: string }> = [];

      // Handle tool calls loop
      while (response.candidates?.[0]?.content?.parts?.some(p => p.functionCall)) {
        const parts = response.candidates[0].content.parts;
        const functionCallPart = parts.find(p => p.functionCall);

        if (functionCallPart && functionCallPart.functionCall) {
          const { name, args } = functionCallPart.functionCall;
          
          const executionResult = await executeFunctionCall(name, args, storage, userId);
          functionCallsExecuted.push({ name, args, result: executionResult });

          // Send result back to model
          result = await chatSession.sendMessage([{
            functionResponse: {
              name: name,
              response: { content: executionResult } 
            }
          }]);
          
          response = result.response;
          totalTokens += result.response.usageMetadata?.totalTokenCount || 0;
        } else {
          break; 
        }
      }

      const finalText = response.candidates?.[0]?.content?.parts?.map(p => p.text).join(' ') || "No response generated";

      // Success! Log which region worked (for debugging)
      if (region !== preferredRegions[0]) {
        console.log(`[Vertex AI] Using fallback region: ${region} (primary ${preferredRegions[0]} unavailable)`);
      }

      return {
        message: finalText,
        tokensUsed: totalTokens,
        functionCalls: functionCallsExecuted.length > 0 ? functionCallsExecuted : undefined
      };
    } catch (error: any) {
      // Check if it's a region/model availability error
      const errorMessage = error?.message?.toLowerCase() || '';
      const isRegionError = errorMessage.includes('not found') || 
                           errorMessage.includes('not available') ||
                           errorMessage.includes('permission denied') ||
                           errorMessage.includes('invalid location') ||
                           error.code === 404 ||
                           error.code === 403;

      if (isRegionError && region !== preferredRegions[preferredRegions.length - 1]) {
        // This region failed, try next one
        lastError = error;
        console.log(`[Vertex AI] Region ${region} failed, trying fallback...`);
        continue;
      } else {
        // Either not a region error, or we've exhausted all regions
        throw error;
      }
    }
  }

  // If we get here, all regions failed
  throw lastError || new Error("All Vertex AI regions failed");
}

export async function chatWithAssistant(
  messages: ChatMessage[],
  projectId: number | null,
  storage: IStorage,
  userId: string
): Promise<ChatResponse> {
  const systemContent = `You are an expert EPC (Engineering, Procurement, Construction) project management assistant. 
You help project managers with:
- Analyzing project data (tasks, risks, issues, resources, costs)
- Identifying performance issues and bottlenecks
- Creating and managing project items (tasks, risks, issues)
- Providing actionable insights and recommendations

When analyzing data, be specific and provide actionable recommendations.
Focus on EPC industry best practices and PMI standards.
${projectId ? `Current project context: Project ID ${projectId}` : 'No project selected. Ask user to select a project first.'}`;

  // Prefer Gemini if configured
  if (googleProjectId) {
    try {
      return await chatWithGemini(messages, systemContent, storage, userId);
    } catch (error: any) {
      console.error("Gemini Chat Error:", error);
      // Fallback to OpenAI if Gemini fails? Or just throw? 
      // User explicitly requested Gemini, so better to throw error than silent fallback if they think they are using Gemini.
      // But if they haven't set it up yet, fallback is okay.
      if (!openai) throw error;
      console.log("Falling back to OpenAI...");
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
        message: "AI Assistant is not configured. Please set GOOGLE_PROJECT_ID (for Gemini) or OPENAI_API_KEY in your environment variables.",
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

        const result = await executeFunctionCall(functionName, functionArgs, storage, userId);
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
    console.error("Error in chatWithAssistant:", error);
    throw new Error(error.message || "Failed to get AI response");
  }
}
