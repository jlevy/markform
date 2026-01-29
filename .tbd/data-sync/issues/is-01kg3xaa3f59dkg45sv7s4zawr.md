---
close_reason: null
closed_at: 2025-12-23T16:36:41.355Z
created_at: 2025-12-23T07:18:36.219Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:59.346Z
    original_id: markform-ejt
id: is-01kg3xaa3f59dkg45sv7s4zawr
kind: epic
labels: []
parent_id: null
priority: 1
status: closed
title: "Phase 0: Project Scaffolding"
type: is
updated_at: 2025-12-23T16:41:39.884Z
version: 1
---
Set up pnpm monorepo with all tooling configured.

Deliverables:
- Initialize pnpm workspace structure
- Create root package.json with workspace scripts
- Create pnpm-workspace.yaml
- Create .npmrc with workspace settings
- Create tsconfig.base.json with shared TypeScript config
- Create packages/markform/ directory structure
- Create package package.json with exports, dependencies, scripts
- Create tsdown.config.ts for build
- Create tsconfig.json extending base
- Create eslint.config.js (flat config)
- Set up .changeset/ for versioning
- Create .github/workflows/ci.yml
- Create placeholder src/index.ts
- Create initial test file
- Verify pnpm build, test, lint all pass

Checkpoints:
- pnpm build passes
- pnpm test passes
- pnpm lint passes
- pnpm typecheck passes
