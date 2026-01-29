---
close_reason: null
closed_at: 2025-12-28T06:55:22.427Z
created_at: 2025-12-28T03:52:28.687Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:04.515Z
    original_id: markform-325
id: is-01kg3x1bv6d17az71neh2wm7s0
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "Phase 0: Add EXPORT_EXTENSIONS constant to settings.ts"
type: is
updated_at: 2025-12-28T06:55:22.427Z
version: 1
---
Add file extension constants to settings.ts:

```typescript
export const EXPORT_EXTENSIONS = {
  form: '.form.md',
  raw: '.raw.md',
  yaml: '.yml',
  json: '.json',
} as const;

export const REPORT_EXTENSION = '.report.md' as const;

export const ALL_EXTENSIONS = {
  ...EXPORT_EXTENSIONS,
  report: REPORT_EXTENSION,
} as const;
```

Location: packages/markform/src/settings.ts
