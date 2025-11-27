import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, decimal, boolean, serial, pgEnum, index, unique, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const taskStatusEnum = pgEnum("task_status", ["not-started", "in-progress", "review", "completed", "on-hold"]);
export const taskPriorityEnum = pgEnum("task_priority", ["low", "medium", "high", "critical"]);
export const dependencyTypeEnum = pgEnum("dependency_type", ["FS", "SS", "FF", "SF"]); // Finish-Start, Start-Start, Finish-Finish, Start-Finish
export const workModeEnum = pgEnum("work_mode", ["parallel", "sequential"]); // How multiple resources work together
export const riskStatusEnum = pgEnum("risk_status", ["identified", "assessed", "mitigating", "closed"]);
export const riskImpactEnum = pgEnum("risk_impact", ["low", "medium", "high", "critical"]);
export const issueStatusEnum = pgEnum("issue_status", ["open", "in-progress", "resolved", "closed"]);
export const issuePriorityEnum = pgEnum("issue_priority", ["low", "medium", "high", "critical"]);
export const changeRequestStatusEnum = pgEnum("change_request_status", ["submitted", "under-review", "approved", "rejected", "implemented"]);
export const stakeholderRoleEnum = pgEnum("stakeholder_role", ["sponsor", "client", "team-member", "contractor", "consultant", "other"]);

// EPC-Specific Enums
export const disciplineEnum = pgEnum("discipline", [
  "civil", "structural", "mechanical", "electrical", "piping",
  "instrumentation", "process", "hvac", "architectural", "general"
]);
export const constraintTypeEnum = pgEnum("constraint_type", [
  "asap", "alap", "snet", "snlt", "fnet", "fnlt", "mso", "mfo"
]); // As Soon/Late As Possible, Start/Finish No Earlier/Later Than, Must Start/Finish On
export const riskResponseEnum = pgEnum("risk_response", ["avoid", "transfer", "mitigate", "accept", "escalate"]);
export const riskCategoryEnum = pgEnum("risk_category", [
  "technical", "external", "organizational", "project-management",
  "commercial", "hse", "quality", "schedule", "resource"
]);
export const issueTypeEnum = pgEnum("issue_type", [
  "design", "procurement", "construction", "commissioning",
  "hse", "quality", "commercial", "interface", "resource"
]);
export const escalationLevelEnum = pgEnum("escalation_level", ["project", "program", "executive", "client"]);
export const rootCauseCategoryEnum = pgEnum("root_cause_category", [
  "design-error", "material-defect", "workmanship", "equipment-failure",
  "communication", "planning", "external-factors", "unknown"
]);
export const stakeholderRoleEpcEnum = pgEnum("stakeholder_role_epc", [
  "client-owner", "pmc", "feed-contractor", "epc-contractor", "epcm-contractor",
  "subcontractor-civil", "subcontractor-mechanical", "subcontractor-electrical",
  "equipment-vendor", "bulk-supplier", "tpi", "certification-body",
  "regulatory-authority", "lenders-engineer", "insurance-surveyor", "consultant", "other"
]);
export const communicationPreferenceEnum = pgEnum("communication_preference", ["email", "phone", "meeting", "portal"]);
export const authorityLevelEnum = pgEnum("authority_level", ["decision-maker", "influencer", "advisor", "informed"]);

// RACI Matrix Enum (Responsible, Accountable, Consulted, Informed)
export const raciTypeEnum = pgEnum("raci_type", ["R", "A", "C", "I"]);

// Document Control Enums
export const documentTypeEnum = pgEnum("document_type", [
  // Technical
  "drawing", "specification", "datasheet", "calculation", "report",
  // Procedures
  "sop", "procedure", "work-instruction", "checklist",
  // Commercial
  "invoice", "rfp", "contract", "purchase-order", "quote",
  // Vendor
  "vendor-doc", "certificate", "warranty",
  // Project
  "lessons-learned", "bulletin", "meeting-minutes", "transmittal",
  // Correspondence
  "correspondence", "rfi", "ncr",
  // Other
  "other"
]);
export const documentStatusEnum = pgEnum("document_status", ["draft", "ifa", "ifc", "as-built", "superseded", "cancelled"]);
export const transmittalStatusEnum = pgEnum("transmittal_status", ["issued", "acknowledged", "responded", "closed"]);
export const rfiStatusEnum = pgEnum("rfi_status", ["open", "pending-response", "responded", "closed", "void"]);
export const punchCategoryEnum = pgEnum("punch_category", ["a", "b", "c"]); // A=Safety/Critical, B=Required before handover, C=Minor
export const punchStatusEnum = pgEnum("punch_status", ["open", "in-progress", "completed", "verified", "rejected"]);

// Daily Report Enums
export const weatherConditionEnum = pgEnum("weather_condition", ["clear", "cloudy", "rain", "storm", "wind", "hot", "cold"]);
export const resourceTypeEnum = pgEnum("resource_type", ["human", "equipment", "material", "subcontractor"]);

// Resource Pricing Enums
export const rateTypeEnum = pgEnum("rate_type", ["per-hour", "per-use", "per-unit"]);
export const unitTypeEnum = pgEnum("unit_type", [
  "ea", "lot", "hr", "day", "week", "month",
  "m", "ft", "yd", "km", "mi",
  "m2", "ft2", "m3", "ft3",
  "kg", "lb", "ton", "mt",
  "l", "gal", "scm", "scf"
]);
export const contractTypeEnum = pgEnum("contract_type", [
  "full-time", "part-time", "contract", "temporary", "rental", "purchase", "lease"
]);
export const availabilityStatusEnum = pgEnum("availability_status", ["available", "partially_available", "unavailable", "on_leave"]);

// Project Events Enums
export const eventTypeEnum = pgEnum("event_type", [
  "meeting", "audit", "inspection", "milestone", "deadline",
  "training", "workshop", "review", "handover", "other"
]);

// Chat Enums
export const conversationTypeEnum = pgEnum("conversation_type", ["direct", "group", "project", "task"]);
export const messageTypeEnum = pgEnum("message_type", ["text", "file", "image", "system"]);
export const participantRoleEnum = pgEnum("participant_role", ["owner", "admin", "member"]);

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

