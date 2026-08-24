# TaskFlakes — Code Wiki

> A Notion-style **GTD (Getting Things Done)** tool optimized for **student assignment tracking**.
> Built as a full-stack TypeScript monorepo with an Express + Prisma API and a React + Vite SPA.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [High-Level Architecture](#3-high-level-architecture)
4. [Repository Structure](#4-repository-structure)
5. [Backend Architecture](#5-backend-architecture)
   - 5.1 [Application Bootstrap](#51-application-bootstrap)
   - 5.2 [Configuration](#52-configuration)
   - 5.3 [Database Schema (Prisma)](#53-database-schema-prisma)
   - 5.4 [Middleware](#54-middleware)
   - 5.5 [Validation Layer (Zod)](#55-validation-layer-zod)
   - 5.6 [Utility Modules](#56-utility-modules)
   - 5.7 [Service Layer](#57-service-layer)
   - 5.8 [Route Layer (REST API)](#58-route-layer-rest-api)
   - 5.9 [Type Definitions](#59-type-definitions)
6. [Frontend Architecture](#6-frontend-architecture)
   - 6.1 [Entry Point & Providers](#61-entry-point--providers)
   - 6.2 [Routing](#62-routing)
   - 6.3 [State Management (Zustand)](#63-state-management-zustand)
   - 6.4 [Data Fetching & API Client](#64-data-fetching--api-client)
   - 6.5 [Pages](#65-pages)
   - 6.6 [Components](#66-components)
   - 6.7 [Hooks](#67-hooks)
   - 6.8 [Internationalization (i18n)](#68-internationalization-i18n)
   - 6.9 [Styling (Tailwind)](#69-styling-tailwind)
7. [Authentication & Security Flow](#7-authentication--security-flow)
8. [Data Model & Relationships](#8-data-model--relationships)
9. [Dependency & Call-Graph Summary](#9-dependency--call-graph-summary)
10. [Running the Project](#10-running-the-project)
11. [Testing](#11-testing)
12. [Engineering Conventions & Key Decisions](#12-engineering-conventions--key-decisions)

---

## 1. Project Overview

**TaskFlakes** is a full-stack assignment tracker that applies GTD principles to academic workflow. It lets students:

- Manage **Subjects** (courses) and **custom Task Types** (e.g. Quiz, Project, Essay) — both with color-coded categorization.
- Create **Assignments** with rich metadata: status, priority, built-in type (written / writing / watching / preview / oral / composite), an optional custom **task type**, due date, and an optional **parent** for one-level **subtasks**.
- Filter, sort, paginate, and search assignments in a Notion-style table view.
- Visualize progress through a **Statistics** dashboard (overview, per-subject / per-type breakdowns, 14-day trend, weekly heatmap, overdue top 5).
- Personalize the app via **User Settings** (theme, language, defaults).
- **Export / Import** their entire workspace as a JSON bundle (merge or replace modes), plus Notion-style CSV import on the frontend.

The app is split into two packages: `backend/` (Node.js + Express API) and `frontend/` (React SPA), deployable together via [render.yaml](file:///Users/graceq/Documents/trae_projects/TaskFlakes/render.yaml).

---

## 2. Technology Stack

### Backend
| Concern | Library |
|---|---|
| Runtime | Node.js + TypeScript (ES2022, ESM) |
| HTTP framework | Express 4 |
| ORM | Prisma 5 (PostgreSQL provider) |
| Auth | `jsonwebtoken` (JWT access + refresh), `bcryptjs` (password & token hashing) |
| Validation | Zod 3 |
| Security | `helmet`, `cors`, `cookie-parser`, `express-rate-limit` |
| Logging | `morgan` (dev only) |
| Dev tooling | `tsx` (dev runner), `tsc` (build), `eslint` |

### Frontend
| Concern | Library |
|---|---|
| Framework | React 18 + TypeScript |
| Build tool | Vite 5 |
| Routing | react-router-dom 6 |
| Server state | @tanstack/react-query 5 |
| Client state | Zustand 5 |
| HTTP client | Axios |
| Validation | Zod 3 (shared types) |
| i18n | i18next + react-i18next + browser language detector |
| Styling | Tailwind CSS 3 (class-based dark mode) |
| Charts | Recharts 2 |
| Icons | lucide-react |
| CSV parsing | papaparse |

---

## 3. High-Level Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                         Browser (SPA)                         │
│  React + Vite ── React Router ── React Query ── Zustand       │
│       │                                                        │
│       │  Axios (withCredentials) ── /api/*  (Bearer + cookie) │
└───────┼────────────────────────────────────────────────────────┘
        │  Vite dev proxy → http://localhost:4000
        ▼
┌──────────────────────────────────────────────────────────────┐
│                    Express API (Node)                          │
│  helmet · cors · cookieParser · json · morgan · rateLimit     │
│  /api  └─ routes (auth, subjects, assignments, stats,         │
│           settings, export, health)                            │
│              │  validate(Zod) → requireAuth(JWT) → service    │
│              ▼                                                 │
│           Services (business logic)                            │
│              │                                                 │
│              ▼  Prisma Client (singleton)                      │
└──────────────────────────┬───────────────────────────────────┘
                           ▼
                  PostgreSQL (Prisma migrations)
```

**Request lifecycle (typical protected endpoint):**

1. `helmet` → `cors` → `cookieParser` → `express.json` → (dev) `morgan` → `apiRateLimit`.
2. Route-level `requireAuth` verifies the `Authorization: Bearer <access>` JWT and stamps `req.user`.
3. `validateBody` / `validateParams` / `validateQuery` parses input with a Zod schema; failures return `400` with per-field details.
4. The route handler calls a **service** method, which uses the singleton `prisma` client.
5. `ok` / `created` / `badRequest` … serialize a uniform `{ success, data?, meta?, error? }` envelope.
6. Any thrown error bubbles to the central `errorHandler` (Prisma `P2002`→409, `P2025`→404, validation→400, else 500).

---

## 4. Repository Structure

```
TaskFlakes/
├── render.yaml                  # Render.com deployment (web API + static site + Postgres)
├── backend/
│   ├── package.json             # taskflakes-api scripts & deps
│   ├── tsconfig.json            # ESM, strict, @/* → src/*
│   ├── .env.example
│   ├── prisma/
│   │   ├── schema.prisma        # 6 models + 4 enums
│   │   ├── seed.ts              # Phase-1 no-op seed
│   │   └── migrations/          # init · add_user_settings · add_cascade_fks
│   ├── scripts/                 # curl-based integration tests (auth, phase2, phase3)
│   └── src/
│       ├── index.ts             # createApp() + startServer()
│       ├── config/              # config, constants, prisma singleton
│       ├── middleware/          # auth, validate, errorHandler, rateLimit
│       ├── routes/              # express routers per domain
│       ├── services/            # business logic per domain
│       ├── validations/schemas.ts  # all Zod schemas + inferred types
│       ├── types/index.ts       # AuthenticatedRequest, JwtPayload, ApiResponse
│       └── utils/              # hash, jwt, response helpers
└── frontend/
    ├── package.json             # taskflakes-web scripts & deps
    ├── vite.config.ts           # @ alias, /api proxy → :4000
    ├── tailwind.config.js       # darkMode:'class', brand palette, animations
    ├── index.html
    └── src/
        ├── main.tsx             # React root + QueryClient + prime theme/locale
        ├── App.tsx              # RouterProvider
        ├── router.tsx           # route table (auth pages + Layout children)
        ├── index.css
        ├── pages/               # 7 page components
        ├── components/          # layout, nav, ui, forms
        ├── stores/              # auth, theme, locale, toast (Zustand)
        ├── hooks/useAuth.ts     # useGetCurrentUser, useLogout
        ├── services/            # api (axios), auth.api, assignments.api
        ├── types/api.ts         # ApiResponse + domain DTOs
        ├── utils/notionCsv.ts   # Notion CSV → import rows
        └── i18n/                # en + zh-CN locale bundles
```

---

## 5. Backend Architecture

### 5.1 Application Bootstrap

[backend/src/index.ts](file:///Users/graceq/Documents/trae_projects/TaskFlakes/backend/src/index.ts) defines two functions:

- **`createApp()`** — builds the Express app: mounts `helmet`, `cors({ origin: config.cors.origin, credentials: true })`, `cookieParser`, `express.json({ limit: '1mb' })`, `urlencoded`, and (in dev) `morgan('dev')`. Mounts the API router at `/api` under the global `apiRateLimit`, then registers `notFoundHandler` and `errorHandler`.
- **`startServer()`** — calls `createApp()` and `app.listen(config.port, …)` with a startup banner.

The app is exported as an ESM module (`"type": "module"`); all local imports use explicit `.js` extensions.

### 5.2 Configuration

| File | Responsibility |
|---|---|
| [config/index.ts](file:///Users/graceq/Documents/trae_projects/TaskFlakes/backend/src/config/index.ts) | Reads `NODE_ENV`, `PORT`, `DATABASE_URL`, JWT secrets/expiry, `CORS_ORIGIN`; derives `isProduction` / `isDevelopment`. Exported `config` is `as const`. |
| [config/constants.ts](file:///Users/graceq/Documents/trae_projects/TaskFlakes/backend/src/config/constants.ts) | `TOKEN_TYPE:'Bearer'`, `REFRESH_COOKIE_NAME:'refresh_token'`, `BCRYPT_SALT_ROUNDS:12`, and `RATE_LIMIT` thresholds (auth: 5/15m, api: 100/15m). |
| [config/prisma.ts](file:///Users/graceq/Documents/trae_projects/TaskFlakes/backend/src/config/prisma.ts) | Instantiates a single `new PrismaClient()` and default-exports it; every service imports this singleton. |

### 5.3 Database Schema (Prisma)

[prisma/schema.prisma](file:///Users/graceq/Documents/trae_projects/TaskFlakes/backend/prisma/schema.prisma) defines seven models and four enums. DB columns use `@map` to snake_case while TS fields stay camelCase.

#### Models

| Model | Purpose & Key Fields | Relations |
|---|---|---|
| **User** | `id` (cuid), unique `email`, `passwordHash`, optional `name`/`avatarUrl` | has many → `Assignment`, `Subject`, `TaskType`, `RefreshToken`; has one → `UserSettings` |
| **RefreshToken** | `tokenHash` (bcrypt-hashed), `expiresAt`, `userId` | belongs to `User` (`onDelete: Cascade`) |
| **UserSettings** | per-user prefs: `defaultSubjectColor`, `semesterStart`, `dailyCutoffHour`, `theme`, `language`, `defaultPriority`, `defaultAssignmentType`, `showCompletedByDefault` | 1:1 with `User` (`onDelete: Cascade`, `userId` unique) |
| **Subject** | `name`, `color`, `userId`; unique `(name, userId)` | belongs to `User`; has many → `Assignment` |
| **TaskType** | `name`, `color` (default `#6B7280`), `userId`; unique `(name, userId)` | belongs to `User` (`onDelete: Cascade`); has many → `Assignment` |
| **Assignment** | `title`, `description`, `status`, `priority`, `type`, `dueDate`, `completedAt`, self-ref `parentId`, optional `taskTypeId` | belongs to `User` (Cascade), optional `Subject` (SetNull), optional `TaskType` (SetNull), self-relation `AssignmentChildren` for subtasks (Cascade) |

`TaskType` is the **custom assignment type** feature: user-defined type labels (e.g. Quiz, Project, Essay) with their own colors, layered *on top of* the built-in `type` enum (which drives the `TYPE_ORDER` sort weight and remains required). An assignment may have at most one `taskTypeId`; deleting a `TaskType` sets `taskTypeId=null` on its assignments (SetNull) so assignments survive with their built-in type intact.

#### Enums
- `Status`: `NOT_STARTED` · `IN_PROGRESS` · `DONE`
- `Priority`: `LOW` · `MEDIUM` · `HIGH`
- `AssignmentType`: `WRITTEN` · `COMPOSITE` · `WRITING` · `WATCHING` · `PREVIEW` · `ORAL`
- `Theme`: `LIGHT` · `DARK` · `SYSTEM` / `Language`: `ZH_CN` · `EN`

#### Indexes (optimized for the dashboard query patterns)
`Assignment` carries indexes on `userId`, `status`, `dueDate`, `priority`, `subjectId`, `taskTypeId`; `Subject` on `userId` and a unique `(name, userId)`; `TaskType` on `userId` and a unique `(name, userId)`; `RefreshToken` on `userId`.

#### Migrations
1. `20260823111529_init` — initial tables, enums, indexes, FKs.
2. `20260823123228_add_user_settings` — adds `UserSettings` + `Theme`/`Language` enums; re-wires `RefreshToken` FK to `Cascade`.
3. `20260823123810_add_cascade_fks` — changes `Subject→User` and `Assignment→User` to `onDelete: Cascade` (so deleting a user wipes their data).
4. `20260824045351_add_task_types` — adds the `task_types` table (`TaskType` model) with unique `(name, user_id)`, the `Assignment.task_type_id` FK (`onDelete: SetNull`), and the `idx_assignments_task_type_id` index. Powers the custom assignment-type feature.

> `prisma/seed.ts` is a deliberate no-op (Phase 1); subjects are created per-user via the API.

### 5.4 Middleware

#### [auth.ts](file:///Users/graceq/Documents/trae_projects/TaskFlakes/backend/src/middleware/auth.ts)
- **`requireAuth`** (aliased `authenticate`) — extracts `Bearer` token via `extractTokenFromHeader`, verifies the access JWT with `verifyAccessToken`, and casts `req` to `AuthenticatedRequest` setting `req.user = { id, email, name: null }`. Returns `401` on missing/invalid token.
- **`optionalAuth`** — same extraction but never rejects; used for public routes that *may* personalize.

#### [validate.ts](file:///Users/graceq/Documents/trae_projects/TaskFlakes/backend/src/middleware/validate.ts)
A factory `buildValidate(source)` returns a middleware that `schema.parse(req[source])`, replaces `req[source]` with the parsed (defaulted/transformed) value, and on `ZodError` calls `badRequest(res, 'Validation failed', formatIssues(err))` where `formatIssues` joins `issue.path` into a dotted key.

Exports: `validate` (= `validateBody`), `validateBody`, `validateParams`, `validateQuery`.

#### [errorHandler.ts](file:///Users/graceq/Documents/trae_projects/TaskFlakes/backend/src/middleware/errorHandler.ts)
- **`errorHandler`** — logs `[ERROR]`; maps Prisma errors:
  - `P2002` (unique constraint) → `409 UNIQUE_CONSTRAINT` with `details.field`.
  - `P2025` (record not found) → `404 NOT_FOUND`.
  - `PrismaClientValidationError` → `400 VALIDATION_ERROR`.
  - Otherwise `500 INTERNAL_ERROR` (generic message in production, raw message in dev).
- **`notFoundHandler`** — `404 ROUTE_NOT_FOUND` for unmatched paths/methods.

#### [rateLimit.ts](file:///Users/graceq/Documents/trae_projects/TaskFlakes/backend/src/middleware/rateLimit.ts)
`express-rate-limit` instances. `DEV_BOOST = isDevelopment ? 50 : 1` multiplies `max` so integration tests don't trip 429.
- `authRateLimit` — applied to `/auth/register`, `/auth/login`.
- `apiRateLimit` — applied globally at `/api`.

Both emit the uniform `{ success:false, error:{ code:'TOO_MANY_REQUESTS', message } }` body.

### 5.5 Validation Layer (Zod)

[validations/schemas.ts](file:///Users/graceq/Documents/trae_projects/TaskFlakes/backend/src/validations/schemas.ts) centralizes every schema and the inferred TS types (`RegisterInput`, `LoginInput`, `CreateSubjectInput`, `CreateAssignmentInput`, `ListAssignmentsQuery`, `UpdateSettingsInput`, `ImportInput`, …). Highlights:

- **`registerBodySchema`** — email + password (8–100 chars, must contain uppercase, lowercase, digit) + optional name.
- **`createAssignmentBodySchema`** — title (1–200), optional description (≤5000), status/priority/type enums, `dueDate` accepting ISO datetime or coerced date, nullable `subjectId`/`parentId`/`taskTypeId`.
- **`createTaskTypeBodySchema`** — name (1–50), optional `color` (hex regex); `updateTaskTypeBodySchema` is its `.partial()`; `taskTypeIdParamSchema` validates the `:id` param.
- **`listAssignmentsQuerySchema`** — filters (`status`, `subjectId`, `priority`, `parentId`, `taskTypeId`, `topLevelOnly`, `search`), sorting (`sortBy` default `updatedAt`, `sortDir` default `desc`), pagination (`page` default 1, `limit` 1–100 default 50).
- **`createSubtaskBodySchema`** — `createAssignmentBodySchema` minus `parentId`, fixed title.
- **`updateSettingsBodySchema`** — all settings fields optional with hex-color regex, `dailyCutoffHour` 0–23, etc.
- **`importBodySchema`** — `{ mode:'merge'|'replace' (default merge), data:{ version, subjects[], assignments[], settings? } }` with permissive row schemas (service does defensive casting).
- Shared regex `HEX_COLOR = /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/`.

### 5.6 Utility Modules

#### [utils/hash.ts](file:///Users/graceq/Documents/trae_projects/TaskFlakes/backend/src/utils/hash.ts)
`hashPassword`, `verifyPassword`, `hashToken`, `verifyToken` — all thin wrappers over `bcrypt` using `CONSTANTS.BCRYPT_SALT_ROUNDS` (12). Refresh tokens are stored **hashed** in `RefreshToken.tokenHash`.

#### [utils/jwt.ts](file:///Users/graceq/Documents/trae_projects/TaskFlakes/backend/src/utils/jwt.ts)
`generateAccessToken` / `generateRefreshToken` sign `{ userId, email, type }` with the access/refresh secret and configured expiry. `verifyAccessToken` / `verifyRefreshToken` verify against the matching secret. `extractTokenFromHeader` strips the `Bearer ` prefix.

#### [utils/response.ts](file:///Users/graceq/Documents/trae_projects/TaskFlakes/backend/src/utils/response.ts)
Uniform envelope helpers:
- `success` (= `ok`) → `200 { success:true, data, meta? }`
- `created` → `201 { success:true, data }`
- `noContent` → `204`
- `error(statusCode, code, message, details?)` → `{ success:false, error:{ code, message, details? } }`
- Domain shortcuts: `badRequest` (400), `unauthorized` (401), `forbidden` (403), `notFound` (404), `conflict` (409), `tooManyRequests` (429), `serverError` (500).

### 5.7 Service Layer

All services are plain objects of async methods that import the `prisma` singleton. They never touch `req`/`res` (pure logic), making them trivially testable.

#### [auth.service.ts](file:///Users/graceq/Documents/trae_projects/TaskFlakes/backend/src/services/auth.service.ts) — `authService`
| Method | Behavior |
|---|---|
| `register(data)` | Checks email uniqueness (throws `EMAIL_ALREADY_EXISTS`), hashes password, creates `User`, generates access+refresh tokens, persists hashed refresh token. |
| `login(data)` | Finds user by email, `verifyPassword`; throws `INVALID_CREDENTIALS` on miss. Generates + stores refresh token. |
| `refresh(refreshToken)` | Verifies JWT, looks up the latest stored hash for the user, `verifyToken` + expiry check, deletes the consumed token (rotation), issues a fresh pair. Throws `INVALID_REFRESH_TOKEN`. |
| `logout(userId)` | `deleteMany` all refresh tokens for the user. |
| `getUserById(userId)` | Selects public fields; throws `USER_NOT_FOUND`. |
| `updateUser(userId, input)` | Updates `name` only. |
| `deleteAccount(userId)` | `prisma.user.delete` — relies on the `Cascade` FKs (set in migration 3) to wipe `Subject`, `Assignment`, `RefreshToken`, `UserSettings`. |
| `generateTokens` / `saveRefreshToken` | helpers; refresh token hashed with bcrypt, `expiresAt = now + 7d`. |

#### [subject.service.ts](file:///Users/graceq/Documents/trae_projects/TaskFlakes/backend/src/services/subject.service.ts) — `subjectService`
- `list` — `findMany` ordered by name, includes `_count.assignments`.
- `getById` / `getByName` (uses the `name_userId` unique compound).
- `create` — trims name; if no `color`, `pickDefaultColor` maps common Chinese/English subject names (chinese→red, math→blue, …) to preset hex colors, else `#6B7280`.
- `update` — partial name/color.
- `delete` — **first nulls `subjectId` on all the user's assignments** (preserves assignments), then deletes the subject.

#### [taskType.service.ts](file:///Users/graceq/Documents/trae_projects/TaskFlakes/backend/src/services/taskType.service.ts) — `taskTypeService`
User-owned **custom assignment types** (name + color). Mirrors `subjectService` structure:
- `list` — `findMany` ordered by name, includes `_count.assignments`.
- `getById` / `getByName` (uses the `name_userId` unique compound).
- `create` — trims name; default color `#6B7280` when none supplied; duplicate `(name, userId)` throws `TASK_TYPE_EXISTS`.
- `update` — partial name/color.
- `delete` — relies on the schema `onDelete: SetNull` on `Assignment.taskTypeId` (no manual pre-null needed; assignments keep their built-in `type`).

#### [assignment.service.ts](file:///Users/graceq/Documents/trae_projects/TaskFlakes/backend/src/services/assignment.service.ts) — `assignmentService`
Core task engine. Key internals:
- `PRIORITY_WEIGHT` / `STATUS_ORDER` / `TYPE_ORDER` maps for in-memory sorting (Prisma can't order enums by custom weight). `TYPE_ORDER` groups assignment types by GTD semantics: `WRITING < WRITTEN < ORAL < PREVIEW < WATCHING < COMPOSITE`.
- `assertSubjectBelongs(userId, subjectId)` — throws `SUBJECT_NOT_FOUND` (with `.code`).
- `assertTaskTypeBelongs(userId, taskTypeId)` — throws `TASK_TYPE_NOT_FOUND` when a supplied `taskTypeId` doesn't belong to the user (no-op when null).
- `assertParentBelongs(userId, parentId)` — verifies parent exists & belongs to user, and enforces **one-level nesting only** (a parent that itself has a parent throws `NESTING_TOO_DEEP`).
- `buildListQuery` — assembles the Prisma `where` from filters (`status`, `priority`, `subjectId`, `taskTypeId`, `parentId` or `topLevelOnly`, and `search` across title/description with `mode:'insensitive'`).

Methods:
| Method | Behavior |
|---|---|
| `list(userId, query)` | Paginated query; `include`s `subject`, `taskType`, `children` (with their `subject` + `taskType`), `_count.children`. Sortable fields: `dueDate`, `title`, `createdAt`, `updatedAt` (DB-level `orderBy`), `subject` (DB-level relation `orderBy: { subject: { name } }` for global grouping), and `priority` / `status` / `type` (in-memory sort by weight map since Prisma can't order enums by custom weight). Returns `{ data, meta:{ page, total, limit } }`. |
| `counts(userId, { subjectId?, topLevelOnly? })` | `prisma.assignment.groupBy({ by:['status'] })` → `{ total, notStarted, inProgress, done }`. Respects `subjectId` + `topLevelOnly` (matches the list scope). Powers the page status chips with **global** counts so they are not capped at the 50-per-page window. |
| `getById` | includes subject, taskType, parent (`id/title/status`), and children. |
| `create` | validates subject + taskType + parent, normalizes `dueDate`, auto-sets `completedAt` when `status==='DONE'`. |
| `update` | partial update; guards against self-parenting (`INVALID_PARENT`); applies `taskTypeId` (null-aware); toggles `completedAt` based on status transitions. |
| `delete` | relies on `AssignmentChildren` `onDelete: Cascade` to drop subtasks. |
| `setStatus(userId, id, status)` | status shortcut used by `/complete`, `/reopen`, `/status`; manages `completedAt`. |

#### [stats.service.ts](file:///Users/graceq/Documents/trae_projects/TaskFlakes/backend/src/services/stats.service.ts) — `statsService.get(userId)`
Loads all assignments + subjects in two parallel queries and computes a single `FullStats` bundle (no DB round-trips per metric):

1. **`overview`** — totals, `completed`, `inProgress`, `notStarted`, `overdue` (dueDate < todayUTC && not DONE), `highPriority` (HIGH & not DONE), `doneRatePct`, `weekOverWeekDelta` (this-week vs prev-week completed counts, clamped to [-100, 200]).
2. **`bySubject`** — every subject (even zero-assignment ones) as a `SubjectBucket{ total, done, notDone, doneRate }`, sorted by total desc.
3. **`byType`** — all six `AssignmentType` values as buckets.
4. **`dailyTrend`** — last 14 days as `DailyPoint{ date, created, completed, netAccomplished }` keyed by UTC date.
5. **`weekHeatmap`** — Mon..Sun of the current ISO week as `WeekCell{ day, weekdayLabel, completed, level 0–4 }`; levels bucketed relative to the week's max.
6. **`overdueTop5`** — top 5 overdue assignments sorted by `overdueDays` desc.

All date math uses `startOfDayUTC` / `dateKey` to stay timezone-agnostic.

#### [settings.service.ts](file:///Users/graceq/Documents/trae_projects/TaskFlakes/backend/src/services/settings.service.ts) — `settingsService`
- `getOrCreate(userId)` — returns existing row or creates one with `DEFAULT_SETTINGS`. Always returns the `SafeSettings` projection (no `id`/`userId`/timestamps).
- `update(userId, input)` — `upsert` (merge defaults + input on create); no-op → `getOrCreate` when payload empty.

#### [export.service.ts](file:///Users/graceq/Documents/trae_projects/TaskFlakes/backend/src/services/export.service.ts) — `exportService`
- **`build(userId, settings)`** — assembles an `ExportBundle{ exportedAt, version:1, subjects[], assignments[], settings }`. Parent assignments are referenced by **title** (`parentTitle`) rather than id for portability; subject by `subjectName`.
- **`apply(userId, input)`** — defensive import inside `prisma.$transaction`:
  1. Cleans + casts each subject/assignment row (type-guard helpers `isStatus`/`isPriority`/`isType`); throws `INVALID_SUBJECT_ROW` / `INVALID_ASSIGNMENT_ROW`.
  2. In `replace` mode: deletes all user assignments then subjects first.
  3. Upserts subjects by `(name, userId)`.
  4. **Two-pass assignment creation**: pass 1 creates all rows with `parentId=null` while recording `title → [{id, subjectName}]` (**all** occurrences kept, not just the first); pass 2 wires parents by `parentTitle` with **subject-aware resolution** — among candidates sharing the parent title, the one whose `subjectName` matches the child's is preferred; absent a same-subject candidate, the first is used. This prevents cross-subject mis-wiring when duplicate titles exist across subjects (e.g. "练习卷套装" in both Maths & English — English `练习卷-1..6` now attach to the English parent, not the Maths one). Each child is wired by its own pass-1 `createdId` (not a title lookup), so duplicate child titles also resolve correctly. The `if (!candidates) continue` still silently skips a child whose `parentTitle` matches no row; the Notion CSV importer compensates by pre-creating synthetic parent rows on the frontend (see [§6.5.2](#652-notion-csv-import)).

> **Schema gotcha (historical bug):** `importAssignmentRow` (the Zod row schema in [schemas.ts](file:///Users/graceq/Documents/trae_projects/TaskFlakes/backend/src/validations/schemas.ts)) MUST include `parentTitle: z.string().trim().optional().nullable()`. Zod's `z.object()` **strips unknown keys** by default, so an earlier schema that omitted `parentTitle` caused every imported assignment to lose its parent reference before reaching `exportService.apply` → pass 2 saw `parentTitle=undefined` for all rows → `if (!p.parentTitle) continue` skipped every wiring → the DB ended up with all top-level rows and **zero parent-child links** (tree never rendered, even though the frontend parser extracted `parentTitle` correctly). The route handler double-parses with `importBodySchema.parse(req.body)` ([export.routes.ts](file:///Users/graceq/Documents/trae_projects/TaskFlakes/backend/src/routes/export.routes.ts)), so the schema is the single source of truth for which fields survive.
  5. In `replace` mode only, upserts `UserSettings` from the bundle.
  Returns an `ImportSummary{ mode, created/skipped/deleted counts }`.

### 5.8 Route Layer (REST API)

[routes/index.ts](file:///Users/graceq/Documents/trae_projects/TaskFlakes/backend/src/routes/index.ts) composes the router and adds `GET /api/health`.

All responses use the `{ success, data?, meta?, error? }` envelope. `requireAuth` is applied per-router (or globally via `router.use(requireAuth)` for subjects/assignments/stats/settings/export).

#### Auth — [auth.routes.ts](file:///Users/graceq/Documents/trae_projects/TaskFlakes/backend/src/routes/auth.routes.ts) (`/api/auth`)
| Method & Path | Auth | Schema | Notes |
|---|---|---|---|
| `POST /register` | `authRateLimit` | `registerBodySchema` | sets `refresh_token` httpOnly cookie; returns `201 { user, accessToken }` |
| `POST /login` | `authRateLimit` | `loginBodySchema` | same cookie; `200 { user, accessToken }` |
| `POST /refresh` | — | `refreshTokenBodySchema` | rotates refresh token, returns new `accessToken` |
| `POST /logout` | `authenticate` | — | clears refresh tokens + cookie |
| `GET /me` | `authenticate` | — | current user profile |
| `PATCH /me` | `authenticate` | `updateMeBodySchema` | rename |
| `DELETE /me` | `authenticate` | `deleteMeBodySchema` | requires `email` confirmation; `204` on success |

#### Subjects — [subject.routes.ts](file:///Users/graceq/Documents/trae_projects/TaskFlakes/backend/src/routes/subject.routes.ts) (`/api/subjects`, all `requireAuth`)
`GET /` · `POST /` (`createSubjectBodySchema`, duplicate-name check) · `GET /:id` · `PATCH /:id` · `DELETE /:id`.

#### Task Types — [taskType.routes.ts](file:///Users/graceq/Documents/trae_projects/TaskFlakes/backend/src/routes/taskType.routes.ts) (`/api/task-types`, all `requireAuth`)
`GET /` · `POST /` (`createTaskTypeBodySchema`, duplicate-name check → `409`) · `GET /:id` (`taskTypeIdParamSchema`) · `PATCH /:id` (`updateTaskTypeBodySchema`) · `DELETE /:id`. CRUD mirrors the subjects router; deletion relies on the schema `SetNull` FK so assignments survive (custom type cleared, built-in `type` retained).

#### Assignments — [assignment.routes.ts](file:///Users/graceq/Documents/trae_projects/TaskFlakes/backend/src/routes/assignment.routes.ts) (`/api/assignments`, all `requireAuth`)
| Method & Path | Schema | Service call |
|---|---|---|
| `GET /` | `listAssignmentsQuerySchema` (query) | `assignmentService.list` |
| `GET /counts` | `assignmentCountsQuerySchema` (query) | `counts` — returns `{ total, notStarted, inProgress, done }` grouped by status, respecting `subjectId` + `topLevelOnly`; used by the assignments page status chips so counts are **global (not page-capped at 50)**. Declared **before** `/:id` to avoid the UUID param route capturing it. |
| `GET /:id` | `assignmentIdParamSchema` | `getById` |
| `POST /` | `createAssignmentBodySchema` | `create` (maps `SUBJECT_NOT_FOUND`/`PARENT_NOT_FOUND`/`NESTING_TOO_DEEP`/`INVALID_PARENT` to `400`) |
| `PATCH /:id` | param + `updateAssignmentBodySchema` | `update` |
| `DELETE /:id` | param | `delete` |
| `POST /:id/complete` | param | `setStatus(id, 'DONE')` |
| `POST /:id/reopen` | param | `setStatus(id, 'NOT_STARTED')` |
| `POST /:id/status` | param + `setStatusBodySchema` | `setStatus(id, body.status)` |
| `POST /:id/subtasks` | param + `createSubtaskBodySchema` | `create({ …body, parentId: id })` |

A `mapServiceError` helper translates service `.code`-bearing errors into `badRequest` responses.

#### Stats — [stats.routes.ts](file:///Users/graceq/Documents/trae_projects/TaskFlakes/backend/src/routes/stats.routes.ts) (`/api/stats`, `requireAuth`)
`GET /` → `statsService.get(userId)`.

#### Settings — [settings.routes.ts](file:///Users/graceq/Documents/trae_projects/TaskFlakes/backend/src/routes/settings.routes.ts) (`/api/settings`, `requireAuth`)
`GET /` → `getOrCreate`; `PATCH /` (`updateSettingsBodySchema`) → `update`.

#### Export — [export.routes.ts](file:///Users/graceq/Documents/trae_projects/TaskFlakes/backend/src/routes/export.routes.ts) (`/api/export`, `requireAuth`)
- `GET /` — downloads `taskflakes-export-<timestamp>.json` attachment (`Content-Disposition: attachment`).
- `POST /import` (`importBodySchema`) — `exportService.apply`; maps `INVALID_SUBJECT_ROW`/`INVALID_ASSIGNMENT_ROW` to `400`.

### 5.9 Type Definitions

[types/index.ts](file:///Users/graceq/Documents/trae_projects/TaskFlakes/backend/src/types/index.ts):
- **`AuthenticatedRequest`** extends `Request` with `user:{ id, email, name }`.
- **`JwtPayload`** `{ userId, email, type:'access'|'refresh' }`.
- **`TokensResponse`**, **`ApiResponse<T>`** `{ success, data?, meta?, error? }`.

---

## 6. Frontend Architecture

### 6.1 Entry Point & Providers

[main.tsx](file:///Users/graceq/Documents/trae_projects/TaskFlakes/frontend/src/main.tsx):
- Creates a `QueryClient` (staleTime 30s, retry 1, no refetch on focus).
- Calls `useThemeStore.getState().reapply()` and `useLocaleStore.getState().init()` **before** React mounts to avoid a white flash / language mismatch.
- Wraps `<App />` in `QueryClientProvider` under `React.StrictMode`.

[App.tsx](file:///Users/graceq/Documents/trae_projects/TaskFlakes/frontend/src/App.tsx) simply renders `<RouterProvider router={router} />`.

### 6.2 Routing

[router.tsx](file:///Users/graceq/Documents/trae_projects/TaskFlakes/frontend/src/router.tsx) uses `createBrowserRouter`:
- `/login`, `/register` — standalone auth pages.
- A `Layout`-wrapped group: `/` (→ redirect to `/dashboard`), `/dashboard`, `/assignments`, `/subjects`, `/types`, `/stats`, `/settings`.

### 6.3 State Management (Zustand)

Four stores; all importable outside React via `getState()`.

| Store | State & Actions |
|---|---|
| [auth.store.ts](file:///Users/graceq/Documents/trae_projects/TaskFlakes/frontend/src/stores/auth.store.ts) | `user`, `accessToken` (persisted to `localStorage.access_token`), `isAuthenticated`, `isLoading`, `error`; `setAuth`, `setUser`, `setLoading`, `setError`, `logout` (clears localStorage), `hydrate`. |
| [theme.store.ts](file:///Users/graceq/Documents/trae_projects/TaskFlakes/frontend/src/stores/theme.store.ts) | Persisted (`taskflakes.theme` localStorage). `theme` (`SYSTEM` default), `apply(t)` (sets + applies DOM `dark` class + `colorScheme`), `reapply()` (re-resolves SYSTEM via `matchMedia`). Module-level `matchMedia` listener re-applies on OS theme change. |
| [locale.store.ts](file:///Users/graceq/Documents/trae_projects/TaskFlakes/frontend/src/stores/locale.store.ts) | `language` (`zh-CN` default), `init()` (reads `localStorage.i18nextLng`, normalizes, sets `<html lang>`), `setLanguage(lang)` (i18next + localStorage + `<html lang>`). |
| [toast.store.ts](file:///Users/graceq/Documents/trae_projects/TaskFlakes/frontend/src/stores/toast.store.ts) | `items: ToastItem[]`; `push(kind, message)` auto-dismisses (3.2s, 4.2s for error/warning). Exports a free-standing `toast.{success,error,info,warning}` API usable anywhere. |

### 6.4 Data Fetching & API Client

#### [services/api.ts](file:///Users/graceq/Documents/trae_projects/TaskFlakes/frontend/src/services/api.ts) — Axios instance
- `baseURL = import.meta.env.VITE_API_BASE_URL`, `withCredentials:true`, JSON content type.
- **Request interceptor** — injects `Authorization: Bearer <access_token>` from `localStorage`.
- **Response interceptor** — on any error, extracts `backendError = error.response.data.error`, and if it has a `message` (+ optional `details`) it enriches `error.message` so the UI shows the real backend cause (e.g. validation failures). On `401` (not already retried), it transparently calls `/api/auth/refresh` (cookie-based), stores the new `accessToken`, and replays the original request; on refresh failure it clears the token and redirects to `/login`.

#### [services/auth.api.ts](file:///Users/graceq/Documents/trae_projects/TaskFlakes/frontend/src/services/auth.api.ts)
`login`, `register`, `refreshToken`, `logout`, `getCurrentUser` — each unwraps the `{ success, data }` envelope via `handleResponse<T>` and returns the typed `data`.

#### [services/assignments.api.ts](file:///Users/graceq/Documents/trae_projects/TaskFlakes/frontend/src/services/assignments.api.ts)
The largest API module. Exports:
- **Types** mirroring the backend: `Status`, `Priority`, `AssignmentType`, `SubjectSummary`, `SubjectResponse`, `TaskTypeSummary`, `TaskTypeResponse`, `AssignmentBase/Response/Child` (each carrying optional `taskTypeId` + `taskType`), `ListAssignmentsQuery` (incl. `taskTypeId` filter), `PaginatedResponse<T>`, `CreateAssignmentPayload`, `UpdateAssignmentPayload`, `Theme`, `Language`, `UserSettingsResponse`, `FullStatsResponse` (with `StatsOverview/SubjectBucket/TypeBucket/DailyPoint/WeekCell/OverdueRow`), `ExportBundle`, `ImportSummary`.
- **Subject API**: `listSubjects`, `createSubject`, `updateSubject`, `deleteSubject`.
- **Task Type API**: `listTaskTypes`, `createTaskType`, `updateTaskType`, `deleteTaskType` (CRUD against `/api/task-types`); `CreateTaskTypePayload`/`UpdateTaskTypePayload`.
- **Assignment API**: `listAssignments` (builds `URLSearchParams`), `getAssignment`, `createAssignment`, `updateAssignment`, `deleteAssignment`, `completeAssignment`, `reopenAssignment`, `setAssignmentStatus`, `createSubtask`, `fetchAssignmentCounts(subjectId?)` → `GET /api/assignments/counts?topLevelOnly=true` returning `{ total, notStarted, inProgress, done }` for the global status chip counts.
- **Dashboard helper**: `fetchDashboardStats` — derives a lightweight `DashboardStats` overview client-side by walking top-level assignments + their children.
- **Phase-3 API**: `fetchSettings`/`updateSettings`, `fetchFullStats`, `downloadExportJson` (Blob download with `Content-Disposition` filename parsing), `importJsonBundle`, `updateCurrentUser`, `deleteCurrentAccount`.

#### [types/api.ts](file:///Users/graceq/Documents/trae_projects/TaskFlakes/frontend/src/types/api.ts)
Frontend mirror of `ApiResponse<T>` (adds `limit?` to `meta`).

### 6.5 Pages

| Page | Responsibility |
|---|---|
| [LoginPage.tsx](file:///Users/graceq/Documents/trae_projects/TaskFlakes/frontend/src/pages/LoginPage.tsx) | Calls `login`, on success writes auth store + `toast` + navigates to `/dashboard`; shows error messages. |
| [RegisterPage.tsx](file:///Users/graceq/Documents/trae_projects/TaskFlakes/frontend/src/pages/RegisterPage.tsx) | Local validation (name required, password length + complexity: uppercase+lowercase+number) before calling `register`; mirrors backend rules for friendly errors. |
| [DashboardPage.tsx](file:///Users/graceq/Documents/trae_projects/TaskFlakes/frontend/src/pages/DashboardPage.tsx) | Aggregates `fetchDashboardStats`, `listSubjects`, `listAssignments`, and `useGetCurrentUser` via React Query to render summary cards, subject overview, and recent activity. |
| [AssignmentsPage.tsx](file:///Users/graceq/Documents/trae_projects/TaskFlakes/frontend/src/pages/AssignmentsPage.tsx) | Core list view: filter/sort/pagination state, `listAssignments` + `listSubjects` + `listTaskTypes` queries, and mutations for create/update/delete/status/subtask with React Query invalidation + toast feedback. Status chips are driven by a **global** `fetchAssignmentCounts` query (`['assignment-counts', subjectId]`) so counts reflect all matching assignments (subject-scoped, top-level) rather than the 50-per-page window. The **status column** uses a color-coded `StatusSelect` (tinted pill + status dot + transparent `<select>` reusing `statusMap[status].className`), and the **Type column header** is sortable (`field="type"`, backed by the backend `TYPE_ORDER` in-memory sort). The Type cell renders `<TypeBadge type={a.type} taskType={a.taskType} />` so a custom task type (with its own color) takes precedence over the built-in enum. The form receives `taskTypes` so the custom-type picker is populated. Renders a **Notion-style tree table** of parent assignments and their one-level subtasks with expand/collapse, per-parent progress, and **batch selection + bulk delete** (see [§6.5.1](#651-assignment-tree-parent--child)). |
| [SubjectsPage.tsx](file:///Users/graceq/Documents/trae_projects/TaskFlakes/frontend/src/pages/SubjectsPage.tsx) | Subject CRUD via `listSubjects/createSubject/updateSubject/deleteSubject`. |
| [TypesPage.tsx](file:///Users/graceq/Documents/trae_projects/TaskFlakes/frontend/src/pages/TypesPage.tsx) | Custom assignment-type CRUD via `listTaskTypes/createTaskType/updateTaskType/deleteTaskType` (mirrors `SubjectsPage`); invalidates `['task-types']` + `['assignments']` on every mutation so the assignment list picks up new colors/names immediately. Includes a "create defaults" (Quiz/Project/Essay) helper and a delete-confirm modal warning that assignments survive (custom type cleared). |
| [StatsPage.tsx](file:///Users/graceq/Documents/trae_projects/TaskFlakes/frontend/src/pages/StatsPage.tsx) | Renders `fetchFullStats` (overview, by-subject, by-type, daily trend, weekly heatmap, overdue top 5) and a JSON import mutation that invalidates all related queries on success. |
| [SettingsPage.tsx](file:///Users/graceq/Documents/trae_projects/TaskFlakes/frontend/src/pages/SettingsPage.tsx) | `fetchSettings`/`updateSettings` form; theme + language + defaults; account rename/delete controls; JSON export/import; **Notion CSV import** (see [§6.5.2](#652-notion-csv-import)). |

#### 6.5.1 Assignment Tree (parent – child)

The assignments table renders a **two-level tree** (parent → children) backed by the backend's self-relation (`Assignment.parentId`, enforced to one level by `assertParentBelongs`). The list query uses `topLevelOnly: true` so the server returns top-level rows with their `children` (and `subject`) included; the frontend expands/collapses locally without extra requests.

**Tree state & controls** (in [AssignmentsPage.tsx](file:///Users/graceq/Documents/trae_projects/TaskFlakes/frontend/src/pages/AssignmentsPage.tsx)):
- `expanded: Set<string>` — ids of parent rows currently open; toggled via `toggleExpand`. Survives React Query refetches because it is component state, not query state.
- `toggleAll` — a single smart toolbar button that **expands all** parent rows when collapsed, **collapses all** when fully expanded. It is wired to `expandableParentIds` (parents that actually have children) and shows an `expanded/total` counter. Only appears when the current page has at least one parent with children.
- Header range now uses accurate `rangeStart`/`rangeEnd` (`(page-1)*limit+1` … `min(page*limit, total)`).
- **Batch selection / bulk delete** — a leftmost selection column (full-width on every row) drives a `selected: Set<string>` of assignment ids. The header checkbox acts as a tri-state **select-all-visible** toggle (`toggleSelectAllVisible`) over `visibleIds` (parents + expanded children on the current page), showing a check (all), an indeterminate bar (some), or empty (none). When `selected.size > 0` a bulk-action bar appears with the count, a "clear selection" button, and a "Delete selected" button that opens a confirmation modal. Deletion runs `Promise.allSettled` over the selected ids calling the existing `DELETE /api/assignments/:id` endpoint; parent deletions cascade to their children server-side, so child-id requests that 404 are simply counted as "failed" and surfaced via a warning toast (success toast otherwise). Selection is cleared and queries invalidated after the run.

**`AssignmentRow` component** renders each row and handles both parent and child cases:
- **Tree guide lines** drawn with absolutely-positioned 1px `<span>`s inside the title cell:
  - A **vertical line** at `left: 20px`. For non-last children it spans the full row height (`top:0; bottom:0`) so consecutive child rows form a continuous spine; for the **last child** it stops at the row's vertical center (`top:0; height:50%`) — the classic file-tree "└" elbow.
  - A **horizontal connector** (`top:50%`, width 12px) linking the spine to the child's checkbox. `isLastChild` is computed in the render loop (`idx === a.children.length - 1`).
- **Parent progress indicator** — every parent row shows a mini progress bar + a `done/total` badge computed from `a.children.filter(c => c.status==='DONE')`. Color is semantic: green when all done, amber when partial, gray when none. A tooltip (`assignments.subtasksProgress`) gives the full count.
- **Child rows** are muted (`bg-brand-50/10`), indented by `GUIDE_LEFT + CONNECTOR_WIDTH`, and their action menu hides "Add sub-task" (children cannot have children).
- **Accessibility / i18n** — the expand chevron exposes `aria-expanded` and a count-aware `title` (`expandHint`/`collapseHint`); the status checkbox title, all menu items (Edit / Add sub-task / Mark done / Reopen / Delete), modal titles, and pagination labels are fully translated via the `assignments.*` and `common.*` i18n keys.

> Data note: the backend always includes `children` (with `subject`) and `_count.children` on each top-level row, so progress can be computed even while a parent is collapsed — no extra fetch is needed to show the `done/total` badge.

#### 6.5.2 Notion CSV Import

Settings → Import offers importing a Notion-exported CSV. The pipeline ([parseNotionCsv](file:///Users/graceq/Documents/trae_projects/TaskFlakes/frontend/src/utils/notionCsv.ts) → [SettingsPage.handleNotionFile](file:///Users/graceq/Documents/trae_projects/TaskFlakes/frontend/src/pages/SettingsPage.tsx) → backend `exportService.apply`) normalizes Notion's quirks so the parent-child tree forms correctly:

1. **Header auto-detection** — `findCol` matches columns by normalized keywords (e.g. `Parent item` / `父项`, `Sub-item` / `子项`, `Due Date`, `Priority Level`).
2. **Cross-page CSV reference stripping** — Notion's "all pages" export appends a file reference to relation columns, e.g. `作文 (%E4%BD%9C%E6%96%87%2038b6…csv)`. `stripCsvRefs` (regex `/\s*\([^()]*\.csv\)/gi`) removes the leading-space + parenthesized `.csv` token (case-insensitive, multiple occurrences), leaving the real title `作文`. A counter `csvRefsStripped` is returned and surfaced as a **warning toast**.
3. **Sub-item column** — if the CSV uses a `Sub-item` column instead of `Parent item`, children's `parentTitle` is back-filled from the parent row's sub-item list (refs also stripped).
4. **Missing-parent auto-creation** — in a Notion "all pages" export the parent `作文` is frequently an **independent page/file**, not a database row, so it never appears as a CSV row. Without compensation the backend's two-pass import ([export.service.ts](file:///Users/graceq/Documents/trae_projects/TaskFlakes/backend/src/services/export.service.ts) pass 2) would `if (!parentId) continue` and leave the child top-level → no tree. The frontend therefore scans for every referenced `parentTitle` that has **no matching assignment row**, and pushes a synthetic top-level parent (type `COMPOSITE`, default status/priority, subject inferred from the first referencing child) into the bundle. An **info toast** reports how many parents were auto-created. The backend then creates these parents in pass 1 and wires children to them in pass 2, so the tree renders.
5. The bundle is then sent to `POST /api/export/import` (`mode: 'merge'`) — see §5.7 for the backend two-pass + defensive casting.

> Limitation: parent resolution prefers a **same-subject** candidate among rows sharing the parent title (so cross-subject duplicates like "练习卷套装" wire correctly); absent a same-subject match it falls back to the first candidate. Truly ambiguous duplicates within the *same* subject still pick the first. The tree is two-level; deeper Notion nesting flattens into the first level because the backend enforces one-level nesting via `assertParentBelongs` on the regular create path (the import pass-2 wiring bypasses that check, so avoid exporting multi-level structures).

### 6.6 Components

| Component | Purpose |
|---|---|
| [components/layout/Layout.tsx](file:///Users/graceq/Documents/trae_projects/TaskFlakes/frontend/src/components/layout/Layout.tsx) | App shell: fixed sidebar nav (Dashboard/Assignments/Subjects/Types/Stats/Settings) with the `Logo` brand mark, sticky header with current title + `ProfileDropdown`, `<Outlet />` content, and `<ToastContainer />`. Reapplies theme on mount. |
| [components/nav/ProfileDropdown.tsx](file:///Users/graceq/Documents/trae_projects/TaskFlakes/frontend/src/components/nav/ProfileDropdown.tsx) | Avatar menu with initials, theme switcher (Light/Dark/System), Settings link, and Logout (`useLogout` + toast). Click-outside + Escape handling. |
| [components/ui/Badges.tsx](file:///Users/graceq/Documents/trae_projects/TaskFlakes/frontend/src/components/ui/Badges.tsx) | `StatusBadge`, `PriorityBadge`, `TypeBadge` (with interactive click-to-cycle), `SubjectChip` (colored from `subject.color`), `DueDate` (overdue/today/tomorrow highlighting). Includes i18n-aware `useStatusMap/usePriorityMap/useTypeMap` hooks and static fallback maps. `TypeBadge` accepts an optional `taskType?: {name,color}` prop — when present it renders the **custom** type badge (tinted from `taskType.color`) instead of the built-in enum badge, so custom types visually take precedence in the assignments table. |
| [components/ui/Modal.tsx](file:///Users/graceq/Documents/trae_projects/TaskFlakes/frontend/src/components/ui/Modal.tsx) | Generic modal (`sm`/`md`/`lg`/`xl`) with backdrop + Escape close. |
| [components/ui/Toast.tsx](file:///Users/graceq/Documents/trae_projects/TaskFlakes/frontend/src/components/ui/Toast.tsx) | `ToastContainer` rendering the `toast.store` items with per-kind icons/colors and a slide-in animation. |
| [components/ui/Logo.tsx](file:///Users/graceq/Documents/trae_projects/TaskFlakes/frontend/src/components/ui/Logo.tsx) | TaskFlakes brand mark — a white 6-arm snowflake on a blue (`#2563EB`) rounded square. Mirrors `public/favicon.svg` so the sidebar icon and browser tab favicon stay in sync. |
| [components/forms/AssignmentForm.tsx](file:///Users/graceq/Documents/trae_projects/TaskFlakes/frontend/src/components/forms/AssignmentForm.tsx) | Create/edit form with title/description/subject/dueDate/status/priority/type pickers (badge-styled selectors), an optional **custom-type `<select>`** (populated from the `taskTypes` prop; sets `taskTypeId`), local validation, diff-aware update payloads (including `taskTypeId` null-aware diff), and server-error surface. Supports subtask mode. |
| [components/forms/SubjectForm.tsx](file:///Users/graceq/Documents/trae_projects/TaskFlakes/frontend/src/components/forms/SubjectForm.tsx) | Subject create/edit form (name + color). |
| [components/forms/TypeForm.tsx](file:///Users/graceq/Documents/trae_projects/TaskFlakes/frontend/src/components/forms/TypeForm.tsx) | Custom assignment-type create/edit form (name + color). Mirrors `SubjectForm`; the live preview renders a tinted pill using the chosen color. |

### 6.7 Hooks

[hooks/useAuth.ts](file:///Users/graceq/Documents/trae_projects/TaskFlakes/frontend/src/hooks/useAuth.ts):
- **`useGetCurrentUser`** — `useQuery(['user','me'], getCurrentUser, { retry:false })`; on success syncs the user into the auth store; on error it logs out and redirects to `/login`.
- **`useLogout`** — `useMutation` calling `logoutApi()` (swallowing errors), then in `onSettled` clears the auth store and `qc.clear()`.

### 6.8 Internationalization (i18n)

[i18n/index.ts](file:///Users/graceq/Documents/trae_projects/TaskFlakes/frontend/src/i18n/index.ts) initializes i18next with `LanguageDetector` + `initReactI18next`, resources for `en` and `zh-CN`, `fallbackLng:'en'`, detection order `['localStorage','navigator','htmlTag']` cached to `localStorage.i18nextLng`. Locale bundles live in [locales/en.ts](file:///Users/graceq/Documents/trae_projects/TaskFlakes/frontend/src/i18n/locales/en.ts) and [locales/zh-CN.ts](file:///Users/graceq/Documents/trae_projects/TaskFlakes/frontend/src/i18n/locales/zh-CN.ts). The default UI language is Chinese (`ZH_CN` in settings, normalized to `zh-CN`).

### 6.9 Styling (Tailwind)

[tailwind.config.js](file:///Users/graceq/Documents/trae_projects/TaskFlakes/frontend/tailwind.config.js):
- `darkMode: 'class'` (toggled by `theme.store` adding the `dark` class to `<html>`).
- Custom `brand` orange palette + `fadeIn` / `slideInRight` keyframes used by Modal/Toast.
- Content scans `index.html` and `src/**/*.{js,ts,jsx,tsx}`.

[vite.config.ts](file:///Users/graceq/Documents/trae_projects/TaskFlakes/frontend/vite.config.ts) sets the `@` → `./src` alias and proxies `/api` → `http://localhost:4000` in dev (so `VITE_API_BASE_URL` can be omitted locally).

---

## 7. Authentication & Security Flow

```
Register / Login
   │  POST /api/auth/{register,login}
   ▼
authService → bcrypt password → JWT access(15m) + refresh(7d)
   │  refresh token HASHED (bcrypt) and stored in RefreshToken table
   ▼
Response body: { user, accessToken }      Cookie: refresh_token (httpOnly, secure in prod, sameSite=strict, 7d)
```

- **Access token** lives in `localStorage` (short-lived, 15m) and is attached by the Axios request interceptor as `Authorization: Bearer <token>`.
- **Refresh token** is an httpOnly cookie, never exposed to JS. `POST /api/auth/refresh` rotates it (deletes the consumed hash, issues a new one).
- The Axios response interceptor transparently handles `401` by calling `/api/auth/refresh` (cookie sent automatically via `withCredentials`) and replaying the failed request once.
- `requireAuth` middleware verifies the access JWT on every protected route; `optionalAuth` allows public-personalized routes.
- **Account deletion** requires email confirmation in the request body (`DELETE /api/auth/me`), and DB-level `Cascade` FKs (migration 3) wipe all owned resources.
- **Hardening**: `helmet` for secure headers, `cors` pinned to `CORS_ORIGIN` with credentials, `express-rate-limit` on auth (5/15m, ×50 in dev for tests) and globally on `/api` (100/15m).

---

## 8. Data Model & Relationships

```
User (1)
 ├──< RefreshToken (N)        onDelete: Cascade
 ├──  UserSettings (1:1)      onDelete: Cascade
 ├──< Subject (N)             onDelete: Cascade
 │       └──< Assignment (N)  Assignment.subjectId → Subject  onDelete: SetNull
 ├──< TaskType (N)            onDelete: Cascade
 │       └──< Assignment (N)  Assignment.taskTypeId → TaskType  onDelete: SetNull
 └──< Assignment (N)          onDelete: Cascade
         │
         └──< Assignment (children)  self-relation "AssignmentChildren"
                                     parent_id → Assignment.id  onDelete: Cascade
                                     (one level of nesting enforced in code)
```

**Cascade strategy** (a deliberate Phase-3 lesson learned):
- Deleting a **User** cascades to Subjects, TaskTypes, Assignments, RefreshTokens, and UserSettings (migration `add_cascade_fks`; `TaskType→User` Cascade in `add_task_types`).
- Deleting an **Assignment** cascades to its subtasks (schema self-relation).
- Deleting a **Subject** *nulls* `subjectId` on assignments (SetNull) — assignments survive. The `subjectService.delete` additionally pre-nulls in code for safety.
- Deleting a **TaskType** *nulls* `taskTypeId` on assignments (SetNull) — assignments survive with their built-in `type` intact. No manual pre-null is needed because the FK itself carries `SetNull`.

---

## 9. Dependency & Call-Graph Summary

### Backend (per request)
```
index.ts → routes/index.ts → {auth,subject,taskType,assignment,stats,settings,export}.routes
   routes → middleware/{auth,validate,rateLimit} + utils/response
   routes → services/*.service → config/prisma (singleton) + utils/{hash,jwt}
   services ← validations/schemas (Zod types)
   error boundary → middleware/errorHandler (Prisma-aware)
```

### Frontend
```
main.tsx → App.tsx → router.tsx → Layout (+ pages)
pages → hooks/useAuth → services/auth.api
pages → services/assignments.api → services/api (axios) → backend /api/*
pages/stores via components → stores/{auth,theme,locale,toast} (Zustand)
pages/components → i18n (react-i18next)
```

**Shared contract**: the `ApiResponse<T>` envelope and the Prisma enum string unions (`Status`, `Priority`, `AssignmentType`, `Theme`, `Language`) are duplicated as TS types on both sides — there is no code-gen bridge, so schema changes must be mirrored manually in [frontend/src/services/assignments.api.ts](file:///Users/graceq/Documents/trae_projects/TaskFlakes/frontend/src/services/assignments.api.ts) and [backend/src/validations/schemas.ts](file:///Users/graceq/Documents/trae_projects/TaskFlakes/backend/src/validations/schemas.ts).

---

## 10. Running the Project

### Prerequisites
- Node.js 18+ and npm
- A PostgreSQL instance (local or remote) for the `DATABASE_URL`

### Environment
Copy and edit the examples:
- [backend/.env.example](file:///Users/graceq/Documents/trae_projects/TaskFlakes/backend/.env.example) → `backend/.env`
- [frontend/.env.example](file:///Users/graceq/Documents/trae_projects/TaskFlakes/frontend/.env.example) → `frontend/.env`

Key variables:

| Var | Where | Example |
|---|---|---|
| `DATABASE_URL` | backend | `postgresql://postgres:postgres@localhost:5432/assignment_tracker?schema=public` |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | backend | 256-bit secrets (change in production) |
| `JWT_ACCESS_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | backend | `15m` / `7d` |
| `CORS_ORIGIN` | backend | `http://localhost:5173` |
| `PORT` | backend | `4000` |
| `VITE_API_BASE_URL` | frontend | `http://localhost:4000` |
| `VITE_APP_NAME` | frontend | `Assignments Tracker` |

### Backend
```bash
cd backend
npm install
npm run db:setup        # prisma generate && migrate dev && seed
npm run dev            # tsx watch src/index.ts → http://localhost:4000
# or production:
npm run build          # tsc → dist/
npm start              # node dist/index.js
```

Useful scripts: `prisma:generate`, `prisma:migrate` (dev), `prisma:deploy` (prod), `prisma:studio`, `lint`.

Health check: `GET http://localhost:4000/api/health`.

### Frontend
```bash
cd frontend
npm install
npm run dev            # vite → http://localhost:5173 (proxies /api → :4000)
npm run build          # tsc && vite build → dist/
npm run preview        # serve the production build
```

### Production Deployment (Render)
[render.yaml](file:///Users/graceq/Documents/trae_projects/TaskFlakes/render.yaml) defines:
- **`assignment-tracker-api`** (Node web service): `cd backend && npm ci && npx prisma generate`, then start with `cd backend && npx prisma migrate deploy && node dist/index.js`. Generates `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET`, sets expiry and `CORS_ORIGIN` to the static site.
- **`assignment-tracker-web`** (static site): builds `frontend/dist` and rewrites `/api/*` to the API service.
- **`assignment-tracker-db`**: managed PostgreSQL (free tier, oregon).

---

## 11. Testing

Integration tests are **curl-based shell scripts** under [backend/scripts/](file:///Users/graceq/Documents/trae_projects/TaskFlakes/backend/scripts/), run against a live dev server:

| Script | Coverage |
|---|---|
| [test-auth-api.sh](file:///Users/graceq/Documents/trae_projects/TaskFlakes/backend/scripts/test-auth-api.sh) | Phase 1 — register, login, refresh, logout, me (11 cases) |
| [test-phase2.sh](file:///Users/graceq/Documents/trae_projects/TaskFlakes/backend/scripts/test-phase2.sh) | Subjects + assignments CRUD, subtasks, filtering/sorting/pagination (48 cases) |
| [test-phase3.sh](file:///Users/graceq/Documents/trae_projects/TaskFlakes/backend/scripts/test-phase3.sh) | Auth `PATCH/DELETE /me`, settings CRUD + enum validation, stats shape, export download, import (merge + replace) round-trip (60+ assertions) |

Run with: `bash backend/scripts/test-phase3.sh [BASE_URL]` (default `http://localhost:4000`). The scripts manage a cookie jar and inject `Authorization: Bearer <token>` for protected calls. The dev `DEV_BOOST` rate-limit multiplier prevents 429s during runs.

---

## 12. Engineering Conventions & Key Decisions

- **One service file per domain** in `src/services/`; services are framework-agnostic objects (no `req`/`res`), easing testing.
- **Strict Zod validation** centralized in `src/validations/schemas.ts`; inferred types shared with services.
- **Uniform API envelope** `{ success, data?, meta?, error? }` via [utils/response.ts](file:///Users/graceq/Documents/trae_projects/TaskFlakes/backend/src/utils/response.ts); Prisma errors normalized in the central `errorHandler`.
- **Refresh-token rotation**: tokens are stored **bcrypt-hashed**, consumed on use, and rotated on every refresh.
- **One-level subtask nesting** enforced in `assertParentBelongs` (a parent cannot itself have a parent).
- **In-memory enum sorting** for `priority`/`status` (Prisma lacks custom enum ordering) with a stable secondary `id` sort.
- **Cascade FKs** for user-owned resources (added in migration 3) to prevent orphaned data; `Subject→Assignment` uses `SetNull` so deleting a subject keeps assignments.
- **Timezone-agnostic stats**: all date bucketing uses UTC day keys.
- **Export/import by title/subjectName** (not ids) for portability across accounts; a two-pass transaction restores parent links.
- **Defensive import casting** in `exportService.apply` (type guards + truncation) so malformed bundles fail fast with explicit `INVALID_*_ROW` errors.
- **i18n + theming primed before React mount** to avoid flash/mismatch; theme persists to localStorage and follows OS preference in `SYSTEM` mode.
- **Frontend mirrors backend enum/envelope types by hand** — keep them in sync when the Prisma schema changes.
