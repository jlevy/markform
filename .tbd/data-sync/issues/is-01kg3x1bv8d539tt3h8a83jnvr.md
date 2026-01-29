---
close_reason: null
closed_at: 2025-12-29T03:29:41.138Z
created_at: 2025-12-29T02:38:42.247Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:05.038Z
    original_id: markform-428
id: is-01kg3x1bv8d539tt3h8a83jnvr
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: "Parser: Accept only unified field syntax, reject legacy"
type: is
updated_at: 2025-12-29T03:29:41.138Z
version: 1
---
Modify `parseField()` in `packages/markform/src/engine/parseFields.ts`:

**Accept new syntax:**
- Check if `node.tag === 'field'`
- Read `kind` from `getStringAttr(node, 'kind')`
- Dispatch to existing `parseStringField()`, `parseNumberField()`, etc.

**Reject legacy tags with clear errors:**
- `{% field %}` without kind → `field tag missing required 'kind' attribute`
- `{% field kind="invalid" %}` → `field tag has invalid kind 'invalid'. Valid kinds: ...`
- `{% string-field %}` etc. → `Legacy field tag 'string-field' is no longer supported. Use {% field kind="string" %} instead`

**Use `FIELD_KINDS` from fieldRegistry.ts as canonical list**

**Files:** packages/markform/src/engine/parseFields.ts
