/**
 * Database Test Fixtures
 * Utilities for setting up and tearing down test database state
 */

import { db } from '../../server/db';
import { storage } from '../../server/storage';
import * as schema from '@shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Create a test organization
 */
export async function createTestOrganization(name = 'Test Organization') {
  const org = await storage.createOrganization({
    name,
    slug: `test-org-${Date.now()}`,
  });
  return org;
}

/**
 * Create a test user
 */
export async function createTestUser(email = `test-${Date.now()}@example.com`, password?: string) {
  const { hashPassword } = await import('../../server/auth');
  
  const userId = `user-test-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const passwordHash = password ? await hashPassword(password) : null;

  const [user] = await db
    .insert(schema.users)
    .values({
      id: userId,
      email: email.toLowerCase(),
      passwordHash,
      emailVerified: true,
      firstName: 'Test',
      lastName: 'User',
    })
    .returning();

  return user;
}

/**
 * Create a test project
 */
export async function createTestProject(organizationId: number, name = 'Test Project') {
  const project = await storage.createProject({
    organizationId,
    name,
    code: `TEST-${Date.now()}`,
    status: 'active',
  });
  return project;
}

/**
 * Link user to organization
 */
export async function linkUserToOrganization(
  userId: string,
  organizationId: number,
  role: 'owner' | 'admin' | 'member' | 'viewer' = 'member'
) {
  return await storage.createUserOrganization({
    userId,
    organizationId,
    role,
  });
}

/**
 * Create a test task
 */
export async function createTestTask(
  projectId: number,
  options: {
    name?: string;
    wbsCode?: string;
    parentId?: number | null;
    status?: 'not-started' | 'in-progress' | 'completed' | 'on-hold' | 'cancelled';
    priority?: 'low' | 'medium' | 'high' | 'critical';
    assignedTo?: string | null;
  } = {}
): Promise<schema.Task> {
  const task = await storage.createTask({
    projectId,
    name: options.name || `Test Task ${Date.now()}`,
    wbsCode: options.wbsCode || `1.${Date.now()}`,
    parentId: options.parentId ?? null,
    status: options.status || 'not-started',
    priority: options.priority || 'medium',
    assignedTo: options.assignedTo || null,
  });
  return task;
}

/**
 * Create a test risk
 */
export async function createTestRisk(
  projectId: number,
  options: {
    title?: string;
    description?: string;
    probability?: number;
    impact?: string | number;
    status?: string;
    priority?: string;
  } = {}
): Promise<schema.Risk> {
  // Generate sequential code
  const code = `RISK-${Date.now().toString().slice(-6)}`;
  
  const risk = await storage.createRisk({
    projectId,
    code,
    title: options.title || `Test Risk ${Date.now()}`,
    description: options.description || 'Test risk description',
    probability: options.probability ?? 3,
    impact: typeof options.impact === 'string' ? options.impact : (options.impact?.toString() || 'medium'),
    status: options.status || 'identified',
  });
  return risk;
}

/**
 * Create a test issue
 */
export async function createTestIssue(
  projectId: number,
  options: {
    title?: string;
    description?: string;
    priority?: string;
    status?: string;
    issueType?: string;
  } = {}
): Promise<schema.Issue> {
  // Generate sequential code
  const code = `ISS-${Date.now().toString().slice(-6)}`;
  
  const issue = await storage.createIssue({
    projectId,
    code,
    title: options.title || `Test Issue ${Date.now()}`,
    description: options.description || 'Test issue description',
    priority: options.priority || 'medium',
    status: options.status || 'open',
    issueType: options.issueType || 'standard',
  });
  return issue;
}

/**
 * Create a test cost item
 */
export async function createTestCostItem(
  projectId: number,
  options: {
    description?: string;
    category?: string;
    budgeted?: string;
    actual?: string;
  } = {}
): Promise<schema.CostItem> {
  const costItem = await storage.createCostItem({
    projectId,
    category: options.category || 'labor',
    description: options.description || `Test Cost Item ${Date.now()}`,
    budgeted: options.budgeted || '1000.00',
    actual: options.actual || '0.00',
  });
  return costItem;
}

/**
 * Link task to risk
 */
export async function linkTaskToRisk(taskId: number, riskId: number) {
  return await db.insert(schema.riskTasks).values({
    taskId,
    riskId,
  }).returning();
}

/**
 * Link task to issue
 */
export async function linkTaskToIssue(taskId: number, issueId: number) {
  return await db.insert(schema.issueTasks).values({
    taskId,
    issueId,
  }).returning();
}

/**
 * Clean up specific test project
 */
export async function cleanupTestProject(projectId: number) {
  try {
    // Delete project (cascade will handle related records)
    await db.delete(schema.projects).where(eq(schema.projects.id, projectId));
    console.log(`[Test Cleanup] Cleaned up project ${projectId}`);
  } catch (error) {
    console.error(`[Test Cleanup] Error cleaning up project ${projectId}:`, error);
    throw error;
  }
}

/**
 * Clean up specific test user
 */
export async function cleanupTestUser(userId: string) {
  try {
    // Delete user (cascade will handle related records)
    await db.delete(schema.users).where(eq(schema.users.id, userId));
    console.log(`[Test Cleanup] Cleaned up user ${userId}`);
  } catch (error) {
    console.error(`[Test Cleanup] Error cleaning up user ${userId}:`, error);
    throw error;
  }
}

