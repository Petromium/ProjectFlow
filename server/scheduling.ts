import { db } from "./db";
import { tasks, resourceAssignments, resources } from "@shared/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import type { Task, Resource, ResourceAssignment } from "@shared/schema";
import * as schema from "@shared/schema";

interface ScheduleTask {
  id: number;
  name: string;
  wbsCode: string;
  duration: number; // in days
  earlyStart: Date | null;
  earlyFinish: Date | null;
  lateStart: Date | null;
  lateFinish: Date | null;
  totalFloat: number | null;
  freeFloat: number | null;
  isCriticalPath: boolean;
  predecessors: { taskId: number; type: string; lagDays: number }[];
  successors: { taskId: number; type: string; lagDays: number }[];
  constraintType: string;
  constraintDate: Date | null;
  estimatedHours: number | null;
}

interface ScheduleResult {
  success: boolean;
  message: string;
  tasksUpdated: number;
  criticalPathLength: number;
  projectEndDate: Date | null;
  criticalTasks: number[];
}

export class SchedulingService {
  /**
   * Calculate task duration in days based on estimated hours and resource capacity
   * Default: 8 hours per day if no resources assigned
   * @deprecated Use calculateTaskDuration instead for calendar-aware calculation
   */
  calculateDuration(estimatedHours: number | null, hoursPerDay: number = 8): number {
    if (!estimatedHours || estimatedHours <= 0) {
      return 1; // Minimum 1 day duration
    }
    return Math.ceil(Number(estimatedHours) / hoursPerDay);
  }

  /**
   * Check if a date is a working day for a resource
   */
  private isWorkingDay(date: Date, resource: Resource | null): boolean {
    if (!resource) {
      // Default: Monday-Friday
      const dayOfWeek = date.getDay();
      return dayOfWeek >= 1 && dayOfWeek <= 5;
    }

    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[date.getDay()];
    const workingDays = (resource.workingDays as string[] | null) || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    
    if (!workingDays.includes(dayName)) {
      return false;
    }

    // Check calendar exceptions (holidays, leave, etc.)
    const exceptions = (resource.calendarExceptions as Array<{ date: string; type: string; note?: string }> | null) || [];
    const dateStr = date.toISOString().split('T')[0];
    return !exceptions.some(ex => ex.date === dateStr);
  }

  /**
   * Get next working day for a resource
   */
  private getNextWorkingDay(date: Date, resource: Resource | null): Date {
    let next = new Date(date);
    next.setDate(next.getDate() + 1);
    
    while (!this.isWorkingDay(next, resource)) {
      next.setDate(next.getDate() + 1);
    }
    
    return next;
  }

