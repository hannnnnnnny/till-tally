# Completion Audit

Audit of every capability claimed in `README.md` and `docs/`, checked against the code and
against a running system. Baseline: `main` at `1837bf7` (2026-10-12).

Legend: ✅ complete and tested · 🟡 partial (gap stated) · ❌ not implemented ·
⚠️ documented but absent from code

## 1. Commands actually run

Environment: Windows 11, Node 24.14.1, npm 11.11.0, Docker 29.5.3.

| Command | Result | Notes |
| --- | --- | --- |
| `npm install` | ✅ exit 0 | Reports 26 vulnerabilities (7 moderate, 18 high, 1 critical); 12 are in production deps. |
| `npm run typecheck` | ❌ then ✅ | First run failed (8 errors, e.g. `SalesChannel` missing from `@prisma/client`) because the generated Prisma client was stale. Passed after `npm run prisma:generate -w server`. |
| `npm run lint` | ✅ exit 0 | |
| `npm run format:check` | ❌ exit 1 locally | 161 files flagged. Cause: `core.autocrlf=true` checks files out with CRLF, and Prettier expects LF. `prettier --check --end-of-line auto` passes, and CI on Linux is green. |
| `npm run prisma:validate` | ✅ | Warns that `package.json#prisma` is deprecated in Prisma 7. |
| `npm test --workspaces --if-present` | ✅ 310 / 310 | client 108, server 193, analytics-contracts 9. No skips. |
| `npm run test:analytics-evals -w server` | ✅ 4 / 4 | |
| `npm run test:e2e` | ✅ 10 / 10 | Every `/api/**` call is mocked with `page.route`, so no real backend is exercised. |
| `npm run build` | ✅ exit 0 | |
| `docker compose up -d db` | ❌ | Container-name conflict: `container_name: tilltally-db` is hardcoded, and a stack from another worktree already held that name. To keep that stack untouched, the audit used a separate `postgres:16-alpine` container on port 55432. |
| `prisma migrate deploy` + `npm run db:seed` | ✅ | Seeded 1 business, 6 products, 12 orders, 12 order items, 12 inventory snapshots, 3 import jobs. |
| Real-API smoke test (built server + seeded DB) | ✅ with findings | See §3. |
| `docker compose up -d --build` (full stack) | not run | Blocked by the same container-name conflict. Re-verify in Phase 3. |

## 2. Feature inventory