// Users (Local Auth + Google OAuth)
export const users = pgTable("users", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email", { length: 255 }).unique().notNull(),
  firstName: varchar("first_name", { length: 255 }),
  lastName: varchar("last_name", { length: 255 }),
  profileImageUrl: varchar("profile_image_url", { length: 512 }),
  // Auth fields
  passwordHash: varchar("password_hash", { length: 255 }), // null if Google-only user
  googleId: varchar("google_id", { length: 255 }).unique(), // Google OAuth ID
  emailVerified: boolean("email_verified").default(false).notNull(),
  emailVerificationToken: varchar("email_verification_token", { length: 255 }),
  emailVerificationExpires: timestamp("email_verification_expires"),
  passwordResetToken: varchar("password_reset_token", { length: 255 }),
  passwordResetExpires: timestamp("password_reset_expires"),
  // 2FA fields
  totpSecret: varchar("totp_secret", { length: 255 }), // encrypted TOTP secret
  totpEnabled: boolean("totp_enabled").default(false).notNull(),
  backupCodes: text("backup_codes"), // JSON array of hashed backup codes
  // Timestamps
  lastLoginAt: timestamp("last_login_at"),
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

// Tasks (WBS items with hierarchy support - EPC Enhanced)
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
  assignedToName: varchar("assigned_to_name", { length: 100 }), // Flexible text for imports (e.g., "PM-01", "ENG-LEAD")
  createdBy: varchar("created_by", { length: 255 }).notNull().references(() => users.id),
  // EPC-Specific Fields
  discipline: disciplineEnum("discipline").default("general"),
  disciplineLabel: varchar("discipline_label", { length: 100 }), // Flexible text for imports (e.g., "management", "engineering")
  areaCode: varchar("area_code", { length: 50 }), // Plant area/zone code
  weightFactor: decimal("weight_factor", { precision: 5, scale: 4 }).default("0.0000"), // Progress weight (0.0000-1.0000)
  physicalQuantity: decimal("physical_quantity", { precision: 15, scale: 2 }), // e.g., 500 meters
  unitOfMeasure: varchar("unit_of_measure", { length: 20 }), // m, m², m³, kg, ea, lot
  plannedQtyPeriod: decimal("planned_qty_period", { precision: 15, scale: 2 }), // Planned qty this period
  actualQtyPeriod: decimal("actual_qty_period", { precision: 15, scale: 2 }), // Actual qty this period
  cumulativeQty: decimal("cumulative_qty", { precision: 15, scale: 2 }), // Cumulative installed
  constraintType: constraintTypeEnum("constraint_type").default("asap"),
  constraintDate: timestamp("constraint_date"), // Date for constraint if applicable
  baselineStart: timestamp("baseline_start"), // Original planned start
  baselineFinish: timestamp("baseline_finish"), // Original planned finish
  baselineCost: decimal("baseline_cost", { precision: 15, scale: 2 }), // Original budget
  actualCost: decimal("actual_cost", { precision: 15, scale: 2 }), // Actual cost to date
  earnedValue: decimal("earned_value", { precision: 15, scale: 2 }), // Earned value
  responsibleContractor: text("responsible_contractor"), // Subcontractor name
  float: integer("float"), // Total float days (calculated from CPM)
  freeFloat: integer("free_float"), // Free float days (slack before affecting successors)
  duration: integer("duration"), // Duration in days (calculated from effort/capacity) - legacy, use computedDuration
  baselineDuration: integer("baseline_duration"), // Original planned duration in days (snapshot at baseline)
  computedDuration: integer("computed_duration"), // Calculated duration in days (from effort hours + resource capacity + calendar)
  actualDuration: integer("actual_duration"), // Actual duration in days (after task completion)
  actualStartDate: timestamp("actual_start_date"), // Actual date when work started
  actualFinishDate: timestamp("actual_finish_date"), // Actual date when work finished
  workMode: workModeEnum("work_mode").default("parallel"), // How multiple resources work: parallel (max) or sequential (sum)
  earlyStart: timestamp("early_start"), // Earliest possible start (CPM Forward Pass)
  earlyFinish: timestamp("early_finish"), // Earliest possible finish (CPM Forward Pass)
  lateStart: timestamp("late_start"), // Latest possible start (CPM Backward Pass)
  lateFinish: timestamp("late_finish"), // Latest possible finish (CPM Backward Pass)
  isMilestone: boolean("is_milestone").default(false),
  isCriticalPath: boolean("is_critical_path").default(false),
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

// Stakeholders (EPC Enhanced)
export const stakeholders = pgTable("stakeholders", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  organization: text("organization"),
  role: stakeholderRoleEnum("role").notNull().default("other"),
  // EPC-Specific Fields
  roleEpc: stakeholderRoleEpcEnum("role_epc").default("other"), // Detailed EPC role
  communicationPreference: communicationPreferenceEnum("communication_preference").default("email"),
  authorityLevel: authorityLevelEnum("authority_level").default("informed"),
  contractReference: varchar("contract_reference", { length: 100 }), // Contract/PO number
  discipline: disciplineEnum("discipline"), // Primary discipline responsibility
  influence: integer("influence").notNull().default(3), // 1-5 scale
  interest: integer("interest").notNull().default(3), // 1-5 scale
  notes: text("notes"),
  contactId: integer("contact_id").references(() => contacts.id), // Link to Master Directory
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// RACI Matrix (Stakeholder/Resource-Task responsibility assignments)
// Supports both stakeholders and human resources as assignable people
// Supports inheritance from parent tasks in WBS hierarchy
export const stakeholderRaci = pgTable("stakeholder_raci", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  taskId: integer("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  raciType: raciTypeEnum("raci_type").notNull(), // R, A, C, or I
  // Either stakeholderId OR resourceId must be set (one person per record)
  stakeholderId: integer("stakeholder_id").references(() => stakeholders.id, { onDelete: "cascade" }),
  resourceId: integer("resource_id").references(() => resources.id, { onDelete: "cascade" }),
  // Inheritance tracking - for WBS parent-child RACI propagation
  isInherited: boolean("is_inherited").notNull().default(false),
  inheritedFromTaskId: integer("inherited_from_task_id").references(() => tasks.id, { onDelete: "set null" }),
  notes: text("notes"), // Optional notes for this assignment
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  // Allow same person to have different RACI roles on same task
  // Unique on (stakeholder/resource, task, raciType) combination
  uniqueStakeholderTaskRaci: unique("stakeholder_raci_stakeholder_unique").on(table.stakeholderId, table.taskId, table.raciType),
  uniqueResourceTaskRaci: unique("stakeholder_raci_resource_unique").on(table.resourceId, table.taskId, table.raciType),
}));

// Risks (EPC Enhanced)
export const risks = pgTable("risks", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  code: varchar("code", { length: 50 }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category"), // Keep for backward compat
  categoryEpc: riskCategoryEnum("category_epc").default("technical"), // EPC category
  status: riskStatusEnum("status").notNull().default("identified"),
  probability: integer("probability").notNull().default(3), // 1-5 scale
  impact: riskImpactEnum("impact").notNull().default("medium"),
  mitigationPlan: text("mitigation_plan"),
  owner: varchar("owner", { length: 255 }).references(() => users.id),
  // EPC-Specific Fields
  responseStrategy: riskResponseEnum("response_strategy").default("mitigate"),
  costImpact: decimal("cost_impact", { precision: 15, scale: 2 }), // $ impact if risk occurs
  scheduleImpact: integer("schedule_impact"), // Days delay if risk occurs
  riskExposure: decimal("risk_exposure", { precision: 15, scale: 2 }), // P × I × Cost (calculated)
  triggerEvents: text("trigger_events"), // Conditions that activate risk
  contingencyReserve: decimal("contingency_reserve", { precision: 15, scale: 2 }), // $ allocated
  secondaryRisks: text("secondary_risks"), // Risks from mitigation
  residualProbability: integer("residual_probability"), // 1-5 after mitigation
  residualImpact: riskImpactEnum("residual_impact"), // After mitigation
  reviewDate: timestamp("review_date"), // Next review date
  discipline: disciplineEnum("discipline"), // Related discipline
  identifiedDate: timestamp("identified_date").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueCodePerProject: unique("risks_project_code_unique").on(table.projectId, table.code),
}));

