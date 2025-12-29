# Plan Spec: Node-Free Core Library

## Purpose

Make the markform core library (engine, harness, integrations) free of Node.js
dependencies so it can be used in browser, edge runtime, and other non-Node environments
without polyfills.

## Background

Markform is designed as a TypeScript library with both API consumers and CLI users.
The CLI naturally requires Node.js for filesystem operations, but the core engine APIs
(`parseForm`, `serialize`, `applyPatches`, etc.)
should be pure TypeScript that works anywhere.

Currently, two Node.js imports have leaked into the core library entry points:

1. `src/index.ts` - Uses `node:module` to read VERSION from package.json

2. `src/settings.ts` - Uses `node:path` for a CLI-only function (`getFormsDir`)

This blocks use of markform in environments like:

- Browser-based form editors

- Edge runtimes (Cloudflare Workers, Vercel Edge)

- React Native applications

- Other TypeScript runtimes (Deno, Bun without Node compat)

### Current Node.js Usage Analysis

**Complete audit of `node:*` imports in `src/`:**

| File | Node APIs | Purpose | Actually Used By |
| --- | --- | --- | --- |
| `src/index.ts:8` | `node:module` | Read VERSION from package.json | CLI only |
| `src/settings.ts:9` | `node:path` | `getFormsDir()` function | CLI only |
| `src/cli/bin.ts` | `node:fs`, `node:path` | CLI entry point | CLI |
| `src/cli/commands/*.ts` | `node:fs`, `node:path`, `node:http`, `node:child_process`, `node:url` | Various CLI commands | CLI |
| `src/cli/lib/*.ts` | `node:fs`, `node:path`, `node:child_process` | CLI utilities | CLI |
| `src/cli/examples/*.ts` | `node:fs`, `node:path`, `node:url` | Example loading | CLI |

**Key insight**: All CLI code is already properly isolated in `src/cli/`. The only
“leaks” are in `index.ts` and `settings.ts`.

### Import Chain Analysis

The problematic import chain that causes bundler failures in non-Node environments:

```
markform (index.ts)
  └─ import { createRequire } from 'node:module'  ❌
  └─ export { fillForm } from './harness/programmaticFill.js'
       └─ import { AGENT_ROLE, ... } from '../settings.js'
            └─ import { resolve } from 'node:path'  ❌
```

This means even importing `fillForm` or type definitions brings in Node.js dependencies,
blocking use in Convex, Cloudflare Workers, browsers, etc.

## Summary of Task

Reorganize the codebase to ensure:

1. **Core library exports** (`index.ts`, engine, harness, integrations) have zero
   Node.js dependencies

2. **CLI code** (`src/cli/`) can freely use Node.js

3. **Clean module boundary** between Node-dependent and pure TypeScript code

Specific changes:

1. Move `getFormsDir()` from `settings.ts` to a CLI-only location

2. Replace runtime `package.json` reading with build-time VERSION injection

3. Verify no other Node.js leaks exist

## Backward Compatibility

**BACKWARD COMPATIBILITY REQUIREMENTS:**

- **Code types, methods, and function signatures**: DO NOT MAINTAIN — Hard cut.

- **Library APIs**: DO NOT MAINTAIN — Hard cut.
  `VERSION` export continues to work but implementation changes.

- **Server APIs**: N/A — No server component.

- **File formats**: N/A — No format changes.

- **Database schemas**: N/A — No database component.

## Stage 1: Planning Stage

### Feature Requirements

**Core Requirements:**

1. Remove `node:module` import from `src/index.ts`

2. Remove `node:path` import from `src/settings.ts`

3. `VERSION` export continues to work correctly

4. All existing tests pass

5. CLI continues to work exactly as before

**Module Organization Goal:**

```
src/
├── engine/          # Pure TypeScript - parsing, serialization, validation
├── harness/         # Pure TypeScript - form filling orchestration
├── research/        # Pure TypeScript - research form handling
├── integrations/    # Pure TypeScript - Vercel AI SDK tools
├── index.ts         # Pure TypeScript - main library export
├── settings.ts      # Pure TypeScript - constants only (no functions with Node deps)
├── llms.ts          # Pure TypeScript - LLM configuration
└── cli/             # Node.js allowed - all CLI functionality
    ├── bin.ts
    ├── cli.ts
    ├── commands/
    ├── examples/
    └── lib/
        └── paths.ts  # NEW: Node-dependent path utilities
```

**Out of Scope:**

