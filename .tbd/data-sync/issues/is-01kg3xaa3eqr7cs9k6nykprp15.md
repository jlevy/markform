---
close_reason: null
closed_at: 2025-12-23T19:51:06.647Z
created_at: 2025-12-23T19:30:30.367Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:59.176Z
    original_id: markform-84
id: is-01kg3xaa3eqr7cs9k6nykprp15
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "CLI serve: auto-open browser by default with --no-open flag to disable"
type: is
updated_at: 2025-12-23T19:51:06.647Z
version: 1
---
The serve command should automatically open the localhost URL in the user's default browser when the server starts.

**Current behavior:**
- Server starts and prints URL
- User must manually open browser and navigate to URL

**Desired behavior:**
- Server starts and automatically opens default browser to the URL
- Add `--no-open` flag to disable auto-open (for headless/CI environments)

**Implementation approach:**
Use the `open` npm package (cross-platform) or Node's native mechanisms to open the default browser. This is the standard pattern used by:
- Convex CLI
- Vite dev server
- Create React App
- Next.js dev server

**Files to update:**
- `src/cli/commands/serve.ts` - add browser open logic and `--no-open` flag

Note: The command already has `--no-open` defined but may not be wired up. Verify and implement.