// Issues (EPC Enhanced)
export const issues = pgTable("issues", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  code: varchar("code", { length: 50 }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  status: issueStatusEnum("status").notNull().default("open"),
  priority: issuePriorityEnum("priority").notNull().default("medium"),
  category: text("category"), // Keep for backward compat
  // EPC-Specific Fields
  issueType: issueTypeEnum("issue_type").default("design"),
  impactCost: boolean("impact_cost").default(false),
  impactSchedule: boolean("impact_schedule").default(false),
  impactQuality: boolean("impact_quality").default(false),
  impactSafety: boolean("impact_safety").default(false),
  rootCauseCategory: rootCauseCategoryEnum("root_cause_category"),
  rootCauseAnalysis: text("root_cause_analysis"), // 5 Whys result
  lessonsLearnedRef: varchar("lessons_learned_ref", { length: 100 }),
  relatedChangeRequest: integer("related_change_request").references(() => changeRequests.id),
  escalationLevel: escalationLevelEnum("escalation_level").default("project"),
  targetResolutionDate: timestamp("target_resolution_date"),
  verificationRequired: boolean("verification_required").default(false),
  verifiedBy: varchar("verified_by", { length: 255 }).references(() => users.id),
  verifiedDate: timestamp("verified_date"),
  discipline: disciplineEnum("discipline"),
  areaCode: varchar("area_code", { length: 50 }),
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

// Resources (with pricing model)
export const resources = pgTable("resources", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(), // human, equipment, material
  discipline: disciplineEnum("discipline").default("general"), // EPC discipline
  availability: integer("availability").notNull().default(100), // percentage
  availabilityStatus: availabilityStatusEnum("availability_status").default("available"),

  // Legacy field - keep for backward compat
  costPerHour: decimal("cost_per_hour", { precision: 10, scale: 2 }),
  // Primary pricing model
  rateType: rateTypeEnum("rate_type").default("per-hour"), // per-hour, per-use, per-unit
  rate: decimal("rate", { precision: 15, scale: 2 }).default("0"), // The rate amount
  unitType: unitTypeEnum("unit_type").default("hr"), // Unit type for per-unit pricing
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),

  // Multiple pricing models (JSONB array for flexibility)
  // Format: [{ name: string, rateType: string, rate: number, unitType: string, currency: string, effectiveFrom?: date, effectiveTo?: date }]
  pricingModels: jsonb("pricing_models").$type<Array<{
    name: string;
    rateType: string;
    rate: number;
    unitType: string;
    currency: string;
    effectiveFrom?: string;
    effectiveTo?: string;
    isDefault?: boolean;
  }>>(),

  // Skills and certifications (array, max 10)
  skillsArray: text("skills_array").array(),
  skills: text("skills"), // Legacy comma-separated skills (backward compat)
  certifications: text("certifications").array(),

  // Contract and vendor information
  contractType: contractTypeEnum("contract_type"),
  vendorName: varchar("vendor_name", { length: 255 }),
  vendorContactEmail: varchar("vendor_contact_email", { length: 255 }),
  vendorContactPhone: varchar("vendor_contact_phone", { length: 50 }),
  contractStartDate: timestamp("contract_start_date"),
  contractEndDate: timestamp("contract_end_date"),
  contractReference: varchar("contract_reference", { length: 100 }),

  // Capacity and working hours
  maxHoursPerDay: integer("max_hours_per_day").default(8),
  maxHoursPerWeek: integer("max_hours_per_week").default(40),
  workingDays: text("working_days").array(), // ["monday", "tuesday", ...]
  // Working calendar exceptions (holidays, unavailable dates)
  // Format: [{ date: string, type: 'holiday' | 'leave' | 'training', note?: string }]
  calendarExceptions: jsonb("calendar_exceptions").$type<Array<{
    date: string;
    type: string;
    note?: string;
  }>>(),

  // Efficiency and productivity metrics
  efficiencyRating: decimal("efficiency_rating", { precision: 5, scale: 2 }).default("1.0"), // 0.5 to 2.0
  productivityFactor: decimal("productivity_factor", { precision: 5, scale: 2 }).default("1.0"),
  qualityScore: integer("quality_score"), // 1-100

  // Additional metadata
  description: text("description"),
  notes: text("notes"),
  tags: text("tags").array(),
  profileImageUrl: varchar("profile_image_url", { length: 512 }),

  contactId: integer("contact_id").references(() => contacts.id), // Link to Master Directory
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Resource Assignments
export const resourceAssignments = pgTable("resource_assignments", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  resourceId: integer("resource_id").notNull().references(() => resources.id, { onDelete: "cascade" }),
  allocation: integer("allocation").notNull().default(100), // percentage (100% = full-time, 200% = double capacity)
  effortHours: decimal("effort_hours", { precision: 10, scale: 2 }), // Effort hours for THIS resource on THIS task (if different from task total)
  workMode: workModeEnum("work_mode"), // Optional override per assignment (if null, use task workMode)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ==================== EPC Document Control ====================

// Documents (Document Register)
export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  documentNumber: varchar("document_number", { length: 100 }).notNull(), // PRJ-DIS-AREA-TYPE-SEQ
  title: text("title").notNull(),
  description: text("description"),
  discipline: disciplineEnum("discipline").default("general"),
  documentType: documentTypeEnum("document_type").notNull().default("drawing"),
  revision: varchar("revision", { length: 10 }).notNull().default("0"), // A, B, 0, 1, 2...
  status: documentStatusEnum("status").notNull().default("draft"),
  areaCode: varchar("area_code", { length: 50 }),
  equipmentTag: varchar("equipment_tag", { length: 100 }), // Related equipment
  originator: varchar("originator", { length: 255 }).references(() => users.id),
  checker: varchar("checker", { length: 255 }).references(() => users.id),
  approver: varchar("approver", { length: 255 }).references(() => users.id),
  supersedesDocId: integer("supersedes_doc_id"), // Previous revision
  requiredDate: timestamp("required_date"),
  forecastDate: timestamp("forecast_date"),
  actualDate: timestamp("actual_date"),
  filePath: text("file_path"), // Storage path
  fileSize: integer("file_size"), // bytes
  reviewComments: text("review_comments"),
  createdBy: varchar("created_by", { length: 255 }).notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueDocPerProject: unique("documents_project_number_unique").on(table.projectId, table.documentNumber, table.revision),
}));

