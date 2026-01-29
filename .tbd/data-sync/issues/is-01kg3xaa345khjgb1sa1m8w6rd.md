---
close_reason: null
closed_at: 2025-12-24T17:42:53.393Z
created_at: 2025-12-24T17:30:53.960Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:56.464Z
    original_id: markform-175
id: is-01kg3xaa345khjgb1sa1m8w6rd
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "[172.3] Update serialize.ts: Output new tag syntax"
type: is
updated_at: 2025-12-24T17:42:53.393Z
version: 1
---
**Parent:** markform-172
**Spec:** docs/project/specs/active/impl-2025-12-24-doc-block-syntax-simplification.md#phase-2

## Changes Required

### serialize.ts

Update `serializeDocBlock()` function:
```typescript
// Before
return \`{% doc \${attrStr} %}\\n\${doc.bodyMarkdown}\\n{% /doc %}\`;

// After  
return \`{% \${doc.tag} \${attrStr} %}\\n\${doc.bodyMarkdown}\\n{% /\${doc.tag} %}\`;
```

Remove `kind` from attrs since tag name now carries semantics.

## Files
- packages/markform/src/engine/serialize.ts (lines 429-437)

## Acceptance
- Serializes to `{% description %}`, `{% instructions %}`, `{% documentation %}` based on `tag` field
- Round-trip parse→serialize produces valid output