| # | Claimed capability | Status | Evidence / gap |
| --- | --- | --- | --- |
| 1 | Dashboard KPIs (revenue, gross profit, margin, orders, AOV, units, inventory risk) | ✅ | `summaryService` plus tests; real API returned correct KPIs for seeded data. |
| 2 | Sales trend and channel breakdown | ✅ | `salesTrendService` and `channelBreakdownService`, both tested; real API OK. |
| 3 | Product performance (ranking, contribution, status labels) | ✅ | `productPerformanceService` plus route tests; real API OK. |
| 4 | Inventory risk: low-stock, stockout, slow-mover, dead-stock, overstock | 🟡 | All five rules are implemented and unit-tested. In the demo seed only low-stock (2) and overstock (2) appear; stockout, slow-mover and dead-stock are always empty, so three of the five rules can't be demonstrated. |
| 5a | CSV preview | 🟡 | Client `imports/preview.ts` works but has **no unit tests**. No E2E covers the Imports page. |
| 5b | Column mapping | 🟡 | `ColumnMappingEditor` and `createMappedCsvFile` exist with no unit tests. |
| 5c | Header aliases | ✅ / 🟡 | Server aliases in `csvValidation.ts` are tested. Client `mappingSuggestions.ts` is untested. |
| 5d | Row-level correction (README: "row-level corrections") | ⚠️ | `rowValidation.ts` only **reports** row errors. Invalid cells can't be edited or fixed in the UI before import. The README's "correction guidance" wording is closer to the truth than "row-level corrections". |
| 5e | Import history | ✅ | `GET /api/import/jobs[/:id]`, tested; real API OK. |
| 5f | Upload safety (type, size, renamed storage, stripped paths) | ✅ | `uploadMiddleware.ts` enforces MIME and `.csv` checks, a size limit and `randomUUID()` filenames; tested. Real API returned 415 for `evil.exe`. |
| 5g | Inventory snapshot CSV import | 🟡 | The UI previews inventory files but says inventory import "is not available yet", and there is no server endpoint. The seed inserts a fake `INVENTORY` import job, so import history shows an import the pipeline can't perform. |
| 6 | Weekly report (top products, warnings, suggested actions) | 🟡 | Service and routes are tested. With seed data, the current- and previous-week reports both show "$0.00 / −100%" because seeded orders end about 13 days before seeding day. |
| 7 | Analytics planner, deterministic | ✅ | Zod contract in `analytics-contracts`, planner, executor and audit log, all tested. Real API: plan → execute succeeded. |
| 7b | Analytics planner, optional Ollama | ✅ (mock-tested) | `ollamaPlannerProvider.test.ts` uses a stubbed fetch; no live Ollama was run. Output is re-validated against the same schema. |
| 7c | Planner evaluations | 🟡 | 4 cases (revenue, margin, product, inventory). This matches the docs but is thin; clarification, unsupported and refinement paths aren't covered. |
| 8 | Saved analysis (persisted, versioned, auditable) | ✅ | Saved-reports service, router and repository, tested; real API save returned 201. |
| 9 | Auth (bcrypt, short-lived JWT, httpOnly refresh cookie, rate limits) | ✅ | Auth routes, tokens, refresh-store and rate-limit tests. |
| 10 | Workspace isolation | 🟡 | Runtime isolation held in every case (see §3). Automated coverage is weak: `businesses/middleware.ts` (`requireBusinessAccess`) and `businesses/routes.ts` have **no tests**, and no test uses a real database. Route tests only check "missing business context → 403" with fakes. |
| 11 | Responsive UI | 🟡 | 375px E2E covers only landing, the products shell and analytics. Dashboard, Imports, Inventory, Reports, Channels and Workspace have no 375px test. |
| 12 | Accessibility checks (axe) | 🟡 | `AxeBuilder` runs only in `analytics-workspace.spec.ts`. |
| 13 | Loading / empty / error states on every data page | 🟡 | All pages use `StatePanel` with loading, empty and error tones on code inspection. This isn't verified by tests, and the Imports page states aren't tested at all. |
| 14 | Docker Compose (db only, and full stack) | 🟡 | Works only if no other stack uses the hardcoded names `tilltally-db`, `tilltally-server` and `tilltally-client`. Client port 8080 isn't configurable. The full-stack build wasn't verified in this audit. |
| 15 | CI runs format, Prisma validation, lint, typecheck, evals, unit/integration tests, Playwright and build | ✅ / 🟡 | Every listed step is in `ci.yml`, and the last `main` run passed. There is no Postgres service, though, so the "integration tests" run against fakes and Playwright runs against a mocked API. |
| 16 | Docs: API.md | 🟡 | Missing all 7 `/api/analytics/saved-reports` endpoints. |
| 17 | Docs: DATABASE.md | 🟡 | The `RefreshToken` model / `refresh_tokens` table isn't documented. |
| 18 | Security: secrets from env | ✅ | `config/env.ts` rejects short, default or identical JWT secrets in production; tested. |
| 19 | Security: SQL | ✅ | All queries go through Prisma. `$executeRawUnsafe` appears only in the migration-drift CLI, with constant SQL and no user input. |

### Code-standard scan

| Rule | Result |
| --- | --- |
| No `any` | ✅ 0 occurrences; ESLint `no-explicit-any: error`. |
| No empty `catch` | ✅ 0. |
| No `console.log` | ✅ Only in `analyticsEvaluationCli.ts`, where it is the CLI's output. |
| No `TODO: fix later` / commented-out code | ✅ 0 TODO/FIXME. |
| Functions under 40 lines | 🟡 101 non-test functions are longer. Worst: `AnalyticsPage` 728, `CsvImportPanel` 429 (11 long functions), `ProductsPage` 256, `AppShell` 238, `DashboardPage` 232. |

