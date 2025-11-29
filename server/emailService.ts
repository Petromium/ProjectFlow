import * as sgMail from '@sendgrid/mail';
import type { EmailTemplate, SentEmail, Task, Risk, Issue, ChangeRequest, Project, User, Stakeholder } from '@shared/schema';

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@epcpmis.com';

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

export interface EmailPlaceholders {
  [key: string]: string | number | undefined;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  htmlContent: string;
  projectId?: number;
  templateId?: number;
  organizationId: number;
}

const defaultTemplates: Record<string, { subject: string; body: string }> = {
  'task-assigned': {
    subject: '[{{project_name}}] Task Assigned: {{task_name}}',
    body: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1a365d; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">Task Assignment</h1>
        </div>
        <div style="padding: 20px; background: #f7fafc;">
          <p>Hello {{assignee_name}},</p>
          <p>You have been assigned a new task on project <strong>{{project_name}}</strong>.</p>
          <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <h3 style="color: #1a365d; margin-top: 0;">{{task_name}}</h3>
            <p style="color: #718096;">WBS Code: {{wbs_code}}</p>
            <p><strong>Priority:</strong> {{priority}}</p>
            <p><strong>Due Date:</strong> {{due_date}}</p>
            <p><strong>Description:</strong></p>
            <p style="color: #4a5568;">{{description}}</p>
          </div>
          <p>Please log in to the PMIS to view task details and update progress.</p>
        </div>
        <div style="background: #2d3748; color: #a0aec0; padding: 15px; text-align: center; font-size: 12px;">
          <p>This is an automated notification from EPC PMIS.</p>
        </div>
      </div>
    `
  },
  'task-due-reminder': {
    subject: '[{{project_name}}] Task Due Reminder: {{task_name}}',
    body: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #c53030; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">Task Due Reminder</h1>
        </div>
        <div style="padding: 20px; background: #fff5f5;">
          <p>Hello {{assignee_name}},</p>
          <p>This is a reminder that the following task is due soon:</p>
          <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #c53030;">
            <h3 style="color: #c53030; margin-top: 0;">{{task_name}}</h3>
            <p style="color: #718096;">Project: {{project_name}}</p>
            <p><strong>Due Date:</strong> {{due_date}}</p>
            <p><strong>Current Progress:</strong> {{progress}}%</p>
          </div>
          <p>Please ensure this task is completed on time.</p>
        </div>
        <div style="background: #2d3748; color: #a0aec0; padding: 15px; text-align: center; font-size: 12px;">
          <p>This is an automated notification from EPC PMIS.</p>
        </div>
      </div>
    `
  },
  'risk-identified': {
    subject: '[{{project_name}}] New Risk Identified: {{risk_title}}',
    body: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #dd6b20; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">Risk Alert</h1>
        </div>
        <div style="padding: 20px; background: #fffaf0;">
          <p>A new risk has been identified on project <strong>{{project_name}}</strong>.</p>
          <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #dd6b20;">
            <h3 style="color: #dd6b20; margin-top: 0;">{{risk_code}} - {{risk_title}}</h3>
            <p><strong>Category:</strong> {{category}}</p>
            <p><strong>Probability:</strong> {{probability}}/5</p>
            <p><strong>Impact:</strong> {{impact}}</p>
            <p><strong>Description:</strong></p>
            <p style="color: #4a5568;">{{description}}</p>
          </div>
          <p>Please review and develop appropriate mitigation strategies.</p>
        </div>
        <div style="background: #2d3748; color: #a0aec0; padding: 15px; text-align: center; font-size: 12px;">
          <p>This is an automated notification from EPC PMIS.</p>
        </div>
      </div>
    `
  },
  'issue-reported': {
    subject: '[{{project_name}}] Issue Reported: {{issue_title}}',
    body: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #e53e3e; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">Issue Reported</h1>
        </div>
        <div style="padding: 20px; background: #fff5f5;">
          <p>A new issue has been reported on project <strong>{{project_name}}</strong>.</p>
          <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #e53e3e;">
            <h3 style="color: #e53e3e; margin-top: 0;">{{issue_code}} - {{issue_title}}</h3>
            <p><strong>Priority:</strong> {{priority}}</p>
            <p><strong>Reported By:</strong> {{reported_by}}</p>
            <p><strong>Description:</strong></p>
            <p style="color: #4a5568;">{{description}}</p>
          </div>
          <p>Please investigate and assign appropriate resources.</p>
        </div>
        <div style="background: #2d3748; color: #a0aec0; padding: 15px; text-align: center; font-size: 12px;">
          <p>This is an automated notification from EPC PMIS.</p>
        </div>
      </div>
    `
  },
  'change-request-submitted': {
    subject: '[{{project_name}}] Change Request Submitted: {{cr_title}}',
    body: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #3182ce; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">Change Request Submitted</h1>
        </div>
        <div style="padding: 20px; background: #ebf8ff;">
          <p>A new change request has been submitted for project <strong>{{project_name}}</strong>.</p>
          <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #3182ce;">
            <h3 style="color: #3182ce; margin-top: 0;">{{cr_code}} - {{cr_title}}</h3>
            <p><strong>Requested By:</strong> {{requested_by}}</p>
            <p><strong>Cost Impact:</strong> {{cost_impact}}</p>
            <p><strong>Schedule Impact:</strong> {{schedule_impact}} days</p>
            <p><strong>Description:</strong></p>
            <p style="color: #4a5568;">{{description}}</p>
            <p><strong>Justification:</strong></p>
            <p style="color: #4a5568;">{{justification}}</p>
          </div>
          <p>Please review this change request and provide your assessment.</p>
        </div>
        <div style="background: #2d3748; color: #a0aec0; padding: 15px; text-align: center; font-size: 12px;">
          <p>This is an automated notification from EPC PMIS.</p>
        </div>
      </div>
    `
  },
  'change-request-approved': {
    subject: '[{{project_name}}] Change Request Approved: {{cr_title}}',
    body: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #38a169; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">Change Request Approved</h1>
        </div>
        <div style="padding: 20px; background: #f0fff4;">
          <p>Your change request for project <strong>{{project_name}}</strong> has been approved.</p>
          <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #38a169;">
            <h3 style="color: #38a169; margin-top: 0;">{{cr_code}} - {{cr_title}}</h3>
            <p><strong>Approved By:</strong> {{reviewed_by}}</p>
            <p><strong>Approval Date:</strong> {{reviewed_date}}</p>
          </div>
          <p>Please proceed with implementation as outlined in the change request.</p>
        </div>
        <div style="background: #2d3748; color: #a0aec0; padding: 15px; text-align: center; font-size: 12px;">
          <p>This is an automated notification from EPC PMIS.</p>
        </div>
      </div>
    `
  },
  'change-request-rejected': {
    subject: '[{{project_name}}] Change Request Rejected: {{cr_title}}',
    body: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #c53030; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">Change Request Rejected</h1>
        </div>
        <div style="padding: 20px; background: #fff5f5;">
          <p>Your change request for project <strong>{{project_name}}</strong> has been rejected.</p>
          <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #c53030;">
            <h3 style="color: #c53030; margin-top: 0;">{{cr_code}} - {{cr_title}}</h3>
            <p><strong>Reviewed By:</strong> {{reviewed_by}}</p>
            <p><strong>Review Date:</strong> {{reviewed_date}}</p>
          </div>
          <p>Please contact the reviewer for further information.</p>
        </div>
        <div style="background: #2d3748; color: #a0aec0; padding: 15px; text-align: center; font-size: 12px;">
          <p>This is an automated notification from EPC PMIS.</p>
        </div>
      </div>
    `
  },
  'change-request-approval-needed': {
    subject: '[{{project_name}}] Approval Required: Change Request {{cr_code}}',
    body: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #d69e2e; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">Approval Required</h1>
        </div>
        <div style="padding: 20px; background: #fffaf0;">
          <p>Hello {{reviewer_name}},</p>
          <p>You have been assigned as a reviewer for a change request on project <strong>{{project_name}}</strong>.</p>
          <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #d69e2e;">
            <h3 style="color: #d69e2e; margin-top: 0;">{{cr_code}} - {{cr_title}}</h3>
            <p><strong>Requested By:</strong> {{requested_by}}</p>
            <p><strong>Cost Impact:</strong> \${{cost_impact}}</p>
            <p><strong>Schedule Impact:</strong> {{schedule_impact}} days</p>
            <p><strong>Description:</strong></p>
            <p style="color: #4a5568;">{{description}}</p>
            <p><strong>Justification:</strong></p>
            <p style="color: #4a5568;">{{justification}}</p>
          </div>
          <p>Please review and provide your approval decision.</p>
          <div style="text-align: center; margin-top: 20px;">
            <a href="{{app_url}}/change-requests" style="display: inline-block; background: #d69e2e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Review Change Request</a>
          </div>
        </div>
        <div style="background: #2d3748; color: #a0aec0; padding: 15px; text-align: center; font-size: 12px;">
          <p>This is an automated notification from EPC PMIS.</p>
        </div>
      </div>
    `
  },
  'project-update': {
    subject: '[{{project_name}}] Project Status Update',
    body: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #2b6cb0; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">Project Update</h1>
        </div>
        <div style="padding: 20px; background: #ebf8ff;">
          <h2 style="color: #2b6cb0;">{{project_name}}</h2>
          <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <h3 style="margin-top: 0;">Summary</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"><strong>Overall Progress:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">{{overall_progress}}%</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"><strong>Tasks Completed:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">{{tasks_completed}}/{{total_tasks}}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"><strong>Open Issues:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">{{open_issues}}</td></tr>
              <tr><td style="padding: 8px;"><strong>Active Risks:</strong></td><td style="padding: 8px;">{{active_risks}}</td></tr>
            </table>
          </div>
          <p>Log in to the PMIS for detailed project information.</p>
        </div>
        <div style="background: #2d3748; color: #a0aec0; padding: 15px; text-align: center; font-size: 12px;">
          <p>This is an automated notification from EPC PMIS.</p>
        </div>
      </div>
    `
  },
  'milestone-reached': {
    subject: '[{{project_name}}] Milestone Reached: {{milestone_name}}',
    body: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #38a169; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">Milestone Achieved!</h1>
        </div>
        <div style="padding: 20px; background: #f0fff4;">
          <p>Great news! A major milestone has been reached on project <strong>{{project_name}}</strong>.</p>
          <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #38a169;">
            <h3 style="color: #38a169; margin-top: 0;">{{milestone_name}}</h3>
            <p><strong>Completion Date:</strong> {{completion_date}}</p>
            <p><strong>Description:</strong></p>
            <p style="color: #4a5568;">{{description}}</p>
          </div>
          <p>Congratulations to the entire team!</p>
        </div>
        <div style="background: #2d3748; color: #a0aec0; padding: 15px; text-align: center; font-size: 12px;">
          <p>This is an automated notification from EPC PMIS.</p>
        </div>
      </div>
    `
  },
};

