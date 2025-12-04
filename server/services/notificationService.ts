/**
 * Notification Service
 * Handles sending notifications based on rules
 */

import { storage } from "../storage";
import { renderEmailTemplate, buildTemplateContext, type TemplateContext } from "./templateEngine";
import type { NotificationRule, NotificationLog, EmailTemplate, Task, Stakeholder, Resource, Contact } from "@shared/schema";
import { logger } from "./cloudLogging";
import { db } from "../db";
import * as schema from "@shared/schema";
import { eq, and, inArray } from "drizzle-orm";

/**
 * Resolve recipients based on notification rule configuration
 */
export async function resolveRecipients(
  rule: NotificationRule,
  taskId?: number,
  projectId?: number
): Promise<Array<{ email: string; name: string; type: string; id?: number }>> {
  const recipients: Array<{ email: string; name: string; type: string; id?: number }> = [];
  const recipientConfig = rule.recipients;

  if (!recipientConfig) return recipients;

  switch (rule.recipientType) {
    case "individual":
      // Batch fetch stakeholders (fixes N+1)
      if (recipientConfig.stakeholderIds && recipientConfig.stakeholderIds.length > 0) {
        const stakeholders = await db.select()
          .from(schema.stakeholders)
          .where(inArray(schema.stakeholders.id, recipientConfig.stakeholderIds));
        
        for (const stakeholder of stakeholders) {
          if (stakeholder.email) {
            recipients.push({
              email: stakeholder.email,
              name: stakeholder.name,
              type: "stakeholder",
              id: stakeholder.id,
            });
          }
        }
      }

      // Batch fetch resources (fixes N+1)
      if (recipientConfig.resourceIds && recipientConfig.resourceIds.length > 0) {
        const resources = await db.select()
          .from(schema.resources)
          .where(and(
            inArray(schema.resources.id, recipientConfig.resourceIds),
            eq(schema.resources.type, "human")
          ));
        
        // Batch fetch contacts for resources that have contactId
        const contactIds = resources
          .map(r => r.contactId)
          .filter((id): id is number => id !== null && id !== undefined);
        
        const contactsMap = new Map<number, Contact>();
        if (contactIds.length > 0) {
          const contacts = await db.select()
            .from(schema.contacts)
            .where(inArray(schema.contacts.id, contactIds));
          contacts.forEach(c => contactsMap.set(c.id, c));
        }
        
        for (const resource of resources) {
          if (resource.contactId) {
            const contact = contactsMap.get(resource.contactId);
            if (contact && contact.email) {
              recipients.push({
                email: contact.email,
                name: resource.name,
                type: "resource",
                id: resource.id,
              });
            }
          }
        }
      }

      // Batch fetch contacts (fixes N+1)
      if (recipientConfig.contactIds && recipientConfig.contactIds.length > 0) {
        const contacts = await db.select()
          .from(schema.contacts)
          .where(inArray(schema.contacts.id, recipientConfig.contactIds));
        
        for (const contact of contacts) {
          if (contact.email) {
            recipients.push({
              email: contact.email,
              name: contact.name,
              type: "contact",
              id: contact.id,
            });
          }
        }
      }
      break;

    case "raci-based":
      // Resolve RACI assignments for the task
      if (taskId && recipientConfig.raciTypes && recipientConfig.raciTypes.length > 0) {
        const raciAssignments = await storage.getStakeholderRaciByTask(taskId);

        for (const assignment of raciAssignments) {
          if (recipientConfig.raciTypes.includes(assignment.raciType)) {
            if (assignment.stakeholderId) {
              const stakeholder = await storage.getStakeholder(assignment.stakeholderId);
              if (stakeholder && stakeholder.email) {
                recipients.push({
                  email: stakeholder.email,
                  name: stakeholder.name,
                  type: "stakeholder",
                  id: stakeholder.id,
                });
              }
            } else if (assignment.resourceId) {
              const resource = await storage.getResource(assignment.resourceId);
              if (resource && resource.type === "human" && resource.contactId) {
                const contact = await storage.getContact(resource.contactId);
                if (contact && contact.email) {
                  recipients.push({
                    email: contact.email,
                    name: resource.name,
                    type: "resource",
                    id: resource.id,
                  });
                }
              }
            }
          }
        }
      }
      break;

    case "role-based":
      // Resolve by roles (stakeholder roles)
      if (recipientConfig.roles && recipientConfig.roles.length > 0 && projectId) {
        const stakeholders = await storage.getStakeholdersByProject(projectId);
        for (const stakeholder of stakeholders) {
          if (stakeholder.role && recipientConfig.roles.includes(stakeholder.role) && stakeholder.email) {
            recipients.push({
              email: stakeholder.email,
              name: stakeholder.name,
              type: "stakeholder",
              id: stakeholder.id,
            });
          }
        }
      }
      break;

    case "group":
      // Future: Implement group-based recipients
      logger.warn("[NOTIFICATION] Group-based recipients not yet implemented");
      break;
  }

  // Deduplicate by email
  const uniqueRecipients = recipients.filter(
    (r, index, self) => index === self.findIndex((t) => t.email === r.email)
  );

  return uniqueRecipients;
}

