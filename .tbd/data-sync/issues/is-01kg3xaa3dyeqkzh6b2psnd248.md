---
close_reason: browseHelpers.ts extracted to src/cli/lib/browseHelpers.ts
closed_at: 2026-01-29T06:35:21.750Z
created_at: 2026-01-06T17:57:49.403Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:58.926Z
    original_id: markform-572
id: is-01kg3xaa3dyeqkzh6b2psnd248
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: Extract browseHelpers.ts from browse.ts
type: is
updated_at: 2026-01-29T06:35:21.755Z
version: 2
---
Extract testable helper functions from browse.ts to cli/lib/browseHelpers.ts. Functions to extract: isViewableFile, getExtension, scanFormsDirectory, getExtensionHint, formatFileLabel. This enables unit testing of ~130 lines that are currently untestable.