// Transmittals
export const transmittals = pgTable("transmittals", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  transmittalNumber: varchar("transmittal_number", { length: 50 }).notNull(),
  subject: text("subject").notNull(),
  fromOrganization: text("from_organization").notNull(),
  toOrganization: text("to_organization").notNull(),
  attention: text("attention"), // Person's name
  issueDate: timestamp("issue_date").defaultNow().notNull(),
  responseRequired: boolean("response_required").default(false),
  responseRequiredDate: timestamp("response_required_date"),
  responseReceivedDate: timestamp("response_received_date"),
  status: transmittalStatusEnum("status").notNull().default("issued"),
  purpose: text("purpose"), // For Review, For Approval, For Information, etc.
  remarks: text("remarks"),
  createdBy: varchar("created_by", { length: 255 }).notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueTransmittalPerProject: unique("transmittals_project_number_unique").on(table.projectId, table.transmittalNumber),
}));

// Transmittal Documents (junction table)
export const transmittalDocuments = pgTable("transmittal_documents", {
  id: serial("id").primaryKey(),
  transmittalId: integer("transmittal_id").notNull().references(() => transmittals.id, { onDelete: "cascade" }),
  documentId: integer("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  copies: integer("copies").default(1),
  purpose: text("purpose"), // For Review, For Approval, For Construction
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// RFIs (Request for Information)
export const rfis = pgTable("rfis", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  rfiNumber: varchar("rfi_number", { length: 50 }).notNull(),
  subject: text("subject").notNull(),
  discipline: disciplineEnum("discipline").default("general"),
  fromOrganization: text("from_organization").notNull(),
  toOrganization: text("to_organization").notNull(),
  question: text("question").notNull(),
  response: text("response"),
  priority: issuePriorityEnum("priority").notNull().default("medium"),
  status: rfiStatusEnum("status").notNull().default("open"),
  requiredDate: timestamp("required_date"),
  responseDate: timestamp("response_date"),
  costImpact: boolean("cost_impact").default(false),
  scheduleImpact: boolean("schedule_impact").default(false),
  relatedDocuments: text("related_documents"), // Comma-separated doc numbers
  areaCode: varchar("area_code", { length: 50 }),
  submittedBy: varchar("submitted_by", { length: 255 }).notNull().references(() => users.id),
  respondedBy: varchar("responded_by", { length: 255 }).references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueRfiPerProject: unique("rfis_project_number_unique").on(table.projectId, table.rfiNumber),
}));

// Punch Items (Punch List / Snag List)
export const punchItems = pgTable("punch_items", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  code: varchar("code", { length: 50 }).notNull(),
  system: text("system").notNull(), // Mechanical, Electrical, etc.
  areaCode: varchar("area_code", { length: 50 }),
  discipline: disciplineEnum("discipline").default("general"),
  description: text("description").notNull(),
  category: punchCategoryEnum("category").notNull().default("b"), // A, B, C
  status: punchStatusEnum("status").notNull().default("open"),
  priority: issuePriorityEnum("priority").notNull().default("medium"),
  assignedTo: varchar("assigned_to", { length: 255 }).references(() => users.id),
  responsibleContractor: text("responsible_contractor"),
  targetDate: timestamp("target_date"),
  completedDate: timestamp("completed_date"),
  verifiedBy: varchar("verified_by", { length: 255 }).references(() => users.id),
  verifiedDate: timestamp("verified_date"),
  remarks: text("remarks"),
  photoPath: text("photo_path"), // Before/after photos
  createdBy: varchar("created_by", { length: 255 }).notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniquePunchPerProject: unique("punch_items_project_code_unique").on(table.projectId, table.code),
}));

// ==================== Daily Progress Reporting ====================

// Daily Reports
export const dailyReports = pgTable("daily_reports", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  reportDate: timestamp("report_date").notNull(),
  weatherCondition: weatherConditionEnum("weather_condition").default("clear"),
  weatherNotes: text("weather_notes"),
  temperature: integer("temperature"), // Celsius
  workableHours: decimal("workable_hours", { precision: 4, scale: 1 }), // e.g., 8.5
  activitiesCompleted: text("activities_completed"),
  activitiesPlanned: text("activities_planned"), // For next day
  issuesEncountered: text("issues_encountered"),
  safetyObservations: text("safety_observations"),
  qualityObservations: text("quality_observations"),
  visitorLog: text("visitor_log"),
  remarks: text("remarks"),
  submittedBy: varchar("submitted_by", { length: 255 }).notNull().references(() => users.id),
  approvedBy: varchar("approved_by", { length: 255 }).references(() => users.id),
  approvedDate: timestamp("approved_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueReportPerProjectDate: unique("daily_reports_project_date_unique").on(table.projectId, table.reportDate),
}));

