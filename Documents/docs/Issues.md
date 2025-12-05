# Issues & Technical Debt

> **Purpose:** Track bugs, technical debt, and known issues that need resolution.

---

## Critical Bugs 🔴

### Issue #001: Chat Page White Screen (Crash)
**Status:** ✅ RESOLVED  
**Priority:** Critical  
**Reported:** 2025-01-03  
**Resolved:** 2025-01-03

**Description:**  
Chat page crashes with white screen due to missing import in `ChatInput.tsx`.

**Root Cause:**  
Missing `useChat` import: `ReferenceError: useChat is not defined`

**Resolution:**  
Added missing import: `import { useChat } from "@/hooks/useChat";`

**Files Affected:**
- `client/src/components/chat/ChatInput.tsx`

---

### Issue #010: Production Login Failure (Google OAuth)
**Status:** ✅ RESOLVED  
**Priority:** Critical  
**Category:** Authentication  
**Reported:** 2025-01-04  
**Resolved:** 2025-01-05

**Description:**  
User unable to log in via Google OAuth in production environment. Logs showed `TokenError: Unauthorized` and HTTP 500 errors during callback. Initial attempts to rotate secrets failed due to secret corruption.

**Root Cause:**  
1. **Secret Corruption:** Updating the `GOOGLE_CLIENT_SECRET` using PowerShell `echo -n` inadvertently appended a hidden newline character, invalidating the credential.
2. **Silent Failures:** Frontend displayed generic errors, masking the specific `TokenError`.

**Resolution:**  
1. **Fixed Secret:** Re-uploaded the secret using a file-based approach in PowerShell to guarantee no hidden characters were appended.
2. **Improved Error Handling:** Updated `server/auth.ts` to catch specific OAuth errors (`TokenError`) and provide granular error details in the redirect URL (`?error=google&details=token_error`) for better debugging, while maintaining user-friendly frontend messages.

**Files Affected:**
- Google Secret Manager (`GOOGLE_CLIENT_SECRET`)
- `server/auth.ts`

**Prevention:**
- Always use file-based secret updates in PowerShell (`[System.IO.File]::WriteAllText`) or use the GCP Console UI. Avoid piping `echo` output for secrets.
- Enhanced logging in authentication flow to capture specific provider errors.

---

## High Priority Bugs 🟠

### Issue #002: Top Bar Actions Not Working
**Status:** ✅ RESOLVED  
**Priority:** High  
**Reported:** 2025-01-03  
**Resolved:** 2025-01-03

**Description:**  
Dropdown items in TopBar are purely visual and don't navigate to pages.

**Resolution:**  
Added `onClick` handlers to navigate to respective pages (Tasks, Risks, Issues, Change Requests).

**Files Affected:**
- `client/src/components/TopBar.tsx`

---

### Issue #003: Contacts CSV Import Fails on Complex Data
**Status:** ✅ RESOLVED  
**Priority:** High  
**Reported:** 2025-01-03  
**Resolved:** 2025-01-03

**Description:**  
CSV parser fails on CSV files containing commas inside quotes (e.g., "Company, Inc.").

**Root Cause:**  
Simple string splitting (`split(',')`) doesn't handle CSV edge cases.

**Resolution:**  
Implemented `papaparse` library for robust CSV parsing with flexible column matching.

**Files Affected:**
- `client/src/pages/ContactsPage.tsx`

---

### DEP-001: Cloud Run Deployment Failure
**Status:** ✅ RESOLVED  
**Priority:** High  
**Category:** Deployment  
**Reported:** 2025-01-04  
**Resolved:** 2025-01-04

**Description:**  
Cloud Run container failed to start with "failed to listen on PORT=8080".

**Root Cause:**  
Dockerfile was exposing port 5000 and setting `ENV PORT=5000`, while Cloud Run requires port 8080 (or dynamic assignment).

**Resolution:**  
Updated Dockerfile to `EXPOSE 8080`, removed hardcoded ENV, and updated app to use `process.env.PORT`.

**Files Affected:**
- `Dockerfile`
- `server/app.ts`
- `docker-compose.yml` (aligned for consistency)

---

