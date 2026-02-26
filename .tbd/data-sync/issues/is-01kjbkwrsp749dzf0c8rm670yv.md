---
type: is
id: is-01kjbkwrsp749dzf0c8rm670yv
title: Update Markform docs for dual-surface contract (serialization sentinels vs patch ops)
kind: task
status: open
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-02-25-skip-sentinel-handling.md
labels: []
dependencies:
  - type: blocks
    target: is-01kjb5sqn1mkzkqeem098dtam3
parent_id: is-01kjb5skdwf67zr8153cy2sncb
created_at: 2026-02-25T23:59:34.198Z
updated_at: 2026-02-25T23:59:53.406Z
---
Document that sentinels remain valid serialization artifacts, AI agents must use skip_field/abort_field, and model-visible context omits YAML frontmatter.
