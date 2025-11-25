import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq, and, desc, asc, isNull, inArray } from "drizzle-orm";
import * as schema from "@shared/schema";
import type {
  InsertOrganization,
  Organization,
  InsertUser,
  UpsertUser,
  User,
  InsertUserOrganization,
  UserOrganization,
  InsertProject,
  Project,
  InsertTask,
  Task,
  InsertTaskDependency,
  TaskDependency,
  InsertStakeholder,
  Stakeholder,
  InsertRisk,
  Risk,
  InsertIssue,
  Issue,
  InsertChangeRequest,
  ChangeRequest,
  InsertCostItem,
  CostItem,
  InsertResource,
  Resource,
  InsertResourceAssignment,
  ResourceAssignment,
  InsertGoogleConnection,
  GoogleConnection,
  InsertAiConversation,
  AiConversation,
  InsertAiMessage,
  AiMessage,
  InsertAiUsage,
  AiUsage,
  InsertEmailTemplate,
  EmailTemplate,
  InsertSentEmail,
  SentEmail,
  InsertEmailUsage,
  EmailUsage,
  InsertProjectFile,
  ProjectFile,
  StorageQuota,
  InsertCloudStorageConnection,
  CloudStorageConnection,
  InsertCloudSyncedFile,
  CloudSyncedFile,
  SubscriptionPlan,
  InsertSubscriptionPlan,
  OrganizationSubscription,
  InsertOrganizationSubscription,
  AiUsageSummary,
  InsertAiUsageSummary,
  InsertDocument,
  Document,
} from "@shared/schema";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

export interface IStorage {
  // Organizations
  getOrganization(id: number): Promise<Organization | undefined>;
  getOrganizationBySlug(slug: string): Promise<Organization | undefined>;
  getOrganizationsByUser(userId: string): Promise<Organization[]>;
  getAllOrganizations(): Promise<Organization[]>;
  createOrganization(org: InsertOrganization): Promise<Organization>;
  updateOrganization(id: number, org: Partial<InsertOrganization>): Promise<Organization | undefined>;

  // Users (Replit Auth compatible)
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  getUsersByOrganization(organizationId: number): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  assignDemoOrgToUser(userId: string): Promise<void>;

  // User Organizations
  getUserOrganization(userId: string, organizationId: number): Promise<UserOrganization | undefined>;
  getUserOrganizations(userId: string): Promise<UserOrganization[]>;
  createUserOrganization(userOrg: InsertUserOrganization): Promise<UserOrganization>;
  deleteUserOrganization(userId: string, organizationId: number): Promise<void>;