### DEP-002: Environment Variable Validation Failure
**Status:** ✅ RESOLVED  
**Priority:** High  
**Category:** Deployment  
**Reported:** 2025-01-04  
**Resolved:** 2025-01-04

**Description:**  
Application crashed on startup in Cloud Run with "ALLOWED_ORIGINS contains invalid URLs: *".

**Root Cause:**  
Strict validation regex in `server/middleware/security.ts` did not allow wildcard `*` for CORS origins.

**Resolution:**  
Updated Cloud Run environment variable `ALLOWED_ORIGINS` to use the specific Cloud Run service URL (`https://ganttium-303401483984.us-central1.run.app`).

**Files Affected:**
- Cloud Run Configuration

---

## Medium Priority Bugs 🟡

### Issue #004: Task Modal Layout Issues
**Status:** ✅ RESOLVED  
**Priority:** Medium  
**Reported:** 2025-01-03  
**Resolved:** 2025-01-03

**Description:**  
Task modal is too long and gets cut off, making it difficult to use.

**Resolution:**  
Restructured modal with scrollable content area and better column layout (2-column: Main content + Sidebar).

**Files Affected:**
- `client/src/components/TaskModal.tsx`

---

### Issue #005: Cost Management Layout Needs Improvement
**Status:** ✅ RESOLVED  
**Priority:** Medium  
**Reported:** 2025-01-03  
**Resolved:** 2025-01-03

**Description:**  
Cost management page layout doesn't prioritize the main cost items table.

**Resolution:**  
Restructured layout: Metrics at top, Main table (3 cols) + Widgets sidebar (1 col), added search functionality.

**Files Affected:**
- `client/src/pages/CostPage.tsx`

---

### Issue #006: IssuesPage Runtime Error
**Status:** ✅ RESOLVED  
**Priority:** Critical  
**Reported:** 2025-01-03  
**Resolved:** 2025-01-03

**Description:**  
IssuesPage crashes on load with `ReferenceError: Input is not defined` at line 114.

**Impact:**  
Issues page is completely unusable.

**Root Cause:**  
Missing import statement for `Input` component from `@/components/ui/input`.

**Resolution:**  
Added missing import: `import { Input } from "@/components/ui/input";` at line 29 in `IssuesPage.tsx`.

**Files Affected:**
- `client/src/pages/IssuesPage.tsx` (line 29 - added import)

**Verification:**
- ✅ Linting check passed
- ⚠️ Manual verification pending (load IssuesPage in browser)

---

### Issue #007: Schema Mismatches Causing Failures
**Status:** ⚠️ DEFERRED  
**Priority:** High  
**Category:** Technical Debt  
**Reported:** 2025-01-03

**Description:**  
Database schema doesn't fully match Drizzle schema definitions, causing cascading failures. Extensive raw SQL fallbacks implemented as workaround.

**Impact:**  
- Type safety compromised
- Schema validation disabled for many routes
- Technical debt accumulation

**Root Cause:**  
Schema drift between database and code definitions.

**Current Workaround:**  
Raw SQL fallbacks in `server/storage.ts` for critical queries.

**Proposed Solution:**  
Option A: Align schema to database (recommended). Option B: Align database to schema. See `Notes.md` AD-008 for details.

**Files Affected:**
- `shared/schema.ts`
- `server/storage.ts`
- `server/routes.ts`

**Estimated Effort:** 2-3 weeks

---

### Issue #008: Missing Schema Definitions
**Status:** ⚠️ DEFERRED  
**Priority:** High  
**Category:** Technical Debt  
**Reported:** 2025-01-03

**Description:**  
50+ schema imports commented out in `server/routes.ts`, disabling schema validation for many endpoints.

**Impact:**  
- No input validation for affected endpoints
- Type safety compromised
- Security risk (unvalidated inputs)

