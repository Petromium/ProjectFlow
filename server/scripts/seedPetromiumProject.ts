/**
 * Comprehensive Seeding Script for Petromium Drilling Project
 * 
 * This script:
 * 1. Creates/finds Petromium organization
 * 2. Creates/finds Drilling & Workover Department program
 * 3. Imports the Sample_Drilling.json project
 * 4. Seeds 50 Lessons Learned
 * 5. Adds tags and assigns them to entities
 * 6. Enhances tasks with resources, dependencies, schedules
 * 7. Adds resources (crew, equipment, materials)
 * 8. Enhances stakeholders with communication preferences
 * 9. Adds communication metrics
 * 10. Adds additional cost items
 */

import "dotenv/config";
import { readFileSync } from "fs";
import { join } from "path";
import { DatabaseStorage } from "../storage.js";
import { pool } from "../db.js";
import type {
  InsertOrganization,
  InsertProgram,
  InsertProject,
  InsertTask,
  InsertRisk,
  InsertIssue,
  InsertStakeholder,
  InsertCostItem,
  InsertTag,
  InsertTagAssignment,
  InsertLessonLearned,
  InsertResource,
  InsertResourceAssignment,
  InsertCommunicationMetrics,
} from "@shared/schema";

const storage = new DatabaseStorage();

// Helper to generate slug from name
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

// Helper to get parent WBS code
function getParentWbsCode(wbsCode: string): string | null {
  const parts = wbsCode.split(".");
  if (parts.length <= 1) return null;
  return parts.slice(0, -1).join(".");
}

