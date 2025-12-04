# Project Charter: Ganttium EPC PMIS

## Vision Statement
A specialized **Project Management Information System (PMIS)** tailored specifically for **Engineering, Procurement, and Construction (EPC)** firms. Unlike generic task management tools, this solution handles rigorous compliance, multi-disciplinary collaboration, and complex workflows inherent in capital projects.

The system architecture is built around **Role-Based Access Control (RBAC)**, providing distinct, specialized workspaces for the **Project Management Office (PMO)** governance group and the **Project Execution Team**.

### PMO Roles (Governance & Control)
1. **Project Manager (PM)** - PMI (PMBOK) Standards: Integration management, scope, schedule (CPM/PERT), cost, stakeholder engagement
2. **Quality Manager (QM)** - ISO-9001 Quality Management Systems: QA/QC workflows, NCRs, ITPs, audit trails
3. **HSE Manager** - OSHA / ISO 45001: Incident reporting, safety observations, hazard identification, RAMS, regulatory compliance
4. **Procurement Manager** - EPC Supply Chain Best Practices: Vendor management, material requisition, purchase orders, expediting, logistics
5. **Accounting Manager** - GAAP / IFRS Construction Accounting: Invoicing, progress billing, cash flow analysis, cost-to-complete tracking

### Project Execution Team (Operations)
- Designers, Engineers, Site Superintendents, Contractors, Vendors
- Consume tasks, report progress, submit RFIs, trigger workflows for PMO review

## Project Scope

### In Scope
- Multi-tenant SaaS platform supporting 100 organizations with up to 100 projects each
- EPC-specific project management features (WBS, Tasks, Risks, Issues, Change Requests)
- Role-Based Access Control (RBAC) with PMO and Project Execution Team workspaces
- Cost Management with multi-currency support and procurement workflows
- Real-time collaboration (Chat, WebSocket, Notifications)
- AI Assistant for project analysis and automation
- Document management and reporting (PDF generation)
- Mobile-responsive PWA with offline capability (up to 7 days)

### Out of Scope (Current Phase)
- Payment processing integration
- Advanced analytics and BI dashboards
- Mobile native apps (PWA only)
- Third-party integrations beyond Google OAuth

## Success Criteria
- ✅ Phase 1 MVP Completion (User Management, Change Management, Cost Enhancements, Security Hardening)
- ✅ Production-ready security posture
- ✅ Multi-tenant isolation and data security
- ✅ Core EPC workflows operational

## Stakeholders
- **Primary Users:** EPC Project Managers, PMO Teams, Quality Managers, HSE Managers, Procurement Managers, Accounting Managers
- **Development Team:** Technical Lead, Development Team
- **Business Owner:** Project Sponsor

## Constraints
- Must comply with PMI (PMBOK) standards
- Must support ISO-9001 Quality Management workflows
- Must adhere to OSHA / ISO 45001 for HSE
- Must support GAAP / IFRS Construction Accounting
- Security-first architecture (hostile environment assumption)

## Assumptions
- Users have modern browsers with JavaScript enabled
- Organizations will manage their own user invitations
- Multi-currency support via ECB exchange rates is acceptable
- Email delivery via SendGrid/SMTP is sufficient

## Timeline Overview
- **Phase 1:** MVP Completion (4-6 weeks) - IN PROGRESS
- **Phase 2:** Verification & Testing (2-3 weeks)
- **Phase 3:** Production Deployment & Optimization

---
**Last Updated:** 2025-01-03  
**Status:** Active Development - Phase 1.4 (Security Hardening)

