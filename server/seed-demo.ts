import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import * as schema from "@shared/schema";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

const DEMO_ORG_SLUG = "demo-solar-project";
const DEMO_USER_ID = "demo-system-user";

async function seedDemoProject() {
  console.log("🌞 Creating Demo Solar Power Plant Project...");

  // Check if demo org already exists
  const existingOrg = await db.query.organizations.findFirst({
    where: eq(schema.organizations.slug, DEMO_ORG_SLUG),
  });

  if (existingOrg) {
    console.log("⚠️ Demo organization already exists. Skipping seed.");
    return;
  }

  // Create Demo Organization
  const [demoOrg] = await db.insert(schema.organizations).values({
    name: "Demo: GreenEnergy Solar",
    slug: DEMO_ORG_SLUG,
  }).returning();

  console.log("✓ Created Demo Organization:", demoOrg.name);

  // Create demo system user (for ownership of items)
  let demoUser;
  const existingUser = await db.query.users.findFirst({
    where: eq(schema.users.id, DEMO_USER_ID),
  });
  
  if (!existingUser) {
    [demoUser] = await db.insert(schema.users).values({
      id: DEMO_USER_ID,
      email: "demo@greenenergy-solar.com",
      firstName: "Demo",
      lastName: "Project Manager",
      profileImageUrl: null,
    }).returning();
  } else {
    demoUser = existingUser;
  }

  // Link demo user as owner
  await db.insert(schema.userOrganizations).values({
    userId: demoUser.id,
    organizationId: demoOrg.id,
    role: "owner",
  });

  // Create the main demo project
  const [project] = await db.insert(schema.projects).values({
    organizationId: demoOrg.id,
    name: "50MW Riverside Solar Power Plant",
    code: "SOLAR-2024-001",
    description: "Engineering, Procurement, and Construction of a 50MW utility-scale solar photovoltaic power plant in Riverside County. Includes 150,000 solar panels, inverters, substation, and grid connection.",
    status: "active",
    startDate: new Date("2024-01-15"),
    endDate: new Date("2025-09-30"),
    budget: "75000000",
    currency: "USD",
  }).returning();

  console.log("✓ Created project:", project.name);

  // ============================================
  // WBS TASK HIERARCHY - 5 LEVELS
  // ============================================
  
  // Level 1: Major Phases
  const [phase1] = await db.insert(schema.tasks).values({
    projectId: project.id,
    parentId: null,
    wbsCode: "1",
    name: "Project Initiation & Planning",
    description: "Project setup, feasibility studies, and detailed planning",
    status: "completed",
    priority: "critical",
    progress: 100,
    startDate: new Date("2024-01-15"),
    endDate: new Date("2024-03-31"),
    estimatedHours: "2400",
    actualHours: "2280",
    createdBy: demoUser.id,
  }).returning();

  const [phase2] = await db.insert(schema.tasks).values({
    projectId: project.id,
    parentId: null,
    wbsCode: "2",
    name: "Engineering & Design",
    description: "Detailed engineering, design documents, and technical specifications",
    status: "completed",
    priority: "critical",
    progress: 100,
    startDate: new Date("2024-03-01"),
    endDate: new Date("2024-06-30"),
    estimatedHours: "4800",
    actualHours: "5100",
    createdBy: demoUser.id,
  }).returning();

  const [phase3] = await db.insert(schema.tasks).values({
    projectId: project.id,
    parentId: null,
    wbsCode: "3",
    name: "Procurement",
    description: "Equipment procurement, vendor selection, and logistics",
    status: "completed",
    priority: "high",
    progress: 100,
    startDate: new Date("2024-04-01"),
    endDate: new Date("2024-08-31"),
    estimatedHours: "1600",
    actualHours: "1520",
    createdBy: demoUser.id,
  }).returning();

  const [phase4] = await db.insert(schema.tasks).values({
    projectId: project.id,
    parentId: null,
    wbsCode: "4",
    name: "Construction",
    description: "Site preparation, installation, and civil works",
    status: "in-progress",
    priority: "critical",
    progress: 65,
    startDate: new Date("2024-06-01"),
    endDate: new Date("2025-06-30"),
    estimatedHours: "48000",
    actualHours: "28800",
    createdBy: demoUser.id,
  }).returning();

  const [phase5] = await db.insert(schema.tasks).values({
    projectId: project.id,
    parentId: null,
    wbsCode: "5",
    name: "Commissioning & Handover",
    description: "Testing, commissioning, grid connection, and project handover",
    status: "not-started",
    priority: "high",
    progress: 0,
    startDate: new Date("2025-05-01"),
    endDate: new Date("2025-09-30"),
    estimatedHours: "3200",
    actualHours: "0",
    createdBy: demoUser.id,
  }).returning();

  console.log("✓ Created Level 1 phases");

  // Level 2: Phase 1 - Project Initiation
  const [task1_1] = await db.insert(schema.tasks).values({
    projectId: project.id,
    parentId: phase1.id,
    wbsCode: "1.1",
    name: "Feasibility Study",
    description: "Solar resource assessment and financial viability analysis",
    status: "completed",
    priority: "critical",
    progress: 100,
    startDate: new Date("2024-01-15"),
    endDate: new Date("2024-02-15"),
    estimatedHours: "480",
    actualHours: "460",
    createdBy: demoUser.id,
  }).returning();

  const [task1_2] = await db.insert(schema.tasks).values({
    projectId: project.id,
    parentId: phase1.id,
    wbsCode: "1.2",
    name: "Environmental Impact Assessment",
    description: "EIA study and regulatory approvals",
    status: "completed",
    priority: "high",
    progress: 100,
    startDate: new Date("2024-02-01"),
    endDate: new Date("2024-03-15"),
    estimatedHours: "720",
    actualHours: "780",
    createdBy: demoUser.id,
  }).returning();

  const [task1_3] = await db.insert(schema.tasks).values({
    projectId: project.id,
    parentId: phase1.id,
    wbsCode: "1.3",
    name: "Land Acquisition & Permits",
    description: "Land lease agreements and construction permits",
    status: "completed",
    priority: "critical",
    progress: 100,
    startDate: new Date("2024-02-15"),
    endDate: new Date("2024-03-31"),
    estimatedHours: "600",
    actualHours: "520",
    createdBy: demoUser.id,
  }).returning();

  // Level 2: Phase 2 - Engineering
  const [task2_1] = await db.insert(schema.tasks).values({
    projectId: project.id,
    parentId: phase2.id,
    wbsCode: "2.1",
    name: "Preliminary Design",
    description: "Conceptual layout and system sizing",
    status: "completed",
    priority: "high",
    progress: 100,
    startDate: new Date("2024-03-01"),
    endDate: new Date("2024-04-15"),
    estimatedHours: "960",
    actualHours: "1020",
    createdBy: demoUser.id,
  }).returning();

  const [task2_2] = await db.insert(schema.tasks).values({
    projectId: project.id,
    parentId: phase2.id,
    wbsCode: "2.2",
    name: "Detailed Engineering",
    description: "Complete design packages for all systems",
    status: "completed",
    priority: "critical",
    progress: 100,
    startDate: new Date("2024-04-01"),
    endDate: new Date("2024-06-15"),
    estimatedHours: "2400",
    actualHours: "2580",
    createdBy: demoUser.id,
  }).returning();

  const [task2_3] = await db.insert(schema.tasks).values({
    projectId: project.id,
    parentId: phase2.id,
    wbsCode: "2.3",
    name: "Grid Connection Design",
    description: "Substation and transmission line engineering",
    status: "completed",
    priority: "high",
    progress: 100,
    startDate: new Date("2024-05-01"),
    endDate: new Date("2024-06-30"),
    estimatedHours: "1200",
    actualHours: "1320",
    createdBy: demoUser.id,
  }).returning();

  // Level 2: Phase 3 - Procurement
  const [task3_1] = await db.insert(schema.tasks).values({
    projectId: project.id,
    parentId: phase3.id,
    wbsCode: "3.1",
    name: "Solar Panels Procurement",
    description: "Purchase of 150,000 monocrystalline panels (400W each)",
    status: "completed",
    priority: "critical",
    progress: 100,
    startDate: new Date("2024-04-01"),
    endDate: new Date("2024-06-30"),
    estimatedHours: "400",
    actualHours: "380",
    createdBy: demoUser.id,
  }).returning();

  const [task3_2] = await db.insert(schema.tasks).values({
    projectId: project.id,
    parentId: phase3.id,
    wbsCode: "3.2",
    name: "Inverter Systems",
    description: "Central inverters and string inverters procurement",
    status: "completed",
    priority: "high",
    progress: 100,
    startDate: new Date("2024-05-01"),
    endDate: new Date("2024-07-31"),
    estimatedHours: "320",
    actualHours: "300",
    createdBy: demoUser.id,
  }).returning();

  const [task3_3] = await db.insert(schema.tasks).values({
    projectId: project.id,
    parentId: phase3.id,
    wbsCode: "3.3",
    name: "Mounting Structures",
    description: "Tracker systems and fixed-tilt structures",
    status: "completed",
    priority: "high",
    progress: 100,
    startDate: new Date("2024-05-15"),
    endDate: new Date("2024-08-15"),
    estimatedHours: "480",
    actualHours: "440",
    createdBy: demoUser.id,
  }).returning();

  const [task3_4] = await db.insert(schema.tasks).values({
    projectId: project.id,
    parentId: phase3.id,
    wbsCode: "3.4",
    name: "Electrical Equipment",
    description: "Transformers, switchgear, and cables",
    status: "completed",
    priority: "high",
    progress: 100,
    startDate: new Date("2024-06-01"),
    endDate: new Date("2024-08-31"),
    estimatedHours: "400",
    actualHours: "400",
    createdBy: demoUser.id,
  }).returning();

  // Level 2: Phase 4 - Construction
  const [task4_1] = await db.insert(schema.tasks).values({
    projectId: project.id,
    parentId: phase4.id,
    wbsCode: "4.1",
    name: "Site Preparation",
    description: "Clearing, grading, and access roads",
    status: "completed",
    priority: "critical",
    progress: 100,
    startDate: new Date("2024-06-01"),
    endDate: new Date("2024-08-31"),
    estimatedHours: "4800",
    actualHours: "5200",
    createdBy: demoUser.id,
  }).returning();

  const [task4_2] = await db.insert(schema.tasks).values({
    projectId: project.id,
    parentId: phase4.id,
    wbsCode: "4.2",
    name: "Civil Works",
    description: "Foundations, drainage, and fencing",
    status: "completed",
    priority: "high",
    progress: 100,
    startDate: new Date("2024-08-01"),
    endDate: new Date("2024-11-30"),
    estimatedHours: "7200",
    actualHours: "7400",
    createdBy: demoUser.id,
  }).returning();

  const [task4_3] = await db.insert(schema.tasks).values({
    projectId: project.id,
    parentId: phase4.id,
    wbsCode: "4.3",
    name: "Mounting Structure Installation",
    description: "Tracker and fixed-mount assembly",
    status: "in-progress",
    priority: "critical",
    progress: 85,
    startDate: new Date("2024-10-01"),
    endDate: new Date("2025-02-28"),
    estimatedHours: "9600",
    actualHours: "7200",
    createdBy: demoUser.id,
  }).returning();

  const [task4_4] = await db.insert(schema.tasks).values({
    projectId: project.id,
    parentId: phase4.id,
    wbsCode: "4.4",
    name: "Panel Installation",
    description: "Solar panel mounting and connection",
    status: "in-progress",
    priority: "critical",
    progress: 55,
    startDate: new Date("2024-11-15"),
    endDate: new Date("2025-04-30"),
    estimatedHours: "14400",
    actualHours: "6600",
    createdBy: demoUser.id,
  }).returning();

  const [task4_5] = await db.insert(schema.tasks).values({
    projectId: project.id,
    parentId: phase4.id,
    wbsCode: "4.5",
    name: "Electrical Installation",
    description: "DC/AC wiring, inverters, and combiner boxes",
    status: "in-progress",
    priority: "high",
    progress: 40,
    startDate: new Date("2025-01-01"),
    endDate: new Date("2025-05-31"),
    estimatedHours: "8000",
    actualHours: "2400",
    createdBy: demoUser.id,
  }).returning();

  const [task4_6] = await db.insert(schema.tasks).values({
    projectId: project.id,
    parentId: phase4.id,
    wbsCode: "4.6",
    name: "Substation Construction",
    description: "Substation building and equipment installation",
    status: "review",
    priority: "critical",
    progress: 25,
    startDate: new Date("2024-12-01"),
    endDate: new Date("2025-06-30"),
    estimatedHours: "4000",
    actualHours: "1000",
    createdBy: demoUser.id,
  }).returning();

  // Level 2: Phase 5 - Commissioning
  const [task5_1] = await db.insert(schema.tasks).values({
    projectId: project.id,
    parentId: phase5.id,
    wbsCode: "5.1",
    name: "System Testing",
    description: "Electrical testing and safety inspections",
    status: "not-started",
    priority: "critical",
    progress: 0,
    startDate: new Date("2025-05-01"),
    endDate: new Date("2025-06-30"),
    estimatedHours: "1200",
    actualHours: "0",
    createdBy: demoUser.id,
  }).returning();

  const [task5_2] = await db.insert(schema.tasks).values({
    projectId: project.id,
    parentId: phase5.id,
    wbsCode: "5.2",
    name: "Grid Synchronization",
    description: "Grid connection and power quality testing",
    status: "not-started",
    priority: "critical",
    progress: 0,
    startDate: new Date("2025-06-15"),
    endDate: new Date("2025-08-15"),
    estimatedHours: "800",
    actualHours: "0",
    createdBy: demoUser.id,
  }).returning();

  const [task5_3] = await db.insert(schema.tasks).values({
    projectId: project.id,
    parentId: phase5.id,
    wbsCode: "5.3",
    name: "Performance Testing",
    description: "30-day performance guarantee test",
    status: "not-started",
    priority: "high",
    progress: 0,
    startDate: new Date("2025-07-15"),
    endDate: new Date("2025-08-31"),
    estimatedHours: "600",
    actualHours: "0",
    createdBy: demoUser.id,
  }).returning();

  const [task5_4] = await db.insert(schema.tasks).values({
    projectId: project.id,
    parentId: phase5.id,
    wbsCode: "5.4",
    name: "Training & Handover",
    description: "Operations training and documentation handover",
    status: "not-started",
    priority: "medium",
    progress: 0,
    startDate: new Date("2025-08-15"),
    endDate: new Date("2025-09-30"),
    estimatedHours: "600",
    actualHours: "0",
    createdBy: demoUser.id,
  }).returning();

  console.log("✓ Created Level 2 tasks");

  // Level 3: Detailed sub-tasks
  // 1.1.x - Feasibility Study details
  await db.insert(schema.tasks).values([
    {
      projectId: project.id,
      parentId: task1_1.id,
      wbsCode: "1.1.1",
      name: "Solar Resource Analysis",
      description: "GHI/DNI data analysis and PVsyst simulation",
      status: "completed",
      priority: "high",
      progress: 100,
      startDate: new Date("2024-01-15"),
      endDate: new Date("2024-01-31"),
      estimatedHours: "160",
      actualHours: "140",
      createdBy: demoUser.id,
    },
    {
      projectId: project.id,
      parentId: task1_1.id,
      wbsCode: "1.1.2",
      name: "Financial Modeling",
      description: "LCOE calculations and investment analysis",
      status: "completed",
      priority: "high",
      progress: 100,
      startDate: new Date("2024-02-01"),
      endDate: new Date("2024-02-15"),
      estimatedHours: "200",
      actualHours: "200",
      createdBy: demoUser.id,
    },
    {
      projectId: project.id,
      parentId: task1_1.id,
      wbsCode: "1.1.3",
      name: "Site Selection Report",
      description: "Final site recommendation with technical justification",
      status: "completed",
      priority: "medium",
      progress: 100,
      startDate: new Date("2024-02-05"),
      endDate: new Date("2024-02-15"),
      estimatedHours: "120",
      actualHours: "120",
      createdBy: demoUser.id,
    },
  ]);

  // 2.2.x - Detailed Engineering sub-tasks
  await db.insert(schema.tasks).values([
    {
      projectId: project.id,
      parentId: task2_2.id,
      wbsCode: "2.2.1",
      name: "Electrical Single Line Diagram",
      description: "Complete SLD with protection coordination",
      status: "completed",
      priority: "critical",
      progress: 100,
      startDate: new Date("2024-04-01"),
      endDate: new Date("2024-04-30"),
      estimatedHours: "320",
      actualHours: "340",
      createdBy: demoUser.id,
    },
    {
      projectId: project.id,
      parentId: task2_2.id,
      wbsCode: "2.2.2",
      name: "Cable Schedule & Routing",
      description: "DC and AC cable sizing and routing plans",
      status: "completed",
      priority: "high",
      progress: 100,
      startDate: new Date("2024-04-15"),
      endDate: new Date("2024-05-15"),
      estimatedHours: "400",
      actualHours: "420",
      createdBy: demoUser.id,
    },
    {
      projectId: project.id,
      parentId: task2_2.id,
      wbsCode: "2.2.3",
      name: "Civil & Structural Drawings",
      description: "Foundation designs and structural calculations",
      status: "completed",
      priority: "high",
      progress: 100,
      startDate: new Date("2024-05-01"),
      endDate: new Date("2024-06-15"),
      estimatedHours: "600",
      actualHours: "640",
      createdBy: demoUser.id,
    },
    {
      projectId: project.id,
      parentId: task2_2.id,
      wbsCode: "2.2.4",
      name: "SCADA & Monitoring Design",
      description: "Plant monitoring and control system design",
      status: "completed",
      priority: "medium",
      progress: 100,
      startDate: new Date("2024-05-15"),
      endDate: new Date("2024-06-15"),
      estimatedHours: "280",
      actualHours: "300",
      createdBy: demoUser.id,
    },
  ]);

  // 4.4.x - Panel Installation sub-tasks  
  const [task4_4_1] = await db.insert(schema.tasks).values({
    projectId: project.id,
    parentId: task4_4.id,
    wbsCode: "4.4.1",
    name: "Zone A Panel Installation",
    description: "Northern section - 50,000 panels",
    status: "completed",
    priority: "critical",
    progress: 100,
    startDate: new Date("2024-11-15"),
    endDate: new Date("2025-01-31"),
    estimatedHours: "4800",
    actualHours: "4600",
    createdBy: demoUser.id,
  }).returning();

  const [task4_4_2] = await db.insert(schema.tasks).values({
    projectId: project.id,
    parentId: task4_4.id,
    wbsCode: "4.4.2",
    name: "Zone B Panel Installation",
    description: "Central section - 50,000 panels",
    status: "in-progress",
    priority: "critical",
    progress: 60,
    startDate: new Date("2025-01-15"),
    endDate: new Date("2025-03-15"),
    estimatedHours: "4800",
    actualHours: "2000",
    createdBy: demoUser.id,
  }).returning();

  const [task4_4_3] = await db.insert(schema.tasks).values({
    projectId: project.id,
    parentId: task4_4.id,
    wbsCode: "4.4.3",
    name: "Zone C Panel Installation",
    description: "Southern section - 50,000 panels",
    status: "not-started",
    priority: "high",
    progress: 0,
    startDate: new Date("2025-03-01"),
    endDate: new Date("2025-04-30"),
    estimatedHours: "4800",
    actualHours: "0",
    createdBy: demoUser.id,
  }).returning();

  console.log("✓ Created Level 3 tasks");

  // Level 4 & 5: Deep hierarchy example
  await db.insert(schema.tasks).values([
    {
      projectId: project.id,
      parentId: task4_4_2.id,
      wbsCode: "4.4.2.1",
      name: "Zone B East Installation",
      description: "Eastern half of Zone B",
      status: "completed",
      priority: "high",
      progress: 100,
      startDate: new Date("2025-01-15"),
      endDate: new Date("2025-02-15"),
      estimatedHours: "2400",
      actualHours: "2000",
      createdBy: demoUser.id,
    },
    {
      projectId: project.id,
      parentId: task4_4_2.id,
      wbsCode: "4.4.2.2",
      name: "Zone B West Installation",
      description: "Western half of Zone B",
      status: "in-progress",
      priority: "critical",
      progress: 20,
      startDate: new Date("2025-02-15"),
      endDate: new Date("2025-03-15"),
      estimatedHours: "2400",
      actualHours: "0",
      createdBy: demoUser.id,
    },
  ]);

  console.log("✓ Created Level 4-5 tasks");

  // ============================================
  // TASK DEPENDENCIES - All Types
  // ============================================
  
  // Get all tasks for dependency mapping
  const allTasks = await db.query.tasks.findMany({
    where: eq(schema.tasks.projectId, project.id),
  });
  
  const getTaskByCode = (code: string) => allTasks.find(t => t.wbsCode === code);

  await db.insert(schema.taskDependencies).values([
    // FS (Finish-to-Start) - Most common
    { projectId: project.id, predecessorId: phase1.id, successorId: phase2.id, type: "FS", lagDays: 0 },
    { projectId: project.id, predecessorId: task1_1.id, successorId: task1_2.id, type: "FS", lagDays: 0 },
    { projectId: project.id, predecessorId: task1_2.id, successorId: task1_3.id, type: "FS", lagDays: -10 }, // Overlap
    { projectId: project.id, predecessorId: task2_1.id, successorId: task2_2.id, type: "FS", lagDays: 0 },
    { projectId: project.id, predecessorId: task4_1.id, successorId: task4_2.id, type: "FS", lagDays: 0 },
    { projectId: project.id, predecessorId: task4_2.id, successorId: task4_3.id, type: "FS", lagDays: -30 }, // Fast-track
    { projectId: project.id, predecessorId: task4_3.id, successorId: task4_4.id, type: "FS", lagDays: -15 },
    { projectId: project.id, predecessorId: task4_4.id, successorId: task4_5.id, type: "FS", lagDays: -30 },
    { projectId: project.id, predecessorId: task4_4_1.id, successorId: task4_4_2.id, type: "FS", lagDays: -15 },
    { projectId: project.id, predecessorId: task4_4_2.id, successorId: task4_4_3.id, type: "FS", lagDays: -15 },
    { projectId: project.id, predecessorId: phase4.id, successorId: phase5.id, type: "FS", lagDays: -30 },
    { projectId: project.id, predecessorId: task5_1.id, successorId: task5_2.id, type: "FS", lagDays: 0 },
    { projectId: project.id, predecessorId: task5_2.id, successorId: task5_3.id, type: "FS", lagDays: 0 },
    { projectId: project.id, predecessorId: task5_3.id, successorId: task5_4.id, type: "FS", lagDays: 0 },
    
    // SS (Start-to-Start) - Parallel work
    { projectId: project.id, predecessorId: phase2.id, successorId: phase3.id, type: "SS", lagDays: 30 },
    { projectId: project.id, predecessorId: task2_2.id, successorId: task2_3.id, type: "SS", lagDays: 30 },
    { projectId: project.id, predecessorId: task3_1.id, successorId: task3_2.id, type: "SS", lagDays: 30 },
    { projectId: project.id, predecessorId: task3_2.id, successorId: task3_3.id, type: "SS", lagDays: 15 },
    
    // FF (Finish-to-Finish) - Must finish together
    { projectId: project.id, predecessorId: task3_3.id, successorId: task3_4.id, type: "FF", lagDays: 0 },
    { projectId: project.id, predecessorId: task4_5.id, successorId: task4_6.id, type: "FF", lagDays: 0 },
    
    // SF (Start-to-Finish) - Rare but valid
    { projectId: project.id, predecessorId: task4_4.id, successorId: task3_4.id, type: "SF", lagDays: 0 },
  ]);

  console.log("✓ Created task dependencies (FS, SS, FF, SF types)");

  // ============================================
  // STAKEHOLDERS
  // ============================================
  
  await db.insert(schema.stakeholders).values([
    {
      projectId: project.id,
      name: "Jennifer Martinez",
      email: "j.martinez@riversideutility.com",
      phone: "+1-555-0201",
      organization: "Riverside Utility Company",
      role: "sponsor",
      influence: 5,
      interest: 5,
      notes: "Primary project sponsor and off-taker. PPA signed for 25 years at $0.045/kWh",
    },
    {
      projectId: project.id,
      name: "Michael Chen",
      email: "m.chen@greenenergy.com",
      phone: "+1-555-0202",
      organization: "GreenEnergy Solar Inc.",
      role: "team-member",
      influence: 5,
      interest: 5,
      notes: "EPC Project Director with 15+ years solar experience",
    },
    {
      projectId: project.id,
      name: "Sarah Johnson",
      email: "s.johnson@sunpower.com",
      phone: "+1-555-0203",
      organization: "SunPower Technologies",
      role: "contractor",
      influence: 4,
      interest: 5,
      notes: "Solar panel supplier - 150,000 monocrystalline modules",
    },
    {
      projectId: project.id,
      name: "Robert Williams",
      email: "r.williams@invertech.com",
      phone: "+1-555-0204",
      organization: "InverTech Systems",
      role: "contractor",
      influence: 3,
      interest: 4,
      notes: "Central inverter supplier and commissioning support",
    },
    {
      projectId: project.id,
      name: "Patricia Anderson",
      email: "p.anderson@county.gov",
      phone: "+1-555-0205",
      organization: "Riverside County Planning",
      role: "other",
      influence: 4,
      interest: 3,
      notes: "Land use permits and environmental compliance officer (Regulator)",
    },
    {
      projectId: project.id,
      name: "David Thompson",
      email: "d.thompson@gridops.com",
      phone: "+1-555-0206",
      organization: "State Grid Operations",
      role: "other",
      influence: 5,
      interest: 4,
      notes: "Grid interconnection approval and commissioning witness (Regulator)",
    },
    {
      projectId: project.id,
      name: "Emily Davis",
      email: "e.davis@solarfinance.com",
      phone: "+1-555-0207",
      organization: "Solar Finance Partners",
      role: "client",
      influence: 4,
      interest: 5,
      notes: "Lead financial investor - $50M project financing",
    },
    {
      projectId: project.id,
      name: "James Wilson",
      email: "j.wilson@buildright.com",
      phone: "+1-555-0208",
      organization: "BuildRight Construction",
      role: "contractor",
      influence: 4,
      interest: 5,
      notes: "Civil works and balance of plant contractor",
    },
    {
      projectId: project.id,
      name: "Lisa Brown",
      email: "l.brown@econsult.com",
      phone: "+1-555-0209",
      organization: "Environmental Consultants Inc.",
      role: "consultant",
      influence: 3,
      interest: 4,
      notes: "EIA study and environmental monitoring",
    },
    {
      projectId: project.id,
      name: "Mark Garcia",
      email: "m.garcia@localcomm.org",
      phone: "+1-555-0210",
      organization: "Riverside Community Association",
      role: "other",
      influence: 2,
      interest: 4,
      notes: "Community liaison - addressing local concerns and employment",
    },
  ]);

  console.log("✓ Created stakeholders");

  // ============================================
  // RISKS
  // ============================================
  
  await db.insert(schema.risks).values([
    {
      projectId: project.id,
      code: "RISK-001",
      title: "Supply Chain Delays for Solar Panels",
      description: "Global semiconductor shortage affecting panel manufacturing lead times. Current wait time is 16 weeks vs. planned 10 weeks. Contingency: Negotiate with secondary suppliers in Southeast Asia.",
      category: "schedule",
      status: "closed",
      probability: 4,
      impact: "high",
      mitigationPlan: "Pre-order 110% of required panels, diversify suppliers across 3 manufacturers, expedited shipping for critical batches",
      owner: demoUser.id,
    },
    {
      projectId: project.id,
      code: "RISK-002",
      title: "Grid Interconnection Approval Delays",
      description: "Utility company approval process may take longer due to grid capacity studies and upgrade requirements. Contingency: Install battery storage for energy curtailment.",
      category: "technical",
      status: "mitigating",
      probability: 3,
      impact: "critical",
      mitigationPlan: "Early engagement with utility (6 months ahead), hire experienced grid consultant, pre-submit documentation",
      owner: demoUser.id,
    },
    {
      projectId: project.id,
      code: "RISK-003",
      title: "Extreme Weather Events",
      description: "Construction delays due to heat waves, dust storms, or unexpected rainfall affecting site work. Contingency: Increase crew size for acceleration.",
      category: "schedule",
      status: "assessed",
      probability: 3,
      impact: "medium",
      mitigationPlan: "Build 15% schedule contingency, schedule critical activities in mild weather months, install temporary weather shelters",
    },
    {
      projectId: project.id,
      code: "RISK-004",
      title: "Steel Price Volatility",
      description: "Mounting structure steel costs have increased 25% YoY, may continue rising due to tariffs. Contingency: Value engineering to reduce steel usage.",
      category: "financial",
      status: "mitigating",
      probability: 4,
      impact: "medium",
      mitigationPlan: "Lock in steel prices with 60% deposit, hedge remaining 40% with futures contracts",
    },
    {
      projectId: project.id,
      code: "RISK-005",
      title: "Skilled Labor Shortage",
      description: "Regional competition for electrical workers due to multiple solar projects in the area. Contingency: Bring in crews from other regions.",
      category: "resource",
      status: "mitigating",
      probability: 4,
      impact: "high",
      mitigationPlan: "Early recruitment (6 months ahead), partner with local technical schools, offer competitive wages and housing",
      owner: demoUser.id,
    },
    {
      projectId: project.id,
      code: "RISK-006",
      title: "Environmental Compliance Issues",
      description: "Discovery of protected species habitat could trigger additional studies and mitigation requirements. Contingency: Relocate affected areas.",
      category: "regulatory",
      status: "assessed",
      probability: 2,
      impact: "high",
      mitigationPlan: "Comprehensive pre-construction surveys, wildlife monitoring during construction, designated exclusion zones",
    },
    {
      projectId: project.id,
      code: "RISK-007",
      title: "Inverter Technology Obsolescence",
      description: "Rapid technology changes may make selected inverter model outdated by commissioning",
      category: "technical",
      status: "assessed",
      probability: 2,
      impact: "low",
      mitigationPlan: "Select proven technology with 10+ year track record, ensure firmware upgrade path, secure long-term service agreement",
    },
    {
      projectId: project.id,
      code: "RISK-008",
      title: "Financing Cost Increase",
      description: "Interest rate hikes could increase project financing costs and affect IRR. Contingency: Renegotiate PPA pricing, reduce scope.",
      category: "financial",
      status: "closed",
      probability: 3,
      impact: "medium",
      mitigationPlan: "Lock in fixed-rate financing early, maintain strong relationship with multiple lenders",
    },
  ]);

  console.log("✓ Created risks");

  // ============================================
  // ISSUES
  // ============================================
  
  await db.insert(schema.issues).values([
    {
      projectId: project.id,
      code: "ISS-001",
      title: "Transformer Delivery Delayed 6 Weeks",
      description: "Main power transformer from ABB has been delayed due to factory capacity constraints. Originally scheduled for delivery in December, now expected mid-January.",
      status: "in-progress",
      priority: "critical",
      category: "technical",
      assignedTo: demoUser.id,
      reportedBy: demoUser.id,
      reportedDate: new Date("2024-11-15"),
    },
    {
      projectId: project.id,
      code: "ISS-002",
      title: "Underground Cable Route Conflict",
      description: "Utility survey discovered existing gas line in planned DC cable route. Requires re-routing approximately 500m of cable trench.",
      status: "in-progress",
      priority: "high",
      category: "technical",
      assignedTo: demoUser.id,
      reportedBy: demoUser.id,
      reportedDate: new Date("2024-10-20"),
    },
    {
      projectId: project.id,
      code: "ISS-003",
      title: "Worker Safety Incident - Heat Exhaustion",
      description: "Two workers hospitalized for heat exhaustion during August heat wave. No permanent injuries. OSHA notification submitted.",
      status: "resolved",
      priority: "critical",
      category: "safety",
      reportedBy: demoUser.id,
      reportedDate: new Date("2024-08-12"),
      resolvedDate: new Date("2024-08-20"),
      resolution: "Implemented mandatory 15-min breaks every hour when temp >100°F, installed additional shade structures, distributed electrolyte drinks",
    },
    {
      projectId: project.id,
      code: "ISS-004",
      title: "Panel Micro-Crack Defects in Batch 23",
      description: "Quality inspection revealed micro-cracks in 2,400 panels from manufacturing batch 23. Potential power degradation over time.",
      status: "resolved",
      priority: "high",
      category: "quality",
      reportedBy: demoUser.id,
      reportedDate: new Date("2024-12-01"),
      resolvedDate: new Date("2024-12-15"),
      resolution: "Supplier replaced all affected panels at no cost. Implemented enhanced receiving inspection with EL testing.",
    },
    {
      projectId: project.id,
      code: "ISS-005",
      title: "Permit Amendment Required for Substation",
      description: "County requires amended building permit due to design changes in substation control building. 3-week processing time expected.",
      status: "in-progress",
      priority: "medium",
      category: "regulatory",
      assignedTo: demoUser.id,
      reportedBy: demoUser.id,
      reportedDate: new Date("2025-01-10"),
    },
    {
      projectId: project.id,
      code: "ISS-006",
      title: "Access Road Erosion After Storm",
      description: "Heavy rainfall caused significant erosion on main site access road. Road partially impassable for heavy equipment.",
      status: "resolved",
      priority: "high",
      category: "environmental",
      reportedBy: demoUser.id,
      reportedDate: new Date("2024-09-25"),
      resolvedDate: new Date("2024-10-02"),
      resolution: "Emergency grading and gravel replacement. Installed additional drainage culverts to prevent recurrence.",
    },
    {
      projectId: project.id,
      code: "ISS-007",
      title: "String Inverter Firmware Bug",
      description: "String inverters exhibit intermittent communication loss with monitoring system. Vendor investigating firmware issue.",
      status: "open",
      priority: "medium",
      category: "technical",
      reportedBy: demoUser.id,
      reportedDate: new Date("2025-01-20"),
    },
  ]);

  console.log("✓ Created issues");

  // ============================================
  // COST ITEMS
  // ============================================
  
  await db.insert(schema.costItems).values([
    // Engineering & Design
    {
      projectId: project.id,
      category: "labor",
      description: "Engineering & Design Services",
      budgeted: "2500000",
      actual: "2650000",
      currency: "USD",
      date: new Date("2024-06-30"),
    },
    {
      projectId: project.id,
      category: "labor",
      description: "Project Management & Supervision",
      budgeted: "3000000",
      actual: "1800000",
      currency: "USD",
      date: new Date("2025-01-31"),
    },
    // Equipment - Solar Panels
    {
      projectId: project.id,
      category: "materials",
      description: "Solar Panels (150,000 x 400W Mono)",
      budgeted: "22500000",
      actual: "21200000",
      currency: "USD",
      date: new Date("2024-08-31"),
    },
    // Equipment - Inverters
    {
      projectId: project.id,
      category: "equipment",
      description: "Central Inverters (10 x 5MW)",
      budgeted: "5000000",
      actual: "4800000",
      currency: "USD",
      date: new Date("2024-07-31"),
    },
    // Mounting Structures
    {
      projectId: project.id,
      category: "materials",
      description: "Tracking Systems & Fixed Mounts",
      budgeted: "12000000",
      actual: "12800000",
      currency: "USD",
      date: new Date("2024-08-31"),
    },
    // Electrical Balance of System
    {
      projectId: project.id,
      category: "materials",
      description: "Cables, Combiner Boxes, Switchgear",
      budgeted: "4500000",
      actual: "2100000",
      currency: "USD",
      date: new Date("2025-01-31"),
    },
    // Transformer & Substation
    {
      projectId: project.id,
      category: "equipment",
      description: "Substation Equipment & Transformers",
      budgeted: "6000000",
      actual: "1500000",
      currency: "USD",
      date: new Date("2025-01-31"),
    },
    // Civil Works
    {
      projectId: project.id,
      category: "labor",
      description: "Site Preparation & Civil Works",
      budgeted: "5500000",
      actual: "5200000",
      currency: "USD",
      date: new Date("2024-11-30"),
    },
    // Installation Labor
    {
      projectId: project.id,
      category: "labor",
      description: "Panel & Electrical Installation",
      budgeted: "7000000",
      actual: "3200000",
      currency: "USD",
      date: new Date("2025-01-31"),
    },
    // Grid Connection
    {
      projectId: project.id,
      category: "equipment",
      description: "Grid Connection & Transmission Line",
      budgeted: "3500000",
      actual: "500000",
      currency: "USD",
      date: new Date("2025-01-31"),
    },
    // Contingency
    {
      projectId: project.id,
      category: "contingency",
      description: "Project Contingency Reserve",
      budgeted: "3500000",
      actual: "850000",
      currency: "USD",
      date: new Date("2025-01-31"),
    },
  ]);

  console.log("✓ Created cost items");

  // ============================================
  // RESOURCES
  // ============================================
  
  const resources = await db.insert(schema.resources).values([
    // Project Management
    {
      projectId: project.id,
      name: "Project Director - Michael Chen",
      type: "human",
      discipline: "general",
      costPerHour: "175.00",
      availability: 100,
    },
    {
      projectId: project.id,
      name: "Project Manager - Sarah Johnson",
      type: "human",
      discipline: "general",
      costPerHour: "150.00",
      availability: 100,
    },
    {
      projectId: project.id,
      name: "Construction Manager - James Rodriguez",
      type: "human",
      discipline: "civil",
      costPerHour: "140.00",
      availability: 100,
    },
    {
      projectId: project.id,
      name: "HSE Manager - Lisa Wang",
      type: "human",
      discipline: "general",
      costPerHour: "125.00",
      availability: 100,
    },
    // Engineering Team
    {
      projectId: project.id,
      name: "Lead Electrical Engineer - David Kim",
      type: "human",
      discipline: "electrical",
      costPerHour: "130.00",
      availability: 100,
    },
    {
      projectId: project.id,
      name: "Senior Mechanical Engineer - Ahmed Hassan",
      type: "human",
      discipline: "mechanical",
      costPerHour: "120.00",
      availability: 100,
    },
    {
      projectId: project.id,
      name: "Civil Engineer - Patricia Martinez",
      type: "human",
      discipline: "civil",
      costPerHour: "115.00",
      availability: 100,
    },
    {
      projectId: project.id,
      name: "Instrumentation Engineer - Robert Chen",
      type: "human",
      discipline: "instrumentation",
      costPerHour: "125.00",
      availability: 100,
    },
    {
      projectId: project.id,
      name: "SCADA Specialist - Emily Taylor",
      type: "human",
      discipline: "instrumentation",
      costPerHour: "135.00",
      availability: 80,
    },
    // Construction Crews
    {
      projectId: project.id,
      name: "Solar Installation Crew A (8 workers)",
      type: "human",
      discipline: "electrical",
      costPerHour: "520.00",
      availability: 100,
    },
    {
      projectId: project.id,
      name: "Solar Installation Crew B (8 workers)",
      type: "human",
      discipline: "electrical",
      costPerHour: "520.00",
      availability: 100,
    },
    {
      projectId: project.id,
      name: "Electrical Installation Team (6 workers)",
      type: "human",
      discipline: "electrical",
      costPerHour: "510.00",
      availability: 100,
    },
    {
      projectId: project.id,
      name: "Civil Works Crew (10 workers)",
      type: "human",
      discipline: "civil",
      costPerHour: "550.00",
      availability: 100,
    },
    {
      projectId: project.id,
      name: "Structural Steel Team (6 workers)",
      type: "human",
      discipline: "structural",
      costPerHour: "480.00",
      availability: 90,
    },
    {
      projectId: project.id,
      name: "Cable Pulling Team (4 workers)",
      type: "human",
      discipline: "electrical",
      costPerHour: "320.00",
      availability: 100,
    },
    // Equipment
    {
      projectId: project.id,
      name: "Mobile Crane 100T - Liebherr LTM 1100",
      type: "equipment",
      discipline: "civil",
      costPerHour: "350.00",
      availability: 80,
    },
    {
      projectId: project.id,
      name: "Excavator CAT 320D",
      type: "equipment",
      discipline: "civil",
      costPerHour: "145.00",
      availability: 90,
    },
    {
      projectId: project.id,
      name: "Excavator CAT 325D",
      type: "equipment",
      discipline: "civil",
      costPerHour: "165.00",
      availability: 85,
    },
    {
      projectId: project.id,
      name: "Bulldozer CAT D6",
      type: "equipment",
      discipline: "civil",
      costPerHour: "185.00",
      availability: 90,
    },
    {
      projectId: project.id,
      name: "Concrete Pump Truck",
      type: "equipment",
      discipline: "civil",
      costPerHour: "275.00",
      availability: 75,
    },
    {
      projectId: project.id,
      name: "Cable Pulling Machine - Greenlee 6001",
      type: "equipment",
      discipline: "electrical",
      costPerHour: "95.00",
      availability: 100,
    },
    {
      projectId: project.id,
      name: "Aerial Work Platform - JLG 860SJ",
      type: "equipment",
      discipline: "electrical",
      costPerHour: "85.00",
      availability: 95,
    },
    // Materials (bulk items tracked as resources)
    {
      projectId: project.id,
      name: "Solar Panel Inventory (monocrystalline 400W)",
      type: "material",
      discipline: "electrical",
      costPerHour: "0.00",
      availability: 100,
    },
    {
      projectId: project.id,
      name: "DC Cable Stock (1000V rated)",
      type: "material",
      discipline: "electrical",
      costPerHour: "0.00",
      availability: 100,
    },
  ]).returning();

  console.log("✓ Created resources");

  // Resource Assignments - indices: 
  // 0: Project Director, 1: Project Manager, 2: Construction Manager, 3: HSE Manager
  // 4: Lead Electrical Engineer, 5: Senior Mechanical Engineer, 6: Civil Engineer
  // 7: Instrumentation Engineer, 8: SCADA Specialist
  // 9: Solar Crew A, 10: Solar Crew B, 11: Electrical Team, 12: Civil Crew
  // 13: Structural Steel Team, 14: Cable Pulling Team
  // 15: Crane, 16: Excavator 320D, 17: Excavator 325D, 18: Bulldozer
  // 19: Concrete Pump, 20: Cable Puller, 21: Aerial Platform
  // 22: Solar Panel Inventory, 23: DC Cable Stock
  await db.insert(schema.resourceAssignments).values([
    // Phase 4.1 Site Preparation
    {
      taskId: task4_1.id,
      resourceId: resources[2].id, // Construction Manager
      allocation: 50,
    },
    {
      taskId: task4_1.id,
      resourceId: resources[12].id, // Civil Works Crew
      allocation: 100,
    },
    {
      taskId: task4_1.id,
      resourceId: resources[16].id, // Excavator 320D
      allocation: 100,
    },
    {
      taskId: task4_1.id,
      resourceId: resources[18].id, // Bulldozer
      allocation: 100,
    },
    // Phase 4.2 Civil Works
    {
      taskId: task4_2.id,
      resourceId: resources[6].id, // Civil Engineer
      allocation: 100,
    },
    {
      taskId: task4_2.id,
      resourceId: resources[12].id, // Civil Works Crew
      allocation: 100,
    },
    {
      taskId: task4_2.id,
      resourceId: resources[19].id, // Concrete Pump
      allocation: 80,
    },
    // Phase 4.3 Mounting Structure Installation
    {
      taskId: task4_3.id,
      resourceId: resources[13].id, // Structural Steel Team
      allocation: 100,
    },
    {
      taskId: task4_3.id,
      resourceId: resources[15].id, // Mobile Crane
      allocation: 80,
    },
    // Phase 4.4 Panel Installation
    {
      taskId: task4_4.id,
      resourceId: resources[4].id, // Lead Electrical Engineer
      allocation: 50,
    },
    {
      taskId: task4_4.id,
      resourceId: resources[9].id, // Solar Installation Crew A
      allocation: 100,
    },
    {
      taskId: task4_4.id,
      resourceId: resources[10].id, // Solar Installation Crew B
      allocation: 100,
    },
    {
      taskId: task4_4.id,
      resourceId: resources[21].id, // Aerial Work Platform
      allocation: 100,
    },
    // Phase 4.5 Electrical Installation
    {
      taskId: task4_5.id,
      resourceId: resources[4].id, // Lead Electrical Engineer
      allocation: 100,
    },
    {
      taskId: task4_5.id,
      resourceId: resources[11].id, // Electrical Installation Team
      allocation: 100,
    },
    {
      taskId: task4_5.id,
      resourceId: resources[14].id, // Cable Pulling Team
      allocation: 100,
    },
    {
      taskId: task4_5.id,
      resourceId: resources[20].id, // Cable Pulling Machine
      allocation: 100,
    },
    // Phase 4.6 Substation Construction
    {
      taskId: task4_6.id,
      resourceId: resources[7].id, // Instrumentation Engineer
      allocation: 75,
    },
    {
      taskId: task4_6.id,
      resourceId: resources[15].id, // Mobile Crane
      allocation: 50,
    },
    // Phase 5 Commissioning - future assignments
    {
      taskId: task5_1.id,
      resourceId: resources[4].id, // Lead Electrical Engineer
      allocation: 100,
    },
    {
      taskId: task5_1.id,
      resourceId: resources[8].id, // SCADA Specialist
      allocation: 100,
    },
  ]);

  console.log("✓ Created resource assignments");

  console.log("\n🎉 Demo Solar Project seeded successfully!");
  console.log(`   Organization: ${demoOrg.name} (${demoOrg.slug})`);
  console.log(`   Project: ${project.name}`);
  console.log("   - 5 phases with 30+ tasks across 5 WBS levels");
  console.log("   - 22 task dependencies (FS, SS, FF, SF)");
  console.log("   - 10 stakeholders");
  console.log("   - 8 risks");
  console.log("   - 7 issues");
  console.log("   - 11 cost items ($75M budget)");
  console.log("   - 24 EPC resources (management, engineering, crews, equipment, materials)");
  console.log("   - 20 resource assignments across construction phases");
}

export { seedDemoProject, DEMO_ORG_SLUG, DEMO_USER_ID };

// Run via: npx tsx server/seed-demo.ts --run
const args = process.argv.slice(2);
if (args.includes("--run")) {
  seedDemoProject()
    .catch((error) => {
      console.error("❌ Error seeding demo project:", error);
      process.exit(1);
    })
    .then(() => {
      process.exit(0);
    });
}