async function main() {
  console.log("🚀 Starting Petromium Project Seeding...\n");

  try {
    // Step 0: Check database schema compatibility (lenient check)
    console.log("📋 Step 0: Checking database schema...");
    let org: any;
    try {
      // Try to query organizations table to check if it exists
      org = await storage.getOrganizationBySlug("petromium");
      console.log("  ✓ Database schema appears compatible");
    } catch (error: any) {
      // If it's a column error, the database might have different column names
      // We'll try to proceed anyway and handle errors as they come
      if (error.code === "42703" || error.message?.includes("does not exist")) {
        console.log("  ⚠️  Database schema may have differences, but proceeding anyway...");
        console.log("  ⚠️  If errors occur, you may need to sync the schema.");
        // Don't throw - try to proceed
      } else {
        // Other errors, re-throw
        throw error;
      }
    }

    // Step 0.5: Get or create a user for organization ownership (skip if schema issues)
    console.log("\n📋 Step 0.5: Setting up user for organization ownership...");
    let user: any = null;
    let userIdForTasks: string | null = null;
    try {
      const allUsers = await storage.getAllUsers();
      if (allUsers.length > 0) {
        user = allUsers[0];
        userIdForTasks = user.id?.toString() || null;
        console.log(`  ✓ Using existing user: ${user.email || user.id}`);
      } else {
        console.log("  ⚠️  No users found. Will try to use raw SQL for tasks.");
        // Try to get a user ID from database directly
        try {
          const userResult = await pool.query(`SELECT id FROM users LIMIT 1`);
          if (userResult.rows.length > 0) {
            userIdForTasks = userResult.rows[0].id?.toString() || null;
            console.log(`  ✓ Found user ID from database: ${userIdForTasks}`);
          }
        } catch (e) {
          console.log("  ⚠️  Could not get user ID from database.");
        }
      }
    } catch (error: any) {
      console.log("  ⚠️  Could not query users table. Will try raw SQL for tasks.");
      // Try to get a user ID from database directly
      try {
        const userResult = await pool.query(`SELECT id FROM users LIMIT 1`);
        if (userResult.rows.length > 0) {
          userIdForTasks = userResult.rows[0].id?.toString() || null;
          console.log(`  ✓ Found user ID from database: ${userIdForTasks}`);
        }
      } catch (e) {
        console.log("  ⚠️  Could not get user ID from database.");
      }
    }

    // Step 1: Find or create Petromium organization
    console.log("\n📋 Step 1: Setting up Petromium organization...");
    if (!org) {
      try {
        // Try using storage first
        const orgData: any = {
          name: "Petromium",
          slug: "petromium",
          description: "Leading EPC firm specializing in drilling and workover operations",
        };
        org = await storage.createOrganization(orgData);
        console.log("  ✓ Created organization: Petromium");
      } catch (error: any) {
        // If ownerId column doesn't exist, use raw SQL
        if (error.message?.includes("owner_id") || error.code === "42703") {
          console.log("  ⚠️  Using raw SQL to create organization (owner_id column missing)...");
          try {
            // Use raw SQL to insert with only columns that exist in database
            const result = await pool.query(`
              INSERT INTO organizations (name, slug, created_at)
              VALUES ($1, $2, NOW())
              RETURNING *
            `, ["Petromium", "petromium"]);
            org = result.rows[0];
            console.log("  ✓ Created organization: Petromium (via raw SQL)");
          } catch (sqlError: any) {
            // If duplicate key, organization already exists - fetch it
            if (sqlError.code === "23505" || sqlError.message?.includes("duplicate key")) {
              console.log("  ℹ️  Organization already exists, fetching...");
              const existing = await pool.query(
                `SELECT * FROM organizations WHERE slug = $1`,
                ["petromium"]
              );
              if (existing.rows.length > 0) {
                org = existing.rows[0];
                console.log("  ✓ Found existing organization: Petromium");
              } else {
                throw sqlError;
              }
            } else {
              console.error("  ❌ Failed to create organization:", sqlError.message);
              throw sqlError;
            }
          }
        } else {
          throw error;
        }
      }
      
      // Add user as owner if we have one
      if (user && user.id) {
        try {
          await storage.createUserOrganization({
            userId: user.id.toString(),
            organizationId: org.id,
            role: "owner",
          });
        } catch (error: any) {
          console.log("  ⚠️  Could not assign user as owner (this is okay)");
        }
      }
    } else {
      console.log("  ✓ Found existing organization: Petromium");
    }
    const orgId = org.id;

    // Step 2: Find or create Drilling & Workover Department program
    console.log("\n📋 Step 2: Setting up Drilling & Workover Department program...");
    const programSlug = slugify("Drilling & Workover Department");
    let program: any;
    try {
      program = await storage.getProgramBySlug(orgId, programSlug);
      if (!program) {
        try {
          program = await storage.createProgram({
            organizationId: orgId,
            name: "Drilling & Workover Department",
            slug: programSlug,
            description: "Department handling all drilling and workover operations",
          });
          console.log("  ✓ Created program: Drilling & Workover Department");
        } catch (error: any) {
          // If schema mismatch, use raw SQL
          if (error.code === "42703" || error.message?.includes("does not exist") || error.code === "42601") {
            console.log("  ⚠️  Using raw SQL to create program (schema mismatch)...");
            try {
              // Try with slug first
              const result = await pool.query(`
                INSERT INTO programs (organization_id, name, slug, description, created_at, updated_at)
                VALUES ($1, $2, $3, $4, NOW(), NOW())
                RETURNING *
              `, [orgId, "Drilling & Workover Department", programSlug, "Department handling all drilling and workover operations"]);
              program = result.rows[0];
              console.log("  ✓ Created program: Drilling & Workover Department (via raw SQL)");
            } catch (sqlError: any) {
              // If duplicate or slug doesn't exist, try without slug
              if (sqlError.code === "23505" || sqlError.message?.includes("slug") || sqlError.code === "42703") {
                try {
                  const result = await pool.query(`
                    INSERT INTO programs (organization_id, name, description, created_at, updated_at)
                    VALUES ($1, $2, $3, NOW(), NOW())
                    RETURNING *
                  `, [orgId, "Drilling & Workover Department", "Department handling all drilling and workover operations"]);
                  program = result.rows[0];
                  console.log("  ✓ Created program: Drilling & Workover Department (without slug)");
                } catch (retryError: any) {
                  // If still duplicate, fetch existing
                  if (retryError.code === "23505") {
                    const existing = await pool.query(
                      `SELECT * FROM programs WHERE organization_id = $1 AND name = $2`,
                      [orgId, "Drilling & Workover Department"]
                    );
                    if (existing.rows.length > 0) {
                      program = existing.rows[0];
                      console.log("  ✓ Found existing program: Drilling & Workover Department");
                    } else {
                      throw retryError;
                    }
                  } else {
                    throw retryError;
                  }
                }
              } else {
                throw sqlError;
              }
            }
          } else {
            throw error;
          }
        }
      } else {
        console.log("  ✓ Found existing program: Drilling & Workover Department");
      }
    } catch (error: any) {
      // If getProgramBySlug fails due to schema, try raw SQL lookup
      if (error.code === "42703" || error.code === "42601" || error.message?.includes("does not exist")) {
        console.log("  ⚠️  Schema mismatch in program lookup, using raw SQL...");
        try {
          const result = await pool.query(
            `SELECT * FROM programs WHERE organization_id = $1 AND (slug = $2 OR name = $3) LIMIT 1`,
            [orgId, programSlug, "Drilling & Workover Department"]
          );
          if (result.rows.length > 0) {
            program = result.rows[0];
            console.log("  ✓ Found existing program: Drilling & Workover Department");
          } else {
            // Create new program (slug is required)
            const createResult = await pool.query(`
              INSERT INTO programs (organization_id, name, slug, created_at, updated_at)
              VALUES ($1, $2, $3, NOW(), NOW())
              RETURNING *
            `, [orgId, "Drilling & Workover Department", programSlug]);
            program = createResult.rows[0];
            console.log("  ✓ Created program: Drilling & Workover Department (via raw SQL)");
          }
        } catch (sqlError: any) {
          console.error("  ❌ Failed to create/find program:", sqlError.message);
          throw sqlError;
        }
      } else {
        throw error;
      }
    }
    const programId = program.id;

    // Step 3: Read and import project JSON
    console.log("\n📋 Step 3: Importing project from Sample_Drilling.json...");
    const jsonPath = join(process.cwd(), "Documents", "Import Export", "Sample_Drilling.json");
    const projectData = JSON.parse(readFileSync(jsonPath, "utf-8"));

    // Create project
    const project = await storage.createProject({
      organizationId: orgId,
      programId: programId,
      name: projectData.project.name,
      code: projectData.project.code,
      description: projectData.project.description,
      status: projectData.project.status as any,
      startDate: projectData.project.startDate ? new Date(projectData.project.startDate) : null,
      endDate: projectData.project.endDate ? new Date(projectData.project.endDate) : null,
      budget: projectData.project.budget || null,
      currency: projectData.project.currency || "USD",
    });
    console.log(`  ✓ Created project: ${project.name} (ID: ${project.id})`);
    const projectId = project.id;

    // Import tasks with hierarchy
    console.log("  📝 Importing tasks...");
    const wbsToTaskId: Record<string, number> = {};
    const sortedTasks = [...(projectData.tasks || [])].sort((a: any, b: any) => {
      const aDepth = (a.wbsCode || "").split(".").length;
      const bDepth = (b.wbsCode || "").split(".").length;
      return aDepth - bDepth;
    });

    for (const taskData of sortedTasks) {
      const wbsCode = taskData.wbsCode || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const parentWbsCode = getParentWbsCode(wbsCode);
      const parentId = parentWbsCode ? wbsToTaskId[parentWbsCode] : null;

      try {
        const task = await storage.createTask({
          projectId: projectId,
          parentId: parentId,
          wbsCode: wbsCode,
          name: taskData.name,
          description: taskData.description || null,
          status: (taskData.status as any) || "not-started",
          priority: (taskData.priority as any) || "medium",
          progress: taskData.progress || 0,
          startDate: taskData.startDate ? new Date(taskData.startDate) : null,
          endDate: taskData.endDate ? new Date(taskData.endDate) : null,
          estimatedHours: taskData.estimatedHours ? parseFloat(taskData.estimatedHours) : null,
          actualHours: taskData.actualHours ? parseFloat(taskData.actualHours) : null,
          assignedTo: null, // Don't assign to users that don't exist - assignedTo has FK constraint
          discipline: taskData.discipline || null,
          createdBy: userIdForTasks || "system", // Use real user ID or fallback
        });
        wbsToTaskId[wbsCode] = task.id;
      } catch (error: any) {
        // If FK constraint fails, use raw SQL
        if (error.code === "23503" || error.message?.includes("foreign key")) {
          const taskResult = await pool.query(`
            INSERT INTO tasks (
              project_id, parent_id, wbs_code, name, description, status, priority, progress,
              start_date, end_date, estimated_hours, actual_hours, discipline, created_by, created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
            RETURNING id
          `, [
            projectId,
            parentId,
            wbsCode,
            taskData.name,
            taskData.description || null,
            (taskData.status as any) || "not-started",
            (taskData.priority as any) || "medium",
            taskData.progress || 0,
            taskData.startDate ? new Date(taskData.startDate) : null,
            taskData.endDate ? new Date(taskData.endDate) : null,
            taskData.estimatedHours ? parseFloat(taskData.estimatedHours) : null,
            taskData.actualHours ? parseFloat(taskData.actualHours) : null,
            taskData.discipline || null,
            userIdForTasks || "system",
          ]);
          wbsToTaskId[wbsCode] = taskResult.rows[0].id;
        } else {
          throw error;
        }
      }
    }
    console.log(`  ✓ Imported ${sortedTasks.length} tasks`);

    // Import risks
    console.log("  ⚠️  Importing risks...");
    for (const riskData of projectData.risks || []) {
      try {
        await storage.createRisk({
          projectId: projectId,
          code: riskData.code,
          title: riskData.title,
          description: riskData.description,
          category: riskData.category as any,
          probability: riskData.probability,
          impact: riskData.impact as any,
          status: riskData.status as any,
          mitigationPlan: riskData.mitigationPlan || null,
        });
      } catch (error: any) {
        // If schema mismatch, use raw SQL
        if (error.code === "42703" || error.message?.includes("does not exist")) {
          await pool.query(`
            INSERT INTO risks (project_id, code, title, description, category, probability, impact, status, mitigation_plan, identified_date)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
          `, [
            projectId,
            riskData.code,
            riskData.title,
            riskData.description,
            riskData.category,
            riskData.probability,
            riskData.impact,
            riskData.status,
            riskData.mitigationPlan || null,
          ]);
        } else {
          throw error;
        }
      }
    }
    console.log(`  ✓ Imported ${(projectData.risks || []).length} risks`);

    // Import issues
    console.log("  🐛 Importing issues...");
    for (const issueData of projectData.issues || []) {
      try {
        await storage.createIssue({
          projectId: projectId,
          code: issueData.code,
          title: issueData.title,
          description: issueData.description,
          priority: issueData.priority as any,
          status: issueData.status as any,
          assignedTo: null, // Don't assign to users that don't exist - assignedTo has FK constraint
          reportedBy: userIdForTasks || "system", // Use real user ID - reportedBy is required
          resolution: issueData.resolution || null,
        });
      } catch (error: any) {
        // If FK constraint fails, use raw SQL
        if (error.code === "23503" || error.message?.includes("foreign key")) {
          await pool.query(`
            INSERT INTO issues (project_id, code, title, description, priority, status, reported_by, resolution, reported_date)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
          `, [
            projectId,
            issueData.code,
            issueData.title,
            issueData.description,
            issueData.priority,
            issueData.status,
            userIdForTasks || "system",
            issueData.resolution || null,
          ]);
        } else {
          throw error;
        }
      }
    }
    console.log(`  ✓ Imported ${(projectData.issues || []).length} issues`);

    // Import stakeholders
    console.log("  👥 Importing stakeholders...");
    const stakeholderMap: Record<string, number> = {};
    // Map roles to valid enum values (based on import schema: sponsor, client, team-member, contractor, consultant, regulatory, vendor, other)
    const roleMap: Record<string, string> = {
      "sponsor": "sponsor",
      "contractor": "contractor",
      "regulatory": "other", // Map regulatory to "other" if not in enum
      "stakeholder": "other", // Map stakeholder to "other"
      "team-member": "team-member",
      "vendor": "vendor",
      "client": "client",
      "consultant": "consultant",
      "other": "other",
    };
    for (const stakeholderData of projectData.stakeholders || []) {
      try {
        const mappedRole = roleMap[stakeholderData.role?.toLowerCase() || ""] || "stakeholder";
        const stakeholder = await storage.createStakeholder({
          projectId: projectId,
          name: stakeholderData.name,
          role: mappedRole as any,
          organization: stakeholderData.organization || null,
          email: stakeholderData.email || null,
          phone: stakeholderData.phone || null,
          influence: stakeholderData.influence?.toString() as any || "medium",
          interest: stakeholderData.interest?.toString() as any || "medium",
        });
        stakeholderMap[stakeholderData.name] = stakeholder.id;
      } catch (error: any) {
        // If enum error, use raw SQL with mapped role
        if (error.code === "22P02" || error.message?.includes("enum")) {
          const mappedRole = roleMap[stakeholderData.role?.toLowerCase() || ""] || "stakeholder";
          const result = await pool.query(`
            INSERT INTO stakeholders (project_id, name, role, organization, email, phone, influence, interest)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id
          `, [
            projectId,
            stakeholderData.name,
            mappedRole,
            stakeholderData.organization || null,
            stakeholderData.email || null,
            stakeholderData.phone || null,
            stakeholderData.influence?.toString() || "medium",
            stakeholderData.interest?.toString() || "medium",
          ]);
          stakeholderMap[stakeholderData.name] = result.rows[0].id;
        } else {
          throw error;
        }
      }
    }
    console.log(`  ✓ Imported ${(projectData.stakeholders || []).length} stakeholders`);

    // Import cost items
    console.log("  💰 Importing cost items...");
    for (const costData of projectData.costItems || []) {
      try {
        await storage.createCostItem({
          projectId: projectId,
          description: costData.description,
          category: costData.category as any,
          budgeted: costData.budgeted ? parseFloat(costData.budgeted) : 0,
          actual: costData.actual ? parseFloat(costData.actual) : 0,
          currency: costData.currency || "USD",
        });
      } catch (error: any) {
        // If schema mismatch (variance column doesn't exist), use raw SQL
        if (error.code === "42703" || error.message?.includes("does not exist") || error.message?.includes("variance")) {
          await pool.query(`
            INSERT INTO cost_items (project_id, description, category, budgeted, actual)
            VALUES ($1, $2, $3, $4, $5)
          `, [
            projectId,
            costData.description,
            costData.category,
            costData.budgeted ? parseFloat(costData.budgeted) : 0,
            costData.actual ? parseFloat(costData.actual) : 0,
          ]);
        } else {
          throw error;
        }
      }
    }
    console.log(`  ✓ Imported ${(projectData.costItems || []).length} cost items`);

    // Step 4: Seed 50 Lessons Learned
    console.log("\n📋 Step 4: Seeding 50 Lessons Learned...");
    const lessonsLearned = generateLessonsLearned(orgId, projectId);
    for (const lesson of lessonsLearned) {
      await storage.createLessonLearned(lesson);
    }
    console.log(`  ✓ Created ${lessonsLearned.length} lessons learned`);

    // Step 5: Create and assign tags
    console.log("\n📋 Step 5: Creating and assigning tags...");
    const tags = await createTags(orgId, projectId);
    console.log(`  ✓ Created ${tags.length} tags and assigned them to entities`);

    // Step 6: Add resources
    console.log("\n📋 Step 6: Adding resources...");
    const resources = await createResources(orgId, projectId);
    console.log(`  ✓ Created ${resources.length} resources`);

    // Step 7: Assign resources to tasks
    console.log("\n📋 Step 7: Assigning resources to tasks...");
    await assignResourcesToTasks(projectId, resources, wbsToTaskId);
    console.log("  ✓ Assigned resources to tasks");

    // Step 8: Enhance stakeholders with communication preferences
    console.log("\n📋 Step 8: Enhancing stakeholders with communication preferences...");
    await enhanceStakeholders(projectId, stakeholderMap);
    console.log("  ✓ Enhanced stakeholders with communication preferences");

    // Step 9: Add communication metrics
    console.log("\n📋 Step 9: Adding communication metrics...");
    await addCommunicationMetrics(projectId, Object.values(stakeholderMap));
    console.log("  ✓ Added communication metrics");

    // Step 10: Add additional cost items
    console.log("\n📋 Step 10: Adding additional cost items...");
    await addAdditionalCostItems(projectId);
    console.log("  ✓ Added additional cost items");

    console.log("\n✅ Seeding completed successfully!");
    console.log(`\n📊 Summary:`);
    console.log(`   - Organization: Petromium (ID: ${orgId})`);
    console.log(`   - Program: Drilling & Workover Department (ID: ${programId})`);
    console.log(`   - Project: ${project.name} (ID: ${projectId})`);
    console.log(`   - Tasks: ${sortedTasks.length}`);
    console.log(`   - Risks: ${(projectData.risks || []).length}`);
    console.log(`   - Issues: ${(projectData.issues || []).length}`);
    console.log(`   - Stakeholders: ${(projectData.stakeholders || []).length}`);
    console.log(`   - Lessons Learned: ${lessonsLearned.length}`);
    console.log(`   - Tags: ${tags.length}`);
    console.log(`   - Resources: ${resources.length}`);

  } catch (error) {
    console.error("❌ Error during seeding:", error);
    throw error;
  }
}

