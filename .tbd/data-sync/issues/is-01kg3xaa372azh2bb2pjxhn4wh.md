---
close_reason: null
closed_at: 2025-12-27T00:36:10.080Z
created_at: 2025-12-27T00:10:22.761Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:57.261Z
    original_id: markform-256
id: is-01kg3xaa372azh2bb2pjxhn4wh
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Extract standalone specification from architecture doc
type: is
updated_at: 2025-12-27T00:36:10.080Z
version: 1
---
Split arch-markform-design.md.md into two documents:

1. **markform-spec.md** - Standalone normative specification containing:
   - Condensed overview
   - Terminology/glossary
   - Layer 1: Syntax (file format, tags, checkbox modes, serialization)
   - Layer 2: Form Data Model (types, Zod schemas, summaries)
   - Layer 3: Validation & Form Filling (rules, hook validators, error taxonomy)
   - Layer 4: Tool API (operations, patches, result types, priority scoring)

2. **arch-markform-design.md.md** (revised) - Implementation details:
   - Motivation with spec references
   - Architecture overview (simplified, refs spec)
   - v0.1 Scope
   - Core Architecture
   - Implementation Components (harness, CLI, web UI, AI SDK, MCP, testing)
   - NPM Package, Golden Examples, Implementation Order
   - Future Extensions, Design Decisions

Key changes:
- Spec uses normative language (MUST/SHOULD/MAY)
- Architecture doc adds spec references, removes duplicated content
- Consolidate scattered engine implementation details
- Cross-link between documents

Estimated: Spec ~1500-1800 lines, Architecture ~2800-3000 lines (from ~4600)