// Daily Manpower (linked to daily reports)
export const dailyManpower = pgTable("daily_manpower", {
  id: serial("id").primaryKey(),
  dailyReportId: integer("daily_report_id").notNull().references(() => dailyReports.id, { onDelete: "cascade" }),
  trade: text("trade").notNull(), // Electrician, Welder, Pipefitter, etc.
  contractor: text("contractor"),
  plannedCount: integer("planned_count").default(0),
  actualCount: integer("actual_count").default(0),
  hoursWorked: decimal("hours_worked", { precision: 5, scale: 1 }),
  remarks: text("remarks"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Daily Equipment (linked to daily reports)
export const dailyEquipment = pgTable("daily_equipment", {
  id: serial("id").primaryKey(),
  dailyReportId: integer("daily_report_id").notNull().references(() => dailyReports.id, { onDelete: "cascade" }),
  equipmentType: text("equipment_type").notNull(), // Crane, Excavator, etc.
  equipmentId: varchar("equipment_id", { length: 50 }), // ID/tag number
  contractor: text("contractor"),
  plannedHours: decimal("planned_hours", { precision: 5, scale: 1 }),
  actualHours: decimal("actual_hours", { precision: 5, scale: 1 }),
  status: text("status"), // Working, Standby, Breakdown
  remarks: text("remarks"),
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

// ==================== Project Events (Calendar) ====================

// Project Events (for calendar meetings, audits, etc.)
export const projectEvents = pgTable("project_events", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  eventType: eventTypeEnum("event_type").notNull().default("meeting"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  allDay: boolean("all_day").default(false),
  location: text("location"),
  attendees: text("attendees"), // Comma-separated user IDs or emails
  color: varchar("color", { length: 20 }), // Custom color for calendar display
  isRecurring: boolean("is_recurring").default(false),
  recurrencePattern: text("recurrence_pattern"), // JSON for recurring rules
  reminderMinutes: integer("reminder_minutes"), // Minutes before to send reminder
  createdBy: varchar("created_by", { length: 255 }).notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ==================== Junction Tables for Task Assignments ====================

// Task-Document Assignments (for linking documents to tasks)
export const taskDocuments = pgTable("task_documents", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  documentId: integer("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  relationship: text("relationship").default("related"), // related, deliverable, reference, input
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueTaskDoc: unique("task_documents_unique").on(table.taskId, table.documentId),
}));

// Task-Risk Assignments (for linking risks to tasks)
export const taskRisks = pgTable("task_risks", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  riskId: integer("risk_id").notNull().references(() => risks.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueTaskRisk: unique("task_risks_unique").on(table.taskId, table.riskId),
}));

// Task-Issue Assignments (for linking issues to tasks)
export const taskIssues = pgTable("task_issues", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  issueId: integer("issue_id").notNull().references(() => issues.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueTaskIssue: unique("task_issues_unique").on(table.taskId, table.issueId),
}));

// ==================== Chat System ====================

// Chat Conversations
export const chatConversations = pgTable("chat_conversations", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "cascade" }),
  taskId: integer("task_id").references(() => tasks.id, { onDelete: "cascade" }),
  type: conversationTypeEnum("type").notNull().default("direct"),
  name: varchar("name", { length: 255 }), // For group conversations
  description: text("description"),
  createdBy: varchar("created_by", { length: 255 }).notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  projectIdx: index("chat_conversations_project_idx").on(table.projectId),
  taskIdx: index("chat_conversations_task_idx").on(table.taskId),
  typeIdx: index("chat_conversations_type_idx").on(table.type),
}));

// Chat Participants
export const chatParticipants = pgTable("chat_participants", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => chatConversations.id, { onDelete: "cascade" }),
  userId: varchar("user_id", { length: 255 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  role: participantRoleEnum("role").notNull().default("member"),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  lastReadAt: timestamp("last_read_at"), // Track when user last read messages
}, (table) => ({
  uniqueParticipant: unique("chat_participants_unique").on(table.conversationId, table.userId),
  conversationIdx: index("chat_participants_conversation_idx").on(table.conversationId),
  userIdx: index("chat_participants_user_idx").on(table.userId),
}));

// Chat Messages
export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => chatConversations.id, { onDelete: "cascade" }),
  userId: varchar("user_id", { length: 255 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(), // Message text or file path
  type: messageTypeEnum("type").notNull().default("text"),
  filePath: text("file_path"), // For file/image messages
  fileName: varchar("file_name", { length: 255 }), // Original filename
  fileSize: integer("file_size"), // Size in bytes
  mimeType: varchar("mime_type", { length: 100 }), // MIME type for files
  replyToMessageId: integer("reply_to_message_id").references(() => chatMessages.id, { onDelete: "set null" }), // For reply threading
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"), // Soft delete
}, (table) => ({
  conversationIdx: index("chat_messages_conversation_idx").on(table.conversationId),
  userIdx: index("chat_messages_user_idx").on(table.userId),
  createdAtIdx: index("chat_messages_created_at_idx").on(table.createdAt),
  replyIdx: index("chat_messages_reply_idx").on(table.replyToMessageId),
}));

// ==================== Contact Management (CRM) ====================

// Master Contact Directory (Organization Level)
export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  company: text("company"),
  jobTitle: text("job_title"),
  type: text("type").default("other"), // client, vendor, consultant, partner, employee
  linkedUserId: varchar("linked_user_id", { length: 255 }).references(() => users.id),
  notes: text("notes"),
  tags: text("tags").array(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  orgIdx: index("contacts_org_idx").on(table.organizationId),
}));

// Contact Interaction Logs
export const contactLogs = pgTable("contact_logs", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "set null" }),
  type: text("type").notNull(), // email, meeting, call, note
  subject: text("subject"),
  content: text("content"),
  loggedBy: varchar("logged_by", { length: 255 }).references(() => users.id),
  date: timestamp("date").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  contactIdx: index("contact_logs_contact_idx").on(table.contactId),
  projectIdx: index("contact_logs_project_idx").on(table.projectId),
}));

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

// Zod Schemas for Stakeholder RACI Matrix
export const insertStakeholderRaciSchema = createInsertSchema(stakeholderRaci).omit({ id: true, createdAt: true, updatedAt: true });
export const updateStakeholderRaciSchema = insertStakeholderRaciSchema.partial();
export const selectStakeholderRaciSchema = createSelectSchema(stakeholderRaci);
export type InsertStakeholderRaci = z.infer<typeof insertStakeholderRaciSchema>;
export type UpdateStakeholderRaci = z.infer<typeof updateStakeholderRaciSchema>;
export type StakeholderRaci = typeof stakeholderRaci.$inferSelect;

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

// Email Template Type Enum
export const emailTemplateTypeEnum = pgEnum("email_template_type", [
  "task-assigned",
  "task-due-reminder",
  "risk-identified",
  "issue-reported",
  "change-request-submitted",
  "change-request-approved",
  "change-request-rejected",
  "project-update",
  "milestone-reached",
  "custom"
]);

// Email Templates (Organization-level)
export const emailTemplates = pgTable("email_templates", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  type: emailTemplateTypeEnum("type").notNull(),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(), // HTML content with {{placeholders}}
  isActive: boolean("is_active").notNull().default(true),
  createdBy: varchar("created_by", { length: 255 }).notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Sent Email Log (for tracking and analytics)
export const sentEmails = pgTable("sent_emails", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "set null" }),
  templateId: integer("template_id").references(() => emailTemplates.id, { onDelete: "set null" }),
  toEmail: text("to_email").notNull(),
  subject: text("subject").notNull(),
  status: text("status").notNull().default("pending"), // pending, sent, failed, bounced
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Email Usage Tracking (for billing)
export const emailUsage = pgTable("email_usage", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  month: varchar("month", { length: 7 }).notNull(), // Format: YYYY-MM
  emailsSent: integer("emails_sent").notNull().default(0),
  emailLimit: integer("email_limit").notNull().default(1000), // Based on subscription tier
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueOrgMonth: unique("email_usage_org_month_unique").on(table.organizationId, table.month),
}));

