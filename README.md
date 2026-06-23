# StreamVault

StreamVault is a full-stack entertainment tracker for Movies, TV, and Anime with:
- React + TypeScript + Vite frontend
- ASP.NET Core 8 API backend
- JWT auth + user-scoped libraries
- Real-time discovery + recommendation flows

This README is intentionally detailed and documents:
1. What the project does
2. How it is structured
3. How AI was used to build and fix it
4. Which prompts were used to drive implementation
5. How to run, test, and validate

## 1) Product Overview

StreamVault solves three workflows:
- Discover: trending/popular/search with multi-source metadata
- Decide: rich detail pages (ratings, cast, watch providers, similar items)
- Track: personal status library (watchlist, watching, completed, on-hold, dropped, liked)

Primary routes:
- Auth: `/auth`
- App shell: `/app/:userKey`
- Discover: `/app/:userKey`
- Library: `/app/:userKey/library/:status`
- Activity: `/app/:userKey/activity`
- API status: `/app/:userKey/status`
- Details: `/content/:type/:id`

## 2) Repository Layout

- `streamvault/streamvault-api/StreamVault.Api`:
  ASP.NET Core API, controllers, EF Core DbContext, migrations, external API service clients.
- `streamvault/streamvault-api/StreamVault.Tui`:
  terminal UI client.
- `streamvault-frontend`:
  React app and UI system.

Notable frontend modules:
- `src/layout/AppShell.tsx`: top bar, search overlay, mobile nav.
- `src/pages/DiscoverPage.tsx`: search and discovery entry.
- `src/pages/LibraryPage.tsx`: user state tracking and filters.
- `src/pages/ContentDetailsPage.tsx`: long-form details + episodes + similar.
- `src/index.css`: global visual language + responsive tuning.

## 3) Architecture Summary

### Frontend
- React 19 + TypeScript
- Vite 8 build tooling
- Framer Motion for transitions
- Tailwind CSS v4 utilities plus custom CSS primitives

### Backend
- .NET 8 Web API
- EF Core migrations
- JWT auth flow
- API integrations for TMDB/Jikan and related data providers

### Data flow
1. User authenticates (`/api/auth/*`) and token is stored in localStorage.
2. Frontend requests data via relative `/api/*` URLs.
3. Vite proxy forwards requests to API (default backend target on localhost).
4. API normalizes external payloads into frontend-safe DTOs.

## 4) AI-Assisted Build and Fix Process

This project was built and refined with AI-driven iteration loops:
- Requirement prompt
- Code change
- Build/lint/test
- Viewport QA
- Patch regressions

### AI implementation strategy used
- Keep most responsive fixes centralized in `src/index.css`.
- Add narrow, named hooks in components/pages for safe targeted overrides.
- Verify every significant change with:
  - `get_errors` diagnostics
  - frontend `npm run build`
  - screenshot validation at edge mobile viewports.

### Prompt patterns that were used to build/fix
These are representative user prompts used to drive implementation:

```text
fix all the issues with mobile version spacing and alignment everything line by line check and fix it in one go
```

```text
yes (second pass for ultra-small widths and landscape mode)
```

```text
yes do for every pages section everything
```

```text
add scroll bar to every ppage for mobile version
```

```text
it should be invisible
```

### Why this matters
The prompts above were converted into deterministic code changes, verified against:
- 280x653 portrait
- 667x375 landscape
across Discover, Library, Activity, Status, and Details routes.

## 5) Interactive Style System (In Depth)

The UI intentionally uses cinematic visual language:
- glass surfaces (`.glass-card`, `.premium-panel`)
- layered backdrop gradients and scrims
- compact mobile typography variants
- content rail affordances and overlay controls

Design primitives in `src/index.css`:
- Surface and color tokens under `@theme`
- shared component classes (`.premium-panel`, `.section-heading`, `.btn-*`)
- mobile-specific overrides under `@media (max-width: 640px)`
- ultra-narrow and low-height landscape handling for edge devices

Interaction patterns:
- horizontal rails for cast/similar/episode navigation
- mobile search full-screen overlay in `AppShell`
- action groups that collapse to full-width buttons on small screens
- modal surfaces with constrained internal scrolling (`PersonProfileModal`)

