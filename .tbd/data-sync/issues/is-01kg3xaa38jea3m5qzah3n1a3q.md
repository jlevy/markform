---
close_reason: null
closed_at: 2025-12-28T02:35:06.092Z
created_at: 2025-12-27T17:40:00.000Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:57.567Z
    original_id: markform-309
id: is-01kg3xaa38jea3m5qzah3n1a3q
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: "Phase 3: Implement runResearch() API"
type: is
updated_at: 2025-12-28T02:35:06.092Z
version: 1
---
Main research API implementation.

Spec: docs/project/specs/active/plan-2025-12-27-research-api-and-cli.md (Phase 3)

Create src/research/research.ts:

async function runResearch(options: FillOptions): Promise<ResearchResult>

Key design: Takes FillOptions directly (same as fillForm), NOT a separate ResearchOptions.
This avoids type duplication. Differences from fillForm() are behavioral:

1. Parse form if string (use parseForm)
2. Validate research form structure (validateResearchForm)
3. Validate model supports web search (isWebSearchModel from llms.ts)
4. Resolve harness config: resolveHarnessConfig('research', form.metadata?.harness, options)
5. Delegate to fillForm() with resolved config
6. Wrap result as ResearchResult with modelId and webSearchEnabled

If you don't want these validations, use fillForm() directly.

Create src/research/index.ts with public exports.
Integration tests with mock agent in tests/integration/research.test.ts.
