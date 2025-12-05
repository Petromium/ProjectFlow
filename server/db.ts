import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

// Use standard pg driver for local development, testing, and Docker
// We should use pg for Docker to avoid websocket issues with neon-serverless in local containers
const isDev = process.env.NODE_ENV === "development" || 
              process.env.NODE_ENV === "test" || 
              process.env.DOCKER_ENV === "true"; // Added flag for Docker

/**
 * Initialize database pool
 * Note: We don't throw here at module load time to allow validateEnvironmentVariables()
 * to run first and provide better error messages. The error will be thrown when
 * the pool is actually used if DATABASE_URL is missing.
 */
function createPool(): pg.Pool | Pool {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }

  return isDev
    ? new pg.Pool({ 
        connectionString: databaseUrl,
        max: 20, // Maximum number of clients in the pool
        idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
        connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
      })
    : new Pool({ 
        connectionString: databaseUrl,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });
}

// Create pool - this will throw if DATABASE_URL is missing, but only when imported
// The validateEnvironmentVariables() in app.ts should catch this first
export const pool = createPool();

export const db = isDev
  ? drizzlePg(pool as pg.Pool, { schema })
  : drizzle({ client: pool as Pool, schema });
