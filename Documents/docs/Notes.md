# Architectural Decisions & Knowledge Base

> **Purpose:** Document architectural decisions, design patterns, and technical knowledge for the project.

---

## Architecture Overview

### Technology Stack
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend:** Node.js, Express, TypeScript
- **Database:** PostgreSQL with Drizzle ORM
- **Cache/Real-time:** Redis
- **Storage:** Google Cloud Storage
- **Authentication:** Local auth + Google OAuth, 2FA support
- **Email:** SendGrid
- **AI:** OpenAI (GPT-4o) / Google Gemini
- **Deployment:** Docker, GCP

### Architecture Pattern
- **Multi-tenant SaaS:** Organization → Project hierarchy
- **RBAC:** Role-based access control (Owner/Admin/Member/Viewer)
- **RESTful API:** Express routes with middleware
- **Real-time:** WebSocket with Redis pub/sub
- **Security:** Defense in depth (multiple layers)

---

## Key Architectural Decisions

### AD-001: Multi-Tenant Data Isolation
**Decision:** Use organization_id and project_id foreign keys for data isolation  
**Rationale:**  
- Simpler than row-level security
- Clear data boundaries
- Easier to audit and maintain

**Implementation:**  
- All tables include `organizationId` and/or `projectId`
- Middleware enforces access control
- Database constraints ensure referential integrity

**Trade-offs:**  
- ✅ Simple to understand and maintain
- ✅ Good performance with proper indexing
- ⚠️ Requires careful middleware enforcement

---

### AD-002: Drizzle ORM Over Raw SQL
**Decision:** Use Drizzle ORM instead of raw SQL queries  
**Rationale:**  
- Type safety with TypeScript
- Prevents SQL injection (parameterized queries)
- Better developer experience
- Schema migrations support

**Implementation:**  
- Schema defined in `shared/schema.ts`
- Migrations in `migrations/` directory
- Storage layer abstracts database operations

**Trade-offs:**  
- ✅ Type safety and SQL injection prevention
- ✅ Better maintainability
- ⚠️ Learning curve for team
- ⚠️ Some complex queries may be harder to express

---

### AD-003: RBAC Middleware Pattern
**Decision:** Implement RBAC as Express middleware  
**Rationale:**  
- Centralized authorization logic
- Reusable across routes
- Easy to test and maintain

**Implementation:**  
- `server/middleware/rbac.ts` - Role-based checks
- `server/middleware/security.ts` - Security headers, rate limiting
- `server/middleware/audit.ts` - Audit logging

**Trade-offs:**  
- ✅ Centralized and reusable
- ✅ Easy to extend with new roles/permissions
- ⚠️ Requires careful route organization

---

### AD-004: WebSocket for Real-Time Features
**Decision:** Use WebSocket with Redis pub/sub for real-time updates  
**Rationale:**  
- Low latency for real-time collaboration
- Scalable with Redis pub/sub
- Supports multiple server instances

**Implementation:**  
- `server/websocket.ts` - WebSocket server
- Redis pub/sub for message distribution
- Client-side WebSocket connection management

**Trade-offs:**  
- ✅ Real-time updates
- ✅ Scalable architecture
- ⚠️ Additional infrastructure complexity
- ⚠️ Connection management overhead

---

### AD-005: Security-First Approach
**Decision:** Implement multiple layers of security (defense in depth)  
**Rationale:**  
- Hostile environment assumption
- Multiple layers reduce risk
- Industry best practices

**Implementation:**  
- Helmet.js for security headers
- Rate limiting (API, Auth, Upload)
- Input sanitization
- CORS restrictions
- CSRF protection
- Audit logging
- SQL injection prevention (Drizzle parameterization)
- XSS prevention (React escaping)

**Trade-offs:**  
- ✅ Strong security posture
- ✅ Defense in depth
- ⚠️ Additional complexity
- ⚠️ Potential performance impact (mitigated with caching)

---

### AD-006: Currency Exchange via ECB API
**Decision:** Use European Central Bank (ECB) API for exchange rates  
**Rationale:**  
- Free and reliable
- Daily updates sufficient for EPC projects
- No API key required

**Implementation:**  
- `server/exchangeRateService.ts` - ECB API integration
- Daily sync scheduler
- `exchange_rates` table for caching

