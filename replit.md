# EPC PMIS - Project Management Information Software

## Overview
A comprehensive, multi-tenant SaaS platform for EPC (Engineering, Procurement, Construction) project management, built with TypeScript, React, Express, and PostgreSQL. Supports 100 organizations with up to 100 projects each containing up to 1000 tasks.

## Current Status
**Phase:** Core Features Complete, Advanced Features In Progress
**Last Updated:** November 25, 2024

### ✅ Completed
- Multi-tenant database schema with all core tables
- Replit Auth integration with session management
- Complete backend API with authorization and validation
- Frontend authentication flow (login page, auth guard)
- ProjectContext for global org/project selection
- WBS, Stakeholders, Risks, Issues pages with CRUD operations
- TopBar with real organization/project data
- AI Assistant with OpenAI (GPT-4o) integration, project-scoped conversations
- PDF Report generation (Risk Register, Project Status, EVA, Issue Log)
- Email Template system with SendGrid integration and placeholder replacement
- WebSocket real-time collaboration infrastructure
- Auto-generated sequential codes (RISK-001, ISS-001, etc.)
- **Dependencies tab redesign** with two-column layout (Predecessors/Successors), inline editing, and full CRUD support
- **Import/Export functionality** - JSON export (full project data), CSV export (tasks), PDF status reports via TopBar dropdown
- **Flexible Import System** - Allows any text values for discipline and assignedTo fields from external AI tools (ChatGPT, Claude, Gemini)
- **Label Management** - Settings page tab for normalizing discipline and assignee labels after import (bulk find-and-replace)
- **EPC Analytics Dashboard** with S-Curve chart and EVA performance indicators (SPI/CPI gauges)
- **RACI Matrix with Inheritance** - Redesigned with 4 RACI columns (R/A/C/I), collapsible WBS tree, multi-select dropdowns for stakeholders + resources, automatic inheritance propagation from parent to children, reset to parent capability, Accountable warning for multiple assignments
- **Resource Assignments Tab** - Enhanced ResourceDetailsModal showing all task assignments for a resource with WBS code, dates, allocation %, and planned hours
- **Resource Utilization View** - Timeline visualization with weekly periods showing utilization % per resource, color-coded cells (green/yellow/orange/red), over-allocation warnings, prorated allocation calculations
- **CPM Scheduling Engine** - Full Critical Path Method implementation:
  - Forward Pass: Calculates Early Start (ES) and Early Finish (EF) dates
  - Backward Pass: Calculates Late Start (LS) and Late Finish (LF) dates
  - Float Calculation: Total Float and Free Float for each task
  - Critical Path: Identifies zero-float tasks as critical
  - Supports all dependency types (FS, SS, FF, SF) with lag/lead time
  - Business day calculations (skips weekends)
  - Constraint handling (ASAP, SNET, FNET, MSO, MFO)

### 🚧 In Progress / Needs Completion
- PWA offline capabilities (IndexedDB caching, 7-day support)
- Google Drive, OneDrive, Dropbox cloud storage connectors
- Admin dashboard and marketing landing page
- End-to-end testing with Playwright

**Last Updated:** November 25, 2024

## Architecture

### Technology Stack
- **Frontend:** React + Vite, shadcn/ui components, Tailwind CSS, TanStack Query
- **Backend:** Express.js, TypeScript
- **Database:** PostgreSQL (Neon), Drizzle ORM
- **Authentication:** Replit Auth (OpenID Connect)
- **AI Integration:** Google Gemini AI (API key configured)
- **Styling:** Material Design 3 inspired, Inter + Roboto Mono fonts

### Multi-Tenant Architecture
- Organization-based data isolation
- User-Organization many-to-many relationship
- Role-based access control (owner, admin, member, viewer)
- Each organization can have multiple projects
- Each project contains tasks, stakeholders, risks, issues, costs

## Database Schema

### Core Tables
1. **organizations** - Root tenant table (id, name, slug)
2. **users** - Replit Auth compatible (id, email, firstName, lastName, profileImageUrl)
3. **sessions** - Required for Replit Auth session management
4. **user_organizations** - User-org relationship with roles
5. **projects** - Project data (budget, dates, currency, status)
6. **tasks** - WBS hierarchy with 5 levels (parentId, wbsCode)
7. **task_dependencies** - FS, SS, FF, SF dependency types
8. **stakeholders** - Project stakeholder management
9. **risks** - Risk register with probability/impact
10. **issues** - Issue tracking system
11. **change_requests** - Change request workflow
12. **cost_items** - Multi-currency cost tracking
13. **resources** - Resource management
14. **resource_assignments** - Task-resource allocation
15. **google_connections** - User's Google account OAuth tokens

