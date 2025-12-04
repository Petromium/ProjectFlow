/**
 * Test Setup File
 * Runs before all tests to configure the testing environment
 */

import { beforeAll, afterAll } from 'vitest';
import dotenv from 'dotenv';
import path from 'path';
import { initializeTestDatabase } from './setup/db-setup';
import { cleanupTestData } from './setup/db-cleanup';

// Load test environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

// Set test environment
// IMPORTANT: Set NODE_ENV to 'development' for tests so we use pg.Pool instead of Neon
// This allows tests to work with local PostgreSQL databases
process.env.NODE_ENV = 'test';
// Force use of pg driver for tests (same as development)
process.env.FORCE_PG_DRIVER = 'true';

// Mock environment variables for testing if not set
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://localhost:5432/projectflow_test';
}

if (!process.env.SESSION_SECRET) {
  process.env.SESSION_SECRET = 'test-session-secret-for-testing-only';
}

// Global test setup
beforeAll(async () => {
  console.log('[Test Setup] Initializing test environment...');
  
  try {
    // Initialize test database (create if needed, run migrations)
    // This is optional - tests can run even if database setup fails
    await initializeTestDatabase();
    console.log('[Test Setup] Test environment initialized successfully');
  } catch (error: any) {
    console.warn('[Test Setup] Test database setup failed (tests may still work):', error.message);
    // Don't throw - allow tests to run even if setup fails
    // Individual tests should handle database connection errors
    // Tests will use DATABASE_URL as-is if setup fails
  }
}, 60000); // 60 second timeout for database setup

// Global test teardown
afterAll(async () => {
  console.log('[Test Setup] Cleaning up test environment...');
  
  try {
    // Clean up test data (truncate tables, reset sequences)
    // Note: Set CLEANUP_TEST_DATA=false to skip cleanup (useful for debugging)
    if (process.env.CLEANUP_TEST_DATA !== 'false') {
      await cleanupTestData();
    } else {
      console.log('[Test Setup] Skipping cleanup (CLEANUP_TEST_DATA=false)');
    }
  } catch (error) {
    console.error('[Test Setup] Error during cleanup:', error);
    // Don't throw - cleanup errors shouldn't fail the test suite
  }
}, 30000); // 30 second timeout for cleanup

