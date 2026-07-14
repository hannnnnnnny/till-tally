# GitHub Pages Deployment Safety Design

## Goal

Publish a reliable static TillTally portfolio preview on GitHub Pages without implying that
GitHub Pages hosts the Express API or PostgreSQL database. Preserve the existing browser-router,
same-origin API behavior used by local development and the Ubuntu Docker deployment.

## Architecture

The Vite build exposes a small runtime configuration derived from environment variables. Normal
builds use `BrowserRouter`, restore authentication through the same-origin `/api` proxy, and keep
all current full-stack behavior. The GitHub Pages build sets `VITE_STATIC_PREVIEW=true`; this uses
`HashRouter`, skips authentication network calls, and replaces login actions with an interactive
preview and deployment guidance.

GitHub Pages remains a client-only portfolio surface. The production application remains the
Docker Compose stack described in `docs/DEPLOYMENT.md`.

## Deployment Flow

Pull requests run CI and never deploy. A merge to `main` runs CI first. The Pages workflow is
triggered by the completed `CI` workflow and deploys only when that run succeeded. Manual deploys
remain available through `workflow_dispatch` and are constrained by the existing `github-pages`
environment branch policy.

The Pages build receives:

- `VITE_BASE_PATH=/<repository>/`
- `VITE_STATIC_PREVIEW=true`

Superseded Pages runs are cancelled, jobs have a finite timeout, and deployment actions are pinned
to full commit SHAs.

## User Experience

- Opening `https://hannnnnnnny.github.io/till-tally/` keeps the browser inside that project path.
- Client-side navigation uses hash URLs, so reloads do not produce GitHub Pages 404 responses.
- The deployed page does not call `/api/auth/refresh` during startup.
- Calls to action say `Explore the preview` and move to the dashboard preview section without
  conflicting with hash routing.
- The demo section labels the public build as static and links to deployment instructions instead
  of presenting credentials or a broken login button.
- Favicon and logo assets resolve beneath Vite's configured base path.

## Security Properties

- No API, database, JWT, or production credentials are added to the Pages workflow.
- Pages deployment is gated by a successful CI result from `main`.
- Workflow permissions remain read-only except for Pages and OIDC deployment permissions.
- Third-party GitHub Actions are pinned to immutable commits.

## Verification

- Unit tests cover runtime mode selection, API availability, base-path asset URLs, and workflow
  gating.
- The complete format, Prisma validation, lint, typecheck, test, and build suite must pass.
- A local Pages-mode production build is served beneath `/till-tally/` and checked at desktop and
  375px mobile viewports, including section navigation, a page reload, direct auth-route handling,
  and the absence of `/api` requests.
