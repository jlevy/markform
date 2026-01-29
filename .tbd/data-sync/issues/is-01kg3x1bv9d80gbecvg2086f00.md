---
close_reason: null
closed_at: 2026-01-01T22:42:32.968Z
created_at: 2025-12-31T09:07:46.634Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:05.277Z
    original_id: markform-480
id: is-01kg3x1bv9d80gbecvg2086f00
kind: bug
labels: []
parent_id: null
priority: 2
status: closed
title: Lint all files including scripts and examples
type: is
updated_at: 2026-01-01T22:42:32.968Z
version: 1
---
## Problem

`eslint.config.js` ignores several file patterns that should be linted:

```js
// Temporarily ignore examples until types are fully defined
'**/examples/**/*.ts',
// Scripts use optional dependencies (ai, @ai-sdk/anthropic) and console
'**/scripts/**/*.ts',
'**/scripts/**/*.mjs',
```

## Root Causes

### 1. Files not in tsconfig (type-checked linting fails)
- `packages/markform/examples/**/*.ts` - not in package tsconfig `include`
- `scripts/**/*.ts` (root) - no tsconfig covers these files

Error: `was not found by the project service. Consider either including it in the tsconfig.json or including it in allowDefaultProject`

### 2. MJS files need Node globals
`packages/markform/scripts/regenerate-session-hashes.mjs` errors with `'console' is not defined` because no `globals.node` config.

### 3. Package scripts work fine
`packages/markform/scripts/*.ts` ARE in tsconfig and lint correctly (only minor style issues).

## Files Affected

**Examples (tsconfig issue):**
- `packages/markform/examples/earnings-analysis/earnings-analysis.valid.ts`

**Root scripts (no tsconfig):**
- `scripts/create-changeset.ts`
- `scripts/git-version.ts`

**MJS (needs globals):**
- `packages/markform/scripts/regenerate-session-hashes.mjs`

## Fix Options

### Option A: Extend tsconfig includes
1. Add `examples` to `packages/markform/tsconfig.json` include
2. Create `scripts/tsconfig.json` for root scripts
3. Add Node globals config for `.mjs` files in eslint.config.js

### Option B: Use allowDefaultProject
Configure ESLint `allowDefaultProject` for files outside tsconfig coverage.

### Option C: Non-type-checked rules for these files
Add eslint config block that applies non-type-checked rules to scripts/examples.

## Recommended Approach

Option A is cleanest - include all TS files in tsconfig coverage:

1. Add `"examples"` to `packages/markform/tsconfig.json` include array
2. Create `scripts/tsconfig.json`:
   ```json
   {
     "extends": "./tsconfig.base.json",
     "compilerOptions": { "noEmit": true },
     "include": ["scripts"]
   }
   ```
3. Add eslint config for `.mjs` files with Node globals
4. Remove the ignores from eslint.config.js
5. Fix any lint errors (mostly trivial - Array<T> style, stale disable comments)
