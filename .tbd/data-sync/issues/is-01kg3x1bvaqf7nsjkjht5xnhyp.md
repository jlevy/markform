---
close_reason: null
closed_at: 2025-12-31T21:05:36.696Z
created_at: 2025-12-31T20:29:19.977Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:05.308Z
    original_id: markform-486
id: is-01kg3x1bvaqf7nsjkjht5xnhyp
kind: task
labels: []
parent_id: null
priority: 3
status: closed
title: Set up automated coverage badge updates
type: is
updated_at: 2025-12-31T21:05:36.696Z
version: 1
---
The current coverage badge in README.md is static. To make it update automatically:

Options:
1. **Codecov integration** - Add codecov-action and use their badge
2. **coverage-badges-action** - Requires GitHub Gist token setup
3. **Custom workflow** - Push badge to a dedicated branch

Current static badge: 51% (yellow)

This is optional polish - the PR comments provide dynamic coverage visibility.
