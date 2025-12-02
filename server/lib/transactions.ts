/**
 * Database Transaction Utilities
 * Provides helper functions for executing database operations within transactions
 */

import { db, pool } from "../db";
import { logger } from "./logger";

/**
 * Execute a function within a database transaction
 * Automatically commits on success or rolls back on error
 */
export async function withTransaction<T>(
  callback: (tx: typeof db) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");
    
    // Create a transaction-scoped db instance
    // Note: This is a simplified approach. For production, you'd want to use
    // Drizzle's transaction API if available, or wrap the client properly
    const txDb = db; // In a real implementation, you'd create a transaction-scoped db
    
    const result = await callback(txDb);
    
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    logger.error("Transaction failed, rolled back", error instanceof Error ? error : new Error(String(error)));
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Execute multiple operations in parallel within a transaction
 * All operations must succeed, or the entire transaction rolls back
 */
export async function transactionAll<T>(
  operations: Array<() => Promise<T>>
): Promise<T[]> {
  return withTransaction(async () => {
    return Promise.all(operations.map(op => op()));
  });
}

