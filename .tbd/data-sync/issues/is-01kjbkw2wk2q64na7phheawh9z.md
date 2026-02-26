---
type: is
id: is-01kjbkw2wk2q64na7phheawh9z
title: Implement prompt sanitization and frontmatter stripping in liveAgent harness
kind: task
status: closed
priority: 1
version: 6
spec_path: docs/project/specs/active/plan-2026-02-25-skip-sentinel-handling.md
labels: []
dependencies:
  - type: blocks
    target: is-01kjbkw68dra8qypjg9b0gwjvm
  - type: blocks
    target: is-01kjbkw9jgvpxqkt9pjsgf7yr3
  - type: blocks
    target: is-01kjbkwn6h7mzsnm41ewxkkvgm
parent_id: is-01kjb5skdwf67zr8153cy2sncb
created_at: 2026-02-25T23:59:11.761Z
updated_at: 2026-02-26T04:15:21.389Z
closed_at: 2026-02-26T04:15:21.388Z
close_reason: Implemented prompt sanitizer + frontmatter stripping in liveAgent prompt builders
---
Apply prompt-only transforms in packages/markform/src/harness/liveAgent.ts for buildSystemPrompt/buildContextPrompt: sanitize %SKIP%/%ABORT% literals in model-visible text and strip YAML frontmatter from embedded serialized-form markdown.
