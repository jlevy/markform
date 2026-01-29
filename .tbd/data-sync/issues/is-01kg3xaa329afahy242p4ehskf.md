---
close_reason: null
closed_at: 2025-12-23T21:21:09.090Z
created_at: 2025-12-23T21:16:10.631Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:56.045Z
    original_id: markform-106
id: is-01kg3xaa329afahy242p4ehskf
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Wire up live agent mode in fill command
type: is
updated_at: 2025-12-23T21:21:09.090Z
version: 1
---
Connect LiveAgent to the fill command for `--agent=live` mode.

**Changes to `fill.ts`:**
1. Parse `--model` flag using `lib/models.ts`
2. Resolve short model names to full IDs
3. Create model instance via `createModel()`
4. Instantiate `LiveAgent` with model
5. Run harness loop with live agent
6. Display real-time progress (turn number, issues remaining)
7. Record session transcript
8. Write output using versioned filename or `-o` path

**Flow:**
```
fill.ts
  → parseModelId / resolveShortName (lib/models.ts)
  → createModel (lib/models.ts) 
  → new LiveAgent (harness/liveAgent.ts)
  → harness.step() / harness.apply() loop
  → versioned output (cli/lib/versioning.ts)
```

**Error handling:**
- Model not found → list similar models
- Provider not installed → show install command
- API key missing → show env var name

**Manual testing:**
- `markform fill examples/simple/simple.form.md --agent=live`
- Verify form fills correctly with real LLM

**Part of:** markform-101 (fill command)
