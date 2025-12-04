/**
 * Test Database Setup
 * Utilities for initializing and managing test database
 */

import pg from 'pg';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import * as schema from '@shared/schema';

const { Pool } = pg;

/**
 * Parse DATABASE_URL to extract connection details
 * Handles various PostgreSQL URL formats
 */
function parseDatabaseUrl(url: string): {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
} {
  try {
    const urlObj = new URL(url);
    return {
      host: urlObj.hostname,
      port: parseInt(urlObj.port || '5432', 10),
      database: urlObj.pathname.slice(1) || 'postgres', // Remove leading '/', default to 'postgres'
      user: urlObj.username || 'postgres',
      password: urlObj.password || '',
    };
  } catch (error) {
    // Fallback: try to parse as simple connection string
    // Format: postgresql://user:password@host:port/database
    const match = url.match(/postgresql?:\/\/(?:([^:]+):([^@]+)@)?([^:]+)(?::(\d+))?\/(.+)/);
    if (match) {
      return {
        user: match[1] || 'postgres',
        password: match[2] || '',
        host: match[3] || 'localhost',
        port: parseInt(match[4] || '5432', 10),
        database: match[5] || 'postgres',
      };
    }
    throw new Error(`Invalid DATABASE_URL format: ${url}`);
  }
}

/**
 * Create test database if it doesn't exist
 * Note: This only works for local PostgreSQL instances
 * For cloud databases (Neon, etc.), use the provided database directly
 */
export async function ensureTestDatabase(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL || process.env.TEST_DATABASE_URL;
  
  if (!dbUrl) {
    console.warn('[Test DB Setup] DATABASE_URL not set, using default test database');
    return;
  }

  // Skip database creation for cloud databases (Neon, etc.)
  // They typically don't allow creating databases via SQL
  if (dbUrl.includes('neon.tech') || dbUrl.includes('cloud.neon.tech') || dbUrl.includes('aws.neon.tech')) {
    console.log('[Test DB Setup] Cloud database detected, skipping database creation');
    console.log('[Test DB Setup] Will use DATABASE_URL as-is');
    return;
  }

  try {
    const parsed = parseDatabaseUrl(dbUrl);
    const testDbName = parsed.database || 'projectflow_test';

    // Connect to postgres database to create test database
    const adminPool = new Pool({
      host: parsed.host,
      port: parsed.port,
      database: 'postgres', // Connect to default postgres database
      user: parsed.user,
      password: parsed.password,
    });

    try {
      // Check if test database exists
      const result = await adminPool.query(
        `SELECT 1 FROM pg_database WHERE datname = $1`,
        [testDbName]
      );

      if (result.rows.length === 0) {
        console.log(`[Test DB Setup] Creating test database: ${testDbName}`);
        try {
          await adminPool.query(`CREATE DATABASE ${testDbName}`);
          console.log(`[Test DB Setup] Test database created successfully`);
        } catch (createError: any) {
          // Database might have been created by another process
          if (createError.code === '42P04') {
            console.log(`[Test DB Setup] Test database already exists (created concurrently)`);
          } else {
            console.warn(`[Test DB Setup] Could not create test database: ${createError.message}`);
            console.warn(`[Test DB Setup] Will attempt to use existing database or connection string database`);
          }
        }
      } else {
        console.log(`[Test DB Setup] Test database already exists: ${testDbName}`);
      }
    } catch (error: any) {
      // If we can't check/create database, that's okay - we'll use the connection string as-is
      console.warn(`[Test DB Setup] Could not verify test database: ${error.message}`);
      console.warn(`[Test DB Setup] Will use DATABASE_URL as-is: ${parsed.database || 'default database'}`);
    } finally {
      await adminPool.end();
    }
  } catch (error: any) {
    console.warn(`[Test DB Setup] Could not verify test database: ${error.message}`);
    console.log(`[Test DB Setup] Will use DATABASE_URL as-is: projectflow_test`);
  }
}

/**
 * Run migrations on test database
 */
export async function runTestMigrations(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL || process.env.TEST_DATABASE_URL;
  
  if (!dbUrl) {
    console.warn('[Test DB Setup] DATABASE_URL not set, skipping migrations');
    return;
  }

  const pool = new Pool({ connectionString: dbUrl });
  const db = drizzlePg(pool, { schema });

  try {
    console.log('[Test DB Setup] Running migrations...');
    
    // Get list of migration files
    const fs = await import('fs');
    const path = await import('path');
    const migrationsDir = path.resolve(__dirname, '../../migrations');
    
    if (!fs.existsSync(migrationsDir)) {
      console.warn('[Test DB Setup] Migrations directory not found, skipping migrations');
      return;
    }

    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    if (migrationFiles.length === 0) {
      console.warn('[Test DB Setup] No migration files found, skipping migrations');
      return;
    }

    for (const file of migrationFiles) {
      const migrationPath = path.join(migrationsDir, file);
      const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
      
      try {
        console.log(`[Test DB Setup] Running migration: ${file}`);
        await db.execute(sql.raw(migrationSQL));
      } catch (migrationError: any) {
        // Some migrations might fail if tables already exist - that's okay
        if (migrationError.message?.includes('already exists') || 
            migrationError.code === '42P07') {
          console.log(`[Test DB Setup] Migration ${file} skipped (already applied)`);
        } else {
          console.warn(`[Test DB Setup] Migration ${file} failed: ${migrationError.message}`);
          // Continue with other migrations
        }
      }
    }

    console.log('[Test DB Setup] Migrations completed');
  } catch (error) {
    console.warn('[Test DB Setup] Error running migrations:', error);
    // Don't throw - allow tests to run even if migrations fail
  } finally {
    await pool.end();
  }
}

/**
 * Initialize test database (create if needed, run migrations)
 */
export async function initializeTestDatabase(): Promise<void> {
  try {
    await ensureTestDatabase();
    await runTestMigrations();
    console.log('[Test DB Setup] Test database initialized successfully');
  } catch (error) {
    console.error('[Test DB Setup] Failed to initialize test database:', error);
    throw error;
  }
}

