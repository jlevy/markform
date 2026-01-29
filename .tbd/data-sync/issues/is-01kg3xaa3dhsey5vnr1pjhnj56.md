---
close_reason: null
closed_at: null
created_at: 2026-01-12T05:39:58.819Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:58.977Z
    original_id: markform-581
id: is-01kg3xaa3dhsey5vnr1pjhnj56
kind: feature
labels: []
parent_id: null
priority: 1
status: open
title: "HTML Comment Syntax Support (f: namespace)"
type: is
updated_at: 2026-01-12T05:39:58.819Z
version: 1
---
## Summary
Implement HTML comment syntax (`<!-- f:tag -->`) as an alternative to Markdoc's Jinja-style tags (`{% tag %}`). This enables Markform files to render cleanly on GitHub and standard Markdown editors.

## Syntax Mapping (Option C)
| Markdoc Form | Comment Form |
| --- | --- |
| `{% tag attr="val" %}` | `<!-- f:tag attr="val" -->` |
| `{% /tag %}` | `<!-- /f:tag -->` |
| `{% tag /%}` | `<!-- f:tag /-->` |
| `{% #id %}` | `<!-- #id -->` |
| `{% .class %}` | `<!-- .class -->` |

## Key Features
- Always-on preprocessor (no configuration needed)
- Both syntaxes always supported transparently
- Preserve original syntax on round-trip serialization
- Code block awareness (skip transformation inside code)

## References
- Plan Spec: docs/project/specs/active/plan-2026-01-12-html-comment-syntax-support.md
- Research Brief: docs/project/research/current/research-html-comment-syntax-alternatives.md

## Implementation Phases
1. Core Preprocessor (parsing support)
2. Serialization Support (round-trip)
3. Documentation Updates
4. CLI Conversion Utility (optional)
