---
close_reason: null
closed_at: 2026-01-04T01:57:20.542Z
created_at: 2026-01-02T23:36:02.641Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:05.496Z
    original_id: markform-518
id: is-01kg3x1bva57ngq3z6kygc8ccf
kind: feature
labels: []
parent_id: null
priority: 2
status: closed
title: "tryscript: Add cwd option to run commands from package directory"
type: is
updated_at: 2026-01-04T01:57:20.542Z
version: 1
---
The `bin` config in tryscript sets `binPath` but never uses it. Commands run in a temp directory which breaks relative paths.

**Current behavior:**
- Commands run in `/tmp/tryscript-xxx/`
- Relative paths like `examples/simple.form.md` don't work
- Have to use absolute paths everywhere

**Proposed solution:**
Add a `cwd` option that specifies the working directory for commands:

```yaml
---
cwd: .  # Run from test file's directory
---
$ ./dist/bin.mjs inspect examples/simple/simple.form.md
```

**Implementation:**
In `executeCommand`, use `ctx.cwd ?? ctx.tempDir` instead of just `tempDir`.

Reference: docs/project/specs/active/plan-2026-01-02-tryscript-cli-testing.md
