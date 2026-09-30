# ReachInbox Email Scheduler

A production-grade email scheduler service with a React dashboard. Schedule emails at scale using BullMQ + Redis, send via Ethereal SMTP, search with Elasticsearch, and get real-time Slack notifications on rate limits.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Setup](#setup)
- [Running the Project](#running-the-project)
- [Scheduling & Persistence](#how-scheduling-works)
- [Rate Limiting & Concurrency](#rate-limiting--concurrency)
- [Slack Integration](#slack-notifications)
- [API Reference](#api-endpoints)
- [Frontend](#frontend-overview)
- [Assumptions & Trade-offs](#assumptions--trade-offs)

---

## Features

### Backend
- [x] Email scheduling via REST API (single + batch CSV upload)
- [x] BullMQ delayed jobs for scheduling (no cron)
- [x] PostgreSQL persistence via Prisma ORM
- [x] Ethereal Email (fake SMTP) for actual email sending
- [x] Elasticsearch indexing for full-text search of emails
- [x] Bull Board dashboard at `/admin/queues` for queue monitoring
- [x] Configurable worker concurrency
- [x] Redis-based rate limiting (per-sender + global)
- [x] Automatic job recovery on server restart
- [x] Idempotency via unique constraint on recipient+subject+scheduledAt+userId
- [x] Slack OAuth integration with live rate-limit notifications
- [x] Google OAuth login

### Frontend
- [x] Google OAuth login with user avatar/name/email display
- [x] Dashboard with stats cards (Scheduled, Sent, Failed)
- [x] Scheduled emails tab with cancel action
- [x] Sent emails tab
- [x] Compose modal (single email + bulk CSV upload)
- [x] Configurable delay between sends and hourly limit
- [x] Debounced Elasticsearch search
- [x] Auto-refresh every 10 seconds
- [x] Pagination on all tables
- [x] Loading states, empty states, error toasts
- [x] Slack connect/disconnect from header
- [x] Clean, responsive Tailwind CSS design

---

## Architecture

```
┌──────────────┐     REST API      ┌──────────────────┐
│   Frontend   │ ◄──────────────► │    Express.js     │
│  React+Vite  │                   │    Backend        │
└──────────────┘                   └────────┬─────────┘
                                            │
                          ┌─────────────────┼─────────────────┐
                          │                 │                 │
                    ┌─────▼─────┐    ┌──────▼──────┐   ┌─────▼──────┐
                    │  BullMQ   │    │ PostgreSQL  │   │ Elastic    │
                    │  Queue    │    │  (Prisma)   │   │ Search     │
                    │  (Redis)  │    │             │   │            │
                    └─────┬─────┘    └─────────────┘   └────────────┘
                          │
                    ┌─────▼─────┐
                    │  Worker   │ ──► Ethereal SMTP
                    │ (BullMQ)  │ ──► Slack Webhook
                    └───────────┘
```

**Flow:**
1. User schedules email(s) via the frontend form → hits POST `/api/emails/schedule` or `/schedule-batch`
2. Backend creates a record in PostgreSQL, indexes it in Elasticsearch, and adds a delayed job to BullMQ
3. The BullMQ worker picks up jobs when their scheduled time arrives
4. Worker checks Redis-based rate limits before sending
5. If rate limited → reschedules to next hour window, sends Slack notification
6. If allowed → sends via Ethereal SMTP, updates DB to SENT, re-indexes in ES
7. On server restart → `recoverOrphanedJobs()` re-queues any jobs that lost their BullMQ reference

---

## Setup

### Prerequisites
- Node.js 18+
- Docker & Docker Compose (for Redis, PostgreSQL, Elasticsearch)
- Google Cloud Console project (for OAuth)
- Slack App (for Slack OAuth, optional)

### 1. Start Infrastructure

```bash
cd reachinbox-scheduler
docker compose up -d
```

This starts:
- **Redis** on port 6379
- **PostgreSQL** on port 5432 (user: `reachinbox`, pass: `reachinbox123`, db: `reachinbox_scheduler`)
- **Elasticsearch** on port 9200

### 2. Ethereal Email Setup

Ethereal accounts are created automatically when a new sender email is first used. The system calls `nodemailer.createTestAccount()` and stores the credentials in the `SenderAccount` table.

Preview URLs for sent emails are logged to the console — you can click them to view the email on Ethereal's web UI.

### 3. Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create OAuth 2.0 credentials
3. Set **Authorized redirect URI** to: `http://localhost:4000/api/auth/google/callback`
4. Copy the Client ID and Client Secret into your `.env`

### 4. Slack App Setup (Optional)

1. Create a Slack App at [api.slack.com/apps](https://api.slack.com/apps)
2. Under **OAuth & Permissions**, add scopes: `chat:write`, `chat:write.public`
3. Set **Redirect URL** to: `http://localhost:4000/api/slack/callback`
4. Copy Client ID and Secret into your `.env`

### 5. Backend Environment

```bash
cd backend
cp .env.example .env
# Edit .env with your actual credentials
```

Key environment variables:
| Variable | Description | Default |
|---|---|---|
| `PORT` | Server port | `4000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://reachinbox:reachinbox123@localhost:5432/reachinbox_scheduler` |
| `REDIS_HOST` | Redis hostname | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `ELASTICSEARCH_URL` | Elasticsearch URL | `http://localhost:9200` |
| `JWT_SECRET` | Secret for signing JWTs | — |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | — |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | — |
| `SLACK_CLIENT_ID` | Slack app client ID | — |
| `SLACK_CLIENT_SECRET` | Slack app client secret | — |
| `MAX_EMAILS_PER_HOUR` | Global hourly email limit | `200` |
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | Per-sender hourly limit | `50` |
| `WORKER_CONCURRENCY` | Number of parallel workers | `5` |
| `MIN_DELAY_BETWEEN_SENDS_MS` | Minimum ms between individual sends | `2000` |

---

## Running the Project

### Backend

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

The server starts at `http://localhost:4000`.

BullMQ dashboard is available at `http://localhost:4000/admin/queues`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend starts at `http://localhost:5173` and proxies `/api` requests to the backend.

---

## How Scheduling Works

### No Cron — BullMQ Delayed Jobs Only

When an email is scheduled:
1. A record is created in PostgreSQL with status `SCHEDULED`
2. A BullMQ job is added to the `email-scheduler` queue with a `delay` equal to `(scheduledAt - now)` in milliseconds
3. Redis keeps the job in a sorted set until the delay expires
4. The worker picks it up automatically at the right time

### Persistence Across Restarts

BullMQ stores all pending/delayed jobs in Redis with `appendonly` persistence enabled. On restart:

1. **Redis persists all delayed jobs** — they continue to fire at the correct times
2. **`recoverOrphanedJobs()`** runs on startup and checks for any DB records that are `SCHEDULED` but don't have a `bullJobId` (meaning they were inserted but never queued, e.g. if the server crashed mid-operation)
3. Past-due orphaned jobs are re-queued immediately; future ones are re-queued with the correct delay

### Idempotency

A unique constraint on `(recipientEmail, subject, scheduledAt, userId)` prevents the same email from being scheduled twice. Prisma throws a `P2002` error which the controller catches and returns a 400.

---

## Rate Limiting & Concurrency

### Worker Concurrency

Configurable via `WORKER_CONCURRENCY` env var (default: 5). The BullMQ worker runs up to N jobs in parallel. Each job handler is safe for concurrent execution since:
- DB updates use `where: { id }` (row-level targeting)
- Redis rate limit counters use atomic `INCR` commands
- No shared in-memory state between jobs

### Minimum Delay Between Sends

Set via `MIN_DELAY_BETWEEN_SENDS_MS` (default: 2000ms — 2 seconds between each email send). This is enforced in the worker with `setTimeout()` after each successful send to mimic real SMTP provider throttling.

### Hourly Rate Limiting

**Two levels of rate limiting:**

1. **Global limit** (`MAX_EMAILS_PER_HOUR`): Maximum total emails across all senders per hour
2. **Per-sender limit** (`MAX_EMAILS_PER_HOUR_PER_SENDER`): Maximum emails per individual sender per hour

**How it works:**
- Redis keys: `ratelimit:{senderEmail}:{hourWindow}` and `ratelimit:global:{hourWindow}`
- Hour window is formatted as `YYYY-MM-DD:HH` in UTC
- `INCR` + `EXPIRE 3600` for atomic, self-cleaning counters
- Before each send, the worker calls `checkRateLimit()` which reads both counters
- If either limit is hit → job is rescheduled to the start of the next hour via `job.moveToDelayed()`

**Under load (1000+ emails at same time):**
- Workers process them at `CONCURRENCY` parallel rate
- The per-sender counter increments atomically in Redis
- Once the hourly limit is hit, remaining jobs get pushed to the next hour window
- Jobs are NOT dropped or permanently failed — they're delayed and will be retried
- Slack notification is sent on first rate-limit hit per window

**Trade-offs:**
- Using `job.moveToDelayed()` preserves the original job data without duplication
- Redis-based counters are safe across multiple workers/instances
- The hour-window approach means the limit resets on the clock hour, not a rolling window (simpler but slightly less precise)

---

## Slack Notifications

### Connect Flow
1. User clicks "Connect Slack" in the dashboard header
2. Browser redirects to Slack's OAuth authorize page
3. After approval, Slack redirects back to `/api/slack/callback`
4. Backend exchanges the code for an access token and stores it on the User record
5. Dashboard shows green indicator with workspace name

### Rate Limit Notifications
When a sender hits their hourly limit:
1. Worker calls `sendSlackRateLimitNotification(userId, senderEmail, limit, window)`
2. Function looks up the user's Slack token
3. If token exists → sends a message via `chat.postMessage` API
4. If no token → silently skips (no crash)
5. If user later connects Slack → notifications start working immediately (token is read from DB per-call, no restart needed)

---

## API Endpoints

### Auth
| Method | Path | Description |
|---|---|---|
| GET | `/api/auth/google` | Start Google OAuth flow |
| GET | `/api/auth/google/callback` | Google OAuth callback |
| GET | `/api/auth/me` | Get current user (protected) |
| POST | `/api/auth/logout` | Logout |

### Emails (all protected)
| Method | Path | Description |
|---|---|---|
| POST | `/api/emails/schedule` | Schedule single email |
| POST | `/api/emails/schedule-batch` | Schedule batch (multipart with CSV) |
| GET | `/api/emails/scheduled?page=1&limit=20` | List scheduled emails |
| GET | `/api/emails/sent?page=1&limit=20` | List sent emails |
| GET | `/api/emails/search?q=term` | Elasticsearch search |
| GET | `/api/emails/stats` | Get counts (scheduled/sent/failed) |
| DELETE | `/api/emails/:id` | Cancel scheduled email |

### Slack (all protected)
| Method | Path | Description |
|---|---|---|
| GET | `/api/slack/connect` | Start Slack OAuth |
| GET | `/api/slack/callback` | Slack OAuth callback |
| POST | `/api/slack/disconnect` | Disconnect Slack |
| GET | `/api/slack/status` | Get connection status |

---

## Frontend Overview

### Pages
- **Login** — Google OAuth sign-in with centered card UI
- **Auth Callback** — Handles token extraction from URL redirect
- **Dashboard** — Main page with stats, tabs, search, compose modal

### Components
- `Header` — App logo, Slack connect/disconnect, user info, logout
- `Layout` — Page wrapper with header + max-width container
- `ComposeModal` — Schedule single or batch emails with CSV upload
- `EmailTable` — Reusable table with pagination, loading, empty states
- `StatusBadge` — Color-coded status pills (SCHEDULED/SENT/FAILED/etc)
- `LoadingSpinner` — Reusable spinner component
- `EmptyState` — Placeholder for empty tables

---

## Assumptions & Trade-offs

1. **Ethereal accounts are auto-created** — When a sender email is first used, we create an Ethereal test account and store credentials. In production, these would be real SMTP credentials.

2. **Rate limit resets on clock hour** — We use UTC hour windows (e.g. 14:00-15:00) rather than a rolling 60-minute window. Simpler to implement and reason about, though slightly less precise.

3. **Single queue** — All emails go through one BullMQ queue `email-scheduler`. For multi-tenant production, you'd want per-tenant queues or queue partitioning.

4. **JWT in URL parameter** — The Google OAuth callback passes the JWT token via URL query parameter to the frontend. In production, you'd use HttpOnly cookies or a more secure handoff.

5. **No email templates** — The body field is plain text. A real system would support HTML templates with variable interpolation.

6. **Elasticsearch is optional for basic ops** — If ES is down, scheduling and sending still work. Search results will be empty. ES errors are caught and logged, not propagated.

7. **Worker delay is per-worker** — The `MIN_DELAY_BETWEEN_SENDS_MS` is enforced per worker thread via setTimeout, not globally. With concurrency=5, you might get 5 emails within the delay window. For stricter global throttling, use BullMQ's built-in `limiter` option.

---

## Project Structure

```
reachinbox-scheduler/
├── docker-compose.yml
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example
│   ├── prisma/
│   │   └── schema.prisma
│   └── src/
│       ├── index.ts                 # Express app entry
│       ├── config/
│       │   ├── db.ts                # Prisma client
│       │   ├── redis.ts             # Redis connections
│       │   └── elastic.ts           # Elasticsearch client
│       ├── controllers/
│       │   ├── authController.ts    # Google OAuth + JWT
│       │   ├── emailController.ts   # Schedule, list, cancel
│       │   └── slackController.ts   # Slack OAuth
│       ├── middleware/
│       │   └── auth.ts              # JWT + Passport setup
│       ├── routes/
│       │   ├── auth.ts
│       │   ├── emails.ts
│       │   └── slack.ts
│       ├── services/
│       │   ├── mailer.ts            # Ethereal SMTP
│       │   ├── queue.ts             # BullMQ queue + Bull Board
│       │   ├── rateLimiter.ts       # Redis rate limiting
│       │   ├── searchIndex.ts       # Elasticsearch indexing
│       │   ├── slackNotifier.ts     # Slack message sender
│       │   └── worker.ts            # BullMQ worker + recovery
│       ├── types/
│       │   └── index.ts
│       └── utils/
│           └── helpers.ts           # CSV parser, delay calc
└── frontend/
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.js
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── index.css
        ├── context/
        │   └── AuthContext.tsx
        ├── hooks/
        │   └── useAuth.ts
        ├── services/
        │   └── api.ts
        ├── types/
        │   └── index.ts
        ├── components/
        │   ├── Header.tsx
        │   ├── Layout.tsx
        │   ├── ComposeModal.tsx
        │   ├── EmailTable.tsx
        │   ├── StatusBadge.tsx
        │   ├── EmptyState.tsx
        │   └── LoadingSpinner.tsx
        └── pages/
            ├── Login.tsx
            ├── Dashboard.tsx
            └── AuthCallback.tsx
```
