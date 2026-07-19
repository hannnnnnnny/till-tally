# TillTally — API Design

> Status: Design draft (MVP) · Style: REST / JSON · Auth: JWT (Bearer)
> Source of truth for scope: [`TT.md`](../TT.md) §16. This document refines those endpoints into request/response contracts, error handling and security rules. Pairs with [`DATABASE.md`](./DATABASE.md).

---

## 1. Conventions

| Topic | Decision |
|---|---|
| Base URL | `/api` (versionable to `/api/v1` before public release) |
| Format | JSON request and response bodies; `Content-Type: application/json` (except CSV upload = `multipart/form-data`) |
| Auth | `Authorization: Bearer <accessToken>` on all routes except `register` / `login` |
| IDs | UUID strings |
| Dates | ISO-8601 (`2026-06-26`, or `…T00:00:00Z` for timestamps) |
| Money | JSON numbers with 2 decimals; computed server-side |
| Casing | `camelCase` in JSON bodies (DB is snake_case; mapped by Prisma) |
| Time zone | All timestamps UTC |

### 1.1 Multi-business scoping

Business-scoped read endpoints take the active business via **`X-Business-Id` header** (or `?businessId=` query). The server verifies membership before returning data (see [`DATABASE.md`](./DATABASE.md) §8). Missing/owned-by-someone-else → `403`.

### 1.2 Standard error envelope

Every non-2xx response uses one shape (global rule: errors must be specific):

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "order_date must be a valid ISO date",
    "details": [
      { "field": "order_date", "message": "Invalid date format", "row": 14 }
    ]
  }
}
```

| HTTP | `code` examples | When |
|---|---|---|
| 400 | `VALIDATION_ERROR`, `BAD_CSV_FORMAT` | Bad input / malformed CSV |
| 401 | `UNAUTHENTICATED`, `TOKEN_EXPIRED` | Missing/invalid/expired token |
| 403 | `FORBIDDEN`, `NO_BUSINESS_ACCESS` | Authenticated but not a member of the business |
| 404 | `NOT_FOUND` | Resource doesn't exist (or not visible to caller) |
| 409 | `EMAIL_TAKEN`, `DUPLICATE_ORDER` | Conflict with existing data |
| 413 | `FILE_TOO_LARGE` | CSV exceeds size limit |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | Upload is not text/csv |
| 422 | `IMPORT_FAILED` | File parsed but no valid rows |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Unexpected; never leak stack traces |

### 1.3 Pagination

List endpoints support `?page=1&pageSize=25` (max 100). Responses include a `meta` block:

```json
{ "data": [ ... ], "meta": { "page": 1, "pageSize": 25, "total": 342, "totalPages": 14 } }
```

---

## 2. Authentication

JWT with a short-lived **access token** (15 min) and a longer **refresh token** (7 days, httpOnly cookie recommended). Passwords hashed with bcrypt/argon2. Tokens and secrets come from environment variables only (global security rule).

### `POST /api/auth/register`
Create an account.
```jsonc
// Request
{ "name": "Jane Lee", "email": "jane@example.com", "password": "S3cure!pass" }
// 201 Created
{ "user": { "id": "uuid", "name": "Jane Lee", "email": "jane@example.com" },
  "accessToken": "jwt", "expiresIn": 900 }
```
Validation: name 1–120, email format + unique (`409 EMAIL_TAKEN`), password ≥ 8 chars with basic strength check.

### `POST /api/auth/login`
```jsonc
// Request
{ "email": "jane@example.com", "password": "S3cure!pass" }
// 200 OK
{ "user": { "id": "uuid", "name": "Jane Lee", "email": "jane@example.com" },
  "accessToken": "jwt", "expiresIn": 900 }
```
Wrong credentials → `401 UNAUTHENTICATED` (same message for unknown email vs wrong password — avoid user enumeration).

### `POST /api/auth/refresh`
Exchanges a valid refresh token (cookie) for a new access token. → `200` with new `accessToken`.

### `GET /api/auth/me`
Returns the current user. Requires Bearer token.
```jsonc
// 200 OK
{ "user": { "id": "uuid", "name": "Jane Lee", "email": "jane@example.com" } }
```

### `POST /api/auth/logout`
Invalidates the refresh token / clears cookie. → `204`.

---

## 3. Businesses

### `POST /api/businesses`
Create a workspace; the creator becomes `OWNER` (a `business_members` row is created in the same transaction).
```jsonc
// Request
{ "name": "Auckland Charity Store", "industry": "Retail", "city": "Auckland" }
// 201 Created
{ "id": "uuid", "name": "Auckland Charity Store", "industry": "Retail",
  "city": "Auckland", "role": "OWNER", "createdAt": "2026-06-26T00:00:00Z" }
