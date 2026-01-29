---
close_reason: null
closed_at: 2025-12-30T00:18:01.496Z
created_at: 2025-12-29T23:59:00.874Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:58.420Z
    original_id: markform-468
id: is-01kg3xaa3bfzgxx7sjn2nhdqkn
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: Refactor examples command to copy-only
type: is
updated_at: 2025-12-30T00:18:01.496Z
version: 1
---
Refactor `markform examples` to be copy-only (no interactive flow).

**New Behavior:**
```bash
markform examples              # Copy all bundled examples to ./forms/
markform examples --list       # List bundled examples (no copy)
markform examples --name=foo   # Copy specific example only
```

**Changes:**
- Remove all p.confirm() prompts
- Remove interactive fill/run flow (moved to `run` command)
- Use --overwrite flag for file conflict handling
- Log each file copied with checkmark
- End with: "Done. Run 'markform run' to try one."

**Files:**
- packages/markform/src/cli/commands/examples.ts

**Ref:** markform-462
