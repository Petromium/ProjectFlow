# Test Database Setup Guide

## Quick Setup

### Step 1: Create `.env.test` File

Create a `.env.test` file in the project root with the following content:

```env
# Test Database URL
# For local PostgreSQL:
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/projectflow_test

# For Docker PostgreSQL (from docker-compose.yml):
DATABASE_URL=postgresql://postgres:password@localhost:5432/projectflow_test

# Session Secret (minimum 32 characters)
SESSION_SECRET=test-session-secret-for-testing-only-minimum-32-chars-long
```

### Step 2: Create Test Database

**Option A: Using Docker (Recommended)**

```bash
# Start PostgreSQL container
docker-compose up -d db

# Create test database
docker-compose exec db psql -U postgres -c "CREATE DATABASE projectflow_test;"
```

**Option B: Using Local PostgreSQL**

```bash
# Connect to PostgreSQL
psql -U postgres

# Create test database
CREATE DATABASE projectflow_test;
```

**Option C: Using Cloud Database (Neon, etc.)**

For cloud databases, use your existing database connection string:
```env
DATABASE_URL=postgresql://user:password@host.neon.tech/database
```

The test setup will automatically detect cloud databases and skip database creation.

### Step 3: Run Migrations

The test setup will automatically run migrations, but you can also run them manually:

```bash
# Using drizzle-kit
npx drizzle-kit push

# Or using the test setup
npm test -- --run
```

### Step 4: Verify Setup

Run the test suite:

```bash
npm test
```

## Troubleshooting

### Error: "SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string"

**Cause:** DATABASE_URL password is not being parsed correctly.

**Solution:**
1. Ensure `.env.test` file exists and has correct format
2. Check that password doesn't contain special characters that need URL encoding
3. If password has special characters, URL encode them:
   - `@` → `%40`
   - `#` → `%23`
   - `$` → `%24`
   - `%` → `%25`
   - etc.

**Example:**
```env
# If password is "p@ssw0rd#123"
DATABASE_URL=postgresql://postgres:p%40ssw0rd%23123@localhost:5432/projectflow_test
```

### Error: "Database connection failed"

**Solution:**
1. Verify PostgreSQL is running:
   ```bash
   # Docker
   docker-compose ps
   
   # Local
   pg_isready
   ```

2. Check connection string format:
   ```env
   # Correct format
   DATABASE_URL=postgresql://user:password@host:port/database
   ```

3. Test connection manually:
   ```bash
   psql "postgresql://postgres:postgres@localhost:5432/projectflow_test"
   ```

### Error: "Migration failed"

**Solution:**
- Migrations are idempotent - if tables already exist, the test setup will skip them
- If migrations fail, check database permissions
- Ensure test database user has CREATE TABLE permissions

### Error: "Test timeout exceeded"

**Solution:**
- Increase test timeout in test file
- Check database connection speed
- Ensure database is not locked by other processes

## Test Database Best Practices

1. **Isolation:** Use a separate test database (not production!)
2. **Cleanup:** Tests automatically clean up data after execution
3. **Migrations:** Run migrations before tests (automatic in setup)
4. **Fixtures:** Use test fixtures for consistent test data
5. **Performance:** Use transactions for faster test execution (future enhancement)

## Environment Variables

### Required
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Session encryption key (min 32 chars)

### Optional
- `TEST_DATABASE_URL` - Alternative to DATABASE_URL
- `CLEANUP_TEST_DATA` - Set to `false` to skip cleanup (for debugging)

## Next Steps

After setting up the test database:

1. ✅ Run tests: `npm test`
2. ✅ Check coverage: `npm run test:coverage`
3. ✅ Fix any failing tests
4. ✅ Proceed to Phase 2.2: Manual Verification

## Support

If you encounter issues:
1. Check `tests/README.md` for detailed test documentation
2. Review test output for specific error messages
3. Verify `.env.test` file format matches examples above
4. Ensure PostgreSQL is accessible and test database exists

