---
close_reason: null
closed_at: 2025-12-28T02:32:57.755Z
created_at: 2025-12-27T17:40:00.000Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:04.383Z
    original_id: markform-305
id: is-01kg3x1bv6atwb9aacxhdg26nh
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: "Phase 1.3: Update parseForm() to populate metadata from frontmatter"
type: is
updated_at: 2025-12-28T02:32:57.755Z
version: 1
---
Currently parseForm() extracts frontmatter but discards it. Update to populate FormMetadata.

Spec: docs/project/specs/active/plan-2025-12-27-research-api-and-cli.md (Phase 1)

Update src/engine/parse.ts parseForm():
1. Parse frontmatter YAML properly (use yaml package)
2. Extract markform.spec -> markformVersion
3. Extract markform.roles -> roles (default: ['user', 'agent'])
4. Extract markform.role_instructions -> roleInstructions
5. Extract markform.harness -> harness config (FrontmatterHarnessConfig)
6. Return metadata in ParsedForm

Note: Current extractFrontmatter() is very basic - may need yaml package for proper parsing.
