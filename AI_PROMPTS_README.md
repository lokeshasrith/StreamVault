# AI Prompts README

This document captures practical prompts you can reuse to build, audit, and fix this project with an AI coding assistant.

It is based on the real workflow used for StreamVault fixes across:
- Backend (.NET API)
- Frontend (React + Vite)
- TUI app (Terminal.Gui)
- End-to-end verification

## How To Use These Prompts

1. Copy a prompt block.
2. Paste it into your AI coding assistant chat.
3. Keep project-specific paths, ports, and requirements updated.
4. Ask the assistant to run commands and verify results (not just suggest code).

## 1) Full Project Audit Prompt

Use this first when you want an issue inventory.

```text
Audit this entire project from frontend to backend and TUI. Find all critical, high, medium, and low issues.

Scope:
- Backend: streamvault/streamvault-api/StreamVault.Api
- Frontend: streamvault-frontend
- TUI: streamvault/streamvault-api/StreamVault.Tui/StreamVault.Tui

Deliverables:
1) Prioritized issue list (critical -> low)
2) Root cause for each issue
3) Exact file paths affected
4) Proposed fix plan in safe order

Constraints:
- Do not make changes yet.
- Focus on functional bugs, API mismatches, auth, routing, data contracts, and deployment config.
```

## 2) Critical Fixes Prompt (One-Go)

Use this to apply blocking fixes directly.

```text
Fix all critical and high-priority issues in one go across backend, frontend, and TUI.

Requirements:
- Implement code changes directly.
- Keep changes minimal and safe.
- Preserve existing architecture.
- After edits, run relevant tests/builds and report results.

Must verify:
- API starts and listens on the configured port.
- Frontend can reach backend via proxy.
- Authentication flow works.
- Library CRUD works end-to-end.
```

## 3) Backend Configuration + Auth Prompt

Use this when startup/auth is broken in non-dev environments.

```text
Fix backend production-readiness issues:

1) Ensure appsettings.json includes valid JWT section keys.
2) Ensure database connection path works from flexible working directories.
3) Remove anti-pattern service resolution (reflection/service locator), use constructor DI.
4) Add meaningful logging for external/proxy failures.

Then run:
- dotnet build WatchList.sln
- Start API and confirm health by checking authenticated endpoints.
```

## 4) Frontend Routing + Library State Prompt

Use this when library pages show inconsistent counts/cards.

```text
Fix library routing/filtering state issues in the frontend.

Bug pattern to check:
- Status counters show data, but list grid is empty for some routes.
- Route includes /library/all but filtering treats all as a literal status.

Requirements:
1) Support /library/all as no-status-filter behavior.
2) Keep status chip/card active state accurate for each item.
3) Preserve existing UI and API contract.
4) Run frontend tests after changes.

Run:
- npm run test -- --run
```

## 5) TUI API Contract Prompt

Use this when TUI operations fail against API routes.

```text
Align TUI API calls with backend endpoints and DTO contracts.

Focus:
- Delete library operation must call backend route format exactly.
- Verify method signatures and call sites match backend expectations.
- Keep UX flow unchanged.

Then build solution and confirm no compile errors.
```

## 6) End-to-End Verification Prompt

Use this after fixes to prove real functionality.

```text
Run full E2E verification in one flow:
1) Start backend
2) Start frontend
3) Register user
4) Login
5) Add content to library
6) Verify content appears in library
7) Change status
8) Remove content
9) Confirm final API state is consistent

Report:
- What passed
- What failed
- Screens or page states observed
- Exact follow-up fix if anything failed
```

## 7) Warning Cleanup Prompt

Use this to clean compiler warnings without changing behavior.

```text
Clean all build warnings safely.

Constraints:
- No functional behavior changes.
- Apply minimal null-safety/layout-safety fixes.
- Rebuild and report warning count before/after.

Run:
- dotnet build WatchList.sln
```

## 8) Documentation Prompt

Use this to keep setup/docs aligned with fixes.

```text
Create or update environment/setup docs to match current code and ports.

Include:
- Required env vars
- Local run commands
- Port mappings
- Common troubleshooting for auth/proxy/database
```

## Example Master Prompt (Single Message)

```text
Fix this full-stack project end-to-end in one go.

Project:
- .NET API backend
- React frontend
- Terminal TUI client

Tasks:
1) Audit and list critical/high issues.
2) Implement all critical/high fixes.
3) Build and test frontend/backend.
4) Run E2E user flow (register/login/library CRUD).
5) Fix any regression found during verification.
6) Return final report with changed files and validation evidence.

Important:
- Do not stop at analysis.
- Make real code changes.
- Verify with commands and runtime checks.
```

## Prompt Writing Tips That Worked Well

- Ask for prioritized severity output first.
- Require execution + verification, not suggestions only.
- Specify file scopes and expected route formats.
- Ask for final evidence (tests/build/runtime checks).
- Include regression check steps in the same request.

## Related Project Docs

- [README.md](README.md)
- [DEPLOYMENT.md](DEPLOYMENT.md)
- [ENVIRONMENT_SETUP.md](ENVIRONMENT_SETUP.md)