// Generate 50 realistic Lessons Learned
function generateLessonsLearned(orgId: number, projectId: number): InsertLessonLearned[] {
  const categories = ["Procurement", "Safety", "Quality", "Schedule", "Technical", "HSE", "Logistics", "Management"];
  const lessons: InsertLessonLearned[] = [];

  const lessonTemplates = [
    { category: "Safety", title: "H2S Detection Protocol", description: "Always verify H2S detector calibration before entering wellsite. One incident occurred due to expired calibration.", rootCause: "Lack of systematic calibration tracking", actionTaken: "Implemented monthly calibration schedule with automated reminders", outcome: "Zero H2S incidents in last 6 months", impactRating: 5 },
    { category: "Technical", title: "Lost Circulation Material Stock", description: "Maintain minimum 50 bbl LCM inventory on site. Delayed response to loss circulation cost 12 hours.", rootCause: "Insufficient inventory management", actionTaken: "Set minimum stock levels and automated reorder triggers", outcome: "Reduced NPT by 15%", impactRating: 4 },
    { category: "Procurement", title: "Casing Delivery Lead Time", description: "Order casing 3 months in advance. Last-minute orders resulted in 2-week delay.", rootCause: "Inadequate procurement planning", actionTaken: "Created long-lead item tracking dashboard", outcome: "100% on-time delivery", impactRating: 4 },
    { category: "Quality", title: "Cement Bond Logging", description: "Always run CBL after each casing string. Discovered poor bond on surface casing requiring remediation.", rootCause: "Skipped logging to save time", actionTaken: "Made CBL mandatory for all casing strings", outcome: "Zero remediation required since", impactRating: 5 },
    { category: "HSE", title: "Heat Stress Prevention", description: "Implement mandatory water breaks every 2 hours during summer. Prevented 3 potential heat exhaustion cases.", rootCause: "Insufficient heat stress protocols", actionTaken: "Installed cooling stations and mandatory break schedule", outcome: "Zero heat-related incidents", impactRating: 4 },
    { category: "Logistics", title: "Rig Mobilization Route Survey", description: "Survey access roads 2 weeks before rig move. Found bridge weight limit issue requiring alternate route.", rootCause: "Late route planning", actionTaken: "Route survey now part of pre-mob checklist", outcome: "Smooth rig moves with no delays", impactRating: 3 },
    { category: "Management", title: "Shift Handover Documentation", description: "Standardized handover forms reduced miscommunication by 80%. Critical information now always transferred.", rootCause: "Informal handover process", actionTaken: "Created digital handover checklist", outcome: "Zero incidents due to miscommunication", impactRating: 4 },
    { category: "Technical", title: "Mud Weight Management", description: "Monitor mud weight every 4 hours during drilling. Prevented kick by detecting pressure increase early.", rootCause: "Infrequent mud weight checks", actionTaken: "Automated mud weight monitoring system", outcome: "Zero kicks in last 10 wells", impactRating: 5 },
    { category: "Safety", title: "BOP Testing Frequency", description: "Test BOP weekly instead of monthly. Discovered minor leak before it became critical.", rootCause: "Insufficient testing frequency", actionTaken: "Weekly BOP testing protocol", outcome: "100% BOP reliability", impactRating: 5 },
    { category: "Procurement", title: "Backup Vendor Strategy", description: "Always identify backup vendors for critical items. Primary casing vendor had production issue.", rootCause: "Single vendor dependency", actionTaken: "Maintain approved vendor list with backups", outcome: "No procurement delays", impactRating: 4 },
    { category: "Quality", title: "Pipe Tally Verification", description: "Double-check pipe tallies before running casing. Found 50ft discrepancy preventing depth error.", rootCause: "Single person tally verification", actionTaken: "Two-person verification required", outcome: "Zero depth calculation errors", impactRating: 4 },
    { category: "HSE", title: "Wildlife Safety Protocols", description: "Conduct wildlife briefing before site entry. Prevented snake bite incident.", rootCause: "Lack of wildlife awareness", actionTaken: "Wildlife safety briefing and first aid kit", outcome: "Zero wildlife incidents", impactRating: 3 },
    { category: "Technical", title: "Directional Tool Backup", description: "Keep backup MWD tool on site. Primary tool failure would have caused 3-day delay.", rootCause: "No backup tool available", actionTaken: "Backup tool requirement in contract", outcome: "Zero delays due to tool failure", impactRating: 4 },
    { category: "Logistics", title: "Fuel Storage Capacity", description: "Maintain 7-day fuel supply on site. Weather delayed fuel delivery.", rootCause: "Insufficient fuel storage", actionTaken: "Increased fuel storage capacity", outcome: "Zero fuel shortages", impactRating: 3 },
    { category: "Management", title: "Daily Cost Tracking", description: "Track costs daily instead of weekly. Identified budget overrun early.", rootCause: "Infrequent cost tracking", actionTaken: "Daily cost reporting dashboard", outcome: "Projects within budget", impactRating: 4 },
    { category: "Safety", title: "PPE Enforcement", description: "Strict PPE enforcement reduced injuries by 60%. Zero tolerance policy works.", rootCause: "Lax PPE enforcement", actionTaken: "Daily PPE audits and immediate corrective action", outcome: "60% reduction in injuries", impactRating: 5 },
    { category: "Technical", title: "Reaming Before Casing", description: "Always ream before running casing in directional wells. Prevented casing damage.", rootCause: "Skipped reaming to save time", actionTaken: "Reaming mandatory for directional wells", outcome: "Zero casing damage incidents", impactRating: 4 },
    { category: "Procurement", title: "Long-Lead Item Tracking", description: "Track long-lead items 6 months in advance. Prevented multiple delays.", rootCause: "Late procurement tracking", actionTaken: "Long-lead item dashboard", outcome: "100% on-time delivery", impactRating: 4 },
    { category: "Quality", title: "Cement Slurry Testing", description: "Test cement slurry before each job. Found contamination preventing bond failure.", rootCause: "Assumed slurry quality", actionTaken: "Mandatory pre-job slurry testing", outcome: "Zero bond failures", impactRating: 5 },
    { category: "HSE", title: "Noise Control Measures", description: "Install sound barriers around rig. Reduced noise complaints by 90%.", rootCause: "No noise mitigation", actionTaken: "Sound barriers and quiet hours", outcome: "90% reduction in complaints", impactRating: 3 },
    { category: "Technical", title: "BHA Vibration Monitoring", description: "Monitor BHA vibration in real-time. Prevented tool damage.", rootCause: "No vibration monitoring", actionTaken: "Real-time vibration monitoring system", outcome: "Reduced tool failures by 40%", impactRating: 4 },
    { category: "Logistics", title: "Waste Disposal Scheduling", description: "Schedule waste disposal weekly. Prevented pit overflow.", rootCause: "Reactive waste disposal", actionTaken: "Weekly waste disposal schedule", outcome: "Zero overflow incidents", impactRating: 3 },
    { category: "Management", title: "Communication Protocol", description: "Standardized communication protocol improved coordination. Reduced miscommunication by 70%.", rootCause: "Informal communication", actionTaken: "Daily standup meetings and status reports", outcome: "70% reduction in miscommunication", impactRating: 4 },
    { category: "Safety", title: "Emergency Response Drills", description: "Monthly emergency drills improved response time by 50%.", rootCause: "Infrequent drills", actionTaken: "Monthly emergency response drills", outcome: "50% faster response time", impactRating: 4 },
    { category: "Technical", title: "Mud System Optimization", description: "Optimize mud system for formation. Reduced drilling time by 20%.", rootCause: "Generic mud system", actionTaken: "Formation-specific mud system design", outcome: "20% reduction in drilling time", impactRating: 4 },
    { category: "Procurement", title: "Vendor Performance Tracking", description: "Track vendor performance metrics. Improved delivery reliability.", rootCause: "No vendor performance tracking", actionTaken: "Vendor scorecard system", outcome: "Improved vendor performance", impactRating: 3 },
    { category: "Quality", title: "Inspection Scheduling", description: "Schedule inspections 2 weeks in advance. Prevented delays.", rootCause: "Last-minute inspection requests", actionTaken: "Advanced inspection scheduling", outcome: "Zero inspection delays", impactRating: 3 },
    { category: "HSE", title: "Dust Control Measures", description: "Implement dust control measures. Reduced silica exposure by 80%.", rootCause: "Insufficient dust control", actionTaken: "Watering systems and vacuum equipment", outcome: "80% reduction in dust exposure", impactRating: 4 },
    { category: "Technical", title: "Bit Selection Optimization", description: "Optimize bit selection for formation. Improved ROP by 25%.", rootCause: "Generic bit selection", actionTaken: "Formation-specific bit selection", outcome: "25% improvement in ROP", impactRating: 4 },
    { category: "Logistics", title: "Crane Availability", description: "Book crane 2 weeks in advance. Prevented delays.", rootCause: "Last-minute crane booking", actionTaken: "Advanced crane booking protocol", outcome: "Zero crane delays", impactRating: 3 },
    { category: "Management", title: "Resource Allocation", description: "Optimize resource allocation across projects. Improved utilization by 15%.", rootCause: "Inefficient resource allocation", actionTaken: "Resource optimization dashboard", outcome: "15% improvement in utilization", impactRating: 3 },
    { category: "Safety", title: "Lifting Operations Safety", description: "Strict lifting operation protocols. Zero lifting incidents.", rootCause: "Lax lifting protocols", actionTaken: "Certified riggers and daily inspections", outcome: "Zero lifting incidents", impactRating: 5 },
    { category: "Technical", title: "Casing Centralization", description: "Use centralizers for all casing strings. Improved cement bond.", rootCause: "Insufficient centralization", actionTaken: "Centralizer requirement for all strings", outcome: "Improved cement bond quality", impactRating: 4 },
    { category: "Procurement", title: "Material Inspection", description: "Inspect all materials upon delivery. Found defects before use.", rootCause: "No material inspection", actionTaken: "Mandatory material inspection", outcome: "Zero defective material usage", impactRating: 4 },
    { category: "Quality", title: "Calibration Management", description: "Track calibration dates for all equipment. Prevented use of expired equipment.", rootCause: "No calibration tracking", actionTaken: "Calibration management system", outcome: "100% calibrated equipment", impactRating: 4 },
    { category: "HSE", title: "Chemical Storage", description: "Proper chemical storage protocols. Prevented spills.", rootCause: "Improper storage", actionTaken: "Designated storage areas and spill kits", outcome: "Zero chemical spills", impactRating: 4 },
    { category: "Technical", title: "Pressure Testing", description: "Pressure test all connections before use. Found leaks early.", rootCause: "Skipped pressure testing", actionTaken: "Mandatory pressure testing", outcome: "Zero connection failures", impactRating: 4 },
    { category: "Logistics", title: "Transportation Planning", description: "Plan transportation routes in advance. Avoided road issues.", rootCause: "Last-minute planning", actionTaken: "Advanced route planning", outcome: "Smooth transportation", impactRating: 3 },
    { category: "Management", title: "Documentation Standards", description: "Standardized documentation improved traceability. Reduced errors by 50%.", rootCause: "Inconsistent documentation", actionTaken: "Documentation templates and standards", outcome: "50% reduction in errors", impactRating: 4 },
    { category: "Safety", title: "Confined Space Entry", description: "Strict confined space entry protocols. Zero incidents.", rootCause: "Lax confined space protocols", actionTaken: "Permit system and gas monitoring", outcome: "Zero confined space incidents", impactRating: 5 },
    { category: "Technical", title: "Drill String Inspection", description: "Inspect drill string before each run. Found cracks preventing failure.", rootCause: "Infrequent inspection", actionTaken: "Pre-run inspection protocol", outcome: "Zero drill string failures", impactRating: 5 },
    { category: "Procurement", title: "Contract Terms Review", description: "Review contract terms carefully. Avoided costly disputes.", rootCause: "Insufficient contract review", actionTaken: "Legal review of all contracts", outcome: "Zero contract disputes", impactRating: 3 },
    { category: "Quality", title: "Welding Inspection", description: "Inspect all welds before use. Found defects requiring repair.", rootCause: "No welding inspection", actionTaken: "Mandatory welding inspection", outcome: "Zero weld failures", impactRating: 4 },
    { category: "HSE", title: "Fire Prevention", description: "Fire prevention measures prevented incidents. Zero fires.", rootCause: "Insufficient fire prevention", actionTaken: "Fire suppression systems and training", outcome: "Zero fire incidents", impactRating: 5 },
    { category: "Technical", title: "Formation Evaluation", description: "Evaluate formation before drilling. Optimized drilling parameters.", rootCause: "Generic drilling parameters", actionTaken: "Formation-specific parameters", outcome: "Improved drilling efficiency", impactRating: 4 },
    { category: "Logistics", title: "Catering Management", description: "Proper catering management improved morale. Reduced complaints.", rootCause: "Poor catering quality", actionTaken: "Catering vendor evaluation and monitoring", outcome: "Improved crew satisfaction", impactRating: 3 },
    { category: "Management", title: "Risk Management", description: "Proactive risk management prevented issues. Reduced project delays.", rootCause: "Reactive risk management", actionTaken: "Weekly risk review meetings", outcome: "Reduced project delays", impactRating: 4 },
    { category: "Safety", title: "Vehicle Safety", description: "Vehicle safety protocols reduced accidents. Zero vehicle incidents.", rootCause: "Lax vehicle safety", actionTaken: "Vehicle inspection and driver training", outcome: "Zero vehicle incidents", impactRating: 4 },
    { category: "Technical", title: "Well Control Training", description: "Regular well control training improved response. Zero well control incidents.", rootCause: "Infrequent training", actionTaken: "Quarterly well control training", outcome: "Zero well control incidents", impactRating: 5 },
  ];

  // Generate 50 lessons by repeating and varying templates
  for (let i = 0; i < 50; i++) {
    const template = lessonTemplates[i % lessonTemplates.length];
    const category = categories[i % categories.length];
    lessons.push({
      organizationId: orgId,
      projectId: i % 3 === 0 ? projectId : null, // Link some to project
      category: category,
      title: `${template.title} (${i + 1})`,
      description: template.description,
      rootCause: template.rootCause,
      actionTaken: template.actionTaken,
      outcome: template.outcome,
      impactRating: template.impactRating,
      applicability: i % 2 === 0 ? "global" : "project-specific",
      tags: [category.toLowerCase(), "drilling", "epc"],
    });
  }

  return lessons;
}

