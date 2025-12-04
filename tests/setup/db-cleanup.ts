/**
 * Test Database Cleanup
 * Utilities for cleaning up test data after tests
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import pg from 'pg';
import * as schema from '@shared/schema';

const { Pool } = pg;

/**
 * Get test database connection
 */
function getTestDb() {
  const dbUrl = process.env.DATABASE_URL || process.env.TEST_DATABASE_URL;
  
  if (!dbUrl) {
    throw new Error('DATABASE_URL must be set for database cleanup');
  }

  const pool = new Pool({ connectionString: dbUrl });
  return { db: drizzle(pool, { schema }), pool };
}

/**
 * Truncate all tables (preserves schema, removes data)
 * Tables are truncated in reverse dependency order
 */
export async function truncateAllTables(): Promise<void> {
  const { db, pool } = getTestDb();

  try {
    console.log('[Test Cleanup] Truncating all tables...');

    // Get all table names in reverse dependency order
    // This ensures we don't violate foreign key constraints
    const tables = [
      // Child tables first (reverse dependency order)
      'taskDependencies',
      'taskResources',
      'taskTags',
      'riskTasks',
      'issueTasks',
      'changeRequestTasks',
      'stakeholderRaci',
      'notifications',
      'notificationRules',
      'lessonsLearned',
      'communicationIntelligence',
      'costItems',
      'procurementRequisitions',
      'resourceRequirements',
      'inventoryAllocations',
      'exchangeRates',
      'changeRequestApprovals',
      'changeRequests',
      'issues',
      'risks',
      'tasks',
      'resources',
      'stakeholders',
      'contacts',
      'userOrganizations',
      'projects',
      'programs',
      'organizations',
      'users',
      'sessions',
    ];

    // Disable foreign key checks temporarily (PostgreSQL doesn't support this directly,
    // so we'll use CASCADE on TRUNCATE)
    for (const table of tables) {
      try {
        // Use CASCADE to handle foreign key constraints
        await db.execute(
          sql.raw(`TRUNCATE TABLE ${table} CASCADE`)
        );
      } catch (error: any) {
        // Table might not exist or might have a different name
        // This is okay for test cleanup
        if (!error.message?.includes('does not exist')) {
          console.warn(`[Test Cleanup] Could not truncate ${table}:`, error.message);
        }
      }
    }

    // Reset sequences
    await db.execute(
      sql.raw(`
        DO $$ 
        DECLARE 
          r RECORD;
        BEGIN
          FOR r IN (SELECT sequence_name FROM information_schema.sequences 
                    WHERE sequence_schema = 'public') 
          LOOP
            EXECUTE 'ALTER SEQUENCE ' || quote_ident(r.sequence_name) || ' RESTART WITH 1';
          END LOOP;
        END $$;
      `)
    );

    console.log('[Test Cleanup] All tables truncated successfully');
  } catch (error) {
    console.error('[Test Cleanup] Error truncating tables:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

/**
 * Clean up test data (truncate tables)
 */
export async function cleanupTestData(): Promise<void> {
  try {
    await truncateAllTables();
    console.log('[Test Cleanup] Test data cleaned up successfully');
  } catch (error) {
    console.error('[Test Cleanup] Failed to clean up test data:', error);
    throw error;
  }
}

/**
 * Reset test database (truncate all tables, reset sequences)
 * Use with caution - this removes all data!
 */
export async function resetTestDatabase(): Promise<void> {
  console.warn('[Test Cleanup] Resetting test database - all data will be removed!');
  await cleanupTestData();
}

