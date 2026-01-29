---
close_reason: null
closed_at: 2025-12-24T06:51:09.865Z
created_at: 2025-12-24T06:18:05.479Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:03.203Z
    original_id: markform-152
id: is-01kg3x1bv1pcq6d2k8tps5qqf9
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Create example content modules (src/cli/examples/)
type: is
updated_at: 2025-12-24T06:51:09.865Z
version: 1
---
Create the example content modules that export form content as string constants.

Files to create:
- src/cli/examples/simple.ts - Export SIMPLE_FORM_CONTENT from existing simple.form.md
- src/cli/examples/earnings-analysis.ts - Export EARNINGS_ANALYSIS_CONTENT from existing form
- src/cli/examples/political-research.ts - Export POLITICAL_RESEARCH_CONTENT (depends on form being created)
- src/cli/examples/index.ts - EXAMPLES registry array with ExampleDefinition interface

Interface:
interface ExampleDefinition {
  id: string;
  title: string;
  description: string;
  filename: string;
  content: string;
}