## 6) Mobile Responsiveness Work Completed

Completed fixes include:
- app-shell spacing and bottom nav density tuning
- details-page action row and similar/cast scrollers
- discover/library/activity/status section compression on tiny widths
- auth page small-height and narrow-width stabilization
- hidden-but-enabled mobile scrollbar behavior (scroll works, bar invisible)

Important details fix:
- additional details-page bottom safe-area padding to prevent visual cutoff at
  "You Might Also Like" on small devices.

## 7) Setup and Run

### Prerequisites
- Node.js 18+
- npm 9+
- .NET SDK 8+

### Backend
```powershell
cd streamvault/streamvault-api/StreamVault.Api
dotnet restore
dotnet build
dotnet run
```

### Frontend
```powershell
cd streamvault-frontend
npm install
npm run dev -- --host 127.0.0.1 --port 4173
```

### Build frontend
```powershell
npm run build
```

## 8) Test Cases Added and Executed

### Added test framework
Frontend unit tests now use:
- Vitest
- jsdom environment

### Added files
- `streamvault-frontend/src/test/setup.ts`
- `streamvault-frontend/src/api/http.test.ts`
- `streamvault-frontend/src/api/discoverApi.test.ts`
- `streamvault-frontend/src/api/libraryApi.test.ts`
- `streamvault-frontend/vitest.config.ts`

### Test coverage added
`http.test.ts` verifies:
1. `authHeader` outputs expected Authorization headers
2. `get` returns JSON for successful responses
3. `get` surfaces API JSON errors correctly
4. `get` falls back to status-based error for non-JSON bodies
5. `get` handles 401 by clearing auth storage and dispatching `auth-expired`
6. `silent401` path preserves storage and suppresses global auth-expired behavior

`discoverApi.test.ts` verifies:
1. query-string building for search wrappers
2. auth token forwarding for liked recommendations
3. similar-content item mapping + empty fallback behavior
4. watch-provider endpoint path generation with country filter
5. helper behavior for image URLs and content labels

`libraryApi.test.ts` verifies:
1. library filter query-string generation
2. upsert payload forwarding for save/update flows
3. remove path generation by `contentId`
4. activity/stats wrapper calls including `silent401` options

### Run tests
```powershell
cd streamvault-frontend
npm test
```

Latest verification (local):
- Test files: 3 passed
- Tests: 20 passed
- Command: `npm test`

## 9) CI Workflow (Auto on Every Push)

GitHub Actions workflows added at:
- `.github/workflows/frontend-ci.yml` (frontend validation)
- `.github/workflows/backend-ci.yml` (backend validation)

Trigger:
- every `push`
- every `pull_request`

Frontend checks executed on each push and PR:
1. lint job: `npm ci` then `npm run lint`
2. build job: `npm ci` then `npm run build`
3. test job: `npm ci` then `npm test`

Backend checks executed on each push and PR:
1. restore: `dotnet restore`
2. build: `dotnet build --configuration Release`

CI runtime targets:
- Frontend: Ubuntu latest + Node 20
- Backend: Ubuntu latest + .NET SDK 8.x

Current lint policy note:
- The frontend lint job is configured as non-blocking (`continue-on-error`) because the repository has pre-existing hook-rule lint debt outside this test/CI change set.
- Frontend build and test jobs remain blocking.
- Backend restore and build jobs are blocking.

## 10) Useful Commands

Frontend quality checks:
```powershell
cd streamvault-frontend
npm run lint
npm run build
npm test
```

Backend checks:
```powershell
cd streamvault/streamvault-api/StreamVault.Api
dotnet restore
dotnet build
```

## 11) Known Runtime Notes

- If frontend is up but backend is down, details/status/library pages may show fallback/loading/error states due to `/api/*` proxy failures.
- Protected app routes require token/userKey in storage. For local UI QA, valid auth flow or seeded storage values are needed.

## 12) Next Recommended Enhancements

- Add component-level tests for critical page states (loading/error/empty/content).
- Add Playwright E2E route smoke tests for mobile breakpoints.

---

Maintained with AI-assisted iterative development, with every major UI pass validated by build diagnostics and viewport QA.