```

### `GET /api/businesses`
List businesses the caller is a member of.
```jsonc
// 200 OK
{ "data": [ { "id": "uuid", "name": "Auckland Charity Store", "role": "OWNER" } ] }
```

### `GET /api/businesses/:id`
Single business. `403 NO_BUSINESS_ACCESS` if not a member; `404` if not found.

---

## 4. CSV Import

Uploads are `multipart/form-data` with a `file` field. Server validates **type** (`text/csv`), **size** (≤ 25 MB default), renames stored file, then parses rows. Each upload creates an `import_job`. See [`TT.md`](../TT.md) §10.3 / §23 and [`DATABASE.md`](./DATABASE.md) §5.8.

Processing model: parse → validate each row → insert valid rows → record failed rows in `error_summary`. For MVP this can run synchronously and return the finished job; large files may move to async (`status: PROCESSING`, poll the job).

### `POST /api/import/orders`
`multipart/form-data`: `file` = orders CSV (header per [`TT.md`](../TT.md) §17.1, optionally with order-item columns per §17.2).
```jsonc
// 201 Created (job result)
{
  "jobId": "uuid",
  "importType": "ORDERS",
  "status": "COMPLETED_WITH_WARNINGS",
  "rowsTotal": 350,
  "rowsImported": 342,
  "rowsFailed": 8,
  "errors": [
    { "row": 14, "column": "order_date", "message": "Invalid date format" },
    { "row": 51, "column": "order_number", "message": "Duplicate order number" }
  ],
  "warnings": [
    { "row": 88, "column": "sku", "message": "SKU \"ABC-123\" was not matched to a product" }
  ]
}
```

### `POST /api/import/products`
`multipart/form-data`: `file` = products CSV (header per [`TT.md`](../TT.md) §17.3). Same response shape; upserts by `(businessId, sku)`. Duplicate SKUs within the same CSV are skipped with a warning to avoid ambiguous overwrites.

Common import validations (see [`DATABASE.md`](./DATABASE.md) §9):
required columns present · valid date · numeric prices ≥ 0 · `quantity > 0` · SKU match (warn if missing) · duplicate order number (skip + warn) · unknown channel → `OTHER` + warn.

Failure modes: not CSV → `415`; > size limit → `413 FILE_TOO_LARGE`; zero valid rows → `422 IMPORT_FAILED`.

### `GET /api/import/jobs`
Import history for the active business (paginated, newest first).
```jsonc
// 200 OK
{ "data": [ { "id": "uuid", "fileName": "june_orders.csv", "importType": "ORDERS",
  "status": "COMPLETED_WITH_WARNINGS", "rowsTotal": 350, "rowsImported": 342,
  "rowsFailed": 8, "createdAt": "2026-06-26T03:21:00Z" } ],
  "meta": { "page": 1, "pageSize": 25, "total": 1, "totalPages": 1 } }
```

### `GET /api/import/jobs/:id`
Full job incl. structured `errorSummary` so the frontend can render/download an error report. `404` if not in the active business.
```jsonc
// 200 OK
{ "id": "uuid", "fileName": "june_orders.csv", "importType": "ORDERS",
  "status": "COMPLETED_WITH_WARNINGS", "rowsTotal": 350, "rowsImported": 342,
  "rowsFailed": 8, "createdAt": "2026-06-26T03:21:00Z",
  "errorSummary": { "errors": [], "warnings": [ { "row": 88, "column": "sku",
    "message": "SKU \"ABC-123\" was not matched to a product", "severity": "warning" } ] } }
```

---

## 5. Dashboard

All dashboard endpoints accept an optional date range `?from=YYYY-MM-DD&to=YYYY-MM-DD` (default: last 30 days). KPI math per [`TT.md`](../TT.md) §11.

### `GET /api/dashboard/summary`
Headline KPIs (the dashboard cards).
```jsonc
// 200 OK
{
  "range": { "from": "2026-05-27", "to": "2026-06-26" },
  "kpis": {
    "totalSales": 12450.50,
    "grossProfit": 5230.10,
    "grossMarginPct": 42.01,
    "orders": 318,
    "averageOrderValue": 39.15,
    "unitsSold": 642,
    "lowStockItems": 12,
    "slowMovers": 8
  }
}
```
`grossMarginPct = grossProfit / totalSales * 100`. `averageOrderValue = totalSales / orders`.

### `GET /api/dashboard/sales-trend`
Time series for the sales-trend chart. `?interval=day|week` (default `day`).
```jsonc
// 200 OK
{ "interval": "day",
  "points": [ { "date": "2026-06-01", "sales": 410.00, "orders": 11, "grossProfit": 168.4 } ] }