// Create tags and assign them
async function createTags(orgId: number, projectId: number): Promise<number[]> {
  const tagNames = [
    "drilling", "workover", "onshore", "offshore", "epc", "construction",
    "hse", "safety", "quality", "procurement", "logistics", "management",
    "technical", "regulatory", "environmental", "cost-control", "schedule",
    "risk-management", "stakeholder", "contractor", "vendor", "material",
    "equipment", "personnel", "training", "compliance", "audit", "inspection",
  ];

  const tagIds: number[] = [];
  for (const tagName of tagNames) {
    let tag = await storage.getTagByName(orgId, tagName);
    if (!tag) {
      tag = await storage.createTag({
        organizationId: orgId,
        name: tagName,
        category: getTagCategory(tagName),
        color: getTagColor(tagName),
      });
    }
    tagIds.push(tag.id);
  }

  // Assign tags to project
  const project = await storage.getProject(projectId);
  if (project) {
    await storage.assignTag(tagIds[0], "project", projectId); // drilling
    await storage.assignTag(tagIds[1], "project", projectId); // workover
    await storage.assignTag(tagIds[2], "project", projectId); // onshore
  }

  // Assign tags to some tasks
  const tasks = await storage.getTasksByProject(projectId);
  for (let i = 0; i < Math.min(10, tasks.length); i++) {
    const task = tasks[i];
    if (task.discipline) {
      const disciplineTagIdx = tagNames.findIndex(name => name === task.discipline);
      if (disciplineTagIdx >= 0 && tagIds[disciplineTagIdx]) {
        await storage.assignTag(tagIds[disciplineTagIdx], "task", task.id);
      }
    }
  }

  // Assign tags to risks
  const risks = await storage.getRisksByProject(projectId);
  for (let i = 0; i < Math.min(10, risks.length); i++) {
    const risk = risks[i];
    const categoryTagIdx = tagNames.findIndex(name => name === risk.category);
    if (categoryTagIdx >= 0 && tagIds[categoryTagIdx]) {
      await storage.assignTag(tagIds[categoryTagIdx], "risk", risk.id);
    }
  }

  return tagIds;
}

