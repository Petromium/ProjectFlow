import { eq, and, desc, asc, isNull, inArray, sql } from "drizzle-orm";
import * as schema from "@shared/schema";
import { db } from "./db";
import { logger } from "./lib/logger";
import type {
  InsertOrganization,
  Organization,
  InsertProgram,
  UpdateProgram,
  Program,
  InsertTag,
  UpdateTag,
  Tag,
  InsertTagAssignment,
  TagAssignment,
  InsertUser,
  UpsertUser,
  User,
  InsertUserOrganization,
  UserOrganization,
  InsertProject,
  Project,
  InsertProjectStatus,
  ProjectStatus,
  UpdateProjectStatus,
  InsertKanbanColumn,
  KanbanColumn,
  UpdateKanbanColumn,
  InsertTask,
  Task,
  InsertTaskDependency,
  TaskDependency,
  InsertStakeholder,
  Stakeholder,
  InsertStakeholderRaci,
  StakeholderRaci,
  InsertRisk,
  Risk,
  InsertIssue,
  Issue,
  InsertChangeRequest,
  ChangeRequest,
  InsertChangeRequestApproval,
  ChangeRequestApproval,
  InsertChangeRequestTask,
  ChangeRequestTask,
  InsertChangeRequestTemplate,
  ChangeRequestTemplate,
  InsertExchangeRate,
  ExchangeRate,
  InsertExchangeRateSync,
  ExchangeRateSync,
  InsertNotificationRule,
  NotificationRule,
  UpdateNotificationRule,
  InsertNotificationLog,
  NotificationLog,
  InsertCostItem,
  CostItem,
  InsertCostBreakdownStructure,
  CostBreakdownStructure,
  InsertCostItemCBSLink,
  CostItemCBSLink,
  InsertProcurementRequisition,
  ProcurementRequisition,
  InsertResourceRequirement,
  ResourceRequirement,
  InsertInventoryAllocation,
  InventoryAllocation,
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
  InsertProjectEvent,
  ProjectEvent,
  InsertTaskDocument,
  TaskDocument,
  InsertTaskRisk,
  TaskRisk,
  InsertTaskIssue,
  TaskIssue,
  InsertConversation,
  Conversation,
  UpdateConversation,
  InsertParticipant,
  Participant,
  InsertMessage,
  Message,
  UpdateMessage,
  InsertContact,
  Contact,
  UpdateContact,
  InsertContactLog,
  ContactLog,
  UpdateContactLog,
  InsertUserInvitation,
  UserInvitation,
  UpdateUserInvitation,
  InsertUserActivityLog,
  UserActivityLog,
  UpdateUserOrganization,
  InsertProjectTemplate,
  ProjectTemplate,
  InsertLessonLearned,
  LessonLearned,
  UpdateLessonLearned,
} from "@shared/schema";

export interface IStorage {
  // Organizations
  getOrganization(id: number): Promise<Organization | undefined>;
  getOrganizationBySlug(slug: string): Promise<Organization | undefined>;
  getOrganizationsByUser(userId: string): Promise<Organization[]>;
  getAllOrganizations(): Promise<Organization[]>;
  createOrganization(org: InsertOrganization): Promise<Organization>;
  updateOrganization(id: number, org: Partial<InsertOrganization>): Promise<Organization | undefined>;
  deleteOrganization(id: number): Promise<void>;

  // Programs
  getProgram(id: number): Promise<Program | undefined>;
  getProgramsByOrganization(organizationId: number): Promise<Program[]>;
  getProgramBySlug(organizationId: number, slug: string): Promise<Program | undefined>;
  createProgram(program: InsertProgram): Promise<Program>;
  updateProgram(id: number, program: Partial<UpdateProgram>): Promise<Program | undefined>;
  deleteProgram(id: number): Promise<void>;

  // Tags
  getTag(id: number): Promise<Tag | undefined>;
  getTagsByOrganization(organizationId: number, category?: string): Promise<Tag[]>;
  getTagByName(organizationId: number, name: string): Promise<Tag | undefined>;
  searchTags(organizationId: number, query: string, limit?: number): Promise<Tag[]>;
  createTag(tag: InsertTag): Promise<Tag>;
  updateTag(id: number, tag: Partial<UpdateTag>): Promise<Tag | undefined>;
  deleteTag(id: number): Promise<void>;
  incrementTagUsage(tagId: number): Promise<void>;
  decrementTagUsage(tagId: number): Promise<void>;

  // Tag Assignments
  getTagAssignmentsByEntity(entityType: string, entityId: number): Promise<TagAssignment[]>;
  getTagAssignmentsByTag(tagId: number): Promise<TagAssignment[]>;
  getEntitiesByTag(tagId: number, entityType?: string): Promise<Array<{ entityType: string; entityId: number }>>;
  assignTag(tagId: number, entityType: string, entityId: number): Promise<TagAssignment>;
  unassignTag(tagId: number, entityType: string, entityId: number): Promise<void>;
  unassignAllTagsFromEntity(entityType: string, entityId: number): Promise<void>;
  getTagsForEntity(entityType: string, entityId: number): Promise<Tag[]>;

  // Lessons Learned
  getLessonLearned(id: number): Promise<LessonLearned | undefined>;
  getLessonsLearnedByOrganization(organizationId: number): Promise<LessonLearned[]>;
  getLessonsLearnedByProject(projectId: number): Promise<LessonLearned[]>;
  searchLessonsLearned(organizationId: number, query: string): Promise<LessonLearned[]>;
  createLessonLearned(lesson: InsertLessonLearned): Promise<LessonLearned>;
  updateLessonLearned(id: number, lesson: Partial<UpdateLessonLearned>): Promise<LessonLearned | undefined>;
  deleteLessonLearned(id: number): Promise<void>;

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
  updateUserOrganization(userId: string, organizationId: number, updates: { role?: string }): Promise<UserOrganization | undefined>;
  deleteUserOrganization(userId: string, organizationId: number): Promise<void>;

  // User Invitations
  getUserInvitationById(id: number): Promise<UserInvitation | undefined>;
  getUserInvitation(token: string): Promise<UserInvitation | undefined>;
  getUserInvitationsByOrganization(organizationId: number): Promise<UserInvitation[]>;
  getUserInvitationByEmail(organizationId: number, email: string): Promise<UserInvitation | undefined>;
  createUserInvitation(invitation: InsertUserInvitation & { token: string }): Promise<UserInvitation>;
  acceptUserInvitation(token: string, userId: string): Promise<UserOrganization>;
  deleteUserInvitation(id: number): Promise<void>;