### Key Features
- WBS codes support 5-level hierarchy (e.g., "1.2.3.4.5")
- Task dependencies: FS (Finish-Start), SS (Start-Start), FF (Finish-Finish), SF (Start-Finish)
- Multi-currency support (default USD)
- Progress tracking (0-100%)
- Status tracking for all entities

## API Routes

### Authentication
- `GET /api/login` - Initiate Replit Auth flow
- `GET /api/callback` - OAuth callback
- `GET /api/logout` - Sign out
- `GET /api/auth/user` - Get current user (protected)

### Organizations
- `GET /api/organizations` - List user's organizations
- `POST /api/organizations` - Create organization

### Projects
- `GET /api/organizations/:orgId/projects` - List projects
- `GET /api/projects/:id` - Get project details
- `POST /api/projects` - Create project
- `PATCH /api/projects/:id` - Update project

### Tasks
- `GET /api/projects/:projectId/tasks` - List all tasks
- `GET /api/tasks/:id` - Get task details
- `POST /api/tasks` - Create task
- `PATCH /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task

### Task Dependencies
- `GET /api/projects/:projectId/dependencies` - Get all dependencies for project
- `POST /api/dependencies` - Create new dependency
- `PATCH /api/dependencies/:id` - Update dependency (type, lagDays)
- `DELETE /api/dependencies/:id` - Remove dependency

### RACI Matrix
- `GET /api/projects/:projectId/raci` - Get all RACI assignments for project
- `GET /api/tasks/:taskId/raci` - Get RACI assignments for specific task
- `POST /api/raci` - Create RACI assignment (propagates to descendants)
- `PATCH /api/raci/:id` - Update RACI assignment
- `DELETE /api/raci/:id` - Delete RACI assignment (removes inherited from descendants)
- `POST /api/raci/reset` - Reset task's RACI to inherit from parent

### Stakeholders, Risks, Issues, Costs
- Similar RESTful patterns for each module
- All protected with `isAuthenticated` middleware

### WebSocket Real-Time Collaboration
- Path: `/ws` (WebSocket server on same port as HTTP)
- Events: task/risk/issue/stakeholder/cost-item CRUD notifications
- Rooms: Project-scoped and organization-scoped
- Features: User presence tracking, cursor sharing, auto-reconnection
- Hook: `useWebSocket()` for frontend integration

### AI Assistant
- Path: `/api/ai/chat` (POST)
- Model: OpenAI GPT-4o
- Features: Project-scoped conversations, function calling for CRUD operations
- Endpoints: conversations CRUD, cache purging, usage tracking

### PDF Reports
- Path: `/api/reports/risk-register/:projectId` (GET, returns PDF)
- Types: Risk Register, Project Status, EVA Analysis, Issue Log
- Library: PDFMake with embedded Roboto fonts

### Email Templates
- Path: `/api/organizations/:orgId/email-templates` (CRUD)
- Integration: SendGrid API
- Features: Placeholder replacement ({{PROJECT_NAME}}, etc.), preview, test sending
- Types: 10 notification types (task-assigned, risk-identified, etc.)

### CPM Scheduling
- `POST /api/projects/:projectId/schedule` - Run CPM scheduling (calculates ES, EF, LS, LF, Float, Critical Path)
- `GET /api/projects/:projectId/schedule` - Get schedule data for all tasks
- `GET /api/projects/:projectId/critical-path` - Get critical path tasks and total duration

### Resource Utilization
- `GET /api/projects/:projectId/resource-utilization` - Get resource utilization timeline with weekly periods
- `GET /api/resources/:resourceId/assignments` - Get all task assignments for a resource

## Frontend Pages

### Implemented
1. **Dashboard** - Project metrics, KPIs, charts
2. **WBS Page** - Task hierarchy table view
3. **Gantt Page** - Timeline visualization
4. **Kanban Page** - Task board (Not Started, In Progress, Review, Completed)
5. **Calendar Page** - Month view with task scheduling
6. **Stakeholders Page** - Stakeholder matrix
7. **Risks Page** - Risk register
8. **Issues Page** - Issue log
9. **Cost Page** - Budget vs actual analytics
10. **RACI Matrix** - Collapsible WBS tree, 4 RACI columns with multi-select dropdowns, inheritance from parent tasks

### Components
- **AppSidebar** - Left navigation (shadcn sidebar)
- **TopBar** - Org/Project/Tab selectors, search, theme toggle
- **RightSidebar** - Project metrics display
- **MetricCard** - Reusable metric display
- **TableRowCard** - Expandable row component
- **TaskModal** - Task create/edit dialog
- **ThemeProvider** - Light/dark mode

## Completed Tasks

### ✅ Task 1: Database Schema
- Designed comprehensive multi-tenant schema
- Implemented all core tables with proper relationships
- Added enums for status, priority, risk levels
- Set up Drizzle ORM with Zod schemas

### ✅ Task 2: Authentication
- Integrated Replit Auth (OpenID Connect)
- Created `server/replitAuth.ts` with session management
- Implemented `useAuth()` React hook
- Added protected route middleware
- Session storage in PostgreSQL

### ✅ Task 3: API Routes & Storage
- Created comprehensive storage interface (`IStorage`)
- Implemented `DatabaseStorage` class with all CRUD operations
- Built RESTful API routes for all modules
- Added request validation with Zod schemas
- All routes protected with authentication

## Demo Project
Auto-assigned to all users on login with "viewer" role:
- Organization: "Demo: GreenEnergy Solar" (slug: demo-solar-project)
- Project: "50MW Riverside Solar Power Plant" ($75M budget)
- 30+ tasks across 5 WBS levels (Design, Engineering, Procurement, Construction, Commissioning)
- 22 task dependencies (all types: FS, SS, FF, SF)
- 10 stakeholders (Owner, PM, Contractors, Consultants, etc.)
- 8 risks with probability/impact assessments
- 7 issues with priorities and status tracking
- 11 cost items (equipment, labor, materials, permits)
- 8 resources with task assignments

To re-seed the demo project: `npx tsx server/seed-demo.ts --run`

## Sample Data
Seeded database with:
- 1 organization: "ACME Construction Corp"
- 2 projects: "Downtown Office Complex", "Industrial Warehouse Retrofit"
- WBS task hierarchy with dependencies
- Stakeholders (sponsor, contractor, consultant)
- Risks (weather, material costs)
- Issues (permit delays, equipment)
- Cost items (labor, materials, equipment, overhead)

## Next Steps

### Task 4: Task Management Frontend Integration
- Connect WBS page to real API
- Implement task CRUD operations
- Add dependency visualization
- Enable drag-and-drop in Kanban

### Task 5: Stakeholder/Risk/Issue Management
- Wire up frontend forms to APIs
- Implement CRUD operations
- Add filtering and sorting

### Task 6: Cost Analytics
- Multi-currency calculations
- Budget vs actual charts
- Cost breakdown by category

### Task 7: Google Gemini AI
- Task suggestions based on project context
- Risk analysis
- Schedule optimization

### Task 8: Complete Frontend Integration
- Remove all mock data
- Connect all pages to APIs
- Implement state management
- Add loading states

### Task 9: Architect Review
- Code quality assessment
- Architecture pattern validation
- Performance optimization

### Task 10: E2E Testing
- Playwright test scenarios
- User workflow validation

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection (auto-configured)
- `SESSION_SECRET` - Session encryption key (auto-configured)
- `GEMINI_API_KEY` - Google Gemini AI key (configured)
- `REPL_ID` - Replit workspace ID (auto-configured)
- `ISSUER_URL` - OAuth provider URL (auto-configured)

## User Preferences
- **Design:** Material Design 3, information-dense layouts
- **Fonts:** Inter (UI), Roboto Mono (code/data)
- **Google Integrations:** Essential for the platform
  - Drive: Document storage
  - Gmail: Notifications
  - Gemini AI: Intelligent insights
  - Translate: Multi-language support
  - Sign-in: User auth
- **Offline Support:** 7-day PWA capability required (future implementation)
- **Scale:** Optimized for 100 orgs × 100 projects × 1000 tasks

## Recent Changes
- November 24, 2024: Initial database schema and authentication setup
- November 24, 2024: API routes for all core modules
- November 24, 2024: Database seeding with sample data
