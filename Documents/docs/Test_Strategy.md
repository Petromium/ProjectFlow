# Test Strategy & Quality Assurance

> **Purpose:** Define testing commands, mocking patterns, regression protocols, and quality assurance standards.

---

## Testing Mandate

**Core Principle:** **No Code Without Tests** - Every logic change requires accompanying tests.

### Test Requirements
1. **Unit Tests:** For isolated logic/utilities
2. **Integration Tests:** For API endpoints, database queries, and module interactions
3. **E2E Tests:** For critical user workflows

### Regression Prevention
- Explicitly check for backward compatibility
- Do not break existing public interfaces unless strictly authorized
- Run full test suite before merging changes

### Mocking Policy
- Mock external services (APIs, DBs) to ensure tests are fast and deterministic
- Strictly define the expected interface contract
- Use test fixtures for consistent test data

---

## Testing Frameworks

### Unit & Integration Tests: Vitest
**Configuration:** `vitest.config.ts`  
**Test Directory:** `tests/unit/`  
**Setup File:** `tests/setup.ts`

**Features:**
- TypeScript support
- Code coverage reporting (v8 provider)
- Path aliases configured (`@`, `@shared`)
- Global test environment setup

### E2E Tests: Playwright
**Configuration:** `playwright.config.ts`  
**Test Directory:** `tests/e2e/`  
**Browsers:** Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari

**Features:**
- Parallel test execution
- Screenshot on failure
- Trace on retry
- Auto-start dev server

---

## Test Strategy & Protocol

### 1. Testing Pyramid

* **Unit Tests:** Located in `tests/unit/`. Run via `npm test`.

* **Integration Tests:** Located in `tests/e2e/`. Run via `npm run test:e2e`.

### 2. Debugging Protocol

* **Debug Mode:** Use the "Attach to Running Chrome" launch config on port 9222.

* **AI Debugging:** The `chrome-devtools` MCP server is active.

    * **Console Errors:** AI must read browser console logs via MCP before suggesting fixes.

    * **Network:** AI must inspect fetch headers via MCP if API calls fail.

---

## Test Commands

### Unit Tests
```bash
# Run all unit tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

### E2E Tests
```bash
# Run all E2E tests
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui

# Run E2E tests in headed mode (see browser)
npm run test:e2e:headed

# Run specific test file
npx playwright test tests/e2e/auth.spec.ts
```

### Coverage Targets
- **Unit Tests:** Minimum 70% coverage for new code
- **Critical Paths:** Minimum 90% coverage (auth, payments, data access)
- **Integration Tests:** Cover all API endpoints

---

## Test Structure

### Unit Test Structure
```
tests/unit/
  ├── auth.test.ts          # Authentication tests
  ├── storage.test.ts       # Database storage tests
  └── [module].test.ts      # Module-specific tests
```

### E2E Test Structure
```
tests/e2e/
  ├── auth.spec.ts          # Authentication flows
  ├── projects.spec.ts      # Project management flows
  └── [feature].spec.ts     # Feature-specific flows
```

### Test Fixtures
```
tests/fixtures/
  ├── auth.ts               # Authentication helpers
  └── db.ts                 # Database helpers
```

---

## Mocking Patterns

### Database Mocking
**Pattern:** Use test database with fixtures

```typescript
import { createTestUser, createTestOrganization } from '../fixtures/db';

describe('User Management', () => {
  it('should create user', async () => {
    const org = await createTestOrganization();
    const user = await createTestUser();
    // Test logic
  });
});
```

### External API Mocking
**Pattern:** Mock HTTP requests using Vitest mocks

```typescript
import { vi } from 'vitest';

// Mock external API
vi.mock('../../server/exchangeRateService', () => ({
  fetchExchangeRates: vi.fn().mockResolvedValue({
    USD: 1.0,
    EUR: 0.85,
  }),
}));
```

### Authentication Mocking
**Pattern:** Use test fixtures for authenticated requests

```typescript
import { createAuthenticatedUser } from '../fixtures/auth';

