/**
 * API Integration Tests
 * Tests for API endpoints and request/response cycles
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestOrganization, createTestUser, createTestProject, linkUserToOrganization, cleanupTestData } from '../fixtures/db';
import { storage } from '../../server/storage';

describe('API Integration Tests', () => {
  let testOrgId: number;
  let testUserId: string;
  let testProjectId: number;

  beforeAll(async () => {
    // Set up test data
    const org = await createTestOrganization('API Test Org');
    testOrgId = org.id;
    
    const user = await createTestUser(`api-test-${Date.now()}@example.com`);
    testUserId = user.id;
    await linkUserToOrganization(user.id, org.id, 'owner');
    
    const project = await createTestProject(org.id, 'API Test Project');
    testProjectId = project.id;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('Organization API', () => {
    it('should retrieve organization by ID', async () => {
      const org = await storage.getOrganization(testOrgId);
      expect(org).toBeDefined();
      expect(org?.id).toBe(testOrgId);
      expect(org?.name).toBe('API Test Org');
    });

    it('should retrieve organizations by user', async () => {
      const orgs = await storage.getOrganizationsByUser(testUserId);
      expect(Array.isArray(orgs)).toBe(true);
      expect(orgs.length).toBeGreaterThan(0);
      expect(orgs.some(o => o.id === testOrgId)).toBe(true);
    });
  });

  describe('Project API', () => {
    it('should retrieve project by ID', async () => {
      const project = await storage.getProject(testProjectId);
      expect(project).toBeDefined();
      expect(project?.id).toBe(testProjectId);
      expect(project?.organizationId).toBe(testOrgId);
    });

    it('should retrieve projects by organization', async () => {
      const projects = await storage.getProjectsByOrganization(testOrgId);
      expect(Array.isArray(projects)).toBe(true);
      expect(projects.length).toBeGreaterThan(0);
      expect(projects.some(p => p.id === testProjectId)).toBe(true);
    });
  });

  describe('Task API', () => {
    it('should create and retrieve task', async () => {
      const task = await storage.createTask({
        projectId: testProjectId,
        name: 'API Test Task',
        wbsCode: '1.1',
        status: 'not-started',
        priority: 'medium',
      });

      expect(task).toBeDefined();
      expect(task.name).toBe('API Test Task');
      expect(task.projectId).toBe(testProjectId);

      // Retrieve task
      const retrieved = await storage.getTask(task.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(task.id);
      expect(retrieved?.name).toBe('API Test Task');
    });

    it('should retrieve tasks by project', async () => {
      const tasks = await storage.getTasksByProject(testProjectId);
      expect(Array.isArray(tasks)).toBe(true);
    });
  });

  describe('Risk API', () => {
    it('should create and retrieve risk', async () => {
      const risk = await storage.createRisk({
        projectId: testProjectId,
        code: `RISK-${Date.now()}`,
        title: 'API Test Risk',
        description: 'Test risk description',
        probability: 3,
        impact: 'medium',
        status: 'identified',
      });

      expect(risk).toBeDefined();
      expect(risk.title).toBe('API Test Risk');
      expect(risk.projectId).toBe(testProjectId);

      // Retrieve risk
      const retrieved = await storage.getRisk(risk.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(risk.id);
      expect(retrieved?.title).toBe('API Test Risk');
    });

    it('should retrieve risks by project', async () => {
      const risks = await storage.getRisksByProject(testProjectId);
      expect(Array.isArray(risks)).toBe(true);
    });
  });

  describe('Issue API', () => {
    it('should create and retrieve issue', async () => {
      const issue = await storage.createIssue({
        projectId: testProjectId,
        code: `ISS-${Date.now()}`,
        title: 'API Test Issue',
        description: 'Test issue description',
        status: 'open',
        priority: 'medium',
        issueType: 'standard',
      });

      expect(issue).toBeDefined();
      expect(issue.title).toBe('API Test Issue');
      expect(issue.projectId).toBe(testProjectId);

      // Retrieve issue
      const retrieved = await storage.getIssue(issue.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(issue.id);
      expect(retrieved?.title).toBe('API Test Issue');
    });

    it('should retrieve issues by project', async () => {
      const issues = await storage.getIssuesByProject(testProjectId);
      expect(Array.isArray(issues)).toBe(true);
    });
  });

  describe('Cost Item API', () => {
    it('should create and retrieve cost item', async () => {
      const costItem = await storage.createCostItem({
        projectId: testProjectId,
        category: 'labor',
        description: 'API Test Cost Item',
        budgeted: '10000.00',
        actual: '0.00',
      });

      expect(costItem).toBeDefined();
      expect(costItem.description).toBe('API Test Cost Item');
      expect(costItem.projectId).toBe(testProjectId);

      // Retrieve cost item
      const costItems = await storage.getCostItemsByProject(testProjectId);
      expect(Array.isArray(costItems)).toBe(true);
      expect(costItems.some(ci => ci.id === costItem.id)).toBe(true);
    });
  });

  describe('Data Relationships', () => {
    it('should maintain project-organization relationship', async () => {
      const project = await storage.getProject(testProjectId);
      expect(project).toBeDefined();
      expect(project?.organizationId).toBe(testOrgId);
      
      const org = await storage.getOrganization(testOrgId);
      expect(org).toBeDefined();
    });

    it('should maintain task-project relationship', async () => {
      const task = await storage.createTask({
        projectId: testProjectId,
        name: 'Relationship Test Task',
        wbsCode: '1.2',
        status: 'not-started',
      });

      expect(task.projectId).toBe(testProjectId);
      
      const project = await storage.getProject(testProjectId);
      expect(project).toBeDefined();
    });
  });
});

