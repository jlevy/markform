---
close_reason: null
closed_at: 2026-01-02T06:09:17.942Z
created_at: 2026-01-02T06:02:41.972Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:05.462Z
    original_id: markform-512
id: is-01kg3x1bva7ybfd5487xvwn50w
kind: feature
labels: []
parent_id: null
priority: 2
status: closed
title: Expose serializeReportMarkdown in public API and document it
type: is
updated_at: 2026-01-02T06:09:17.942Z
version: 1
---
The serializeReportMarkdown(form: ParsedForm) function exists in serialize.ts:1507 but is only used internally by the CLI. It should be exported from the public API (index.ts) so library users can generate clean markdown reports programmatically.

Tasks:
1. Export serializeReportMarkdown from index.ts alongside serialize
2. Add documentation to markform-apis.md explaining the function and its use case
3. Consider whether SerializeReportOptions should also be exposed (currently uses defaults)
