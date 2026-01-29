---
close_reason: null
closed_at: 2025-12-29T03:29:41.138Z
created_at: 2025-12-29T02:38:39.493Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:05.021Z
    original_id: markform-425
id: is-01kg3x1bv838fc8mfe9k6j39hd
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: "Serializer: Output unified field tag syntax"
type: is
updated_at: 2025-12-29T03:29:41.138Z
version: 1
---
Update all `serializeXxxField()` functions in `packages/markform/src/engine/serialize.ts` to output:
- Tag name: `field` (instead of `string-field`, `number-field`, etc.)
- Add `kind` attribute with field kind value
- Closing tag: `{% /field %}`

**Key change:**
```markdown
# Before
{% string-field id="name" label="Name" %}{% /string-field %}

# After  
{% field kind="string" id="name" label="Name" %}{% /field %}
```

**Note:** Priority key sorting already done (`priorityKeyComparator(['kind', 'id', 'role'])`)

**Files:** packages/markform/src/engine/serialize.ts
