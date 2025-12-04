import { pgTable, text, serial, integer, boolean, timestamp, varchar, jsonb, pgEnum, unique, index, bigint } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Existing tables
export const users = pgTable("users", {
  id: varchar("id", { length: 100 }).primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  profileImageUrl: text("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  passwordHash: varchar("password_hash", { length: 255 }),
  googleId: varchar("google_id", { length: 255 }),
  emailVerified: boolean("email_verified").default(false),
  emailVerificationToken: varchar("email_verification_token", { length: 255 }),
  emailVerificationExpires: timestamp("email_verification_expires"),
  passwordResetToken: varchar("password_reset_token", { length: 255 }),
  passwordResetExpires: timestamp("password_reset_expires"),
  totpSecret: varchar("totp_secret", { length: 255 }),
  totpEnabled: boolean("totp_enabled").default(false),
  backupCodes: text("backup_codes"),
  lastLoginAt: timestamp("last_login_at"),
  isSystemAdmin: boolean("is_system_admin").default(false),
});

export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  currency: varchar("currency", { length: 10 }),
  logoUrl: text("logo_url"),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 100 }),
  postalCode: varchar("postal_code", { length: 20 }),
  country: varchar("country", { length: 100 }),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 255 }),
  website: varchar("website", { length: 255 }),
  taxId: varchar("tax_id", { length: 100 }),
  registrationNumber: varchar("registration_number", { length: 100 }),
  topLevelEntityLabel: varchar("top_level_entity_label", { length: 50 }).default("Organization"),
  topLevelEntityLabelCustom: varchar("top_level_entity_label_custom", { length: 50 }),
  programEntityLabel: varchar("program_entity_label", { length: 50 }).default("Program"),
  programEntityLabelCustom: varchar("program_entity_label_custom", { length: 50 }),
});

export const userOrganizations = pgTable("user_organizations", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 100 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  organizationId: integer("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  role: text("role").default("member").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const programs = pgTable("programs", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }),
  description: text("description"),
  managerId: varchar("manager_id", { length: 100 }).references(() => users.id),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  status: varchar("status", { length: 20 }).default("active"),
  isVirtual: boolean("is_virtual").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  orgSlugUnique: unique().on(table.organizationId, table.slug),
}));

// Helper for numeric column since Drizzle numeric is string in JS
const numeric = (name: string) => varchar(name, { length: 50 });

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizations.id),
  programId: integer("program_id").references(() => programs.id), // Optional link to program/group
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 50 }).notNull(),
  description: text("description"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  budget: numeric("budget"),
  currency: varchar("currency", { length: 3 }).default("USD"),
  status: varchar("status", { length: 50 }).default("planning"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id),
  parentId: integer("parent_id"), // Self-reference for subtasks
  wbsCode: varchar("wbs_code", { length: 50 }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  assignedTo: varchar("assigned_to", { length: 100 }),
  status: varchar("status", { length: 50 }).default("not-started"),
  priority: varchar("priority", { length: 20 }).default("medium"),
  estimatedHours: numeric("estimated_hours"),
  actualHours: numeric("actual_hours"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  progress: integer("progress").default(0),
  createdBy: varchar("created_by", { length: 100 }), // User ID
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Self-relation for tasks
export const taskRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
  parent: one(tasks, {
    fields: [tasks.parentId],
    references: [tasks.id],
    relationName: "subtasks",
  }),
  children: many(tasks, {
    relationName: "subtasks",
  }),
}));

export const risks = pgTable("risks", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id),
  code: varchar("code", { length: 50 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }),
  status: varchar("status", { length: 50 }).default("identified"),
  probability: integer("probability").default(3), // 1-5
  impact: varchar("impact", { length: 20 }).default("medium"),
  mitigationPlan: text("mitigation_plan"),
  owner: varchar("owner", { length: 100 }),
  identifiedDate: timestamp("identified_date").defaultNow(),
  closedDate: timestamp("closed_date"),
});

