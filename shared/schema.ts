import { pgTable, text, serial, integer, boolean, timestamp, varchar, jsonb, pgEnum, unique, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Existing tables
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: text("password").notNull(),
  fullName: varchar("full_name", { length: 100 }).notNull(),
  role: varchar("role", { length: 50 }).default("user").notNull(),
  organizationId: integer("organization_id"), // Will be foreign key after organizations table defined
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  ownerId: integer("owner_id").notNull().references(() => users.id),
  logoUrl: text("logo_url"), // URL to stored logo image
  topLevelEntityLabel: varchar("top_level_entity_label", { length: 50 }).default("Organization"),
  programEntityLabel: varchar("program_entity_label", { length: 50 }).default("Program"),
  topLevelEntityLabelCustom: varchar("top_level_entity_label_custom", { length: 50 }),
  programEntityLabelCustom: varchar("program_entity_label_custom", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Add self-reference to users table for organizationId
// Note: Circular dependency resolution usually handled at runtime or by altering table later
// For this schema definition, we'll just assume the field exists on users.

export const programs = pgTable("programs", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  managerId: integer("manager_id").references(() => users.id),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  status: varchar("status", { length: 20 }).default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

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

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
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
