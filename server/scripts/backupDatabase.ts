/**
 * Database Backup Script
 * Creates automated backups of PostgreSQL database to Google Cloud Storage
 * Run this script via cron job or Cloud Scheduler
 */

import { Storage } from '@google-cloud/storage';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFileSync, existsSync, unlinkSync } from 'fs';
import { logger } from '../services/cloudLogging';
import { recordMetric } from '../services/cloudMonitoring';

const execAsync = promisify(exec);

interface BackupConfig {
  bucketName: string;
  backupPrefix?: string;
  retentionDays?: number;
  compress?: boolean;
}

/**
 * Get database connection string from environment
 */
function getDatabaseUrl(): string {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  return dbUrl;
}

/**
 * Parse PostgreSQL connection string to extract connection details
 */
function parseDatabaseUrl(url: string): {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
} {
  // Parse DATABASE_URL format: postgresql://user:password@host:port/database
  const match = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
  if (!match) {
    throw new Error('Invalid DATABASE_URL format');
  }

  return {
    user: match[1],
    password: match[2],
    host: match[3],
    port: parseInt(match[4], 10),
    database: match[5],
  };
}

/**
 * Create database backup using pg_dump
 */
async function createDatabaseBackup(
  dbConfig: ReturnType<typeof parseDatabaseUrl>,
  outputPath: string,
  compress: boolean = true
): Promise<void> {
  const { host, port, database, user, password } = dbConfig;
  
  // Set PGPASSWORD environment variable for pg_dump
  const env = {
    ...process.env,
    PGPASSWORD: password,
  };

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = compress ? `${outputPath}.gz` : outputPath;
  const dumpFile = `${outputPath}.sql`;

  try {
    // Create pg_dump command
    const pgDumpCmd = `pg_dump -h ${host} -p ${port} -U ${user} -d ${database} -F c -f ${dumpFile}`;
    
    logger.info(`[Backup] Starting database backup: ${database}`);
    const startTime = Date.now();

    // Execute pg_dump
    await execAsync(pgDumpCmd, { env });

    // Compress if requested
    if (compress) {
      await execAsync(`gzip ${dumpFile}`);
    }

    const duration = Date.now() - startTime;
    logger.info(`[Backup] Database backup completed in ${duration}ms: ${backupFile}`);
    
    await recordMetric('backup/duration_ms', duration);
    await recordMetric('backup/success_count', 1);
  } catch (error) {
    logger.error('[Backup] Failed to create database backup', error);
    await recordMetric('backup/error_count', 1);
    throw error;
  }
}

/**
 * Upload backup to Google Cloud Storage
 */
async function uploadBackupToGCS(
  localFilePath: string,
  bucketName: string,
  objectName: string
): Promise<void> {
  const storage = new Storage();
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(objectName);

  try {
    logger.info(`[Backup] Uploading backup to GCS: gs://${bucketName}/${objectName}`);
    const startTime = Date.now();

    await file.save(readFileSync(localFilePath), {
      metadata: {
        contentType: localFilePath.endsWith('.gz') ? 'application/gzip' : 'application/sql',
        metadata: {
          backupDate: new Date().toISOString(),
          database: parseDatabaseUrl(getDatabaseUrl()).database,
        },
      },
    });

    const duration = Date.now() - startTime;
    logger.info(`[Backup] Upload completed in ${duration}ms`);
    
    await recordMetric('backup/upload_duration_ms', duration);
  } catch (error) {
    logger.error('[Backup] Failed to upload backup to GCS', error);
    await recordMetric('backup/upload_error_count', 1);
    throw error;
  }
}

/**
 * Clean up old backups based on retention policy
 */
async function cleanupOldBackups(
  bucketName: string,
  backupPrefix: string,
  retentionDays: number
): Promise<void> {
  const storage = new Storage();
  const bucket = storage.bucket(bucketName);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  try {
    const [files] = await bucket.getFiles({ prefix: backupPrefix });
    let deletedCount = 0;

    for (const file of files) {
      const [metadata] = await file.getMetadata();
      const created = metadata.timeCreated ? new Date(metadata.timeCreated) : new Date();

      if (created < cutoffDate) {
        await file.delete();
        deletedCount++;
        logger.info(`[Backup] Deleted old backup: ${file.name}`);
      }
    }

    if (deletedCount > 0) {
      logger.info(`[Backup] Cleaned up ${deletedCount} old backup(s)`);
    }
    
    await recordMetric('backup/cleanup_count', deletedCount);
  } catch (error) {
    logger.error('[Backup] Failed to cleanup old backups', error);
    // Don't throw - cleanup failure shouldn't fail the backup
  }
}

/**
 * Main backup function
 */
export async function backupDatabase(config: BackupConfig): Promise<void> {
  const {
    bucketName,
    backupPrefix = 'database-backups',
    retentionDays = 30,
    compress = true,
  } = config;

  const timestamp = new Date().toISOString().split('T')[0];
  const dbConfig = parseDatabaseUrl(getDatabaseUrl());
  const backupFileName = `backup-${dbConfig.database}-${timestamp}-${Date.now()}`;
  const localBackupPath = `/tmp/${backupFileName}`;
  const gcsObjectName = `${backupPrefix}/${backupFileName}${compress ? '.gz' : '.sql'}`;

  try {
    logger.info('[Backup] Starting database backup process');

    // Create backup
    await createDatabaseBackup(dbConfig, localBackupPath, compress);

    // Upload to GCS
    const backupFile = compress ? `${localBackupPath}.gz` : `${localBackupPath}.sql`;
    await uploadBackupToGCS(backupFile, bucketName, gcsObjectName);

    // Cleanup old backups
    if (retentionDays > 0) {
      await cleanupOldBackups(bucketName, backupPrefix, retentionDays);
    }

    // Cleanup local files
    if (existsSync(backupFile)) {
      unlinkSync(backupFile);
    }
    if (existsSync(`${localBackupPath}.sql`)) {
      unlinkSync(`${localBackupPath}.sql`);
    }

    logger.info('[Backup] Database backup process completed successfully');
  } catch (error) {
    logger.error('[Backup] Database backup process failed', error);
    throw error;
  }
}

/**
 * CLI entry point
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const bucketName = process.env.GCS_BACKUP_BUCKET;
  if (!bucketName) {
    console.error('GCS_BACKUP_BUCKET environment variable is required');
    process.exit(1);
  }

  backupDatabase({
    bucketName,
    backupPrefix: process.env.GCS_BACKUP_PREFIX || 'database-backups',
    retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10),
    compress: process.env.BACKUP_COMPRESS !== 'false',
  })
    .then(() => {
      console.log('Backup completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Backup failed:', error);
      process.exit(1);
    });
}