export const issues = pgTable("issues", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id),
  code: varchar("code", { length: 50 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 50 }).default("open"),
  priority: varchar("priority", { length: 20 }).default("medium"),
  category: varchar("category", { length: 100 }),
  assignedTo: varchar("assigned_to", { length: 100 }),
  reportedBy: varchar("reported_by", { length: 100 }),
  reportedDate: timestamp("reported_date").defaultNow(),
  resolvedDate: timestamp("resolved_date"),
  resolution: text("resolution"),
  issueType: varchar("issue_type", { length: 50 }).default("standard"), // 'standard', 'ncr', 'hse', etc.
});

export const stakeholders = pgTable("stakeholders", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id),
  name: varchar("name", { length: 100 }).notNull(),
  role: varchar("role", { length: 100 }),
  organization: varchar("organization", { length: 100 }),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  influence: varchar("influence", { length: 20 }).default("medium"),
  interest: varchar("interest", { length: 20 }).default("medium"),
  notes: text("notes"),
  // Communication Intelligence Fields
  communicationStyle: varchar("communication_style", { length: 50 }), // 'direct', 'diplomatic', 'detailed', 'brief'
  preferredChannel: varchar("preferred_channel", { length: 50 }), // 'email', 'chat', 'phone', 'meeting'
  updateFrequency: varchar("update_frequency", { length: 50 }), // 'daily', 'weekly', 'bi-weekly', 'milestone-only'
  engagementLevel: integer("engagement_level"), // 1-5 (Manual or calculated)
  lastInteractionDate: timestamp("last_interaction_date"), // Auto-updated from messages/comments
});

export const costItems = pgTable("cost_items", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id),
  category: varchar("category", { length: 100 }).notNull(),
  description: varchar("description", { length: 255 }).notNull(),
  budgeted: numeric("budgeted").notNull(),
  actual: numeric("actual").default("0"),
  variance: numeric("variance").default("0"), // Calculated
});

// Communication Intelligence System
export const communicationMetrics = pgTable("communication_metrics", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  stakeholderId: integer("stakeholder_id").references(() => stakeholders.id, { onDelete: "cascade" }),
  userId: integer("user_id"), // For internal team members (no FK due to users.id type mismatch)
  
  // Core Metrics
  responseTimeAvg: integer("response_time_avg"), // Average response time in minutes
  overdueCount: integer("overdue_count").default(0), // Unanswered critical messages
  messageCount: integer("message_count").default(0), // Total messages sent/received
  escalationCount: integer("escalation_count").default(0), // Number of escalations
  
  // Health Status
  healthStatus: varchar("health_status", { length: 20 }).default("healthy"), // 'healthy', 'at-risk', 'critical'
  healthScore: integer("health_score").default(100), // 0-100 calculated score
  
  // Timestamps
  lastInteractionDate: timestamp("last_interaction_date"),
  lastResponseDate: timestamp("last_response_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  projectStakeholderIdx: index("comm_metrics_project_stakeholder_idx").on(table.projectId, table.stakeholderId),
  projectUserIdx: index("comm_metrics_project_user_idx").on(table.projectId, table.userId),
}));

