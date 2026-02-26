---
type: is
id: is-01kjbkwgm1q8j5dw3zypkz2zx5
title: Extend golden validation mutations for sentinel/frontmatter prompt leakage
kind: task
status: closed
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-02-25-skip-sentinel-handling.md
labels: []
dependencies:
  - type: blocks
    target: is-01kjbkwrsp749dzf0c8rm670yv
parent_id: is-01kjb5skdwf67zr8153cy2sncb
created_at: 2026-02-25T23:59:25.824Z
updated_at: 2026-02-26T04:15:21.388Z
closed_at: 2026-02-26T04:15:21.387Z
close_reason: Extended golden mutation checks for sentinel and frontmatter leakage
---
Update packages/markform/tests/golden/validation.test.ts to detect wire prompt regressions: injected %SKIP% literals and leading YAML frontmatter markers in model-visible context.