function getTagCategory(tagName: string): string {
  if (["drilling", "workover", "onshore", "offshore"].includes(tagName)) return "project-type";
  if (["hse", "safety", "quality", "compliance", "audit", "inspection"].includes(tagName)) return "governance";
  if (["procurement", "vendor", "contractor", "logistics"].includes(tagName)) return "operations";
  if (["technical", "equipment", "material", "personnel"].includes(tagName)) return "resources";
  return "general";
}

function getTagColor(tagName: string): string {
  const colors: Record<string, string> = {
    drilling: "#3b82f6",
    workover: "#8b5cf6",
    hse: "#ef4444",
    safety: "#dc2626",
    quality: "#10b981",
    procurement: "#f59e0b",
    technical: "#6366f1",
  };
  return colors[tagName] || "#6b7280";
}

// Create resources
async function createResources(orgId: number, projectId: number): Promise<number[]> {
  const resources: InsertResource[] = [
    // Human Resources
    { organizationId: orgId, name: "Drilling Supervisor", type: "human", unit: "person", rate: 150, rateType: "hourly" },
    { organizationId: orgId, name: "Toolpusher", type: "human", unit: "person", rate: 120, rateType: "hourly" },
    { organizationId: orgId, name: "Driller", type: "human", unit: "person", rate: 100, rateType: "hourly" },
    { organizationId: orgId, name: "Derrickhand", type: "human", unit: "person", rate: 85, rateType: "hourly" },
    { organizationId: orgId, name: "Roughneck", type: "human", unit: "person", rate: 75, rateType: "hourly" },
    { organizationId: orgId, name: "Mud Engineer", type: "human", unit: "person", rate: 140, rateType: "hourly" },
    { organizationId: orgId, name: "Company Man", type: "human", unit: "person", rate: 200, rateType: "hourly" },
    { organizationId: orgId, name: "HSE Officer", type: "human", unit: "person", rate: 110, rateType: "hourly" },
    
    // Equipment
    { organizationId: orgId, name: "Drilling Rig", type: "equipment", unit: "rig", rate: 50000, rateType: "daily" },
    { organizationId: orgId, name: "Mud Pumps", type: "equipment", unit: "unit", rate: 5000, rateType: "daily" },
    { organizationId: orgId, name: "Top Drive", type: "equipment", unit: "unit", rate: 3000, rateType: "daily" },
    { organizationId: orgId, name: "Crane (100 ton)", type: "equipment", unit: "unit", rate: 8000, rateType: "daily" },
    { organizationId: orgId, name: "Generator Set", type: "equipment", unit: "unit", rate: 2000, rateType: "daily" },
    
    // Materials
    { organizationId: orgId, name: "Drilling Mud", type: "material", unit: "bbl", rate: 250, rateType: "unit" },
    { organizationId: orgId, name: "Casing (Surface)", type: "material", unit: "ft", rate: 45, rateType: "unit" },
    { organizationId: orgId, name: "Cement", type: "material", unit: "sack", rate: 35, rateType: "unit" },
    { organizationId: orgId, name: "Drill Pipe", type: "material", unit: "ft", rate: 12, rateType: "unit" },
    { organizationId: orgId, name: "Diesel Fuel", type: "material", unit: "gallon", rate: 4.5, rateType: "unit" },
  ];

  const resourceIds: number[] = [];
  for (const resource of resources) {
    try {
      const created = await storage.createResource(resource);
      resourceIds.push(created.id);
    } catch (error: any) {
      // If schema mismatch (group_id doesn't exist), use raw SQL
      if (error.code === "42703" || error.message?.includes("does not exist") || error.message?.includes("group_id")) {
        // Resources table requires project_id - use raw SQL with projectId
        const result = await pool.query(`
          INSERT INTO resources (project_id, name, type)
          VALUES ($1, $2, $3)
          RETURNING id
        `, [
          projectId,
          resource.name,
          resource.type,
        ]);
        resourceIds.push(result.rows[0].id);
      } else {
        throw error;
      }
    }
  }

  return resourceIds;
}