describe('Protected Route', () => {
  it('should require authentication', async () => {
    const { user, organization } = await createAuthenticatedUser();
    // Test with authenticated user
  });
});
```

---

## Test Data Management

### Test Database
- **Separate Database:** Use `projectflow_test` database
- **Isolation:** Each test should be independent
- **Cleanup:** Clean up test data after each test suite

### Test Fixtures
**Location:** `tests/fixtures/`

**Available Fixtures:**
- `createTestUser()` - Create test user
- `createTestOrganization()` - Create test organization
- `createTestProject()` - Create test project
- `createAuthenticatedUser()` - Create authenticated user session
- `linkUserToOrganization()` - Link user to organization

### Test Data Cleanup
```typescript
import { cleanupTestData } from '../fixtures/db';

afterAll(async () => {
  await cleanupTestData();
});
```

---

## Testing Scenarios

### Critical Paths (Must Have Tests)

#### Authentication & Authorization
- [ ] User registration
- [ ] User login (local auth)
- [ ] Google OAuth flow
- [ ] 2FA verification
- [ ] Session management
- [ ] Password reset
- [ ] RBAC enforcement
- [ ] Permission checks

#### Project Management
- [ ] Project creation
- [ ] Project access control
- [ ] WBS hierarchy management
- [ ] Task CRUD operations
- [ ] Task dependencies
- [ ] CPM scheduling calculations

#### Risk & Issue Management
- [ ] Risk creation and updates
- [ ] Issue tracking
- [ ] Sequential code generation
- [ ] Risk/Issue associations

#### Cost Management
- [ ] Cost item creation
- [ ] Multi-currency conversion
- [ ] Cost forecasting
- [ ] Procurement requisitions

#### User Management
- [ ] User invitation
- [ ] Role assignment
- [ ] Bulk import/export
- [ ] Activity audit logging

---

## Integration Test Patterns

### API Endpoint Testing
**Pattern:** Test full request/response cycle

```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../server/app';

describe('POST /api/projects', () => {
  it('should create project', async () => {
    const response = await request(app)
      .post('/api/projects')
      .set('Cookie', sessionCookie)
      .send({ name: 'Test Project', organizationId: 1 });
    
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
  });
});
```

### Database Query Testing
**Pattern:** Test storage layer methods

```typescript
import { storage } from '../../server/storage';

describe('Storage: getProjectsByOrganization', () => {
  it('should return projects for organization', async () => {
    const projects = await storage.getProjectsByOrganization(orgId);
    expect(projects).toBeArray();
    expect(projects[0]).toHaveProperty('organizationId', orgId);
  });
});
```

---

## E2E Test Patterns

### User Flow Testing
**Pattern:** Test complete user workflows

```typescript
import { test, expect } from '@playwright/test';

test('user can create and manage project', async ({ page }) => {
  // Login
  await page.goto('/login');
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'password');
  await page.click('button[type="submit"]');
  
  // Create project
  await page.click('text=New Project');
  await page.fill('[name="name"]', 'Test Project');
  await page.click('button:has-text("Create")');
  
  // Verify project created
  await expect(page.locator('text=Test Project')).toBeVisible();
});
```

### Critical User Journeys
- [ ] User registration → Project creation → Task management
- [ ] Risk identification → Mitigation planning → Closure
- [ ] Cost item creation → Budget tracking → Reporting
- [ ] User invitation → Role assignment → Access verification

---

## Performance Testing

### Load Testing
**Targets:**
- API response time: < 200ms (p95)
- Database query time: < 100ms (p95)
- Page load time: < 2s

### Stress Testing
**Scenarios:**
- 100 concurrent users
- 1000 tasks per project
- 100 projects per organization

**Tools:** (To be implemented)
- Artillery.io or k6 for load testing
- Lighthouse for frontend performance

---

## Security Testing

### Security Test Scenarios
- [ ] SQL injection prevention
- [ ] XSS prevention
- [ ] CSRF protection
- [ ] Authentication bypass attempts
- [ ] Authorization escalation attempts
- [ ] Input validation
- [ ] Rate limiting

### Security Test Pattern
```typescript
describe('Security: SQL Injection', () => {
  it('should prevent SQL injection in search', async () => {
    const maliciousInput = "'; DROP TABLE users; --";
    const response = await request(app)
      .get(`/api/projects?search=${encodeURIComponent(maliciousInput)}`);
    
    // Should sanitize input, not execute SQL
    expect(response.status).toBe(200);
    // Verify users table still exists
  });
});
```

---

## Regression Testing

### Pre-Merge Checklist
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All E2E tests pass
- [ ] Code coverage maintained or improved
- [ ] No new linting errors
- [ ] Backward compatibility verified

### Regression Test Suite
**Run Before:**
- Every merge to main
- Every release
- After major refactoring

**Coverage:**
- All critical paths
- All public APIs
- All database migrations

---

## Test Environment Setup

### Environment Variables
**Test Environment:** `.env.test`

**Required Variables:**
```bash
NODE_ENV=test
DATABASE_URL=postgresql://localhost:5432/projectflow_test
SESSION_SECRET=test-session-secret-for-testing-only
REDIS_HOST=redis://localhost:6379
```

### Database Setup
```bash
# Create test database
createdb projectflow_test

