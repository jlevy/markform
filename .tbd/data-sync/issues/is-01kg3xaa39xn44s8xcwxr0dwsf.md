---
close_reason: null
closed_at: 2025-12-28T06:55:22.427Z
created_at: 2025-12-28T03:52:41.747Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:57.677Z
    original_id: markform-327
id: is-01kg3xaa39xn44s8xcwxr0dwsf
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "Phase 0: Add deriveExportPath() and deriveReportPath() helpers"
type: is
updated_at: 2025-12-28T06:55:22.427Z
version: 1
---
Add to settings.ts:

```typescript
export function deriveExportPath(basePath: string, format: keyof typeof EXPORT_EXTENSIONS): string {
  let base = basePath;
  for (const ext of Object.values(ALL_EXTENSIONS)) {
    if (base.endsWith(ext)) {
      base = base.slice(0, -ext.length);
      break;
    }
  }
  return base + EXPORT_EXTENSIONS[format];
}

export function deriveReportPath(basePath: string): string {
  let base = basePath;
  for (const ext of Object.values(ALL_EXTENSIONS)) {
    if (base.endsWith(ext)) {
      base = base.slice(0, -ext.length);
      break;
    }
  }
  return base + REPORT_EXTENSION;
}
```

Location: packages/markform/src/settings.ts
