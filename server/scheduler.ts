import { syncExchangeRates } from "./exchangeRateService";
import { log } from "./app";
import { storage } from "./storage";
import type { NotificationRule, Task, Project } from "@shared/schema";

// Track all timers for cleanup on shutdown
const activeTimers: NodeJS.Timeout[] = [];

/**
 * Calculate time until next 17:00 CET (Central European Time)
 * ECB updates rates around 16:00 CET, so we sync at 17:00 to ensure we get the latest
 */
function getMillisecondsUntilSync(): number {
  const now = new Date();
  
  // Convert to CET (UTC+1 in winter, UTC+2 in summer)
  // For simplicity, we'll use UTC+1 (winter time)
  // In production, you'd want to handle DST properly
  const cetOffset = 1; // UTC+1 for CET (adjust for CEST if needed)
  const nowUTC = new Date(now.getTime() + (now.getTimezoneOffset() * 60000));
  const nowCET = new Date(nowUTC.getTime() + (cetOffset * 3600000));
  
  // Target time: 17:00 CET
  const targetHour = 17;
  const targetMinute = 0;
  
  const target = new Date(nowCET);
  target.setHours(targetHour, targetMinute, 0, 0);
  
  // If target time has passed today, schedule for tomorrow
  if (target <= nowCET) {
    target.setDate(target.getDate() + 1);
  }
  
  // Calculate milliseconds until target
  const msUntilTarget = target.getTime() - nowCET.getTime();
  
  // Also ensure we don't wait more than 24 hours (safety check)
  return Math.min(msUntilTarget, 24 * 60 * 60 * 1000);
}

/**
 * Schedule daily exchange rate sync
 * Syncs at 17:00 CET daily (after ECB updates at 16:00 CET)
 */
function scheduleDailySync(): void {
  const msUntilSync = getMillisecondsUntilSync();
  const hoursUntilSync = msUntilSync / (1000 * 60 * 60);
  
  log(`Exchange rate sync scheduled in ${hoursUntilSync.toFixed(2)} hours (17:00 CET daily)`);
  
  const timer = setTimeout(async () => {
    log("Starting scheduled exchange rate sync...");
    
    try {
      const result = await syncExchangeRates();
      
      if (result.success) {
        log(`Exchange rate sync completed: ${result.ratesUpdated} rates updated`);
      } else {
        log(`Exchange rate sync failed: ${result.error}`, "error");
      }
    } catch (error: any) {
      log(`Exchange rate sync error: ${error.message}`, "error");
    }
    
    // Schedule next sync (24 hours from now)
    scheduleDailySync();
  }, msUntilSync);
  
  activeTimers.push(timer);
}

/**
 * Initialize scheduler
 * Starts the daily exchange rate sync schedule
 */
export function initializeScheduler(): void {
  log("Initializing scheduler...");
  
  // Run initial sync on startup (optional - you may want to skip this in production)
  const runOnStartup = process.env.RUN_EXCHANGE_SYNC_ON_STARTUP !== "false";
  
  if (runOnStartup) {
    // Run sync after a short delay to allow server to fully start
    const startupTimer = setTimeout(async () => {
      log("Running initial exchange rate sync...");
      try {
        const result = await syncExchangeRates();
        if (result.success) {
          log(`Initial sync completed: ${result.ratesUpdated} rates updated`);
        } else {
          log(`Initial sync failed: ${result.error}`, "error");
        }
      } catch (error: any) {
        log(`Initial sync error: ${error.message}`, "error");
      }
    }, 5000); // 5 second delay
    
    activeTimers.push(startupTimer);
  }
  
  // Schedule daily syncs
  scheduleDailySync();
  
  // Schedule notification checks
  scheduleNotificationChecks();
}

/**
 * Check and process time-based notification rules
 * Runs every hour to check for triggers
 */
