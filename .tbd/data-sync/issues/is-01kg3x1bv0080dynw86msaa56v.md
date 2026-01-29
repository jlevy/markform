---
close_reason: null
closed_at: 2025-12-24T01:14:55.355Z
created_at: 2025-12-23T22:14:15.753Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:02.980Z
    original_id: markform-116
id: is-01kg3x1bv0080dynw86msaa56v
kind: bug
labels: []
parent_id: null
priority: 2
status: closed
title: "ARCH-014: Fix broken HTML comment rendering in process=false section"
type: is
updated_at: 2025-12-24T01:14:55.355Z
version: 1
---
The architecture doc has a rendering bug at lines 588-596 where a blockquote splits around an HTML comment example.

**Current (broken):**
```
> **Note:** Markdoc uses HTML comments (`
<!-- ... -->
`), not `{# ... #}`. HTML comments
> in form values are plain text...
```

**Fix to inline format:**
```
> **Note:** Markdoc uses HTML comments (`<!-- ... -->`), not `{# ... #}`. HTML comments in form values are plain text and don't require `process=false`.
```

**Files:**
- docs/project/architecture/current/arch-markform-design.md.md (lines 588-596)