# Run migrations
npm run db:migrate

# Seed test data (optional)
npm run db:seed:test
```

---

## Continuous Integration

### CI Pipeline (To be implemented)
1. **Lint:** Run ESLint/TypeScript checks
2. **Unit Tests:** Run Vitest suite
3. **Integration Tests:** Run API integration tests
4. **E2E Tests:** Run Playwright suite
5. **Coverage:** Generate and check coverage report
6. **Build:** Verify production build succeeds

### CI Configuration
**File:** `.github/workflows/test.yml` (or similar)

**Triggers:**
- On pull request
- On push to main
- Scheduled (nightly)

---

## Code Coverage

### Coverage Targets
- **Overall:** Minimum 70%
- **Critical Modules:** Minimum 90%
  - Authentication (`server/auth.ts`)
  - Storage layer (`server/storage.ts`)
  - RBAC middleware (`server/middleware/rbac.ts`)
  - Security middleware (`server/middleware/security.ts`)

### Coverage Exclusions
- Configuration files (`*.config.*`)
- Type definitions (`*.d.ts`)
- Test files (`tests/**`)
- Build outputs (`dist/`, `build/`)

### Coverage Reports
- **Format:** HTML, JSON, Text
- **Location:** `coverage/` directory
- **View:** Open `coverage/index.html` in browser

---

## Test Maintenance

### Test Review Checklist
- [ ] Tests are independent (no shared state)
- [ ] Tests are deterministic (same input = same output)
- [ ] Tests are fast (< 1s per test)
- [ ] Tests are readable (clear names, good structure)
- [ ] Tests cover edge cases
- [ ] Tests cover error scenarios

### Test Naming Convention
```typescript
describe('ModuleName', () => {
  describe('functionName', () => {
    it('should [expected behavior] when [condition]', () => {
      // Test implementation
    });
  });
});
```

---

## Known Test Issues

### Current Limitations
- Test database setup incomplete
- Some tests require manual database setup
- E2E tests require running dev server manually
- Coverage reporting not fully configured

### Planned Improvements
- [ ] Automated test database setup/teardown
- [ ] Docker-based test environment
- [ ] CI/CD pipeline integration
- [ ] Test data factories for complex scenarios

---

## Testing Best Practices

### DO ✅
- Write tests before fixing bugs (TDD when possible)
- Test behavior, not implementation
- Use descriptive test names
- Keep tests simple and focused
- Mock external dependencies
- Clean up test data

### DON'T ❌
- Don't test implementation details
- Don't write flaky tests (time-dependent, random)
- Don't skip error scenarios
- Don't share test state between tests
- Don't test third-party libraries
- Don't write slow tests unnecessarily

---

## References

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Best Practices](https://testingjavascript.com/)
- [Test-Driven Development](https://en.wikipedia.org/wiki/Test-driven_development)

---
**Last Updated:** 2025-01-03  
**Maintainer:** Technical Lead  
**Review Frequency:** Quarterly or when testing strategy changes

