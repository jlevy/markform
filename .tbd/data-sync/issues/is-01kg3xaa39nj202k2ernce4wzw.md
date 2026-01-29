---
close_reason: null
closed_at: 2025-12-28T07:03:34.408Z
created_at: 2025-12-28T03:53:39.924Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:57.718Z
    original_id: markform-335
id: is-01kg3xaa39nj202k2ernce4wzw
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "Phase 2: Create serializeReportMarkdown() function"
type: is
updated_at: 2025-12-28T07:03:34.408Z
version: 1
---
Add serializeReportMarkdown(form, options) to serialize.ts:

Function should:
1. Accept filter options for which tags to include
2. Reuse field rendering logic from serializeRawMarkdown()
3. Skip elements where report=false
4. Default: instructions blocks have report=false, all else report=true

Interface:
```typescript
interface ReportOptions {
  includeInstructions?: boolean;  // default: false
}

export function serializeReportMarkdown(form: ParsedForm, options?: ReportOptions): string;
```

Location: packages/markform/src/engine/serialize.ts