- Changing package structure or exports

- Adding new public APIs

- Changing how the CLI works

- Browser/edge runtime testing (that’s a separate validation task)

### Acceptance Criteria

1. `grep -r "from 'node:" src/` returns ONLY files in `src/cli/`

2. `npm run build` succeeds

3. `npm test` passes

4. `markform --version` shows correct version

5. Core imports work without Node.js (verified by inspection)

## Stage 2: Architecture Stage

### Change 1: Move `getFormsDir()` to CLI

**Current location**: `src/settings.ts:120-123`

```typescript
import { resolve } from 'node:path';
// ... other code ...
export function getFormsDir(override?: string, cwd: string = process.cwd()): string {
  const formsDir = override ?? DEFAULT_FORMS_DIR;
  return resolve(cwd, formsDir);
}
```

**Problem**: `settings.ts` is imported by engine code for constants, bringing
`node:path` into the core library.

**Solution**: Create `src/cli/lib/paths.ts` for Node-dependent path utilities.

**Files to modify:**

| File | Change |
| --- | --- |
| `src/settings.ts` | Remove `node:path` import, remove `getFormsDir()` |
| `src/cli/lib/paths.ts` | NEW: Add `getFormsDir()` with `node:path` |
| `src/cli/commands/fill.ts` | Import `getFormsDir` from `../lib/paths.js` |
| `src/cli/commands/research.ts` | Import `getFormsDir` from `../lib/paths.js` |
| `src/cli/commands/examples.ts` | Import `getFormsDir` from `../lib/paths.js` |
| `tests/unit/cli/formsDir.test.ts` | Update import path |

### Change 2: Build-Time VERSION Injection

**Current approach**: Runtime reading via `createRequire`

```typescript
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { version: string };
export const VERSION: string = pkg.version;
```

**Problem**: `node:module` is Node-specific.

**Solution**: Use tsdown’s `define` option (built on esbuild) to inject at build time.

**tsdown.config.ts change:**

```typescript
import { defineConfig } from 'tsdown';
import pkg from './package.json';

export default defineConfig({
  // ... existing config
  define: {
    '__MARKFORM_VERSION__': JSON.stringify(pkg.version),
  },
});
```

**src/index.ts change:**

```typescript
// Build-time injected by tsdown
declare const __MARKFORM_VERSION__: string;

/** Markform version (injected at build time). */
export const VERSION: string = typeof __MARKFORM_VERSION__ !== 'undefined'
  ? __MARKFORM_VERSION__
  : 'development';
```

The fallback handles the case where code runs without being built (e.g., during
development with ts-node or vitest).

**Release process compatibility**: The existing release workflow is unaffected because:

1. Changesets updates `package.json` version during `pnpm version-packages`
2. Tag is created after package.json has the new version
3. Release workflow runs `pnpm build` before `pnpm publish`
4. Build reads `package.json` and injects version at build time
5. Published artifacts have the correct version baked in

The guard test includes a verification that `VERSION` matches `package.json` to catch
any drift.

### Verification Approach

After implementation, run:

```bash
# Check no Node imports outside cli/
grep -r "from 'node:" packages/markform/src/ | grep -v "/cli/"

# Should return nothing

# Check built output
grep -E "node:(module|path|fs)" packages/markform/dist/index.mjs

# Should return nothing
```

## Stage 3: Refine Architecture

### Reuse Opportunities

1. **Existing CLI patterns**: `src/cli/lib/` already has utilities like `shared.ts`,
   `formatting.ts`. Adding `paths.ts` follows this pattern.

2. **tsdown define**: Standard esbuild feature, no new dependencies needed.

### Simplified Architecture

The architecture from Stage 2 is already minimal:

- One new file (`cli/lib/paths.ts`)

- One config change (`tsdown.config.ts`)

- Import path updates in 4 files

- No new dependencies

### Change 3: Automated Guard Test

Create a test that automatically fails if Node.js dependencies are added to non-CLI
code. This prevents future regressions.

**Approach: Static import analysis + build output verification**

Two complementary tests:

1. **Source-level test**: Scan `src/` for `node:` imports outside `cli/`

2. **Build-level test**: Verify `dist/index.mjs` and `dist/ai-sdk.mjs` have no `node:`
   refs

