# Architecture Map

> **Purpose:** Document key module dependencies and integration data flows for impact analysis.

---

## Architecture Overview

**Pattern:** Monolithic application with layered architecture  
**Frontend:** React SPA with Vite  
**Backend:** Express.js REST API  
**Database:** PostgreSQL with Drizzle ORM  
**Real-time:** WebSocket with Redis pub/sub

---

## 1. Frontend Integration

* **Entry:** `client/src/main.tsx`

* **Router:** Wouter library (Routes defined in `client/src/App.tsx`)

* **State:** React Context API (`client/src/contexts/` - ProjectContext, AuthContext, etc.)

## 2. External Services

* **API:** Fetch API wrapper at `client/src/lib/queryClient.ts` (uses TanStack Query)

* **Auth:** OAuth2 flow handled in `client/src/hooks/useAuth.ts` and `server/auth.ts`

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client (React)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │  Pages   │  │Components │  │  Hooks   │  │ Contexts  │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │
│       │              │              │              │       │
│       └──────────────┴──────────────┴──────────────┘       │
│                          │                                    │
│                    TanStack Query                             │
└──────────────────────────┼──────────────────────────────────┘
                           │ HTTP/WebSocket
┌──────────────────────────┼──────────────────────────────────┐
│                    Express Server                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Middleware  │→ │    Routes    │→ │   Storage    │      │
│  │  (Security,  │  │              │  │              │      │
│  │   Auth, RBAC)│  │              │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                  │                  │              │
│         └──────────────────┴──────────────────┘            │
│                            │                                 │
│                    ┌───────┴───────┐                        │
│                    │   Services    │                        │
│                    │ (Email, AI,    │                        │
│                    │  Exchange, etc)│                        │
│                    └───────────────┘                         │
└──────────────────────────┼──────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
┌───────┴──────┐  ┌────────┴────────┐  ┌─────┴─────┐
│  PostgreSQL  │  │      Redis      │  │   GCP     │
│   Database   │  │   (Cache/WS)    │  │  Services │
└──────────────┘  └─────────────────┘  └───────────┘
```

---

## Module Dependencies

### Backend Modules

#### Core Application (`server/app.ts`)
**Dependencies:**
- `server/routes.ts` - Route registration
- `server/middleware/security.ts` - Security middleware
- `server/services/cloudLogging.ts` - Logging service
- `server/services/cloudMonitoring.ts` - Monitoring service
- `server/scheduler.ts` - Background tasks

**Responsibilities:**
- Express app initialization
- Middleware chain setup
- Error handling
- Server lifecycle management

**Impact Analysis:**
- Changes here affect all routes
- Security middleware changes affect all requests
- Error handler changes affect error responses globally

---

#### Routes (`server/routes.ts`)
**Dependencies:**
- `server/storage.ts` - Data access layer
- `server/auth.ts` - Authentication
- `server/middleware/rbac.ts` - Authorization
- `server/middleware/security.ts` - Security checks
- `server/aiAssistant.ts` - AI integration
- `server/pdfReports.ts` - PDF generation
- `server/emailService.ts` - Email sending
- `@shared/schema.ts` - Zod schemas for validation

**Responsibilities:**
- HTTP route definitions
- Request validation
- Response formatting
- Business logic orchestration

**Impact Analysis:**
- Adding new routes: Low risk (isolated)
- Changing route structure: Medium risk (affects API consumers)
- Changing validation: Medium risk (may break clients)
- Changing response format: High risk (breaks API contracts)

**Key Routes:**
- `/api/auth/*` - Authentication
- `/api/organizations/*` - Organization management
- `/api/projects/*` - Project management
- `/api/tasks/*` - Task/WBS management
- `/api/risks/*` - Risk management
- `/api/issues/*` - Issue tracking
- `/api/costs/*` - Cost management
- `/api/users/*` - User management
- `/api/ai/*` - AI Assistant

---

#### Storage Layer (`server/storage.ts`)
**Dependencies:**
- `server/db.ts` - Database connection
- `@shared/schema.ts` - Database schema definitions
- Drizzle ORM - Query builder

**Responsibilities:**
- Database CRUD operations
- Query abstraction
- Data transformation
- Raw SQL fallbacks (temporary)

**Impact Analysis:**
- Changes here affect all data access
- Schema changes require migration
- Query optimization affects performance globally
- Raw SQL fallbacks are technical debt (see Issues.md)

**Key Methods:**
- `getUser()`, `createUser()`, `updateUser()`
- `getProjectsByOrganization()`, `createProject()`
- `getTasksByProject()`, `createTask()`
- `getRisksByProject()`, `createRisk()`
- `getIssuesByProject()`, `createIssue()`
- `getCostItemsByProject()`, `createCostItem()`

---

#### Database (`server/db.ts`)
**Dependencies:**
- PostgreSQL connection
- Drizzle ORM configuration
- Environment variables (`DATABASE_URL`)

**Responsibilities:**
- Database connection management
- Connection pooling
- Transaction management

**Impact Analysis:**
- Changes here affect all database operations
- Connection pool changes affect performance
- Transaction changes affect data consistency

---

#### Authentication (`server/auth.ts`)
**Dependencies:**
- `server/storage.ts` - User data access
- Passport.js - Authentication strategies
- Session store (PostgreSQL)

**Responsibilities:**
- User authentication (Local, Google OAuth)
- Session management
- 2FA support
- Password hashing/verification

**Impact Analysis:**
- Changes here affect all authenticated routes
- Session changes affect user experience
- Auth strategy changes require migration

**Integration Points:**
- Used by `server/routes.ts` via `isAuthenticated` middleware
- Used by `server/middleware/rbac.ts` for user context

---

#### RBAC Middleware (`server/middleware/rbac.ts`)
**Dependencies:**
- `server/auth.ts` - User authentication
- `server/storage.ts` - User/organization data

**Responsibilities:**
- Role-based access control
- Permission checking
- Organization/project access validation

**Impact Analysis:**
- Changes here affect authorization for all routes
- Permission logic changes affect security
- Access control changes affect user capabilities

**Integration Points:**
- Used by `server/routes.ts` for protected routes
- Checks user roles: `owner`, `admin`, `member`, `viewer`

---

#### Security Middleware (`server/middleware/security.ts`)
**Dependencies:**
- Helmet.js - Security headers
- Express-rate-limit - Rate limiting
- Environment variables

**Responsibilities:**
- Security headers (CSP, HSTS, etc.)
- Rate limiting
- CORS configuration
- Input sanitization
- Environment validation

**Impact Analysis:**
- Changes here affect security posture globally
- Rate limit changes affect API availability
- CORS changes affect frontend access
- Input sanitization changes affect security

---

#### Services

##### Email Service (`server/emailService.ts`)
**Dependencies:**
- SendGrid API
- Email templates
- `server/storage.ts` - User data

**Responsibilities:**
- Email sending
- Template management
- Placeholder replacement

**Impact Analysis:**
- Changes affect notification delivery
- Template changes affect email content
- API changes affect email reliability

---

##### AI Assistant (`server/aiAssistant.ts`)
**Dependencies:**
- OpenAI API / Google Gemini API
- `server/storage.ts` - Project data access
- Function calling infrastructure

**Responsibilities:**
- AI conversation handling
- Function calling (CRUD operations)
- Context management

**Impact Analysis:**
- Changes affect AI Assistant functionality
- Function changes affect AI capabilities
- API changes affect AI responses

---

##### Exchange Rate Service (`server/exchangeRateService.ts`)
**Dependencies:**
- ECB API (European Central Bank)
- `server/storage.ts` - Exchange rate storage
- `server/scheduler.ts` - Daily sync

**Responsibilities:**
- Exchange rate fetching
- Currency conversion
- Daily rate synchronization

**Impact Analysis:**
- Changes affect multi-currency features
- API changes affect cost calculations
- Sync changes affect rate freshness

---

##### PDF Reports (`server/pdfReports.ts`)
**Dependencies:**
- PDFKit
- `server/storage.ts` - Data access
- Font files

**Responsibilities:**
- PDF report generation
- Report templates
- Data formatting

**Impact Analysis:**
- Changes affect report generation
- Template changes affect report appearance
- Data changes affect report content

---

##### Cloud Logging (`server/services/cloudLogging.ts`)
**Dependencies:**
- Google Cloud Logging API
- Environment variables

**Responsibilities:**
- Centralized logging
- Log formatting
- Error tracking

**Impact Analysis:**
- Changes affect observability
- Log format changes affect log analysis

---

##### Cloud Monitoring (`server/services/cloudMonitoring.ts`)
**Dependencies:**
- Google Cloud Monitoring API
- Environment variables

**Responsibilities:**
- Metrics collection
- Performance monitoring
- Error tracking

**Impact Analysis:**
- Changes affect monitoring capabilities
- Metric changes affect dashboards

---

### Frontend Modules

#### Application Root (`client/src/App.tsx`)
**Dependencies:**
- React Router
- ProjectContext
- AuthContext
- Route definitions

**Responsibilities:**
- Application routing
- Context providers
- Layout structure

**Impact Analysis:**
- Route changes affect navigation
- Context changes affect global state

---

#### Pages (`client/src/pages/`)
**Dependencies:**
- Components
- Hooks (useQuery, useMutation)
- Contexts (ProjectContext)
- API client

**Key Pages:**
- `LoginPage.tsx` - Authentication
- `ProjectsPage.tsx` - Project list
- `TasksPage.tsx` - Task management
- `RisksPage.tsx` - Risk register
- `IssuesPage.tsx` - Issue tracking
- `CostPage.tsx` - Cost management
- `UserManagementPage.tsx` - User management
- `ChangeRequestsPage.tsx` - Change management

**Impact Analysis:**
- Page changes affect user workflows
- Component changes affect UI/UX
- API integration changes affect data flow

---

#### Components (`client/src/components/`)
**Dependencies:**
- shadcn/ui components
- Hooks
- Contexts
- API client

**Key Component Categories:**
- `ui/` - Base UI components (shadcn/ui)
- `tasks/` - Task-specific components
- `risks/` - Risk-specific components
- `costs/` - Cost-specific components
- `chat/` - Chat components
- `users/` - User management components

**Impact Analysis:**
- Component changes affect UI consistency
- Shared component changes affect multiple pages

---

#### Hooks (`client/src/hooks/`)
**Dependencies:**
- TanStack Query
- API client
- Contexts

**Key Hooks:**
- `useMessages.ts` - Chat messages
- `useChat.ts` - Chat functionality
- `useWebSocket.ts` - WebSocket connection
- Custom query/mutation hooks

**Impact Analysis:**
- Hook changes affect data fetching patterns
- WebSocket hook changes affect real-time features

---

#### Contexts (`client/src/contexts/`)
**Dependencies:**
- React Context API
- API client

**Key Contexts:**
- `ProjectContext.tsx` - Selected org/project
- `AuthContext.tsx` - Authentication state
- Other feature contexts

**Impact Analysis:**
- Context changes affect global state
- State changes affect all consumers

---

## Data Flow Patterns

### Request Flow (API)
```
1. HTTP Request
   ↓
2. Security Middleware (Helmet, CORS, Rate Limiting)
   ↓
3. Input Sanitization
   ↓
4. Authentication Middleware (isAuthenticated)
   ↓
5. RBAC Middleware (requireRole, checkAccess)
   ↓
6. Route Handler (validation, business logic)
   ↓
7. Storage Layer (database operations)
   ↓
8. Database (PostgreSQL)
   ↓
9. Response (JSON)
```

### Authentication Flow
```
1. User submits credentials
   ↓
2. Auth route handler
   ↓
3. Password verification / OAuth callback
   ↓
4. Session creation
   ↓
5. User serialization to session
   ↓
6. Redirect to dashboard
```

### Real-Time Flow (WebSocket)
```
1. Client connects to WebSocket
   ↓
2. WebSocket server (server/websocket.ts)
   ↓
3. Redis pub/sub subscription
   ↓
4. Event broadcast to subscribers
   ↓
5. Client receives update
```

### AI Assistant Flow
```
1. User sends message
   ↓
2. AI Assistant route handler
   ↓
3. Function calling (if needed)
   ↓
4. Storage layer (data access)
   ↓
5. AI API call (OpenAI/Gemini)
   ↓
6. Response formatting
   ↓
7. Return to client
```

---

## Integration Points

### Critical Integration Points

#### 1. Authentication → Routes
**Location:** `server/routes.ts` uses `isAuthenticated` from `server/auth.ts`  
**Impact:** All protected routes depend on this  
**Risk:** High - Changes affect security

#### 2. Routes → Storage
**Location:** All route handlers use `storage` from `server/storage.ts`  
**Impact:** All data operations depend on this  
**Risk:** High - Changes affect data access

#### 3. Storage → Database
**Location:** `server/storage.ts` uses `db` from `server/db.ts`  
**Impact:** All database operations depend on this  
**Risk:** Critical - Changes affect data persistence

#### 4. Frontend → Backend
**Location:** API calls from frontend to `/api/*` routes  
**Impact:** All frontend features depend on this  
**Risk:** High - Changes affect user experience

#### 5. WebSocket → Redis
**Location:** `server/websocket.ts` uses Redis pub/sub  
**Impact:** Real-time features depend on this  
**Risk:** Medium - Changes affect real-time updates

---

## Module Dependency Graph

```
app.ts
  ├── routes.ts
  │     ├── storage.ts → db.ts → PostgreSQL
  │     ├── auth.ts → storage.ts
  │     ├── middleware/rbac.ts → auth.ts, storage.ts
  │     ├── middleware/security.ts
  │     ├── aiAssistant.ts → storage.ts
  │     ├── pdfReports.ts → storage.ts
  │     ├── emailService.ts → storage.ts
  │     └── exchangeRateService.ts → storage.ts
  ├── middleware/security.ts
  ├── services/cloudLogging.ts
  ├── services/cloudMonitoring.ts
  └── scheduler.ts → exchangeRateService.ts

websocket.ts
  ├── Redis
  └── routes.ts (for event handling)

Frontend (React)
  ├── App.tsx
  │     ├── Pages → Components → Hooks
  │     ├── Contexts (ProjectContext, AuthContext)
  │     └── API Client → /api/* routes
  └── WebSocket Client → websocket.ts
```

---

## Impact Analysis Guidelines

### Before Making Changes

1. **Identify Affected Modules**
   - Check dependency graph
   - Review integration points
   - Identify downstream consumers

2. **Assess Risk Level**
   - **Critical:** Database, Auth, Storage layer
   - **High:** Routes, Middleware, Core services
   - **Medium:** Frontend pages, Components
   - **Low:** UI styling, Non-critical utilities

3. **Check Dependencies**
   - Review module dependencies
   - Check for circular dependencies
   - Verify interface contracts

4. **Plan Testing**
   - Unit tests for changed modules
   - Integration tests for affected flows
   - E2E tests for critical paths

### Common Impact Scenarios

#### Scenario 1: Changing Database Schema
**Affected Modules:**
- `shared/schema.ts`
- `server/storage.ts` (all methods using changed tables)
- `server/routes.ts` (routes using changed data)
- Frontend components (if data structure changes)

**Required Actions:**
- Create migration
- Update storage methods
- Update route handlers
- Update frontend types
- Update tests

#### Scenario 2: Adding New Route
**Affected Modules:**
- `server/routes.ts` (new route handler)
- `server/storage.ts` (new storage methods if needed)
- Frontend (new page/component if needed)

**Required Actions:**
- Add route handler
- Add storage methods (if needed)
- Add frontend UI (if needed)
- Add tests

#### Scenario 3: Changing Authentication Flow
**Affected Modules:**
- `server/auth.ts`
- `server/routes.ts` (all protected routes)
- `server/middleware/rbac.ts`
- Frontend auth components

**Required Actions:**
- Update auth logic
- Update session handling
- Update frontend auth flow
- Test all protected routes
- Consider migration for existing sessions

#### Scenario 4: Adding New Service
**Affected Modules:**
- New service file
- `server/routes.ts` (routes using service)
- `server/storage.ts` (if service needs data access)

**Required Actions:**
- Create service file
- Add service to routes
- Add tests
- Document service

---

## Data Flow Examples

### Example 1: Creating a Task
```
Frontend (TasksPage.tsx)
  → useMutation('POST /api/tasks')
    → API Client
      → POST /api/tasks
        → routes.ts (POST /api/tasks handler)
          → isAuthenticated middleware
          → requireRole('member') middleware
          → checkProjectAccess middleware
          → insertTaskSchema.parse() validation
          → storage.createTask()
            → db.insert(tasks)
              → PostgreSQL
          → Response (created task)
            → Frontend (task added to list)
```

### Example 2: Real-Time Task Update
```
User A updates task
  → routes.ts (PATCH /api/tasks/:id)
    → storage.updateTask()
      → PostgreSQL
    → Redis.publish('task:updated', data)
      → WebSocket server
        → Broadcast to subscribers
          → User B's browser receives update
            → TanStack Query invalidation
              → UI updates automatically
```

### Example 3: AI Assistant Creating Risk
```
Frontend (ChatPage.tsx)
  → POST /api/ai/chat
    → routes.ts (AI chat handler)
      → aiAssistant.chatWithAssistant()
        → Function calling: createRisk()
          → storage.createRisk()
            → PostgreSQL
          → Response to AI
        → AI response with created risk
          → Frontend displays result
```

---

## Known Integration Risks

### High Risk Areas

1. **Schema Mismatches**
   - Database schema vs Drizzle schema
   - Raw SQL fallbacks in place (technical debt)
   - See Issues.md #007

2. **Missing Schema Definitions**
   - 50+ schemas commented out in routes.ts
   - Schema validation disabled
   - See Issues.md #008

3. **Authentication Dependencies**
   - All routes depend on auth middleware
   - Session management critical
   - Changes affect all protected routes

4. **Storage Layer Dependencies**
   - All routes depend on storage layer
   - Schema changes cascade through storage
   - Raw SQL fallbacks are temporary

---

## References

- See `Notes.md` for architectural decisions
- See `Issues.md` for known integration issues
- See `Test_Strategy.md` for testing integration points

---
**Last Updated:** 2025-01-03  
**Maintainer:** Technical Lead  
**Review Frequency:** When architecture changes or new modules added