async function checkNotificationRules(): Promise<void> {
  try {
    const activeRules = await storage.getActiveNotificationRules();
    const now = new Date();

    for (const rule of activeRules) {
      // Only process time-based triggers in this scheduler
      if (rule.triggerType !== "time-based" && rule.triggerType !== "custom-date") {
        continue;
      }

      const triggerConfig = rule.triggerConfig;
      if (!triggerConfig) continue;

      // Check if rule should fire
      let shouldFire = false;
      let context: { projectId?: number; taskId?: number } = {};

      if (rule.triggerType === "custom-date" && triggerConfig.customDate) {
        const customDate = new Date(triggerConfig.customDate);
        // Fire on the day (within 1 hour window)
        const diffHours = Math.abs(now.getTime() - customDate.getTime()) / (1000 * 60 * 60);
        shouldFire = diffHours < 1 && customDate <= now;
      } else if (rule.triggerType === "time-based" && triggerConfig.triggerOn) {
        // Get project to check dates
        if (rule.projectId) {
          const project = await storage.getProject(rule.projectId);
          if (!project) continue;

          let targetDate: Date | null = null;

          switch (triggerConfig.triggerOn) {
            case "baseline-start":
            case "baseline-finish":
            case "actual-start":
            case "actual-finish":
              // For task-level triggers, check all tasks in the project
              if (rule.scopeType === "all-tasks" || rule.scopeType === "specific-tasks") {
                const projectTasks = await storage.getTasksByProject(rule.projectId);
                const tasksToCheck = rule.scopeType === "specific-tasks" && rule.taskIds
                  ? projectTasks.filter(t => rule.taskIds!.includes(t.id))
                  : projectTasks;

                for (const task of tasksToCheck) {
                  let taskTargetDate: Date | null = null;
                  
                  switch (triggerConfig.triggerOn) {
                    case "baseline-start":
                      taskTargetDate = (task as any).baselineStart ? new Date((task as any).baselineStart) : null;
                      break;
                    case "baseline-finish":
                      taskTargetDate = (task as any).baselineFinish ? new Date((task as any).baselineFinish) : null;
                      break;
                    case "actual-start":
                      taskTargetDate = (task as any).actualStartDate ? new Date((task as any).actualStartDate) : null;
                      break;
                    case "actual-finish":
                      taskTargetDate = (task as any).actualFinishDate ? new Date((task as any).actualFinishDate) : null;
                      break;
                  }

                  if (taskTargetDate && triggerConfig.daysBefore !== undefined) {
                    const daysBefore = triggerConfig.daysBefore;
                    const targetTime = new Date(taskTargetDate);
                    targetTime.setDate(targetTime.getDate() - daysBefore);
                    
                    const diffHours = Math.abs(now.getTime() - targetTime.getTime()) / (1000 * 60 * 60);
                    if (diffHours < 1 && targetTime <= now) {
                      // Check frequency limits for this specific task
                      const logs = await storage.getNotificationLogsByRule(rule.id);
                      const recentLogs = logs.filter(l => 
                        l.taskId === task.id && 
                        l.status === "sent" &&
                        l.createdAt &&
                        new Date(l.createdAt).getTime() > targetTime.getTime() - 3600000
                      );
                      
                      if (recentLogs.length === 0) {
                        // Fire notification for this task
                        try {
                          const { sendNotification } = await import("./services/notificationService");
                          await sendNotification(rule, {
                            projectId: rule.projectId,
                            taskId: task.id,
                          });
                          log(`[NOTIFICATION] Rule "${rule.name}" triggered for task ${task.id}`);
                        } catch (error: any) {
                          log(`[NOTIFICATION] Error sending notification for task ${task.id}: ${error.message}`, "error");
                        }
                      }
                    }
                  }
                }
              }
              continue;
            case "project-start":
              targetDate = project.startDate ? new Date(project.startDate) : null;
              break;
            case "project-end":
              targetDate = project.endDate ? new Date(project.endDate) : null;
              break;
          }

          if (targetDate && triggerConfig.daysBefore !== undefined) {
            const daysBefore = triggerConfig.daysBefore;
            const targetTime = new Date(targetDate);
            targetTime.setDate(targetTime.getDate() - daysBefore);
            
            // Check if we're within 1 hour of the target time
            const diffHours = Math.abs(now.getTime() - targetTime.getTime()) / (1000 * 60 * 60);
            shouldFire = diffHours < 1 && targetTime <= now;
            context.projectId = rule.projectId;
          }
        }
      }

      // Check frequency limits
      if (shouldFire && rule.maxOccurrences) {
        const logs = await storage.getNotificationLogsByRule(rule.id);
        const sentCount = logs.filter(l => l.status === "sent").length;
        if (sentCount >= rule.maxOccurrences) {
          continue; // Skip, max occurrences reached
        }
      }

      // Check last triggered time for recurring rules
      if (shouldFire && rule.frequency !== "one-time" && rule.lastTriggeredAt) {
        const lastTriggered = new Date(rule.lastTriggeredAt);
        const hoursSinceLastTrigger = (now.getTime() - lastTriggered.getTime()) / (1000 * 60 * 60);
        
        switch (rule.frequency) {
          case "daily":
            if (hoursSinceLastTrigger < 23) shouldFire = false;
            break;
          case "weekly":
            if (hoursSinceLastTrigger < 167) shouldFire = false; // ~7 days
            break;
          case "monthly":
            if (hoursSinceLastTrigger < 720) shouldFire = false; // ~30 days
            break;
        }
      }

      if (shouldFire) {
        // Send notifications via notification service
        try {
          const { sendNotification } = await import("./services/notificationService");
          await sendNotification(rule, context);
          log(`[NOTIFICATION] Rule "${rule.name}" (ID: ${rule.id}) triggered successfully`);
          
          // Update lastTriggeredAt
          await storage.updateNotificationRule(rule.id, {
            lastTriggeredAt: now,
          });
        } catch (error: any) {
          log(`[NOTIFICATION] Error sending notification for rule ${rule.id}: ${error.message}`, "error");
        }
      }
    }

    // Check calendar event reminders
    await checkCalendarEventReminders(now);
  } catch (error) {
    log(`[NOTIFICATION] Error checking notification rules: ${error}`);
  }
}

