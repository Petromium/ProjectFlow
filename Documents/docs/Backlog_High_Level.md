# Backlog - High Level (Master Source of Truth)

## Epic Overview
This document serves as the **master source of truth** for all features, epics, and high-level requirements. All development work should trace back to items in this backlog.

---

## Epic 1: Core PMIS Features ✅ COMPLETE
**Status:** Complete  
**Priority:** Critical

### Features
- ✅ WBS/Task Management (5-level hierarchy, dependencies, PMI scheduling)
- ✅ Gantt Chart & Kanban views
- ✅ Calendar view
- ✅ Task CRUD with EPC-specific fields (discipline, area code, contractor, MACI matrix)
- ✅ Resource management (people, equipment, materials, services)
- ✅ Cost tracking (budget vs actual, effort hours)

---

## Epic 2: Risk & Issue Management ✅ COMPLETE
**Status:** Complete  
**Priority:** Critical

### Features
- ✅ Risk Register with EPC-specific fields
- ✅ Issue Log with tracking
- ✅ Risk/Issue association with tasks
- ✅ Sequential code generation (RISK-001, ISS-001)
- ✅ PDF export (Risk Register, Issue Log)
- ✅ Smart Risk Suggestions (taps into Lessons Learned Knowledge Base)
- ✅ Risk Suggestions component with debounced search

---

## Epic 3: Stakeholder & Communication ✅ COMPLETE
**Status:** Complete  
**Priority:** High

### Features
- ✅ Stakeholder management
- ✅ RACI Matrix with inheritance
- ✅ Contacts management
- ✅ Chat system (team chat, task-specific)
- ✅ Email templates and notifications
- ✅ Communication Intelligence system (measurable, actionable data)
- ✅ Communication intelligence fields (tone, clarity, responsiveness metrics)

---

## Epic 4: Cost Management & Procurement ✅ COMPLETE
**Status:** Complete  
**Priority:** Critical

### Features
- ✅ Cost Items tracking
- ✅ Multi-currency support (ECB exchange rates)
- ✅ Cost Breakdown Structure (CBS)
- ✅ Cost forecasting
- ✅ Procurement requisitions
- ✅ Resource requirements
- ✅ Inventory allocations
- ✅ Budget vs Actual analytics
- ✅ Earned Value Analysis (EVA)

---

## Epic 5: Change Management ✅ COMPLETE
**Status:** Complete  
**Priority:** Critical

### Features
- ✅ Change Request workflow
- ✅ Approval chains
- ✅ Change impact tracking
- ✅ Change request CRUD interface

---

## Epic 6: User Management & RBAC ✅ COMPLETE
**Status:** Complete  
**Priority:** Critical

### Features
- ✅ User invitation system
- ✅ Role-based access control (Owner/Admin/Member/Viewer)
- ✅ Permission matrix
- ✅ User CRUD interface
- ✅ Bulk user import/export (CSV)
- ✅ User activity audit logging
- ✅ RBAC middleware enforcement

---

## Epic 7: Security & Compliance ✅ COMPLETE
**Status:** Complete  
**Priority:** Critical

### Features
- ✅ Authentication (Local + Google OAuth, 2FA)
- ✅ Security headers (Helmet.js)
- ✅ Rate limiting
- ✅ CORS configuration
- ✅ Input sanitization
- ✅ Audit logging
- ✅ Environment variable validation
- ✅ SQL injection prevention
- ✅ XSS prevention
- ✅ CSRF protection

---

## Epic 8: Document Management ✅ COMPLETE
**Status:** Complete  
**Priority:** High

### Features
- ✅ Document/file attachments
- ✅ Evidence gallery
- ✅ PDF report generation
- ✅ Import/Export (JSON, CSV, PDF)
- ✅ Cloud Storage integration (GCP)

---

## Epic 9: AI Assistant ✅ COMPLETE (Basic)
**Status:** Basic Implementation Complete  
**Priority:** Medium

