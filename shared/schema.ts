import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, decimal, boolean, serial, pgEnum, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const taskStatusEnum = pgEnum("task_status", ["not-started", "in-progress", "review", "completed", "on-hold"]);
export const taskPriorityEnum = pgEnum("task_priority", ["low", "medium", "high", "critical"]);
export const dependencyTypeEnum = pgEnum("dependency_type", ["FS", "SS", "FF", "SF"]); // Finish-Start, Start-Start, Finish-Finish, Start-Finish
export const riskStatusEnum = pgEnum("risk_status", ["identified", "assessed", "mitigating", "closed"]);
export const riskImpactEnum = pgEnum("risk_impact", ["low", "medium", "high", "critical"]);
export const issueStatusEnum = pgEnum("issue_status", ["open", "in-progress", "resolved", "closed"]);
export const issuePriorityEnum = pgEnum("issue_priority", ["low", "medium", "high", "critical"]);
export const changeRequestStatusEnum = pgEnum("change_request_status", ["submitted", "under-review", "approved", "rejected", "implemented"]);
export const stakeholderRoleEnum = pgEnum("stakeholder_role", ["sponsor", "client", "team-member", "contractor", "consultant", "other"]);

// Organizations (Multi-tenant root)
export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: text("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => ({
    expireIdx: index("IDX_session_expire").on(table.expire),
  })
);