  /**
   * Calculate calendar-aware duration for a single resource assignment
   * Returns duration in calendar days considering working days and calendar exceptions
   */
  private calculateResourceDuration(
    effortHours: number,
    resource: Resource,
    allocation: number,
    startDate: Date
  ): number {
    if (effortHours <= 0) return 1;

    const maxHoursPerDay = resource.maxHoursPerDay || 8;
    const maxHoursPerWeek = resource.maxHoursPerWeek || 40;
    const effectiveHoursPerDay = (maxHoursPerDay * allocation) / 100;
    
    // Calculate how many calendar days needed
    let remainingHours = effortHours;
    let currentDate = new Date(startDate);
    let calendarDays = 0;
    let hoursThisWeek = 0;
    const weekStart = new Date(currentDate);

    while (remainingHours > 0) {
      if (!this.isWorkingDay(currentDate, resource)) {
        currentDate.setDate(currentDate.getDate() + 1);
        calendarDays++;
        continue;
      }

      // Check weekly limit
      const daysSinceWeekStart = Math.floor((currentDate.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceWeekStart >= 7) {
        hoursThisWeek = 0;
        weekStart.setDate(weekStart.getDate() + 7);
      }

      const availableHoursToday = Math.min(
        effectiveHoursPerDay,
        maxHoursPerWeek - hoursThisWeek
      );

      if (availableHoursToday > 0) {
        const hoursToUse = Math.min(remainingHours, availableHoursToday);
        remainingHours -= hoursToUse;
        hoursThisWeek += hoursToUse;
      }

      calendarDays++;
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return Math.max(1, calendarDays);
  }

  /**
   * Calculate task duration considering all resource assignments and work mode
   * PMI-compliant: effort hours ÷ (resource capacity × allocation) with calendar awareness
   */
  async calculateTaskDuration(
    task: Task,
    resourceAssignments: Array<ResourceAssignment & { resource: Resource }>,
    workMode: 'parallel' | 'sequential' = 'parallel'
  ): Promise<number> {
    // Don't calculate duration for completed tasks
    if (task.progress === 100) {
      // Use actual duration if available, otherwise return existing computed duration
      return task.actualDuration || task.computedDuration || 1;
    }

    const estimatedHours = task.estimatedHours ? Number(task.estimatedHours) : null;
    
    if (!estimatedHours || estimatedHours <= 0) {
      return 1; // Minimum 1 day
    }

    if (resourceAssignments.length === 0) {
      // No resources: default 8 hours per day, 5 days per week
      return Math.ceil(estimatedHours / 8);
    }

    const startDate = task.startDate ? new Date(task.startDate) : new Date();
    const resourceDurations: number[] = [];

    for (const assignment of resourceAssignments) {
      const resource = assignment.resource;
      const allocation = assignment.allocation || 100;
      
      // Use assignment-specific effort hours if provided, otherwise use task total
      const effortHours = assignment.effortHours 
        ? Number(assignment.effortHours)
        : estimatedHours / resourceAssignments.length; // Distribute evenly if not specified

      const duration = this.calculateResourceDuration(
        effortHours,
        resource,
        allocation,
        startDate
      );
      
      resourceDurations.push(duration);
    }

    if (workMode === 'parallel') {
      // Task duration = max duration of all resources (slowest resource determines finish)
      return Math.max(...resourceDurations, 1);
    } else {
      // Task duration = sum of all resource durations (resources work sequentially)
      return resourceDurations.reduce((sum, d) => sum + d, 0);
    }
  }

  /**
   * Add calendar days to a date, respecting resource working calendar
   * Skips non-working days and calendar exceptions
   */
  addCalendarDays(startDate: Date, days: number, resource: Resource | null = null): Date {
    let result = new Date(startDate);
    let remainingDays = days;
    
    while (remainingDays > 0) {
      result = this.getNextWorkingDay(result, resource);
      remainingDays--;
    }
    
    return result;
  }

  /**
   * Add business days to a date (skipping weekends)
   */
  addBusinessDays(startDate: Date, days: number): Date {
    const result = new Date(startDate);
    let remainingDays = days;
    
    while (remainingDays > 0) {
      result.setDate(result.getDate() + 1);
      const dayOfWeek = result.getDay();
      // Skip weekends (0 = Sunday, 6 = Saturday)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        remainingDays--;
      }
    }
    
    return result;
  }

  /**
   * Subtract business days from a date (skipping weekends)
   */
  subtractBusinessDays(endDate: Date, days: number): Date {
    const result = new Date(endDate);
    let remainingDays = days;
    
    while (remainingDays > 0) {
      result.setDate(result.getDate() - 1);
      const dayOfWeek = result.getDay();
      // Skip weekends (0 = Sunday, 6 = Saturday)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        remainingDays--;
      }
    }
    
    return result;
  }

  /**
   * Calculate business days between two dates
   */
  getBusinessDaysBetween(start: Date, end: Date): number {
    let count = 0;
    const current = new Date(start);
    
    while (current < end) {
      current.setDate(current.getDate() + 1);
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        count++;
      }
    }
    