**Test file**: `tests/unit/node-free-core.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC_DIR = join(__dirname, '../../../src');
const DIST_DIR = join(__dirname, '../../../dist');

// Directories that ARE allowed to use Node.js
const NODE_ALLOWED_DIRS = ['cli'];

// Pattern to detect Node.js imports
const NODE_IMPORT_PATTERN = /from\s+['"]node:/g;

function getAllTsFiles(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      getAllTsFiles(fullPath, files);
    } else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

function isInAllowedDir(filePath: string): boolean {
  const rel = relative(SRC_DIR, filePath);
  return NODE_ALLOWED_DIRS.some(dir => rel.startsWith(dir + '/') || rel.startsWith(dir + '\\'));
}

describe('Node-free core library', () => {
  it('source files outside cli/ should not import from node:', () => {
    const violations: string[] = [];

    for (const file of getAllTsFiles(SRC_DIR)) {
      if (isInAllowedDir(file)) continue;

      const content = readFileSync(file, 'utf-8');
      const matches = content.match(NODE_IMPORT_PATTERN);
      if (matches) {
        const rel = relative(SRC_DIR, file);
        violations.push(`${rel}: ${matches.join(', ')}`);
      }
    }

    expect(violations,
      `Node.js imports found outside cli/:\n${violations.join('\n')}`
    ).toHaveLength(0);
  });

  it('dist/index.mjs should not reference node: modules', () => {
    const content = readFileSync(join(DIST_DIR, 'index.mjs'), 'utf-8');
    const matches = content.match(NODE_IMPORT_PATTERN);
    expect(matches, 'index.mjs contains node: imports').toBeNull();
  });

  it('dist/ai-sdk.mjs should not reference node: modules', () => {
    const content = readFileSync(join(DIST_DIR, 'ai-sdk.mjs'), 'utf-8');
    const matches = content.match(NODE_IMPORT_PATTERN);
    expect(matches, 'ai-sdk.mjs contains node: imports').toBeNull();
  });

  it('built VERSION should match package.json version', async () => {
    // Dynamic import to get built output
    const { VERSION } = await import('../../../dist/index.mjs');
    const pkg = JSON.parse(readFileSync(join(__dirname, '../../../package.json'), 'utf-8'));
    expect(VERSION).toBe(pkg.version);
  });
});
```

**Why this approach:**

- **Static analysis** catches issues immediately during development

- **Build verification** catches issues in the actual bundled output

- **Test runs in CI** so regressions are caught automatically

- **Clear error messages** show exactly which file has the violation

- **Uses Node.js in the test itself** (that’s fine - tests always run in Node)

### Implementation Phases

**Single Phase** (straightforward refactor):

- [ ] Create `src/cli/lib/paths.ts` with `getFormsDir()` function

- [ ] Update `src/settings.ts`: remove `node:path` import and `getFormsDir()`

- [ ] Update CLI imports: `fill.ts`, `research.ts`, `examples.ts`

- [ ] Update test: `formsDir.test.ts`

- [ ] Update `tsdown.config.ts` with `define` for version

- [ ] Update `src/index.ts` to use build-time injected version

- [ ] Create `tests/unit/node-free-core.test.ts` guard test

- [ ] Run tests to verify everything works

- [ ] Verify no Node imports in core library

## Stage 4: Validation Stage

### Test Plan

**1. Existing tests must pass:**

```bash
npm test
```

**2. Manual CLI verification:**

```bash
markform --version  # Should show correct version
markform validate examples/movie-research/movie-research-basic.form.md
markform fill examples/movie-research/movie-research-minimal.form.md --roles=user --interactive
```

**3. Node import verification:**

```bash
# Source check - should only show cli/ files
grep -r "from 'node:" packages/markform/src/ | grep -v "/cli/"

# Built output check - should show nothing for core
grep -E "node:" packages/markform/dist/index.mjs
grep -E "node:" packages/markform/dist/ai-sdk.mjs

# CLI can have Node imports (expected)
grep -E "node:" packages/markform/dist/cli.mjs  # This is fine
```

**4. VERSION export verification:**

```bash
node -e "import('markform').then(m => console.log(m.VERSION))"
```

### Success Criteria

- [ ] `npm test` passes

- [ ] `npm run build` succeeds

- [ ] No `node:` imports in `src/` outside of `src/cli/`

- [ ] No `node:` references in `dist/index.mjs` or `dist/ai-sdk.mjs`

- [ ] `markform --version` shows correct version number

- [ ] `VERSION` export works from library

- [ ] All CLI commands work as before

- [ ] Guard test `node-free-core.test.ts` passes and would catch future regressions
