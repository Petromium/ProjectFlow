import "dotenv/config";
import { db } from "../db";
import fs from "fs";
import path from "path";
import { sql } from "drizzle-orm";

async function runMigrations() {
  console.log("Running migrations...");

  try {
    // Read migration file
    const migrationFile = path.join(process.cwd(), "migrations", "0004_add_admin_dashboard_tables.sql");
    const migrationSql = fs.readFileSync(migrationFile, "utf8");

    // Split into statements if needed, but db.execute usually handles one statement.
    // Drizzle's sql template literal might handle multiple statements if supported by driver.
    // However, safer to execute as raw SQL.
    
    // pg driver supports multiple statements in one query
    await db.execute(sql.raw(migrationSql));
    
    console.log("Migration 0004 applied successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

runMigrations();