/**
 * Send notification based on rule
 */
export async function sendNotification(
  rule: NotificationRule,
  context: {
    projectId?: number;
    taskId?: number;
    riskId?: number;
    issueId?: number;
    changeRequestId?: number;
    calendarEventId?: number;
  }
): Promise<NotificationLog[]> {
  const logs: NotificationLog[] = [];

  try {
    // Get email template
    let emailTemplate: EmailTemplate | undefined;
    if (rule.emailTemplateId) {
      emailTemplate = await storage.getEmailTemplate(rule.emailTemplateId);
    }

    if (!emailTemplate) {
      logger.warn(`[NOTIFICATION] Rule ${rule.id} has no email template configured`);
      return logs;
    }

    // Build template context
    const templateContext = await buildTemplateContext(
      rule,
      context.projectId,
      context.taskId,
      context.riskId,
      context.issueId,
      context.calendarEventId
    );

    // Resolve recipients
    const recipients = await resolveRecipients(rule, context.taskId, context.projectId);

    if (recipients.length === 0) {
      logger.warn(`[NOTIFICATION] Rule ${rule.id} has no valid recipients`);
      return logs;
    }

    // Render email template
    const { subject, body } = await renderEmailTemplate(emailTemplate, templateContext);

    // Send email and push notifications to each recipient
    for (const recipient of recipients) {
      try {
        // Send email via emailService
        const { sendEmail } = await import("../emailService");
        const emailResult = await sendEmail({
          to: recipient.email,
          subject,
          htmlContent: body,
          projectId: context.projectId,
          templateId: rule.emailTemplateId || undefined,
          organizationId: rule.organizationId || (context.projectId ? (await storage.getProject(context.projectId))?.organizationId || 0 : 0),
        });

        // Send push notification if recipient is a user
        if (recipient.type === 'user' && recipient.id) {
          try {
            const { sendPushNotification } = await import("./pushNotificationService");
            await sendPushNotification(
              recipient.id.toString(),
              subject,
              body.replace(/<[^>]*>/g, '').substring(0, 200), // Strip HTML and limit length
              {
                tag: `notification-${rule.id}`,
                data: {
                  ruleId: rule.id,
                  projectId: context.projectId,
                  taskId: context.taskId,
                  riskId: context.riskId,
                  issueId: context.issueId,
                },
                icon: '/favicon.png',
                badge: '/favicon.png',
              }
            );
          } catch (pushError: any) {
            // Don't fail email if push fails
            logger.warn(`[NOTIFICATION] Failed to send push notification to user ${recipient.id}:`, pushError);
          }
        }

        // Create notification log
        const log = await storage.createNotificationLog({
          ruleId: rule.id,
          projectId: context.projectId || null,
          taskId: context.taskId || null,
          riskId: context.riskId || null,
          issueId: context.issueId || null,
          changeRequestId: context.changeRequestId || null,
          calendarEventId: context.calendarEventId || null,
          recipientEmail: recipient.email,
          recipientName: recipient.name,
          recipientType: recipient.type,
          recipientId: recipient.id || null,
          subject,
          body,
          status: emailResult.success ? "sent" : "failed",
          sentAt: emailResult.success ? new Date() : null,
          errorMessage: emailResult.error || null,
          providerMessageId: emailResult.messageId || null,
          attachments: rule.documentIds && rule.documentIds.length > 0 ? await Promise.all(
            rule.documentIds.map(async (id) => {
              try {
                const doc = await storage.getDocument(id);
                return {
                  type: "document" as const,
                  id,
                  name: doc?.name || `Document ${id}`,
                };
              } catch {
                return {
                  type: "document" as const,
                  id,
                  name: `Document ${id}`,
                };
              }
            })
          ) : null,
        });

        logs.push(log);

        if (emailResult.success) {
          logger.info(`[NOTIFICATION] Sent notification for rule ${rule.id} to ${recipient.email}`);
        } else {
          logger.warn(`[NOTIFICATION] Failed to send notification for rule ${rule.id} to ${recipient.email}: ${emailResult.error}`);
        }
      } catch (error: any) {
        logger.error(`[NOTIFICATION] Failed to send notification to ${recipient.email}:`, error);

        // Create failed log
        const log = await storage.createNotificationLog({
          ruleId: rule.id,
          projectId: context.projectId || null,
          taskId: context.taskId || null,
          riskId: context.riskId || null,
          issueId: context.issueId || null,
          changeRequestId: context.changeRequestId || null,
          calendarEventId: context.calendarEventId || null,
          recipientEmail: recipient.email,
          recipientName: recipient.name,
          recipientType: recipient.type,
          recipientId: recipient.id || null,
          subject,
          body,
          status: "failed",
          errorMessage: error.message,
        });

        logs.push(log);
      }
    }

    // Update rule's lastTriggeredAt
    await storage.updateNotificationRule(rule.id, {
      lastTriggeredAt: new Date(),
    });

    return logs;
  } catch (error: any) {
    logger.error(`[NOTIFICATION] Failed to process notification rule ${rule.id}:`, error);
    throw error;
  }
}