// Zod Schemas for Email Templates
export const insertEmailTemplateSchema = createInsertSchema(emailTemplates).omit({ id: true, createdAt: true, updatedAt: true, createdBy: true });
export const updateEmailTemplateSchema = insertEmailTemplateSchema.partial();
export const selectEmailTemplateSchema = createSelectSchema(emailTemplates);
export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;
export type UpdateEmailTemplate = z.infer<typeof updateEmailTemplateSchema>;
export type EmailTemplate = typeof emailTemplates.$inferSelect;

// Zod Schemas for Sent Emails
export const insertSentEmailSchema = createInsertSchema(sentEmails).omit({ id: true, createdAt: true });
export const selectSentEmailSchema = createSelectSchema(sentEmails);
export type InsertSentEmail = z.infer<typeof insertSentEmailSchema>;
export type SentEmail = typeof sentEmails.$inferSelect;

// Zod Schemas for Email Usage
export const insertEmailUsageSchema = createInsertSchema(emailUsage).omit({ id: true, createdAt: true, updatedAt: true });
export const selectEmailUsageSchema = createSelectSchema(emailUsage);
export type InsertEmailUsage = z.infer<typeof insertEmailUsageSchema>;
export type EmailUsage = typeof emailUsage.$inferSelect;

// File Uploads (Project Documents)
export const projectFiles = pgTable("project_files", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  organizationId: integer("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(), // Size in bytes
  objectPath: text("object_path").notNull(), // Path in object storage
  category: text("category").notNull().default("general"), // document, drawing, report, photo, other
  description: text("description"),
  uploadedBy: varchar("uploaded_by", { length: 255 }).notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  projectIdx: index("project_files_project_idx").on(table.projectId),
  orgIdx: index("project_files_org_idx").on(table.organizationId),
}));

// Storage Quota (Organization-level tracking)
export const storageQuotas = pgTable("storage_quotas", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }).unique(),
  usedBytes: integer("used_bytes").notNull().default(0),
  quotaBytes: integer("quota_bytes").notNull().default(1073741824), // 1GB default quota
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Zod Schemas for Project Files
export const insertProjectFileSchema = createInsertSchema(projectFiles).omit({ id: true, createdAt: true, updatedAt: true, uploadedBy: true });
export const updateProjectFileSchema = insertProjectFileSchema.partial();
export const selectProjectFileSchema = createSelectSchema(projectFiles);
export type InsertProjectFile = z.infer<typeof insertProjectFileSchema>;
export type UpdateProjectFile = z.infer<typeof updateProjectFileSchema>;
export type ProjectFile = typeof projectFiles.$inferSelect;

// Zod Schemas for Storage Quotas
export const insertStorageQuotaSchema = createInsertSchema(storageQuotas).omit({ id: true, createdAt: true, updatedAt: true });
export const selectStorageQuotaSchema = createSelectSchema(storageQuotas);
export type InsertStorageQuota = z.infer<typeof insertStorageQuotaSchema>;
export type StorageQuota = typeof storageQuotas.$inferSelect;

// Subscription Tier Enum
export const subscriptionTierEnum = pgEnum("subscription_tier", ["free", "starter", "professional", "enterprise"]);

// Subscription Plans (defines limits for each tier)
export const subscriptionPlans = pgTable("subscription_plans", {
  id: serial("id").primaryKey(),
  tier: subscriptionTierEnum("tier").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  priceMonthly: decimal("price_monthly", { precision: 10, scale: 2 }).notNull(),
  priceYearly: decimal("price_yearly", { precision: 10, scale: 2 }).notNull(),
  maxProjects: integer("max_projects").notNull(),
  maxTasksPerProject: integer("max_tasks_per_project").notNull(),
  maxUsers: integer("max_users").notNull(),
  storageQuotaBytes: integer("storage_quota_bytes").notNull(), // Bytes
  aiTokensMonthly: integer("ai_tokens_monthly").notNull(), // Monthly AI token limit
  emailsMonthly: integer("emails_monthly").notNull(), // Monthly email limit
  includesCloudSync: boolean("includes_cloud_sync").notNull().default(false),
  includesAdvancedReports: boolean("includes_advanced_reports").notNull().default(false),
  includesWhiteLabel: boolean("includes_white_label").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Organization Subscriptions (active subscription for each org)
export const organizationSubscriptions = pgTable("organization_subscriptions", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }).unique(),
  planId: integer("plan_id").notNull().references(() => subscriptionPlans.id),
  status: varchar("status", { length: 50 }).notNull().default("active"), // active, cancelled, past_due, expired
  billingCycle: varchar("billing_cycle", { length: 20 }).notNull().default("monthly"), // monthly, yearly
  currentPeriodStart: timestamp("current_period_start").notNull().defaultNow(),
  currentPeriodEnd: timestamp("current_period_end").notNull(),
  cancelledAt: timestamp("cancelled_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// AI Usage Summary (aggregated monthly usage per organization)
export const aiUsageSummary = pgTable("ai_usage_summary", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  month: varchar("month", { length: 7 }).notNull(), // Format: YYYY-MM
  tokensUsed: integer("tokens_used").notNull().default(0),
  tokenLimit: integer("token_limit").notNull().default(50000), // Based on subscription tier
  requestCount: integer("request_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueOrgMonth: unique("ai_usage_summary_org_month_unique").on(table.organizationId, table.month),
}));

// Zod Schemas for Subscription Plans
export const insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlans).omit({ id: true, createdAt: true, updatedAt: true });
export const updateSubscriptionPlanSchema = insertSubscriptionPlanSchema.partial();
export const selectSubscriptionPlanSchema = createSelectSchema(subscriptionPlans);
export type InsertSubscriptionPlan = z.infer<typeof insertSubscriptionPlanSchema>;
export type UpdateSubscriptionPlan = z.infer<typeof updateSubscriptionPlanSchema>;
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;

// Zod Schemas for Organization Subscriptions
export const insertOrganizationSubscriptionSchema = createInsertSchema(organizationSubscriptions).omit({ id: true, createdAt: true, updatedAt: true });
export const updateOrganizationSubscriptionSchema = insertOrganizationSubscriptionSchema.partial();
export const selectOrganizationSubscriptionSchema = createSelectSchema(organizationSubscriptions);
export type InsertOrganizationSubscription = z.infer<typeof insertOrganizationSubscriptionSchema>;
export type UpdateOrganizationSubscription = z.infer<typeof updateOrganizationSubscriptionSchema>;
export type OrganizationSubscription = typeof organizationSubscriptions.$inferSelect;

