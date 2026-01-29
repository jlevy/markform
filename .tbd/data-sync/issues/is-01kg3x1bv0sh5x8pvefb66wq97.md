---
close_reason: null
closed_at: 2025-12-23T21:42:05.353Z
created_at: 2025-12-23T21:16:32.913Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:02.928Z
    original_id: markform-107
id: is-01kg3x1bv0sh5x8pvefb66wq97
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Update documentation for fill command and live agent
type: is
updated_at: 2025-12-23T21:42:05.353Z
version: 1
---
Update all documentation to reflect the new fill command and live agent support.

**Architecture Doc** (`arch-markform-design.md.md`):
- Replace all `run` references with `fill`
- Update CLI command table (7 commands)
- Add `--agent` and `--model` documentation
- Update Live Mode section with actual implementation
- Add model ID format documentation (`provider/model-name`)
- Document short name resolution

**Development Guide** (`development.md`):
- Update CLI usage examples with `fill` command
- Add live agent setup instructions
- Document provider package installation
- Add API key environment variable reference

**README**:
- Update quick start with `fill` command
- Add live agent example
- Document supported models

**Validation Spec** (`valid-2025-12-22-markform-v01-implementation.md`):
- Update test commands from `run` to `fill`
- Add live agent manual testing section

**Part of:** markform-101 (fill command)