  // User Activity Logs
  createUserActivityLog(log: InsertUserActivityLog): Promise<UserActivityLog>;
  getUserActivityLogs(filters: {
    userId?: string;
    organizationId?: number;
    projectId?: number;
    action?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<UserActivityLog[]>;

  // Projects
  getProject(id: number): Promise<Project | undefined>;
  getProjectsByOrganization(organizationId: number): Promise<Project[]>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: number, project: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: number): Promise<void>;
  duplicateProject(projectId: number, newName: string, newCode: string): Promise<Project>;

  // Project Statuses (Custom Statuses)
  getProjectStatus(id: number): Promise<ProjectStatus | undefined>;
  getProjectStatusesByProject(projectId: number): Promise<ProjectStatus[]>;
  createProjectStatus(status: InsertProjectStatus): Promise<ProjectStatus>;
  updateProjectStatus(id: number, status: Partial<UpdateProjectStatus>): Promise<ProjectStatus | undefined>;
  deleteProjectStatus(id: number): Promise<void>;
  reorderProjectStatuses(projectId: number, statusIds: number[]): Promise<void>;

  // Kanban Columns
  getKanbanColumn(id: number): Promise<KanbanColumn | undefined>;
  getKanbanColumnsByProject(projectId: number): Promise<KanbanColumn[]>;
  createKanbanColumn(column: InsertKanbanColumn): Promise<KanbanColumn>;
  updateKanbanColumn(id: number, column: Partial<UpdateKanbanColumn>): Promise<KanbanColumn | undefined>;
  deleteKanbanColumn(id: number): Promise<void>;
  reorderKanbanColumns(projectId: number, columnIds: number[]): Promise<void>;

  // Project Templates
  getProjectTemplate(id: number): Promise<ProjectTemplate | undefined>;
  getProjectTemplates(): Promise<ProjectTemplate[]>;
  createProjectTemplate(template: InsertProjectTemplate): Promise<ProjectTemplate>;
  updateProjectTemplate(id: number, template: Partial<InsertProjectTemplate>): Promise<ProjectTemplate | undefined>;
  deleteProjectTemplate(id: number): Promise<void>;
  incrementTemplateUsage(id: number): Promise<void>;

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
  updateTaskDependency(id: number, dependency: Partial<InsertTaskDependency>): Promise<TaskDependency | undefined>;
  deleteTaskDependency(id: number): Promise<void>;

  // Stakeholders
  getStakeholder(id: number): Promise<Stakeholder | undefined>;
  getStakeholdersByProject(projectId: number): Promise<Stakeholder[]>;
  createStakeholder(stakeholder: InsertStakeholder): Promise<Stakeholder>;
  updateStakeholder(id: number, stakeholder: Partial<InsertStakeholder>): Promise<Stakeholder | undefined>;
  deleteStakeholder(id: number): Promise<void>;

  // Stakeholder RACI Matrix
  getStakeholderRaci(id: number): Promise<StakeholderRaci | undefined>;
  getStakeholderRaciByProject(projectId: number): Promise<StakeholderRaci[]>;
  getStakeholderRaciByTask(taskId: number): Promise<StakeholderRaci[]>;
  getStakeholderRaciByStakeholder(stakeholderId: number): Promise<StakeholderRaci[]>;
  getStakeholderRaciByResource(resourceId: number): Promise<StakeholderRaci[]>;
  createStakeholderRaci(raci: InsertStakeholderRaci): Promise<StakeholderRaci>;
  updateStakeholderRaci(id: number, raci: Partial<InsertStakeholderRaci>): Promise<StakeholderRaci | undefined>;
  deleteStakeholderRaci(id: number): Promise<void>;
  deleteStakeholderRaciByTaskAndType(taskId: number, raciType: string, personId: number, isResource: boolean): Promise<void>;
  deleteInheritedRaciByTask(taskId: number): Promise<void>;
  getInheritedRaciBySourceTask(sourceTaskId: number): Promise<StakeholderRaci[]>;
  upsertStakeholderRaci(raci: InsertStakeholderRaci): Promise<StakeholderRaci>;

  // Notification Rules
  getNotificationRule(id: number): Promise<NotificationRule | undefined>;
  getNotificationRulesByProject(projectId: number): Promise<NotificationRule[]>;
  getNotificationRulesByOrganization(organizationId: number): Promise<NotificationRule[]>;
  getActiveNotificationRules(): Promise<NotificationRule[]>;
  createNotificationRule(rule: InsertNotificationRule): Promise<NotificationRule>;
  updateNotificationRule(id: number, rule: UpdateNotificationRule): Promise<NotificationRule | undefined>;
  deleteNotificationRule(id: number): Promise<void>;

  // Notification Logs
  getNotificationLog(id: number): Promise<NotificationLog | undefined>;
  getNotificationLogsByRule(ruleId: number): Promise<NotificationLog[]>;
  getNotificationLogsByProject(projectId: number): Promise<NotificationLog[]>;
  createNotificationLog(log: InsertNotificationLog): Promise<NotificationLog>;
  updateNotificationLog(id: number, log: Partial<InsertNotificationLog>): Promise<NotificationLog | undefined>;

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

  // Change Request Approvals (Workflow)
  getChangeRequestApproval(id: number): Promise<ChangeRequestApproval | undefined>;
  getChangeRequestApprovals(changeRequestId: number): Promise<ChangeRequestApproval[]>;
  addChangeRequestApprover(approval: InsertChangeRequestApproval): Promise<ChangeRequestApproval>;
  updateChangeRequestApproval(id: number, approval: Partial<InsertChangeRequestApproval>): Promise<ChangeRequestApproval | undefined>;
  deleteChangeRequestApproval(id: number): Promise<void>;
  getPendingApprovalsForUser(userId: string): Promise<(ChangeRequestApproval & { changeRequest: ChangeRequest })[]>;

  // Change Request Tasks (Linkage)
  getChangeRequestTasks(changeRequestId: number): Promise<ChangeRequestTask[]>;
  addChangeRequestTask(link: InsertChangeRequestTask): Promise<ChangeRequestTask>;
  deleteChangeRequestTask(id: number): Promise<void>;
  getTasksByChangeRequest(changeRequestId: number): Promise<(ChangeRequestTask & { task: Task })[]>;
  getChangeRequestsByTask(taskId: number): Promise<(ChangeRequestTask & { changeRequest: ChangeRequest })[]>;

  // Change Request Templates
  getChangeRequestTemplate(id: number): Promise<ChangeRequestTemplate | undefined>;
  getChangeRequestTemplatesByOrganization(organizationId: number): Promise<ChangeRequestTemplate[]>;
  createChangeRequestTemplate(template: InsertChangeRequestTemplate & { createdBy: string }): Promise<ChangeRequestTemplate>;
  updateChangeRequestTemplate(id: number, template: Partial<InsertChangeRequestTemplate>): Promise<ChangeRequestTemplate | undefined>;
  deleteChangeRequestTemplate(id: number): Promise<void>;

  // Exchange Rates
  getExchangeRate(date: Date, baseCurrency: string, targetCurrency: string): Promise<ExchangeRate | undefined>;
  getExchangeRatesByDate(date: Date, baseCurrency?: string): Promise<ExchangeRate[]>;
  createExchangeRate(rate: InsertExchangeRate): Promise<ExchangeRate>;
  updateExchangeRate(id: number, rate: Partial<InsertExchangeRate>): Promise<ExchangeRate | undefined>;
  
  // Exchange Rate Syncs
  getExchangeRateSync(id: number): Promise<ExchangeRateSync | undefined>;
  getExchangeRateSyncs(limit?: number): Promise<ExchangeRateSync[]>;
  createExchangeRateSync(sync: InsertExchangeRateSync): Promise<ExchangeRateSync>;

  // Cost Items
  getCostItem(id: number): Promise<CostItem | undefined>;
  getCostItemsByProject(projectId: number): Promise<CostItem[]>;
  getCostItemsByTask(taskId: number): Promise<CostItem[]>;
  getCostItemsByChangeRequest(changeRequestId: number): Promise<CostItem[]>;
  getCostItemsByCBS(cbsId: number): Promise<CostItem[]>;
  createCostItem(costItem: InsertCostItem): Promise<CostItem>;
  updateCostItem(id: number, costItem: Partial<InsertCostItem>): Promise<CostItem | undefined>;
  deleteCostItem(id: number): Promise<void>;

  // Cost Breakdown Structure (CBS)
  getCostBreakdownStructure(id: number): Promise<CostBreakdownStructure | undefined>;
  getCostBreakdownStructureByProject(projectId: number): Promise<CostBreakdownStructure[]>;
  createCostBreakdownStructure(cbs: InsertCostBreakdownStructure): Promise<CostBreakdownStructure>;
  updateCostBreakdownStructure(id: number, cbs: Partial<InsertCostBreakdownStructure>): Promise<CostBreakdownStructure | undefined>;
  deleteCostBreakdownStructure(id: number): Promise<void>;
  
  // Cost Item CBS Links
  getCostItemCBSLinks(costItemId: number): Promise<CostItemCBSLink[]>;
  linkCostItemToCBS(costItemId: number, cbsId: number, allocation?: number): Promise<CostItemCBSLink>;
  unlinkCostItemFromCBS(costItemId: number, cbsId: number): Promise<void>;

  // Resources
  getResource(id: number): Promise<Resource | undefined>;
  getResourcesByProject(projectId: number): Promise<Resource[]>;
  createResource(resource: InsertResource): Promise<Resource>;
  updateResource(id: number, resource: Partial<InsertResource>): Promise<Resource | undefined>;
  deleteResource(id: number): Promise<void>;

  // Resource Assignments
  getResourceAssignment(id: number): Promise<ResourceAssignment | undefined>;
  getResourceAssignmentsByTask(taskId: number): Promise<ResourceAssignment[]>;
  getResourceAssignmentsByResource(resourceId: number): Promise<(ResourceAssignment & { task: Task | null })[]>;
  getProjectResourceUtilization(projectId: number, startDate: Date, endDate: Date): Promise<{
    resources: Array<{
      resourceId: number;
      resourceName: string;
      resourceType: string;
      periods: Array<{
        periodStart: Date;
        periodEnd: Date;
        utilization: number;
        isOverAllocated: boolean;
        assignments: Array<{
          taskId: number;
          taskName: string;
          allocation: number;
        }>;
      }>;
    }>;
  }>;
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
  getAiConversationsByProject(projectId: number, userId: string): Promise<AiConversation[]>;
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

  // Project Events (Calendar)
  getProjectEvent(id: number): Promise<ProjectEvent | undefined>;
  getProjectEventsByProject(projectId: number): Promise<ProjectEvent[]>;
  createProjectEvent(event: InsertProjectEvent & { createdBy: string }): Promise<ProjectEvent>;
  updateProjectEvent(id: number, event: Partial<InsertProjectEvent>): Promise<ProjectEvent | undefined>;
  deleteProjectEvent(id: number): Promise<void>;

  // Task Documents (Junction)
  getTaskDocuments(taskId: number): Promise<TaskDocument[]>;
  createTaskDocument(taskDocument: InsertTaskDocument): Promise<TaskDocument>;
  deleteTaskDocument(taskId: number, documentId: number): Promise<void>;

  // Task Risks (Junction)
  getTaskRisks(taskId: number): Promise<TaskRisk[]>;
  createTaskRisk(taskRisk: InsertTaskRisk): Promise<TaskRisk>;
  deleteTaskRisk(taskId: number, riskId: number): Promise<void>;

  // Task Issues (Junction)
  getTaskIssues(taskId: number): Promise<TaskIssue[]>;
  createTaskIssue(taskIssue: InsertTaskIssue): Promise<TaskIssue>;
  deleteTaskIssue(taskId: number, issueId: number): Promise<void>;

  // Chat Conversations
  getConversation(id: number): Promise<Conversation | undefined>;
  getConversationsByProject(projectId: number): Promise<Conversation[]>;
  getConversationsByUser(userId: string): Promise<Conversation[]>;
  getConversationByTask(taskId: number): Promise<Conversation | undefined>;
  createConversation(conversation: InsertConversation & { createdBy: string }): Promise<Conversation>;
  updateConversation(id: number, conversation: Partial<UpdateConversation>): Promise<Conversation | undefined>;
  deleteConversation(id: number): Promise<void>;

  // Chat Participants
  getParticipants(conversationId: number): Promise<Participant[]>;
  addParticipant(conversationId: number, userId: string, role?: string): Promise<Participant>;
  removeParticipant(conversationId: number, userId: string): Promise<void>;
  markAsRead(conversationId: number, userId: string): Promise<void>;
  getUnreadCount(userId: string, conversationId?: number): Promise<number>;

  // Chat Messages
  getMessages(conversationId: number, limit?: number, offset?: number): Promise<Message[]>;
  createMessage(message: InsertMessage & { userId: string }): Promise<Message>;
  updateMessage(id: number, message: Partial<UpdateMessage>): Promise<Message | undefined>;
  deleteMessage(id: number): Promise<void>;

  // Contacts (CRM)
  getContact(id: number): Promise<Contact | undefined>;
  getContactsByOrganization(organizationId: number): Promise<Contact[]>;
  getContactByEmail(organizationId: number, email: string): Promise<Contact | undefined>;
  createContact(contact: InsertContact): Promise<Contact>;
  updateContact(id: number, contact: Partial<UpdateContact>): Promise<Contact | undefined>;
  deleteContact(id: number): Promise<void>;

  // Contact Logs
  getContactLogs(contactId: number): Promise<ContactLog[]>;
  createContactLog(log: InsertContactLog & { loggedBy?: string }): Promise<ContactLog>;
  deleteContactLog(id: number): Promise<void>;

  // Inheritance helpers
  getTaskAncestors(taskId: number): Promise<Task[]>;
  getInheritedResources(taskId: number): Promise<{ assignmentId: number; resourceId: number; resource: Resource | null; sourceTaskId: number; sourceTask: Task | null }[]>;
  getInheritedDocuments(taskId: number): Promise<{ taskDocumentId: number; documentId: number; document: Document | null; sourceTaskId: number; sourceTask: Task | null }[]>;
  getInheritedRisks(taskId: number): Promise<{ taskRiskId: number; riskId: number; risk: Risk | null; sourceTaskId: number; sourceTask: Task | null }[]>;
  getInheritedIssues(taskId: number): Promise<{ taskIssueId: number; issueId: number; issue: Issue | null; sourceTaskId: number; sourceTask: Task | null }[]>;

  // Organization-level aggregation (PMO)
  getTasksByOrganization(organizationId: number): Promise<(Task & { projectName: string })[]>;
  getRisksByOrganization(organizationId: number): Promise<(Risk & { projectName: string })[]>;
  getIssuesByOrganization(organizationId: number): Promise<(Issue & { projectName: string })[]>;
  getResourcesByOrganization(organizationId: number): Promise<(Resource & { projectName: string })[]>;
  getCostItemsByOrganization(organizationId: number): Promise<(CostItem & { projectName: string })[]>;
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

  async deleteOrganization(id: number): Promise<void> {
    await db.delete(schema.organizations).where(eq(schema.organizations.id, id));
  }

  // Programs
  async getProgram(id: number): Promise<Program | undefined> {
    const [program] = await db.select().from(schema.programs).where(eq(schema.programs.id, id));
    return program;
  }

  async getProgramsByOrganization(organizationId: number): Promise<Program[]> {
    return await db.select().from(schema.programs)
      .where(eq(schema.programs.organizationId, organizationId))
      .orderBy(asc(schema.programs.name));
  }

  async getProgramBySlug(organizationId: number, slug: string): Promise<Program | undefined> {
    const [program] = await db.select().from(schema.programs)
      .where(and(
        eq(schema.programs.organizationId, organizationId),
        eq(schema.programs.slug, slug)
      ));
    return program;
  }

  async createProgram(program: InsertProgram): Promise<Program> {
    const [created] = await db.insert(schema.programs).values(program).returning();
    return created;
  }

  async updateProgram(id: number, program: Partial<UpdateProgram>): Promise<Program | undefined> {
    const [updated] = await db.update(schema.programs)
      .set({ ...program, updatedAt: new Date() })
      .where(eq(schema.programs.id, id))
      .returning();
    return updated;
  }

  async deleteProgram(id: number): Promise<void> {
    await db.delete(schema.programs).where(eq(schema.programs.id, id));
  }

  // Tags
  async getTag(id: number): Promise<Tag | undefined> {
    const [tag] = await db.select().from(schema.tags).where(eq(schema.tags.id, id));
    return tag;
  }

  async getTagsByOrganization(organizationId: number, category?: string): Promise<Tag[]> {
    const conditions = [eq(schema.tags.organizationId, organizationId)];
    if (category) {
      conditions.push(eq(schema.tags.category, category));
    }
    return await db.select().from(schema.tags)
      .where(and(...conditions))
      .orderBy(desc(schema.tags.usageCount), asc(schema.tags.name));
  }

  async getTagByName(organizationId: number, name: string): Promise<Tag | undefined> {
    const [tag] = await db.select().from(schema.tags)
      .where(and(
        eq(schema.tags.organizationId, organizationId),
        eq(schema.tags.name, name)
      ));
    return tag;
  }

  async searchTags(organizationId: number, query: string, limit: number = 20): Promise<Tag[]> {
    const searchTerm = `%${query.toLowerCase()}%`;
    return await db.select().from(schema.tags)
      .where(and(
        eq(schema.tags.organizationId, organizationId),
        sql`LOWER(${schema.tags.name}) LIKE ${searchTerm}`
      ))
      .orderBy(desc(schema.tags.usageCount), asc(schema.tags.name))
      .limit(limit);
  }

  async createTag(tag: InsertTag): Promise<Tag> {
    const [created] = await db.insert(schema.tags).values(tag).returning();
    return created;
  }

  async updateTag(id: number, tag: Partial<UpdateTag>): Promise<Tag | undefined> {
    const [updated] = await db.update(schema.tags)
      .set({ ...tag, updatedAt: new Date() })
      .where(eq(schema.tags.id, id))
      .returning();
    return updated;
  }

  async deleteTag(id: number): Promise<void> {
    // Delete all assignments first (cascade should handle this, but explicit for clarity)
    await db.delete(schema.tagAssignments).where(eq(schema.tagAssignments.tagId, id));
    await db.delete(schema.tags).where(eq(schema.tags.id, id));
  }

  async incrementTagUsage(tagId: number): Promise<void> {
    await db.update(schema.tags)
      .set({ usageCount: sql`${schema.tags.usageCount} + 1` })
      .where(eq(schema.tags.id, tagId));
  }

  async decrementTagUsage(tagId: number): Promise<void> {
    await db.update(schema.tags)
      .set({ usageCount: sql`GREATEST(${schema.tags.usageCount} - 1, 0)` })
      .where(eq(schema.tags.id, tagId));
  }

  // Tag Assignments
  async getTagAssignmentsByEntity(entityType: string, entityId: number): Promise<TagAssignment[]> {
    return await db.select().from(schema.tagAssignments)
      .where(and(
        eq(schema.tagAssignments.entityType, entityType as any),
        eq(schema.tagAssignments.entityId, entityId)
      ));
  }

  async getTagAssignmentsByTag(tagId: number): Promise<TagAssignment[]> {
    return await db.select().from(schema.tagAssignments)
      .where(eq(schema.tagAssignments.tagId, tagId));
  }

  async getEntitiesByTag(tagId: number, entityType?: string): Promise<Array<{ entityType: string; entityId: number }>> {
    const conditions = [eq(schema.tagAssignments.tagId, tagId)];
    if (entityType) {
      conditions.push(eq(schema.tagAssignments.entityType, entityType as any));
    }
    const assignments = await db.select({
      entityType: schema.tagAssignments.entityType,
      entityId: schema.tagAssignments.entityId,
    }).from(schema.tagAssignments)
      .where(and(...conditions));
    return assignments.map(a => ({ entityType: a.entityType, entityId: a.entityId }));
  }

  async assignTag(tagId: number, entityType: string, entityId: number): Promise<TagAssignment> {
    // Check if already assigned
    const existing = await db.select().from(schema.tagAssignments)
      .where(and(
        eq(schema.tagAssignments.tagId, tagId),
        eq(schema.tagAssignments.entityType, entityType as any),
        eq(schema.tagAssignments.entityId, entityId)
      ));
    
    if (existing.length > 0) {
      return existing[0];
    }

    // Create assignment
    const [assignment] = await db.insert(schema.tagAssignments).values({
      tagId,
      entityType: entityType as any,
      entityId,
    }).returning();

    // Increment usage count
    await this.incrementTagUsage(tagId);

    return assignment;
  }

  async unassignTag(tagId: number, entityType: string, entityId: number): Promise<void> {
    await db.delete(schema.tagAssignments)
      .where(and(
        eq(schema.tagAssignments.tagId, tagId),
        eq(schema.tagAssignments.entityType, entityType as any),
        eq(schema.tagAssignments.entityId, entityId)
      ));

    // Decrement usage count
    await this.decrementTagUsage(tagId);
  }

  async unassignAllTagsFromEntity(entityType: string, entityId: number): Promise<void> {
    // Get all tag IDs before deleting
    const assignments = await this.getTagAssignmentsByEntity(entityType, entityId);
    const tagIds = assignments.map(a => a.tagId);

    // Delete assignments
    await db.delete(schema.tagAssignments)
      .where(and(
        eq(schema.tagAssignments.entityType, entityType as any),
        eq(schema.tagAssignments.entityId, entityId)
      ));

    // Decrement usage counts
    for (const tagId of tagIds) {
      await this.decrementTagUsage(tagId);
    }
  }

  async getTagsForEntity(entityType: string, entityId: number): Promise<Tag[]> {
    const assignments = await this.getTagAssignmentsByEntity(entityType, entityId);
    if (assignments.length === 0) return [];

    const tagIds = assignments.map(a => a.tagId);
    return await db.select().from(schema.tags)
      .where(inArray(schema.tags.id, tagIds))
      .orderBy(asc(schema.tags.name));
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

    let demoOrg = await this.getOrganizationBySlug(DEMO_ORG_SLUG);
    if (!demoOrg) {
      // Auto-create default organization in development mode
      demoOrg = await this.createOrganization({
        name: "Demo Organization",
        slug: DEMO_ORG_SLUG,
      });
      logger.info(`Created demo organization`, { organizationId: demoOrg.id, name: demoOrg.name });
    }

    const existingAssignment = await this.getUserOrganization(userId, demoOrg.id);
    if (existingAssignment) {
      // User already assigned, but check if org has projects
      const projects = await this.getProjectsByOrganization(demoOrg.id);
      if (projects.length === 0) {
        // Create a demo project for the user
        await this.createProject({
          organizationId: demoOrg.id,
          name: "Welcome Project",
          code: "DEMO-001",
          description: "This is a demo project to help you get started. You can explore the features or create your own organization and projects.",
          status: "active",
          startDate: new Date(),
          endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
          currency: "USD",
        });
        logger.info(`Created demo project for user`, { userId, organizationId: demoOrg.id });
      }
      return;
    }

    await db.insert(schema.userOrganizations).values({
      userId,
      organizationId: demoOrg.id,
      role: "owner",
    });
    logger.info(`Assigned user to organization as owner`, { userId, organizationId: demoOrg.id });

    // Create a demo project for new users
    const projects = await this.getProjectsByOrganization(demoOrg.id);
    if (projects.length === 0) {
      await this.createProject({
        organizationId: demoOrg.id,
        name: "Welcome Project",
        code: "DEMO-001",
        description: "This is a demo project to help you get started. You can explore the features or create your own organization and projects.",
        status: "active",
        startDate: new Date(),
        endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
        currency: "USD",
      });
      logger.info(`Created demo project for new user`, { userId, organizationId: demoOrg.id });
    }
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

  async updateUserOrganization(userId: string, organizationId: number, updates: { role?: string }): Promise<UserOrganization | undefined> {
    const [updated] = await db.update(schema.userOrganizations)
      .set(updates)
      .where(and(
        eq(schema.userOrganizations.userId, userId),
        eq(schema.userOrganizations.organizationId, organizationId)
      ))
      .returning();
    return updated;
  }

  async deleteUserOrganization(userId: string, organizationId: number): Promise<void> {
    await db.delete(schema.userOrganizations)
      .where(and(
        eq(schema.userOrganizations.userId, userId),
        eq(schema.userOrganizations.organizationId, organizationId)
      ));
  }

  // User Invitations
  async getUserInvitationById(id: number): Promise<UserInvitation | undefined> {
    const [invitation] = await db.select().from(schema.userInvitations)
      .where(eq(schema.userInvitations.id, id));
    return invitation;
  }

  async getUserInvitation(token: string): Promise<UserInvitation | undefined> {
    const [invitation] = await db.select().from(schema.userInvitations)
      .where(eq(schema.userInvitations.token, token));
    return invitation;
  }

  async getUserInvitationsByOrganization(organizationId: number): Promise<UserInvitation[]> {
    return await db.select().from(schema.userInvitations)
      .where(eq(schema.userInvitations.organizationId, organizationId))
      .orderBy(desc(schema.userInvitations.createdAt));
  }

  async getUserInvitationByEmail(organizationId: number, email: string): Promise<UserInvitation | undefined> {
    const [invitation] = await db.select().from(schema.userInvitations)
      .where(and(
        eq(schema.userInvitations.organizationId, organizationId),
        eq(schema.userInvitations.email, email),
        isNull(schema.userInvitations.acceptedAt) // Only pending invitations
      ))
      .orderBy(desc(schema.userInvitations.createdAt))
      .limit(1);
    return invitation;
  }

  async createUserInvitation(invitation: InsertUserInvitation & { token: string }): Promise<UserInvitation> {
    const [created] = await db.insert(schema.userInvitations).values(invitation).returning();
    return created;
  }

  async acceptUserInvitation(token: string, userId: string): Promise<UserOrganization> {
    // Get invitation
    const invitation = await this.getUserInvitation(token);
    if (!invitation) {
      throw new Error("Invitation not found");
    }
    if (invitation.acceptedAt) {
      throw new Error("Invitation already accepted");
    }
    if (new Date() > new Date(invitation.expiresAt)) {
      throw new Error("Invitation has expired");
    }

    // Check if user already in organization
    const existing = await this.getUserOrganization(userId, invitation.organizationId);
    if (existing) {
      // Mark invitation as accepted but don't create duplicate
      await db.update(schema.userInvitations)
        .set({ acceptedAt: new Date() })
        .where(eq(schema.userInvitations.id, invitation.id));
      return existing;
    }

    // Create user-organization relationship
    const userOrg = await this.createUserOrganization({
      userId,
      organizationId: invitation.organizationId,
      role: invitation.role,
    });

    // Mark invitation as accepted
    await db.update(schema.userInvitations)
      .set({ acceptedAt: new Date() })
      .where(eq(schema.userInvitations.id, invitation.id));

    return userOrg;
  }

  async deleteUserInvitation(id: number): Promise<void> {
    await db.delete(schema.userInvitations)
      .where(eq(schema.userInvitations.id, id));
  }

  // User Activity Logs
  async createUserActivityLog(log: InsertUserActivityLog): Promise<UserActivityLog> {
    const [created] = await db.insert(schema.userActivityLogs).values(log).returning();
    return created;
  }

  async getUserActivityLogs(filters: {
    userId?: string;
    organizationId?: number;
    projectId?: number;
    action?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<UserActivityLog[]> {
    const conditions: any[] = [];

    if (filters.userId) {
      conditions.push(eq(schema.userActivityLogs.userId, filters.userId));
    }
    if (filters.organizationId) {
      conditions.push(eq(schema.userActivityLogs.organizationId, filters.organizationId));
    }
    if (filters.projectId) {
      conditions.push(eq(schema.userActivityLogs.projectId, filters.projectId));
    }
    if (filters.action) {
      conditions.push(eq(schema.userActivityLogs.action, filters.action));
    }
    if (filters.startDate) {
      conditions.push(sql`${schema.userActivityLogs.createdAt} >= ${filters.startDate}`);
    }
    if (filters.endDate) {
      conditions.push(sql`${schema.userActivityLogs.createdAt} <= ${filters.endDate}`);
    }

    let query = db.select().from(schema.userActivityLogs);
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    query = query.orderBy(desc(schema.userActivityLogs.createdAt));
    if (filters.limit) {
      query = query.limit(filters.limit) as any;
    }

    return await query;
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

  async duplicateProject(projectId: number, newName: string, newCode: string): Promise<Project> {
    const project = await this.getProject(projectId);
    if (!project) throw new Error("Project not found");

    // Create new project
    const newProject = await this.createProject({
      organizationId: project.organizationId,
      name: newName,
      code: newCode,
      description: project.description || undefined,
      status: "active",
      startDate: project.startDate || undefined,
      endDate: project.endDate || undefined,
      budget: project.budget || undefined,
      currency: project.currency,
    });

    // Copy project statuses
    const statuses = await this.getProjectStatusesByProject(projectId);
    for (const status of statuses) {
      await this.createProjectStatus({
        projectId: newProject.id,
        name: status.name,
        code: status.code,
        color: status.color || undefined,
        order: status.order,
        isActive: status.isActive,
      });
    }

    // Copy kanban columns
    const columns = await this.getKanbanColumnsByProject(projectId);
    for (const column of columns) {
      await this.createKanbanColumn({
        projectId: newProject.id,
        name: column.name,
        statusId: column.statusId || undefined,
        customStatusId: column.customStatusId || undefined,
        order: column.order,
        isActive: column.isActive,
      });
    }

    // Copy tasks (with hierarchy)
    const tasks = await this.getTasksByProject(projectId);
    const taskMap = new Map<number, number>(); // old task id -> new task id
    
    // First pass: create all tasks
    const rootTasks = tasks.filter(t => !t.parentId);
    const createTaskRecursive = async (task: Task, parentId: number | null = null) => {
      const newTask = await this.createTask({
        projectId: newProject.id,
        parentId: parentId,
        wbsCode: task.wbsCode,
        name: task.name,
        description: task.description || undefined,
        status: task.status,
        customStatusId: task.customStatusId || undefined,
        priority: task.priority,
        startDate: task.startDate || undefined,
        endDate: task.endDate || undefined,
        estimatedHours: task.estimatedHours || undefined,
        actualHours: task.actualHours || undefined,
        progress: task.progress,
        assignedTo: task.assignedTo || undefined,
        assignedToName: task.assignedToName || undefined,
        createdBy: task.createdBy,
        discipline: task.discipline || undefined,
        disciplineLabel: task.disciplineLabel || undefined,
        areaCode: task.areaCode || undefined,
        weightFactor: task.weightFactor || undefined,
        constraintType: task.constraintType || undefined,
        constraintDate: task.constraintDate || undefined,
        baselineStart: task.baselineStart || undefined,
        baselineFinish: task.baselineFinish || undefined,
        actualStartDate: task.actualStartDate || undefined,
        actualFinishDate: task.actualFinishDate || undefined,
        workMode: task.workMode || undefined,
        isMilestone: task.isMilestone,
        isCriticalPath: task.isCriticalPath,
      });
      taskMap.set(task.id, newTask.id);
      
      // Create children
      const children = tasks.filter(t => t.parentId === task.id);
      for (const child of children) {
        await createTaskRecursive(child, newTask.id);
      }
    };

    for (const rootTask of rootTasks) {
      await createTaskRecursive(rootTask);
    }

    // Copy dependencies (second pass)
    const dependencies = await this.getDependenciesByProject(projectId);
    for (const dep of dependencies) {
      const newPredecessorId = taskMap.get(dep.predecessorId);
      const newSuccessorId = taskMap.get(dep.successorId);
      if (newPredecessorId && newSuccessorId) {
        await this.createTaskDependency({
          projectId: newProject.id,
          predecessorId: newPredecessorId,
          successorId: newSuccessorId,
          type: dep.type,
          lagDays: dep.lagDays,
        });
      }
    }

    return newProject;
  }

  // Project Statuses (Custom Statuses)
  async getProjectStatus(id: number): Promise<ProjectStatus | undefined> {
    const [status] = await db.select().from(schema.projectStatuses).where(eq(schema.projectStatuses.id, id));
    return status;
  }

  async getProjectStatusesByProject(projectId: number): Promise<ProjectStatus[]> {
    return await db.select().from(schema.projectStatuses)
      .where(eq(schema.projectStatuses.projectId, projectId))
      .orderBy(asc(schema.projectStatuses.order), asc(schema.projectStatuses.id));
  }

  async createProjectStatus(status: InsertProjectStatus): Promise<ProjectStatus> {
    const [created] = await db.insert(schema.projectStatuses).values(status).returning();
    return created;
  }

  async updateProjectStatus(id: number, status: Partial<UpdateProjectStatus>): Promise<ProjectStatus | undefined> {
    const [updated] = await db.update(schema.projectStatuses)
      .set({ ...status, updatedAt: new Date() })
      .where(eq(schema.projectStatuses.id, id))
      .returning();
    return updated;
  }

  async deleteProjectStatus(id: number): Promise<void> {
    await db.delete(schema.projectStatuses).where(eq(schema.projectStatuses.id, id));
  }

  async reorderProjectStatuses(projectId: number, statusIds: number[]): Promise<void> {
    for (let i = 0; i < statusIds.length; i++) {
      await db.update(schema.projectStatuses)
        .set({ order: i, updatedAt: new Date() })
        .where(and(
          eq(schema.projectStatuses.id, statusIds[i]),
          eq(schema.projectStatuses.projectId, projectId)
        ));
    }
  }

  // Kanban Columns
  async getKanbanColumn(id: number): Promise<KanbanColumn | undefined> {
    const [column] = await db.select().from(schema.kanbanColumns).where(eq(schema.kanbanColumns.id, id));
    return column;
  }

  async getKanbanColumnsByProject(projectId: number): Promise<KanbanColumn[]> {
    return await db.select().from(schema.kanbanColumns)
      .where(eq(schema.kanbanColumns.projectId, projectId))
      .orderBy(asc(schema.kanbanColumns.order), asc(schema.kanbanColumns.id));
  }

  async createKanbanColumn(column: InsertKanbanColumn): Promise<KanbanColumn> {
    const [created] = await db.insert(schema.kanbanColumns).values(column).returning();
    return created;
  }

  async updateKanbanColumn(id: number, column: Partial<UpdateKanbanColumn>): Promise<KanbanColumn | undefined> {
    const [updated] = await db.update(schema.kanbanColumns)
      .set({ ...column, updatedAt: new Date() })
      .where(eq(schema.kanbanColumns.id, id))
      .returning();
    return updated;
  }

  async deleteKanbanColumn(id: number): Promise<void> {
    await db.delete(schema.kanbanColumns).where(eq(schema.kanbanColumns.id, id));
  }

  async reorderKanbanColumns(projectId: number, columnIds: number[]): Promise<void> {
    for (let i = 0; i < columnIds.length; i++) {
      await db.update(schema.kanbanColumns)
        .set({ order: i, updatedAt: new Date() })
        .where(and(
          eq(schema.kanbanColumns.id, columnIds[i]),
          eq(schema.kanbanColumns.projectId, projectId)
        ));
    }
  }

  // Project Templates
  async getProjectTemplate(id: number): Promise<ProjectTemplate | undefined> {
    const [template] = await db.select().from(schema.projectTemplates).where(eq(schema.projectTemplates.id, id));
    return template;
  }

  async getProjectTemplates(): Promise<ProjectTemplate[]> {
    return await db.select().from(schema.projectTemplates)
      .orderBy(desc(schema.projectTemplates.createdAt));
  }

  async createProjectTemplate(template: InsertProjectTemplate): Promise<ProjectTemplate> {
    const [created] = await db.insert(schema.projectTemplates).values(template).returning();
    return created;
  }

  async updateProjectTemplate(id: number, template: Partial<InsertProjectTemplate>): Promise<ProjectTemplate | undefined> {
    const [updated] = await db.update(schema.projectTemplates)
      .set({ ...template, updatedAt: new Date() })
      .where(eq(schema.projectTemplates.id, id))
      .returning();
    return updated;
  }

  async deleteProjectTemplate(id: number): Promise<void> {
    await db.delete(schema.projectTemplates).where(eq(schema.projectTemplates.id, id));
  }

  async incrementTemplateUsage(id: number): Promise<void> {
    await db.update(schema.projectTemplates)
      .set({ usageCount: sql`${schema.projectTemplates.usageCount} + 1` })
      .where(eq(schema.projectTemplates.id, id));
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

  async updateTaskDependency(id: number, dependency: Partial<InsertTaskDependency>): Promise<TaskDependency | undefined> {
    const [updated] = await db.update(schema.taskDependencies)
      .set(dependency)
      .where(eq(schema.taskDependencies.id, id))
      .returning();
    return updated;
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

  // Stakeholder RACI Matrix
  async getStakeholderRaci(id: number): Promise<StakeholderRaci | undefined> {
    const [raci] = await db.select().from(schema.stakeholderRaci)
      .where(eq(schema.stakeholderRaci.id, id));
    return raci;
  }

  async getStakeholderRaciByProject(projectId: number): Promise<StakeholderRaci[]> {
    return await db.select().from(schema.stakeholderRaci)
      .where(eq(schema.stakeholderRaci.projectId, projectId))
      .orderBy(desc(schema.stakeholderRaci.createdAt));
  }

  async getStakeholderRaciByTask(taskId: number): Promise<StakeholderRaci[]> {
    return await db.select().from(schema.stakeholderRaci)
      .where(eq(schema.stakeholderRaci.taskId, taskId));
  }

  async getStakeholderRaciByStakeholder(stakeholderId: number): Promise<StakeholderRaci[]> {
    return await db.select().from(schema.stakeholderRaci)
      .where(eq(schema.stakeholderRaci.stakeholderId, stakeholderId));
  }

  async createStakeholderRaci(raci: InsertStakeholderRaci): Promise<StakeholderRaci> {
    const [created] = await db.insert(schema.stakeholderRaci).values(raci).returning();
    return created;
  }

  async updateStakeholderRaci(id: number, raci: Partial<InsertStakeholderRaci>): Promise<StakeholderRaci | undefined> {
    const [updated] = await db.update(schema.stakeholderRaci)
      .set({ ...raci, updatedAt: new Date() })
      .where(eq(schema.stakeholderRaci.id, id))
      .returning();
    return updated;
  }

  async deleteStakeholderRaci(id: number): Promise<void> {
    await db.delete(schema.stakeholderRaci).where(eq(schema.stakeholderRaci.id, id));
  }

  async upsertStakeholderRaci(raci: InsertStakeholderRaci): Promise<StakeholderRaci> {
    // Build query based on whether it's a stakeholder or resource assignment
    // New unique constraint is (stakeholder/resource, task, raciType)
    let existing: StakeholderRaci | undefined;

    if (raci.stakeholderId) {
      const [found] = await db.select().from(schema.stakeholderRaci)
        .where(and(
          eq(schema.stakeholderRaci.stakeholderId, raci.stakeholderId),
          eq(schema.stakeholderRaci.taskId, raci.taskId),
          eq(schema.stakeholderRaci.raciType, raci.raciType)
        ));
      existing = found;
    } else if (raci.resourceId) {
      const [found] = await db.select().from(schema.stakeholderRaci)
        .where(and(
          eq(schema.stakeholderRaci.resourceId, raci.resourceId),
          eq(schema.stakeholderRaci.taskId, raci.taskId),
          eq(schema.stakeholderRaci.raciType, raci.raciType)
        ));
      existing = found;
    }

    if (existing) {
      // Update existing record
      const [updated] = await db.update(schema.stakeholderRaci)
        .set({ ...raci, updatedAt: new Date() })
        .where(eq(schema.stakeholderRaci.id, existing.id))
        .returning();
      return updated;
    } else {
      // Create new record
      const [created] = await db.insert(schema.stakeholderRaci).values(raci).returning();
      return created;
    }
  }

  async getStakeholderRaciByResource(resourceId: number): Promise<StakeholderRaci[]> {
    return await db.select().from(schema.stakeholderRaci)
      .where(eq(schema.stakeholderRaci.resourceId, resourceId));
  }

  async deleteStakeholderRaciByTaskAndType(taskId: number, raciType: string, personId: number, isResource: boolean): Promise<void> {
    if (isResource) {
      await db.delete(schema.stakeholderRaci)
        .where(and(
          eq(schema.stakeholderRaci.taskId, taskId),
          eq(schema.stakeholderRaci.raciType, raciType as any),
          eq(schema.stakeholderRaci.resourceId, personId)
        ));
    } else {
      await db.delete(schema.stakeholderRaci)
        .where(and(
          eq(schema.stakeholderRaci.taskId, taskId),
          eq(schema.stakeholderRaci.raciType, raciType as any),
          eq(schema.stakeholderRaci.stakeholderId, personId)
        ));
    }
  }

  async deleteInheritedRaciByTask(taskId: number): Promise<void> {
    await db.delete(schema.stakeholderRaci)
      .where(and(
        eq(schema.stakeholderRaci.taskId, taskId),
        eq(schema.stakeholderRaci.isInherited, true)
      ));
  }

  async getInheritedRaciBySourceTask(sourceTaskId: number): Promise<StakeholderRaci[]> {
    return await db.select().from(schema.stakeholderRaci)
      .where(eq(schema.stakeholderRaci.inheritedFromTaskId, sourceTaskId));
  }

  // Notification Rules
  async getNotificationRule(id: number): Promise<NotificationRule | undefined> {
    const [rule] = await db.select().from(schema.notificationRules)
      .where(eq(schema.notificationRules.id, id));
    return rule;
  }

  async getNotificationRulesByProject(projectId: number): Promise<NotificationRule[]> {
    return await db.select().from(schema.notificationRules)
      .where(eq(schema.notificationRules.projectId, projectId))
      .orderBy(desc(schema.notificationRules.createdAt));
  }

  async getNotificationRulesByOrganization(organizationId: number): Promise<NotificationRule[]> {
    return await db.select().from(schema.notificationRules)
      .where(eq(schema.notificationRules.organizationId, organizationId))
      .orderBy(desc(schema.notificationRules.createdAt));
  }

  async getActiveNotificationRules(): Promise<NotificationRule[]> {
    return await db.select().from(schema.notificationRules)
      .where(eq(schema.notificationRules.isActive, true))
      .orderBy(desc(schema.notificationRules.createdAt));
  }

  async createNotificationRule(rule: InsertNotificationRule): Promise<NotificationRule> {
    const [created] = await db.insert(schema.notificationRules).values(rule).returning();
    return created;
  }

  async updateNotificationRule(id: number, rule: UpdateNotificationRule): Promise<NotificationRule | undefined> {
    const [updated] = await db.update(schema.notificationRules)
      .set({ ...rule, updatedAt: new Date() })
      .where(eq(schema.notificationRules.id, id))
      .returning();
    return updated;
  }

  async deleteNotificationRule(id: number): Promise<void> {
    await db.delete(schema.notificationRules)
      .where(eq(schema.notificationRules.id, id));
  }

  // Notification Logs
  async getNotificationLog(id: number): Promise<NotificationLog | undefined> {
    const [log] = await db.select().from(schema.notificationLogs)
      .where(eq(schema.notificationLogs.id, id));
    return log;
  }

  async getNotificationLogsByRule(ruleId: number): Promise<NotificationLog[]> {
    return await db.select().from(schema.notificationLogs)
      .where(eq(schema.notificationLogs.ruleId, ruleId))
      .orderBy(desc(schema.notificationLogs.createdAt));
  }

  async getNotificationLogsByProject(projectId: number): Promise<NotificationLog[]> {
    return await db.select().from(schema.notificationLogs)
      .where(eq(schema.notificationLogs.projectId, projectId))
      .orderBy(desc(schema.notificationLogs.createdAt));
  }

  async createNotificationLog(log: InsertNotificationLog): Promise<NotificationLog> {
    const [created] = await db.insert(schema.notificationLogs).values(log).returning();
    return created;
  }

  async updateNotificationLog(id: number, log: Partial<InsertNotificationLog>): Promise<NotificationLog | undefined> {
    const [updated] = await db.update(schema.notificationLogs)
      .set(log)
      .where(eq(schema.notificationLogs.id, id))
      .returning();
    return updated;
  }

  async getTaskDescendants(taskId: number): Promise<Task[]> {
    const allTasks = await this.getTasksByProject((await this.getTask(taskId))?.projectId || 0);
    const descendants: Task[] = [];
    const collectDescendants = (parentId: number) => {
      const children = allTasks.filter(t => t.parentId === parentId);
      for (const child of children) {
        descendants.push(child);
        collectDescendants(child.id);
      }
    };
    collectDescendants(taskId);
    return descendants;
  }

  async propagateRaciToDescendants(
    sourceTaskId: number,
    raciType: string,
    stakeholderId: number | null,
    resourceId: number | null,
    projectId: number
  ): Promise<void> {
    const descendants = await this.getTaskDescendants(sourceTaskId);

    for (const descendant of descendants) {
      const existingExplicit = await db.select().from(schema.stakeholderRaci)
        .where(and(
          eq(schema.stakeholderRaci.taskId, descendant.id),
          eq(schema.stakeholderRaci.raciType, raciType as any),
          eq(schema.stakeholderRaci.isInherited, false),
          stakeholderId ? eq(schema.stakeholderRaci.stakeholderId, stakeholderId) : isNull(schema.stakeholderRaci.stakeholderId),
          resourceId ? eq(schema.stakeholderRaci.resourceId, resourceId) : isNull(schema.stakeholderRaci.resourceId)
        ));

      if (existingExplicit.length === 0) {
        const existingInherited = await db.select().from(schema.stakeholderRaci)
          .where(and(
            eq(schema.stakeholderRaci.taskId, descendant.id),
            eq(schema.stakeholderRaci.raciType, raciType as any),
            eq(schema.stakeholderRaci.isInherited, true),
            stakeholderId ? eq(schema.stakeholderRaci.stakeholderId, stakeholderId) : isNull(schema.stakeholderRaci.stakeholderId),
            resourceId ? eq(schema.stakeholderRaci.resourceId, resourceId) : isNull(schema.stakeholderRaci.resourceId)
          ));

        if (existingInherited.length === 0) {
          await db.insert(schema.stakeholderRaci).values({
            projectId,
            taskId: descendant.id,
            stakeholderId,
            resourceId,
            raciType: raciType as any,
            isInherited: true,
            inheritedFromTaskId: sourceTaskId,
          });
        }
      }
    }
  }

  async removeInheritedRaciFromDescendants(
    sourceTaskId: number,
    raciType: string,
    stakeholderId: number | null,
    resourceId: number | null
  ): Promise<void> {
    const descendants = await this.getTaskDescendants(sourceTaskId);

    for (const descendant of descendants) {
      await db.delete(schema.stakeholderRaci)
        .where(and(
          eq(schema.stakeholderRaci.taskId, descendant.id),
          eq(schema.stakeholderRaci.raciType, raciType as any),
          eq(schema.stakeholderRaci.inheritedFromTaskId, sourceTaskId),
          stakeholderId ? eq(schema.stakeholderRaci.stakeholderId, stakeholderId) : isNull(schema.stakeholderRaci.stakeholderId),
          resourceId ? eq(schema.stakeholderRaci.resourceId, resourceId) : isNull(schema.stakeholderRaci.resourceId)
        ));
    }
  }

  async resetRaciToInherited(taskId: number, raciType: string): Promise<void> {
    await db.delete(schema.stakeholderRaci)
      .where(and(
        eq(schema.stakeholderRaci.taskId, taskId),
        eq(schema.stakeholderRaci.raciType, raciType as any),
        eq(schema.stakeholderRaci.isInherited, false)
      ));

    const task = await this.getTask(taskId);
    if (!task || !task.parentId) return;

    const parentRaci = await db.select().from(schema.stakeholderRaci)
      .where(and(
        eq(schema.stakeholderRaci.taskId, task.parentId),
        eq(schema.stakeholderRaci.raciType, raciType as any)
      ));

    for (const parent of parentRaci) {
      await db.insert(schema.stakeholderRaci).values({
        projectId: task.projectId,
        taskId,
        stakeholderId: parent.stakeholderId,
        resourceId: parent.resourceId,
        raciType: raciType as any,
        isInherited: true,
        inheritedFromTaskId: task.parentId,
      });
    }
  }

  async hasExplicitRaciOverride(taskId: number, raciType: string): Promise<boolean> {
    const explicit = await db.select().from(schema.stakeholderRaci)
      .where(and(
        eq(schema.stakeholderRaci.taskId, taskId),
        eq(schema.stakeholderRaci.raciType, raciType as any),
        eq(schema.stakeholderRaci.isInherited, false)
      ));
    return explicit.length > 0;
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

  // Change Request Approvals (Workflow)
  async getChangeRequestApproval(id: number): Promise<ChangeRequestApproval | undefined> {
    const [approval] = await db.select().from(schema.changeRequestApprovals)
      .where(eq(schema.changeRequestApprovals.id, id));
    return approval;
  }

  async getChangeRequestApprovals(changeRequestId: number): Promise<ChangeRequestApproval[]> {
    return await db.select().from(schema.changeRequestApprovals)
      .where(eq(schema.changeRequestApprovals.changeRequestId, changeRequestId))
      .orderBy(asc(schema.changeRequestApprovals.sequence), asc(schema.changeRequestApprovals.createdAt));
  }

  async addChangeRequestApprover(approval: InsertChangeRequestApproval): Promise<ChangeRequestApproval> {
    const [created] = await db.insert(schema.changeRequestApprovals).values(approval).returning();
    return created;
  }

  async updateChangeRequestApproval(id: number, approval: Partial<InsertChangeRequestApproval>): Promise<ChangeRequestApproval | undefined> {
    const [updated] = await db.update(schema.changeRequestApprovals)
      .set({ ...approval, updatedAt: new Date() })
      .where(eq(schema.changeRequestApprovals.id, id))
      .returning();
    return updated;
  }

  async deleteChangeRequestApproval(id: number): Promise<void> {
    await db.delete(schema.changeRequestApprovals).where(eq(schema.changeRequestApprovals.id, id));
  }

  async getPendingApprovalsForUser(userId: string): Promise<(ChangeRequestApproval & { changeRequest: ChangeRequest })[]> {
    const approvals = await db.select({
      approval: schema.changeRequestApprovals,
      changeRequest: schema.changeRequests,
    })
      .from(schema.changeRequestApprovals)
      .innerJoin(schema.changeRequests, eq(schema.changeRequestApprovals.changeRequestId, schema.changeRequests.id))
      .where(
        and(
          eq(schema.changeRequestApprovals.reviewerId, userId),
          eq(schema.changeRequestApprovals.status, "pending")
        )
      )
      .orderBy(asc(schema.changeRequestApprovals.sequence));

    return approvals.map(a => ({
      ...a.approval,
      changeRequest: a.changeRequest,
    }));
  }

  // Change Request Tasks (Linkage)
  async getChangeRequestTasks(changeRequestId: number): Promise<ChangeRequestTask[]> {
    return await db.select().from(schema.changeRequestTasks)
      .where(eq(schema.changeRequestTasks.changeRequestId, changeRequestId));
  }

  async addChangeRequestTask(link: InsertChangeRequestTask): Promise<ChangeRequestTask> {
    const [created] = await db.insert(schema.changeRequestTasks).values(link).returning();
    return created;
  }

  async deleteChangeRequestTask(id: number): Promise<void> {
    await db.delete(schema.changeRequestTasks).where(eq(schema.changeRequestTasks.id, id));
  }

  async getTasksByChangeRequest(changeRequestId: number): Promise<(ChangeRequestTask & { task: Task })[]> {
    const results = await db.select({
      link: schema.changeRequestTasks,
      task: schema.tasks,
    })
      .from(schema.changeRequestTasks)
      .innerJoin(schema.tasks, eq(schema.changeRequestTasks.taskId, schema.tasks.id))
      .where(eq(schema.changeRequestTasks.changeRequestId, changeRequestId));

    return results.map(r => ({
      ...r.link,
      task: r.task,
    }));
  }

  async getChangeRequestsByTask(taskId: number): Promise<(ChangeRequestTask & { changeRequest: ChangeRequest })[]> {
    const results = await db.select({
      link: schema.changeRequestTasks,
      changeRequest: schema.changeRequests,
    })
      .from(schema.changeRequestTasks)
      .innerJoin(schema.changeRequests, eq(schema.changeRequestTasks.changeRequestId, schema.changeRequests.id))
      .where(eq(schema.changeRequestTasks.taskId, taskId));

    return results.map(r => ({
      ...r.link,
      changeRequest: r.changeRequest,
    }));
  }

  // Exchange Rates
  async getExchangeRate(date: Date, baseCurrency: string, targetCurrency: string): Promise<ExchangeRate | undefined> {
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    const [rate] = await db.select().from(schema.exchangeRates)
      .where(
        and(
          eq(schema.exchangeRates.date, new Date(dateStr)),
          eq(schema.exchangeRates.baseCurrency, baseCurrency.toUpperCase()),
          eq(schema.exchangeRates.targetCurrency, targetCurrency.toUpperCase())
        )
      )
      .limit(1);
    return rate;
  }

  async getExchangeRatesByDate(date: Date, baseCurrency?: string): Promise<ExchangeRate[]> {
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    const conditions: any[] = [eq(schema.exchangeRates.date, new Date(dateStr))];
    
    if (baseCurrency) {
      conditions.push(eq(schema.exchangeRates.baseCurrency, baseCurrency.toUpperCase()));
    }

    return await db.select().from(schema.exchangeRates)
      .where(and(...conditions))
      .orderBy(schema.exchangeRates.targetCurrency);
  }

  async createExchangeRate(rate: InsertExchangeRate): Promise<ExchangeRate> {
    // Normalize currency codes to uppercase
    const normalizedRate = {
      ...rate,
      baseCurrency: rate.baseCurrency.toUpperCase(),
      targetCurrency: rate.targetCurrency.toUpperCase(),
      updatedAt: new Date(),
    };

    const [created] = await db.insert(schema.exchangeRates).values(normalizedRate).returning();
    return created;
  }

  async updateExchangeRate(id: number, rate: Partial<InsertExchangeRate>): Promise<ExchangeRate | undefined> {
    const updateData: any = { ...rate, updatedAt: new Date() };
    
    // Normalize currency codes if provided
    if (rate.baseCurrency) updateData.baseCurrency = rate.baseCurrency.toUpperCase();
    if (rate.targetCurrency) updateData.targetCurrency = rate.targetCurrency.toUpperCase();

    const [updated] = await db.update(schema.exchangeRates)
      .set(updateData)
      .where(eq(schema.exchangeRates.id, id))
      .returning();
    return updated;
  }

  // Exchange Rate Syncs
  async getExchangeRateSync(id: number): Promise<ExchangeRateSync | undefined> {
    const [sync] = await db.select().from(schema.exchangeRateSyncs)
      .where(eq(schema.exchangeRateSyncs.id, id));
    return sync;
  }

  async getExchangeRateSyncs(limit: number = 50): Promise<ExchangeRateSync[]> {
    return await db.select().from(schema.exchangeRateSyncs)
      .orderBy(desc(schema.exchangeRateSyncs.syncDate))
      .limit(limit);
  }

  async createExchangeRateSync(sync: InsertExchangeRateSync): Promise<ExchangeRateSync> {
    const [created] = await db.insert(schema.exchangeRateSyncs).values(sync).returning();
    return created;
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

  async getCostItemsByCBS(cbsId: number): Promise<CostItem[]> {
    const links = await db.select().from(schema.costItemCBSLinks)
      .where(eq(schema.costItemCBSLinks.cbsId, cbsId));
    
    const costItemIds = links.map(link => link.costItemId);
    if (costItemIds.length === 0) {
      return [];
    }

    return await db.select().from(schema.costItems)
      .where(inArray(schema.costItems.id, costItemIds));
  }

  // Cost Breakdown Structure (CBS)
  async getCostBreakdownStructure(id: number): Promise<CostBreakdownStructure | undefined> {
    const [cbs] = await db.select().from(schema.costBreakdownStructure)
      .where(eq(schema.costBreakdownStructure.id, id));
    return cbs;
  }

  async getCostBreakdownStructureByProject(projectId: number): Promise<CostBreakdownStructure[]> {
    return await db.select().from(schema.costBreakdownStructure)
      .where(eq(schema.costBreakdownStructure.projectId, projectId))
      .orderBy(asc(schema.costBreakdownStructure.level), asc(schema.costBreakdownStructure.code));
  }

  async createCostBreakdownStructure(cbs: InsertCostBreakdownStructure): Promise<CostBreakdownStructure> {
    const [created] = await db.insert(schema.costBreakdownStructure).values({
      ...cbs,
      updatedAt: new Date(),
    }).returning();
    return created;
  }

  async updateCostBreakdownStructure(id: number, cbs: Partial<InsertCostBreakdownStructure>): Promise<CostBreakdownStructure | undefined> {
    const [updated] = await db.update(schema.costBreakdownStructure)
      .set({ ...cbs, updatedAt: new Date() })
      .where(eq(schema.costBreakdownStructure.id, id))
      .returning();
    return updated;
  }

  async deleteCostBreakdownStructure(id: number): Promise<void> {
    await db.delete(schema.costBreakdownStructure).where(eq(schema.costBreakdownStructure.id, id));
  }

  // Cost Item CBS Links
  async getCostItemCBSLinks(costItemId: number): Promise<CostItemCBSLink[]> {
    return await db.select().from(schema.costItemCBSLinks)
      .where(eq(schema.costItemCBSLinks.costItemId, costItemId));
  }

  async linkCostItemToCBS(costItemId: number, cbsId: number, allocation: number = 100): Promise<CostItemCBSLink> {
    const [link] = await db.insert(schema.costItemCBSLinks).values({
      costItemId,
      cbsId,
      allocation: allocation.toString(),
    }).returning();
    return link;
  }

  async unlinkCostItemFromCBS(costItemId: number, cbsId: number): Promise<void> {
    await db.delete(schema.costItemCBSLinks)
      .where(
        and(
          eq(schema.costItemCBSLinks.costItemId, costItemId),
          eq(schema.costItemCBSLinks.cbsId, cbsId)
        )
      );
  }

  // Procurement Requisitions
  async getProcurementRequisition(id: number): Promise<ProcurementRequisition | undefined> {
    const [requisition] = await db.select().from(schema.procurementRequisitions)
      .where(eq(schema.procurementRequisitions.id, id));
    return requisition;
  }

  async getProcurementRequisitionsByProject(projectId: number): Promise<ProcurementRequisition[]> {
    return await db.select().from(schema.procurementRequisitions)
      .where(eq(schema.procurementRequisitions.projectId, projectId))
      .orderBy(desc(schema.procurementRequisitions.createdAt));
  }

  async createProcurementRequisition(requisition: InsertProcurementRequisition & { requisitionNumber: string; requestedBy: string }): Promise<ProcurementRequisition> {
    const [created] = await db.insert(schema.procurementRequisitions).values({
      ...requisition,
      updatedAt: new Date(),
    }).returning();
    return created;
  }

  async updateProcurementRequisition(id: number, requisition: Partial<InsertProcurementRequisition>): Promise<ProcurementRequisition | undefined> {
    const [updated] = await db.update(schema.procurementRequisitions)
      .set({ ...requisition, updatedAt: new Date() })
      .where(eq(schema.procurementRequisitions.id, id))
      .returning();
    return updated;
  }

  async deleteProcurementRequisition(id: number): Promise<void> {
    await db.delete(schema.procurementRequisitions).where(eq(schema.procurementRequisitions.id, id));
  }

  // Resource Requirements
  async getResourceRequirement(id: number): Promise<ResourceRequirement | undefined> {
    const [requirement] = await db.select().from(schema.resourceRequirements)
      .where(eq(schema.resourceRequirements.id, id));
    return requirement;
  }

  async getResourceRequirementsByTask(taskId: number): Promise<ResourceRequirement[]> {
    return await db.select().from(schema.resourceRequirements)
      .where(eq(schema.resourceRequirements.taskId, taskId))
      .orderBy(asc(schema.resourceRequirements.requiredDate));
  }

  async createResourceRequirement(requirement: InsertResourceRequirement): Promise<ResourceRequirement> {
    const [created] = await db.insert(schema.resourceRequirements).values(requirement).returning();
    return created;
  }

  async updateResourceRequirement(id: number, requirement: Partial<InsertResourceRequirement>): Promise<ResourceRequirement | undefined> {
    const [updated] = await db.update(schema.resourceRequirements)
      .set(requirement)
      .where(eq(schema.resourceRequirements.id, id))
      .returning();
    return updated;
  }

  async deleteResourceRequirement(id: number): Promise<void> {
    await db.delete(schema.resourceRequirements).where(eq(schema.resourceRequirements.id, id));
  }

  // Inventory Allocations
  async getInventoryAllocation(id: number): Promise<InventoryAllocation | undefined> {
    const [allocation] = await db.select().from(schema.inventoryAllocations)
      .where(eq(schema.inventoryAllocations.id, id));
    return allocation;
  }

  async getInventoryAllocationsByProject(projectId: number): Promise<InventoryAllocation[]> {
    return await db.select().from(schema.inventoryAllocations)
      .where(eq(schema.inventoryAllocations.projectId, projectId))
      .orderBy(desc(schema.inventoryAllocations.allocatedDate));
  }

  async getInventoryAllocationsByResource(resourceId: number): Promise<InventoryAllocation[]> {
    return await db.select().from(schema.inventoryAllocations)
      .where(eq(schema.inventoryAllocations.resourceId, resourceId))
      .orderBy(desc(schema.inventoryAllocations.allocatedDate));
  }

  async createInventoryAllocation(allocation: InsertInventoryAllocation & { allocatedBy?: string }): Promise<InventoryAllocation> {
    const [created] = await db.insert(schema.inventoryAllocations).values({
      ...allocation,
      updatedAt: new Date(),
    }).returning();
    return created;
  }

  async updateInventoryAllocation(id: number, allocation: Partial<InsertInventoryAllocation>): Promise<InventoryAllocation | undefined> {
    const [updated] = await db.update(schema.inventoryAllocations)
      .set({ ...allocation, updatedAt: new Date() })
      .where(eq(schema.inventoryAllocations.id, id))
      .returning();
    return updated;
  }

  async deleteInventoryAllocation(id: number): Promise<void> {
    await db.delete(schema.inventoryAllocations).where(eq(schema.inventoryAllocations.id, id));
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

  async getResourceAssignmentsByResource(resourceId: number): Promise<(ResourceAssignment & { task: Task | null })[]> {
    const assignments = await db.select().from(schema.resourceAssignments)
      .where(eq(schema.resourceAssignments.resourceId, resourceId));

    const result: (ResourceAssignment & { task: Task | null })[] = [];
    for (const assignment of assignments) {
      const task = await this.getTask(assignment.taskId);
      result.push({ ...assignment, task: task || null });
    }
    return result;
  }

  async getProjectResourceUtilization(projectId: number, startDate: Date, endDate: Date): Promise<{
    resources: Array<{
      resourceId: number;
      resourceName: string;
      resourceType: string;
      periods: Array<{
        periodStart: Date;
        periodEnd: Date;
        utilization: number;
        isOverAllocated: boolean;
        assignments: Array<{
          taskId: number;
          taskName: string;
          allocation: number;
        }>;
      }>;
    }>;
  }> {
    const resources = await this.getResourcesByProject(projectId);
    const tasks = await this.getTasksByProject(projectId);
    const tasksMap = new Map(tasks.map(t => [t.id, t]));

    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const periods: Array<{ start: Date; end: Date }> = [];

    let currentStart = new Date(startDate);
    currentStart.setHours(0, 0, 0, 0);
    while (currentStart < endDate) {
      const periodEnd = new Date(Math.min(currentStart.getTime() + weekMs, endDate.getTime()));
      periods.push({ start: new Date(currentStart), end: periodEnd });
      currentStart = new Date(periodEnd);
    }

    const result: Array<{
      resourceId: number;
      resourceName: string;
      resourceType: string;
      periods: Array<{
        periodStart: Date;
        periodEnd: Date;
        utilization: number;
        isOverAllocated: boolean;
        assignments: Array<{
          taskId: number;
          taskName: string;
          allocation: number;
        }>;
      }>;
    }> = [];

    for (const resource of resources) {
      const assignments = await db.select().from(schema.resourceAssignments)
        .where(eq(schema.resourceAssignments.resourceId, resource.id));

      const resourcePeriods: Array<{
        periodStart: Date;
        periodEnd: Date;
        utilization: number;
        isOverAllocated: boolean;
        assignments: Array<{
          taskId: number;
          taskName: string;
          allocation: number;
        }>;
      }> = [];

      for (const period of periods) {
        let totalWeightedAllocation = 0;
        const periodAssignments: Array<{ taskId: number; taskName: string; allocation: number }> = [];

        const periodDays = Math.max(1, Math.ceil((period.end.getTime() - period.start.getTime()) / (24 * 60 * 60 * 1000)));

        for (const assignment of assignments) {
          const task = tasksMap.get(assignment.taskId);
          if (!task || !task.startDate || !task.endDate) continue;

          const taskStart = new Date(task.startDate);
          const taskEnd = new Date(task.endDate);

          if (taskStart <= period.end && taskEnd >= period.start) {
            const overlapStart = new Date(Math.max(taskStart.getTime(), period.start.getTime()));
            const overlapEnd = new Date(Math.min(taskEnd.getTime(), period.end.getTime()));
            const overlapDays = Math.max(1, Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (24 * 60 * 60 * 1000)));

            const weightedAllocation = (assignment.allocation * overlapDays) / periodDays;
            totalWeightedAllocation += weightedAllocation;

            periodAssignments.push({
              taskId: task.id,
              taskName: task.name,
              allocation: Math.round(weightedAllocation),
            });
          }
        }

        const finalUtilization = Math.round(totalWeightedAllocation);
        resourcePeriods.push({
          periodStart: period.start,
          periodEnd: period.end,
          utilization: finalUtilization,
          isOverAllocated: finalUtilization > 100,
          assignments: periodAssignments,
        });
      }

      result.push({
        resourceId: resource.id,
        resourceName: resource.name,
        resourceType: resource.type,
        periods: resourcePeriods,
      });
    }

    return { resources: result };
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

  async getAiConversationsByProject(projectId: number, userId: string): Promise<AiConversation[]> {
    return await db.select().from(schema.aiConversations)
      .where(and(
        eq(schema.aiConversations.projectId, projectId),
        eq(schema.aiConversations.userId, userId)
      ))
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

  // Project Events (Calendar)
  async getProjectEvent(id: number): Promise<ProjectEvent | undefined> {
    const [event] = await db.select().from(schema.projectEvents).where(eq(schema.projectEvents.id, id));
    return event;
  }

  async getProjectEventsByProject(projectId: number): Promise<ProjectEvent[]> {
    return db.select().from(schema.projectEvents)
      .where(eq(schema.projectEvents.projectId, projectId))
      .orderBy(asc(schema.projectEvents.startDate));
  }

  async createProjectEvent(event: InsertProjectEvent & { createdBy: string }): Promise<ProjectEvent> {
    const [created] = await db.insert(schema.projectEvents).values(event).returning();
    return created;
  }

  async updateProjectEvent(id: number, event: Partial<InsertProjectEvent>): Promise<ProjectEvent | undefined> {
    const [updated] = await db.update(schema.projectEvents)
      .set({ ...event, updatedAt: new Date() })
      .where(eq(schema.projectEvents.id, id))
      .returning();
    return updated;
  }

  async deleteProjectEvent(id: number): Promise<void> {
    await db.delete(schema.projectEvents).where(eq(schema.projectEvents.id, id));
  }

  // Task Documents (Junction)
  async getTaskDocuments(taskId: number): Promise<TaskDocument[]> {
    return db.select().from(schema.taskDocuments)
      .where(eq(schema.taskDocuments.taskId, taskId));
  }

  async createTaskDocument(taskDocument: InsertTaskDocument): Promise<TaskDocument> {
    const [created] = await db.insert(schema.taskDocuments).values(taskDocument).returning();
    return created;
  }

  async deleteTaskDocument(taskId: number, documentId: number): Promise<void> {
    await db.delete(schema.taskDocuments).where(
      and(
        eq(schema.taskDocuments.taskId, taskId),
        eq(schema.taskDocuments.documentId, documentId)
      )
    );
  }

  // Task Risks (Junction)
  async getTaskRisks(taskId: number): Promise<TaskRisk[]> {
    return db.select().from(schema.taskRisks)
      .where(eq(schema.taskRisks.taskId, taskId));
  }

  async createTaskRisk(taskRisk: InsertTaskRisk): Promise<TaskRisk> {
    const [created] = await db.insert(schema.taskRisks).values(taskRisk).returning();
    return created;
  }

  async deleteTaskRisk(taskId: number, riskId: number): Promise<void> {
    await db.delete(schema.taskRisks).where(
      and(
        eq(schema.taskRisks.taskId, taskId),
        eq(schema.taskRisks.riskId, riskId)
      )
    );
  }

  // Task Issues (Junction)
  async getTaskIssues(taskId: number): Promise<TaskIssue[]> {
    return db.select().from(schema.taskIssues)
      .where(eq(schema.taskIssues.taskId, taskId));
  }

  async createTaskIssue(taskIssue: InsertTaskIssue): Promise<TaskIssue> {
    const [created] = await db.insert(schema.taskIssues).values(taskIssue).returning();
    return created;
  }

  async deleteTaskIssue(taskId: number, issueId: number): Promise<void> {
    await db.delete(schema.taskIssues).where(
      and(
        eq(schema.taskIssues.taskId, taskId),
        eq(schema.taskIssues.issueId, issueId)
      )
    );
  }

  // Chat Conversations
  async getConversation(id: number): Promise<Conversation | undefined> {
    const [conv] = await db.select().from(schema.chatConversations)
      .where(eq(schema.chatConversations.id, id));
    return conv;
  }

  async getConversationsByProject(projectId: number): Promise<Conversation[]> {
    return db.select().from(schema.chatConversations)
      .where(eq(schema.chatConversations.projectId, projectId))
      .orderBy(desc(schema.chatConversations.updatedAt));
  }

  async getConversationsByUser(userId: string): Promise<Conversation[]> {
    // Get conversations where user is a participant
    const participants = await db.select({ conversationId: schema.chatParticipants.conversationId })
      .from(schema.chatParticipants)
      .where(eq(schema.chatParticipants.userId, userId));

    const conversationIds = participants.map(p => p.conversationId);
    if (conversationIds.length === 0) return [];

    return db.select().from(schema.chatConversations)
      .where(inArray(schema.chatConversations.id, conversationIds))
      .orderBy(desc(schema.chatConversations.updatedAt));
  }

  async getConversationByTask(taskId: number): Promise<Conversation | undefined> {
    const [conv] = await db.select().from(schema.chatConversations)
      .where(eq(schema.chatConversations.taskId, taskId));
    return conv;
  }

  async createConversation(conversation: InsertConversation & { createdBy: string }): Promise<Conversation> {
    const [created] = await db.insert(schema.chatConversations).values({
      ...conversation,
      createdBy: conversation.createdBy,
    }).returning();
    return created;
  }

  async updateConversation(id: number, conversation: Partial<UpdateConversation>): Promise<Conversation | undefined> {
    const [updated] = await db.update(schema.chatConversations)
      .set({ ...conversation, updatedAt: new Date() })
      .where(eq(schema.chatConversations.id, id))
      .returning();
    return updated;
  }

  async deleteConversation(id: number): Promise<void> {
    await db.delete(schema.chatConversations).where(eq(schema.chatConversations.id, id));
  }

  // Chat Participants
  async getParticipants(conversationId: number): Promise<Participant[]> {
    return db.select().from(schema.chatParticipants)
      .where(eq(schema.chatParticipants.conversationId, conversationId))
      .orderBy(asc(schema.chatParticipants.joinedAt));
  }

  async addParticipant(conversationId: number, userId: string, role: string = "member"): Promise<Participant> {
    const [participant] = await db.insert(schema.chatParticipants).values({
      conversationId,
      userId,
      role: role as any,
    }).returning();
    return participant;
  }

  async removeParticipant(conversationId: number, userId: string): Promise<void> {
    await db.delete(schema.chatParticipants).where(
      and(
        eq(schema.chatParticipants.conversationId, conversationId),
        eq(schema.chatParticipants.userId, userId)
      )
    );
  }

  async markAsRead(conversationId: number, userId: string): Promise<void> {
    await db.update(schema.chatParticipants)
      .set({ lastReadAt: new Date() })
      .where(
        and(
          eq(schema.chatParticipants.conversationId, conversationId),
          eq(schema.chatParticipants.userId, userId)
        )
      );
  }

  async getUnreadCount(userId: string, conversationId?: number): Promise<number> {
    if (conversationId) {
      // Get unread count for specific conversation
      const participant = await db.select().from(schema.chatParticipants)
        .where(
          and(
            eq(schema.chatParticipants.conversationId, conversationId),
            eq(schema.chatParticipants.userId, userId)
          )
        )
        .limit(1);

      if (!participant[0] || !participant[0].lastReadAt) {
        // If never read, count all messages
        const [result] = await db.select({ count: sql<number>`count(*)` })
          .from(schema.chatMessages)
          .where(eq(schema.chatMessages.conversationId, conversationId));
        return result?.count || 0;
      }

      // Count messages after lastReadAt
      const [result] = await db.select({ count: sql<number>`count(*)` })
        .from(schema.chatMessages)
        .where(
          and(
            eq(schema.chatMessages.conversationId, conversationId),
            sql`${schema.chatMessages.createdAt} > ${participant[0].lastReadAt}`
          )
        );
      return result?.count || 0;
    } else {
      // Get total unread count across all conversations
      const participants = await db.select().from(schema.chatParticipants)
        .where(eq(schema.chatParticipants.userId, userId));

      let totalUnread = 0;
      for (const p of participants) {
        const count = await this.getUnreadCount(userId, p.conversationId);
        totalUnread += count;
      }
      return totalUnread;
    }
  }

  // Chat Messages
  async getMessages(conversationId: number, limit: number = 50, offset: number = 0): Promise<Message[]> {
    return db.select().from(schema.chatMessages)
      .where(
        and(
          eq(schema.chatMessages.conversationId, conversationId),
          isNull(schema.chatMessages.deletedAt)
        )
      )
      .orderBy(desc(schema.chatMessages.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async createMessage(message: InsertMessage & { userId: string }): Promise<Message> {
    const [created] = await db.insert(schema.chatMessages).values({
      ...message,
      userId: message.userId,
    }).returning();
    return created;
  }

  async updateMessage(id: number, message: Partial<UpdateMessage>): Promise<Message | undefined> {
    const [updated] = await db.update(schema.chatMessages)
      .set({ ...message, updatedAt: new Date() })
      .where(eq(schema.chatMessages.id, id))
      .returning();
    return updated;
  }

  async deleteMessage(id: number): Promise<void> {
    // Soft delete
    await db.update(schema.chatMessages)
      .set({ deletedAt: new Date() })
      .where(eq(schema.chatMessages.id, id));
  }

  // Contacts (CRM)
  async getContact(id: number): Promise<Contact | undefined> {
    const [contact] = await db.select().from(schema.contacts).where(eq(schema.contacts.id, id));
    return contact;
  }

  async getContactsByOrganization(organizationId: number): Promise<Contact[]> {
    return await db.select().from(schema.contacts)
      .where(eq(schema.contacts.organizationId, organizationId))
      .orderBy(asc(schema.contacts.lastName), asc(schema.contacts.firstName));
  }

  async getContactByEmail(organizationId: number, email: string): Promise<Contact | undefined> {
    const [contact] = await db.select().from(schema.contacts)
      .where(and(
        eq(schema.contacts.organizationId, organizationId),
        eq(schema.contacts.email, email)
      ));
    return contact;
  }

  async createContact(contact: InsertContact): Promise<Contact> {
    const [created] = await db.insert(schema.contacts).values(contact).returning();
    return created;
  }

  async updateContact(id: number, contact: Partial<UpdateContact>): Promise<Contact | undefined> {
    const [updated] = await db.update(schema.contacts)
      .set({ ...contact, updatedAt: new Date() })
      .where(eq(schema.contacts.id, id))
      .returning();
    return updated;
  }

  async deleteContact(id: number): Promise<void> {
    await db.delete(schema.contacts).where(eq(schema.contacts.id, id));
  }

  // Contact Logs
  async getContactLogs(contactId: number): Promise<ContactLog[]> {
    return await db.select().from(schema.contactLogs)
      .where(eq(schema.contactLogs.contactId, contactId))
      .orderBy(desc(schema.contactLogs.date));
  }

  async createContactLog(log: InsertContactLog & { loggedBy?: string }): Promise<ContactLog> {
    const [created] = await db.insert(schema.contactLogs).values(log).returning();
    return created;
  }

  async deleteContactLog(id: number): Promise<void> {
    await db.delete(schema.contactLogs).where(eq(schema.contactLogs.id, id));
  }

  // Inheritance helpers
  async getTaskAncestors(taskId: number): Promise<Task[]> {
    const ancestors: Task[] = [];
    let currentTask = await this.getTask(taskId);

    while (currentTask && currentTask.parentId) {
      const parentTask = await this.getTask(currentTask.parentId);
      if (parentTask) {
        ancestors.push(parentTask);
        currentTask = parentTask;
      } else {
        break;
      }
    }

    return ancestors;
  }

  async getInheritedResources(taskId: number): Promise<{ assignmentId: number; resourceId: number; resource: Resource | null; sourceTaskId: number; sourceTask: Task | null }[]> {
    const ancestors = await this.getTaskAncestors(taskId);
    const results: { assignmentId: number; resourceId: number; resource: Resource | null; sourceTaskId: number; sourceTask: Task | null }[] = [];

    for (const ancestor of ancestors) {
      const assignments = await db.select().from(schema.resourceAssignments)
        .where(eq(schema.resourceAssignments.taskId, ancestor.id));

      for (const assignment of assignments) {
        const [resource] = await db.select().from(schema.resources)
          .where(eq(schema.resources.id, assignment.resourceId));

        results.push({
          assignmentId: assignment.id,
          resourceId: assignment.resourceId,
          resource: resource || null,
          sourceTaskId: ancestor.id,
          sourceTask: ancestor,
        });
      }
    }

    return results;
  }

  async getInheritedDocuments(taskId: number): Promise<{ taskDocumentId: number; documentId: number; document: Document | null; sourceTaskId: number; sourceTask: Task | null }[]> {
    const ancestors = await this.getTaskAncestors(taskId);
    const results: { taskDocumentId: number; documentId: number; document: Document | null; sourceTaskId: number; sourceTask: Task | null }[] = [];

    for (const ancestor of ancestors) {
      const taskDocs = await this.getTaskDocuments(ancestor.id);

      for (const taskDoc of taskDocs) {
        const document = await this.getDocument(taskDoc.documentId);

        results.push({
          taskDocumentId: taskDoc.id,
          documentId: taskDoc.documentId,
          document: document || null,
          sourceTaskId: ancestor.id,
          sourceTask: ancestor,
        });
      }
    }

    return results;
  }

  async getInheritedRisks(taskId: number): Promise<{ taskRiskId: number; riskId: number; risk: Risk | null; sourceTaskId: number; sourceTask: Task | null }[]> {
    const ancestors = await this.getTaskAncestors(taskId);
    const results: { taskRiskId: number; riskId: number; risk: Risk | null; sourceTaskId: number; sourceTask: Task | null }[] = [];

    for (const ancestor of ancestors) {
      const taskRisks = await this.getTaskRisks(ancestor.id);

      for (const taskRisk of taskRisks) {
        const risk = await this.getRisk(taskRisk.riskId);

        results.push({
          taskRiskId: taskRisk.id,
          riskId: taskRisk.riskId,
          risk: risk || null,
          sourceTaskId: ancestor.id,
          sourceTask: ancestor,
        });
      }
    }

    return results;
  }

  async getInheritedIssues(taskId: number): Promise<{ taskIssueId: number; issueId: number; issue: Issue | null; sourceTaskId: number; sourceTask: Task | null }[]> {
    const ancestors = await this.getTaskAncestors(taskId);
    const results: { taskIssueId: number; issueId: number; issue: Issue | null; sourceTaskId: number; sourceTask: Task | null }[] = [];

    for (const ancestor of ancestors) {
      const taskIssues = await this.getTaskIssues(ancestor.id);

      for (const taskIssue of taskIssues) {
        const issue = await this.getIssue(taskIssue.issueId);

        results.push({
          taskIssueId: taskIssue.id,
          issueId: taskIssue.issueId,
          issue: issue || null,
          sourceTaskId: ancestor.id,
          sourceTask: ancestor,
        });
      }
    }

    return results;
  }

  // Organization-level aggregation (PMO)
  async getTasksByOrganization(organizationId: number): Promise<(Task & { projectName: string })[]> {
    const projects = await this.getProjectsByOrganization(organizationId);
    const projectMap = new Map(projects.map(p => [p.id, p.name]));

    const allTasks: (Task & { projectName: string })[] = [];
    for (const project of projects) {
      const tasks = await this.getTasksByProject(project.id);
      for (const task of tasks) {
        allTasks.push({
          ...task,
          projectName: projectMap.get(project.id) || project.name,
        });
      }
    }
    return allTasks;
  }

  async getRisksByOrganization(organizationId: number): Promise<(Risk & { projectName: string })[]> {
    const projects = await this.getProjectsByOrganization(organizationId);
    const projectMap = new Map(projects.map(p => [p.id, p.name]));

    const allRisks: (Risk & { projectName: string })[] = [];
    for (const project of projects) {
      const risks = await this.getRisksByProject(project.id);
      for (const risk of risks) {
        allRisks.push({
          ...risk,
          projectName: projectMap.get(project.id) || project.name,
        });
      }
    }
    return allRisks;
  }

  async getIssuesByOrganization(organizationId: number): Promise<(Issue & { projectName: string })[]> {
    const projects = await this.getProjectsByOrganization(organizationId);
    const projectMap = new Map(projects.map(p => [p.id, p.name]));

    const allIssues: (Issue & { projectName: string })[] = [];
    for (const project of projects) {
      const issues = await this.getIssuesByProject(project.id);
      for (const issue of issues) {
        allIssues.push({
          ...issue,
          projectName: projectMap.get(project.id) || project.name,
        });
      }
    }
    return allIssues;
  }

  async getResourcesByOrganization(organizationId: number): Promise<(Resource & { projectName: string })[]> {
    const projects = await this.getProjectsByOrganization(organizationId);
    const projectMap = new Map(projects.map(p => [p.id, p.name]));

    const allResources: (Resource & { projectName: string })[] = [];
    for (const project of projects) {
      const resources = await this.getResourcesByProject(project.id);
      for (const resource of resources) {
        allResources.push({
          ...resource,
          projectName: projectMap.get(project.id) || project.name,
        });
      }
    }
    return allResources;
  }

  async getCostItemsByOrganization(organizationId: number): Promise<(CostItem & { projectName: string })[]> {
    const projects = await this.getProjectsByOrganization(organizationId);
    const projectMap = new Map(projects.map(p => [p.id, p.name]));

    const allCostItems: (CostItem & { projectName: string })[] = [];
    for (const project of projects) {
      const costs = await this.getCostItemsByProject(project.id);
      for (const cost of costs) {
        allCostItems.push({
          ...cost,
          projectName: projectMap.get(project.id) || project.name,
        });
      }
    }
    return allCostItems;
  }

  // ==================== Resource Time Entries ====================
  async getResourceTimeEntry(id: number): Promise<schema.ResourceTimeEntry | undefined> {
    const [entry] = await db.select().from(schema.resourceTimeEntries)
      .where(eq(schema.resourceTimeEntries.id, id));
    return entry;
  }

  async getResourceTimeEntriesByAssignment(assignmentId: number): Promise<schema.ResourceTimeEntry[]> {
    return await db.select().from(schema.resourceTimeEntries)
      .where(eq(schema.resourceTimeEntries.resourceAssignmentId, assignmentId))
      .orderBy(desc(schema.resourceTimeEntries.date));
  }

  async createResourceTimeEntry(entry: schema.InsertResourceTimeEntry): Promise<schema.ResourceTimeEntry> {
    const [created] = await db.insert(schema.resourceTimeEntries).values({
      ...entry,
      updatedAt: new Date(),
    }).returning();
    return created;
  }

  async updateResourceTimeEntry(id: number, entry: Partial<schema.UpdateResourceTimeEntry>): Promise<schema.ResourceTimeEntry | undefined> {
    const [updated] = await db.update(schema.resourceTimeEntries)
      .set({ ...entry, updatedAt: new Date() })
      .where(eq(schema.resourceTimeEntries.id, id))
      .returning();
    return updated;
  }

  async deleteResourceTimeEntry(id: number): Promise<void> {
    await db.delete(schema.resourceTimeEntries).where(eq(schema.resourceTimeEntries.id, id));
  }

  // ==================== Task Materials ====================
  async getTaskMaterial(id: number): Promise<schema.TaskMaterial | undefined> {
    const [material] = await db.select().from(schema.taskMaterials)
      .where(eq(schema.taskMaterials.id, id));
    return material;
  }

  async getTaskMaterialsByTask(taskId: number): Promise<schema.TaskMaterial[]> {
    return await db.select().from(schema.taskMaterials)
      .where(eq(schema.taskMaterials.taskId, taskId))
      .orderBy(asc(schema.taskMaterials.createdAt));
  }

  async createTaskMaterial(material: schema.InsertTaskMaterial): Promise<schema.TaskMaterial> {
    const [created] = await db.insert(schema.taskMaterials).values({
      ...material,
      updatedAt: new Date(),
    }).returning();
    return created;
  }

  async updateTaskMaterial(id: number, material: Partial<schema.UpdateTaskMaterial>): Promise<schema.TaskMaterial | undefined> {
    const [updated] = await db.update(schema.taskMaterials)
      .set({ ...material, updatedAt: new Date() })
      .where(eq(schema.taskMaterials.id, id))
      .returning();
    return updated;
  }

  async deleteTaskMaterial(id: number): Promise<void> {
    await db.delete(schema.taskMaterials).where(eq(schema.taskMaterials.id, id));
  }

  // ==================== Material Consumptions ====================
  async getMaterialConsumption(id: number): Promise<schema.MaterialConsumption | undefined> {
    const [consumption] = await db.select().from(schema.materialConsumptions)
      .where(eq(schema.materialConsumptions.id, id));
    return consumption;
  }

  async getMaterialConsumptionsByTaskMaterial(taskMaterialId: number): Promise<schema.MaterialConsumption[]> {
    return await db.select().from(schema.materialConsumptions)
      .where(eq(schema.materialConsumptions.taskMaterialId, taskMaterialId))
      .orderBy(desc(schema.materialConsumptions.date));
  }

  async createMaterialConsumption(consumption: schema.InsertMaterialConsumption): Promise<schema.MaterialConsumption> {
    const [created] = await db.insert(schema.materialConsumptions).values(consumption).returning();
    
    // Update cumulative consumption on task material
    const [taskMaterial] = await db.select().from(schema.taskMaterials)
      .where(eq(schema.taskMaterials.id, consumption.taskMaterialId));
    
    if (taskMaterial) {
      const currentCumulative = parseFloat(taskMaterial.cumulativeConsumption || "0");
      const newQuantity = parseFloat(consumption.quantity);
      const newCumulative = (currentCumulative + newQuantity).toString();
      
      await db.update(schema.taskMaterials)
        .set({
          cumulativeConsumption: newCumulative,
          lastConsumptionDate: consumption.date,
          updatedAt: new Date(),
        })
        .where(eq(schema.taskMaterials.id, consumption.taskMaterialId));
    }
    
    return created;
  }

  async updateMaterialConsumption(id: number, consumption: Partial<schema.UpdateMaterialConsumption>): Promise<schema.MaterialConsumption | undefined> {
    const [updated] = await db.update(schema.materialConsumptions)
      .set(consumption)
      .where(eq(schema.materialConsumptions.id, id))
      .returning();
    
    // Recalculate cumulative if quantity changed
    if (consumption.quantity && updated) {
      const consumptions = await this.getMaterialConsumptionsByTaskMaterial(updated.taskMaterialId);
      const total = consumptions.reduce((sum, c) => sum + parseFloat(c.quantity), 0);
      
      await db.update(schema.taskMaterials)
        .set({
          cumulativeConsumption: total.toString(),
          updatedAt: new Date(),
        })
        .where(eq(schema.taskMaterials.id, updated.taskMaterialId));
    }
    
    return updated;
  }

  async deleteMaterialConsumption(id: number): Promise<void> {
    const [consumption] = await db.select().from(schema.materialConsumptions)
      .where(eq(schema.materialConsumptions.id, id));
    
    if (consumption) {
      await db.delete(schema.materialConsumptions).where(eq(schema.materialConsumptions.id, id));
      
      // Recalculate cumulative
      const consumptions = await this.getMaterialConsumptionsByTaskMaterial(consumption.taskMaterialId);
      const total = consumptions.reduce((sum, c) => sum + parseFloat(c.quantity), 0);
      
      await db.update(schema.taskMaterials)
        .set({
          cumulativeConsumption: total.toString(),
          updatedAt: new Date(),
        })
        .where(eq(schema.taskMaterials.id, consumption.taskMaterialId));
    }
  }

  // ==================== Material Deliveries ====================
  async getMaterialDelivery(id: number): Promise<schema.MaterialDelivery | undefined> {
    const [delivery] = await db.select().from(schema.materialDeliveries)
      .where(eq(schema.materialDeliveries.id, id));
    return delivery;
  }

  async getMaterialDeliveriesByTaskMaterial(taskMaterialId: number): Promise<schema.MaterialDelivery[]> {
    return await db.select().from(schema.materialDeliveries)
      .where(eq(schema.materialDeliveries.taskMaterialId, taskMaterialId))
      .orderBy(desc(schema.materialDeliveries.date));
  }

  async createMaterialDelivery(delivery: schema.InsertMaterialDelivery): Promise<schema.MaterialDelivery> {
    const [created] = await db.insert(schema.materialDeliveries).values(delivery).returning();
    return created;
  }

  async updateMaterialDelivery(id: number, delivery: Partial<schema.UpdateMaterialDelivery>): Promise<schema.MaterialDelivery | undefined> {
    const [updated] = await db.update(schema.materialDeliveries)
      .set(delivery)
      .where(eq(schema.materialDeliveries.id, id))
      .returning();
    return updated;
  }

  async deleteMaterialDelivery(id: number): Promise<void> {
    await db.delete(schema.materialDeliveries).where(eq(schema.materialDeliveries.id, id));
  }

  // ==================== Message Reactions ====================
  async getMessageReactions(messageId: number): Promise<schema.MessageReaction[]> {
    return await db.select().from(schema.messageReactions)
      .where(eq(schema.messageReactions.messageId, messageId))
      .orderBy(asc(schema.messageReactions.createdAt));
  }

  async getMessageReactionsByMessageIds(messageIds: number[]): Promise<Map<number, schema.MessageReaction[]>> {
    if (messageIds.length === 0) return new Map();
    
    const reactions = await db.select().from(schema.messageReactions)
      .where(inArray(schema.messageReactions.messageId, messageIds));
    
    const map = new Map<number, schema.MessageReaction[]>();
    reactions.forEach(reaction => {
      if (!map.has(reaction.messageId)) {
        map.set(reaction.messageId, []);
      }
      map.get(reaction.messageId)!.push(reaction);
    });
    
    return map;
  }

  async addMessageReaction(reaction: schema.InsertMessageReaction): Promise<schema.MessageReaction> {
    const [created] = await db.insert(schema.messageReactions)
      .values(reaction)
      .onConflictDoNothing()
      .returning();
    
    if (!created) {
      // Reaction already exists, return existing
      const [existing] = await db.select().from(schema.messageReactions)
        .where(
          and(
            eq(schema.messageReactions.messageId, reaction.messageId),
            eq(schema.messageReactions.userId, reaction.userId),
            eq(schema.messageReactions.emoji, reaction.emoji)
          )
        )
        .limit(1);
      return existing!;
    }
    
    return created;
  }

  async removeMessageReaction(messageId: number, userId: string, emoji: string): Promise<void> {
    await db.delete(schema.messageReactions)
      .where(
        and(
          eq(schema.messageReactions.messageId, messageId),
          eq(schema.messageReactions.userId, userId),
          eq(schema.messageReactions.emoji, emoji)
        )
      );
  }

  async toggleMessageReaction(reaction: schema.InsertMessageReaction): Promise<{ added: boolean; reaction: schema.MessageReaction | null }> {
    // Check if reaction exists
    const [existing] = await db.select().from(schema.messageReactions)
      .where(
        and(
          eq(schema.messageReactions.messageId, reaction.messageId),
          eq(schema.messageReactions.userId, reaction.userId),
          eq(schema.messageReactions.emoji, reaction.emoji)
        )
      )
      .limit(1);
    
    if (existing) {
      // Remove reaction
      await this.removeMessageReaction(reaction.messageId, reaction.userId, reaction.emoji);
      return { added: false, reaction: null };
    } else {
      // Add reaction
      const newReaction = await this.addMessageReaction(reaction);
      return { added: true, reaction: newReaction };
    }
  }

  // ==================== Resource Groups ====================
  async getResourceGroup(id: number): Promise<schema.ResourceGroup | undefined> {
    const [group] = await db.select().from(schema.resourceGroups)
      .where(eq(schema.resourceGroups.id, id));
    return group;
  }

  async getResourceGroupsByProject(projectId: number): Promise<schema.ResourceGroup[]> {
    return await db.select().from(schema.resourceGroups)
      .where(eq(schema.resourceGroups.projectId, projectId))
      .orderBy(asc(schema.resourceGroups.name));
  }

  async createResourceGroup(group: schema.InsertResourceGroup): Promise<schema.ResourceGroup> {
    const [created] = await db.insert(schema.resourceGroups).values({
      ...group,
      updatedAt: new Date(),
    }).returning();
    return created;
  }

  async updateResourceGroup(id: number, group: Partial<schema.UpdateResourceGroup>): Promise<schema.ResourceGroup | undefined> {
    const [updated] = await db.update(schema.resourceGroups)
      .set({ ...group, updatedAt: new Date() })
      .where(eq(schema.resourceGroups.id, id))
      .returning();
    return updated;
  }

  async deleteResourceGroup(id: number): Promise<void> {
    await db.delete(schema.resourceGroups).where(eq(schema.resourceGroups.id, id));
  }

  // ==================== Resource Group Members ====================
  async getResourceGroupMembers(groupId: number): Promise<schema.ResourceGroupMember[]> {
    return await db.select().from(schema.resourceGroupMembers)
      .where(eq(schema.resourceGroupMembers.groupId, groupId));
  }

  async getResourceGroupsByResource(resourceId: number): Promise<schema.ResourceGroup[]> {
    const members = await db.select().from(schema.resourceGroupMembers)
      .where(eq(schema.resourceGroupMembers.resourceId, resourceId));
    
    const groups: schema.ResourceGroup[] = [];
    for (const member of members) {
      const group = await this.getResourceGroup(member.groupId);
      if (group) {
        groups.push(group);
      }
    }
    return groups;
  }

  async addResourceToGroup(groupId: number, resourceId: number): Promise<schema.ResourceGroupMember> {
    const [member] = await db.insert(schema.resourceGroupMembers).values({
      groupId,
      resourceId,
    }).returning();
    return member;
  }

  async removeResourceFromGroup(groupId: number, resourceId: number): Promise<void> {
    await db.delete(schema.resourceGroupMembers)
      .where(
        and(
          eq(schema.resourceGroupMembers.groupId, groupId),
          eq(schema.resourceGroupMembers.resourceId, resourceId)
        )
      );
  }

  // ==================== AI Action Logs ====================
  async getAiActionLog(id: number): Promise<schema.AiActionLog | undefined> {
    const [log] = await db.select().from(schema.aiActionLogs)
      .where(eq(schema.aiActionLogs.id, id));
    return log;
  }

  async getAiActionLogByActionId(actionId: string): Promise<schema.AiActionLog | undefined> {
    const [log] = await db.select().from(schema.aiActionLogs)
      .where(eq(schema.aiActionLogs.actionId, actionId))
      .orderBy(desc(schema.aiActionLogs.createdAt))
      .limit(1);
    return log;
  }

  async getAiActionLogsByUser(userId: string, limit: number = 100): Promise<schema.AiActionLog[]> {
    return await db.select().from(schema.aiActionLogs)
      .where(eq(schema.aiActionLogs.userId, userId))
      .orderBy(desc(schema.aiActionLogs.createdAt))
      .limit(limit);
  }

  async getAiActionLogsByProject(projectId: number, limit: number = 100): Promise<schema.AiActionLog[]> {
    return await db.select().from(schema.aiActionLogs)
      .where(eq(schema.aiActionLogs.projectId, projectId))
      .orderBy(desc(schema.aiActionLogs.createdAt))
      .limit(limit);
  }

  async createAiActionLog(log: schema.InsertAiActionLog): Promise<schema.AiActionLog> {
    const [created] = await db.insert(schema.aiActionLogs).values(log).returning();
    return created;
  }

  async updateAiActionLog(id: number, log: Partial<schema.UpdateAiActionLog>): Promise<schema.AiActionLog | undefined> {
    const [updated] = await db.update(schema.aiActionLogs)
      .set(log)
      .where(eq(schema.aiActionLogs.id, id))
      .returning();
    return updated;
  }

  // ==================== Lessons Learned ====================
  async getLessonLearned(id: number): Promise<schema.LessonLearned | undefined> {
    const [lesson] = await db.select().from(schema.lessonsLearned)
      .where(eq(schema.lessonsLearned.id, id));
    return lesson;
  }

  async getLessonsLearnedByOrganization(organizationId: number): Promise<schema.LessonLearned[]> {
    return await db.select().from(schema.lessonsLearned)
      .where(eq(schema.lessonsLearned.organizationId, organizationId))
      .orderBy(desc(schema.lessonsLearned.createdAt));
  }

  async getLessonsLearnedByProject(projectId: number): Promise<schema.LessonLearned[]> {
    return await db.select().from(schema.lessonsLearned)
      .where(eq(schema.lessonsLearned.projectId, projectId))
      .orderBy(desc(schema.lessonsLearned.createdAt));
  }

  async searchLessonsLearned(organizationId: number, query: string): Promise<schema.LessonLearned[]> {
    // Basic search implementation using ILIKE on title, description, and tags
    // In a production environment, this should be replaced with full-text search or vector search
    return await db.select().from(schema.lessonsLearned)
      .where(
        and(
          eq(schema.lessonsLearned.organizationId, organizationId),
          sql`(
            ${schema.lessonsLearned.title} ILIKE ${`%${query}%`} OR
            ${schema.lessonsLearned.description} ILIKE ${`%${query}%`} OR
            ${schema.lessonsLearned.rootCause} ILIKE ${`%${query}%`} OR
            exists(
              select 1 
              from unnest(${schema.lessonsLearned.tags}) as t 
              where t ILIKE ${`%${query}%`}
            )
          )`
        )
      )
      .orderBy(desc(schema.lessonsLearned.createdAt))
      .limit(20);
  }

  async createLessonLearned(lesson: schema.InsertLessonLearned): Promise<schema.LessonLearned> {
    const [created] = await db.insert(schema.lessonsLearned).values(lesson).returning();
    return created;
  }

  async updateLessonLearned(id: number, lesson: Partial<schema.UpdateLessonLearned>): Promise<schema.LessonLearned | undefined> {
    const [updated] = await db.update(schema.lessonsLearned)
      .set({ ...lesson, updatedAt: new Date() })
      .where(eq(schema.lessonsLearned.id, id))
      .returning();
    return updated;
  }

  async deleteLessonLearned(id: number): Promise<void> {
    await db.delete(schema.lessonsLearned).where(eq(schema.lessonsLearned.id, id));
  }

  async updateAiActionLogByActionId(actionId: string, log: Partial<schema.UpdateAiActionLog>): Promise<schema.AiActionLog | undefined> {
    const [updated] = await db.update(schema.aiActionLogs)
      .set(log)
      .where(eq(schema.aiActionLogs.actionId, actionId))
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