```

### `GET /api/dashboard/channel-breakdown`
Per-channel aggregation (channel analysis, [`TT.md`](../TT.md) §10.7).
```jsonc
// 200 OK
{ "channels": [
  { "channel": "SHOPIFY",  "revenue": 6800.00, "orders": 150, "averageOrderValue": 45.33, "grossMarginPct": 41.2, "unitsSold": 320 },
  { "channel": "TRADE_ME", "revenue": 3100.00, "orders": 60,  "averageOrderValue": 51.66, "grossMarginPct": 38.0, "unitsSold": 140 }
] }
```

---

## 5A. Analytics Builder

Analytics builder endpoints use the strict, versioned contracts from
`@till-tally/analytics-contracts`. All routes require a bearer access token and a verified
`X-Business-Id` membership. Business scope is always taken from middleware, never from the body.

### `POST /api/analytics/plan`

Translates a bounded natural-language question into a validated analytics plan. The deterministic
local planner handles common retail questions without a model. An optional server-side provider can
handle additional phrasing, but its output must pass the same strict schema before it is returned.

```json
{
  "question": "Show daily revenue this month",
  "timezone": "Pacific/Auckland",
  "currentPlan": null
}
```

For a follow-up refinement, `currentPlan` may contain the previously validated plan. The server
validates that context before it reaches a local or provider planner and retains unchanged settings.

A successful translation returns `status: "ready"`, a plan, and `source: "local"` or
`"provider"`. Ambiguous and unsupported requests return guided `clarification` or `unsupported`
results with examples instead of inventing fields. Invalid input returns
`400 INVALID_ANALYTICS_REQUEST`. Provider failures and timeouts safely fall back and never reach the
analytics executor.

### `POST /api/analytics/preview`

Validates a plan and returns its title, datasets, table columns and chart shape without reading
business data. Use this before execution to render a safe query preview.

```json
{
  "schemaVersion": 1,
  "metrics": ["revenue", "grossProfit"],
  "dimensions": ["day"],
  "dateRange": {
    "from": "2026-06-01",
    "to": "2026-06-30",
    "timezone": "Pacific/Auckland"
  },
  "filters": [],
  "sort": [{ "field": "day", "direction": "asc" }],
  "limit": 31,
  "chart": { "type": "line" }
}
```

Unknown keys, raw query fragments and unsupported metric/dimension combinations return
`400 INVALID_ANALYTICS_PLAN`.

### `POST /api/analytics/execute`

Validates and executes the same plan through allowlisted Prisma reads. The response contains
chart-ready series, tabular rows and bounded execution metadata:

```json
{
  "table": { "columns": [], "rows": [] },
  "chart": { "type": "line", "categoryKey": "day", "series": [] },
  "meta": {
    "rowCount": 0,
    "totalRows": 0,
    "truncated": false,
    "durationMs": 4,
    "executedAt": "2026-07-19T00:00:00.000Z"
  }
}
```

Execution is limited to a 366-day range, 100 result rows and a 5-second timeout. A timeout returns
`504 ANALYTICS_TIMEOUT` without exposing database or stack details.

### Saved analytics reports

Saved report routes retain validated plans rather than prompts, SQL, or executable code. Reports are
private to the authenticated user inside the verified active business; out-of-scope ids return the
same `404 SAVED_REPORT_NOT_FOUND` response as missing ids.

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/analytics/saved-reports` | List the current user's report library |
| `POST` | `/api/analytics/saved-reports` | Save a named validated plan as version 1 |
| `GET` | `/api/analytics/saved-reports/:id` | Load the latest plan and version metadata |
| `PATCH` | `/api/analytics/saved-reports/:id` | Rename without changing plan history |
| `POST` | `/api/analytics/saved-reports/:id/versions` | Append an immutable validated plan version |
| `POST` | `/api/analytics/saved-reports/:id/duplicate` | Copy the latest version into a new report |
| `DELETE` | `/api/analytics/saved-reports/:id` | Delete a report and all versions |

