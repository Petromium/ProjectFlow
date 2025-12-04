/**
 * Lead Scoring Service
 * Identifies Product-Qualified Leads (PQLs) based on user behavior
 * Calculates lead scores using engagement metrics
 */

import { storage } from '../storage';
import { logger } from './cloudLogging';

export interface LeadScore {
  userId: string;
  email: string;
  organizationId: number | null;
  organizationName: string | null;
  score: number;
  tier: 'cold' | 'warm' | 'hot' | 'pql';
  signals: {
    projectCreated: boolean;
    multipleProjects: boolean;
    tasksCreated: boolean;
    teamInvited: boolean;
    storageUsed: boolean;
    aiUsed: boolean;
    frequentLogin: boolean;
    exportUsed: boolean;
  };
  lastActivity: Date | null;
  createdAt: Date;
}

/**
 * Scoring weights for different actions
 */
const SCORING_WEIGHTS = {
  projectCreated: 20,
  multipleProjects: 15,
  tasksCreated: 10,
  teamInvited: 25,
  storageUsed: 10,
  aiUsed: 15,
  frequentLogin: 10,
  exportUsed: 15,
  // Engagement multipliers
  activeDays: 2, // per day active in last 30 days
  projectCount: 5, // per project
  taskCount: 0.5, // per task
};

/**
 * Thresholds for lead tiers
 */
const TIER_THRESHOLDS = {
  cold: 0,
  warm: 30,
  hot: 60,
  pql: 85,
};

/**
 * Calculate lead score for a user
 */
export async function calculateLeadScore(userId: string): Promise<LeadScore> {
  try {
    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    // Get user's organizations
    const userOrgs = await storage.getUserOrganizations(userId);
    const orgId = userOrgs.length > 0 ? userOrgs[0].organizationId : null;
    const org = orgId ? await storage.getOrganization(orgId) : null;

    // Get activity logs for last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const activityLogs = await storage.getUserActivityLogs({
      userId,
      startDate: thirtyDaysAgo,
      limit: 1000,
    });

    // Get projects
    const projects = orgId ? await storage.getProjectsByOrganization(orgId) : [];
    
    // Get tasks across all projects
    let totalTasks = 0;
    for (const project of projects) {
      const tasks = await storage.getTasksByProject(project.id);
      totalTasks += tasks.length;
    }

    // Get organization usage
    const usage = orgId ? await storage.getOrganizationUsage(orgId) : null;

    // Calculate signals
    const signals = {
      projectCreated: projects.length > 0,
      multipleProjects: projects.length > 1,
      tasksCreated: totalTasks > 0,
      teamInvited: userOrgs.length > 1 || (orgId ? (await storage.getUsersByOrganization(orgId)).length > 1 : false),
      storageUsed: usage ? parseFloat(usage.storageUsedBytes) > 0 : false,
      aiUsed: usage ? usage.aiTokensUsed > 0 : false,
      frequentLogin: activityLogs.filter(log => log.action === 'login').length >= 5,
      exportUsed: activityLogs.some(log => log.action?.includes('export') || log.action?.includes('download')),
    };

    // Calculate score
    let score = 0;

    // Base signals
    if (signals.projectCreated) score += SCORING_WEIGHTS.projectCreated;
    if (signals.multipleProjects) score += SCORING_WEIGHTS.multipleProjects;
    if (signals.tasksCreated) score += SCORING_WEIGHTS.tasksCreated;
    if (signals.teamInvited) score += SCORING_WEIGHTS.teamInvited;
    if (signals.storageUsed) score += SCORING_WEIGHTS.storageUsed;
    if (signals.aiUsed) score += SCORING_WEIGHTS.aiUsed;
    if (signals.frequentLogin) score += SCORING_WEIGHTS.frequentLogin;
    if (signals.exportUsed) score += SCORING_WEIGHTS.exportUsed;

    // Engagement multipliers
    const uniqueActiveDays = new Set(
      activityLogs.map(log => log.createdAt.toISOString().split('T')[0])
    ).size;
    score += uniqueActiveDays * SCORING_WEIGHTS.activeDays;

    score += projects.length * SCORING_WEIGHTS.projectCount;
    score += totalTasks * SCORING_WEIGHTS.taskCount;

    // Cap score at 100
    score = Math.min(100, Math.round(score));

    // Determine tier
    let tier: 'cold' | 'warm' | 'hot' | 'pql';
    if (score >= TIER_THRESHOLDS.pql) {
      tier = 'pql';
    } else if (score >= TIER_THRESHOLDS.hot) {
      tier = 'hot';
    } else if (score >= TIER_THRESHOLDS.warm) {
      tier = 'warm';
    } else {
      tier = 'cold';
    }

    // Get last activity
    const lastActivity = activityLogs.length > 0 
      ? activityLogs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0].createdAt
      : user.createdAt;

    return {
      userId,
      email: user.email,
      organizationId: orgId,
      organizationName: org?.name || null,
      score,
      tier,
      signals,
      lastActivity,
      createdAt: user.createdAt,
    };
  } catch (error) {
    logger.error('[Lead Scoring] Failed to calculate lead score:', error);
    throw error;
  }
}

/**
 * Get all lead scores (for admin dashboard)
 */
export async function getAllLeadScores(): Promise<LeadScore[]> {
  try {
    const users = await storage.getAllUsers();
    const scores = await Promise.all(
      users.map(user => calculateLeadScore(user.id).catch(error => {
        logger.warn(`[Lead Scoring] Failed to calculate score for user ${user.id}:`, error);
        return null;
      }))
    );
    
    return scores.filter((score): score is LeadScore => score !== null)
      .sort((a, b) => b.score - a.score);
  } catch (error) {
    logger.error('[Lead Scoring] Failed to get all lead scores:', error);
    return [];
  }
}

/**
 * Get PQLs (Product-Qualified Leads)
 */
export async function getPQLs(): Promise<LeadScore[]> {
  const allScores = await getAllLeadScores();
  return allScores.filter(score => score.tier === 'pql');
}

