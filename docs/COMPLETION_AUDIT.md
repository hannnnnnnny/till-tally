# Completion Audit

Feature-by-feature verification of every capability claimed in `README.md` and `docs/`.

- **Baseline audit:** `main` at `1837bf7` (2026-10-12), before any fixes.
- **Final acceptance:** fresh clone of `main` after PRs #208–#220, following the README
  step by step.

Legend: ✅ complete and tested · 📝 README/docs corrected to describe actual behaviour

## 1. Final acceptance run (fresh clone)

Environment: Windows 11, Node 24.14.1, npm 11.11.0, Docker 29.5.3, PostgreSQL 16 (Compose).
Ports were overridden (`POSTGRES_PORT=55434 SERVER_PORT=4300 CLIENT_PORT=8083`,
`-p tilltally-acceptance`) because another checkout's stack was using the defaults.

| Step | Command | Result |
| --- | --- | --- |
| Clone and install | `git clone …` → `npm install` | ✅ exit 0; postinstall generated the Prisma client |
| Environment | copy `server/.env.example` and `client/.env.example`; `openssl rand -hex 32` ×2 | ✅ |
| Database | `docker compose up -d db` | ✅ healthy |
| Migrate + seed | `npm run db:migrate` → `npm run db:seed` | ✅ "10 products, 159 orders" (both steps found missing/broken in this run and fixed in #220) |
| Type-check | `npm run typecheck` | ✅ exit 0 |
| Lint | `npm run lint` | ✅ exit 0 |
| Formatting | `npm run format:check` | ✅ exit 0 (also on Windows) |
| Prisma schema | `npm run prisma:validate` | ✅ exit 0 |
| Planner evals | `npm run test:analytics-evals -w server` | ✅ 18/18 |
| Unit tests | `npm test --workspaces --if-present` | ✅ 362/362 (client 143, server 210, contracts 9)¹ |
| Integration | `npm run test:integration -w server` | ✅ 13/13 against Postgres |
| Browser (mocked API) | `npm run test:e2e` | ✅ 44/44 |
| Browser (full stack) | `npm run test:e2e:fullstack` | ✅ 1/1 against the real API and Postgres |
| Production build | `npm run build` | ✅ exit 0 |
| Full Docker stack | `docker compose up -d --build` | ✅ db/server/client healthy; `/api/health/ready` → database ok |

¹ #220 adds one client test, so the next CI run reports client 144 and 363 in total.

### Demo walkthrough against the Docker stack

Run with Playwright against `http://localhost:8083`, using the demo account:

1. Sign in → Dashboard revenue **$3,716.50** (last 30 days).
2. Import a 3-row orders CSV. One row has `total_amount = not-a-number`; it is fixed inline
   to `18.00`, the row re-validates, and **3 rows are imported**.
3. Dashboard revenue **$3,959.30**: exactly +$242.80 (179.80 + 45.00 + 18.00).
4. Inventory risk shows all five categories. The imported jacket sale moved its
   "last sold" date to yesterday.
5. Ask TillTally: "Show revenue by channel for the last 7 days" → plan reviewed (6–12 Oct)
   → bar chart → saved as "Last 7 days by channel" → still listed after a reload.

Screenshots: dashboard (desktop and 375px), import row correction, import result, inventory
risk, analytics planner.

## 2. Feature status

| # | Claimed capability | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Dashboard KPIs (revenue, gross profit, margin, orders, AOV, units, inventory risk) | ✅ | `summaryService` unit tests; integration asserts exact values from the sample CSVs (793.70 / 486.95 / 61.35%); full-stack E2E asserts the revenue change after an import |
| 2 | Sales trend and channel breakdown | ✅ | unit and integration tests (channel totals reconcile to revenue) |
| 3 | Product performance | ✅ | unit tests; integration asserts ranking and gross profit |
| 4 | Inventory risk (low stock, stockout, slow mover, dead stock, overstock) | ✅ | rule unit tests; the demo seed is tested to hit all five categories on 14 consecutive seeding days; order imports now advance last-sold dates (integration test) |
| 5a | CSV preview | ✅ | `preview.test.ts` (12); Imports E2E |
| 5b | Column mapping | ✅ | `preview.test.ts`; E2E checks the uploaded file uses canonical headers |
| 5c | Header aliases | ✅ | server `csvValidation` tests; client `mappingSuggestions.test.ts` (7) |
| 5d | Row-level correction | ✅ | **new**: inline fix form (`rowCorrections.ts`, 9 tests); E2E fixes a row and checks the uploaded value; undo asks for confirmation |
| 5e | Validation and skip invalid rows | ✅ | `rowValidation.test.ts` (7); **fixed**: "Skip invalid rows" previously still uploaded the invalid rows |
| 5f | Import history | ✅ | integration (row errors stored per job); E2E |
| 5g | Upload safety (type, size, renamed storage) | ✅ | `uploadMiddleware` tests; integration and real-API checks (415 on `.exe`) |
| 5h | Inventory snapshot import | 📝 | no endpoint exists; README, DATABASE.md, importer and landing copy now say snapshots can be previewed but not imported |
| 6 | Weekly report | ✅ | service tests; integration asserts −42.89% week-on-week; the seed now generates a non-empty report for the last complete week |
| 7 | Analytics planner (deterministic) | ✅ | Zod contract tests; 18-case eval gate; **fixed**: last N days / last month / yesterday were silently treated as the last 30 days; a chart type in the first question was ignored |
| 7b | Optional Ollama provider | ✅ | mocked-provider tests and shared schema validation (no live model in CI, by design) |
| 8 | Saved analysis | ✅ | service and router tests; integration (cross-workspace 404s); full-stack E2E saves a report and reloads it |
| 9 | Authentication | ✅ | auth, token and refresh-store tests; rate-limit tests |
| 10 | Workspace isolation | ✅ | **new**: `requireBusinessAccess` unit tests (7); integration against Postgres covering 10 scoped reads (header and query string), 5 writes, and 7 record-id routes; a mutation check (membership check disabled) fails 3 tests |
| 11 | Responsive UI (375px) | ✅ | every data page has 375px tests for data, loading, empty and error states, with no horizontal overflow; **fixed**: Imports overflowed to 589px |
| 12 | Accessibility checks (axe) | ✅ | axe runs on every page and state, mobile and desktop; **fixed**: role-less `aria-label` loaders, invalid `<dl>` content, 5 contrast failures, non-focusable scroll regions |
| 13 | Loading / empty / error states | ✅ | `page-states.spec.ts` (29 tests) |
| 14 | Docker Compose | ✅ | **fixed**: hardcoded container names blocked parallel stacks; `CLIENT_PORT` added; images build and the stack runs healthy |
| 15 | CI pipeline | ✅ | `ci.yml` runs: critical-advisory audit, format, Prisma validate/generate, lint, typecheck, evals, unit tests, migrate + Postgres integration tests, mocked and full-stack Playwright, build; enforced by `ciHygiene.test.ts` |
| 16 | API.md | ✅ 📝 | endpoint summary now lists the analytics, saved-report and health routes; 20 dead `TT.md` links removed (correction: the saved-report table already existed; only the summary was missing) |
| 17 | DATABASE.md | ✅ 📝 | `refresh_tokens`, `saved_reports` and `saved_report_versions` documented; seed and `last_sold_at` behaviour corrected |
| 18 | Secrets from environment only | ✅ | `config/env.ts` production guard tests; tests and E2E generate random JWT secrets at runtime |
| 19 | Parameterised SQL | ✅ | Prisma throughout; drift-repair SQL now uses `Prisma.sql` bound parameters; no `*RawUnsafe` calls remain |

## 3. Code-standard scan (final)

| Rule | Result |
| --- | --- |
| No `any` | ✅ 0 (ESLint `no-explicit-any: error`) |
| No empty `catch` | ✅ 0; every catch handles or explains the error |
| No leftover `console.log` | ✅ only the eval CLI's output |
| No `TODO: fix later` / commented-out code | ✅ 0 |
| Functions under 40 lines | ⚠️ 101 non-test functions are still longer (see §4). Code written or changed in this pass was kept under 40 lines. |

## 4. Known limitations

- **Long functions:** large page components remain: `AnalyticsPage` (728 lines),
  `CsvImportPanel` (460, which grew with row correction), `ProductsPage` (256), `AppShell`
  (238), `DashboardPage` (232). Splitting them is pure refactoring with regression risk
  and was deferred; E2E coverage of these pages is now in place to make it safe.
- **Dependency advisories:** production has 3 high and 0 critical. All three are in the
  Prisma CLI config chain (`prisma` → `@prisma/config` → `deepmerge-ts`); every 6.x release
  is affected and the fix needs Prisma 8. The CLI only reads the repository's own config.
  Tailwind 3 build-tool advisories need Tailwind 4. CI fails on any critical advisory.
- **Inventory snapshots** are stored by the seed only; no import endpoint, and analytics
  use `current_stock`.
- **Planner** is rule-based: it supports one metric and one grouping per question and
  no free-text filters. The optional Ollama provider is not exercised live in CI.
- **Docker:** the API container does not run migrations on start; run `npm run db:migrate`
  (or the deployment guide's step) for a fresh volume.
- **Refresh tokens:** replaying a revoked token is rejected, but it does not revoke the rest
  of the rotation chain.

## 5. Baseline findings and resolution

| Priority | Gap at baseline | Resolution |
| --- | --- | --- |
| P0 | No database-backed tests; isolation middleware untested | #209 |
| P0 | README claimed row-level correction | #211 implemented it |
| P0 | Client CSV import logic untested | #210 (+3 bugs fixed) |
| P0 | Demo seed ended about 2 weeks before seeding; 2 of 5 risk categories | #212 |
| P0 | 12 production advisories (1 critical) | #213 → 3 high, 0 critical; CI gate |
| P1 | Every browser test mocked the API | #214 full-stack journey |
| P1 | axe / 375px only on 3 pages | #215 (+ accessibility fixes) |
| P1 | Compose container names, CRLF formatting, docs drift, inventory import claims | #216 (+ last-sold import bug) |
| P2 | 4 eval cases | #217 → 18 (+ 2 planner bugs) |
| P2 | `$executeRawUnsafe` with interpolated SQL | #218 |
| Acceptance | Fresh clone: Prisma client not generated; no migrate step; drift CLI ignored `.env`; "1 products" | #219, #220 |
