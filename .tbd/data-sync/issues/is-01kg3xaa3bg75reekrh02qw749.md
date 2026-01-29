---
close_reason: null
closed_at: 2025-12-30T00:18:01.496Z
created_at: 2025-12-29T23:59:15.898Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:58.425Z
    original_id: markform-469
id: is-01kg3xaa3bg75reekrh02qw749
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: Implement run command with menu and auto-detect
type: is
updated_at: 2025-12-30T00:18:01.496Z
version: 1
---
Create new `markform run` command as the interactive form launcher.

**Usage:**
```bash
markform run                   # Browse forms, select, run
markform run movie.form.md     # Run specific form directly
markform run --limit=50        # Override menu limit
```

**Flow (no argument):**
1. Scan --forms-dir for *.form.md files
2. If none found: helpful message pointing to `markform examples`
3. Sort: mtime desc, then alphabetically
4. Limit to MAX_FORMS_IN_MENU (30)
5. Display menu with title, [type] badge, relative time
6. Parse selected form
7. Determine run mode (explicit > inferred)
8. Execute: interactive/fill/research workflow

**Run Mode Determination:**
- Use determineRunMode() from runMode.ts
- Explicit run_mode from frontmatter takes precedence
- Fallback: all user→interactive, all agent→fill/research
- Mixed roles without run_mode → error with guidance

**Files:**
- packages/markform/src/cli/commands/run.ts (new)
- packages/markform/src/cli/cli.ts (register)
- packages/markform/src/cli/lib/runMode.ts (determineRunMode)

**Ref:** markform-462