Stored versions include the plan schema version, source, creator and timestamps. A future or invalid
schema is returned with `compatible: false` and no executable plan. CSV exports are generated from
the displayed execution result so their headers and raw values match the exact-value table.

## 6. Products

### `GET /api/products/performance`
Product performance table ([`TT.md`](../TT.md) §10.5). Supports `?search=`, `?category=`, `?status=`, `?sort=revenue|unitsSold|grossMargin&order=desc`, pagination, and date range.
```jsonc
// 200 OK
{
  "data": [
    {
      "id": "uuid", "sku": "WJ-001", "name": "Women's Jacket",
      "category": "Women's Fashion", "vendor": "Local Supplier",
      "unitsSold": 24, "revenue": 2157.60, "cost": 912.00,
      "grossProfit": 1245.60, "grossMarginPct": 57.7,
      "abcClass": "A", "revenueContributionPct": 78.2,
      "cumulativeRevenuePct": 78.2,
      "currentStock": 3, "lastSoldAt": "2026-06-24",
      "labels": ["Best Seller", "High Margin", "Low Stock"]
    }
  ],
  "meta": { "page": 1, "pageSize": 25, "total": 120, "totalPages": 5 }
}
```
`labels` are computed by the analytics service from the rules in [`TT.md`](../TT.md) §21 (Best Seller, High Margin, Low Stock, Slow Mover, Dead Stock, Discount Candidate, Reorder Soon).

ABC fields are computed from ranked revenue contribution per [`TT.md`](../TT.md) section 11.4: A products cover roughly the first 80% of revenue, B products the next 15%, and C products the remaining long tail.

### `GET /api/products/:id`
Single product detail incl. recent sales and stock history. `404` if not in active business.

---

## 7. Inventory Insights

Inventory-risk logic per [`TT.md`](../TT.md) §11.5 / §11.6. Key formulas:
```text
dailySalesRate = unitsSoldLast30Days / 30
daysOfStockLeft = currentStock / dailySalesRate
```

### `GET /api/inventory/insights`
Grouped risk summary for the Inventory Insights page.

Query parameters:
- `to=YYYY-MM-DD` report date, defaults to today
- `lowStockThreshold=5`
- `slowMoverDays=60`
- `deadStockDays=90`
- `overstockDays=90`

```jsonc
// 200 OK
{
  "generatedAt": "2026-07-03",
  "salesWindow": { "from": "2026-06-04", "to": "2026-07-03", "days": 30 },
  "summary": {
    "lowStock": 2,
    "stockoutRisk": 1,
    "slowMovers": 1,
    "deadStock": 1,
    "reorderSoon": 1,
    "discountCandidates": 2,
    "overstocked": 1
  },
  "reorderSoon": [
    {
      "id": "uuid",
      "sku": "WJ-001",
      "name": "Women's Jacket",
      "currentStock": 3,
      "lastSoldAt": "2026-06-24",
      "unitsSoldLast30": 24,
      "dailySalesRate": 0.8,
      "daysOfStockLeft": 4,
      "labels": ["Low Stock", "Stockout Risk", "Reorder Soon"],
      "recommendation": "Reorder soon"
    }
  ],
  "lowStock": [ ... ],
  "stockoutRisk": [ ... ],
  "slowMovers": [ ... ],
  "deadStock": [ ... ],
  "discountCandidates": [ ... ],
  "overstocked": [ ... ]
}
```

### `GET /api/inventory/low-stock`
Flat, paginated list where `currentStock <= threshold`.

Query parameters:
- `threshold=5` alias for `lowStockThreshold`
- `to=YYYY-MM-DD` report date
- `page=1`
- `pageSize=20` (max 100)

```jsonc
// 200 OK
{
  "generatedAt": "2026-07-03",
  "salesWindow": { "from": "2026-06-04", "to": "2026-07-03", "days": 30 },
  "total": 12,
  "page": 1,
  "pageSize": 20,
  "items": [ ... ]
}
```

### `GET /api/inventory/slow-movers`
Products with stock that have not sold in `?days=60` (default 60; 90+ days are treated as dead stock in the grouped insights response).

Query parameters:
- `days=60` alias for `slowMoverDays`
- `to=YYYY-MM-DD` report date
- `page=1`
- `pageSize=20` (max 100)

