---
close_reason: null
closed_at: 2025-12-23T21:21:09.090Z
created_at: 2025-12-23T21:15:14.653Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:56.028Z
    original_id: markform-103
id: is-01kg3xaa32f78dgam9wmk4hcxa
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Create fill command replacing run command
type: is
updated_at: 2025-12-23T21:21:09.090Z
version: 1
---
Create the new `fill` command to replace `run`, with support for both mock and live agent modes.

**Location:** `cli/commands/fill.ts`

**New flags:**
- `--agent <type>` - Agent type: `mock` | `live` (default: `live`)
- `--model <id>` - Model ID (format: `provider/model-name`, default: `anthropic/claude-sonnet-4-5`)
- `--completed-mock <file>` - Required for `--agent=mock`
- `-o, --output <file>` - Output file (default: versioned filename)
- Existing flags: `--record`, `--max-turns`, `--max-patches`, `--max-issues`

**Changes:**
1. Copy `run.ts` to `fill.ts`
2. Add `--agent` flag with validation
3. Add `--model` flag (ignored for mock mode)
4. Use versioning.ts for default output filename
5. Update CLI registration in `cli.ts`
6. Delete `run.ts`
7. Update tests to use `fill` command

**Error handling:**
- `--agent=mock` without `--completed-mock` shows helpful error
- `--agent=live` without API key shows helpful error (deferred to live agent impl)

**Part of:** markform-101 (fill command)