**Trade-offs:**  
- ✅ Free and reliable
- ✅ Sufficient for EPC use cases
- ⚠️ Daily updates only (not real-time)
- ⚠️ Limited to EUR-based rates

---

### AD-007: PWA Foundation Without Offline Sync
**Decision:** Implement PWA foundation but defer offline capability  
**Rationale:**  
- PWA foundation enables future offline support
- Offline sync is complex and can be added later
- Focus on core features first

**Implementation:**  
- Responsive design
- PWA manifest
- Service worker placeholder (not implemented)

**Trade-offs:**  
- ✅ Foundation for future enhancement
- ✅ Responsive design benefits
- ⚠️ Offline capability missing (deferred to Phase 3)

---

### AD-008: Schema Alignment Strategy
**Decision:** Use Option A - Align Schema to Database (recommended)  
**Rationale:**  
- Database already has production data
- Less risk of data loss
- Faster to implement

**Implementation:**  
- Update `shared/schema.ts` to match actual database structure
- Remove raw SQL fallbacks after alignment
- Re-enable schema validation in routes

**Trade-offs:**  
- ✅ Preserves existing data
- ✅ Faster implementation
- ⚠️ Schema may not match original design intent
- ⚠️ Requires careful mapping

**Alternative (Option B):**  
Align database to schema via migrations (riskier, may require data migration).

**Status:** ⚠️ In Progress - Raw SQL fallbacks currently in place as temporary workaround.

---

### AD-009: Knowledge Base / Lessons Learned System
**Decision:** Implement organization-wide Lessons Learned knowledge base  
**Rationale:**  
- Enables learning from past projects
- Reduces repeated mistakes
- Integrates with Risk Management for proactive risk identification

**Implementation:**  
- `lessonsLearned` table with category, outcome, action fields
- Search API endpoint (`/api/organizations/:orgId/lessons/search`)
- Risk Suggestions component with debounced search
- AI Assistant integration (`search_lessons_learned` function)

**Trade-offs:**  
- ✅ Valuable organizational knowledge asset
- ✅ Proactive risk management
- ⚠️ Requires user discipline to maintain
- ⚠️ Search quality depends on data quality

**Integration Points:**
- Risk Management (Smart Risk Suggestions)
- AI Assistant (knowledge retrieval)
- Future: Issue Management, Change Requests

---

### AD-010: Communication Intelligence (Not Emotion AI)
**Decision:** Implement Communication Intelligence focusing on measurable, actionable data  
**Rationale:**  
- Respects professional boundaries
- Provides actionable insights without emotional analysis
- Focuses on tone, clarity, responsiveness metrics

**Implementation:**  
- Communication intelligence fields (tone, clarity, responsiveness)
- Database schema for tracking communication patterns
- Migration: `0001_add_communication_intelligence`
- Migration: `0002_add_communication_intelligence_only`

**Trade-offs:**  
- ✅ Professional and appropriate
- ✅ Measurable metrics
- ⚠️ Limited compared to full emotion AI
- ⚠️ Requires careful implementation to avoid overstepping

**Key Principle:**  
Focus on "Communication Intelligence" rather than "Emotional Intelligence" - measurable, actionable data that respects professional boundaries.

---

## Design Patterns

### Pattern: Storage Layer Abstraction
**Description:** Abstract database operations behind storage methods  
**Example:**  
```typescript
// Instead of direct database calls in routes
const users = await db.select().from(users).where(...)

// Use storage methods
const users = await storage.users.list(organizationId)
```

**Benefits:**  
- Easier to test (mock storage layer)
- Centralized business logic
- Easier to swap database implementations

---

### Pattern: Middleware Chain
**Description:** Chain middleware for request processing  
**Example:**  
```typescript
router.post('/api/projects',
  authenticate,      // Verify authentication
  rbac.checkRole(['owner', 'admin']),  // Check permissions
  audit.logAction,   // Log action
  validateInput,     // Validate request
  handler            // Process request
)
```

**Benefits:**  
- Separation of concerns
- Reusable middleware
- Easy to add/remove layers

---

### Pattern: Sequential Code Generation
**Description:** Generate sequential codes for entities (RISK-001, ISS-001)  
**Implementation:**  
- Database sequence or counter table
- Format: `{PREFIX}-{NUMBER}` (e.g., RISK-001)
- Project-scoped sequences

