---
close_reason: null
closed_at: 2025-12-26T23:40:19.125Z
created_at: 2025-12-24T17:08:17.060Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:03.317Z
    original_id: markform-172
id: is-01kg3x1bv1qh0cpwf3x49c4692
kind: feature
labels: []
parent_id: null
priority: 2
status: closed
title: "Simplify doc block syntax: description/instructions/documentation tags"
type: is
updated_at: 2025-12-26T23:40:19.125Z
version: 1
---
## Summary
Simplify the documentation block syntax by using distinct tag names instead of a generic `doc` tag with a `kind` attribute.

**Implementation Spec:** docs/project/specs/active/impl-2025-12-24-doc-block-syntax-simplification.md

## Current Syntax
```
{% doc ref="x" kind="description" %}...{% /doc %}
{% doc ref="x" kind="instructions" %}...{% /doc %}
```

## New Syntax
```
{% description ref="x" %}...{% /description %}
{% instructions ref="x" %}...{% /instructions %}
{% documentation ref="x" %}...{% /documentation %}
```

## Semantic Distinction
- **description**: Brief, declarative statement of what something is
- **instructions**: Action-oriented guidance for filling a field
- **documentation**: General information, workflow context, data sources

## Type Changes (Option B)
```typescript
interface DocumentationBlock {
  tag: "description" | "instructions" | "documentation";
  ref: string;
  bodyMarkdown: string;
}
```

## Implementation Phases
1. Core types and parser (types.ts, parse.ts)
2. Serializer (serialize.ts)
3. Migrate example files (11 .form.md files)
4. Update tests and verify
