---
close_reason: null
closed_at: 2025-12-23T16:51:02.884Z
created_at: 2025-12-23T07:22:50.435Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:04.350Z
    original_id: markform-2v3
id: is-01kg3x1bv6b1mf8emkjwk0rpxk
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: Verify GitHub Actions CI passes
type: is
updated_at: 2025-12-23T16:51:15.926Z
version: 1
---
Push Phase 0 work and verify CI passes on GitHub Actions:

1. Commit and push all Phase 0 scaffolding to a branch
2. Create PR to trigger CI workflow
3. Use gh CLI to monitor CI run:
   - gh run list --limit 5
   - gh run watch <run-id>
   - gh run view <run-id> --log-failed (if fails)

4. Verify all CI steps pass:
   - pnpm install
   - pnpm lint
   - pnpm typecheck
   - pnpm build
   - pnpm publint
   - pnpm test

5. Fix any CI failures and re-verify

6. Merge PR to main when CI is green

This ensures the scaffolding works in a clean environment,
not just locally where caches and installed tools may mask issues.
