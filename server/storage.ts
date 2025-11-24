import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq, and, desc, asc, isNull } from "drizzle-orm";
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
} from "@shared/schema";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

export interface IStorage {
  // Organizations
  getOrganization(id: number): Promise<Organization | undefined>;
  getOrganizationBySlug(slug: string): Promise<Organization | undefined>;
  getOrganizationsByUser(userId: string): Promise<Organization[]>;
  createOrganization(org: InsertOrganization): Promise<Organization>;
  updateOrganization(id: number, org: Partial<InsertOrganization>): Promise<Organization | undefined>;

  // Users (Replit Auth compatible)
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

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
      .where(eq(schema.organizations.id, orgIds[0])); // Simplified for now
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
}

export const storage = new DatabaseStorage();