**Benefits:**  
- Human-readable identifiers
- EPC industry standard
- Easy to reference in communication

---

## Database Schema Patterns

### Pattern: Soft Deletes
**Description:** Use `deletedAt` timestamp instead of hard deletes  
**Rationale:**  
- Audit trail preservation
- Data recovery capability
- Compliance requirements

**Implementation:**  
- Add `deletedAt: timestamp` to relevant tables
- Filter deleted records in queries
- Provide restore functionality

---

### Pattern: Audit Fields
**Description:** Include `createdAt`, `updatedAt`, `createdBy`, `updatedBy`  
**Rationale:**  
- Audit trail
- Compliance requirements
- Debugging and support

**Implementation:**  
- Standard fields on all tables
- Automatically populated by middleware
- Queryable for audit reports

---

## API Design Patterns

### Pattern: RESTful Resource Naming
**Description:** Use RESTful conventions for API routes  
**Example:**  
```
GET    /api/projects/:projectId/tasks
POST   /api/projects/:projectId/tasks
GET    /api/projects/:projectId/tasks/:taskId
PUT    /api/projects/:projectId/tasks/:taskId
DELETE /api/projects/:projectId/tasks/:taskId
```

**Benefits:**  
- Predictable API structure
- Standard HTTP methods
- Easy to understand and document

---

