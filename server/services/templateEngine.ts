/**
 * Template Engine Service
 * Handles dynamic data injection into email templates
 */

import type { EmailTemplate, Task, Project, Risk, Issue, Stakeholder, Resource, ProjectEvent } from "@shared/schema";

export interface TemplateContext {
  project?: Project;
  task?: Task;
  risk?: Risk;
  issue?: Issue;
  stakeholder?: Stakeholder;
  resource?: Resource;
  calendarEvent?: ProjectEvent;
  [key: string]: any; // Allow custom context variables
}

/**
 * Replace template placeholders with actual values
 * Supports {{variable}} and {{object.property}} syntax
 */
export function renderTemplate(template: string, context: TemplateContext): string {
  let rendered = template;

  // Replace {{variable}} placeholders
  const placeholderRegex = /\{\{([^}]+)\}\}/g;
  
  rendered = rendered.replace(placeholderRegex, (match, path) => {
    const value = getNestedValue(context, path.trim());
    return value !== undefined && value !== null ? String(value) : match;
  });

  return rendered;
}

/**
 * Get nested value from object using dot notation
 * e.g., "project.name" -> context.project.name
 */
function getNestedValue(obj: any, path: string): any {
  const keys = path.split('.');
  let value = obj;

  for (const key of keys) {
    if (value === null || value === undefined) {
      return undefined;
    }
    value = value[key];
  }

  return value;
}

/**
 * Format date values for display
 */
export function formatDate(date: Date | string | null | undefined, format: string = "MMM dd, yyyy"): string {
  if (!date) return "Not set";
  
  const dateObj = typeof date === "string" ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return "Invalid date";

  // Simple date formatting (you can use date-fns or similar for more complex formatting)
  return dateObj.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Build template context from notification rule and related entities
 */
export async function buildTemplateContext(
  rule: any,
  projectId?: number,
  taskId?: number,
  riskId?: number,
  issueId?: number,
  calendarEventId?: number
): Promise<TemplateContext> {
  const context: TemplateContext = {};

  // Import storage dynamically to avoid circular dependencies
  const { storage } = await import("../storage");

  // Add project context
  if (projectId) {
    const project = await storage.getProject(projectId);
    if (project) {
      context.project = project;
      // Add computed project fields
      context.project_name = project.name;
      context.project_code = project.code || "";
      context.project_start_date = formatDate(project.startDate);
      context.project_end_date = formatDate(project.endDate);
    }
  }

  // Add task context
  if (taskId) {
    const task = await storage.getTask(taskId);
    if (task) {
      context.task = task;
      // Add computed task fields
      context.task_name = task.name;
      context.task_wbs_code = task.wbsCode || "";
      context.task_status = task.status;
      context.task_priority = task.priority || "";
      context.task_progress = `${task.progress || 0}%`;
      context.task_start_date = formatDate((task as any).startDate);
      context.task_end_date = formatDate((task as any).endDate);
      context.task_baseline_start = formatDate((task as any).baselineStart);
      context.task_baseline_finish = formatDate((task as any).baselineFinish);
      context.task_actual_start = formatDate((task as any).actualStartDate);
      context.task_actual_finish = formatDate((task as any).actualFinishDate);
    }
  }

  // Add risk context
  if (riskId) {
    const risk = await storage.getRisk(riskId);
    if (risk) {
      context.risk = risk;
      context.risk_title = risk.title;
      context.risk_code = risk.code;
      context.risk_impact = risk.impact || "";
      context.risk_probability = risk.probability || "";
      context.risk_status = risk.status || "";
    }
  }

  // Add issue context
  if (issueId) {
    const issue = await storage.getIssue(issueId);
    if (issue) {
      context.issue = issue;
      context.issue_title = issue.title;
      context.issue_code = issue.code;
      context.issue_priority = issue.priority || "";
      context.issue_status = issue.status || "";
    }
  }

  // Add calendar event context
  if (calendarEventId) {
    const calendarEvent = await storage.getProjectEvent(calendarEventId);
    if (calendarEvent) {
      context.calendarEvent = calendarEvent;
      context.event_title = calendarEvent.title;
      context.event_description = calendarEvent.description || "";
      context.event_start_date = formatDate(calendarEvent.startDate);
      context.event_end_date = formatDate(calendarEvent.endDate);
      context.event_location = calendarEvent.location || "";
      context.event_type = calendarEvent.eventType || "";
    }
  }

  // Add common fields
  context.current_date = formatDate(new Date());
  context.current_time = new Date().toLocaleTimeString();

  return context;
}

/**
 * Render email template with context
 */
export async function renderEmailTemplate(
  template: EmailTemplate,
  context: TemplateContext
): Promise<{ subject: string; body: string }> {
  const subject = renderTemplate(template.subject || "", context);
  const body = renderTemplate(template.body || "", context);

  return { subject, body };
}

