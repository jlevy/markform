---
close_reason: Implemented in commit 28b947a
closed_at: 2026-01-12T06:33:10.924Z
created_at: 2026-01-12T05:41:51.050Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:05.814Z
    original_id: markform-590
id: is-01kg3x1bvfp4njsem75ckpb8a0
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Update markform-spec.md with Alternative Tag Syntax section
type: is
updated_at: 2026-01-12T06:33:10.924Z
version: 1
---
## Task
Update `docs/markform-spec.md`:
- Add "Alternative Tag Syntax" section to Layer 1
- Document syntax mapping table
- Explain always-on behavior (no configuration)
- Document `-->` constraint in values
- Note that both syntaxes are equivalent

## Content to Add
```markdown
### Alternative Tag Syntax

Markform supports HTML comment syntax as an alternative to Markdoc tags.
This enables forms to render cleanly on GitHub and standard Markdown editors.

| Markdoc Form | Comment Form |
| --- | --- |
| `{% tag attr="val" %}` | `<!-- f:tag attr="val" -->` |
| `{% /tag %}` | `<!-- /f:tag -->` |
| `{% tag /%}` | `<!-- f:tag /-->` |
| `{% #id %}` | `<!-- #id -->` |

Both syntaxes are always supported. Files preserve their original syntax on round-trip.
```

## Files
- docs/markform-spec.md

## Depends On
- Phase 1 & 2 complete (implementation works)
