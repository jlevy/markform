---
close_reason: null
closed_at: null
created_at: 2026-01-06T17:57:49.403Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:05.711Z
    original_id: markform-572
id: is-01kg3x1bvf6remsq6rm0db6nhf
kind: task
labels: []
parent_id: null
priority: 1
status: open
title: Extract browseHelpers.ts from browse.ts
type: is
updated_at: 2026-01-06T17:57:49.403Z
version: 1
---
Extract testable helper functions from browse.ts to cli/lib/browseHelpers.ts. Functions to extract: isViewableFile, getExtension, scanFormsDirectory, getExtensionHint, formatFileLabel. This enables unit testing of ~130 lines that are currently untestable.
