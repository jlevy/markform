---
type: is
id: is-01kjbkwn6h7mzsnm41ewxkkvgm
title: Validate sentinel round-trip and required-field skip invariants in harness workflows
kind: task
status: closed
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-02-25-skip-sentinel-handling.md
labels: []
dependencies:
  - type: blocks
    target: is-01kjbkwrsp749dzf0c8rm670yv
parent_id: is-01kjb5skdwf67zr8153cy2sncb
created_at: 2026-02-25T23:59:30.512Z
updated_at: 2026-02-26T04:15:21.388Z
closed_at: 2026-02-26T04:15:21.386Z
close_reason: Added harness integration invariants for sentinel round-trip and required-field skip rejection
---
Add/extend tests proving parse->serialize->parse sentinel round-trip is unchanged and required-field skip rejections still fire, including a golden session path that exercises harness flow end-to-end.