// Resources tables
export const resourceGroups = pgTable("resource_groups", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  parentId: integer("parent_id"), // For hierarchy
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Resource Pricing Tiers
export const resourcePricingTiers = pgTable("resource_pricing_tiers", {
  id: serial("id").primaryKey(),
  resourceId: integer("resource_id").notNull(), // Will add reference after resources table defined
  name: varchar("name", { length: 100 }).notNull(), // e.g., "Standard", "Overtime", "Weekend"
  rate: numeric("rate").notNull(),
  currency: varchar("currency", { length: 3 }).default("USD"),
  multiplier: numeric("multiplier").default("1.0"), // For calculating from base rate
  effectiveDate: timestamp("effective_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const resources = pgTable("resources", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id), // Should be organizationId in improved model but sticking to project based on current flow
  groupId: integer("group_id").references(() => resourceGroups.id),
  name: varchar("name", { length: 100 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(), // 'labor', 'equipment', 'material'
  status: varchar("status", { length: 50 }).default("active"),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  
  // Availability
  calendarId: integer("calendar_id"), // Reference to calendar table (future)
  availability: numeric("availability").default("100"), // % availability
  
  // Costing
  costType: varchar("cost_type", { length: 50 }).default("hourly"), // 'hourly', 'fixed', 'unit'
  baseRate: numeric("base_rate"),
  currency: varchar("currency", { length: 3 }).default("USD"),
  
  // Material specific
  unit: varchar("unit", { length: 20 }), // e.g., 'm3', 'kg', 'each'
  
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Add foreign key for resourcePricingTiers
export const resourcePricingTiersRelations = relations(resourcePricingTiers, ({ one }) => ({
  resource: one(resources, {
    fields: [resourcePricingTiers.resourceId],
    references: [resources.id],
  }),
}));

export const resourceAssignments = pgTable("resource_assignments", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  resourceId: integer("resource_id").notNull().references(() => resources.id),
  allocation: integer("allocation").default(100), // Percentage
  effortHours: numeric("effort_hours"), // Planned effort for this resource on this task
  cost: numeric("cost"), // Calculated cost
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Tags System
export const tags = pgTable("tags", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  category: varchar("category", { length: 50 }), // e.g., "Project Type", "Risk Area", "Discipline"
  color: varchar("color", { length: 20 }).default("#007bff"), // Hex color for UI
  description: text("description"),
  usageCount: integer("usage_count").default(0).notNull(), // How many times this tag is assigned
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  orgNameUnique: unique("tags_org_name_unique").on(table.organizationId, table.name),
  orgCategoryIdx: index("tags_org_category_idx").on(table.organizationId, table.category),
}));

export const tagEntityTypeEnum = pgEnum("tag_entity_type", [
  "organization", "program", "project", "task", "risk", "issue", "document", "resource", "contact", "lesson"
]);

export const tagAssignments = pgTable("tag_assignments", {
  id: serial("id").primaryKey(),
  tagId: integer("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
  entityType: tagEntityTypeEnum("entity_type").notNull(),
  entityId: integer("entity_id").notNull(), // ID of the assigned entity (project, task, etc.)
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  tagEntityUnique: unique("tag_assignments_unique").on(table.tagId, table.entityType, table.entityId),
  entityIdx: index("tag_assignments_entity_idx").on(table.entityType, table.entityId),
}));

// Lessons Learned System
export const lessonsLearned = pgTable("lessons_learned", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  projectId: integer("project_id").references(() => projects.id), // Optional link to specific project
  issueId: integer("issue_id").references(() => issues.id), // Optional link to source issue
  riskId: integer("risk_id").references(() => risks.id), // Optional link to source risk
  
  category: varchar("category", { length: 50 }).notNull(), // e.g., "Procurement", "Safety", "Quality", "Schedule"
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(), // The "Situation" / "Context"
  rootCause: text("root_cause"), // "Why it happened"
  actionTaken: text("action_taken"), // "What we did"
  outcome: text("outcome"), // "Result"
  
  impactRating: integer("impact_rating").default(1), // 1-5 (1: Low, 5: Critical)
  
  // Metadata for applicability
  applicability: varchar("applicability", { length: 50 }).default("global"), // 'global', 'project_specific', 'department'
  
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Documents table (schema placeholder – align with actual DB structure)
export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 50 }),
  fileUrl: text("file_url"),
  fileType: varchar("file_type", { length: 50 }),
  sizeBytes: integer("size_bytes"),
  uploadedBy: varchar("uploaded_by", { length: 100 }).references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Notification rules (schema placeholder – align with actual DB structure)
export const notificationRules = pgTable("notification_rules", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 150 }).notNull(),
  description: text("description"),
  eventType: varchar("event_type", { length: 50 }), // e.g., "task-overdue"
  condition: jsonb("condition"),
  recipients: jsonb("recipients").$type<number[]>().default([]),
  channel: varchar("channel", { length: 20 }).default("email"),
  enabled: boolean("enabled").default(true),
  createdBy: varchar("created_by", { length: 100 }).references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Push notification subscriptions for PWA
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 100 }).references(() => users.id, { onDelete: "cascade" }).notNull(),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(), // Public key
  auth: text("auth").notNull(), // Auth secret
  enabled: boolean("enabled").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// --- New Tables for Admin Dashboard & Subscription System ---

export const subscriptionPlans = pgTable("subscription_plans", {
  id: serial("id").primaryKey(),
  tier: varchar("tier", { length: 50 }).notNull().unique(), // free, pro, enterprise
  name: varchar("name", { length: 100 }).notNull(),
  priceMonthly: integer("price_monthly"), // In cents
  priceYearly: integer("price_yearly"), // In cents
  currency: varchar("currency", { length: 3 }).default("USD"),
  storageQuotaBytes: bigint("storage_quota_bytes", { mode: "number" }),
  aiTokenLimit: integer("ai_token_limit"),
  projectLimit: integer("project_limit"),
  userLimit: integer("user_limit"),
  features: jsonb("features"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const organizationSubscriptions = pgTable("organization_subscriptions", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  planId: integer("plan_id").notNull().references(() => subscriptionPlans.id),
  status: varchar("status", { length: 50 }).default("active"), // active, cancelled, past_due
  startDate: timestamp("start_date").defaultNow(),
  endDate: timestamp("end_date"),
  autoRenew: boolean("auto_renew").default(true),
  paymentMethodId: varchar("payment_method_id", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const aiUsageSummary = pgTable("ai_usage_summary", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  month: varchar("month", { length: 7 }).notNull(), // YYYY-MM
  tokensUsed: integer("tokens_used").default(0).notNull(),
  requestCount: integer("request_count").default(0).notNull(),
  tokenLimit: integer("token_limit"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  orgMonthUnique: unique("ai_usage_org_month_unique").on(table.organizationId, table.month),
}));

export const cloudStorageConnections = pgTable("cloud_storage_connections", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  provider: varchar("provider", { length: 50 }).notNull(), // 'google-drive', 'dropbox', 'onedrive'
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at"),
  syncStatus: varchar("sync_status", { length: 50 }).default("inactive"), // 'active', 'syncing', 'error', 'inactive'
  lastSyncAt: timestamp("last_sync_at"),
  syncError: text("sync_error"),
  connectedBy: varchar("connected_by", { length: 100 }).references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  orgProviderUnique: unique("cloud_storage_org_provider_unique").on(table.organizationId, table.provider),
}));

export const cloudSyncedFiles = pgTable("cloud_synced_files", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "cascade" }),
  connectionId: integer("connection_id").references(() => cloudStorageConnections.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  cloudFileId: varchar("cloud_file_id", { length: 255 }).notNull(),
  cloudFilePath: text("cloud_file_path"),
  fileType: varchar("file_type", { length: 50 }),
  sizeBytes: bigint("size_bytes", { mode: "number" }),
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Custom Dashboard Layouts (Epic 16: Advanced Features)
export const customDashboards = pgTable("custom_dashboards", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 100 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "cascade" }), // null = global dashboard
  name: varchar("name", { length: 100 }).notNull(),
  layout: jsonb("layout").notNull(), // Array of widget configurations with positions
  isDefault: boolean("is_default").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  userProjectUnique: unique("custom_dashboards_user_project_unique").on(table.userId, table.projectId),
}));

