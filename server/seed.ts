import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "@shared/schema";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

async function seed() {
  console.log("🌱 Seeding database...");

  // Create sample organization
  const [org] = await db.insert(schema.organizations).values({
    name: "ACME Construction Corp",
    slug: "acme-construction",
  }).returning();

  console.log("✓ Created organization:", org.name);

  // Create sample user (will be replaced by Replit Auth)
  const [user] = await db.insert(schema.users).values({
    id: "demo-user-123",
    email: "demo@example.com",
    firstName: "John",
    lastName: "Demo",
  }).returning();

  console.log("✓ Created demo user:", user.email);

  // Link user to organization
  await db.insert(schema.userOrganizations).values({
    userId: user.id,
    organizationId: org.id,
    role: "owner",
  });

  // Create sample projects
  const [project1] = await db.insert(schema.projects).values({
    organizationId: org.id,
    name: "Downtown Office Complex",
    code: "PRJ-001",
    description: "15-story mixed-use development in downtown district",
    status: "active",
    startDate: new Date("2024-01-15"),
    endDate: new Date("2025-12-31"),
    budget: "45000000",
    currency: "USD",
  }).returning();

  const [project2] = await db.insert(schema.projects).values({
    organizationId: org.id,
    name: "Industrial Warehouse Retrofit",
    code: "PRJ-002",
    description: "Modernization of 50,000 sq ft warehouse facility",
    status: "active",
    startDate: new Date("2024-03-01"),
    endDate: new Date("2024-11-30"),
    budget: "8500000",
    currency: "USD",
  }).returning();

  console.log("✓ Created projects:", project1.name, project2.name);

  // Create WBS tasks for Project 1
  const tasks = [];
  
  // Level 1: Main phases
  const [phase1] = await db.insert(schema.tasks).values({
    projectId: project1.id,
    parentId: null,
    wbsCode: "1.0",
    name: "Planning & Design",
    description: "Initial project planning and architectural design",
    status: "completed",
    priority: "high",
    progress: 100,
    startDate: new Date("2024-01-15"),
    endDate: new Date("2024-04-30"),
    estimatedHours: "2400",
    actualHours: "2350",
    createdBy: user.id,
  }).returning();

  const [phase2] = await db.insert(schema.tasks).values({
    projectId: project1.id,
    parentId: null,
    wbsCode: "2.0",
    name: "Site Preparation",
    description: "Site clearing and foundation work",
    status: "in-progress",
    priority: "critical",
    progress: 65,
    startDate: new Date("2024-05-01"),
    endDate: new Date("2024-08-31"),
    estimatedHours: "3200",
    actualHours: "2100",
    createdBy: user.id,
  }).returning();

  const [phase3] = await db.insert(schema.tasks).values({
    projectId: project1.id,
    parentId: null,
    wbsCode: "3.0",
    name: "Structural Construction",
    description: "Building core structure and framework",
    status: "not-started",
    priority: "high",
    progress: 0,
    startDate: new Date("2024-09-01"),
    endDate: new Date("2025-06-30"),
    estimatedHours: "8000",
    actualHours: "0",
    createdBy: user.id,
  }).returning();

  // Level 2: Sub-tasks
  await db.insert(schema.tasks).values([
    {
      projectId: project1.id,
      parentId: phase1.id,
      wbsCode: "1.1",
      name: "Architectural Plans",
      description: "Complete architectural design and blueprints",
      status: "completed",
      priority: "high",
      progress: 100,
      startDate: new Date("2024-01-15"),
      endDate: new Date("2024-03-15"),
      estimatedHours: "800",
      actualHours: "780",
      createdBy: user.id,
    },
    {
      projectId: project1.id,
      parentId: phase1.id,
      wbsCode: "1.2",
      name: "Engineering Review",
      description: "Structural engineering approval",
      status: "completed",
      priority: "medium",
      progress: 100,
      startDate: new Date("2024-03-16"),
      endDate: new Date("2024-04-30"),
      estimatedHours: "600",
      actualHours: "570",
      createdBy: user.id,
    },
    {
      projectId: project1.id,
      parentId: phase2.id,
      wbsCode: "2.1",
      name: "Site Clearing",
      description: "Remove existing structures and debris",
      status: "completed",
      priority: "critical",
      progress: 100,
      startDate: new Date("2024-05-01"),
      endDate: new Date("2024-05-31"),
      estimatedHours: "600",
      actualHours: "620",
      createdBy: user.id,
    },
    {
      projectId: project1.id,
      parentId: phase2.id,
      wbsCode: "2.2",
      name: "Foundation Excavation",
      description: "Excavate and prepare foundation",
      status: "in-progress",
      priority: "critical",
      progress: 75,
      startDate: new Date("2024-06-01"),
      endDate: new Date("2024-07-15"),
      estimatedHours: "1200",
      actualHours: "900",
      createdBy: user.id,
    },
    {
      projectId: project1.id,
      parentId: phase2.id,
      wbsCode: "2.3",
      name: "Concrete Foundation",
      description: "Pour and cure foundation concrete",
      status: "review",
      priority: "high",
      progress: 30,
      startDate: new Date("2024-07-16"),
      endDate: new Date("2024-08-31"),
      estimatedHours: "1400",
      actualHours: "580",
      assignedTo: user.id,
      createdBy: user.id,
    },
  ]);

  console.log("✓ Created WBS task hierarchy");

  // Create task dependencies
  await db.insert(schema.taskDependencies).values([
    {
      projectId: project1.id,
      predecessorId: phase1.id,
      successorId: phase2.id,
      type: "FS",
      lagDays: 0,
    },
    {
      projectId: project1.id,
      predecessorId: phase2.id,
      successorId: phase3.id,
      type: "FS",
      lagDays: 0,
    },
  ]);

  console.log("✓ Created task dependencies");

  // Create stakeholders
  await db.insert(schema.stakeholders).values([
    {
      projectId: project1.id,
      name: "Sarah Mitchell",
      email: "sarah.mitchell@client.com",
      phone: "+1-555-0101",
      organization: "City Planning Commission",
      role: "sponsor",
      influence: 5,
      interest: 5,
      notes: "Primary project sponsor and decision maker",
    },
    {
      projectId: project1.id,
      name: "David Chen",
      email: "david.chen@contractor.com",
      phone: "+1-555-0102",
      organization: "BuildRight Construction",
      role: "contractor",
      influence: 4,
      interest: 5,
      notes: "Lead general contractor",
    },
    {
      projectId: project1.id,
      name: "Lisa Thompson",
      email: "lisa.thompson@architect.com",
      organization: "Thompson Architecture",
      role: "consultant",
      influence: 3,
      interest: 4,
      notes: "Lead architect",
    },
  ]);

  console.log("✓ Created stakeholders");

  // Create risks
  await db.insert(schema.risks).values([
    {
      projectId: project1.id,
      code: "RSK-001",
      title: "Weather Delays",
      description: "Severe weather could delay foundation work during winter months",
      category: "schedule",
      status: "mitigating",
      probability: 4,
      impact: "high",
      mitigationPlan: "Schedule critical foundation work for summer months, maintain buffer time",
      owner: user.id,
    },
    {
      projectId: project1.id,
      code: "RSK-002",
      title: "Material Cost Escalation",
      description: "Steel and concrete prices may increase due to supply chain issues",
      category: "financial",
      status: "assessed",
      probability: 3,
      impact: "medium",
      mitigationPlan: "Lock in pricing with suppliers, explore alternative materials",
    },
  ]);

  console.log("✓ Created risks");

  // Create issues
  await db.insert(schema.issues).values([
    {
      projectId: project1.id,
      code: "ISS-001",
      title: "Permit Approval Delay",
      description: "Building permit approval taking longer than expected",
      status: "in-progress",
      priority: "high",
      category: "regulatory",
      assignedTo: user.id,
      reportedBy: user.id,
      reportedDate: new Date("2024-06-15"),
    },
    {
      projectId: project1.id,
      code: "ISS-002",
      title: "Equipment Breakdown",
      description: "Primary excavator requires unexpected repairs",
      status: "resolved",
      priority: "medium",
      category: "technical",
      reportedBy: user.id,
      reportedDate: new Date("2024-07-01"),
      resolvedDate: new Date("2024-07-05"),
      resolution: "Rented replacement equipment, original excavator repaired",
    },
  ]);

  console.log("✓ Created issues");

  // Create cost items
  await db.insert(schema.costItems).values([
    {
      projectId: project1.id,
      category: "labor",
      description: "Engineering design team",
      budgeted: "800000",
      actual: "785000",
      currency: "USD",
      date: new Date("2024-04-30"),
    },
    {
      projectId: project1.id,
      category: "materials",
      description: "Foundation concrete and rebar",
      budgeted: "1200000",
      actual: "950000",
      currency: "USD",
      date: new Date("2024-08-15"),
    },
    {
      projectId: project1.id,
      category: "equipment",
      description: "Excavation equipment rental",
      budgeted: "150000",
      actual: "165000",
      currency: "USD",
      date: new Date("2024-07-31"),
    },
    {
      projectId: project1.id,
      category: "overhead",
      description: "Project management and admin",
      budgeted: "500000",
      actual: "325000",
      currency: "USD",
      date: new Date("2024-08-31"),
    },
  ]);

  console.log("✓ Created cost items");

  console.log("🎉 Database seeding completed successfully!");
}

seed()
  .catch((error) => {
    console.error("❌ Error seeding database:", error);
    process.exit(1);
  })
  .then(() => {
    process.exit(0);
  });