// Assign resources to tasks
async function assignResourcesToTasks(
  projectId: number,
  resourceIds: number[],
  wbsToTaskId: Record<string, number>
) {
  const tasks = await storage.getTasksByProject(projectId);
  
  // Assign drilling rig to drilling operations
  const drillingTask = tasks.find(t => t.name.includes("Drilling Operations"));
  if (drillingTask && resourceIds[8]) { // Drilling Rig
    await storage.createResourceAssignment({
      taskId: drillingTask.id,
      resourceId: resourceIds[8],
      allocation: 100,
      effortHours: drillingTask.estimatedHours ? drillingTask.estimatedHours.toString() : null,
      startDate: drillingTask.startDate,
      endDate: drillingTask.endDate,
    });
  }

  // Assign crew to various tasks
  for (let i = 0; i < Math.min(5, tasks.length); i++) {
    const task = tasks[i];
    if (task.discipline === "drilling" && resourceIds[0]) { // Drilling Supervisor
      await storage.createResourceAssignment({
        taskId: task.id,
        resourceId: resourceIds[0],
        allocation: 100,
        effortHours: task.estimatedHours ? task.estimatedHours.toString() : null,
        startDate: task.startDate,
        endDate: task.endDate,
      });
    }
  }

  // Assign materials to construction tasks
  const constructionTasks = tasks.filter(t => t.discipline === "civil" || t.discipline === "structural");
  for (const task of constructionTasks.slice(0, 3)) {
    if (resourceIds[15]) { // Cement
      await storage.createResourceAssignment({
        taskId: task.id,
        resourceId: resourceIds[15],
        allocation: 100,
        effortHours: "100", // 100 sacks of cement
        startDate: task.startDate,
        endDate: task.endDate,
      });
    }
  }
}

