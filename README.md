# BSC Management System

**Enterprise Balanced Scorecard Management System for Insurance Companies**

A full-stack web application designed to manage, track, and evaluate organizational performance through the Balanced Scorecard (BSC) framework. The system enables organizations to align business activities to their vision and strategy, improve internal and external communications, and monitor organizational performance against strategic goals across four perspectives: Financial, Customer, Internal Business Process, and Learning and Growth.

---

## Table of Contents

- [System Overview](#system-overview)
- [Key Features](#key-features)
- [Technology Stack](#technology-stack)
- [System Architecture](#system-architecture)
- [Roles and Permissions](#roles-and-permissions)
- [BSC Plan Workflow](#bsc-plan-workflow)
- [Database Schema](#database-schema)
- [API Reference](#api-reference)
- [Frontend Pages](#frontend-pages)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [Available Scripts](#available-scripts)
- [Testing](#testing)

---

## System Overview

The BSC Management System provides a centralized platform for insurance companies to:

- Define strategic objectives under four BSC perspectives
- Create measurable KPIs with baselines, targets, and actual results
- Assign weights and budgets to each plan
- Route plans through a multi-level approval hierarchy
- Generate individual, departmental, and corporate performance reports in Excel and PDF formats
- Maintain a complete audit trail of all actions

The system enforces role-based access control ensuring that each user sees and interacts only with data appropriate to their position in the organizational hierarchy.

---

## Key Features

### Plan Management
- Create, edit, version, and delete BSC plans
- Define strategic objectives, KPIs, formulas, and measurement units
- Set baselines, targets, actual results, weights, and budgets
- Link child plans to parent plans for hierarchical strategy mapping
- Assign contributors with configurable contribution percentages
- Attach supporting documents (up to 10MB per file)
- Real-time commenting on plans

### Approval Workflow
A multi-level review pipeline where plans progress through defined stages:

```
DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED → FINAL_APPROVED
                    ↕
         RETURNED_FOR_REVISION     REJECTED
```

Each transition is recorded in the approval history with reviewer identity, action taken, and comments.

### Reporting
- **Individual Reports** — Per-user performance including owned plans and contribution-weighted scores
- **Department Reports** — Aggregated department performance with per-perspective breakdowns
- **Corporate Reports** — Organization-wide scorecard with cross-department comparison
- **Excel Export** — Formatted `.xlsx` files with styled headers and numeric formatting
- **PDF Export** — Landscape A4 reports with branded header, summary section, and detailed plan table

### Dashboards
Role-adaptive dashboards that display relevant metrics:

| Role | Dashboard | Key Metrics |
|------|-----------|-------------|
| Employee | Employee Dashboard | Own plans, achievement %, contributed plans, perspective breakdown |
| Department Manager | Manager Dashboard | Department plans, pending reviews, member performance, overall achievement |
| Executive Manager / CEO / Board Member | Executive Dashboard | All plans, department comparison, top performers, status breakdown, budget overview |

### Notifications
- In-app notification system with unread count
- Notifications triggered on plan submissions, approvals, rejections, comments, and contributor assignments
- Optional email delivery when SMTP is configured
- Mark individual or all notifications as read

### Audit Trail
- Every significant action (login, plan create/update/submit/approve/reject, user create/update, department create, contributor add/remove) is logged with user identity, timestamp, action type, entity, and details

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend Framework | React 18 | Component-based UI |
| Build Tool | Vite 5 | Fast development and bundling |
| Styling | Tailwind CSS 3.4 | Utility-first CSS |
| Charts | Recharts 2.12 | Data visualization |
| Routing | React Router 6 | Client-side routing |
| HTTP Client | Axios | API communication |
| Icons | Lucide React | SVG icon library |
| Notifications | React Hot Toast | Toast notifications |
| Backend Framework | Express 4.18 | REST API server |
| ORM | Prisma 5.9 | Database access and migrations |
| Database | PostgreSQL | Relational data storage |
| Real-time | Socket.IO 4.7 | WebSocket connections |
| Authentication | JWT (jsonwebtoken) | Token-based auth |
| Password Hashing | bcryptjs | Secure password storage |
| Validation | express-validator | Request validation |
| Security | Helmet | HTTP header security |
| Logging | Morgan | HTTP request logging |
| File Uploads | Multer | Multipart form handling |
| PDF Generation | PDFKit | Server-side PDF creation |
| Excel Generation | ExcelJS | Server-side Excel creation |
| Email | Nodemailer | SMTP email delivery |
| Testing | Jest + Supertest | Unit and integration testing |

---

## System Architecture

```
┌──────────────────────────────────────────────────────────┐
│                      Frontend (React)                     │
│  Vite Dev Server → React Router → Pages/Components        │
│  Axios HTTP Client ←→ AuthContext (JWT)                   │
└──────────────────────┬───────────────────────────────────┘
                       │ REST API + WebSocket
                       ▼
┌──────────────────────────────────────────────────────────┐
│                    Backend (Express)                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐               │
││   Auth     │  │  Plans   │  │Approvals │  ... (10 route │
││  Routes    │  │  Routes  │  │  Routes  │     modules)   │
│  └─────┬────┘  └─────┬────┘  └─────┬────┘               │
│        │             │             │                      │
│  ┌─────▼─────────────▼─────────────▼────┐               │
│  │         Middleware Layer              │               │
│  │  authenticate · authorize · validate  │               │
│  └─────────────────┬────────────────────┘               │
│                    │                                     │
│  ┌─────────────────▼────────────────────┐               │
│  │           Prisma ORM                 │               │
│  └─────────────────┬────────────────────┘               │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼
              ┌─────────────────┐
              │    PostgreSQL    │
              │    Database      │
              └─────────────────┘
```

---

## Roles and Permissions

The system defines five hierarchical roles. Each role has specific access rights:

### Board Member
- View executive dashboard and all corporate data
- Approve or reject plans submitted for final review
- View audit trail
- Manage departments

### CEO
- Full executive dashboard with all metrics
- Final approval authority (sets plan to FINAL_APPROVED)
- Reject or return plans for revision
- Manage users and departments
- View audit trail
- Create and edit any plan

### Executive Manager
- Executive dashboard with organization-wide visibility
- Approve, reject, or return plans for revision
- Manage users and departments
- View audit trail
- Create and edit plans

### Department Manager
- Manager dashboard scoped to their department
- Review plans from department members
- Approve, reject, or return plans from team members
- Manage users within their department scope
- Create and edit plans

### Employee
- Employee dashboard showing own plans and contributions
- Create, edit, and delete own draft plans
- Submit plans for review
- View own plans and contribution assignments

### Access Control Matrix

| Action | Employee | Dept Manager | Exec Manager | CEO | Board |
|--------|----------|--------------|--------------|-----|-------|
| Create Plan | Yes | Yes | Yes | Yes | Yes |
| Edit Own Plan | Yes | Yes | Yes | Yes | Yes |
| Delete Own Draft | Yes | Yes | Yes | Yes | Yes |
| Submit for Review | Yes | Yes | Yes | Yes | Yes |
| Approve Plans | - | Department | All | All | Final |
| Reject Plans | - | Department | All | All | Final |
| Manage Users | - | Limited | Yes | Yes | Yes |
| Manage Departments | - | - | Yes | Yes | Yes |
| View Audit Trail | - | - | Yes | Yes | Yes |
| Generate Reports | Yes | Yes | Yes | Yes | Yes |

---

## BSC Plan Workflow

### Plan Lifecycle

1. **Draft** — Plan owner creates and edits the plan freely. Status resets to DRAFT when returned for revision.
2. **Submitted** — Owner submits the plan. The appropriate reviewer is notified based on the owner's role.
3. **Under Review** — A reviewer has acknowledged the plan. Additional reviewers at higher levels may also review.
4. **Approved** — An intermediate approval. The plan moves up the hierarchy for further review.
5. **Final Approved** — Only the CEO can grant final approval. The plan is now locked.
6. **Rejected** — The plan is permanently rejected. The owner must create a new plan.
7. **Returned for Revision** — The reviewer sends the plan back with comments. The owner can edit and resubmit.

### Reviewer Assignment by Role

| Owner Role | First Reviewer | Next Level | Final Approver |
|------------|---------------|------------|----------------|
| Employee | Dept Manager | Exec Manager | CEO |
| Department Manager | Exec Manager | CEO | CEO |
| Executive Manager | CEO | CEO | CEO |
| CEO | N/A | N/A | Self-approval |

### Version Control

Every edit to a plan increments its version number and creates a `PlanVersion` record storing a snapshot of the plan data at that point in time. This enables full revision history viewing.

### Contributor System

Plans can have multiple contributors, each assigned a contribution percentage (1-100%). The total contributions for a plan cannot exceed 100%. The plan owner's effective weight is automatically calculated as `100% - sum(contributor percentages)`.

Contributors receive:
- Notification when added to a plan
- Weighted achievement scores based on their contribution percentage
- Visibility in reports showing their contribution to organizational goals

---

## Database Schema

### Entity Relationship Overview

```
Department ──┬── User ──┬── BSCPlan ──┬── ApprovalHistory
             │          │             ├── PlanVersion
             │          │             ├── Attachment
             │          │             ├── PlanComment
             │          │             ├── PlanContributor
             │          │             └── BSCPlan (parent/child)
             │          │
             │          ├── Notification
             │          └── AuditLog
             │
             └── BSCPlan
```

### Models

#### Department
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| name | String | Unique department name |
| description | String? | Optional description |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |

#### User
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| firstName | String | First name |
| lastName | String | Last name |
| email | String | Unique email address |
| password | String | Hashed password (bcrypt, 12 rounds) |
| role | Enum | One of: BOARD_MEMBER, CEO, EXECUTIVE_MANAGER, DEPARTMENT_MANAGER, EMPLOYEE |
| departmentId | UUID? | FK to Department |
| managerId | UUID? | FK to User (reporting hierarchy) |
| isActive | Boolean | Account active status (default: true) |

#### BSCPlan
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| title | String | Plan title (max 200 chars) |
| description | String? | Detailed description |
| perspective | Enum | FINANCIAL, CUSTOMER, INTERNAL_BUSINESS_PROCESS, LEARNING_AND_GROWTH |
| status | Enum | Plan lifecycle status (default: DRAFT) |
| strategicObjective | String | The strategic objective this plan addresses |
| kpiName | String | Key Performance Indicator name |
| kpiFormula | String? | Formula for calculating the KPI |
| measurementUnit | String? | Unit of measurement |
| baseline | Float | Starting value (default: 0) |
| target | Float | Target value to achieve |
| actualResult | Float | Actual achieved value (default: 0) |
| weight | Float | Plan weight 0-100 (default: 0) |
| strategicInitiative | String? | Associated strategic initiative |
| budget | Float | Allocated budget (default: 0) |
| startDate | DateTime? | Plan start date |
| endDate | DateTime? | Plan end date |
| version | Int | Current version number (default: 1) |
| ownerId | UUID | FK to User (plan owner) |
| departmentId | UUID? | FK to Department |
| parentPlanId | UUID? | FK to BSCPlan (hierarchical linking) |

#### ApprovalHistory
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| planId | UUID | FK to BSCPlan (cascade delete) |
| reviewerId | UUID | FK to User |
| action | Enum | SUBMIT, APPROVE, REJECT, RETURN_FOR_REVISION, EDIT |
| comments | String? | Reviewer comments |
| createdAt | DateTime | Action timestamp |

#### PlanVersion
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| planId | UUID | FK to BSCPlan (cascade delete) |
| version | Int | Version number |
| data | Json | Full plan data snapshot |
| createdAt | DateTime | Snapshot timestamp |

#### Attachment
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| planId | UUID | FK to BSCPlan (cascade delete) |
| fileName | String | Original file name |
| filePath | String | Server file path |
| fileSize | Int | File size in bytes |
| mimeType | String | MIME type |
| createdAt | DateTime | Upload timestamp |

#### PlanComment
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| planId | UUID | FK to BSCPlan (cascade delete) |
| userId | UUID | FK to User |
| content | String | Comment text (max 2000 chars) |
| createdAt | DateTime | Comment timestamp |

#### Notification
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| userId | UUID | FK to User |
| title | String | Notification title |
| message | String | Notification body |
| type | String | Notification type (APPROVAL, REJECTION, REVISION, COMMENT, REVIEW_REQUIRED) |
| isRead | Boolean | Read status (default: false) |
| linkUrl | String? | Deep link to related entity |
| createdAt | DateTime | Creation timestamp |

#### AuditLog
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| userId | UUID | Acting user ID |
| userName | String | Acting user display name |
| action | String | Action type (LOGIN, CREATE_PLAN, UPDATE_PLAN, etc.) |
| entity | String | Entity type affected |
| entityId | String | Entity ID affected |
| details | Json? | Additional action details |
| ipAddress | String? | Client IP address |
| createdAt | DateTime | Action timestamp |

#### PlanContributor
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| planId | UUID | FK to BSCPlan (cascade delete) |
| userId | UUID | FK to User |
| contributionPct | Float | Contribution percentage (default: 0) |
| role | String? | Contributor role description |
| createdAt | DateTime | Assignment timestamp |
| | | Unique constraint: (planId, userId) |

---

## API Reference

All API routes are prefixed with `/api`. Authentication is required for all endpoints except `/api/auth/login`. Authentication is provided via Bearer token in the Authorization header.

### Authentication

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/auth/login` | Authenticate user and receive JWT | No |
| GET | `/api/auth/me` | Get current user profile | Yes |
| PUT | `/api/auth/change-password` | Change password | Yes |

**POST `/api/auth/login`**

Request:
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

Response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "firstName": "John",
    "lastName": "Doe",
    "email": "user@example.com",
    "role": "DEPARTMENT_MANAGER",
    "department": { "id": "uuid", "name": "Claims" }
  }
}
```

**PUT `/api/auth/change-password`**

Request:
```json
{
  "currentPassword": "oldpassword",
  "newPassword": "newpassword123"
}
```

---

### Users

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/users` | List all users (filterable) | CEO, Executive Manager, Dept Manager, Board |
| POST | `/api/users` | Create a new user | CEO, Executive Manager, Dept Manager, Board |
| PUT | `/api/users/:id` | Update a user | CEO, Executive Manager, Dept Manager, Board |
| GET | `/api/users/hierarchy` | Get users grouped by role | All authenticated |
| GET | `/api/users/my-team` | Get direct reports | Dept Manager, Exec Manager, CEO |
| GET | `/api/users/search?q=` | Search users by name/email | All authenticated |

**GET `/api/users` Query Parameters:**
- `departmentId` — Filter by department
- `role` — Filter by role
- `search` — Search by name or email (case-insensitive)

---

### Departments

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/departments` | List all departments with counts | All authenticated |
| GET | `/api/departments/:id` | Get department details with employees | All authenticated |
| POST | `/api/departments` | Create a department | CEO, Executive Manager, Board |
| PUT | `/api/departments/:id` | Update a department | CEO, Executive Manager, Board |

**POST `/api/departments`**

Request:
```json
{
  "name": "Underwriting",
  "description": "Risk assessment and policy underwriting"
}
```

---

### Plans

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/plans` | List plans (role-scoped) | All authenticated |
| GET | `/api/plans/:id` | Get plan with full details | All authenticated |
| POST | `/api/plans` | Create a new plan | All authenticated |
| PUT | `/api/plans/:id` | Update a plan | Owner or Executive+ |
| DELETE | `/api/plans/:id` | Delete a draft plan | Owner only (DRAFT status) |
| POST | `/api/plans/:id/upload` | Upload an attachment | All authenticated |
| POST | `/api/plans/:id/comments` | Add a comment | All authenticated |
| GET | `/api/plans/pending-reviews/all` | Get plans pending review | Dept Manager+ |

**GET `/api/plans` Query Parameters:**
- `status` — Filter by plan status
- `perspective` — Filter by BSC perspective
- `departmentId` — Filter by department
- `ownerId` — Filter by plan owner
- `year` — Filter by year

**POST `/api/plans`**

Request:
```json
{
  "title": "Increase Policy Renewal Rate",
  "description": "Improve customer retention through better service",
  "perspective": "CUSTOMER",
  "strategicObjective": "Enhance customer satisfaction and loyalty",
  "kpiName": "Policy Renewal Rate",
  "kpiFormula": "(Renewed Policies / Total Expiring Policies) × 100",
  "measurementUnit": "Percentage",
  "baseline": 72.5,
  "target": 85.0,
  "actualResult": 0,
  "weight": 25,
  "strategicInitiative": "Customer Excellence Program",
  "budget": 500000,
  "startDate": "2026-01-01",
  "endDate": "2026-12-31",
  "departmentId": "uuid",
  "parentPlanId": "uuid"
}
```

---

### Approvals

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/api/approvals/:planId/submit` | Submit plan for review | Plan owner |
| POST | `/api/approvals/:planId/approve` | Approve a plan | Dept Manager+ |
| POST | `/api/approvals/:planId/reject` | Reject a plan (reason required) | Dept Manager+ |
| POST | `/api/approvals/:planId/return` | Return plan for revision (comments required) | Dept Manager+ |

**POST `/api/approvals/:planId/approve`**

Request:
```json
{
  "comments": "Plan meets strategic alignment criteria. Approved for next level."
}
```

**POST `/api/approvals/:planId/reject`**

Request:
```json
{
  "comments": "KPI targets do not align with corporate objectives. Please revise the target values."
}
```
Note: Rejection comments require a minimum of 10 characters.

---

### Reports

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/reports/individual/:userId` | Individual performance data | All authenticated |
| GET | `/api/reports/department/:departmentId` | Department scorecard data | All authenticated |
| GET | `/api/reports/corporate` | Corporate-wide scorecard data | All authenticated |
| GET | `/api/reports/excel/individual/:userId?` | Download individual Excel report | All authenticated |
| GET | `/api/reports/excel/department/:id` | Download department Excel report | All authenticated |
| GET | `/api/reports/excel/corporate` | Download corporate Excel report | All authenticated |
| GET | `/api/reports/pdf/individual/:userId?` | Download individual PDF report | All authenticated |
| GET | `/api/reports/pdf/department/:id` | Download department PDF report | All authenticated |
| GET | `/api/reports/pdf/corporate` | Download corporate PDF report | All authenticated |
| GET | `/api/reports/audit-trail` | Query audit trail with filters | All authenticated |

**GET `/api/reports/audit-trail` Query Parameters:**
- `startDate` — Filter from date (ISO 8601)
- `endDate` — Filter to date (ISO 8601)
- `userId` — Filter by acting user
- `action` — Filter by action type

---

### Dashboard

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/dashboard/employee` | Employee dashboard data | All authenticated |
| GET | `/api/dashboard/manager` | Manager dashboard data | Dept Manager |
| GET | `/api/dashboard/executive` | Executive dashboard data | Exec Manager, CEO, Board |

---

### Notifications

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/notifications` | Get notifications with unread count | All authenticated |
| PUT | `/api/notifications/:id/read` | Mark one notification as read | All authenticated |
| PUT | `/api/notifications/read-all` | Mark all as read | All authenticated |

---

### Contributors

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/contributors/my-contributions` | Get plans user contributes to | All authenticated |
| GET | `/api/contributors/plan/:planId` | List contributors for a plan | All authenticated |
| POST | `/api/contributors/plan/:planId` | Add a contributor to a plan | Plan owner or Exec+ |
| PUT | `/api/contributors/:id` | Update contribution percentage | Plan owner or Exec+ |
| DELETE | `/api/contributors/:id` | Remove a contributor | Plan owner or Exec+ |

**POST `/api/contributors/plan/:planId`**

Request:
```json
{
  "userId": "uuid",
  "contributionPct": 30,
  "role": "Data Analysis"
}
```

Note: Total contributions across all contributors for a plan cannot exceed 100%.

---

### Audit

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/audit` | Get recent audit logs (max 200) | CEO, Executive Manager, Board |

---

## Frontend Pages

### Public Routes
| Path | Component | Description |
|------|-----------|-------------|
| `/login` | LoginPage | Authentication form |

### Protected Routes
| Path | Component | Access | Description |
|------|-----------|--------|-------------|
| `/` | DashboardRouter | All | Routes to role-appropriate dashboard |
| `/plans` | PlansList | All | List of plans with filters and search |
| `/plans/new` | PlanCreate | All | Plan creation form |
| `/plans/:id` | PlanDetail | All | Full plan details with history, comments, attachments |
| `/plans/:id/edit` | PlanEdit | Owner / Exec+ | Plan editing form |
| `/reviews` | PendingReviews | Dept Manager+ | Queue of plans awaiting review |
| `/reports` | ReportsPage | All | Report generation with Excel/PDF downloads |
| `/users` | UsersPage | CEO, Exec Manager, Dept Manager, Board | User management |
| `/departments` | DepartmentsPage | CEO, Exec Manager, Board | Department management |
| `/notifications` | NotificationsPage | All | Notification center |
| `/audit` | AuditTrailPage | CEO, Exec Manager, Board | Audit log viewer |
| `/settings` | SettingsPage | All | Password change and profile settings |

### Reusable Components

| Component | Description |
|-----------|-------------|
| `Layout` | Main application shell with sidebar and content area |
| `Navbar` | Top navigation bar with user info and notification bell |
| `Sidebar` | Side navigation with role-based menu items |
| `Modal` | Reusable modal dialog |
| `StatCard` | Dashboard metric card with icon and value |
| `StatusBadge` | Color-coded badge for plan statuses |
| `PerspectiveBadge` | Color-coded badge for BSC perspectives |
| `ProgressBar` | Achievement percentage bar |
| `EmptyState` | Placeholder for empty lists |
| `LoadingSpinner` | Loading indicator |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- [PostgreSQL](https://www.postgresql.org/) v14 or higher
- [Git](https://git-scm.com/)

### Installation

**1. Clone the repository**

```bash
git clone <repository-url>
cd "BSC PROJECT"
```

**2. Configure environment variables**

Create a `.env` file in the `backend/` directory:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/bsc_db"

# Authentication
JWT_SECRET="your-secure-random-secret-key"
JWT_EXPIRES_IN="7d"

# Server
PORT=5000
FRONTEND_URL="http://localhost:5173"

# Email (recommended for Render free services)
RESEND_API_KEY="re_your_resend_api_key"
RESEND_FROM="BSC System <onboarding@resend.dev>"

# SMTP fallback (requires a Render paid service)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
SMTP_FROM="BSC System <noreply@yourcompany.com>"
```

**3. Install dependencies and set up the database**

```bash
npm run setup
```

This single command will:
1. Install all backend and frontend npm dependencies
2. Generate the Prisma client
3. Push the database schema to PostgreSQL
4. Seed the database with sample departments, users, and plans

**4. Start the development servers**

```bash
npm run dev
```

The application will be available at:
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5000`

### Default Login Credentials

After seeding, the following accounts are available:

| Email | Password | Role |
|-------|----------|------|
| admin@insurance.com | Password123! | CEO |
| manager@insurance.com | Password123! | Department Manager |
| employee@insurance.com | Password123! | Employee |

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `JWT_SECRET` | Yes | — | Secret key for JWT signing |
| `JWT_EXPIRES_IN` | No | `7d` | Token expiration duration |
| `PORT` | No | `5000` | Backend server port |
| `FRONTEND_URL` | No | `http://localhost:5173` | Frontend URL for CORS |
| `RESEND_API_KEY` | No | — | Resend API key; preferred email delivery method on Render Free |
| `RESEND_FROM` | No | `BSC System <onboarding@resend.dev>` | Verified Resend sender address |
| `SMTP_HOST` | No | — | SMTP server host (enables email) |
| `SMTP_PORT` | No | `587` | SMTP server port |
| `SMTP_USER` | No | — | SMTP username |
| `SMTP_PASS` | No | — | SMTP password |
| `SMTP_FROM` | No | — | Sender email address |

---

## Project Structure

```
BSC PROJECT/
├── .github/                          # GitHub configuration
├── .gitignore                        # Git ignore rules
├── package.json                      # Root workspace configuration
│
├── backend/
│   ├── package.json                  # Backend dependencies and scripts
│   ├── .env                          # Environment variables (git-ignored)
│   ├── prisma/
│   │   ├── schema.prisma             # Database schema definition
│   │   └── seed.js                   # Database seed script
│   ├── src/
│   │   ├── index.js                  # Express server, Socket.IO, middleware setup
│   │   ├── middleware/
│   │   │   ├── auth.js               # JWT authentication and role authorization
│   │   │   └── validate.js           # express-validator error handling
│   │   ├── routes/
│   │   │   ├── auth.js               # Login, profile, password change
│   │   │   ├── users.js              # User CRUD, hierarchy, search
│   │   │   ├── departments.js        # Department CRUD
│   │   │   ├── plans.js              # Plan CRUD, comments, uploads, pending reviews
│   │   │   ├── approvals.js          # Submit, approve, reject, return for revision
│   │   │   ├── contributors.js       # Contributor management
│   │   │   ├── dashboard.js          # Employee, manager, executive dashboards
│   │   │   ├── reports.js            # Data reports, Excel/PDF generation, audit trail
│   │   │   ├── notifications.js      # Notification listing and read management
│   │   │   └── audit.js              # Audit log retrieval
│   │   └── utils/
│   │       ├── prisma.js             # Prisma client singleton
│   │       ├── helpers.js            # Notification, audit log, achievement calculation
│   │       └── email.js              # Nodemailer email transport
│   ├── __tests__/                    # Backend test suite
│   └── uploads/                      # File attachment storage
│
└── frontend/
    ├── index.html                    # HTML entry point
    ├── package.json                  # Frontend dependencies and scripts
    ├── vite.config.js                # Vite configuration
    ├── tailwind.config.js            # Tailwind CSS configuration
    ├── postcss.config.js             # PostCSS configuration
    ├── public/                       # Static assets
    └── src/
        ├── main.jsx                  # React application entry point
        ├── App.jsx                   # Route definitions and layout
        ├── index.css                 # Global styles and Tailwind directives
        ├── context/
        │   └── AuthContext.jsx       # Authentication state and JWT management
        ├── lib/
        │   ├── api.js                # Axios instance with interceptors
        │   └── utils.js              # Utility functions
        ├── components/
        │   ├── Layout.jsx            # Application shell (sidebar + content)
        │   ├── Navbar.jsx            # Top navigation bar
        │   ├── Sidebar.jsx           # Side navigation menu
        │   ├── Modal.jsx             # Reusable modal component
        │   ├── StatCard.jsx          # Dashboard statistic card
        │   ├── StatusBadge.jsx       # Plan status indicator
        │   ├── PerspectiveBadge.jsx  # BSC perspective indicator
        │   ├── ProgressBar.jsx       # Achievement percentage bar
        │   ├── EmptyState.jsx        # Empty list placeholder
        │   └── LoadingSpinner.jsx    # Loading indicator
        └── pages/
            ├── LoginPage.jsx         # Authentication page
            ├── EmployeeDashboard.jsx # Employee role dashboard
            ├── ManagerDashboard.jsx  # Manager role dashboard
            ├── ExecutiveDashboard.jsx # Executive role dashboard
            ├── PlansList.jsx         # Plans listing with filters
            ├── PlanCreate.jsx        # Plan creation form
            ├── PlanDetail.jsx        # Plan detail view
            ├── PlanEdit.jsx          # Plan editing form
            ├── PendingReviews.jsx    # Review queue
            ├── ReportsPage.jsx       # Report generation
            ├── UsersPage.jsx         # User management
            ├── DepartmentsPage.jsx   # Department management
            ├── NotificationsPage.jsx # Notification center
            ├── AuditTrailPage.jsx    # Audit log viewer
            └── SettingsPage.jsx      # User settings
```

---

## Available Scripts

### Root Level

| Command | Description |
|---------|-------------|
| `npm run dev` | Start both backend and frontend concurrently |
| `npm run dev:backend` | Start only the backend server with nodemon |
| `npm run dev:frontend` | Start only the frontend Vite dev server |
| `npm run setup` | Install deps, generate Prisma client, push schema, seed database |
| `npm run build` | Build the frontend for production |
| `npm run seed` | Re-run the database seed script |
| `npm run test` | Run backend test suite |

### Backend

| Command | Description |
|---------|-------------|
| `cd backend && npm run dev` | Start backend with auto-reload (nodemon) |
| `cd backend && npm start` | Start backend in production mode |
| `cd backend && npm test` | Run Jest test suite |
| `cd backend && npm run test:coverage` | Run tests with code coverage report |

### Frontend

| Command | Description |
|---------|-------------|
| `cd frontend && npm run dev` | Start Vite development server |
| `cd frontend && npm run build` | Production build to `dist/` |
| `cd frontend && npm run preview` | Preview production build locally |

---

## Testing

The backend uses **Jest** as the test framework with **Supertest** for HTTP assertion testing.

### Running Tests

```bash
npm run test
```

### Running Tests with Coverage

```bash
cd backend && npm run test:coverage
```

### Test Configuration

- Test environment: Node.js
- Test file pattern: `__tests__/**/*.test.js`
- Coverage output: `backend/coverage/`
- Coverage collected from: `src/**/*.js` (excluding `src/index.js`)

### Test Structure

Tests are located in `backend/__tests__/` and use `jest-mock-extended` for mocking the Prisma client. The test suite covers:

- Authentication flows (login, token validation, password change)
- Plan CRUD operations and authorization
- Approval workflow transitions
- Dashboard data aggregation
- Report generation
- User and department management