/**
 * Process event-based notification rules
 */
export async function processEventBasedNotifications(
  eventType: string,
  context: {
    projectId?: number;
    taskId?: number;
    riskId?: number;
    issueId?: number;
    changeRequestId?: number;
    calendarEventId?: number;
    previousValue?: any;
    newValue?: any;
  }
): Promise<void> {
  try {
    // Get all active notification rules
    const activeRules = await storage.getActiveNotificationRules();

    // Filter rules that match this event type
    const matchingRules = activeRules.filter((rule) => {
      if (rule.triggerType !== "event-based") return false;
      const config = rule.triggerConfig;
      if (!config || config.eventType !== eventType) return false;

      // Check additional conditions
      if (config.statusFrom && context.previousValue !== config.statusFrom) return false;
      if (config.statusTo && context.newValue !== config.statusTo) return false;
      if (config.progressThreshold && context.newValue < config.progressThreshold) return false;

      return true;
    });

    // Process each matching rule
    for (const rule of matchingRules) {
      try {
        await sendNotification(rule, context);
      } catch (error: any) {
        logger.error(`[NOTIFICATION] Failed to process rule ${rule.id} for event ${eventType}:`, error);
      }
    }
  } catch (error: any) {
    logger.error(`[NOTIFICATION] Failed to process event-based notifications:`, error);
  }
}

/**
 * Process threshold-based notification rules
 * Checks cost/schedule/progress variance against thresholds
 */
export async function checkThresholdNotifications(
  projectId: number,
  taskId?: number
): Promise<void> {
  try {
    const activeRules = await storage.getActiveNotificationRules();
    const thresholdRules = activeRules.filter(rule => 
      rule.triggerType === "threshold-based" &&
      (rule.projectId === projectId || (rule.scopeType === "specific-tasks" && taskId && rule.taskIds?.includes(taskId)))
    );

    for (const rule of thresholdRules) {
      const config = rule.triggerConfig;
      if (!config || !config.thresholdType || config.thresholdValue === undefined) continue;

      let shouldFire = false;
      let currentValue: number | null = null;

      if (config.thresholdType === "cost-variance") {
        // Calculate cost variance (would need cost tracking implementation)
        // For now, skip cost variance checks
        continue;
      } else if (config.thresholdType === "schedule-variance") {
        // Calculate schedule variance
        if (taskId) {
          const task = await storage.getTask(taskId);
          if (task && (task as any).baselineFinish && (task as any).actualFinishDate) {
            const baseline = new Date((task as any).baselineFinish).getTime();
            const actual = new Date((task as any).actualFinishDate).getTime();
            const varianceDays = (actual - baseline) / (1000 * 60 * 60 * 24);
            const baselineDuration = baseline - (new Date((task as any).baselineStart || task.startDate || 0).getTime());
            const variancePercent = baselineDuration > 0 ? (varianceDays / (baselineDuration / (1000 * 60 * 60 * 24))) * 100 : 0;
            currentValue = variancePercent;

            const threshold = config.thresholdValue || 0;
            if (config.thresholdOperator === "greater-than" && variancePercent > threshold) {
              shouldFire = true;
            } else if (config.thresholdOperator === "less-than" && variancePercent < threshold) {
              shouldFire = true;
            } else if (config.thresholdOperator === "equals" && Math.abs(variancePercent - threshold) < 1) {
              shouldFire = true;
            }
          }
        }
      } else if (config.thresholdType === "progress-variance") {
        // Calculate progress variance
        if (taskId) {
          const task = await storage.getTask(taskId);
          if (task && task.progress !== undefined) {
            const expectedProgress = calculateExpectedProgress(task);
            const actualProgress = task.progress;
            const variance = actualProgress - expectedProgress;
            currentValue = variance;

            const threshold = config.thresholdValue || 0;
            if (config.thresholdOperator === "greater-than" && variance > threshold) {
              shouldFire = true;
            } else if (config.thresholdOperator === "less-than" && variance < threshold) {
              shouldFire = true;
            } else if (config.thresholdOperator === "equals" && Math.abs(variance - threshold) < 1) {
              shouldFire = true;
            }
          }
        }
      }

      if (shouldFire) {
        try {
          await sendNotification(rule, {
            projectId,
            taskId,
          });
          logger.info(`[NOTIFICATION] Threshold rule ${rule.id} triggered (value: ${currentValue})`);
        } catch (error: any) {
          logger.error(`[NOTIFICATION] Failed to process threshold rule ${rule.id}:`, error);
        }
      }
    }
  } catch (error: any) {
    logger.error(`[NOTIFICATION] Error checking threshold notifications:`, error);
  }
}

/**
 * Calculate expected progress based on dates
 */
function calculateExpectedProgress(task: Task): number {
  if (!task.startDate || !task.endDate) return 0;
  
  const now = new Date();
  const start = new Date(task.startDate);
  const end = new Date(task.endDate);
  
  if (now < start) return 0;
  if (now > end) return 100;
  
  const totalDuration = end.getTime() - start.getTime();
  const elapsed = now.getTime() - start.getTime();
  
  return Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
}