// Zod Schemas for AI Usage Summary
export const insertAiUsageSummarySchema = createInsertSchema(aiUsageSummary).omit({ id: true, createdAt: true, updatedAt: true });
export const updateAiUsageSummarySchema = insertAiUsageSummarySchema.partial();
export const selectAiUsageSummarySchema = createSelectSchema(aiUsageSummary);
export type InsertAiUsageSummary = z.infer<typeof insertAiUsageSummarySchema>;
export type UpdateAiUsageSummary = z.infer<typeof updateAiUsageSummarySchema>;
export type AiUsageSummary = typeof aiUsageSummary.$inferSelect;

// Cloud Storage Connections (Google Drive, OneDrive, Dropbox per organization)
export const cloudStorageConnections = pgTable("cloud_storage_connections", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  provider: varchar("provider", { length: 50 }).notNull(), // google_drive, onedrive, dropbox
  connectedBy: varchar("connected_by", { length: 255 }).notNull().references(() => users.id),
  accessToken: text("access_token"), // Encrypted OAuth access token
  refreshToken: text("refresh_token"), // Encrypted OAuth refresh token
  tokenExpiresAt: timestamp("token_expires_at"),
  accountEmail: varchar("account_email", { length: 255 }), // Connected account email
  accountName: varchar("account_name", { length: 255 }), // Connected account display name
  rootFolderId: varchar("root_folder_id", { length: 255 }), // Root folder for sync
  rootFolderName: varchar("root_folder_name", { length: 255 }),
  syncEnabled: boolean("sync_enabled").notNull().default(true),
  lastSyncAt: timestamp("last_sync_at"),
  syncStatus: varchar("sync_status", { length: 50 }).default("idle"), // idle, syncing, error
  syncError: text("sync_error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  orgProviderIdx: index("cloud_storage_org_provider_idx").on(table.organizationId, table.provider),
}));

// Synced Cloud Files (one-way sync from cloud storage to local storage)
export const cloudSyncedFiles = pgTable("cloud_synced_files", {
  id: serial("id").primaryKey(),
  connectionId: integer("connection_id").notNull().references(() => cloudStorageConnections.id, { onDelete: "cascade" }),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  cloudFileId: varchar("cloud_file_id", { length: 500 }).notNull(), // Provider's file ID
  cloudFilePath: text("cloud_file_path").notNull(), // Full path in cloud storage
  localFileId: integer("local_file_id").references(() => projectFiles.id, { onDelete: "set null" }), // Local copy
  name: varchar("name", { length: 255 }).notNull(),
  mimeType: varchar("mime_type", { length: 255 }),
  size: integer("size"),
  cloudModifiedAt: timestamp("cloud_modified_at"),
  lastSyncedAt: timestamp("last_synced_at"),
  syncStatus: varchar("sync_status", { length: 50 }).default("pending"), // pending, synced, error
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  connectionIdx: index("cloud_synced_files_connection_idx").on(table.connectionId),
  projectIdx: index("cloud_synced_files_project_idx").on(table.projectId),
  cloudFileIdx: index("cloud_synced_files_cloud_file_idx").on(table.connectionId, table.cloudFileId),
}));

// Zod Schemas for Cloud Storage Connections
export const insertCloudStorageConnectionSchema = createInsertSchema(cloudStorageConnections).omit({
  id: true, createdAt: true, updatedAt: true, connectedBy: true, lastSyncAt: true, syncStatus: true, syncError: true
});
export const updateCloudStorageConnectionSchema = insertCloudStorageConnectionSchema.partial();
export const selectCloudStorageConnectionSchema = createSelectSchema(cloudStorageConnections);
export type InsertCloudStorageConnection = z.infer<typeof insertCloudStorageConnectionSchema>;
export type UpdateCloudStorageConnection = z.infer<typeof updateCloudStorageConnectionSchema>;
export type CloudStorageConnection = typeof cloudStorageConnections.$inferSelect;

// Zod Schemas for Cloud Synced Files
export const insertCloudSyncedFileSchema = createInsertSchema(cloudSyncedFiles).omit({ id: true, createdAt: true, updatedAt: true });
export const updateCloudSyncedFileSchema = insertCloudSyncedFileSchema.partial();
export const selectCloudSyncedFileSchema = createSelectSchema(cloudSyncedFiles);
export type InsertCloudSyncedFile = z.infer<typeof insertCloudSyncedFileSchema>;
export type UpdateCloudSyncedFile = z.infer<typeof updateCloudSyncedFileSchema>;
export type CloudSyncedFile = typeof cloudSyncedFiles.$inferSelect;

// ==================== EPC Document Control Zod Schemas ====================

// Zod Schemas for Documents
export const insertDocumentSchema = createInsertSchema(documents).omit({ id: true, createdAt: true, updatedAt: true, createdBy: true });
export const updateDocumentSchema = insertDocumentSchema.partial();
export const selectDocumentSchema = createSelectSchema(documents);
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type UpdateDocument = z.infer<typeof updateDocumentSchema>;
export type Document = typeof documents.$inferSelect;

// Zod Schemas for Transmittals
export const insertTransmittalSchema = createInsertSchema(transmittals).omit({ id: true, createdAt: true, updatedAt: true, createdBy: true });
export const updateTransmittalSchema = insertTransmittalSchema.partial();
export const selectTransmittalSchema = createSelectSchema(transmittals);
export type InsertTransmittal = z.infer<typeof insertTransmittalSchema>;
export type UpdateTransmittal = z.infer<typeof updateTransmittalSchema>;
export type Transmittal = typeof transmittals.$inferSelect;

// Zod Schemas for Transmittal Documents
export const insertTransmittalDocumentSchema = createInsertSchema(transmittalDocuments).omit({ id: true, createdAt: true });
export const selectTransmittalDocumentSchema = createSelectSchema(transmittalDocuments);
export type InsertTransmittalDocument = z.infer<typeof insertTransmittalDocumentSchema>;
export type TransmittalDocument = typeof transmittalDocuments.$inferSelect;

// Zod Schemas for RFIs
export const insertRfiSchema = createInsertSchema(rfis).omit({ id: true, createdAt: true, updatedAt: true, submittedBy: true }).extend({
  rfiNumber: z.string().optional(), // Auto-generated if not provided
});
export const updateRfiSchema = insertRfiSchema.partial();
export const selectRfiSchema = createSelectSchema(rfis);
export type InsertRfi = z.infer<typeof insertRfiSchema>;
export type UpdateRfi = z.infer<typeof updateRfiSchema>;
export type Rfi = typeof rfis.$inferSelect;