export function replacePlaceholders(template: string, placeholders: EmailPlaceholders): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = placeholders[key];
    return value !== undefined ? String(value) : match;
  });
}

export function getDefaultTemplate(type: string): { subject: string; body: string } | null {
  return defaultTemplates[type] || null;
}

export function getAllDefaultTemplates(): Array<{ type: string; subject: string; body: string }> {
  return Object.entries(defaultTemplates).map(([type, template]) => ({
    type,
    ...template
  }));
}

export async function sendEmail(options: SendEmailOptions): Promise<{ success: boolean; error?: string; messageId?: string }> {
  if (!SENDGRID_API_KEY) {
    console.log('[Email] SendGrid not configured. Email would be sent to:', options.to);
    console.log('[Email] Subject:', options.subject);
    return { success: true, messageId: 'mock-' + Date.now() };
  }

  try {
    const msg = {
      to: options.to,
      from: FROM_EMAIL,
      subject: options.subject,
      html: options.htmlContent,
    };

    const response = await sgMail.send(msg);
    return { 
      success: true, 
      messageId: response[0]?.headers?.['x-message-id'] || 'sent-' + Date.now() 
    };
  } catch (error: any) {
    console.error('[Email] Send error:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to send email' 
    };
  }
}

export function buildTaskAssignedEmail(
  task: Task,
  project: Project,
  assignee: User
): { subject: string; body: string } {
  const template = defaultTemplates['task-assigned'];
  const placeholders: EmailPlaceholders = {
    project_name: project.name,
    task_name: task.name,
    assignee_name: assignee.firstName || assignee.email || 'Team Member',
    wbs_code: task.wbsCode,
    priority: task.priority,
    due_date: task.endDate ? new Date(task.endDate).toLocaleDateString() : 'Not set',
    description: task.description || 'No description provided',
  };

  return {
    subject: replacePlaceholders(template.subject, placeholders),
    body: replacePlaceholders(template.body, placeholders),
  };
}