### Features
- ✅ Project analysis functions
- ✅ Task/Risk/Issue creation
- ✅ OpenAI/Gemini integration
- ⚠️ **Enhancement Needed:** Preview/confirmation system, CRUD operations, context awareness

---

## Epic 10: Analytics & Reporting ✅ COMPLETE (Basic)
**Status:** Basic Implementation Complete  
**Priority:** Medium

### Features
- ✅ EPC Analytics Dashboard
- ✅ S-Curve charts
- ✅ EVA performance indicators (SPI/CPI)
- ✅ Project status reports
- ⚠️ **Enhancement Needed:** Advanced BI dashboards, custom widgets

---

## Epic 11: Multi-Tenant Architecture ✅ COMPLETE
**Status:** Complete  
**Priority:** Critical

### Features
- ✅ Organization/Project isolation
- ✅ Project context switching
- ✅ Multi-organization support
- ✅ Subscription schema (tiers defined)

---

## Epic 12: Real-Time Collaboration ✅ COMPLETE
**Status:** Complete  
**Priority:** High

### Features
- ✅ WebSocket infrastructure
- ✅ Redis integration
- ✅ Real-time updates
- ✅ Chat system

---

## Epic 13: Mobile & Offline Support ⚠️ PARTIAL
**Status:** Partial  
**Priority:** Medium

### Features
- ✅ Responsive design
- ✅ PWA foundation
- ❌ Offline capability (up to 7 days) - **Not Implemented**
- ❌ Service worker for offline sync - **Not Implemented**

---

## Epic 14: Testing & Quality Assurance ⬜ NOT STARTED
**Status:** Not Started  
**Priority:** Critical (Pre-Production)

### Features
- ⬜ Unit test coverage
- ⬜ E2E test coverage (Playwright)
- ⬜ Integration tests
- ⬜ Performance tests
- ⬜ Security tests

---

## Epic 15: Production Infrastructure ⬜ NOT STARTED
**Status:** Not Started  
**Priority:** Critical (Pre-Production)

### Features
- ⬜ GCP production setup
- ⬜ CI/CD pipeline
- ⬜ Monitoring and alerting (Cloud Monitoring)
- ⬜ Logging (Cloud Logging)
- ⬜ Backup and disaster recovery
- ⬜ SSL/TLS configuration

---

## Epic 17: Knowledge Base & Lessons Learned ✅ COMPLETE
**Status:** Complete  
**Priority:** High

### Features
- ✅ Lessons Learned database schema
- ✅ Knowledge Base search functionality
- ✅ Integration with Risk Management (Smart Risk Suggestions)
- ✅ AI Assistant integration (search_lessons_learned function)
- ✅ Category-based organization
- ✅ Outcome and action tracking

---

## Epic 18: Schema Alignment & Infrastructure ⚠️ IN PROGRESS
**Status:** In Progress  
**Priority:** High

### Features
- ✅ Raw SQL fallbacks for schema mismatches
- ✅ Storage layer resilience improvements
- ✅ Server routes stabilization
- ⚠️ Schema alignment strategy (Option A: Align schema to database)
- ⚠️ Remove raw SQL fallbacks (technical debt)
- ⚠️ Re-enable schema validation in routes
- ⚠️ Address TypeScript warnings (undefined types)

---

## Epic 16: Advanced Features ⬜ FUTURE
**Status:** Future Enhancement  
**Priority:** Low

### Features
- ⬜ Draggable widget library
- ⬜ Custom dashboard builder
- ⬜ Advanced AI Assistant (action-oriented with preview)
- ⬜ Third-party integrations
- ⬜ Advanced analytics and BI
- ⬜ Payment processing integration

---

## Priority Legend
- **Critical:** Must have for MVP/Production
- **High:** Important for user experience
- **Medium:** Nice to have, can be deferred
- **Low:** Future enhancement

## Status Legend
- ✅ Complete
- 🟡 In Progress
- ⚠️ Partial
- ⬜ Not Started
- ❌ Blocked/Cancelled

---
**Last Updated:** 2025-01-03  
**Maintainer:** Technical Lead  
**Review Frequency:** Weekly during active development

