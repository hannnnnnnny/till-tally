# Saved analytics reports design

## Goal

Turn Ask TillTally results into repeatable workflows without storing prompts as executable instructions. Users can refine a validated plan, save versioned plans, manage their own saved reports inside the active business, and export the exact displayed table.

## Data model

- `SavedReport` owns the stable report identity, name, business, creator, and timestamps.
- `SavedReportVersion` owns an immutable validated analytics plan, schema version, plan source, version number, creator, and timestamp.
- A unique `(report_id, version)` constraint prevents duplicate history entries.
- Records cascade with their business, user, or parent report.

## API

All endpoints run behind bearer authentication and active-business membership middleware. Service lookups are scoped by both `businessId` and `userId`.

- `GET /api/analytics/saved-reports`
- `POST /api/analytics/saved-reports`
- `GET /api/analytics/saved-reports/:id`
- `PATCH /api/analytics/saved-reports/:id`
- `POST /api/analytics/saved-reports/:id/versions`
- `POST /api/analytics/saved-reports/:id/duplicate`
- `DELETE /api/analytics/saved-reports/:id`

Create and version endpoints parse plans through the shared strict analytics plan schema before persistence. Unsupported stored schema versions are returned as incompatible metadata and cannot be loaded for execution.

## Refinement

Planner requests may include `currentPlan`. The server validates it before it reaches either the local planner or provider prompt. Local refinements retain the existing plan and apply supported metric, grouping, date, row-limit, and chart changes. Provider refinements receive only the validated bounded plan, never database schema or executable code.

## Export

CSV is generated from the execution result currently rendered in the browser, so exported values cannot drift from the displayed table. Metadata is emitted as comment rows before the exact table header and rows. Formula-like cells are escaped to prevent spreadsheet formula injection.

## UI

The Analytics page adds a compact saved-report toolbar, lifecycle dialog, contextual refine mode, and CSV download action. Controls keep 44px targets and collapse cleanly at 375px without obscuring the result.