// Users (Replit Auth compatible)
export const users = pgTable("users", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`), // Replit Auth user ID
  email: varchar("email", { length: 255 }).unique(),
  firstName: varchar("first_name", { length: 255 }),
  lastName: varchar("last_name", { length: 255 }),
  profileImageUrl: varchar("profile_image_url", { length: 512 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// User-Organization relationship (many-to-many)
export const userOrganizations = pgTable("user_organizations", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  organizationId: integer("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"), // owner, admin, member, viewer
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Projects
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  code: varchar("code", { length: 50 }).notNull(), // Project code like "PRJ-001"
  status: text("status").notNull().default("active"), // active, on-hold, completed, cancelled
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  budget: decimal("budget", { precision: 15, scale: 2 }),
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Tasks (WBS items with hierarchy support)
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  parentId: integer("parent_id"), // Self-referencing for hierarchy
  wbsCode: varchar("wbs_code", { length: 50 }).notNull(), // e.g., "1.2.3.4.5"
  name: text("name").notNull(),
  description: text("description"),
  status: taskStatusEnum("status").notNull().default("not-started"),
  priority: taskPriorityEnum("priority").notNull().default("medium"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  estimatedHours: decimal("estimated_hours", { precision: 10, scale: 2 }),
  actualHours: decimal("actual_hours", { precision: 10, scale: 2 }),
  progress: integer("progress").notNull().default(0), // 0-100
  assignedTo: varchar("assigned_to", { length: 255 }).references(() => users.id),
  createdBy: varchar("created_by", { length: 255 }).notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Task Dependencies
export const taskDependencies = pgTable("task_dependencies", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  predecessorId: integer("predecessor_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  successorId: integer("successor_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  type: dependencyTypeEnum("type").notNull().default("FS"),
  lagDays: integer("lag_days").notNull().default(0), // Can be negative for lead time
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Stakeholders
export const stakeholders = pgTable("stakeholders", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  organization: text("organization"),
  role: stakeholderRoleEnum("role").notNull().default("other"),
  influence: integer("influence").notNull().default(3), // 1-5 scale
  interest: integer("interest").notNull().default(3), // 1-5 scale
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Risks
export const risks = pgTable("risks", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  code: varchar("code", { length: 50 }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category"), // technical, financial, schedule, resource, etc.
  status: riskStatusEnum("status").notNull().default("identified"),
  probability: integer("probability").notNull().default(3), // 1-5 scale
  impact: riskImpactEnum("impact").notNull().default("medium"),
  mitigationPlan: text("mitigation_plan"),
  owner: varchar("owner", { length: 255 }).references(() => users.id),
  identifiedDate: timestamp("identified_date").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueCodePerProject: unique("risks_project_code_unique").on(table.projectId, table.code),
}));

// Issues
export const issues = pgTable("issues", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  code: varchar("code", { length: 50 }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  status: issueStatusEnum("status").notNull().default("open"),
  priority: issuePriorityEnum("priority").notNull().default("medium"),
  category: text("category"),
  assignedTo: varchar("assigned_to", { length: 255 }).references(() => users.id),
  reportedBy: varchar("reported_by", { length: 255 }).notNull().references(() => users.id),
  reportedDate: timestamp("reported_date").defaultNow().notNull(),
  resolvedDate: timestamp("resolved_date"),
  resolution: text("resolution"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueCodePerProject: unique("issues_project_code_unique").on(table.projectId, table.code),
}));

// Change Requests
export const changeRequests = pgTable("change_requests", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  code: varchar("code", { length: 50 }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  justification: text("justification"),
  status: changeRequestStatusEnum("status").notNull().default("submitted"),
  requestedBy: varchar("requested_by", { length: 255 }).notNull().references(() => users.id),
  reviewedBy: varchar("reviewed_by", { length: 255 }).references(() => users.id),
  impactAssessment: text("impact_assessment"),
  costImpact: decimal("cost_impact", { precision: 15, scale: 2 }),
  scheduleImpact: integer("schedule_impact_days"),
  submittedDate: timestamp("submitted_date").defaultNow().notNull(),
  reviewedDate: timestamp("reviewed_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Cost Items (for cost tracking and analytics)
export const costItems = pgTable("cost_items", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  taskId: integer("task_id").references(() => tasks.id, { onDelete: "set null" }),
  category: text("category").notNull(), // labor, materials, equipment, subcontractor, overhead
  description: text("description").notNull(),
  budgeted: decimal("budgeted", { precision: 15, scale: 2 }).notNull(),
  actual: decimal("actual", { precision: 15, scale: 2 }).notNull().default("0"),
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),
  date: timestamp("date").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Resources
export const resources = pgTable("resources", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(), // human, equipment, material
  availability: integer("availability").notNull().default(100), // percentage
  costPerHour: decimal("cost_per_hour", { precision: 10, scale: 2 }),
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Resource Assignments
export const resourceAssignments = pgTable("resource_assignments", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  resourceId: integer("resource_id").notNull().references(() => resources.id, { onDelete: "cascade" }),
  allocation: integer("allocation").notNull().default(100), // percentage
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Google Account Connections (for user's own Google integrations)
export const googleConnections = pgTable("google_connections", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  scope: text("scope").notNull(), // Space-separated scopes
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// AI Conversations
export const aiConversations = pgTable("ai_conversations", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "cascade" }),
  title: text("title"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// AI Messages
export const aiMessages = pgTable("ai_messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => aiConversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // user, assistant, system
  content: text("content").notNull(),
  functionCall: text("function_call"), // JSON string of function call if any
  tokensUsed: integer("tokens_used").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// AI Usage Tracking
export const aiUsage = pgTable("ai_usage", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  organizationId: integer("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
  tokensUsed: integer("tokens_used").notNull(),
  model: text("model").notNull(),
  operation: text("operation").notNull(), // chat, analysis, report-generation, etc.
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Zod Schemas for Organizations
export const insertOrganizationSchema = createInsertSchema(organizations).omit({ id: true, createdAt: true, updatedAt: true });
export const selectOrganizationSchema = createSelectSchema(organizations);
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = typeof organizations.$inferSelect;

// Zod Schemas for Users
export const insertUserSchema = createInsertSchema(users).omit({ createdAt: true, updatedAt: true });
export const upsertUserSchema = createInsertSchema(users).omit({ createdAt: true, updatedAt: true });
export const selectUserSchema = createSelectSchema(users);
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpsertUser = z.infer<typeof upsertUserSchema>;
export type User = typeof users.$inferSelect;

// Zod Schemas for User Organizations
export const insertUserOrganizationSchema = createInsertSchema(userOrganizations).omit({ id: true, createdAt: true });
export const selectUserOrganizationSchema = createSelectSchema(userOrganizations);
export type InsertUserOrganization = z.infer<typeof insertUserOrganizationSchema>;
export type UserOrganization = typeof userOrganizations.$inferSelect;

// Zod Schemas for Projects
export const insertProjectSchema = createInsertSchema(projects).omit({ id: true, createdAt: true, updatedAt: true });
export const updateProjectSchema = insertProjectSchema.partial();
export const selectProjectSchema = createSelectSchema(projects);
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type UpdateProject = z.infer<typeof updateProjectSchema>;
export type Project = typeof projects.$inferSelect;

// Zod Schemas for Tasks
export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true, createdAt: true, updatedAt: true });
export const updateTaskSchema = insertTaskSchema.partial();
export const selectTaskSchema = createSelectSchema(tasks);
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type UpdateTask = z.infer<typeof updateTaskSchema>;
export type Task = typeof tasks.$inferSelect;

// Zod Schemas for Task Dependencies
export const insertTaskDependencySchema = createInsertSchema(taskDependencies).omit({ id: true, createdAt: true });
export const selectTaskDependencySchema = createSelectSchema(taskDependencies);
export type InsertTaskDependency = z.infer<typeof insertTaskDependencySchema>;
export type TaskDependency = typeof taskDependencies.$inferSelect;

// Zod Schemas for Stakeholders
export const insertStakeholderSchema = createInsertSchema(stakeholders).omit({ id: true, createdAt: true, updatedAt: true });
export const updateStakeholderSchema = insertStakeholderSchema.partial();
export const selectStakeholderSchema = createSelectSchema(stakeholders);
export type InsertStakeholder = z.infer<typeof insertStakeholderSchema>;
export type UpdateStakeholder = z.infer<typeof updateStakeholderSchema>;
export type Stakeholder = typeof stakeholders.$inferSelect;

// Zod Schemas for Risks
export const insertRiskSchema = createInsertSchema(risks).omit({ id: true, createdAt: true, updatedAt: true, code: true }).extend({
  code: z.string().optional(), // Auto-generated if not provided
});
export const updateRiskSchema = insertRiskSchema.partial();
export const selectRiskSchema = createSelectSchema(risks);
export type InsertRisk = z.infer<typeof insertRiskSchema>;
export type UpdateRisk = z.infer<typeof updateRiskSchema>;
export type Risk = typeof risks.$inferSelect;

// Zod Schemas for Issues
export const insertIssueSchema = createInsertSchema(issues).omit({ id: true, createdAt: true, updatedAt: true, code: true, reportedBy: true }).extend({
  code: z.string().optional(), // Auto-generated if not provided
  reportedBy: z.string().optional(), // Auto-set to current user if not provided
});
export const updateIssueSchema = insertIssueSchema.partial();
export const selectIssueSchema = createSelectSchema(issues);
export type InsertIssue = z.infer<typeof insertIssueSchema>;
export type UpdateIssue = z.infer<typeof updateIssueSchema>;
export type Issue = typeof issues.$inferSelect;

// Zod Schemas for Change Requests
export const insertChangeRequestSchema = createInsertSchema(changeRequests).omit({ id: true, createdAt: true, updatedAt: true });
export const selectChangeRequestSchema = createSelectSchema(changeRequests);
export type InsertChangeRequest = z.infer<typeof insertChangeRequestSchema>;
export type ChangeRequest = typeof changeRequests.$inferSelect;

// Zod Schemas for Cost Items
export const insertCostItemSchema = createInsertSchema(costItems).omit({ id: true, createdAt: true, updatedAt: true });
export const updateCostItemSchema = insertCostItemSchema.partial();
export const selectCostItemSchema = createSelectSchema(costItems);
export type InsertCostItem = z.infer<typeof insertCostItemSchema>;
export type UpdateCostItem = z.infer<typeof updateCostItemSchema>;
export type CostItem = typeof costItems.$inferSelect;

// Zod Schemas for Resources
export const insertResourceSchema = createInsertSchema(resources).omit({ id: true, createdAt: true, updatedAt: true });
export const selectResourceSchema = createSelectSchema(resources);
export type InsertResource = z.infer<typeof insertResourceSchema>;
export type Resource = typeof resources.$inferSelect;

// Zod Schemas for Resource Assignments
export const insertResourceAssignmentSchema = createInsertSchema(resourceAssignments).omit({ id: true, createdAt: true });
export const selectResourceAssignmentSchema = createSelectSchema(resourceAssignments);
export type InsertResourceAssignment = z.infer<typeof insertResourceAssignmentSchema>;
export type ResourceAssignment = typeof resourceAssignments.$inferSelect;

// Zod Schemas for Google Connections
export const insertGoogleConnectionSchema = createInsertSchema(googleConnections).omit({ id: true, createdAt: true, updatedAt: true });
export const selectGoogleConnectionSchema = createSelectSchema(googleConnections);
export type InsertGoogleConnection = z.infer<typeof insertGoogleConnectionSchema>;
export type GoogleConnection = typeof googleConnections.$inferSelect;

// Zod Schemas for AI Conversations
export const insertAiConversationSchema = createInsertSchema(aiConversations).omit({ id: true, createdAt: true, updatedAt: true });
export const selectAiConversationSchema = createSelectSchema(aiConversations);
export type InsertAiConversation = z.infer<typeof insertAiConversationSchema>;
export type AiConversation = typeof aiConversations.$inferSelect;

// Zod Schemas for AI Messages
export const insertAiMessageSchema = createInsertSchema(aiMessages).omit({ id: true, createdAt: true });
export const selectAiMessageSchema = createSelectSchema(aiMessages);
export type InsertAiMessage = z.infer<typeof insertAiMessageSchema>;
export type AiMessage = typeof aiMessages.$inferSelect;

// Zod Schemas for AI Usage
export const insertAiUsageSchema = createInsertSchema(aiUsage).omit({ id: true, createdAt: true });
export const selectAiUsageSchema = createSelectSchema(aiUsage);
export type InsertAiUsage = z.infer<typeof insertAiUsageSchema>;
export type AiUsage = typeof aiUsage.$inferSelect;
