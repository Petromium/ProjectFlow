/**
 * Storage Layer Unit Tests
 * Tests for database operations and data access layer
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { storage } from '../../server/storage';
import { 
  createTestOrganization, 
  createTestUser, 
  createTestProject,
  createTestTask,
  createTestRisk,
  createTestIssue,
  createTestCostItem,
  linkUserToOrganization,
  linkTaskToRisk,
  linkTaskToIssue,
  cleanupTestData 
} from '../fixtures/db';

describe('Storage Layer', () => {
  let testOrgId: number;
  let testUserId: string;
  let testProjectId: number;

  beforeAll(async () => {
    // Set up test data
    const org = await createTestOrganization();
    testOrgId = org.id;
    const user = await createTestUser();
    testUserId = user.id;
    await linkUserToOrganization(user.id, org.id, 'owner');
    
    const project = await createTestProject(org.id, 'Test Project');
    testProjectId = project.id;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('User Operations', () => {
    it('should create a user', async () => {
      const email = `test-create-${Date.now()}@example.com`;
      const user = await createTestUser(email);
      
      expect(user).toBeDefined();
      expect(user.email).toBe(email.toLowerCase());
    });

    it('should retrieve a user by ID', async () => {
      const user = await storage.getUser(testUserId);
      expect(user).toBeDefined();
      expect(user?.id).toBe(testUserId);
    });

    it('should retrieve a user by email', async () => {
      const email = `test-retrieve-${Date.now()}@example.com`;
      const user = await createTestUser(email);
      const retrieved = await storage.getUserByEmail(email);
      
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(user.id);
    });

    it('should update a user', async () => {
      const user = await createTestUser(`update-${Date.now()}@example.com`);
      const updated = await storage.updateUser(user.id, {
        firstName: 'Updated',
        lastName: 'Name',
      });
      
      expect(updated).toBeDefined();
      expect(updated?.firstName).toBe('Updated');
      expect(updated?.lastName).toBe('Name');
    });
  });

  describe('Organization Operations', () => {
    it('should create an organization', async () => {
      const org = await createTestOrganization('Test Org CRUD');
      expect(org).toBeDefined();
      expect(org.name).toBe('Test Org CRUD');
    });

    it('should retrieve an organization by ID', async () => {
      const org = await storage.getOrganization(testOrgId);
      expect(org).toBeDefined();
      expect(org?.id).toBe(testOrgId);
    });

    it('should retrieve organizations by user', async () => {
      const orgs = await storage.getOrganizationsByUser(testUserId);
      expect(Array.isArray(orgs)).toBe(true);
      expect(orgs.length).toBeGreaterThan(0);
    });

    it('should update an organization', async () => {
      const org = await createTestOrganization('Update Test Org');
      const updated = await storage.updateOrganization(org.id, {
        name: 'Updated Org Name',
      });
      
      expect(updated).toBeDefined();
      expect(updated?.name).toBe('Updated Org Name');
    });
  });

  describe('Project Operations', () => {
    it('should create a project', async () => {
      const project = await storage.createProject({
        organizationId: testOrgId,
        name: 'Test Project CRUD',
        code: `TEST-${Date.now()}`,
        status: 'active',
      });

      expect(project).toBeDefined();
      expect(project.name).toBe('Test Project CRUD');
      expect(project.organizationId).toBe(testOrgId);
    });

    it('should retrieve projects by organization', async () => {
      const projects = await storage.getProjectsByOrganization(testOrgId);
      expect(Array.isArray(projects)).toBe(true);
      expect(projects.length).toBeGreaterThan(0);
    });

    it('should retrieve a project by ID', async () => {
      const project = await storage.getProject(testProjectId);
      expect(project).toBeDefined();
      expect(project?.id).toBe(testProjectId);
    });

    it('should update a project', async () => {
      const project = await createTestProject(testOrgId, 'Update Test Project');
      const updated = await storage.updateProject(project.id, {
        name: 'Updated Project Name',
        status: 'on-hold',
      });
      
      expect(updated).toBeDefined();
      expect(updated?.name).toBe('Updated Project Name');
      expect(updated?.status).toBe('on-hold');
    });
  });

  describe('Task Operations', () => {
    it('should create a task', async () => {
      const task = await createTestTask(testProjectId, {
        name: 'Test Task CRUD',
        status: 'not-started',
        priority: 'high',
      });

      expect(task).toBeDefined();
      expect(task.name).toBe('Test Task CRUD');
      expect(task.projectId).toBe(testProjectId);
      expect(task.status).toBe('not-started');
      expect(task.priority).toBe('high');
    });

    it('should retrieve tasks by project', async () => {
      const tasks = await storage.getTasksByProject(testProjectId);
      expect(Array.isArray(tasks)).toBe(true);
    });

    it('should update a task', async () => {
      const task = await createTestTask(testProjectId);
      const updated = await storage.updateTask(task.id, {
        status: 'in-progress',
        progress: 50,
      });
      
      expect(updated).toBeDefined();
      expect(updated?.status).toBe('in-progress');
      expect(updated?.progress).toBe(50);
    });

    it('should create task with parent (subtask)', async () => {
      const parentTask = await createTestTask(testProjectId, { name: 'Parent Task' });
      const subtask = await createTestTask(testProjectId, {
        name: 'Subtask',
        parentId: parentTask.id,
      });
      
      expect(subtask).toBeDefined();
      expect(subtask.parentId).toBe(parentTask.id);
    });
  });

  describe('Risk Operations', () => {
    it('should create a risk', async () => {
      const risk = await createTestRisk(testProjectId, {
        title: 'Test Risk CRUD',
        probability: 4,
        impact: 'high',
      });

      expect(risk).toBeDefined();
      expect(risk.title).toBe('Test Risk CRUD');
      expect(risk.projectId).toBe(testProjectId);
      expect(risk.code).toBeDefined();
      expect(risk.probability).toBe(4);
    });

    it('should retrieve risks by project', async () => {
      const risks = await storage.getRisksByProject(testProjectId);
      expect(Array.isArray(risks)).toBe(true);
    });

    it('should update a risk', async () => {
      const risk = await createTestRisk(testProjectId);
      const updated = await storage.updateRisk(risk.id, {
        status: 'mitigated',
        mitigationPlan: 'Test mitigation plan',
      });
      
      expect(updated).toBeDefined();
      expect(updated?.status).toBe('mitigated');
      expect(updated?.mitigationPlan).toBe('Test mitigation plan');
    });

    it('should link task to risk', async () => {
      const task = await createTestTask(testProjectId);
      const risk = await createTestRisk(testProjectId);
      const link = await linkTaskToRisk(task.id, risk.id);
      
      expect(link).toBeDefined();
      expect(link[0].taskId).toBe(task.id);
      expect(link[0].riskId).toBe(risk.id);
    });
  });

  describe('Issue Operations', () => {
    it('should create an issue', async () => {
      const issue = await createTestIssue(testProjectId, {
        title: 'Test Issue CRUD',
        priority: 'critical',
        status: 'open',
      });

      expect(issue).toBeDefined();
      expect(issue.title).toBe('Test Issue CRUD');
      expect(issue.projectId).toBe(testProjectId);
      expect(issue.code).toBeDefined();
      expect(issue.priority).toBe('critical');
    });

    it('should retrieve issues by project', async () => {
      const issues = await storage.getIssuesByProject(testProjectId);
      expect(Array.isArray(issues)).toBe(true);
    });

    it('should update an issue', async () => {
      const issue = await createTestIssue(testProjectId);
      const updated = await storage.updateIssue(issue.id, {
        status: 'resolved',
        resolution: 'Test resolution',
      });
      
      expect(updated).toBeDefined();
      expect(updated?.status).toBe('resolved');
      expect(updated?.resolution).toBe('Test resolution');
    });

    it('should link task to issue', async () => {
      const task = await createTestTask(testProjectId);
      const issue = await createTestIssue(testProjectId);
      const link = await linkTaskToIssue(task.id, issue.id);
      
      expect(link).toBeDefined();
      expect(link[0].taskId).toBe(task.id);
      expect(link[0].issueId).toBe(issue.id);
    });
  });

  describe('Cost Item Operations', () => {
    it('should create a cost item', async () => {
      const costItem = await createTestCostItem(testProjectId, {
        description: 'Test Cost Item CRUD',
        category: 'labor',
        budgeted: '5000.00',
      });

      expect(costItem).toBeDefined();
      expect(costItem.description).toBe('Test Cost Item CRUD');
      expect(costItem.projectId).toBe(testProjectId);
      expect(costItem.category).toBe('labor');
    });

    it('should retrieve cost items by project', async () => {
      const costItems = await storage.getCostItemsByProject(testProjectId);
      expect(Array.isArray(costItems)).toBe(true);
    });

    it('should update a cost item', async () => {
      const costItem = await createTestCostItem(testProjectId);
      const updated = await storage.updateCostItem(costItem.id, {
        actual: '1500.00',
      });
      
      expect(updated).toBeDefined();
      expect(updated?.actual).toBe('1500.00');
    });
  });

  describe('Error Handling', () => {
    it('should return undefined for non-existent project', async () => {
      const project = await storage.getProject(999999);
      expect(project).toBeUndefined();
    });

    it('should return undefined for non-existent task', async () => {
      const task = await storage.getTask(999999);
      expect(task).toBeUndefined();
    });

    it('should return undefined for non-existent risk', async () => {
      const risk = await storage.getRisk(999999);
      expect(risk).toBeUndefined();
    });

    it('should return undefined for non-existent issue', async () => {
      const issue = await storage.getIssue(999999);
      expect(issue).toBeUndefined();
    });

    it('should handle invalid project ID gracefully', async () => {
      const tasks = await storage.getTasksByProject(999999);
      expect(Array.isArray(tasks)).toBe(true);
      expect(tasks.length).toBe(0);
    });
  });

  describe('Data Integrity', () => {
    it('should enforce project-organization relationship', async () => {
      const project = await storage.getProject(testProjectId);
      expect(project).toBeDefined();
      expect(project?.organizationId).toBe(testOrgId);
      
      // Verify organization exists
      const org = await storage.getOrganization(testOrgId);
      expect(org).toBeDefined();
    });

    it('should enforce task-project relationship', async () => {
      const task = await createTestTask(testProjectId);
      expect(task.projectId).toBe(testProjectId);
      
      const project = await storage.getProject(testProjectId);
      expect(project).toBeDefined();
    });

    it('should enforce risk-project relationship', async () => {
      const risk = await createTestRisk(testProjectId);
      expect(risk.projectId).toBe(testProjectId);
    });

    it('should enforce issue-project relationship', async () => {
      const issue = await createTestIssue(testProjectId);
      expect(issue.projectId).toBe(testProjectId);
    });

    it('should enforce cost item-project relationship', async () => {
      const costItem = await createTestCostItem(testProjectId);
      expect(costItem.projectId).toBe(testProjectId);
    });
  });

  describe('Cascading Deletes', () => {
    it('should handle task deletion (if implemented)', async () => {
      const task = await createTestTask(testProjectId);
      await storage.deleteTask(task.id);
      
      const deleted = await storage.getTask(task.id);
      expect(deleted).toBeUndefined();
    });

    it('should handle risk deletion', async () => {
      const risk = await createTestRisk(testProjectId);
      await storage.deleteRisk(risk.id);
      
      const deleted = await storage.getRisk(risk.id);
      expect(deleted).toBeUndefined();
    });

    it('should handle issue deletion', async () => {
      const issue = await createTestIssue(testProjectId);
      await storage.deleteIssue(issue.id);
      
      const deleted = await storage.getIssue(issue.id);
      expect(deleted).toBeUndefined();
    });
  });
});