### Pattern: Error Response Format
**Description:** Consistent error response structure  
**Example:**  
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": {
      "field": "email",
      "reason": "Invalid email format"
    }
  }
}
```

**Benefits:**  
- Consistent error handling
- Easier client-side error handling
- Better debugging

---

## Security Patterns

### Pattern: Input Validation & Sanitization
**Description:** Validate and sanitize all user inputs  
**Implementation:**  
- Input validation middleware
- Null byte removal
- Control character sanitization
- Type checking

**Benefits:**  
- Prevents injection attacks
- Data integrity
- Better error messages

---

### Pattern: Rate Limiting
**Description:** Limit request rates to prevent abuse  
**Implementation:**  
- API rate limiter (general)
- Auth rate limiter (stricter)
- Password reset limiter (very strict)
- Upload limiter (file size/rate)

**Benefits:**  
- Prevents brute force attacks
- Protects against DDoS
- Resource protection

---

## Testing Patterns

### Pattern: Test Fixtures
**Description:** Reusable test data and setup  
**Implementation:**  
- `tests/fixtures/auth.ts` - Authentication helpers
- `tests/fixtures/db.ts` - Database helpers
- Test data factories

**Benefits:**  
- Consistent test setup
- Easier test maintenance
- Faster test development

---

## Performance Patterns

### Pattern: Caching Strategy
**Description:** Cache frequently accessed data  
**Implementation:**  
- Redis for session data
- Exchange rates cached in database
- Static assets via CDN (future)

**Benefits:**  
- Reduced database load
- Faster response times
- Better scalability

---

## Knowledge Base

### Common Issues & Solutions

#### Issue: Database Connection Pool Exhaustion
**Solution:**  
- Configure connection pool limits
- Use connection pooling (pg-pool)
- Monitor connection usage

#### Issue: WebSocket Connection Drops
**Solution:**  
- Implement reconnection logic
- Heartbeat/ping mechanism
- Connection state management

#### Issue: Large File Uploads Failing
**Solution:**  
- Implement chunked uploads
- Increase upload limits
- Use Cloud Storage direct upload (signed URLs)

#### Issue: Schema Mismatches Causing Failures
**Solution:**  
- Implement raw SQL fallbacks as temporary workaround
- Use try-catch with error code checking (`error.code === "42703"`)
- Long-term: Complete schema alignment (see AD-008)

**Pattern:**
```typescript
try {
  // Drizzle ORM query
} catch (error: any) {
  if (error.code === "42703" || error.message?.includes("does not exist")) {
    // Raw SQL fallback
  }
}
```

#### Issue: Missing Environment Variables
**Solution:**  
- Environment variable validation on startup
- Clear error messages for missing required variables
- Document all required variables in `.env.example`

#### Issue: Server Routes Failing Due to Missing Schemas
**Solution:**  
- Comment out undefined schema imports temporarily
- Disable schema validation for affected routes
- Long-term: Implement missing schemas or remove unused routes

---

## External Dependencies

### Critical Dependencies
- **PostgreSQL:** Database (must be available)
- **Redis:** Cache and real-time (must be available)
- **SendGrid:** Email delivery (can degrade gracefully)
- **ECB API:** Exchange rates (can use cached rates)
- **OpenAI/Gemini:** AI Assistant (optional feature)

### Dependency Management
- All dependencies pinned in `package-lock.json`
- Regular security audits (`npm audit`)
- Update strategy: Test updates in dev before production

---

## Deployment Patterns

### Pattern: Environment-Based Configuration
**Description:** Use environment variables for configuration  
**Implementation:**  
- `.env` files for local development
- Environment variables in production
- Validation on startup

**Benefits:**  
- No secrets in code
- Easy configuration changes
- Environment-specific settings

---

## Future Considerations

### Scalability
- Consider read replicas for database
- Implement CDN for static assets
- Horizontal scaling with load balancer

### Monitoring
- Cloud Monitoring integration
- Cloud Logging for centralized logs
- Error tracking (Sentry, etc.)

### Backup & Recovery
- Automated database backups
- Point-in-time recovery
- Disaster recovery plan

---

## References

- [PMI PMBOK Guide](https://www.pmi.org/pmbok-guide-standards)
- [ISO 9001 Quality Management](https://www.iso.org/iso-9001-quality-management.html)
- [ISO 45001 Occupational Health & Safety](https://www.iso.org/iso-45001-occupational-health-and-safety.html)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)

---
## Implementation Details

### Knowledge Base System

**Database Schema:**
- `lessonsLearned` table with fields: `id`, `organizationId`, `title`, `description`, `category`, `outcome`, `action`, `createdAt`, `createdBy`

**API Endpoints:**
- `GET /api/organizations/:orgId/lessons/search?q={query}` - Search lessons learned
- `POST /api/organizations/:orgId/lessons` - Create lesson learned
- `GET /api/organizations/:orgId/lessons` - List all lessons

**Frontend Components:**
- `RiskSuggestions.tsx` - Debounced search component
- Integration in `EditRiskModal.tsx`

**AI Integration:**
- Function: `search_lessons_learned`
- Context: Included in AI Assistant context for proactive knowledge retrieval

### Communication Intelligence System

**Database Schema:**
- Communication intelligence fields added to relevant tables
- Tracks: tone, clarity, responsiveness metrics

**Migrations:**
- `0001_add_communication_intelligence` (~1:00 AM UTC, Jan 3, 2025)
- `0002_add_communication_intelligence_only` (~2:20 AM UTC, Jan 3, 2025)

**Key Principle:**  
Focus on measurable, actionable communication metrics rather than emotional analysis.

---

## GCP Integration

### Cloud Services Implemented
- **Cloud Logging** (`server/services/cloudLogging.ts`) - Centralized structured logging
- **Cloud Monitoring** (`server/services/cloudMonitoring.ts`) - Custom metrics tracking
- **Secret Manager** (`server/services/secretManager.ts`) - Secure secret management
- **Cloud Storage** - Database backups and file storage
- **CI/CD Pipeline** (`cloudbuild.yaml`) - Automated build and deployment

### Production Infrastructure
- Docker multi-stage builds
- Cloud Run deployment ready
- Automated database backups
- Health check endpoints

---

## Security Tools & Error Handling

### Security Infrastructure
- **Helmet.js** - Security headers (CSP, HSTS)
- **Rate Limiting** - API, Auth, Password Reset, Upload limiters
- **CORS** - Strict origin whitelist in production
- **Input Sanitization** - Null byte removal, control character sanitization
- **Environment Validation** - Startup validation for required vars

### Error Handling
- **Server-side:** Global error middleware, Zod validation
- **Client-side:** API error handling, Toast notifications
- **Missing:** React Error Boundary (recommended for production)

### Debugging Tools
- Server request logging (method, path, status, duration)
- Vite runtime error modal (development)
- Source maps enabled
- Cloud Logging integration

---

**Last Updated:** 2025-01-03  
**Maintainer:** Technical Lead  
**Review Frequency:** As architectural decisions are made