// Zod Schemas
export const insertUserSchema = createInsertSchema(users);
export const insertProjectSchema = createInsertSchema(projects);
export const insertTaskSchema = createInsertSchema(tasks);
export const insertRiskSchema = createInsertSchema(risks);
export const insertIssueSchema = createInsertSchema(issues);
export const insertStakeholderSchema = createInsertSchema(stakeholders);
export const insertCostItemSchema = createInsertSchema(costItems);
export const insertOrganizationSchema = createInsertSchema(organizations);
export const insertProgramSchema = createInsertSchema(programs);
export const insertResourceSchema = createInsertSchema(resources);
export const insertDocumentSchema = createInsertSchema(documents);
export const insertNotificationRuleSchema = createInsertSchema(notificationRules);

// Tags Zod Schemas
export const insertTagSchema = createInsertSchema(tags).omit({ 
  id: true, 
  usageCount: true, 
  createdAt: true, 
  updatedAt: true 
});
export const updateTagSchema = insertTagSchema.partial();
export const insertTagAssignmentSchema = createInsertSchema(tagAssignments).omit({ 
  id: true, 
  createdAt: true 
});

// Lessons Learned Zod Schemas
export const insertLessonLearnedSchema = createInsertSchema(lessonsLearned).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
export const updateLessonLearnedSchema = insertLessonLearnedSchema.partial();

