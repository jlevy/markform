---
close_reason: null
closed_at: 2025-12-24T01:34:00.130Z
created_at: 2025-12-23T23:23:09.116Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:03.117Z
    original_id: markform-142
id: is-01kg3x1bv1pj02esnkw3mtdp2f
kind: task
labels: []
parent_id: null
priority: 3
status: closed
title: Remove single-letter CLI flags except -o
type: is
updated_at: 2025-12-24T01:34:00.130Z
version: 1
---
## Problem

Single-letter flags are confusing and should be avoided in most cases. The CLI currently has several short flags that should be removed:

- `-f` for `--format` - confusing, could mean `--file` or `--force`
- `-h` for `--help` - standard but unnecessary given `--help` is clear
- `-V` for `--version` - unnecessary

## Keep

- `-o` for `--output` - this is ubiquitous and can stay

## Files to Update

- `packages/markform/src/cli/commands/*.ts` - Remove short flag definitions from Commander option declarations
- Update any tests that use short flags

## Implementation

Search for `.option('-f'`, `.option('-h'`, `.option('-V'` patterns and remove the short flag portion, keeping only the long form.
