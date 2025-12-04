# Test Setup Guide

## Quick Start

1. **Create `.env.test` file** (copy from `.env.test.example` if it exists, or create manually):
   ```bash
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/projectflow_test
   SESSION_SECRET=test-session-secret-for-testing-only-minimum-32-chars
   ```

2. **Start test database** (if using Docker):
   ```bash
   docker-compose up -d db
   ```

3. **Run tests**:
   ```bash
   npm test
   ```

## Test Database Configuration

### Option 1: Local PostgreSQL (Recommended for Development)

1. Install PostgreSQL locally
2. Create test database:
   ```sql
   CREATE DATABASE projectflow_test;
   ```
3. Set `.env.test`:
   ```
   DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/projectflow_test
   ```

### Option 2: Docker PostgreSQL

1. Start PostgreSQL container:
   ```bash
   docker-compose up -d db
   ```
2. Set `.env.test`:
   ```
   DATABASE_URL=postgresql://postgres:password@localhost:5432/projectflow_test
   ```

### Option 3: Cloud Database (Neon, etc.)

For cloud databases, the test setup will automatically detect and skip database creation:
```
DATABASE_URL=postgresql://user:password@host.neon.tech/database
```

**Note:** Cloud databases typically don't allow creating databases via SQL, so the test setup will use the provided database directly.

## Test Commands

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- tests/unit/auth.test.ts

# Run E2E tests (requires server running)
npm run test:e2e
```

## Test Structure

```
tests/
├── unit/              # Unit tests (fast, isolated)
│   ├── auth.test.ts   # Authentication tests
│   ├── storage.test.ts # Storage layer tests
│   └── rbac.test.ts   # RBAC tests
├── integration/        # Integration tests (database required)
│   └── api.test.ts    # API integration tests
├── e2e/               # End-to-end tests (Playwright)
│   ├── auth.spec.ts   # E2E auth tests
│   └── projects.spec.ts # E2E project tests
├── fixtures/          # Test data factories
│   ├── auth.ts        # Auth test fixtures
│   └── db.ts          # Database test fixtures
└── setup/             # Test setup utilities
    ├── db-setup.ts    # Database initialization
    └── db-cleanup.ts  # Database cleanup
```

## Test Fixtures

Test fixtures provide reusable factories for creating test data:

```typescript
import { createTestUser, createTestProject } from '../fixtures/db';

// Create a test user
const user = await createTestUser('test@example.com', 'password123');

// Create a test project
const project = await createTestProject(orgId, 'Test Project');
```

## Database Cleanup

Tests automatically clean up data after execution. The cleanup process:
1. Truncates all tables in dependency order
2. Resets sequences
3. Closes database connections

**Note:** If tests fail, you may need to manually clean up the test database.

## Troubleshooting

### Database Connection Errors

**Error:** `SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string`

**Solution:** Ensure `.env.test` has a valid `DATABASE_URL` with proper password format:
```
DATABASE_URL=postgresql://user:password@host:port/database
```

### Migration Errors

**Error:** `Migration failed: relation already exists`

**Solution:** This is normal - migrations are idempotent. The test setup will skip already-applied migrations.

### Test Timeout

**Error:** `Test timeout exceeded`

**Solution:** Increase timeout in test file:
```typescript
it('slow test', async () => {
  // test code
}, { timeout: 10000 }); // 10 seconds
```

## Best Practices

1. **Isolation:** Each test should be independent and not rely on other tests
2. **Cleanup:** Always clean up test data after tests
3. **Fixtures:** Use test fixtures instead of hardcoding test data
4. **Mocking:** Mock external services (APIs, file system) when possible
5. **Coverage:** Aim for 70%+ code coverage on critical paths

## Coverage Targets

- **Lines:** 70%
- **Functions:** 70%
- **Branches:** 70%
- **Statements:** 70%

Run `npm run test:coverage` to see current coverage.