// Communication Metrics Zod Schemas
export const insertCommunicationMetricsSchema = createInsertSchema(communicationMetrics).omit({
  id: true, 
  createdAt: true, 
  updatedAt: true
});
export const updateCommunicationMetricsSchema = insertCommunicationMetricsSchema.partial();

// New Schemas
export const insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlans);
export const insertOrganizationSubscriptionSchema = createInsertSchema(organizationSubscriptions);
export const insertAiUsageSummarySchema = createInsertSchema(aiUsageSummary);
export const insertCloudStorageConnectionSchema = createInsertSchema(cloudStorageConnections);
export const insertCloudSyncedFileSchema = createInsertSchema(cloudSyncedFiles);
export const insertCustomDashboardSchema = createInsertSchema(customDashboards);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type UserOrganization = typeof userOrganizations.$inferSelect;
export type InsertUserOrganization = typeof userOrganizations.$inferInsert;
export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = typeof organizations.$inferInsert;
export type Program = typeof programs.$inferSelect;
export type InsertProgram = typeof programs.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;
export type Risk = typeof risks.$inferSelect;
export type InsertRisk = typeof risks.$inferInsert;
export type Issue = typeof issues.$inferSelect;
export type InsertIssue = typeof issues.$inferInsert;
export type Stakeholder = typeof stakeholders.$inferSelect;
export type InsertStakeholder = typeof stakeholders.$inferInsert;
export type CostItem = typeof costItems.$inferSelect;
export type InsertCostItem = typeof costItems.$inferInsert;
export type Resource = typeof resources.$inferSelect;
export type InsertResource = typeof resources.$inferInsert;
export type ResourceAssignment = typeof resourceAssignments.$inferSelect;

// Tags Types
export type Tag = typeof tags.$inferSelect;
export type InsertTag = z.infer<typeof insertTagSchema>;
export type UpdateTag = z.infer<typeof updateTagSchema>;
export type TagAssignment = typeof tagAssignments.$inferSelect;
export type InsertTagAssignment = z.infer<typeof insertTagAssignmentSchema>;
export type TagEntityType = "organization" | "program" | "project" | "task" | "risk" | "issue" | "document" | "resource" | "contact" | "lesson";

// Lessons Learned Types
export type LessonLearned = typeof lessonsLearned.$inferSelect;
export type InsertLessonLearned = z.infer<typeof insertLessonLearnedSchema>;
export type UpdateLessonLearned = z.infer<typeof updateLessonLearnedSchema>;

// Communication Metrics Types
export type CommunicationMetrics = typeof communicationMetrics.$inferSelect;
export type InsertCommunicationMetrics = z.infer<typeof insertCommunicationMetricsSchema>;
export type UpdateCommunicationMetrics = z.infer<typeof updateCommunicationMetricsSchema>;

// Document Types
export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;

// Notification Rule Types
export type NotificationRule = typeof notificationRules.$inferSelect;
export type InsertNotificationRule = typeof notificationRules.$inferInsert;

// Push Subscription Types
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type InsertPushSubscription = typeof pushSubscriptions.$inferInsert;

// New Types
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type InsertSubscriptionPlan = typeof subscriptionPlans.$inferInsert;
export type OrganizationSubscription = typeof organizationSubscriptions.$inferSelect;
export type InsertOrganizationSubscription = typeof organizationSubscriptions.$inferInsert;
export type AiUsageSummary = typeof aiUsageSummary.$inferSelect;
export type CloudStorageConnection = typeof cloudStorageConnections.$inferSelect;
export type InsertCloudStorageConnection = typeof cloudStorageConnections.$inferInsert;
export type CloudSyncedFile = typeof cloudSyncedFiles.$inferSelect;
export type InsertCloudSyncedFile = typeof cloudSyncedFiles.$inferInsert;
export type CustomDashboard = typeof customDashboards.$inferSelect;
export type InsertCustomDashboard = typeof customDashboards.$inferInsert;
