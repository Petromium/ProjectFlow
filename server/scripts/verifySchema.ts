/**
 * Schema Verification Script
 * Verifies database schema matches Drizzle ORM schema before removing fallbacks
 * 
 * Run this after deploying migrations to verify schema alignment:
 * npm run verify:schema
 */

import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import * as schema from '@shared/schema';

interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
}

interface VerificationResult {
  table: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  expectedColumns?: string[];
  actualColumns?: ColumnInfo[];
}

const VERIFICATION_TABLES = [
  'users',
  'stakeholders',
  'risks',
  'resource_assignments',
] as const;

/**
 * Get actual columns from database
 */
async function getTableColumns(tableName: string): Promise<ColumnInfo[]> {
  const result = await db.execute(sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = ${tableName}
    ORDER BY ordinal_position
  `);
  
  return result.rows as ColumnInfo[];
}

/**
 * Get expected columns from Drizzle schema
 */
function getExpectedColumns(tableName: string): string[] {
  switch (tableName) {
    case 'users':
      return Object.keys(schema.users).map(key => {
        // Convert camelCase to snake_case
        return key.replace(/([A-Z])/g, '_$1').toLowerCase();
      });
    case 'stakeholders':
      return Object.keys(schema.stakeholders).map(key => {
        return key.replace(/([A-Z])/g, '_$1').toLowerCase();
      });
    case 'risks':
      return Object.keys(schema.risks).map(key => {
        return key.replace(/([A-Z])/g, '_$1').toLowerCase();
      });
    case 'resource_assignments':
      return Object.keys(schema.resourceAssignments).map(key => {
        return key.replace(/([A-Z])/g, '_$1').toLowerCase();
      });
    default:
      return [];
  }
}

/**
 * Verify a single table
 */
async function verifyTable(tableName: string): Promise<VerificationResult> {
  try {
    const actualColumns = await getTableColumns(tableName);
    const expectedColumns = getExpectedColumns(tableName);
    
    const actualColumnNames = actualColumns.map(col => col.column_name);
    const missingColumns = expectedColumns.filter(col => !actualColumnNames.includes(col));
    const extraColumns = actualColumnNames.filter(col => !expectedColumns.includes(col));
    
    if (missingColumns.length > 0) {
      return {
        table: tableName,
        status: 'fail',
        message: `Missing columns: ${missingColumns.join(', ')}`,
        expectedColumns,
        actualColumns,
      };
    }
    
    if (extraColumns.length > 0) {
      return {
        table: tableName,
        status: 'warning',
        message: `Extra columns found (not in schema): ${extraColumns.join(', ')}`,
        expectedColumns,
        actualColumns,
      };
    }
    
    // Check critical columns for known issues
    if (tableName === 'users') {
      const hasPasswordHash = actualColumnNames.includes('password_hash') || actualColumnNames.includes('passwordhash');
      if (!hasPasswordHash) {
        return {
          table: tableName,
          status: 'fail',
          message: 'Missing password_hash column',
          expectedColumns,
          actualColumns,
        };
      }
    }
    
    if (tableName === 'stakeholders') {
      const hasCreatedAt = actualColumnNames.includes('created_at') || actualColumnNames.includes('createdat');
      if (!hasCreatedAt) {
        return {
          table: tableName,
          status: 'fail',
          message: 'Missing created_at column',
          expectedColumns,
          actualColumns,
        };
      }
    }
    
    if (tableName === 'risks') {
      const hasCreatedAt = actualColumnNames.includes('created_at') || actualColumnNames.includes('createdat');
      const hasClosedDate = actualColumnNames.includes('closed_date') || actualColumnNames.includes('closeddate');
      if (!hasCreatedAt || !hasClosedDate) {
        return {
          table: tableName,
          status: 'fail',
          message: `Missing columns: ${!hasCreatedAt ? 'created_at' : ''} ${!hasClosedDate ? 'closed_date' : ''}`.trim(),
          expectedColumns,
          actualColumns,
        };
      }
    }
    
    if (tableName === 'resource_assignments') {
      const hasCost = actualColumnNames.includes('cost');
      if (!hasCost) {
        return {
          table: tableName,
          status: 'fail',
          message: 'Missing cost column',
          expectedColumns,
          actualColumns,
        };
      }
    }
    
    return {
      table: tableName,
      status: 'pass',
      message: 'All columns verified',
      expectedColumns,
      actualColumns,
    };
  } catch (error: any) {
    return {
      table: tableName,
      status: 'fail',
      message: `Error verifying table: ${error.message}`,
    };
  }
}

/**
 * Main verification function
 */
async function verifySchema(): Promise<void> {
  console.log('🔍 Verifying database schema alignment...\n');
  
  const results: VerificationResult[] = [];
  
  for (const table of VERIFICATION_TABLES) {
    console.log(`Checking ${table}...`);
    const result = await verifyTable(table);
    results.push(result);
    
    const icon = result.status === 'pass' ? '✅' : result.status === 'warning' ? '⚠️' : '❌';
    console.log(`${icon} ${result.table}: ${result.message}`);
    
    if (result.status === 'fail' && result.actualColumns) {
      console.log(`   Expected columns: ${result.expectedColumns?.join(', ')}`);
      console.log(`   Actual columns: ${result.actualColumns.map(c => c.column_name).join(', ')}`);
    }
    console.log('');
  }
  
  const passed = results.filter(r => r.status === 'pass').length;
  const warnings = results.filter(r => r.status === 'warning').length;
  const failed = results.filter(r => r.status === 'fail').length;
  
  console.log('\n📊 Verification Summary:');
  console.log(`   ✅ Passed: ${passed}/${results.length}`);
  console.log(`   ⚠️  Warnings: ${warnings}`);
  console.log(`   ❌ Failed: ${failed}`);
  
  if (failed > 0) {
    console.log('\n❌ Schema verification FAILED. Do not remove fallbacks yet.');
    console.log('   Run migrations to align schema: npm run db:push');
    process.exit(1);
  } else if (warnings > 0) {
    console.log('\n⚠️  Schema verification passed with warnings.');
    console.log('   Review extra columns and remove fallbacks if safe.');
    process.exit(0);
  } else {
    console.log('\n✅ Schema verification PASSED. Safe to remove fallbacks.');
    console.log('   Next steps:');
    console.log('   1. Remove try-catch fallback blocks in server/storage.ts');
    console.log('   2. Remove raw SQL queries');
    console.log('   3. Test all affected methods');
    process.exit(0);
  }
}

// Run verification
verifySchema().catch((error) => {
  console.error('❌ Verification script error:', error);
  process.exit(1);
});