**Affected Schemas:**
- `insertProjectStatusSchema`, `updateProjectStatusSchema`
- `insertKanbanColumnSchema`, `updateKanbanColumnSchema`
- `insertTaskDependencySchema`
- `insertStakeholderRaciSchema`, `updateStakeholderRaciSchema`
- `insertNotificationRuleSchema`, `updateNotificationRuleSchema`
- `insertChangeRequestSchema`, `insertChangeRequestApprovalSchema`
- `insertExchangeRateSchema`, `updateExchangeRateSchema`
- `insertCostBreakdownStructureSchema`
- `insertProcurementRequisitionSchema`
- `insertResourceRequirementSchema`
- `insertInventoryAllocationSchema`
- And 40+ more...

**Proposed Solution:**  
Either implement missing schemas or remove unused routes. Prioritize critical routes first.

**Files Affected:**
- `server/routes.ts`
- `shared/schema.ts`

**Estimated Effort:** 1-2 weeks

---

### Issue #009: Notification Rules Placeholder
**Status:** ⚠️ DEFERRED  
**Priority:** Medium  
**Category:** Technical Debt  
**Reported:** 2025-01-03

**Description:**  
`notificationRules` table is a placeholder, causing runtime SQL errors in scheduler every hour.

**Impact:**  
Noisy error logs, feature not functional.

**Proposed Solution:**  
Either implement notification rules feature or remove placeholder and disable scheduler check.

**Files Affected:**
- `server/scheduler.ts`
- `shared/schema.ts`

**Estimated Effort:** 1 week (if implementing) or 1 day (if removing)

---

## Technical Debt 🔧

### TD-001: AI Assistant Enhancement Needed
**Status:** ⚠️ DEFERRED  
**Priority:** Medium  
**Category:** Feature Enhancement

**Description:**  
AI Assistant currently executes actions immediately without preview/confirmation. Needs:
- Preview/confirmation system
- Full CRUD operations (currently only CREATE)
- Context awareness (page context, selection)
- Global access (keyboard shortcut, floating button)

**Impact:**  
User experience limitation, potential for unintended actions.

**Proposed Solution:**  
See `AI_ASSISTANT_ENHANCEMENT_PROPOSAL.md` for detailed architecture.

**Estimated Effort:** 2-3 weeks

---

### TD-002: Offline Capability Not Implemented
**Status:** ⚠️ DEFERRED  
**Priority:** Medium  
**Category:** Feature Gap

**Description:**  
PWA foundation exists but offline capability (up to 7 days) is not implemented. Service worker for offline sync is missing.

**Impact:**  
Project managers cannot work in locations with limited network connectivity.

**Proposed Solution:**  
Implement service worker with IndexedDB for offline storage and sync queue.

**Estimated Effort:** 3-4 weeks

---

### TD-003: Payment Processing Integration Missing
**Status:** ⚠️ DEFERRED  
**Priority:** Low  
**Category:** Feature Gap

**Description:**  
Subscription schema exists but no payment processing integration (Stripe, PayPal, etc.).

**Impact:**  
Cannot monetize the platform or manage subscriptions automatically.

**Proposed Solution:**  
Integrate Stripe or similar payment processor for subscription management.

**Estimated Effort:** 2-3 weeks

---

### TD-004: Advanced Analytics Dashboards Missing
**Status:** ⚠️ DEFERRED  
**Priority:** Low  
**Category:** Feature Enhancement

**Description:**  
Basic analytics exist (S-Curve, EVA indicators) but advanced BI dashboards and custom widgets are missing.

**Impact:**  
Limited analytics capabilities compared to enterprise PMIS solutions.

**Proposed Solution:**  
Implement draggable widget library and custom dashboard builder.

**Estimated Effort:** 4-6 weeks

---

### TD-005: Change Requests Route Placeholder
**Status:** ✅ PARTIALLY RESOLVED  
**Priority:** Medium  
**Category:** Feature Gap

**Description:**  
Change Requests route was previously a placeholder. Now implemented in Phase 1.2.

**Status:** ✅ Complete as of Phase 1.2

---

### TD-006: Permission System Not Fully Enforced
**Status:** ⚠️ RESOLVED  
**Priority:** High  
**Category:** Security

**Description:**  
Permission system exists in schema but was not enforced in middleware.

**Status:** ✅ Resolved in Phase 1.1 with RBAC middleware implementation.

---

### TD-007: Raw SQL Fallbacks as Technical Debt
**Status:** ⚠️ DEFERRED  
**Priority:** High  
**Category:** Technical Debt