```jsonc
// 200 OK
{
  "generatedAt": "2026-07-03",
  "salesWindow": { "from": "2026-06-04", "to": "2026-07-03", "days": 30 },
  "total": 8,
  "page": 1,
  "pageSize": 20,
  "items": [ ... ]
}
```

---

## 8. Reports

Weekly business report ([`TT.md`](../TT.md) §10.8, [`DATABASE.md`](./DATABASE.md) §5.9).

### `GET /api/reports/weekly`
Latest (or `?weekStart=YYYY-MM-DD`) report for the active business.
```jsonc
// 200 OK
{
  "id": "uuid", "weekStart": "2026-06-15", "weekEnd": "2026-06-21",
  "summary": "This week, total sales increased by 12% compared with last week. The best-performing category was Women's Fashion. 12 products are currently low in stock...",
  "salesChangePercent": 12.0, "topCategory": "Women's Fashion",
  "lowStockCount": 12, "slowMoverCount": 8
}
```

### `POST /api/reports/weekly/generate`
Generates (or regenerates, idempotent per `(business, weekStart)`) the report for a given week.
```jsonc
// Request
{ "weekStart": "2026-06-15" }
// 201 Created → same shape as GET above
```

---

## 9. Endpoint Summary

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | — | Create account |
| POST | `/api/auth/login` | — | Login |
| POST | `/api/auth/refresh` | cookie | Rotate access token |
| GET | `/api/auth/me` | ✓ | Current user |
| POST | `/api/auth/logout` | ✓ | Logout |
| POST | `/api/businesses` | ✓ | Create workspace |
| GET | `/api/businesses` | ✓ | List my businesses |
| GET | `/api/businesses/:id` | ✓ | Business detail |
| POST | `/api/import/orders` | ✓ + biz | Import orders CSV |
| POST | `/api/import/products` | ✓ + biz | Import products CSV |
| GET | `/api/import/jobs` | ✓ + biz | Import history |
| GET | `/api/import/jobs/:id` | ✓ + biz | Import job detail |
| GET | `/api/dashboard/summary` | ✓ + biz | KPI cards |
| GET | `/api/dashboard/sales-trend` | ✓ + biz | Sales time series |
| GET | `/api/dashboard/channel-breakdown` | ✓ + biz | Channel analysis |
| GET | `/api/products/performance` | ✓ + biz | Product performance table |
| GET | `/api/products/:id` | ✓ + biz | Product detail |
| GET | `/api/inventory/insights` | ✓ + biz | Grouped inventory risk |
| GET | `/api/inventory/low-stock` | ✓ + biz | Low-stock list |
| GET | `/api/inventory/slow-movers` | ✓ + biz | Slow-mover list |
| GET | `/api/reports/weekly` | ✓ + biz | Latest weekly report |
| POST | `/api/reports/weekly/generate` | ✓ + biz | Generate weekly report |

> "✓ + biz" = requires a valid access token **and** membership of the active business (`X-Business-Id`).

---

## 10. Security & Hardening

Aligned with [`TT.md`](../TT.md) §22 and global engineering security rules:

- **Authentication:** JWT; passwords hashed (bcrypt/argon2); secrets from env vars only — never hardcoded.
- **Authorisation / data isolation:** every business-scoped query filters by a verified `businessId`; membership checked on each request to prevent IDOR.
- **Input validation:** validate + sanitise all bodies, query params, and CSV rows (a schema validator such as Zod at the route boundary). Reject unknown fields.
- **File upload:** enforce content-type `text/csv`, size limit (≤ 25 MB), row-count cap, store with a generated filename (never the user-supplied name), strip path components.
- **SQL safety:** all DB access via Prisma (parameterised) — no string-concatenated SQL.
- **Rate limiting:** throttle `auth/*` (e.g. 10/min/IP) and uploads to limit brute force and abuse → `429 RATE_LIMITED`.
- **Transport & headers:** HTTPS in production; `helmet` security headers; CORS restricted to the known frontend origin.
- **No data leakage:** generic auth errors (no user enumeration); never return `password_hash`; no stack traces to clients (`500 INTERNAL_ERROR` only).
- **Privacy:** import only analytics-relevant fields; no customer PII stored (see [`DATABASE.md`](./DATABASE.md) §1).

---

## 11. Out of Scope (MVP)

Per [`TT.md`](../TT.md) §8 / §26: Shopify/Xero OAuth, real-time sync, payments, AI summaries, PDF/email export, multi-user RBAC endpoints. These will extend the API later (e.g. `/api/integrations/shopify`, `/api/reports/weekly/export`).