## 3. Real-API smoke test (seeded DB, built server)

- Login, listing businesses, and all GET endpoints (dashboard ×3, products, inventory ×3,
  import jobs, weekly report, saved reports) → 200 with plausible data. A request without a token → 401.
- Product CSV import → 201 with 6 rows imported. Uploading a `.exe` file → 415.
- Planner: "Show revenue by channel for the last 30 days" → plan → execute → save → 200/200/201.
- **Isolation:** a second user with their own business got 403 on every business-A endpoint, whether
  the business ID came from the header or the query string.
- **Record-ID access:** user B, sending business B's header, got 404 when requesting business A's
  product ID, import-job ID and saved-report ID (GET, PATCH, duplicate, DELETE). A's report
  stayed intact.
- **Data finding:** re-importing `sample-data/products.csv` resets `last_sold_at` to the
  unshifted June 2026 dates. Seeded `lastSoldAt` values (10-07…10-11) are also later than the
  newest seeded order (09-29).

## 4. Prioritised gaps

### P0: critical-path tests, false claims, demo blockers

1. **DB-backed integration tests and workspace isolation.** Add a Postgres service to CI and an
   integration suite against a real database. A user in workspace A must not be able to read
   workspace B through any business-scoped endpoint or any record ID. Also cover the import
   flow end to end and KPI/margin values against known data. Add unit tests for
   `requireBusinessAccess` and `businesses/routes.ts`.
2. **Row-level correction.** Either implement inline correction of invalid cells in the import
   preview (re-validate, then upload the corrected mapped CSV), or reword the README.
   *Recommendation: implement it. It is small on the client side and strong in a demo.*
3. **Client CSV import tests.** Add unit tests for `preview.ts`, `mappingSuggestions.ts`,
   `rowValidation.ts` and `createMappedCsvFile`, plus an Imports-page E2E.
4. **Demo seed realism.** Shift order dates so the newest order is yesterday. Derive
   `lastSoldAt` from orders. Add sample rows so stockout, slow-mover and dead-stock each appear,
   and make the current and previous weekly reports non-zero.
5. **Production dependency vulnerabilities.** Upgrade the affected packages (12 in total: 1
   critical `proxy-addr`; high in `multer`, `prisma`, `react-router`, and others). All have
   non-major fixes.

### P1: verification depth and developer experience

6. Add a real full-stack Playwright spec (no mocks) for import CSV → KPIs → planner question →
   save report, and run it in CI against the Postgres service.
7. Extend axe and 375px checks to Dashboard, Imports, Inventory, Weekly report, Channels and
   Workspace, including their empty and error states.
8. `docker-compose.yml`: remove the hardcoded `container_name` values (or make them
   configurable) and parameterise the client port.
9. Add `.gitattributes` (`* text=auto eol=lf`) so `format:check` passes on Windows checkouts.
10. Make sure the Prisma client is generated after install (a `postinstall` script, or document
    the step), then confirm on a fresh clone.
11. Inventory snapshot import: implement `POST /api/import/inventory`, or document it as
    seed-only and stop seeding a fake `INVENTORY` import job.
12. Docs: add the saved-reports endpoints to `API.md` and `refresh_tokens` to `DATABASE.md`.

### P2: quality

13. Refactor the largest components (`AnalyticsPage`, `CsvImportPanel`, `ProductsPage`,
    `DashboardPage`, `AppShell`) toward functions under 40 lines; refactor other files as they are touched.
14. Expand planner evals from 4 to about 15 cases (clarification, unsupported metric, refinement,
    filters, date phrases).
15. Replace `$executeRawUnsafe` in the drift-repair CLI with tagged `$executeRaw`.

### Accepted as-is

- The live Ollama provider is not exercised in CI by design (optional and documented). It is
  covered by mocked tests and shared schema validation.
- `console.warn` on CSV cleanup failure is intentional operational logging.
