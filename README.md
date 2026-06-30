# TillTally — Retail Business Analytics Dashboard

A full-stack business analytics dashboard for small retailers, charity shops and small e-commerce sellers. TillTally turns sales and inventory **CSV exports** into clear KPIs, product performance, inventory-risk alerts, channel analysis and a weekly business report — without enterprise BI complexity.

> Answers five questions: How much did we sell? How much profit? Which products performed best? Which are risky (low stock / slow-moving)? Which channels work best?

---

## Features (MVP)

- **Authentication** — JWT-based register / login, per-user data isolation
- **Business workspaces** — manage one or more shops
- **CSV import** — orders, products & inventory with row-level validation and an import log
- **Sales dashboard** — revenue, gross profit, gross margin %, orders, AOV, units, low-stock & slow-mover counts
- **Product performance** — per-product metrics with labels (Best Seller, High Margin, Low Stock, Slow Mover, Dead Stock…)
- **Inventory insights** — reorder-soon, low-stock, slow-mover and dead-stock detection
- **Channel analysis** — compare Shopify / Trade Me / in-store / social / manual
- **Weekly report** — an automatically generated business summary

---

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL + Prisma ORM |
| Auth | JWT, hashed passwords |
| Tooling | npm workspaces, ESLint, Prettier |
| Deployment | Docker, Nginx, GitHub Actions (planned) |

---

## Monorepo structure

```text
till-tally/
├── client/        # React + TypeScript + Vite + Tailwind frontend
├── server/        # Express + TypeScript API
├── docs/          # Design documentation (API, database, ...)
├── sample-data/   # Demo CSV files
├── package.json   # npm workspaces + root scripts
└── tsconfig.base.json
```

---

## Getting started

### Prerequisites

- **Node.js 20+** and **npm 10+**
- **Docker** + **Docker Compose** (to run PostgreSQL locally)

### 1. Install

```bash
git clone https://github.com/hannnnnnnny/till-tally.git
cd till-tally
npm install            # installs all workspaces
```

### 2. Configure environment

Secrets are **only** read from environment variables — never hardcoded. Copy the example files and fill in your own values:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Generate strong JWT secrets, for example:

```bash
openssl rand -hex 32
```

### 3. Start the database

A PostgreSQL instance is provided via Docker Compose. For local development you
typically run **only the database** in Docker and the apps with `npm`:

```bash
docker compose up -d db     # starts PostgreSQL on localhost:5432
docker compose ps           # check it is healthy
```

It uses dev-only defaults (`tilltally` / `tilltally` / `tilltally`) that match the
`DATABASE_URL` in `server/.env.example`. Data persists in a named volume; run
`docker compose down -v` to reset it. Override credentials with `POSTGRES_USER`,
`POSTGRES_PASSWORD`, `POSTGRES_DB` or `POSTGRES_PORT` (e.g. in a root `.env`).

### 4. Run in development

```bash
npm run dev:server     # API on http://localhost:4000
npm run dev:client     # App on http://localhost:5173 (proxies /api -> 4000)
```

Health check: <http://localhost:4000/api/health>

### Optional: seed demo data

After the database is running and migrations are applied, seed a demo user,
business, products, orders, inventory snapshots and import jobs:

```bash
npm run db:seed
```

Demo login:

```text
Email: demo@tilltally.local
Password: DemoPass123!
```

The seed is idempotent for the demo business: running it again recreates the
same sample workspace from `sample-data/*.csv`.

### Run the whole stack in Docker

Alternatively, build and run all three services (database, API, client) in
containers:

```bash
docker compose up -d --build
```

| Service | URL |
| --- | --- |
| Client (nginx) | <http://localhost:8080> |
| API | <http://localhost:4000/api/health> |
| Database | `localhost:5432` |

---

## Scripts

Run from the repository root:

| Script | Description |
| --- | --- |
| `npm run dev:client` | Start the Vite dev server |
| `npm run dev:server` | Start the API with hot reload |
| `npm run build` | Build client and server |
| `npm run db:seed` | Seed demo data from sample CSV files |
| `npm run typecheck` | Type-check both workspaces |
| `npm run lint` | Lint with ESLint |
| `npm run format` | Format with Prettier |
| `npm run format:check` | Check formatting without writing |

---

## Documentation

| Document | Description |
| --- | --- |
| [docs/API.md](docs/API.md) | REST API design — endpoints, request/response, errors, security |
| [docs/DATABASE.md](docs/DATABASE.md) | Database schema, ERD, Prisma models, indexing, data isolation |

The full product plan lives in `TT.md` (vision, scope, roadmap).

---

## Security & privacy

- Passwords are hashed; authentication uses JWT.
- Every business-scoped query is filtered by a verified `business_id` (no cross-tenant access).
- CSV uploads are validated for type and size.
- **Privacy-first:** only analytics-relevant data is imported — no customer names, emails, phone numbers, addresses or payment details.

---

## Roadmap

Work is tracked on the [TillTally project board](https://github.com/users/hannnnnnnny/projects/2), organised into epics **A–G** (foundation, auth, workspace, import, analytics, frontend, reporting & deployment).

---

## License

[MIT](LICENSE)