export function buildRiskIdentifiedEmail(
  risk: Risk,
  project: Project
): { subject: string; body: string } {
  const template = defaultTemplates['risk-identified'];
  const placeholders: EmailPlaceholders = {
    project_name: project.name,
    risk_code: risk.code,
    risk_title: risk.title,
    category: risk.category || 'Uncategorized',
    probability: risk.probability,
    impact: risk.impact,
    description: risk.description || 'No description provided',
  };

  return {
    subject: replacePlaceholders(template.subject, placeholders),
    body: replacePlaceholders(template.body, placeholders),
  };
}

export function buildIssueReportedEmail(
  issue: Issue,
  project: Project,
  reporter: User
): { subject: string; body: string } {
  const template = defaultTemplates['issue-reported'];
  const placeholders: EmailPlaceholders = {
    project_name: project.name,
    issue_code: issue.code,
    issue_title: issue.title,
    priority: issue.priority,
    reported_by: reporter.firstName || reporter.email || 'Unknown',
    description: issue.description || 'No description provided',
  };

  return {
    subject: replacePlaceholders(template.subject, placeholders),
    body: replacePlaceholders(template.body, placeholders),
  };
}

export function buildChangeRequestEmail(
  cr: ChangeRequest,
  project: Project,
  requester: User,
  type: 'submitted' | 'approved' | 'rejected',
  reviewer?: User
): { subject: string; body: string } {
  const templateKey = `change-request-${type}`;
  const template = defaultTemplates[templateKey];
  
  const placeholders: EmailPlaceholders = {
    project_name: project.name,
    cr_code: cr.code,
    cr_title: cr.title,
    requested_by: requester.firstName || requester.email || 'Unknown',
    cost_impact: cr.costImpact ? `${project.currency} ${cr.costImpact}` : 'None',
    schedule_impact: cr.scheduleImpact || 0,
    description: cr.description || 'No description provided',
    justification: cr.justification || 'None provided',
    reviewed_by: reviewer?.firstName || reviewer?.email || 'Unknown',
    reviewed_date: cr.reviewedDate ? new Date(cr.reviewedDate).toLocaleDateString() : 'N/A',
  };

  return {
    subject: replacePlaceholders(template.subject, placeholders),
    body: replacePlaceholders(template.body, placeholders),
  };
}