// Enhance stakeholders with communication preferences
async function enhanceStakeholders(
  projectId: number,
  stakeholderMap: Record<string, number>
) {
  const stakeholders = await storage.getStakeholdersByProject(projectId);
  
  for (const stakeholder of stakeholders) {
    const updates: any = {};
    
    // Set communication preferences based on role
    if (stakeholder.role === "sponsor") {
      updates.communicationStyle = "diplomatic";
      updates.preferredChannel = "email";
      updates.updateFrequency = "weekly";
      updates.engagementLevel = 5;
    } else if (stakeholder.role === "contractor") {
      updates.communicationStyle = "direct";
      updates.preferredChannel = "chat";
      updates.updateFrequency = "daily";
      updates.engagementLevel = 4;
    } else if (stakeholder.role === "regulatory") {
      updates.communicationStyle = "detailed";
      updates.preferredChannel = "email";
      updates.updateFrequency = "bi-weekly";
      updates.engagementLevel = 3;
    }
    
    if (Object.keys(updates).length > 0) {
      await storage.updateStakeholder(stakeholder.id, updates);
    }
  }
}

// Add communication metrics
async function addCommunicationMetrics(
  projectId: number,
  stakeholderIds: number[]
) {
  for (const stakeholderId of stakeholderIds) {
    await storage.createOrUpdateCommunicationMetrics({
      projectId: projectId,
      stakeholderId: stakeholderId,
      responseTimeAvg: Math.floor(Math.random() * 480) + 60, // 1-8 hours
      overdueCount: Math.floor(Math.random() * 3),
      messageCount: Math.floor(Math.random() * 50) + 10,
      escalationCount: Math.floor(Math.random() * 2),
      healthStatus: Math.random() > 0.7 ? "at-risk" : "healthy",
      healthScore: Math.floor(Math.random() * 30) + 70, // 70-100
      lastInteractionDate: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // Last 7 days
      lastResponseDate: new Date(Date.now() - Math.random() * 3 * 24 * 60 * 60 * 1000), // Last 3 days
    });
  }
}

