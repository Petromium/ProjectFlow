/**
 * Cleanup Script: Delete duplicate projects
 * 
 * This script deletes all projects that match the pattern "TexStar Onshore Drilling - Pad A (Permian)"
 * to clean up before repopulating with the seed script.
 */

import "dotenv/config";
import { DatabaseStorage } from "../storage.js";
import { db } from "../db.js";
import { projects } from "@shared/schema";
import { eq, like } from "drizzle-orm";

const storage = new DatabaseStorage();

async function cleanupDuplicateProjects() {
  console.log("🧹 Starting cleanup of duplicate projects...\n");

  try {
    // Find all projects matching the duplicate pattern
    const duplicateProjects = await db
      .select()
      .from(projects)
      .where(like(projects.name, "%TexStar Onshore Drilling - Pad A (Permian)%"));

    console.log(`Found ${duplicateProjects.length} duplicate project(s) to delete`);

    if (duplicateProjects.length === 0) {
      console.log("✓ No duplicate projects found. Nothing to clean up.");
      return;
    }

    // Delete each duplicate project
    for (const project of duplicateProjects) {
      console.log(`  Deleting: ${project.name} (ID: ${project.id})`);
      await storage.deleteProject(project.id);
    }

    console.log(`\n✓ Successfully deleted ${duplicateProjects.length} duplicate project(s)`);
  } catch (error: any) {
    console.error("❌ Error during cleanup:", error.message);
    throw error;
  }
}

// Run cleanup
cleanupDuplicateProjects()
  .then(() => {
    console.log("\n✅ Cleanup completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Cleanup failed:", error);
    process.exit(1);
  });