export function buildChangeRequestApprovalNeededEmail(
  cr: ChangeRequest,
  project: Project,
  reviewer: User,
  requester: User
): { subject: string; body: string } {
  const template = defaultTemplates['change-request-approval-needed'];
  const appUrl = process.env.APP_URL || 'http://localhost:5000';
  
  const placeholders: EmailPlaceholders = {
    project_name: project.name,
    cr_code: cr.code,
    cr_title: cr.title,
    reviewer_name: reviewer.firstName || reviewer.email || 'Reviewer',
    requested_by: requester.firstName || requester.email || 'Unknown',
    cost_impact: cr.costImpact ? parseFloat(cr.costImpact.toString()).toLocaleString() : '0',
    schedule_impact: cr.scheduleImpact || 0,
    description: cr.description || 'No description provided',
    justification: cr.justification || 'None provided',
    app_url: appUrl,
  };

  return {
    subject: replacePlaceholders(template.subject, placeholders),
    body: replacePlaceholders(template.body, placeholders),
  };
}

export function buildProjectUpdateEmail(
  project: Project,
  stats: {
    overallProgress: number;
    tasksCompleted: number;
    totalTasks: number;
    openIssues: number;
    activeRisks: number;
  }
): { subject: string; body: string } {
  const template = defaultTemplates['project-update'];
  const placeholders: EmailPlaceholders = {
    project_name: project.name,
    overall_progress: stats.overallProgress,
    tasks_completed: stats.tasksCompleted,
    total_tasks: stats.totalTasks,
    open_issues: stats.openIssues,
    active_risks: stats.activeRisks,
  };

  return {
    subject: replacePlaceholders(template.subject, placeholders),
    body: replacePlaceholders(template.body, placeholders),
  };
}

export function getAvailablePlaceholders(templateType: string): string[] {
  const placeholderMap: Record<string, string[]> = {
    'task-assigned': ['project_name', 'task_name', 'assignee_name', 'wbs_code', 'priority', 'due_date', 'description'],
    'task-due-reminder': ['project_name', 'task_name', 'assignee_name', 'due_date', 'progress'],
    'risk-identified': ['project_name', 'risk_code', 'risk_title', 'category', 'probability', 'impact', 'description'],
    'issue-reported': ['project_name', 'issue_code', 'issue_title', 'priority', 'reported_by', 'description'],
    'change-request-submitted': ['project_name', 'cr_code', 'cr_title', 'requested_by', 'cost_impact', 'schedule_impact', 'description', 'justification'],
    'change-request-approved': ['project_name', 'cr_code', 'cr_title', 'reviewed_by', 'reviewed_date'],
    'change-request-rejected': ['project_name', 'cr_code', 'cr_title', 'reviewed_by', 'reviewed_date'],
    'change-request-approval-needed': ['project_name', 'cr_code', 'cr_title', 'reviewer_name', 'requested_by', 'cost_impact', 'schedule_impact', 'description', 'justification', 'app_url'],
    'project-update': ['project_name', 'overall_progress', 'tasks_completed', 'total_tasks', 'open_issues', 'active_risks'],
    'milestone-reached': ['project_name', 'milestone_name', 'completion_date', 'description'],
    'custom': [],
  };
  
  return placeholderMap[templateType] || [];
}