**Description:**  
Extensive raw SQL fallbacks implemented in `server/storage.ts` as workaround for schema mismatches. These are temporary solutions, not permanent fixes.

**Impact:**  
- Code maintainability issues
- Potential for bugs
- Type safety compromised

**Proposed Solution:**  
Complete schema alignment (see Issue #007), then remove all raw SQL fallbacks and use Drizzle ORM exclusively.

**Files Affected:**
- `server/storage.ts`
- `server/scripts/seedPetromiumProject.ts`

**Estimated Effort:** Part of schema alignment work (2-3 weeks)

---

### TD-008: TypeScript Warnings (Undefined Types)
**Status:** ⚠️ DEFERRED  
**Priority:** Medium  
**Category:** Technical Debt

**Description:**  
Many tables referenced but not defined in `shared/schema.ts` (chat tables, contacts, etc.), causing TypeScript warnings and type safety issues.

**Impact:**  
Type safety compromised, potential runtime errors.

**Proposed Solution:**  
Add missing type definitions to schema or remove unused references.

**Estimated Effort:** 1 week

---

## Security Issues 🔒

### SEC-001: Security Hardening Complete
**Status:** ✅ RESOLVED  
**Priority:** Critical  
**Category:** Security  
**Resolved:** Phase 1.4

**Description:**  
Comprehensive security hardening completed:
- ✅ Helmet.js security headers
- ✅ Rate limiting
- ✅ CORS configuration
- ✅ Input sanitization
- ✅ Audit logging
- ✅ Environment validation
- ✅ SQL injection prevention (verified)
- ✅ XSS prevention (verified)
- ✅ CSRF protection

---

## Performance Issues ⚡

### PERF-001: Database Query Optimization Needed
**Status:** ⚠️ DEFERRED  
**Priority:** Medium  
**Category:** Performance

**Description:**  
No comprehensive database query optimization audit performed. May need indexing and query optimization for scale.

**Impact:**  
Potential performance degradation with large datasets (1000+ tasks per project).

**Proposed Solution:**  
Database performance audit and optimization in Phase 3.

**Estimated Effort:** 1-2 weeks

---

## UI/UX Issues 🎨

### UX-001: Widget Library Not Implemented
**Status:** ⚠️ DEFERRED  
**Priority:** Low  
**Category:** Feature Enhancement

**Description:**  
Users cannot customize dashboards with draggable widgets.

**Impact:**  
Limited customization options for different user roles.

**Proposed Solution:**  
Implement draggable widget library using `@dnd-kit/core` or `react-grid-layout`.

**Estimated Effort:** 3-4 weeks

---

## Issue Status Legend

- 🔴 Critical - Blocks core functionality
- 🟠 High - Significant impact on user experience
- 🟡 Medium - Moderate impact, can be deferred
- 🔧 Technical Debt - Code quality/maintainability
- 🔒 Security - Security-related issues
- ⚡ Performance - Performance-related issues
- 🎨 UI/UX - User interface/experience issues

**Status Values:**
- ✅ RESOLVED - Issue fixed and verified
- 🟡 IN PROGRESS - Currently being worked on
- ⚠️ DEFERRED - Acknowledged but deferred to future phase
- ⬜ OPEN - Not yet addressed

---

## Issue Reporting Template

```markdown
### Issue #XXX: [Title]
**Status:** ⬜ OPEN  
**Priority:** [Critical/High/Medium/Low]  
**Category:** [Bug/Technical Debt/Security/Performance/UI-UX]  
**Reported:** YYYY-MM-DD

**Description:**  
[Clear description of the issue]

**Steps to Reproduce:**  
1. [Step 1]
2. [Step 2]

**Expected Behavior:**  
[What should happen]

**Actual Behavior:**  
[What actually happens]

**Root Cause:**  
[If known]

**Proposed Solution:**  
[If known]

**Files Affected:**  
- [File paths]

**Estimated Effort:**  
[Time estimate]
```

---
**Last Updated:** 2025-01-05  
**Maintainer:** Technical Lead  
**Review Frequency:** Weekly during active development
