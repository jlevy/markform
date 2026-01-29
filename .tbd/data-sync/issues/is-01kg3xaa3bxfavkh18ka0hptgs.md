---
close_reason: null
closed_at: 2025-12-29T04:40:22.726Z
created_at: 2025-12-29T04:26:48.962Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:58.234Z
    original_id: markform-433
id: is-01kg3xaa3bxfavkh18ka0hptgs
kind: feature
labels: []
parent_id: null
priority: 1
status: closed
title: "Custom tool injection: additionalTools and required enableWebSearch"
type: is
updated_at: 2025-12-29T04:40:22.726Z
version: 1
---
Implement documentation reorganization per plan-2025-12-28-docs-reorganization.md

**Spec:** docs/project/specs/active/plan-2025-12-28-docs-reorganization.md

**Summary:**
- Move DOCS.md → docs/markform-reference.md
- Move SPEC.md → docs/markform-spec.md  
- Create docs/markform-apis.md
- Add `markform apis` CLI command
- Update all references and package.json

**Phases:**
1. Move DOCS.md and SPEC.md to docs/
2. Update CLI commands (docs.ts, spec.ts, new apis.ts)
3. Update README and other references
4. Create markform-apis.md content
5. Update markform-reference.md (add apis link, remove API section)
6. Verification and testing
