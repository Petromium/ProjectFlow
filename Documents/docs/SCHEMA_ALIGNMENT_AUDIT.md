# Schema Alignment Audit & Plan
## Epic 18: Schema Alignment & Infrastructure

**Date:** 2025-01-04  
**Status:** In Progress  
**Priority:** High

---

## Overview

This document audits schema mismatches between the Drizzle ORM schema (`shared/schema.ts`) and the actual PostgreSQL database, identifies raw SQL fallbacks in `server/storage.ts`, and provides a plan to align them.

---

## Identified Schema Mismatches

### 1. Users Table - Password Column
**Location:** `server/storage.ts` lines 850-916  
**Issue:** Fallback code suggests `password` column may not exist or have different name  
**Current Fallback:** Uses raw SQL `SELECT * FROM users`  
**Affected Methods:**
- `getUser(id)`
- `getUserByEmail(email)`
- `getAllUsers()`
- `getUsersByOrganization(organizationId)`

**Schema Definition:** `shared/schema.ts` uses `passwordHash` column  
**Action Required:** Verify database has `password_hash` column (snake_case) and ensure Drizzle maps correctly

---

### 2. Stakeholders Table - Timestamp Columns
**Location:** `server/storage.ts` line 1520  
**Issue:** Fallback suggests `created_at` may not exist  
**Current Fallback:** Uses raw SQL `SELECT * FROM stakeholders WHERE project_id = $1`  
**Affected Methods:**
- `getStakeholdersByProject(projectId)`

**Schema Definition:** Uses `createdAt` (camelCase)  
**Action Required:** Verify Drizzle correctly maps `createdAt` → `created_at` in database

---

### 3. Risks Table - Timestamp Columns
**Location:** `server/storage.ts` line 1866  
**Issue:** Fallback suggests `closed_date` or `created_at` may not exist  
**Current Fallback:** Uses raw SQL `SELECT * FROM risks WHERE project_id = $1`  
**Affected Methods:**
- `getRisksByProject(projectId)`

**Schema Definition:** Uses `closedDate` and `createdAt` (camelCase)  
**Action Required:** Verify Drizzle correctly maps camelCase → snake_case

---

### 4. Resource Assignments Table - Cost Column
**Location:** `server/storage.ts` line 2505  
**Issue:** Fallback suggests `cost` column may not exist  
**Current Fallback:** Uses raw SQL with basic columns only  
**Affected Methods:**
- `getResourceAssignmentsByTask(taskId)`

**Schema Definition:** Uses `cost` column  
**Action Required:** Verify `cost` column exists in `resource_assignments` table

---

## Raw SQL Usage (Not Fallbacks)

These are legitimate uses of raw SQL for complex queries:

1. **Tags Search** (line 714): `sql\`LOWER(${schema.tags.name}) LIKE ${searchTerm}\`` - Valid for case-insensitive search
2. **Tag Usage Count** (lines 741, 747): Increment/decrement operations - Valid
3. **User Activity Logs Date Filtering** (lines 1153, 1156): Date range queries - Valid
4. **Project Template Usage** (line 1423): Increment operation - Valid
5. **Storage Quota Calculations** (lines 2894, 2901): Aggregate SUM queries - Valid
6. **Chat Messages Unread Count** (line 3280): Date comparison - Valid
7. **Lessons Learned Search** (lines 3982-3985): ILIKE pattern matching - Valid
8. **Custom Dashboards NULL Handling** (lines 4140, 4168, 4200): NULL comparison - Valid

---

## Schema Alignment Strategy

### Phase 1: Database Schema Audit
1. **Run Migration Audit:**
   ```bash
   npm run db:push --dry-run
   ```
   This will show what migrations would be applied

2. **Inspect Actual Database Schema:**
   ```sql
   -- Check users table
   \d users
   
   -- Check stakeholders table
   \d stakeholders
   
   -- Check risks table
   \d risks
   
   -- Check resource_assignments table
   \d resource_assignments
   ```

3. **Compare with Drizzle Schema:**
   - Verify column names match (camelCase in schema → snake_case in DB)
   - Verify all columns exist
   - Verify data types match

### Phase 2: Fix Schema Mismatches

**Option A: Update Database Schema (Recommended)**
- Create migration to add missing columns
- Ensure all columns match Drizzle schema definition
- Run migration: `npm run db:push`

**Option B: Update Drizzle Schema**
- Only if database schema is authoritative
- Update `shared/schema.ts` to match actual database
- Re-generate types

### Phase 3: Remove Raw SQL Fallbacks

After schema alignment:
1. Remove try-catch fallback blocks in `server/storage.ts`
2. Remove raw SQL queries
3. Use Drizzle ORM exclusively
4. Test all affected methods

### Phase 4: Re-enable Schema Validation

1. Uncomment schema imports in `server/routes.ts`
2. Re-enable Zod validation
3. Test API endpoints

---

## Testing Plan

### Unit Tests
- Test all affected storage methods without fallbacks
- Verify error handling for missing data
- Test edge cases (null values, empty results)

### Integration Tests
- Test API endpoints that use affected storage methods
- Verify data integrity
- Test concurrent access

### Manual Verification
1. Test user authentication (uses `getUserByEmail`)
2. Test user management (uses `getAllUsers`, `getUsersByOrganization`)
3. Test stakeholder management (uses `getStakeholdersByProject`)
4. Test risk management (uses `getRisksByProject`)
5. Test resource assignments (uses `getResourceAssignmentsByTask`)

---

## Migration Script

Create `server/scripts/auditSchema.ts`:

```typescript
import { db } from '../db';
import { sql } from 'drizzle-orm';

async function auditSchema() {
  console.log('Auditing database schema...');
  
  // Check users table
  const usersColumns = await db.execute(sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'users'
    ORDER BY ordinal_position
  `);
  console.log('Users table columns:', usersColumns);
  
  // Check stakeholders table
  const stakeholdersColumns = await db.execute(sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'stakeholders'
    ORDER BY ordinal_position
  `);
  console.log('Stakeholders table columns:', stakeholdersColumns);
  
  // Check risks table
  const risksColumns = await db.execute(sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'risks'
    ORDER BY ordinal_position
  `);
  console.log('Risks table columns:', risksColumns);
  
  // Check resource_assignments table
  const resourceAssignmentsColumns = await db.execute(sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'resource_assignments'
    ORDER BY ordinal_position
  `);
  console.log('Resource assignments table columns:', resourceAssignmentsColumns);
}

auditSchema().catch(console.error);
```

---

## Risk Assessment

**Low Risk:**
- Removing fallbacks after verification
- Re-enabling schema validation

**Medium Risk:**
- Running migrations on production database
- Schema changes affecting existing data

**Mitigation:**
- Test migrations on staging first
- Backup database before migrations
- Run during maintenance window
- Monitor error logs after deployment

---

## Timeline Estimate

- **Phase 1 (Audit):** 2-4 hours
- **Phase 2 (Fix Schema):** 4-8 hours
- **Phase 3 (Remove Fallbacks):** 2-4 hours
- **Phase 4 (Re-enable Validation):** 2-4 hours
- **Testing:** 4-8 hours

**Total:** 14-28 hours

---

## Next Steps

1. ✅ Create audit document (this file)
2. ⬜ Run schema audit script
3. ⬜ Compare actual DB schema with Drizzle schema
4. ⬜ Create migration to fix mismatches
5. ⬜ Test migrations on staging
6. ⬜ Remove raw SQL fallbacks
7. ⬜ Re-enable schema validation
8. ⬜ Update backlog status

---

**Last Updated:** 2025-01-04  
**Owner:** Technical Lead

