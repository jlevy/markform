---
close_reason: null
closed_at: 2025-12-28T05:24:01.190Z
created_at: 2025-12-27T17:40:00.000Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:04.454Z
    original_id: markform-319
id: is-01kg3x1bv67cj0sx8q2daqz73m
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Update src/index.ts public exports
type: is
updated_at: 2025-12-28T05:24:01.190Z
version: 1
---
Export new research module types and llms utilities.

Spec: docs/project/specs/active/plan-2025-12-27-research-api-and-cli.md

Update src/index.ts:

From './llms.js':
- hasWebSearchSupport, isWebSearchModel, getWebSearchProviders
- formatWebSearchModels, SUGGESTED_LLMS

From './research/index.js':
- runResearch, ResearchResult
- ResearchFormValidation, validateResearchForm, isResearchForm

Note: No ResearchOptions export needed - runResearch takes FillOptions.
No runResearchFromFile - file I/O handled at CLI layer.
