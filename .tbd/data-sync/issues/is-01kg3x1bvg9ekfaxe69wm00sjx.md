---
close_reason: null
closed_at: 2025-12-23T15:02:59.222Z
created_at: 2025-12-23T07:19:04.960Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:06.202Z
    original_id: markform-mus
id: is-01kg3x1bvg9ekfaxe69wm00sjx
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: Create markform package structure
type: is
updated_at: 2025-12-23T15:03:22.053Z
version: 1
---
Create packages/markform/ with full structure per research doc:

package.json:
- name: markform
- version: 0.1.0
- type: module
- sideEffects: false
- main: ./dist/index.cjs
- module: ./dist/index.js
- types: ./dist/index.d.ts
- exports with proper ESM/CJS dual support (types first!)
- bin: { markform: ./dist/bin.js }
- files: ['dist']
- engines: { node: '>=24' }
- Scripts: build, dev, typecheck, test, publint, prepack

tsdown.config.ts:
- entry: { index, bin }
- format: ['esm', 'cjs']
- platform: node
- target: node24
- sourcemap: true
- dts: true
- clean: true
- banner for shebang on bin.*

tsconfig.json:
- extends: ../../tsconfig.base.json
- compilerOptions: { types: ['node'], noEmit: true }
- include: ['src']

Directory structure:
- src/engine/
- src/cli/
- src/harness/
- src/integrations/
- src/web/
- src/index.ts
- tests/unit/
- tests/golden/

Ref: docs/project/research/current/research-modern-typescript-monorepo-package.md (Appendix A, D)