/**
 * Check calendar events for reminder notifications
 */
async function checkCalendarEventReminders(now: Date): Promise<void> {
  try {
    const activeRules = await storage.getActiveNotificationRules();
    const calendarRules = activeRules.filter(rule => 
      rule.scopeType === "calendar-event" && 
      rule.triggerType === "time-based" &&
      rule.triggerConfig?.triggerOn === "calendar-event-reminder"
    );

    for (const rule of calendarRules) {
      if (!rule.projectId) continue;

      const events = await storage.getProjectEventsByProject(rule.projectId);
      const triggerConfig = rule.triggerConfig;
      if (!triggerConfig || triggerConfig.daysBefore === undefined) continue;

      for (const event of events) {
        if (!event.startDate) continue;
        
        const eventStart = new Date(event.startDate);
        const reminderTime = new Date(eventStart);
        reminderTime.setDate(reminderTime.getDate() - (triggerConfig.daysBefore || 0));
        
        // Check if reminder time is within 1 hour window
        const diffHours = Math.abs(now.getTime() - reminderTime.getTime()) / (1000 * 60 * 60);
        if (diffHours < 1 && reminderTime <= now) {
          // Check if already sent
          const logs = await storage.getNotificationLogsByRule(rule.id);
          const alreadySent = logs.some(log => 
            log.calendarEventId === event.id && 
            log.status === "sent" &&
            log.createdAt &&
            new Date(log.createdAt).getTime() > reminderTime.getTime() - 3600000 // Within last hour
          );

          if (!alreadySent) {
            try {
              const { sendNotification } = await import("./services/notificationService");
              await sendNotification(rule, {
                projectId: rule.projectId,
                calendarEventId: event.id,
              });
              log(`[NOTIFICATION] Calendar event reminder sent for event ${event.id}`);
            } catch (error: any) {
              log(`[NOTIFICATION] Error sending calendar reminder: ${error.message}`, "error");
            }
          }
        }
      }
    }
  } catch (error) {
    log(`[NOTIFICATION] Error checking calendar reminders: ${error}`);
  }
}

/**
 * Schedule notification rule checks
 * Runs every hour
 */
function scheduleNotificationChecks(): void {
  // Run immediately, then every hour
  checkNotificationRules();
  
  const intervalTimer = setInterval(() => {
    checkNotificationRules();
  }, 60 * 60 * 1000); // 1 hour
  
  activeTimers.push(intervalTimer);

  log("[SCHEDULER] Notification rule checks scheduled (every hour)");
}

/**
 * Cleanup all active timers (call on server shutdown)
 */
export function cleanupScheduler(): void {
  log("[SCHEDULER] Cleaning up active timers...");
  activeTimers.forEach(timer => {
    clearTimeout(timer);
    clearInterval(timer);
  });
  activeTimers.length = 0;
  log("[SCHEDULER] All timers cleaned up");
}

