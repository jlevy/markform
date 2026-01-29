---
close_reason: null
closed_at: 2025-12-28T06:55:22.427Z
created_at: 2025-12-28T03:52:47.773Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:57.682Z
    original_id: markform-328
id: is-01kg3xaa39m4j25s02rnpwb09g
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "Phase 0: Update exportHelpers.ts to use EXPORT_EXTENSIONS"
type: is
updated_at: 2025-12-28T06:55:22.427Z
version: 1
---
Update deriveExportPaths() in exportHelpers.ts:

Current code (lines 117-118):
```typescript
rawPath: basePath.replace(/\.form\.md$/, '.raw.md'),
yamlPath: basePath.replace(/\.form\.md$/, '.yml'),
```

Should use deriveExportPath() from settings.ts instead.

Location: packages/markform/src/cli/lib/exportHelpers.ts
