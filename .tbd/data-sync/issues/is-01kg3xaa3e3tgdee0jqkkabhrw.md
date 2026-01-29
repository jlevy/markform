---
close_reason: null
closed_at: 2025-12-23T17:24:31.749Z
created_at: 2025-12-23T16:44:05.605Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:59.074Z
    original_id: markform-72
id: is-01kg3xaa3e3tgdee0jqkkabhrw
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "CLI-REVIEW: Audit CLI against typescript-cli-tool-rules.md best practices"
type: is
updated_at: 2025-12-23T17:32:58.455Z
version: 1
---
## Objective
Review all CLI implementation files against docs/general/agent-rules/typescript-cli-tool-rules.md best practices.

## Files to Review
- packages/markform/src/cli/cli.ts
- packages/markform/src/cli/lib/shared.ts
- packages/markform/src/cli/lib/formatting.ts
- packages/markform/src/cli/commands/inspect.ts
- packages/markform/src/cli/commands/export.ts
- packages/markform/src/cli/commands/serve.ts
- packages/markform/src/cli/commands/apply.ts
- packages/markform/src/cli/commands/run.ts

## Checklist (from typescript-cli-tool-rules.md)

### Color and Output Formatting
- [ ] Uses picocolors (aliased as pc) for all colors
- [ ] No hardcoded ANSI escape codes
- [ ] Has shared color utilities

### Commander.js Patterns  
- [ ] Has colored help wrapper (withColoredHelp)
- [ ] Has CommandContext with dryRun, verbose, quiet
- [ ] Has logDryRun helper with details support
- [ ] Supports --dry-run, --verbose, --quiet global options

### Progress and Feedback
- [ ] Consider using @clack/prompts for interactive UI
- [ ] Consistent emoji usage (✅, ❌, ⚠️, ⏰, 🧪)

### Timing and Performance
- [ ] Display timing for long operations

### Documentation
- [ ] File-level comments describing purpose
- [ ] Help text on commands and options

## Reference
docs/general/agent-rules/typescript-cli-tool-rules.md
