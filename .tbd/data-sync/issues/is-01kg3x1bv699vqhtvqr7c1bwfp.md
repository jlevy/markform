---
close_reason: null
closed_at: 2025-12-28T06:55:22.427Z
created_at: 2025-12-28T03:52:35.374Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:04.520Z
    original_id: markform-326
id: is-01kg3x1bv699vqhtvqr7c1bwfp
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "Phase 0: Add FileType type and detectFileType() helper"
type: is
updated_at: 2025-12-28T06:55:22.427Z
version: 1
---
Add to settings.ts:

```typescript
export type FileType = 'form' | 'raw' | 'report' | 'yaml' | 'json' | 'unknown';

export function detectFileType(filePath: string): FileType {
  if (filePath.endsWith(ALL_EXTENSIONS.form)) return 'form';
  if (filePath.endsWith(ALL_EXTENSIONS.raw)) return 'raw';
  if (filePath.endsWith(ALL_EXTENSIONS.report)) return 'report';
  if (filePath.endsWith(ALL_EXTENSIONS.yaml)) return 'yaml';
  if (filePath.endsWith(ALL_EXTENSIONS.json)) return 'json';
  if (filePath.endsWith('.md')) return 'raw';
  return 'unknown';
}
```

Location: packages/markform/src/settings.ts