  // Projects
  getProject(id: number): Promise<Project | undefined>;
  getProjectsByOrganization(organizationId: number): Promise<Project[]>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: number, project: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: number): Promise<void>;

  // Tasks
  getTask(id: number): Promise<Task | undefined>;
  getTasksByProject(projectId: number): Promise<Task[]>;
  getTasksByParent(projectId: number, parentId: number | null): Promise<Task[]>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: number, task: Partial<InsertTask>): Promise<Task | undefined>;
  deleteTask(id: number): Promise<void>;

  // Task Dependencies
  getTaskDependency(id: number): Promise<TaskDependency | undefined>;
  getTaskDependencies(taskId: number): Promise<TaskDependency[]>;
  getDependenciesByProject(projectId: number): Promise<TaskDependency[]>;
  createTaskDependency(dependency: InsertTaskDependency): Promise<TaskDependency>;
  deleteTaskDependency(id: number): Promise<void>;

  // Stakeholders
  getStakeholder(id: number): Promise<Stakeholder | undefined>;
  getStakeholdersByProject(projectId: number): Promise<Stakeholder[]>;
  createStakeholder(stakeholder: InsertStakeholder): Promise<Stakeholder>;
  updateStakeholder(id: number, stakeholder: Partial<InsertStakeholder>): Promise<Stakeholder | undefined>;
  deleteStakeholder(id: number): Promise<void>;

  // Risks
  getRisk(id: number): Promise<Risk | undefined>;
  getRisksByProject(projectId: number): Promise<Risk[]>;
  createRisk(risk: InsertRisk): Promise<Risk>;
  updateRisk(id: number, risk: Partial<InsertRisk>): Promise<Risk | undefined>;
  deleteRisk(id: number): Promise<void>;

  // Issues
  getIssue(id: number): Promise<Issue | undefined>;
  getIssuesByProject(projectId: number): Promise<Issue[]>;
  createIssue(issue: InsertIssue): Promise<Issue>;
  updateIssue(id: number, issue: Partial<InsertIssue>): Promise<Issue | undefined>;
  deleteIssue(id: number): Promise<void>;

  // Change Requests
  getChangeRequest(id: number): Promise<ChangeRequest | undefined>;
  getChangeRequestsByProject(projectId: number): Promise<ChangeRequest[]>;
  createChangeRequest(changeRequest: InsertChangeRequest): Promise<ChangeRequest>;
  updateChangeRequest(id: number, changeRequest: Partial<InsertChangeRequest>): Promise<ChangeRequest | undefined>;
  deleteChangeRequest(id: number): Promise<void>;

  // Cost Items
  getCostItem(id: number): Promise<CostItem | undefined>;
  getCostItemsByProject(projectId: number): Promise<CostItem[]>;
  getCostItemsByTask(taskId: number): Promise<CostItem[]>;
  createCostItem(costItem: InsertCostItem): Promise<CostItem>;
  updateCostItem(id: number, costItem: Partial<InsertCostItem>): Promise<CostItem | undefined>;
  deleteCostItem(id: number): Promise<void>;

  // Resources
  getResource(id: number): Promise<Resource | undefined>;
  getResourcesByProject(projectId: number): Promise<Resource[]>;
  createResource(resource: InsertResource): Promise<Resource>;
  updateResource(id: number, resource: Partial<InsertResource>): Promise<Resource | undefined>;
  deleteResource(id: number): Promise<void>;

  // Resource Assignments
  getResourceAssignment(id: number): Promise<ResourceAssignment | undefined>;
  getResourceAssignmentsByTask(taskId: number): Promise<ResourceAssignment[]>;
  createResourceAssignment(assignment: InsertResourceAssignment): Promise<ResourceAssignment>;
  deleteResourceAssignment(id: number): Promise<void>;

  // Google Connections
  getGoogleConnection(userId: string): Promise<GoogleConnection | undefined>;
  createGoogleConnection(connection: InsertGoogleConnection): Promise<GoogleConnection>;
  updateGoogleConnection(userId: string, connection: Partial<InsertGoogleConnection>): Promise<GoogleConnection | undefined>;
  deleteGoogleConnection(userId: string): Promise<void>;

  // AI Conversations
  getAiConversation(id: number): Promise<AiConversation | undefined>;
  getAiConversationsByUser(userId: string): Promise<AiConversation[]>;
  getAiConversationsByProject(projectId: number): Promise<AiConversation[]>;
  createAiConversation(conversation: InsertAiConversation): Promise<AiConversation>;
  updateAiConversation(id: number, conversation: Partial<InsertAiConversation>): Promise<AiConversation | undefined>;
  deleteAiConversation(id: number): Promise<void>;

  // AI Messages
  getAiMessagesByConversation(conversationId: number): Promise<AiMessage[]>;
  createAiMessage(message: InsertAiMessage): Promise<AiMessage>;

  // AI Usage
  createAiUsage(usage: InsertAiUsage): Promise<AiUsage>;
  getAiUsageByUser(userId: string, startDate?: Date): Promise<AiUsage[]>;

  // Email Templates
  getEmailTemplate(id: number): Promise<EmailTemplate | undefined>;
  getEmailTemplatesByOrganization(organizationId: number): Promise<EmailTemplate[]>;
  getEmailTemplateByType(organizationId: number, type: string): Promise<EmailTemplate | undefined>;
  createEmailTemplate(template: InsertEmailTemplate & { createdBy: string }): Promise<EmailTemplate>;
  updateEmailTemplate(id: number, template: Partial<InsertEmailTemplate>): Promise<EmailTemplate | undefined>;
  deleteEmailTemplate(id: number): Promise<void>;

  // Sent Emails
  createSentEmail(email: InsertSentEmail): Promise<SentEmail>;
  getSentEmailsByOrganization(organizationId: number, limit?: number): Promise<SentEmail[]>;
  updateSentEmailStatus(id: number, status: string, errorMessage?: string): Promise<SentEmail | undefined>;

  // Email Usage
  getEmailUsage(organizationId: number, month: string): Promise<EmailUsage | undefined>;
  incrementEmailUsage(organizationId: number): Promise<EmailUsage>;

  // Project Files
  getProjectFile(id: number): Promise<ProjectFile | undefined>;
  getProjectFilesByProject(projectId: number): Promise<ProjectFile[]>;
  getProjectFilesByOrganization(organizationId: number): Promise<ProjectFile[]>;
  createProjectFile(file: InsertProjectFile & { uploadedBy: string }): Promise<ProjectFile>;
  updateProjectFile(id: number, file: Partial<InsertProjectFile>): Promise<ProjectFile | undefined>;
  deleteProjectFile(id: number): Promise<void>;

  // Storage Quotas
  getStorageQuota(organizationId: number): Promise<StorageQuota | undefined>;
  updateStorageQuota(organizationId: number, usedBytes: number): Promise<StorageQuota>;
  incrementStorageUsage(organizationId: number, bytes: number): Promise<StorageQuota>;
  decrementStorageUsage(organizationId: number, bytes: number): Promise<StorageQuota>;

  // Subscription Plans
  getSubscriptionPlans(): Promise<SubscriptionPlan[]>;
  getSubscriptionPlan(id: number): Promise<SubscriptionPlan | undefined>;
  getSubscriptionPlanByTier(tier: string): Promise<SubscriptionPlan | undefined>;
  createSubscriptionPlan(plan: InsertSubscriptionPlan): Promise<SubscriptionPlan>;
  updateSubscriptionPlan(id: number, plan: Partial<InsertSubscriptionPlan>): Promise<SubscriptionPlan | undefined>;

  // Organization Subscriptions
  getOrganizationSubscription(organizationId: number): Promise<OrganizationSubscription | undefined>;
  createOrganizationSubscription(subscription: InsertOrganizationSubscription): Promise<OrganizationSubscription>;
  updateOrganizationSubscription(organizationId: number, subscription: Partial<InsertOrganizationSubscription>): Promise<OrganizationSubscription | undefined>;

  // AI Usage Summary
  getAiUsageSummary(organizationId: number, month: string): Promise<AiUsageSummary | undefined>;
  incrementAiUsage(organizationId: number, tokensUsed: number): Promise<AiUsageSummary>;
  
  // Cloud Storage Connections
  getCloudStorageConnections(organizationId: number): Promise<CloudStorageConnection[]>;
  getCloudStorageConnection(id: number): Promise<CloudStorageConnection | undefined>;
  createCloudStorageConnection(connection: InsertCloudStorageConnection & { connectedBy: string }): Promise<CloudStorageConnection>;
  updateCloudStorageConnection(id: number, connection: Partial<InsertCloudStorageConnection>): Promise<CloudStorageConnection | undefined>;
  deleteCloudStorageConnection(id: number): Promise<void>;

  // Documents
  getDocument(id: number): Promise<Document | undefined>;
  getDocumentsByProject(projectId: number): Promise<Document[]>;
  getDocumentsByTask(taskId: number): Promise<Document[]>;
  createDocument(document: InsertDocument & { createdBy: string }): Promise<Document>;
  updateDocument(id: number, document: Partial<InsertDocument>): Promise<Document | undefined>;
  deleteDocument(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Organizations
  async getOrganization(id: number): Promise<Organization | undefined> {
    const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, id));
    return org;
  }

  async getOrganizationBySlug(slug: string): Promise<Organization | undefined> {
    const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.slug, slug));
    return org;
  }

  async getOrganizationsByUser(userId: string): Promise<Organization[]> {
    const userOrgs = await db.select().from(schema.userOrganizations)
      .where(eq(schema.userOrganizations.userId, userId));
    
    const orgIds = userOrgs.map(uo => uo.organizationId);
    if (orgIds.length === 0) return [];

    return await db.select().from(schema.organizations)
      .where(inArray(schema.organizations.id, orgIds));
  }

  async getAllOrganizations(): Promise<Organization[]> {
    return await db.select().from(schema.organizations);
  }

  async createOrganization(org: InsertOrganization): Promise<Organization> {
    const [created] = await db.insert(schema.organizations).values(org).returning();
    return created;
  }

  async updateOrganization(id: number, org: Partial<InsertOrganization>): Promise<Organization | undefined> {
    const [updated] = await db.update(schema.organizations)
      .set({ ...org, updatedAt: new Date() })
      .where(eq(schema.organizations.id, id))
      .returning();
    return updated;
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email));
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(schema.users);
  }

  async getUsersByOrganization(organizationId: number): Promise<User[]> {
    const userOrgs = await db.select().from(schema.userOrganizations)
      .where(eq(schema.userOrganizations.organizationId, organizationId));
    
    const userIds = userOrgs.map(uo => uo.userId);
    if (userIds.length === 0) return [];

    return await db.select().from(schema.users)
      .where(inArray(schema.users.id, userIds));
  }

  async createUser(user: InsertUser): Promise<User> {
    const [created] = await db.insert(schema.users).values(user).returning();
    return created;
  }

  async updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined> {
    const [updated] = await db.update(schema.users)
      .set({ ...user, updatedAt: new Date() })
      .where(eq(schema.users.id, id))
      .returning();
    return updated;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(schema.users)
      .values(userData)
      .onConflictDoUpdate({
        target: schema.users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async assignDemoOrgToUser(userId: string): Promise<void> {
    const DEMO_ORG_SLUG = "demo-solar-project";
    
    const demoOrg = await this.getOrganizationBySlug(DEMO_ORG_SLUG);
    if (!demoOrg) {
      console.log("Demo organization not found, skipping auto-assignment");
      return;
    }

    const existingAssignment = await this.getUserOrganization(userId, demoOrg.id);
    if (existingAssignment) {
      return;
    }

    await db.insert(schema.userOrganizations).values({
      userId,
      organizationId: demoOrg.id,
      role: "viewer",
    });
    console.log(`Assigned user ${userId} to demo organization as viewer`);
  }

  // User Organizations
  async getUserOrganization(userId: string, organizationId: number): Promise<UserOrganization | undefined> {
    const [userOrg] = await db.select().from(schema.userOrganizations)
      .where(and(
        eq(schema.userOrganizations.userId, userId),
        eq(schema.userOrganizations.organizationId, organizationId)
      ));
    return userOrg;
  }

  async getUserOrganizations(userId: string): Promise<UserOrganization[]> {
    return await db.select().from(schema.userOrganizations)
      .where(eq(schema.userOrganizations.userId, userId));
  }

  async createUserOrganization(userOrg: InsertUserOrganization): Promise<UserOrganization> {
    const [created] = await db.insert(schema.userOrganizations).values(userOrg).returning();
    return created;
  }

  async deleteUserOrganization(userId: string, organizationId: number): Promise<void> {
    await db.delete(schema.userOrganizations)
      .where(and(
        eq(schema.userOrganizations.userId, userId),
        eq(schema.userOrganizations.organizationId, organizationId)
      ));
  }

  // Projects
  async getProject(id: number): Promise<Project | undefined> {
    const [project] = await db.select().from(schema.projects).where(eq(schema.projects.id, id));
    return project;
  }

  async getProjectsByOrganization(organizationId: number): Promise<Project[]> {
    return await db.select().from(schema.projects)
      .where(eq(schema.projects.organizationId, organizationId))
      .orderBy(desc(schema.projects.createdAt));
  }

  async createProject(project: InsertProject): Promise<Project> {
    const [created] = await db.insert(schema.projects).values(project).returning();
    return created;
  }

  async updateProject(id: number, project: Partial<InsertProject>): Promise<Project | undefined> {
    const [updated] = await db.update(schema.projects)
      .set({ ...project, updatedAt: new Date() })
      .where(eq(schema.projects.id, id))
      .returning();
    return updated;
  }

  async deleteProject(id: number): Promise<void> {
    await db.delete(schema.projects).where(eq(schema.projects.id, id));
  }

  // Tasks
  async getTask(id: number): Promise<Task | undefined> {
    const [task] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, id));
    return task;
  }

  async getTasksByProject(projectId: number): Promise<Task[]> {
    return await db.select().from(schema.tasks)
      .where(eq(schema.tasks.projectId, projectId))
      .orderBy(asc(schema.tasks.wbsCode));
  }

  async getTasksByParent(projectId: number, parentId: number | null): Promise<Task[]> {
    if (parentId === null) {
      return await db.select().from(schema.tasks)
        .where(and(
          eq(schema.tasks.projectId, projectId),
          isNull(schema.tasks.parentId)
        ))
        .orderBy(asc(schema.tasks.wbsCode));
    }
    return await db.select().from(schema.tasks)
      .where(and(
        eq(schema.tasks.projectId, projectId),
        eq(schema.tasks.parentId, parentId)
      ))
      .orderBy(asc(schema.tasks.wbsCode));
  }

  async createTask(task: InsertTask): Promise<Task> {
    const [created] = await db.insert(schema.tasks).values(task).returning();
    return created;
  }

  async updateTask(id: number, task: Partial<InsertTask>): Promise<Task | undefined> {
    const [updated] = await db.update(schema.tasks)
      .set({ ...task, updatedAt: new Date() })
      .where(eq(schema.tasks.id, id))
      .returning();
    return updated;
  }

  async deleteTask(id: number): Promise<void> {
    await db.delete(schema.tasks).where(eq(schema.tasks.id, id));
  }

  // Task Dependencies
  async getTaskDependency(id: number): Promise<TaskDependency | undefined> {
    const [dep] = await db.select().from(schema.taskDependencies)
      .where(eq(schema.taskDependencies.id, id));
    return dep;
  }

  async getTaskDependencies(taskId: number): Promise<TaskDependency[]> {
    return await db.select().from(schema.taskDependencies)
      .where(eq(schema.taskDependencies.successorId, taskId));
  }

  async getDependenciesByProject(projectId: number): Promise<TaskDependency[]> {
    return await db.select().from(schema.taskDependencies)
      .where(eq(schema.taskDependencies.projectId, projectId));
  }

  async createTaskDependency(dependency: InsertTaskDependency): Promise<TaskDependency> {
    const [created] = await db.insert(schema.taskDependencies).values(dependency).returning();
    return created;
  }

  async deleteTaskDependency(id: number): Promise<void> {
    await db.delete(schema.taskDependencies).where(eq(schema.taskDependencies.id, id));
  }

  // Stakeholders
  async getStakeholder(id: number): Promise<Stakeholder | undefined> {
    const [stakeholder] = await db.select().from(schema.stakeholders)
      .where(eq(schema.stakeholders.id, id));
    return stakeholder;
  }

  async getStakeholdersByProject(projectId: number): Promise<Stakeholder[]> {
    return await db.select().from(schema.stakeholders)
      .where(eq(schema.stakeholders.projectId, projectId))
      .orderBy(desc(schema.stakeholders.createdAt));
  }

  async createStakeholder(stakeholder: InsertStakeholder): Promise<Stakeholder> {
    const [created] = await db.insert(schema.stakeholders).values(stakeholder).returning();
    return created;
  }

  async updateStakeholder(id: number, stakeholder: Partial<InsertStakeholder>): Promise<Stakeholder | undefined> {
    const [updated] = await db.update(schema.stakeholders)
      .set({ ...stakeholder, updatedAt: new Date() })
      .where(eq(schema.stakeholders.id, id))
      .returning();
    return updated;
  }

  async deleteStakeholder(id: number): Promise<void> {
    await db.delete(schema.stakeholders).where(eq(schema.stakeholders.id, id));
  }

  // Risks
  async getRisk(id: number): Promise<Risk | undefined> {
    const [risk] = await db.select().from(schema.risks).where(eq(schema.risks.id, id));
    return risk;
  }

  async getRisksByProject(projectId: number): Promise<Risk[]> {
    return await db.select().from(schema.risks)
      .where(eq(schema.risks.projectId, projectId))
      .orderBy(desc(schema.risks.createdAt));
  }

  async createRisk(risk: InsertRisk): Promise<Risk> {
    const [created] = await db.insert(schema.risks).values(risk).returning();
    return created;
  }

  async updateRisk(id: number, risk: Partial<InsertRisk>): Promise<Risk | undefined> {
    const [updated] = await db.update(schema.risks)
      .set({ ...risk, updatedAt: new Date() })
      .where(eq(schema.risks.id, id))
      .returning();
    return updated;
  }

  async deleteRisk(id: number): Promise<void> {
    await db.delete(schema.risks).where(eq(schema.risks.id, id));
  }

  // Issues
  async getIssue(id: number): Promise<Issue | undefined> {
    const [issue] = await db.select().from(schema.issues).where(eq(schema.issues.id, id));
    return issue;
  }

  async getIssuesByProject(projectId: number): Promise<Issue[]> {
    return await db.select().from(schema.issues)
      .where(eq(schema.issues.projectId, projectId))
      .orderBy(desc(schema.issues.createdAt));
  }

  async createIssue(issue: InsertIssue): Promise<Issue> {
    const [created] = await db.insert(schema.issues).values(issue).returning();
    return created;
  }

  async updateIssue(id: number, issue: Partial<InsertIssue>): Promise<Issue | undefined> {
    const [updated] = await db.update(schema.issues)
      .set({ ...issue, updatedAt: new Date() })
      .where(eq(schema.issues.id, id))
      .returning();
    return updated;
  }

  async deleteIssue(id: number): Promise<void> {
    await db.delete(schema.issues).where(eq(schema.issues.id, id));
  }

  // Change Requests
  async getChangeRequest(id: number): Promise<ChangeRequest | undefined> {
    const [cr] = await db.select().from(schema.changeRequests)
      .where(eq(schema.changeRequests.id, id));
    return cr;
  }

  async getChangeRequestsByProject(projectId: number): Promise<ChangeRequest[]> {
    return await db.select().from(schema.changeRequests)
      .where(eq(schema.changeRequests.projectId, projectId))
      .orderBy(desc(schema.changeRequests.createdAt));
  }

  async createChangeRequest(changeRequest: InsertChangeRequest): Promise<ChangeRequest> {
    const [created] = await db.insert(schema.changeRequests).values(changeRequest).returning();
    return created;
  }

  async updateChangeRequest(id: number, changeRequest: Partial<InsertChangeRequest>): Promise<ChangeRequest | undefined> {
    const [updated] = await db.update(schema.changeRequests)
      .set({ ...changeRequest, updatedAt: new Date() })
      .where(eq(schema.changeRequests.id, id))
      .returning();
    return updated;
  }

  async deleteChangeRequest(id: number): Promise<void> {
    await db.delete(schema.changeRequests).where(eq(schema.changeRequests.id, id));
  }

  // Cost Items
  async getCostItem(id: number): Promise<CostItem | undefined> {
    const [item] = await db.select().from(schema.costItems).where(eq(schema.costItems.id, id));
    return item;
  }

  async getCostItemsByProject(projectId: number): Promise<CostItem[]> {
    return await db.select().from(schema.costItems)
      .where(eq(schema.costItems.projectId, projectId))
      .orderBy(desc(schema.costItems.date));
  }

  async getCostItemsByTask(taskId: number): Promise<CostItem[]> {
    return await db.select().from(schema.costItems)
      .where(eq(schema.costItems.taskId, taskId))
      .orderBy(desc(schema.costItems.date));
  }

  async createCostItem(costItem: InsertCostItem): Promise<CostItem> {
    const [created] = await db.insert(schema.costItems).values(costItem).returning();
    return created;
  }

  async updateCostItem(id: number, costItem: Partial<InsertCostItem>): Promise<CostItem | undefined> {
    const [updated] = await db.update(schema.costItems)
      .set({ ...costItem, updatedAt: new Date() })
      .where(eq(schema.costItems.id, id))
      .returning();
    return updated;
  }

  async deleteCostItem(id: number): Promise<void> {
    await db.delete(schema.costItems).where(eq(schema.costItems.id, id));
  }

  // Resources
  async getResource(id: number): Promise<Resource | undefined> {
    const [resource] = await db.select().from(schema.resources).where(eq(schema.resources.id, id));
    return resource;
  }

  async getResourcesByProject(projectId: number): Promise<Resource[]> {
    return await db.select().from(schema.resources)
      .where(eq(schema.resources.projectId, projectId))
      .orderBy(desc(schema.resources.createdAt));
  }

  async createResource(resource: InsertResource): Promise<Resource> {
    const [created] = await db.insert(schema.resources).values(resource).returning();
    return created;
  }

  async updateResource(id: number, resource: Partial<InsertResource>): Promise<Resource | undefined> {
    const [updated] = await db.update(schema.resources)
      .set({ ...resource, updatedAt: new Date() })
      .where(eq(schema.resources.id, id))
      .returning();
    return updated;
  }

  async deleteResource(id: number): Promise<void> {
    await db.delete(schema.resources).where(eq(schema.resources.id, id));
  }

  // Resource Assignments
  async getResourceAssignment(id: number): Promise<ResourceAssignment | undefined> {
    const [assignment] = await db.select().from(schema.resourceAssignments)
      .where(eq(schema.resourceAssignments.id, id));
    return assignment;
  }

  async getResourceAssignmentsByTask(taskId: number): Promise<ResourceAssignment[]> {
    return await db.select().from(schema.resourceAssignments)
      .where(eq(schema.resourceAssignments.taskId, taskId));
  }

  async createResourceAssignment(assignment: InsertResourceAssignment): Promise<ResourceAssignment> {
    const [created] = await db.insert(schema.resourceAssignments).values(assignment).returning();
    return created;
  }

  async deleteResourceAssignment(id: number): Promise<void> {
    await db.delete(schema.resourceAssignments).where(eq(schema.resourceAssignments.id, id));
  }

  // Google Connections
  async getGoogleConnection(userId: string): Promise<GoogleConnection | undefined> {
    const [connection] = await db.select().from(schema.googleConnections)
      .where(eq(schema.googleConnections.userId, userId));
    return connection;
  }

  async createGoogleConnection(connection: InsertGoogleConnection): Promise<GoogleConnection> {
    const [created] = await db.insert(schema.googleConnections).values(connection).returning();
    return created;
  }

  async updateGoogleConnection(userId: string, connection: Partial<InsertGoogleConnection>): Promise<GoogleConnection | undefined> {
    const [updated] = await db.update(schema.googleConnections)
      .set({ ...connection, updatedAt: new Date() })
      .where(eq(schema.googleConnections.userId, userId))
      .returning();
    return updated;
  }

  async deleteGoogleConnection(userId: string): Promise<void> {
    await db.delete(schema.googleConnections).where(eq(schema.googleConnections.userId, userId));
  }

  // AI Conversations
  async getAiConversation(id: number): Promise<AiConversation | undefined> {
    const [conversation] = await db.select().from(schema.aiConversations)
      .where(eq(schema.aiConversations.id, id));
    return conversation;
  }

  async getAiConversationsByUser(userId: string): Promise<AiConversation[]> {
    return await db.select().from(schema.aiConversations)
      .where(eq(schema.aiConversations.userId, userId))
      .orderBy(desc(schema.aiConversations.updatedAt));
  }

  async getAiConversationsByProject(projectId: number): Promise<AiConversation[]> {
    return await db.select().from(schema.aiConversations)
      .where(eq(schema.aiConversations.projectId, projectId))
      .orderBy(desc(schema.aiConversations.updatedAt));
  }

  async createAiConversation(conversation: InsertAiConversation): Promise<AiConversation> {
    const [created] = await db.insert(schema.aiConversations).values(conversation).returning();
    return created;
  }

  async updateAiConversation(id: number, conversation: Partial<InsertAiConversation>): Promise<AiConversation | undefined> {
    const [updated] = await db.update(schema.aiConversations)
      .set({ ...conversation, updatedAt: new Date() })
      .where(eq(schema.aiConversations.id, id))
      .returning();
    return updated;
  }

  async deleteAiConversation(id: number): Promise<void> {
    await db.delete(schema.aiConversations).where(eq(schema.aiConversations.id, id));
  }

  // AI Messages
  async getAiMessagesByConversation(conversationId: number): Promise<AiMessage[]> {
    return await db.select().from(schema.aiMessages)
      .where(eq(schema.aiMessages.conversationId, conversationId))
      .orderBy(asc(schema.aiMessages.createdAt));
  }

  async createAiMessage(message: InsertAiMessage): Promise<AiMessage> {
    const [created] = await db.insert(schema.aiMessages).values(message).returning();
    return created;
  }

  // AI Usage
  async createAiUsage(usage: InsertAiUsage): Promise<AiUsage> {
    const [created] = await db.insert(schema.aiUsage).values(usage).returning();
    return created;
  }

  async getAiUsageByUser(userId: string, startDate?: Date): Promise<AiUsage[]> {
    if (startDate) {
      return await db.select().from(schema.aiUsage)
        .where(and(
          eq(schema.aiUsage.userId, userId),
          eq(schema.aiUsage.createdAt, startDate)
        ))
        .orderBy(desc(schema.aiUsage.createdAt));
    }
    return await db.select().from(schema.aiUsage)
      .where(eq(schema.aiUsage.userId, userId))
      .orderBy(desc(schema.aiUsage.createdAt));
  }

  // Email Templates
  async getEmailTemplate(id: number): Promise<EmailTemplate | undefined> {
    const [template] = await db.select().from(schema.emailTemplates)
      .where(eq(schema.emailTemplates.id, id));
    return template;
  }

  async getEmailTemplatesByOrganization(organizationId: number): Promise<EmailTemplate[]> {
    return await db.select().from(schema.emailTemplates)
      .where(eq(schema.emailTemplates.organizationId, organizationId))
      .orderBy(asc(schema.emailTemplates.type));
  }

  async getEmailTemplateByType(organizationId: number, type: string): Promise<EmailTemplate | undefined> {
    const [template] = await db.select().from(schema.emailTemplates)
      .where(and(
        eq(schema.emailTemplates.organizationId, organizationId),
        eq(schema.emailTemplates.type, type as any)
      ));
    return template;
  }

  async createEmailTemplate(template: InsertEmailTemplate & { createdBy: string }): Promise<EmailTemplate> {
    const [created] = await db.insert(schema.emailTemplates).values(template).returning();
    return created;
  }

  async updateEmailTemplate(id: number, template: Partial<InsertEmailTemplate>): Promise<EmailTemplate | undefined> {
    const [updated] = await db.update(schema.emailTemplates)
      .set({ ...template, updatedAt: new Date() })
      .where(eq(schema.emailTemplates.id, id))
      .returning();
    return updated;
  }

  async deleteEmailTemplate(id: number): Promise<void> {
    await db.delete(schema.emailTemplates).where(eq(schema.emailTemplates.id, id));
  }

  // Sent Emails
  async createSentEmail(email: InsertSentEmail): Promise<SentEmail> {
    const [created] = await db.insert(schema.sentEmails).values(email).returning();
    return created;
  }

  async getSentEmailsByOrganization(organizationId: number, limit: number = 100): Promise<SentEmail[]> {
    return await db.select().from(schema.sentEmails)
      .where(eq(schema.sentEmails.organizationId, organizationId))
      .orderBy(desc(schema.sentEmails.createdAt))
      .limit(limit);
  }

  async updateSentEmailStatus(id: number, status: string, errorMessage?: string): Promise<SentEmail | undefined> {
    const updates: any = { status };
    if (status === 'sent') {
      updates.sentAt = new Date();
    }
    if (errorMessage) {
      updates.errorMessage = errorMessage;
    }
    const [updated] = await db.update(schema.sentEmails)
      .set(updates)
      .where(eq(schema.sentEmails.id, id))
      .returning();
    return updated;
  }

  // Email Usage
  async getEmailUsage(organizationId: number, month: string): Promise<EmailUsage | undefined> {
    const [usage] = await db.select().from(schema.emailUsage)
      .where(and(
        eq(schema.emailUsage.organizationId, organizationId),
        eq(schema.emailUsage.month, month)
      ));
    return usage;
  }

  async incrementEmailUsage(organizationId: number): Promise<EmailUsage> {
    const month = new Date().toISOString().slice(0, 7); // YYYY-MM format
    const existing = await this.getEmailUsage(organizationId, month);
    
    if (existing) {
      const [updated] = await db.update(schema.emailUsage)
        .set({ 
          emailsSent: existing.emailsSent + 1,
          updatedAt: new Date() 
        })
        .where(eq(schema.emailUsage.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(schema.emailUsage)
        .values({ organizationId, month, emailsSent: 1 })
        .returning();
      return created;
    }
  }

  // Project Files
  async getProjectFile(id: number): Promise<ProjectFile | undefined> {
    const [file] = await db.select().from(schema.projectFiles)
      .where(eq(schema.projectFiles.id, id));
    return file;
  }

  async getProjectFilesByProject(projectId: number): Promise<ProjectFile[]> {
    return await db.select().from(schema.projectFiles)
      .where(eq(schema.projectFiles.projectId, projectId))
      .orderBy(desc(schema.projectFiles.createdAt));
  }

  async getProjectFilesByOrganization(organizationId: number): Promise<ProjectFile[]> {
    return await db.select().from(schema.projectFiles)
      .where(eq(schema.projectFiles.organizationId, organizationId))
      .orderBy(desc(schema.projectFiles.createdAt));
  }

  async createProjectFile(file: InsertProjectFile & { uploadedBy: string }): Promise<ProjectFile> {
    const [created] = await db.insert(schema.projectFiles).values(file).returning();
    return created;
  }

  async updateProjectFile(id: number, file: Partial<InsertProjectFile>): Promise<ProjectFile | undefined> {
    const [updated] = await db.update(schema.projectFiles)
      .set({ ...file, updatedAt: new Date() })
      .where(eq(schema.projectFiles.id, id))
      .returning();
    return updated;
  }

  async deleteProjectFile(id: number): Promise<void> {
    await db.delete(schema.projectFiles).where(eq(schema.projectFiles.id, id));
  }

  // Storage Quotas
  async getStorageQuota(organizationId: number): Promise<StorageQuota | undefined> {
    const [quota] = await db.select().from(schema.storageQuotas)
      .where(eq(schema.storageQuotas.organizationId, organizationId));
    return quota;
  }

  async updateStorageQuota(organizationId: number, usedBytes: number): Promise<StorageQuota> {
    const existing = await this.getStorageQuota(organizationId);
    
    if (existing) {
      const [updated] = await db.update(schema.storageQuotas)
        .set({ usedBytes, updatedAt: new Date() })
        .where(eq(schema.storageQuotas.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(schema.storageQuotas)
        .values({ organizationId, usedBytes })
        .returning();
      return created;
    }
  }

  async incrementStorageUsage(organizationId: number, bytes: number): Promise<StorageQuota> {
    const existing = await this.getStorageQuota(organizationId);
    const currentUsed = existing?.usedBytes || 0;
    return this.updateStorageQuota(organizationId, currentUsed + bytes);
  }

  async decrementStorageUsage(organizationId: number, bytes: number): Promise<StorageQuota> {
    const existing = await this.getStorageQuota(organizationId);
    const currentUsed = existing?.usedBytes || 0;
    const newUsed = Math.max(0, currentUsed - bytes);
    return this.updateStorageQuota(organizationId, newUsed);
  }

  // Subscription Plans
  async getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    return db.select().from(schema.subscriptionPlans)
      .where(eq(schema.subscriptionPlans.isActive, true))
      .orderBy(asc(schema.subscriptionPlans.priceMonthly));
  }

  async getSubscriptionPlan(id: number): Promise<SubscriptionPlan | undefined> {
    const [plan] = await db.select().from(schema.subscriptionPlans)
      .where(eq(schema.subscriptionPlans.id, id));
    return plan;
  }

  async getSubscriptionPlanByTier(tier: string): Promise<SubscriptionPlan | undefined> {
    const [plan] = await db.select().from(schema.subscriptionPlans)
      .where(eq(schema.subscriptionPlans.tier, tier as any));
    return plan;
  }

  async createSubscriptionPlan(plan: InsertSubscriptionPlan): Promise<SubscriptionPlan> {
    const [created] = await db.insert(schema.subscriptionPlans).values(plan).returning();
    return created;
  }

  async updateSubscriptionPlan(id: number, plan: Partial<InsertSubscriptionPlan>): Promise<SubscriptionPlan | undefined> {
    const [updated] = await db.update(schema.subscriptionPlans)
      .set({ ...plan, updatedAt: new Date() })
      .where(eq(schema.subscriptionPlans.id, id))
      .returning();
    return updated;
  }

  // Organization Subscriptions
  async getOrganizationSubscription(organizationId: number): Promise<OrganizationSubscription | undefined> {
    const [subscription] = await db.select().from(schema.organizationSubscriptions)
      .where(eq(schema.organizationSubscriptions.organizationId, organizationId));
    return subscription;
  }

  async createOrganizationSubscription(subscription: InsertOrganizationSubscription): Promise<OrganizationSubscription> {
    const [created] = await db.insert(schema.organizationSubscriptions).values(subscription).returning();
    return created;
  }

  async updateOrganizationSubscription(organizationId: number, subscription: Partial<InsertOrganizationSubscription>): Promise<OrganizationSubscription | undefined> {
    const [updated] = await db.update(schema.organizationSubscriptions)
      .set({ ...subscription, updatedAt: new Date() })
      .where(eq(schema.organizationSubscriptions.organizationId, organizationId))
      .returning();
    return updated;
  }

  // AI Usage Summary
  async getAiUsageSummary(organizationId: number, month: string): Promise<AiUsageSummary | undefined> {
    const [summary] = await db.select().from(schema.aiUsageSummary)
      .where(and(
        eq(schema.aiUsageSummary.organizationId, organizationId),
        eq(schema.aiUsageSummary.month, month)
      ));
    return summary;
  }

  async incrementAiUsage(organizationId: number, tokensUsed: number): Promise<AiUsageSummary> {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    const existing = await this.getAiUsageSummary(organizationId, month);
    
    if (existing) {
      const [updated] = await db.update(schema.aiUsageSummary)
        .set({
          tokensUsed: existing.tokensUsed + tokensUsed,
          requestCount: existing.requestCount + 1,
          updatedAt: new Date()
        })
        .where(eq(schema.aiUsageSummary.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(schema.aiUsageSummary)
        .values({
          organizationId,
          month,
          tokensUsed,
          requestCount: 1,
          tokenLimit: 50000
        })
        .returning();
      return created;
    }
  }

  // Cloud Storage Connections
  async getCloudStorageConnections(organizationId: number): Promise<CloudStorageConnection[]> {
    return this.getCloudStorageConnectionsByOrganization(organizationId);
  }

  async getCloudStorageConnectionsByOrganization(organizationId: number): Promise<CloudStorageConnection[]> {
    return db.select().from(schema.cloudStorageConnections)
      .where(eq(schema.cloudStorageConnections.organizationId, organizationId))
      .orderBy(asc(schema.cloudStorageConnections.provider));
  }

  async getCloudStorageConnection(id: number): Promise<CloudStorageConnection | undefined> {
    const [connection] = await db.select().from(schema.cloudStorageConnections)
      .where(eq(schema.cloudStorageConnections.id, id));
    return connection;
  }

  async getCloudStorageConnectionByProvider(organizationId: number, provider: string): Promise<CloudStorageConnection | undefined> {
    const [connection] = await db.select().from(schema.cloudStorageConnections)
      .where(and(
        eq(schema.cloudStorageConnections.organizationId, organizationId),
        eq(schema.cloudStorageConnections.provider, provider)
      ));
    return connection;
  }

  async createCloudStorageConnection(connection: InsertCloudStorageConnection & { connectedBy: string }): Promise<CloudStorageConnection> {
    const [created] = await db.insert(schema.cloudStorageConnections).values(connection).returning();
    return created;
  }

  async updateCloudStorageConnection(id: number, connection: Partial<InsertCloudStorageConnection>): Promise<CloudStorageConnection | undefined> {
    const [updated] = await db.update(schema.cloudStorageConnections)
      .set({ ...connection, updatedAt: new Date() })
      .where(eq(schema.cloudStorageConnections.id, id))
      .returning();
    return updated;
  }

  async updateCloudStorageConnectionTokens(
    id: number, 
    tokens: { accessToken: string; refreshToken?: string; tokenExpiresAt?: Date }
  ): Promise<CloudStorageConnection | undefined> {
    const [updated] = await db.update(schema.cloudStorageConnections)
      .set({ 
        accessToken: tokens.accessToken,
        ...(tokens.refreshToken && { refreshToken: tokens.refreshToken }),
        ...(tokens.tokenExpiresAt && { tokenExpiresAt: tokens.tokenExpiresAt }),
        updatedAt: new Date()
      })
      .where(eq(schema.cloudStorageConnections.id, id))
      .returning();
    return updated;
  }

  async updateCloudStorageConnectionSyncStatus(
    id: number, 
    status: { syncStatus: string; lastSyncAt?: Date; syncError?: string | null }
  ): Promise<CloudStorageConnection | undefined> {
    const [updated] = await db.update(schema.cloudStorageConnections)
      .set({ 
        syncStatus: status.syncStatus,
        ...(status.lastSyncAt && { lastSyncAt: status.lastSyncAt }),
        syncError: status.syncError ?? null,
        updatedAt: new Date()
      })
      .where(eq(schema.cloudStorageConnections.id, id))
      .returning();
    return updated;
  }

  async deleteCloudStorageConnection(id: number): Promise<void> {
    await db.delete(schema.cloudStorageConnections).where(eq(schema.cloudStorageConnections.id, id));
  }

  // Cloud Synced Files
  async getCloudSyncedFilesByProject(projectId: number): Promise<CloudSyncedFile[]> {
    return db.select().from(schema.cloudSyncedFiles)
      .where(eq(schema.cloudSyncedFiles.projectId, projectId))
      .orderBy(asc(schema.cloudSyncedFiles.name));
  }

  async getCloudSyncedFilesByConnection(connectionId: number): Promise<CloudSyncedFile[]> {
    return db.select().from(schema.cloudSyncedFiles)
      .where(eq(schema.cloudSyncedFiles.connectionId, connectionId))
      .orderBy(asc(schema.cloudSyncedFiles.cloudFilePath));
  }

  async getCloudSyncedFile(id: number): Promise<CloudSyncedFile | undefined> {
    const [file] = await db.select().from(schema.cloudSyncedFiles)
      .where(eq(schema.cloudSyncedFiles.id, id));
    return file;
  }

  async getCloudSyncedFileByCloudId(connectionId: number, cloudFileId: string): Promise<CloudSyncedFile | undefined> {
    const [file] = await db.select().from(schema.cloudSyncedFiles)
      .where(and(
        eq(schema.cloudSyncedFiles.connectionId, connectionId),
        eq(schema.cloudSyncedFiles.cloudFileId, cloudFileId)
      ));
    return file;
  }

  async createCloudSyncedFile(file: InsertCloudSyncedFile): Promise<CloudSyncedFile> {
    const [created] = await db.insert(schema.cloudSyncedFiles).values(file).returning();
    return created;
  }

  async updateCloudSyncedFile(id: number, file: Partial<InsertCloudSyncedFile>): Promise<CloudSyncedFile | undefined> {
    const [updated] = await db.update(schema.cloudSyncedFiles)
      .set({ ...file, updatedAt: new Date() })
      .where(eq(schema.cloudSyncedFiles.id, id))
      .returning();
    return updated;
  }

  async deleteCloudSyncedFile(id: number): Promise<void> {
    await db.delete(schema.cloudSyncedFiles).where(eq(schema.cloudSyncedFiles.id, id));
  }

  async deleteCloudSyncedFilesByConnection(connectionId: number): Promise<void> {
    await db.delete(schema.cloudSyncedFiles).where(eq(schema.cloudSyncedFiles.connectionId, connectionId));
  }

  // Documents
  async getDocument(id: number): Promise<Document | undefined> {
    const [doc] = await db.select().from(schema.documents).where(eq(schema.documents.id, id));
    return doc;
  }

  async getDocumentsByProject(projectId: number): Promise<Document[]> {
    return db.select().from(schema.documents)
      .where(eq(schema.documents.projectId, projectId))
      .orderBy(desc(schema.documents.createdAt));
  }

  async getDocumentsByTask(taskId: number): Promise<Document[]> {
    // Documents don't have a direct taskId - they're linked via tags/equipment
    // Return empty for now - can be extended with junction table
    return [];
  }

  async createDocument(document: InsertDocument & { createdBy: string }): Promise<Document> {
    const [created] = await db.insert(schema.documents).values(document).returning();
    return created;
  }

  async updateDocument(id: number, document: Partial<InsertDocument>): Promise<Document | undefined> {
    const [updated] = await db.update(schema.documents)
      .set({ ...document, updatedAt: new Date() })
      .where(eq(schema.documents.id, id))
      .returning();
    return updated;
  }

  async deleteDocument(id: number): Promise<void> {
    await db.delete(schema.documents).where(eq(schema.documents.id, id));
  }
}

export const storage = new DatabaseStorage();