    return count;
  }

  /**
   * Perform Forward Pass - Calculate Early Start (ES) and Early Finish (EF)
   * ES = Max(EF of all predecessors) adjusted for dependency type and lag
   * EF = ES + Duration
   */
  async forwardPass(projectId: number, projectStartDate: Date): Promise<Map<number, ScheduleTask>> {
    // Fetch all tasks for the project
    const projectTasks = await db.select()
      .from(tasks)
      .where(eq(tasks.projectId, projectId));
    
    // Fetch all dependencies
    const dependencies = await db.select()
      .from(schema.taskDependencies)
      .where(eq(schema.taskDependencies.projectId, projectId));
    
    // Build schedule task map
    const taskMap = new Map<number, ScheduleTask>();
    
    for (const task of projectTasks) {
      const predecessors = dependencies
        .filter(d => d.successorId === task.id)
        .map(d => ({ taskId: d.predecessorId, type: d.type, lagDays: d.lagDays }));
      
      const successors = dependencies
        .filter(d => d.predecessorId === task.id)
        .map(d => ({ taskId: d.successorId, type: d.type, lagDays: d.lagDays }));
      
      const duration = this.calculateDuration(task.estimatedHours ? Number(task.estimatedHours) : null);
      
      taskMap.set(task.id, {
        id: task.id,
        name: task.name,
        wbsCode: task.wbsCode,
        duration,
        earlyStart: null,
        earlyFinish: null,
        lateStart: null,
        lateFinish: null,
        totalFloat: null,
        freeFloat: null,
        isCriticalPath: false,
        predecessors,
        successors,
        constraintType: task.constraintType || "asap",
        constraintDate: task.constraintDate,
        estimatedHours: task.estimatedHours ? Number(task.estimatedHours) : null,
      });
    }
    
    // Topological sort to determine processing order
    const processed = new Set<number>();
    const sortedTasks: number[] = [];
    
    const visit = (taskId: number): void => {
      if (processed.has(taskId)) return;
      
      const task = taskMap.get(taskId);
      if (!task) return;
      
      // Process all predecessors first
      for (const pred of task.predecessors) {
        if (!processed.has(pred.taskId)) {
          visit(pred.taskId);
        }
      }
      
      processed.add(taskId);
      sortedTasks.push(taskId);
    };
    
    // Visit all tasks
    for (const taskId of Array.from(taskMap.keys())) {
      visit(taskId);
    }
    
    // Forward pass: Calculate ES and EF
    for (const taskId of sortedTasks) {
      const task = taskMap.get(taskId)!;
      
      if (task.predecessors.length === 0) {
        // No predecessors - start at project start date
        task.earlyStart = new Date(projectStartDate);
        
        // Apply constraint if applicable
        if (task.constraintType === "snet" && task.constraintDate) {
          // Start No Earlier Than
          if (task.constraintDate > task.earlyStart) {
            task.earlyStart = new Date(task.constraintDate);
          }
        } else if (task.constraintType === "mso" && task.constraintDate) {
          // Must Start On
          task.earlyStart = new Date(task.constraintDate);
        }
      } else {
        // Has predecessors - calculate based on dependency types
        let maxDate = new Date(0); // Start with epoch
        
        for (const pred of task.predecessors) {
          const predTask = taskMap.get(pred.taskId);
          if (!predTask || !predTask.earlyFinish) continue;
          
          let constrainedDate: Date;
          
          switch (pred.type) {
            case "FS": // Finish-to-Start: Successor starts the next business day after predecessor finishes
              constrainedDate = this.addBusinessDays(predTask.earlyFinish, 1 + pred.lagDays);
              break;
            case "SS": // Start-to-Start: Successor starts after predecessor starts
              constrainedDate = predTask.earlyStart ? 
                this.addBusinessDays(predTask.earlyStart, pred.lagDays) : 
                this.addBusinessDays(predTask.earlyFinish, pred.lagDays - task.duration);
              break;
            case "FF": // Finish-to-Finish: Successor finishes after predecessor finishes
              constrainedDate = predTask.earlyFinish ?
                this.addBusinessDays(this.subtractBusinessDays(predTask.earlyFinish, task.duration - 1), pred.lagDays) :
                new Date(projectStartDate);
              break;
            case "SF": // Start-to-Finish: Successor finishes after predecessor starts
              constrainedDate = predTask.earlyStart ?
                this.addBusinessDays(this.subtractBusinessDays(predTask.earlyStart, task.duration - 1), pred.lagDays) :
                new Date(projectStartDate);
              break;
            default:
              constrainedDate = this.addBusinessDays(predTask.earlyFinish!, pred.lagDays);
          }
          
          if (constrainedDate > maxDate) {
            maxDate = constrainedDate;
          }
        }
        
        task.earlyStart = maxDate;
        
        // Apply constraints
        if (task.constraintType === "snet" && task.constraintDate) {
          if (task.constraintDate > task.earlyStart) {
            task.earlyStart = new Date(task.constraintDate);
          }
        } else if (task.constraintType === "mso" && task.constraintDate) {
          task.earlyStart = new Date(task.constraintDate);
        }
      }
      
      // Calculate Early Finish (duration - 1 because start day counts as day 1)
      // A 1-day task starts and finishes on the same day
      task.earlyFinish = task.duration <= 1 
        ? new Date(task.earlyStart!) 
        : this.addBusinessDays(task.earlyStart!, task.duration - 1);
    }
    
    return taskMap;
  }

  /**
   * Perform Backward Pass - Calculate Late Start (LS) and Late Finish (LF)
   * LF = Min(LS of all successors) adjusted for dependency type and lag
   * LS = LF - Duration
   */
  backwardPass(taskMap: Map<number, ScheduleTask>, projectEndDate: Date): void {
    // Get tasks in reverse topological order
    const sortedTasks = Array.from(taskMap.keys());
    const processed = new Set<number>();
    const reverseSorted: number[] = [];
    
    const visit = (taskId: number): void => {
      if (processed.has(taskId)) return;
      
      const task = taskMap.get(taskId);
      if (!task) return;
      
      // Process all successors first
      for (const succ of task.successors) {
        if (!processed.has(succ.taskId)) {
          visit(succ.taskId);
        }
      }
      
      processed.add(taskId);
      reverseSorted.push(taskId);
    };
    
    for (const taskId of sortedTasks) {
      visit(taskId);
    }
    
    // Backward pass: Calculate LS and LF
    for (const taskId of reverseSorted) {
      const task = taskMap.get(taskId)!;
      
      if (task.successors.length === 0) {
        // No successors - end at project end date
        task.lateFinish = new Date(projectEndDate);
        
        // Apply constraint if applicable
        if (task.constraintType === "fnet" && task.constraintDate) {
          // Finish No Later Than
          if (task.constraintDate < task.lateFinish) {
            task.lateFinish = new Date(task.constraintDate);
          }
        } else if (task.constraintType === "mfo" && task.constraintDate) {
          // Must Finish On
          task.lateFinish = new Date(task.constraintDate);
        }
      } else {
        // Has successors - calculate based on dependency types
        let minDate = new Date(8640000000000000); // Max date
        
        for (const succ of task.successors) {
          const succTask = taskMap.get(succ.taskId);
          if (!succTask || !succTask.lateStart) continue;
          
          let constrainedDate: Date;
          
          switch (succ.type) {
            case "FS": // Finish-to-Start: This task must finish one day before successor starts
              constrainedDate = this.subtractBusinessDays(succTask.lateStart, 1 + succ.lagDays);
              break;
            case "SS": // Start-to-Start
              constrainedDate = succTask.lateStart ?
                this.addBusinessDays(this.subtractBusinessDays(succTask.lateStart, succ.lagDays), task.duration) :
                new Date(projectEndDate);
              break;
            case "FF": // Finish-to-Finish
              constrainedDate = succTask.lateFinish ?
                this.subtractBusinessDays(succTask.lateFinish, succ.lagDays) :
                new Date(projectEndDate);
              break;
            case "SF": // Start-to-Finish
              constrainedDate = succTask.lateStart ?
                this.addBusinessDays(succTask.lateStart, task.duration - 1 - succ.lagDays) :
                new Date(projectEndDate);
              break;
            default:
              constrainedDate = this.subtractBusinessDays(succTask.lateStart!, 1 + succ.lagDays);
          }
          
          if (constrainedDate < minDate) {
            minDate = constrainedDate;
          }
        }
        
        task.lateFinish = minDate;
        
        // Apply constraints
        if (task.constraintType === "fnet" && task.constraintDate) {
          if (task.constraintDate < task.lateFinish) {
            task.lateFinish = new Date(task.constraintDate);
          }
        } else if (task.constraintType === "mfo" && task.constraintDate) {
          task.lateFinish = new Date(task.constraintDate);
        }
      }
      
      // Calculate Late Start (duration - 1 because finish day counts as part of duration)
      // A 1-day task starts and finishes on the same day
      task.lateStart = task.duration <= 1 
        ? new Date(task.lateFinish!) 
        : this.subtractBusinessDays(task.lateFinish!, task.duration - 1);
    }
  }

  /**
   * Calculate Float (Total Float and Free Float) and identify Critical Path
   */
  calculateFloatAndCriticalPath(taskMap: Map<number, ScheduleTask>): number[] {
    const criticalTasks: number[] = [];
    
    for (const [taskId, task] of Array.from(taskMap.entries())) {
      if (!task.lateFinish || !task.earlyFinish || !task.lateStart || !task.earlyStart) {
        continue;
      }
      
      // Total Float = LF - EF = LS - ES
      task.totalFloat = this.getBusinessDaysBetween(task.earlyFinish, task.lateFinish);
      
      // Free Float = Earliest ES of successors - EF of this task - 1
      if (task.successors.length > 0) {
        let minSuccessorES = new Date(8640000000000000);
        for (const succ of task.successors) {
          const succTask = taskMap.get(succ.taskId);
          if (succTask?.earlyStart && succTask.earlyStart < minSuccessorES) {
            minSuccessorES = succTask.earlyStart;
          }
        }
        task.freeFloat = Math.max(0, this.getBusinessDaysBetween(task.earlyFinish, minSuccessorES));
      } else {
        task.freeFloat = task.totalFloat;
      }
      
      // Critical Path: Tasks with zero total float
      task.isCriticalPath = task.totalFloat === 0;
      if (task.isCriticalPath) {
        criticalTasks.push(taskId);
      }
    }
    
    return criticalTasks;
  }

  /**
   * Run the complete scheduling calculation for a project
   */
  async runSchedule(projectId: number, projectStartDate?: Date): Promise<ScheduleResult> {
    try {
      // Get project info for default start date
      const [project] = await db.select()
        .from(tasks)
        .where(eq(tasks.projectId, projectId))
        .limit(1);
      
      if (!project && !projectStartDate) {
        return {
          success: false,
          message: "No tasks found for project",
          tasksUpdated: 0,
          criticalPathLength: 0,
          projectEndDate: null,
          criticalTasks: [],
        };
      }
      
      const startDate = projectStartDate || new Date();
      
      // Step 1: Forward Pass
      const taskMap = await this.forwardPass(projectId, startDate);
      
      if (taskMap.size === 0) {
        return {
          success: true,
          message: "No tasks to schedule",
          tasksUpdated: 0,
          criticalPathLength: 0,
          projectEndDate: null,
          criticalTasks: [],
        };
      }
      
      // Find project end date (max EF)
      let projectEndDate = new Date(0);
      for (const task of Array.from(taskMap.values())) {
        if (task.earlyFinish && task.earlyFinish > projectEndDate) {
          projectEndDate = task.earlyFinish;
        }
      }
      
      // Step 2: Backward Pass
      this.backwardPass(taskMap, projectEndDate);
      
      // Step 3: Calculate Float and Critical Path
      const criticalTasks = this.calculateFloatAndCriticalPath(taskMap);
      
      // Step 4: Update tasks in database
      let tasksUpdated = 0;
      for (const [taskId, task] of Array.from(taskMap.entries())) {
        await db.update(tasks)
          .set({
            duration: task.duration,
            earlyStart: task.earlyStart,
            earlyFinish: task.earlyFinish,
            lateStart: task.lateStart,
            lateFinish: task.lateFinish,
            float: task.totalFloat,
            freeFloat: task.freeFloat,
            isCriticalPath: task.isCriticalPath,
            // Also update startDate/endDate if not set
            startDate: task.earlyStart,
            endDate: task.earlyFinish,
          })
          .where(eq(tasks.id, taskId));
        tasksUpdated++;
      }
      
      // Calculate critical path length
      const criticalPathLength = criticalTasks.reduce((sum, taskId) => {
        const task = taskMap.get(taskId);
        return sum + (task?.duration || 0);
      }, 0);
      
      return {
        success: true,
        message: `Successfully scheduled ${tasksUpdated} tasks`,
        tasksUpdated,
        criticalPathLength,
        projectEndDate,
        criticalTasks,
      };
    } catch (error) {
      console.error("Scheduling error:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown scheduling error",
        tasksUpdated: 0,
        criticalPathLength: 0,
        projectEndDate: null,
        criticalTasks: [],
      };
    }
  }

  /**
   * Get the scheduled data for all tasks in a project
   */
  async getScheduleData(projectId: number): Promise<ScheduleTask[]> {
    const projectTasks = await db.select()
      .from(tasks)
      .where(eq(tasks.projectId, projectId));
    
    const dependencies = await db.select()
      .from(schema.taskDependencies)
      .where(eq(schema.taskDependencies.projectId, projectId));
    
    return projectTasks.map(task => {
      const predecessors = dependencies
        .filter(d => d.successorId === task.id)
        .map(d => ({ taskId: d.predecessorId, type: d.type, lagDays: d.lagDays }));
      
      const successors = dependencies
        .filter(d => d.predecessorId === task.id)
        .map(d => ({ taskId: d.successorId, type: d.type, lagDays: d.lagDays }));
      
      return {
        id: task.id,
        name: task.name,
        wbsCode: task.wbsCode,
        duration: task.duration || this.calculateDuration(task.estimatedHours ? Number(task.estimatedHours) : null),
        earlyStart: task.earlyStart,
        earlyFinish: task.earlyFinish,
        lateStart: task.lateStart,
        lateFinish: task.lateFinish,
        totalFloat: task.float,
        freeFloat: task.freeFloat,
        isCriticalPath: task.isCriticalPath || false,
        predecessors,
        successors,
        constraintType: task.constraintType || "asap",
        constraintDate: task.constraintDate,
        estimatedHours: task.estimatedHours ? Number(task.estimatedHours) : null,
      };
    });
  }

  /**
   * Propagate date changes to dependent tasks
   * When a task's start date or effort hours change, recalculate all successor tasks
   */
  async propagateDates(projectId: number, changedTaskId: number): Promise<void> {
    // Fetch all tasks and dependencies
    const projectTasks = await db.select()
      .from(tasks)
      .where(eq(tasks.projectId, projectId));
    
    const dependencies = await db.select()
      .from(schema.taskDependencies)
      .where(eq(schema.taskDependencies.projectId, projectId));
    
    const taskIds = projectTasks.map(t => t.id);
    const resourceAssignmentsList = taskIds.length > 0
      ? await db.select()
          .from(resourceAssignments)
          .where(inArray(resourceAssignments.taskId, taskIds))
      : [];
    
    const resourcesList = await db.select()
      .from(resources)
      .where(eq(resources.projectId, projectId));
    
    // Build maps for quick lookup
    const taskMap = new Map(projectTasks.map(t => [t.id, t]));
    const resourceMap = new Map(resourcesList.map(r => [r.id, r]));
    const assignmentsByTask = new Map<number, Array<ResourceAssignment & { resource: Resource }>>();
    
    for (const assignment of resourceAssignmentsList) {
      const resource = resourceMap.get(assignment.resourceId);
      if (!resource) continue;
      
      if (!assignmentsByTask.has(assignment.taskId)) {
        assignmentsByTask.set(assignment.taskId, []);
      }
      assignmentsByTask.get(assignment.taskId)!.push({ ...assignment, resource });
    }
    
    // Build dependency graph
    const successorsByTask = new Map<number, Array<{ taskId: number; type: string; lagDays: number }>>();
    for (const dep of dependencies) {
      if (!successorsByTask.has(dep.predecessorId)) {
        successorsByTask.set(dep.predecessorId, []);
      }
      successorsByTask.get(dep.predecessorId)!.push({
        taskId: dep.successorId,
        type: dep.type,
        lagDays: dep.lagDays,
      });
    }
    
    // Process changed task and propagate
    const processed = new Set<number>();
    const queue: number[] = [changedTaskId];
    
    while (queue.length > 0) {
      const taskId = queue.shift()!;
      if (processed.has(taskId)) continue;
      processed.add(taskId);
      
      // Get task from map, but if it's the changed task, refresh from DB to ensure we have latest data
      let task = taskMap.get(taskId);
      if (!task) continue;
      
      // If this is the changed task, refresh from database to ensure we have the latest estimatedHours
      if (taskId === changedTaskId) {
        const [refreshedTask] = await db.select()
          .from(tasks)
          .where(eq(tasks.id, taskId));
        if (refreshedTask) {
          task = refreshedTask;
          taskMap.set(taskId, refreshedTask); // Update map with fresh data
          console.log(`[DEBUG] Refreshed changed task ${taskId} from DB - estimatedHours: ${task.estimatedHours}, startDate: ${task.startDate}`);
        }
      }
      
      // Skip calculations for completed tasks (100% progress)
      if (task.progress === 100) {
        console.log(`[DEBUG] Task ${taskId} is completed (100% progress) - skipping calculations, using actual dates`);
        // Don't recalculate duration or dates for completed tasks
        // Just process successors if needed
        const successors = successorsByTask.get(taskId) || [];
        for (const successor of successors) {
          const successorTask = taskMap.get(successor.taskId);
          if (successorTask && successorTask.progress !== 100) {
            queue.push(successor.taskId);
          }
        }
        continue;
      }

      // Recalculate this task's duration and end date
      const assignments = assignmentsByTask.get(taskId) || [];
      const workMode = (task.workMode as 'parallel' | 'sequential') || 'parallel';
      
      const computedDuration = await this.calculateTaskDuration(task, assignments, workMode);
      
      // Calculate end date from start date + duration
      let endDate: Date | null = null;
      if (task.startDate) {
        // Use the first resource's calendar if available, otherwise default
        const primaryResource = assignments.length > 0 ? assignments[0].resource : null;
        endDate = this.addCalendarDays(new Date(task.startDate), computedDuration, primaryResource);
      }
      
      // Update task in database
      await db.update(tasks)
        .set({
          computedDuration,
          endDate: endDate,
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, taskId));
      
      // Update task in map for subsequent calculations
      taskMap.set(taskId, { ...task, computedDuration, endDate });
      
      // Process successors
      const successors = successorsByTask.get(taskId) || [];
      for (const successor of successors) {
        const successorTask = taskMap.get(successor.taskId);
        if (!successorTask) continue;
        
        // Calculate successor's early start based on dependency type
        let earlyStart: Date | null = null;
        
        if (task.startDate && endDate) {
          switch (successor.type) {
            case 'FS': // Finish-to-Start
              // Use successor's resource calendar for lag calculation
              const fsSuccessorAssignments = assignmentsByTask.get(successor.taskId) || [];
              earlyStart = this.addCalendarDays(endDate, successor.lagDays, fsSuccessorAssignments[0]?.resource || null);
              break;
            case 'SS': // Start-to-Start
              // Use successor's resource calendar for lag calculation
              const ssSuccessorAssignments = assignmentsByTask.get(successor.taskId) || [];
              earlyStart = this.addCalendarDays(new Date(task.startDate), successor.lagDays, ssSuccessorAssignments[0]?.resource || null);
              break;
            case 'FF': // Finish-to-Finish
              // Successor finish = predecessor finish + lag
              // Calculate successor duration first, then work backwards
              const successorAssignments = assignmentsByTask.get(successor.taskId) || [];
              const successorWorkMode = (successorTask.workMode as 'parallel' | 'sequential') || 'parallel';
              const successorDuration = await this.calculateTaskDuration(
                successorTask,
                successorAssignments,
                successorWorkMode
              );
              // Successor start = predecessor finish + lag - successor duration
              const ffTargetFinish = this.addCalendarDays(endDate, successor.lagDays, successorAssignments[0]?.resource || null);
              earlyStart = this.subtractBusinessDays(ffTargetFinish, successorDuration);
              break;
            case 'SF': // Start-to-Finish (rare)
              // Successor finish = predecessor start + lag
              // Calculate successor duration first, then work backwards
              const sfSuccessorAssignments = assignmentsByTask.get(successor.taskId) || [];
              const sfSuccessorWorkMode = (successorTask.workMode as 'parallel' | 'sequential') || 'parallel';
              const sfSuccessorDuration = await this.calculateTaskDuration(
                successorTask,
                sfSuccessorAssignments,
                sfSuccessorWorkMode
              );
              // Successor start = predecessor start + lag - successor duration
              const sfTargetFinish = this.addCalendarDays(new Date(task.startDate), successor.lagDays, sfSuccessorAssignments[0]?.resource || null);
              earlyStart = this.subtractBusinessDays(sfTargetFinish, sfSuccessorDuration);
              break;
          }
        }
        
        // Update successor's start date if early start is calculated
        if (earlyStart && (!successorTask.startDate || new Date(successorTask.startDate) < earlyStart)) {
          await db.update(tasks)
            .set({
              startDate: earlyStart,
              updatedAt: new Date(),
            })
            .where(eq(tasks.id, successor.taskId));
          
          // Update in map
          taskMap.set(successor.taskId, { ...successorTask, startDate: earlyStart });
          
          // Add to queue for further propagation
          if (!processed.has(successor.taskId)) {
            queue.push(successor.taskId);
          }
        }
      }
    }
  }

  /**
   * Detect if a constraint conflicts with computed dates
   * Returns conflict information if constraint cannot be met with current resources
   */
  async detectConstraintConflict(
    task: Task,
    computedEndDate: Date | null,
    resourceAssignments: Array<ResourceAssignment & { resource: Resource }>
  ): Promise<{
    hasConflict: boolean;
    constraintType: string;
    constraintDate: Date | null;
    computedEndDate: Date | null;
    conflictDays: number | null;
    message: string;
  }> {
    if (!task.constraintDate || task.constraintType === "asap" || task.constraintType === "alap") {
      return {
        hasConflict: false,
        constraintType: task.constraintType || "asap",
        constraintDate: task.constraintDate,
        computedEndDate,
        conflictDays: null,
        message: "",
      };
    }

    const constraintDate = new Date(task.constraintDate);
    let hasConflict = false;
    let conflictDays: number | null = null;
    let message = "";

    switch (task.constraintType) {
      case "mfo": // Must Finish On
        if (computedEndDate && computedEndDate > constraintDate) {
          hasConflict = true;
          conflictDays = Math.ceil((computedEndDate.getTime() - constraintDate.getTime()) / (1000 * 60 * 60 * 24));
          message = `Computed finish date (${computedEndDate.toLocaleDateString()}) is ${conflictDays} days after constraint date (${constraintDate.toLocaleDateString()})`;
        }
        break;
      case "fnlt": // Finish No Later Than
        if (computedEndDate && computedEndDate > constraintDate) {
          hasConflict = true;
          conflictDays = Math.ceil((computedEndDate.getTime() - constraintDate.getTime()) / (1000 * 60 * 60 * 24));
          message = `Computed finish date (${computedEndDate.toLocaleDateString()}) is ${conflictDays} days after constraint date (${constraintDate.toLocaleDateString()})`;
        }
        break;
      case "mso": // Must Start On
        if (task.startDate) {
          const startDate = new Date(task.startDate);
          if (startDate > constraintDate) {
            hasConflict = true;
            conflictDays = Math.ceil((startDate.getTime() - constraintDate.getTime()) / (1000 * 60 * 60 * 24));
            message = `Computed start date (${startDate.toLocaleDateString()}) is ${conflictDays} days after constraint date (${constraintDate.toLocaleDateString()})`;
          }
        }
        break;
      case "snlt": // Start No Later Than
        if (task.startDate) {
          const startDate = new Date(task.startDate);
          if (startDate > constraintDate) {
            hasConflict = true;
            conflictDays = Math.ceil((startDate.getTime() - constraintDate.getTime()) / (1000 * 60 * 60 * 24));
            message = `Computed start date (${startDate.toLocaleDateString()}) is ${conflictDays} days after constraint date (${constraintDate.toLocaleDateString()})`;
          }
        }
        break;
    }

    return {
      hasConflict,
      constraintType: task.constraintType || "asap",
      constraintDate: task.constraintDate,
      computedEndDate,
      conflictDays,
      message,
    };
  }

  /**
   * Suggest resource leveling options to meet a constraint
   * Returns array of options with preview dates
   */
  async suggestResourceLeveling(
    task: Task,
    resourceAssignments: Array<ResourceAssignment & { resource: Resource }>,
    conflictDays: number,
    constraintDate: Date,
    constraintType: string
  ): Promise<Array<{
    option: string;
    description: string;
    changes: Array<{ type: string; resourceId?: number; resourceName?: string; currentValue: any; newValue: any }>;
    previewEndDate: Date | null;
    previewDuration: number;
    feasibility: "high" | "medium" | "low";
  }>> {
    const suggestions: Array<{
      option: string;
      description: string;
      changes: Array<{ type: string; resourceId?: number; resourceName?: string; currentValue: any; newValue: any }>;
      previewEndDate: Date | null;
      previewDuration: number;
      feasibility: "high" | "medium" | "low";
    }> = [];

    if (resourceAssignments.length === 0) {
      // No resources assigned - suggest adding resources
      return [{
        option: "add_resources",
        description: "Assign resources to this task to enable duration calculation",
        changes: [],
        previewEndDate: null,
        previewDuration: 0,
        feasibility: "medium",
      }];
    }

    const estimatedHours = task.estimatedHours ? Number(task.estimatedHours) : 0;
    const startDate = task.startDate ? new Date(task.startDate) : new Date();
    const workMode = (task.workMode as 'parallel' | 'sequential') || 'parallel';

    // Option 1: Increase allocation of existing resources
    for (const assignment of resourceAssignments) {
      const resource = assignment.resource;
      const currentAllocation = assignment.allocation || 100;
      
      // Calculate what allocation would be needed to meet constraint
      // Simplified: if we need to reduce duration by X%, increase allocation by similar amount
      const targetAllocation = Math.min(200, Math.ceil(currentAllocation * (1 + conflictDays / 10)));
      
      if (targetAllocation > currentAllocation && targetAllocation <= 200) {
        // Calculate preview duration with increased allocation
        const testAssignment = { ...assignment, allocation: targetAllocation };
        const previewDuration = await this.calculateTaskDuration(
          task,
          [testAssignment],
          workMode
        );
        const primaryResource = resourceAssignments[0]?.resource || null;
        const previewEndDate = this.addCalendarDays(startDate, previewDuration, primaryResource);

        suggestions.push({
          option: `increase_allocation_${assignment.resourceId}`,
          description: `Increase ${resource.name}'s allocation from ${currentAllocation}% to ${targetAllocation}%`,
          changes: [{
            type: "allocation",
            resourceId: assignment.resourceId,
            resourceName: resource.name,
            currentValue: currentAllocation,
            newValue: targetAllocation,
          }],
          previewEndDate,
          previewDuration,
          feasibility: targetAllocation <= 150 ? "high" : targetAllocation <= 175 ? "medium" : "low",
        });
      }
    }

    // Option 2: Add additional resources (if available resources exist)
    // This would require fetching available resources from the project
    // For now, suggest adding a duplicate of existing resources
    if (resourceAssignments.length > 0) {
      const firstResource = resourceAssignments[0].resource;
      const testAssignments = [
        ...resourceAssignments,
        {
          ...resourceAssignments[0],
          resourceId: -1, // Placeholder for new resource
          id: -1,
        } as ResourceAssignment & { resource: Resource },
      ];
      
      const previewDuration = await this.calculateTaskDuration(
        task,
        testAssignments,
        workMode
      );
      const primaryResource = resourceAssignments[0]?.resource || null;
      const previewEndDate = this.addCalendarDays(startDate, previewDuration, primaryResource);

      suggestions.push({
        option: "add_duplicate_resource",
        description: `Add another ${firstResource.name} to work in parallel`,
        changes: [{
          type: "add_resource",
          resourceName: firstResource.name,
          currentValue: resourceAssignments.length,
          newValue: resourceAssignments.length + 1,
        }],
        previewEndDate,
        previewDuration,
        feasibility: "medium",
      });
    }

    // Option 3: Increase working hours per day
    for (const assignment of resourceAssignments) {
      const resource = assignment.resource;
      const currentMaxHours = resource.maxHoursPerDay || 8;
      const newMaxHours = Math.min(12, currentMaxHours + 2); // Increase by 2 hours, max 12

      if (newMaxHours > currentMaxHours) {
        const modifiedResource = { ...resource, maxHoursPerDay: newMaxHours };
        const testAssignment = { ...assignment, resource: modifiedResource };
        const previewDuration = await this.calculateTaskDuration(
          task,
          [testAssignment],
          workMode
        );
        const previewEndDate = this.addCalendarDays(startDate, previewDuration, modifiedResource);

        suggestions.push({
          option: `increase_hours_${assignment.resourceId}`,
          description: `Increase ${resource.name}'s max hours per day from ${currentMaxHours} to ${newMaxHours}`,
          changes: [{
            type: "maxHoursPerDay",
            resourceId: assignment.resourceId,
            resourceName: resource.name,
            currentValue: currentMaxHours,
            newValue: newMaxHours,
          }],
          previewEndDate,
          previewDuration,
          feasibility: newMaxHours <= 10 ? "high" : "medium",
        });
      }
    }

    return suggestions.sort((a, b) => {
      // Sort by feasibility (high first), then by preview duration (shorter first)
      const feasibilityOrder = { high: 0, medium: 1, low: 2 };
      if (feasibilityOrder[a.feasibility] !== feasibilityOrder[b.feasibility]) {
        return feasibilityOrder[a.feasibility] - feasibilityOrder[b.feasibility];
      }
      return (a.previewDuration || 0) - (b.previewDuration || 0);
    });
  }
}

export const schedulingService = new SchedulingService();