// Add additional cost items
async function addAdditionalCostItems(projectId: number) {
  const additionalCosts = [
    { description: "Drilling Mud (10,000 bbl)", category: "materials", budgeted: 2500000, actual: 2450000 },
    { description: "Casing String - Intermediate", category: "materials", budgeted: 850000, actual: 0 },
    { description: "Cementing Services", category: "subcontractor", budgeted: 320000, actual: 0 },
    { description: "Logging Services", category: "subcontractor", budgeted: 180000, actual: 0 },
    { description: "Directional Drilling Services", category: "subcontractor", budgeted: 450000, actual: 0 },
    { description: "Rig Day Rate (drilling)", category: "construction", budgeted: 3500000, actual: 0 },
    { description: "Fuel (diesel)", category: "materials", budgeted: 280000, actual: 125000 },
    { description: "Waste Disposal", category: "subcontractor", budgeted: 150000, actual: 75000 },
    { description: "Catering Services", category: "subcontractor", budgeted: 95000, actual: 48000 },
    { description: "Security Services", category: "subcontractor", budgeted: 120000, actual: 60000 },
  ];

  for (const cost of additionalCosts) {
    try {
      await storage.createCostItem({
        projectId: projectId,
        description: cost.description,
        category: cost.category as any,
        budgeted: cost.budgeted,
        actual: cost.actual,
        currency: "USD",
      });
    } catch (error: any) {
      // If schema mismatch (variance column doesn't exist), use raw SQL
      if (error.code === "42703" || error.message?.includes("does not exist") || error.message?.includes("variance")) {
        await pool.query(`
          INSERT INTO cost_items (project_id, description, category, budgeted, actual)
          VALUES ($1, $2, $3, $4, $5)
        `, [
          projectId,
          cost.description,
          cost.category,
          cost.budgeted,
          cost.actual,
        ]);
      } else {
        throw error;
      }
    }
  }
}

// Run the script
main()
  .then(() => {
    console.log("\n✨ Seeding script completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Seeding script failed:", error);
    process.exit(1);
  });

export { main };

