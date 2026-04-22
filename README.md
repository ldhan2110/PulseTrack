# PulseTrack

**A full-featured project management platform with AI-assisted planning, agile sprint management, bug tracking, test management, and real-time collaboration.**

![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?style=flat-square&logo=nestjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)
![License](https://img.shields.io/badge/License-Private-red?style=flat-square)

---

## Overview

PulseTrack is an internal project management platform designed for software development teams. It combines agile workflow tooling (sprints, backlogs, Kanban boards, WBS) with integrated bug tracking, test management, and AI-assisted content generation — all backed by real-time collaboration via WebSockets and a role-based access control system.

---

## Key Features

**Agile Project Management**
- Sprint planning, sprint boards, and backlog management
- Drag-and-drop task ordering with priority and status workflows
- Kanban-style sprint board with configurable swimlanes

**Bug Tracking**
- Dedicated bug lifecycle management with severity, status, and assignee tracking
- Time logging per bug, fix-task linking, and attachment support
- Watcher subscriptions and comment threads

**Work Breakdown Structure (WBS)**
- Hierarchical task decomposition with AI-assisted generation
- Interactive WBS tree editor and Gantt chart integration

**Wiki and Documentation**
- Rich-text wiki per project (TipTap editor)
- AI-assisted wiki generation and configurable wiki sections

**Test Management**
- Full test case authoring with steps, expected results, and priority
- Test suites, test modules, and execution runs with pass/fail tracking
- AI-assisted test case generation from feature descriptions

**AI-Assisted Features**
- Task generation from natural language descriptions
- Test case generation from feature/requirement context
- WBS generation from project scope
- Configurable AI provider via OpenRouter

**Real-time Collaboration**
- Live updates via Socket.io across task, bug, and notification events
- In-app notification center with email notification support

**Time Tracking**
- Per-task and per-bug time log entries
- Aggregated time reports per sprint and project

**Role-Based Access Control**
- Configurable roles and permissions per project
- Member management with invite flows

**Reporting and Export**
- Dashboard analytics with Recharts visualizations
- Report generation with ExcelJS export
- Saved filters for reusable query views

---

## Tech Stack

### Backend (`apps/api`)

| Technology | Purpose |
|---|---|
| NestJS 11 | Application framework |
| TypeScript | Language |
| Prisma ORM 7 | Database ORM and migrations |
| PostgreSQL 16 | Primary database |
| Redis 7 + BullMQ | Job queues and background processing |
| Socket.io | Real-time event broadcasting |
| Passport.js + JWT | Authentication middleware |
| Keycloak (OpenID Connect) | External identity provider / SSO |
| OpenRouter SDK | AI model gateway |
| Nodemailer | Email notification delivery |
| ExcelJS | Excel report export |
| Pino | Structured logging |
| Swagger | Auto-generated API documentation |
| Vitest | Unit and integration testing |

### Frontend (`apps/web`)

| Technology | Purpose |
|---|---|
| React 19 | UI framework |
| TypeScript | Language |
| Vite 8 | Build tool and dev server |
| TailwindCSS v4 + shadcn/ui | Styling and component primitives |
| TanStack Query v5 | Server state and data fetching |
| TanStack Table v8 | Data table primitives |
| React Router v7 | Client-side routing |
| Zustand | Global client state management |
| Socket.io-client | Real-time event subscription |
| TipTap | Rich text / wiki editor |
| Recharts | Charts and analytics visualizations |
| DnD Kit | Drag-and-drop interactions |
| Mermaid | Diagram rendering |
| Gantt Task React | Gantt chart views |
| XYFlow | Flow / node-graph diagrams |

### Infrastructure

| Service | Version | Purpose |
|---|---|---|
| PostgreSQL | 16 | Primary relational database |
| Redis | 7 | Cache and BullMQ queue backend |
| Docker Compose | — | Local infrastructure provisioning |
| pnpm | 10 | Monorepo package manager |

---

## Architecture

PulseTrack is organized as a pnpm workspace monorepo:

```
PulseTrack/
├── apps/
│   ├── api/          # NestJS backend (@pm/api)
│   └── web/          # React + Vite frontend (@pm/web)
├── packages/
│   └── shared/       # Shared TypeScript types and utilities (@pm/shared)
├── docker-compose.yml
├── package.json      # Root workspace scripts
└── pnpm-workspace.yaml
```

The backend exposes a REST API (documented via Swagger) and a Socket.io gateway. The frontend communicates with the API via TanStack Query for HTTP calls and Socket.io-client for real-time subscriptions. Keycloak handles all authentication — the backend validates JWT tokens issued by Keycloak.

---

## Prerequisites

Before running PulseTrack locally, ensure the following are available on your machine:

- **Node.js** 20 or later
- **pnpm** 10 or later (`npm install -g pnpm`)
- **Docker** and **Docker Compose** (for PostgreSQL and Redis)
- **Keycloak** instance accessible at a known URL with a configured realm and client

---

## Getting Started

### 1. Clone the repository

```bash
git clone <repository-url>
cd PulseTrack
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Configure environment variables

Copy the example environment file and fill in the required values:

```bash
cp apps/api/.env.example apps/api/.env
```

At minimum, set the following variables in `apps/api/.env`:

```env
KEYCLOAK_URL=https://<your-keycloak-host>:8443
KEYCLOAK_REALM=pm-realm
KEYCLOAK_CLIENT_ID=pm-app
DATABASE_URL=postgresql://pm:pm_dev@localhost:5432/pm_dev
REDIS_URL=redis://localhost:6379
```

See the [Environment Variables](#environment-variables) section for the full reference.

### 4. Start local infrastructure

Start PostgreSQL and Redis using Docker Compose:

```bash
docker compose up -d
```

### 5. Run database migrations

Apply all pending Prisma migrations to the local database:

```bash
pnpm migrate
```

### 6. Generate the Prisma client

```bash
pnpm generate
```

### 7. Start the development servers

Start the API and web app in separate terminal sessions:

```bash
# Terminal 1 — NestJS API (default port: 3000)
pnpm dev:api

# Terminal 2 — Vite dev server (default port: 5173)
pnpm dev:web
```

The Swagger API documentation is available at `http://localhost:3000/api` once the backend is running.

---

## Running Tests

Run all tests across all workspaces:

```bash
pnpm test
```

Run tests for a specific workspace:

```bash
# API tests only
pnpm test:api

# Web tests only
pnpm test:web
```

---

## Environment Variables

The following environment variables are required by the API (`apps/api/.env`):

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://pm:pm_dev@localhost:5432/pm_dev` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `KEYCLOAK_URL` | Base URL of the Keycloak server | `https://auth.example.com:8443` |
| `KEYCLOAK_REALM` | Keycloak realm name | `pm-realm` |
| `KEYCLOAK_CLIENT_ID` | Keycloak client identifier for this app | `pm-app` |

Additional variables may be required for AI provider configuration (OpenRouter API key), email delivery (Nodemailer SMTP credentials), and queue settings. Refer to `apps/api/.env.example` for the complete list.

---

## Project Structure

```
apps/
├── api/
│   └── src/
│       ├── ai-config/            # AI provider configuration
│       ├── ai-task-generation/   # AI-assisted task creation
│       ├── ai-testcase-generation/ # AI-assisted test case creation
│       ├── ai-wbs-generation/    # AI-assisted WBS generation
│       ├── attachments/          # File attachment handling
│       ├── auth/                 # Keycloak JWT authentication
│       ├── branches/             # Git branch association
│       ├── bugs/                 # Bug lifecycle management
│       ├── bug-attachments/      # Attachments specific to bugs
│       ├── comments/             # Comment threads
│       ├── dashboard/            # Dashboard data aggregation
│       ├── members/              # Project member management
│       ├── my-tasks/             # User-scoped task views
│       ├── notification-email/   # Email notification delivery
│       ├── notifications/        # In-app notification system
│       ├── planner/              # Planner / calendar views
│       ├── planner-ai-config/    # AI config for planner
│       ├── prisma/               # Prisma service and schema
│       ├── projects/             # Project CRUD and settings
│       ├── queue/                # BullMQ job queue setup
│       ├── report-config/        # Report configuration
│       ├── report-generator/     # Excel report generation
│       ├── repository-config/    # Git repository integration config
│       ├── roles/                # Role and permission management
│       ├── saved-filters/        # Reusable query filter persistence
│       ├── sprints/              # Sprint management
│       ├── tasks/                # Task CRUD and workflow
│       ├── test-cases/           # Test case authoring
│       ├── test-executions/      # Test execution runs
│       ├── test-modules/         # Test module grouping
│       ├── test-suites/          # Test suite management
│       ├── time-logs/            # Time tracking entries
│       ├── users/                # User profile management
│       ├── watchers/             # Watcher subscriptions
│       ├── wbs/                  # Work Breakdown Structure
│       ├── wiki/                 # Wiki page content
│       ├── wiki-config/          # Wiki section configuration
│       ├── wiki-generation/      # AI-assisted wiki generation
│       └── workflow/             # Custom workflow state configuration
│
└── web/
    └── src/
        ├── auth/                 # Auth context and Keycloak integration
        ├── components/           # Shared UI components
        ├── hooks/                # Custom React hooks
        ├── lib/                  # API client, utilities
        ├── pages/
        │   ├── DashboardPage.tsx
        │   ├── ProjectsPage.tsx
        │   ├── ProjectDashboardPage.tsx
        │   ├── BacklogPage.tsx
        │   ├── SprintBoardPage.tsx
        │   ├── SprintsPage.tsx
        │   ├── TaskDetailPage.tsx
        │   ├── BugsPage.tsx
        │   ├── BugDetailPage.tsx
        │   ├── MyTasksPage.tsx
        │   ├── MembersPage.tsx
        │   ├── PlannerPage.tsx
        │   ├── WbsPage.tsx
        │   ├── WikiPage.tsx
        │   ├── TestCasesPage.tsx
        │   ├── TestCaseDetailPage.tsx
        │   ├── TestExecutionsPage.tsx
        │   ├── TestExecutionDetailPage.tsx
        │   ├── NotificationsPage.tsx
        │   ├── ProjectSettingsPage.tsx
        │   └── AccessDeniedPage.tsx
        ├── socket/               # Socket.io client setup
        └── store/                # Zustand global state stores
```

---

## Available Scripts

All scripts are run from the repository root using `pnpm`.

| Script | Description |
|---|---|
| `pnpm dev:api` | Start the NestJS API in watch mode |
| `pnpm dev:web` | Start the Vite frontend dev server |
| `pnpm build` | Build all workspaces for production |
| `pnpm test` | Run all tests across all workspaces |
| `pnpm test:api` | Run API tests only |
| `pnpm test:web` | Run frontend tests only |
| `pnpm migrate` | Run Prisma migrations in development |
| `pnpm migrate:deploy` | Apply migrations in a production environment |
| `pnpm generate` | Regenerate the Prisma client after schema changes |