// Zod Schemas for Punch Items
export const insertPunchItemSchema = createInsertSchema(punchItems).omit({ id: true, createdAt: true, updatedAt: true, createdBy: true, code: true }).extend({
  code: z.string().optional(), // Auto-generated if not provided
});
export const updatePunchItemSchema = insertPunchItemSchema.partial();
export const selectPunchItemSchema = createSelectSchema(punchItems);
export type InsertPunchItem = z.infer<typeof insertPunchItemSchema>;
export type UpdatePunchItem = z.infer<typeof updatePunchItemSchema>;
export type PunchItem = typeof punchItems.$inferSelect;

// ==================== Daily Progress Reporting Zod Schemas ====================

// Zod Schemas for Daily Reports
export const insertDailyReportSchema = createInsertSchema(dailyReports).omit({ id: true, createdAt: true, updatedAt: true, submittedBy: true });
export const updateDailyReportSchema = insertDailyReportSchema.partial();
export const selectDailyReportSchema = createSelectSchema(dailyReports);
export type InsertDailyReport = z.infer<typeof insertDailyReportSchema>;
export type UpdateDailyReport = z.infer<typeof updateDailyReportSchema>;
export type DailyReport = typeof dailyReports.$inferSelect;

// Zod Schemas for Daily Manpower
export const insertDailyManpowerSchema = createInsertSchema(dailyManpower).omit({ id: true, createdAt: true });
export const updateDailyManpowerSchema = insertDailyManpowerSchema.partial();
export const selectDailyManpowerSchema = createSelectSchema(dailyManpower);
export type InsertDailyManpower = z.infer<typeof insertDailyManpowerSchema>;
export type UpdateDailyManpower = z.infer<typeof updateDailyManpowerSchema>;
export type DailyManpower = typeof dailyManpower.$inferSelect;

// Zod Schemas for Daily Equipment
export const insertDailyEquipmentSchema = createInsertSchema(dailyEquipment).omit({ id: true, createdAt: true });
export const updateDailyEquipmentSchema = insertDailyEquipmentSchema.partial();
export const selectDailyEquipmentSchema = createSelectSchema(dailyEquipment);
export type InsertDailyEquipment = z.infer<typeof insertDailyEquipmentSchema>;
export type UpdateDailyEquipment = z.infer<typeof updateDailyEquipmentSchema>;
export type DailyEquipment = typeof dailyEquipment.$inferSelect;

// ==================== Project Events Zod Schemas ====================

// Zod Schemas for Project Events
export const insertProjectEventSchema = createInsertSchema(projectEvents).omit({ id: true, createdAt: true, updatedAt: true, createdBy: true });
export const updateProjectEventSchema = insertProjectEventSchema.partial();
export const selectProjectEventSchema = createSelectSchema(projectEvents);
export type InsertProjectEvent = z.infer<typeof insertProjectEventSchema>;
export type UpdateProjectEvent = z.infer<typeof updateProjectEventSchema>;
export type ProjectEvent = typeof projectEvents.$inferSelect;

// ==================== Task Junction Table Zod Schemas ====================

// Zod Schemas for Task Documents
export const insertTaskDocumentSchema = createInsertSchema(taskDocuments).omit({ id: true, createdAt: true });
export const selectTaskDocumentSchema = createSelectSchema(taskDocuments);
export type InsertTaskDocument = z.infer<typeof insertTaskDocumentSchema>;
export type TaskDocument = typeof taskDocuments.$inferSelect;

// Zod Schemas for Task Risks
export const insertTaskRiskSchema = createInsertSchema(taskRisks).omit({ id: true, createdAt: true });
export const selectTaskRiskSchema = createSelectSchema(taskRisks);
export type InsertTaskRisk = z.infer<typeof insertTaskRiskSchema>;
export type TaskRisk = typeof taskRisks.$inferSelect;

// Zod Schemas for Task Issues
export const insertTaskIssueSchema = createInsertSchema(taskIssues).omit({ id: true, createdAt: true });
export const selectTaskIssueSchema = createSelectSchema(taskIssues);
export type InsertTaskIssue = z.infer<typeof insertTaskIssueSchema>;
export type TaskIssue = typeof taskIssues.$inferSelect;

// ==================== Chat Zod Schemas ====================

// Zod Schemas for Chat Conversations
export const insertConversationSchema = createInsertSchema(chatConversations).omit({ id: true, createdAt: true, updatedAt: true, createdBy: true });
export const updateConversationSchema = insertConversationSchema.partial();
export const selectConversationSchema = createSelectSchema(chatConversations);
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type UpdateConversation = z.infer<typeof updateConversationSchema>;
export type Conversation = typeof chatConversations.$inferSelect;

// Zod Schemas for Chat Participants
export const insertParticipantSchema = createInsertSchema(chatParticipants).omit({ id: true, joinedAt: true });
export const selectParticipantSchema = createSelectSchema(chatParticipants);
export type InsertParticipant = z.infer<typeof insertParticipantSchema>;
export type Participant = typeof chatParticipants.$inferSelect;

// Zod Schemas for Chat Messages
export const insertMessageSchema = createInsertSchema(chatMessages).omit({ id: true, createdAt: true, updatedAt: true, userId: true }).extend({
  userId: z.string().optional(), // Auto-set to current user if not provided
});
export const updateMessageSchema = insertMessageSchema.partial();
export const selectMessageSchema = createSelectSchema(chatMessages);
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type UpdateMessage = z.infer<typeof updateMessageSchema>;
export type Message = typeof chatMessages.$inferSelect;

// Zod Schemas for Contacts
export const insertContactSchema = createInsertSchema(contacts).omit({ id: true, createdAt: true, updatedAt: true });
export const updateContactSchema = insertContactSchema.partial();
export const selectContactSchema = createSelectSchema(contacts);
export type InsertContact = z.infer<typeof insertContactSchema>;
export type UpdateContact = z.infer<typeof updateContactSchema>;
export type Contact = typeof contacts.$inferSelect;

// Zod Schemas for Contact Logs
export const insertContactLogSchema = createInsertSchema(contactLogs).omit({ id: true, createdAt: true, loggedBy: true });
export const updateContactLogSchema = insertContactLogSchema.partial();
export const selectContactLogSchema = createSelectSchema(contactLogs);
export type InsertContactLog = z.infer<typeof insertContactLogSchema>;
export type UpdateContactLog = z.infer<typeof updateContactLogSchema>;
export type ContactLog = typeof contactLogs.$inferSelect;
