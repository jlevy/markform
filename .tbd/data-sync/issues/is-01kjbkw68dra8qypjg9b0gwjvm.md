---
type: is
id: is-01kjbkw68dra8qypjg9b0gwjvm
title: Add unit tests for wire-level prompt contract in liveAgent
kind: task
status: closed
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-02-25-skip-sentinel-handling.md
labels: []
dependencies: []
parent_id: is-01kjb5skdwf67zr8153cy2sncb
created_at: 2026-02-25T23:59:15.212Z
updated_at: 2026-02-26T04:15:21.391Z
closed_at: 2026-02-26T04:15:21.390Z
close_reason: Added liveAgent wire-level unit tests for sentinel sanitization and frontmatter omission
---
Extend packages/markform/tests/unit/harness/liveAgent.test.ts to assert: no %SKIP%/%ABORT% literals in model-visible system/context text, frontmatter omitted from embedded form markdown, and role guidance remains present.
