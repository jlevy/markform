---
close_reason: null
closed_at: 2025-12-24T01:52:28.023Z
created_at: 2025-12-24T01:50:52.239Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:03.146Z
    original_id: markform-148
id: is-01kg3x1bv1mf7xdywnebdfqzjf
kind: bug
labels: []
parent_id: null
priority: 1
status: closed
title: Fix release workflow pnpm version conflict in CI
type: is
updated_at: 2025-12-24T01:52:28.023Z
version: 1
---
## Problem

The release workflow (.github/workflows/release.yml) fails with:
```
Error: Multiple versions of pnpm specified:
  - version 10 in the GitHub Action config with the key "version"
  - version pnpm@10.26.1 in the package.json with the key "packageManager"
```

## Solution

Remove the `version: 10` from `pnpm/action-setup@v4` in release.yml to match the pattern used in ci.yml. This lets pnpm/action-setup read the version from package.json's `packageManager` field.

## Files to Modify
- .github/workflows/release.yml
