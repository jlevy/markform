---
close_reason: null
closed_at: 2025-12-28T02:35:06.035Z
created_at: 2025-12-27T17:40:00.000Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:57.562Z
    original_id: markform-308
id: is-01kg3xaa38yy2twbdd5ghes0xk
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: "Phase 2.2: Create researchFormValidation.ts"
type: is
updated_at: 2025-12-28T02:35:06.035Z
version: 1
---
Validate form structure for research workflow.

Spec: docs/project/specs/active/plan-2025-12-27-research-api-and-cli.md (Phase 2)

Create src/research/researchFormValidation.ts:

- ResearchFormValidation interface:
  - valid: boolean
  - errors: string[], warnings: string[]
  - hasUserFields, hasAgentFields: boolean
  - userFieldCount, agentFieldCount: number
  - lastUserFieldIndex, firstAgentFieldIndex: number

- validateResearchForm(form: ParsedForm): ResearchFormValidation
  Checks:
  1. Frontmatter includes both 'user' and 'agent' roles
  2. At least one user-role field exists
  3. At least one agent-role field exists
  4. All user fields come before agent fields (no interleaving)
  Uses form.orderIndex to check field order.

- isResearchForm(form: ParsedForm): boolean
  Quick check - returns true if form appears valid for research.

Unit tests in tests/unit/research/researchFormValidation.test.ts.
