---
close_reason: null
closed_at: 2025-12-23T15:02:59.222Z
created_at: 2025-12-23T07:19:04.224Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:06.156Z
    original_id: markform-ja8
id: is-01kg3x1bvgfmpeda0d66ep535c
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: Initialize pnpm workspace structure
type: is
updated_at: 2025-12-23T15:03:22.051Z
version: 1
---
Initialize pnpm workspace following research-modern-typescript-monorepo-package.md:

Root package.json:
- name: markform-workspace
- private: true
- packageManager: pnpm@10.26.1
- engines: { node: '>=24' }
- Scripts: build, test, lint, typecheck, publint, changeset, version-packages, release

pnpm-workspace.yaml:
- packages: ['packages/*']

.npmrc:
- save-workspace-protocol=true
- prefer-workspace-packages=true

tsconfig.base.json (per research doc):
- target: ES2024
- lib: ['ES2024']
- module: ESNext
- moduleResolution: Bundler
- strict: true
- noUncheckedIndexedAccess: true
- verbatimModuleSyntax: true
- skipLibCheck: true
- forceConsistentCasingInFileNames: true

Ref: docs/project/research/current/research-modern-typescript-monorepo-package.md
