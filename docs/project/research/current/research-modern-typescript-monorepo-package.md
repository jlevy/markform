# Research Brief: Modern TypeScript Monorepo Package Architecture

**Last Updated**: 2025-12-22

**Status**: Complete

**Related**:

- [pnpm Workspaces Documentation](https://pnpm.io/workspaces)

- [Changesets Documentation](https://github.com/changesets/changesets)

- [tsdown Documentation](https://tsdown.dev/)

- [publint Documentation](https://publint.dev/docs/)

* * *

## Updating This Document

### Last Researched Versions

| Tool / Package | Version | Check For Updates |
| --- | --- | --- |
| **Node.js** | 24 (LTS "Krypton") | [nodejs.org/releases](https://nodejs.org/en/about/previous-releases) — Active LTS until Oct 2026 |
| **pnpm** | 10.26.1 | [github.com/pnpm/pnpm/releases](https://github.com/pnpm/pnpm/releases) |
| **TypeScript** | ^5.0.0 | [github.com/microsoft/TypeScript/releases](https://github.com/microsoft/TypeScript/releases) |
| **tsdown** | ^0.16.0 | [github.com/rolldown/tsdown/releases](https://github.com/rolldown/tsdown/releases) |
| **publint** | ^0.3.0 | [npmjs.com/package/publint](https://www.npmjs.com/package/publint) |
| **@changesets/cli** | ^2.28.0 | [github.com/changesets/changesets/releases](https://github.com/changesets/changesets/releases) |
| **@types/node** | ^24.0.0 | Should match Node.js major version |
| **actions/checkout** | v5 | [github.com/actions/checkout/releases](https://github.com/actions/checkout/releases) |
| **actions/setup-node** | v6 | [github.com/actions/setup-node/releases](https://github.com/actions/setup-node/releases) |
| **pnpm/action-setup** | v4 | [github.com/pnpm/action-setup/releases](https://github.com/pnpm/action-setup/releases) |
| **changesets/action** | v1 | [github.com/changesets/action](https://github.com/changesets/action) |

### Reminders When Updating

1. **Check each version** in the table above using the linked release pages

2. **Update the table** with new versions and any relevant notes

3. **Search and update code examples** — version numbers appear in:

   - GitHub Actions workflows (CI and Release sections)

   - `tsdown.config.ts` examples (`target: "node24"`)

   - `tsconfig.base.json` examples (`target`/`lib` should match Node.js ES version)

   - `package.json` examples (`engines`, `packageManager`, `devDependencies`)

   - Appendices A, B, and D (complete examples)

4. **Verify compatibility** — check that tools still work together (e.g., new
   pnpm/action-setup versions may change caching behavior)

5. **Update the “Last Updated” date** at the top of the document

6. **Review “Open Research Questions”** section for any resolved items

* * *

## Executive Summary

This research brief provides a comprehensive guide for setting up a modern TypeScript
package that can start as a single package and grow into a multi-package monorepo.
The architecture prioritizes fast iteration during early development while maintaining a
clear path to split packages later without breaking changes.

The recommended stack uses **pnpm workspaces** for dependency management, **tsdown** for
building ESM/CJS dual outputs with TypeScript declarations, **Changesets** for
versioning and release automation, and **publint** for validating package
publishability. This approach supports private development via GitHub Packages or direct
GitHub installs, with a seamless transition to public npm publishing when ready.

**Research Questions**:

1. What is the optimal monorepo structure for a TypeScript package that may grow from
   one to many packages?

2. How should modern TypeScript packages handle dual ESM/CJS output with proper type
   declarations?

3. What tooling provides the best developer experience for versioning, publishing, and
   CI/CD automation?

4. How can packages support optional peer dependencies (like AI SDKs or protocol
   integrations) without forcing them on users?

* * *

## Research Methodology

### Approach

Research was conducted through documentation review, web searches for current best
practices (2025), analysis of popular open-source monorepos, and evaluation of tooling
recommendations from the TypeScript and JavaScript ecosystem maintainers.

### Sources

- Official documentation (pnpm, TypeScript, Node.js, GitHub)

- Tool-specific documentation (tsdown, publint, Changesets)

- Developer blog posts and migration guides

- GitHub discussions and issue threads

- Real-world monorepo implementations (Effect-TS, TresJS)

* * *

## Research Findings

### 1. Package Manager & Workspace Structure

#### pnpm Workspaces

**Status**: Recommended

**Details**:

- pnpm offers disk space efficiency through content-addressable storage with symlinks

- Built-in workspace support without additional tools

- Strict `node_modules` prevents phantom dependencies (packages not explicitly declared)

- `workspace:` protocol ensures local packages are always used during development

- `pnpm deploy` command enables isolated production deployments for Docker

**Assessment**: pnpm is the consensus choice for TypeScript monorepos in 2025, offering
superior disk efficiency and stricter dependency management than npm or yarn.

**Key Configuration** (`pnpm-workspace.yaml`):
```yaml
packages:
  - "packages/*"
  - "apps/*"
```

**Root `.npmrc`**:
```ini
save-workspace-protocol=true
prefer-workspace-packages=true
```

**References**:

- [pnpm Workspaces](https://pnpm.io/workspaces)

- [Complete Monorepo Guide 2025](https://jsdev.space/complete-monorepo-guide/)

* * *

#### Monorepo Structure Strategy

**Status**: Recommended

**Details**:

The “start mono, stay sane” approach places packages in `packages/` from day one, even
if there’s only one package initially.
This prevents restructuring when adding new packages later.

**Recommended Directory Structure**:
```
project-root/
  .changeset/
    config.json
    README.md
  .github/
    workflows/
      ci.yml
      release.yml
  packages/
    package-name/
      src/
        core/           # Future: package-name-core
        cli/            # Future: package-name-cli
        adapters/       # Future: package-name-adapters
        bin.ts
        index.ts
      package.json
      tsconfig.json
      tsdown.config.ts
  .gitignore
  .npmrc
  eslint.config.js
  package.json
  pnpm-workspace.yaml
  tsconfig.base.json
```

**Assessment**: Starting with a monorepo structure from day one has minimal overhead and
prevents painful restructuring later.
Internal code organization (`core/`, `cli/`, `adapters/`) creates natural split points.

**References**:

- [Setting up a monorepo with pnpm and
  TypeScript](https://brockherion.dev/blog/posts/setting-up-a-monorepo-with-pnpm-and-typescript/)

- [Wisp CMS: How to Bootstrap a Monorepo with
  PNPM](https://www.wisp.blog/blog/how-to-bootstrap-a-monorepo-with-pnpm-a-complete-guide)

* * *

### 2. TypeScript Configuration

#### Base Configuration

**Status**: Recommended

**Details**:

Modern TypeScript monorepos use a shared base configuration extended by each package.

**`tsconfig.base.json`**:
```json
{
  "compilerOptions": {
    "target": "ES2024",
    "lib": ["ES2024"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "strict": true,
    "skipLibCheck": true,
    "noUncheckedIndexedAccess": true,
    "forceConsistentCasingInFileNames": true,
    "verbatimModuleSyntax": true
  }
}
```

**Package-level `tsconfig.json`**:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["node"],
    "noEmit": true
  },
  "include": ["src"]
}
```

**Assessment**: Using `moduleResolution: "Bundler"` is appropriate when a bundler
(tsdown) handles the final output.
For maximum Node.js compatibility without a bundler, `NodeNext` would be preferred.
Since tsdown generates proper ESM and CJS with correct extensions, `Bundler` mode works
well.

**References**:

- [TypeScript: Choosing Compiler
  Options](https://www.typescriptlang.org/docs/handbook/modules/guides/choosing-compiler-options.html)

- [Is nodenext right for
  libraries?](https://blog.andrewbran.ch/is-nodenext-right-for-libraries-that-dont-target-node-js/)

* * *

#### moduleResolution: Bundler vs NodeNext

**Status**: Situational

**Details**:

| Aspect | `Bundler` | `NodeNext` |
| --- | --- | --- |
| File extensions | Not required in imports | Required (.js extension) |
| Use case | When bundler handles output | Direct Node.js execution |
| Library compatibility | Requires bundler-aware consumers | Works everywhere |
| Type generation | Must ensure .d.ts aligns with output | Naturally aligned |

**Key insight**: `NodeNext` is “infectious” in a good way—code that works in Node.js
typically works in bundlers too.
However, `Bundler` is acceptable when using tsdown since it handles file extensions
correctly.

**Assessment**: Use `Bundler` for simplicity during development when tsdown generates
the final output. The bundler handles the complexity of module resolution.

**References**:

- [TypeScript moduleResolution documentation](https://www.typescriptlang.org/tsconfig/moduleResolution.html)

- [Live types in a TypeScript
  monorepo](https://colinhacks.com/essays/live-types-typescript-monorepo)

* * *

### 3. Build Tooling

#### tsdown

**Status**: Strongly Recommended

**Details**:

tsdown is the modern successor to tsup, built on Rolldown (the Rust-based bundler from
the Vite ecosystem).
Key advantages:

- **ESM-first**: Properly handles file extensions in ESM output (a pain point with tsup)

- **Dual format output**: Generates both ESM (`.js`) and CJS (`.cjs`) from the same
  source

- **TypeScript declarations**: Built-in `.d.ts` and `.d.cts` generation

- **Multi-entry support**: Build multiple entry points (library, CLI, adapters) in one
  config

- **Plugin ecosystem**: Compatible with Rollup, Rolldown, and most Vite plugins

- **Fast**: Powered by Rust-based Oxc and Rolldown

- **Isolated declarations**: Supports TypeScript 5.5+ `--isolatedDeclarations` for
  faster type generation

**Migration from tsup**: tsdown provides a `migrate` command and is compatible with most
tsup configurations.

**Configuration (`tsdown.config.ts`)**:
```typescript
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    cli: "src/cli/index.ts",
    adapter: "src/adapters/index.ts",
    bin: "src/bin.ts"
  },
  format: ["esm", "cjs"],
  platform: "node",
  target: "node24",
  sourcemap: true,
  dts: true,
  clean: true,
  banner: ({ fileName }) =>
    fileName.startsWith("bin.") ? "#!/usr/bin/env node\n" : ""
});
```

**Assessment**: tsdown is the recommended choice for new TypeScript library projects.
It has official backing from the Vite/Rolldown team and will become the foundation for
Rolldown Vite’s Library Mode.

**Note on tsup**: tsup is no longer actively maintained.
The project recommends migrating to tsdown.

**References**:

- [tsdown Introduction](https://tsdown.dev/guide/)

- [Switching from tsup to tsdown](https://alan.norbauer.com/articles/tsdown-bundler/)

- [Migrate from tsup](https://tsdown.dev/guide/migrate-from-tsup)

- [TresJS tsdown Migration](https://tresjs.org/blog/tresjs-tsdown-migration)

- [Dual publish ESM and CJS with
  tsdown](https://dev.to/hacksore/dual-publish-esm-and-cjs-with-tsdown-2l75)

* * *

### 4. Package Exports & Dual Module Support

#### Subpath Exports

**Status**: Essential

**Details**:

The `exports` field in `package.json` enables:

- Multiple entry points (`./cli`, `./adapter`)

- Conditional exports (ESM vs CJS, types vs runtime)

- Package encapsulation (only expose intended APIs)

**Critical rule**: The `"types"` condition must come first in each export block.

**Example `package.json` exports**:
```json
{
  "name": "@scope/package-name",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      },
      "require": {
        "types": "./dist/index.d.cts",
        "default": "./dist/index.cjs"
      }
    },
    "./cli": {
      "import": {
        "types": "./dist/cli.d.ts",
        "default": "./dist/cli.js"
      },
      "require": {
        "types": "./dist/cli.d.cts",
        "default": "./dist/cli.cjs"
      }
    },
    "./package.json": "./package.json"
  },
  "bin": {
    "package-name": "./dist/bin.js"
  },
  "files": ["dist"]
}
```

**Assessment**: Subpath exports are essential for future-proofing.
They allow splitting packages later without breaking the API surface—`@scope/pkg/cli`
can remain stable even if internals move to `@scope/pkg-cli`.

**References**:

- [Guide to package.json exports field](https://hirok.io/posts/package-json-exports)

- [Node.js Packages documentation](https://nodejs.org/api/packages.html)

- [Ship ESM & CJS in one Package](https://antfu.me/posts/publish-esm-and-cjs)

- [Building npm package compatible with ESM and CJS in
  2024](https://snyk.io/blog/building-npm-package-compatible-with-esm-and-cjs-2024/)

* * *

#### Separate Declaration Files for ESM/CJS

**Status**: Required

**Details**:

Each entry point needs separate declaration files for ESM (`.d.ts`) and CJS (`.d.cts`).
TypeScript interprets declaration files as ESM or CJS based on file extension and the
package’s `type` field.

Using a single `.d.ts` for both formats will cause TypeScript errors for consumers using
one of the module systems.

**Assessment**: tsdown handles this automatically when `dts: true` is configured.

**References**:

- [TypeScript Modules Reference](https://www.typescriptlang.org/docs/handbook/modules/reference.html)

- [Publishing dual ESM+CJS packages](https://mayank.co/blog/dual-packages/)

* * *

### 5. Optional Peer Dependencies

#### Strategy for Optional Integrations

**Status**: Recommended

**Details**:

For packages that optionally integrate with external SDKs (AI SDKs, MCP servers, etc.),
use:

1. **Optional peer dependencies**: Don’t force installation

2. **Subpath exports**: Isolate optional code in separate entry points

3. **Dynamic imports**: Only load the SDK when the subpath is actually imported

**`package.json` configuration**:
```json
{
  "peerDependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "ai": "^5.0.0"
  },
  "peerDependenciesMeta": {
    "@modelcontextprotocol/sdk": { "optional": true },
    "ai": { "optional": true }
  }
}
```

**Implementation pattern** (`src/adapters/mcp/index.ts`):
```typescript
export async function createMcpServer(options: McpServerOptions) {
  // Dynamic import only when this code path is executed
  const { Server } = await import("@modelcontextprotocol/sdk/server");
  return new Server(options);
}
```

**Assessment**: This pattern ensures the main package remains lightweight while
providing rich integrations for users who need them.

**References**:

- [tsdown Dependencies handling](https://tsdown.dev/options/dependencies)

- [npm peer dependencies
  documentation](https://docs.npmjs.com/cli/v10/configuring-npm/package-json#peerdependenciesmeta)

* * *

### 6. Package Validation

#### publint

**Status**: Essential

**Details**:

publint validates that packages will work correctly across different environments (Vite,
Webpack, Rollup, Node.js).
It checks:

- Export field validity

- File existence for declared exports

- ESM/CJS format correctness

- Type declaration alignment

- Common configuration mistakes

**Integration**:
```json
{
  "scripts": {
    "publint": "publint",
    "prepack": "pnpm build"
  },
  "devDependencies": {
    "publint": "^0.3.0"
  }
}
```

**CI Integration**: Run `pnpm publint` after build in CI to catch publishing issues
before release.

**Assessment**: publint catches issues that would only surface after users install the
package. Essential for any published package.

**References**:

- [publint documentation](https://publint.dev/docs/)

- [publint rules](https://publint.dev/rules)

* * *

### 7. Versioning & Release Automation

#### Changesets

**Status**: Strongly Recommended

**Details**:

Changesets provides:

- **Intent-based versioning**: Developers declare the impact (patch/minor/major) when
  making changes

- **Automated changelogs**: Generated from changeset descriptions

- **Monorepo-aware**: Handles inter-package dependencies automatically

- **CI integration**: GitHub Action opens release PRs and publishes automatically

**Setup**:

1. Initialize: `pnpm add -Dw @changesets/cli && pnpm changeset init`

2. Configure `.changeset/config.json`:
```json
{
  "$schema": "https://unpkg.com/@changesets/config/schema.json",
  "changelog": "@changesets/changelog-github",
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch"
}
```

3. Root scripts:
```json
{
  "scripts": {
    "changeset": "changeset",
    "version-packages": "changeset version",
    "release": "pnpm build && pnpm publint && changeset publish"
  }
}
```

**Workflow**:

1. Developer runs `pnpm changeset` and describes changes

2. PR includes the changeset file

3. On merge to main, GitHub Action either:

   - Opens a “Version Packages” PR (accumulating changesets)

   - Publishes to npm when that PR is merged

**Assessment**: Changesets is the de facto standard for monorepo versioning.
It integrates seamlessly with pnpm and GitHub Actions.

**References**:

- [Using Changesets with pnpm](https://pnpm.io/using-changesets)

- [Changesets GitHub repository](https://github.com/changesets/changesets)

- [Frontend Handbook: Changesets](https://infinum.com/handbook/frontend/changesets)

* * *

### 8. CI/CD Configuration

#### GitHub Actions: CI Workflow

**Status**: Recommended

**`.github/workflows/ci.yml`**:
```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5

      - uses: pnpm/action-setup@v4
        with:
          version: 10

      - uses: actions/setup-node@v6
        with:
          node-version: 24
          cache: pnpm

      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm build
      - run: pnpm publint
      - run: pnpm test
```

**Key points**:

- Node.js 24 is the current LTS ("Krypton", active until Oct 2026, maintained until Apr
  2028\)

- `actions/checkout@v5` requires Actions Runner v2.327.1+ (node24 runtime)

- `pnpm/action-setup@v4` includes built-in caching

- `actions/setup-node@v6` with `cache: pnpm` provides additional caching

- `--frozen-lockfile` ensures CI uses exact versions from lockfile

**References**:

- [pnpm action-setup](https://github.com/pnpm/action-setup)

- [pnpm Continuous Integration](https://pnpm.io/continuous-integration)

* * *

#### GitHub Actions: Release Workflow

**Status**: Recommended

**`.github/workflows/release.yml`**:
```yaml
name: Release

on:
  push:
    branches: [main]

permissions:
  contents: write
  pull-requests: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
        with:
          fetch-depth: 0

      - uses: pnpm/action-setup@v4
        with:
          version: 10

      - uses: actions/setup-node@v6
        with:
          node-version: 24
          cache: pnpm
          registry-url: "https://registry.npmjs.org"

      - run: pnpm install --frozen-lockfile

      - name: Create Release PR or Publish
        uses: changesets/action@v1
        with:
          publish: pnpm release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**Repository settings required**:

- Settings → Actions → General → Workflow permissions → **Read and write**

- Add `NPM_TOKEN` secret when ready to publish to npm

**References**:

- [Changesets GitHub Action](https://github.com/changesets/action)

- [Using Changesets with pnpm](https://pnpm.io/using-changesets)

* * *

### 9. Private Package Distribution

#### Option A: GitHub Packages (Recommended)

**Status**: Recommended for teams

**Details**:

GitHub Packages provides a private npm registry with standard npm semantics.

**Requirements**:

- Package must be scoped (`@org/package-name`)

- Repository name should match organization/scope

**Publisher `.npmrc`**:
```ini
@your-org:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

**Consumer `.npmrc`**:
```ini
@your-org:registry=https://npm.pkg.github.com/
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN
```

**Install command**: `pnpm add @your-org/package-name`

**Assessment**: Lowest-friction option for teams.
Works exactly like npm but private.
No build-on-install quirks.

**References**:

- [GitHub npm registry
  documentation](https://docs.github.com/packages/working-with-a-github-packages-registry/working-with-the-npm-registry)

- [Publish NPM Package to GitHub Packages
  Registry](https://www.neteye-blog.com/2024/09/publish-npm-package-to-github-packages-registry-with-github-actions/)

* * *

#### Option B: Direct GitHub Install (pnpm)

**Status**: Viable for development

**Details**:

pnpm v9+ supports installing from a monorepo subdirectory:

```bash
pnpm add github:org/repo#path:packages/package-name
```

**Caveats**:

- Requires the package to be pre-built (dist must exist) OR lifecycle scripts must build
  it

- Less reliable than registry-based installs

- Version pinning is less precise

**Assessment**: Good for rapid development and testing.
Use GitHub Packages or npm for production.

**References**:

- [pnpm discussion: Add dependency from git
  monorepo](https://github.com/orgs/pnpm/discussions/8194)

* * *

#### Option C: Local Linking

**Status**: Best for development

**Details**:

For active development across repositories:

```bash
# In consumer project
pnpm add ../path-to-monorepo/packages/package-name
```

Or use `pnpm link`:
```bash
# In package directory
pnpm link --global

# In consumer project
pnpm link --global @scope/package-name
```

**Assessment**: Essential for local development iteration.
Not suitable for distribution.

* * *

#### Bun Compatibility Note

**Status**: Limited

**Details**:

Bun supports GitHub dependencies but has limited support for monorepo subdirectory
installs. For Bun consumers, GitHub Packages or npm publishing provides the smoothest
experience.

**References**:

- [Bun: Add a Git dependency](https://bun.sh/docs/guides/install/add-git)

- [Bun issue: Support installing Git dependency from
  subdirectory](https://github.com/oven-sh/bun/issues/15506)

* * *

## Comparative Analysis

### Build Tools Comparison

| Criteria | tsdown | tsup | unbuild | Rollup |
| --- | --- | --- | --- | --- |
| Active maintenance | Yes | No (abandoned) | Yes | Yes |
| ESM-first | Yes | No (CJS-first) | Yes | Yes |
| DTS generation | Built-in | Built-in | Built-in | Plugin required |
| Multi-entry | Yes | Yes | Yes | Yes |
| Config simplicity | Excellent | Good | Good | Complex |
| Speed | Fast (Rust) | Fast (esbuild) | Moderate | Moderate |
| Plugin ecosystem | Rolldown/Rollup/Vite | esbuild | unbuild | Rollup |

**Recommendation**: tsdown for new projects; migrate from tsup if currently using it.

* * *

### Package Manager Comparison

| Criteria | pnpm | npm | yarn |
| --- | --- | --- | --- |
| Disk efficiency | Excellent | Poor | Moderate |
| Workspace support | Built-in | Built-in (v7+) | Built-in |
| Strict mode | Yes (default) | No | Optional |
| Speed | Fast | Moderate | Fast |
| Monorepo tooling | Excellent | Basic | Good |

**Recommendation**: pnpm for monorepos.

* * *

## Best Practices

1. **Scope your package names**: Use `@org/package-name` format for easier GitHub
   Packages integration and namespace clarity.

2. **Structure for splitting**: Organize internal code (`core/`, `cli/`, `adapters/`) to
   make future package splits painless.

3. **Use subpath exports from day one**: Define `./cli`, `./adapter` exports even in
   v0.1 to stabilize the API surface.

4. **Types first in exports**: Always put `"types"` condition before `"default"` in
   export conditions.

5. **Optional peer deps for integrations**: Don’t force SDK dependencies on users who
   don’t need them.

6. **Validate before publish**: Run publint in CI and before every release.

7. **Changeset per PR**: Require changesets for user-facing changes to maintain accurate
   changelogs.

8. **Lock your tooling versions**: Pin exact versions in `packageManager` field and CI
   configurations.

9. **Test both ESM and CJS**: Ensure both module formats work correctly, especially for
   CLI tools.

10. **Keep the monorepo root private**: The root `package.json` should have `"private":
    true` and only contain workspace tooling.

* * *

## Open Research Questions

1. **Rolldown Vite Library Mode**: tsdown is positioned to become the foundation for
   Rolldown Vite’s Library Mode.
   Monitor for announcements that may affect best practices.

2. **ESLint v10 multi-config**: ESLint v10 promises stable support for multiple config
   files in monorepos. Currently, a single root config is recommended but has
   limitations.

3. **TypeScript isolatedDeclarations**: TypeScript 5.5+ supports
   `--isolatedDeclarations` for faster, tool-assisted type generation.
   Consider enabling when tsdown fully supports it.

* * *

## Recommendations

### Summary

Use a pnpm monorepo with tsdown for building, Changesets for versioning, and publint for
validation. Structure code internally for future splits while exposing a stable API
through subpath exports.
Start with GitHub Packages for private distribution, then transition to npm when ready
for public release.

### Recommended Approach

1. **Initialize workspace** with pnpm and a single package in `packages/`

2. **Configure tsdown** for dual ESM/CJS output with TypeScript declarations

3. **Set up subpath exports** for main entry and any adapters/integrations

4. **Add Changesets** for version management

5. **Configure CI** with lint, typecheck, build, publint, and test

6. **Configure release workflow** with Changesets GitHub Action

7. **Validate with publint** before every release

**Rationale**:

- Minimal overhead to start, clear path to scale

- Industry-standard tooling with active maintenance

- Supports both private and public distribution

- Enables fast iteration without accumulating technical debt

### Alternative Approaches

- **Nx or Turborepo**: For larger monorepos with complex dependency graphs, consider
  adding Nx or Turborepo for caching and task orchestration.
  The pnpm + Changesets foundation integrates well with both.

- **unbuild**: If Rolldown/Vite ecosystem alignment isn’t important, unbuild is another
  solid choice with a different plugin ecosystem.

- **Single-package repo**: For truly simple packages that will never grow, a
  non-monorepo structure is fine.
  However, the monorepo structure overhead is minimal and provides flexibility.

* * *

## References

### Official Documentation

- [pnpm Workspaces](https://pnpm.io/workspaces)

- [pnpm Using Changesets](https://pnpm.io/using-changesets)

- [pnpm Continuous Integration](https://pnpm.io/continuous-integration)

- [tsdown Documentation](https://tsdown.dev/)

- [publint Documentation](https://publint.dev/docs/)

- [Changesets GitHub](https://github.com/changesets/changesets)

- [Node.js Packages (exports)](https://nodejs.org/api/packages.html)

- [TypeScript Module Documentation](https://www.typescriptlang.org/docs/handbook/modules/reference.html)

- [GitHub Packages npm
  registry](https://docs.github.com/packages/working-with-a-github-packages-registry/working-with-the-npm-registry)

- [Node.js Releases](https://nodejs.org/en/about/previous-releases)

### Guides & Articles

- [Complete Monorepo Guide 2025](https://jsdev.space/complete-monorepo-guide/)

- [Guide to package.json exports field](https://hirok.io/posts/package-json-exports)

- [Ship ESM & CJS in one Package](https://antfu.me/posts/publish-esm-and-cjs)

- [Building npm package compatible with ESM and CJS in
  2024](https://snyk.io/blog/building-npm-package-compatible-with-esm-and-cjs-2024/)

- [TypeScript in 2025: ESM and CJS
  publishing](https://lirantal.com/blog/typescript-in-2025-with-esm-and-cjs-npm-publishing)

- [Switching from tsup to tsdown](https://alan.norbauer.com/articles/tsdown-bundler/)

- [Live types in a TypeScript
  monorepo](https://colinhacks.com/essays/live-types-typescript-monorepo)

- [Is nodenext right for
  libraries?](https://blog.andrewbran.ch/is-nodenext-right-for-libraries-that-dont-target-node-js/)

### GitHub Actions

- [pnpm/action-setup](https://github.com/pnpm/action-setup)

- [changesets/action](https://github.com/changesets/action)

* * *

## Appendices

### Appendix A: Complete package.json Example

```json
{
  "name": "@scope/package-name",
  "version": "0.1.0",
  "description": "Package description",
  "license": "MIT",
  "type": "module",
  "sideEffects": false,
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      },
      "require": {
        "types": "./dist/index.d.cts",
        "default": "./dist/index.cjs"
      }
    },
    "./cli": {
      "import": {
        "types": "./dist/cli.d.ts",
        "default": "./dist/cli.js"
      },
      "require": {
        "types": "./dist/cli.d.cts",
        "default": "./dist/cli.cjs"
      }
    },
    "./package.json": "./package.json"
  },
  "bin": {
    "package-name": "./dist/bin.js"
  },
  "files": ["dist"],
  "engines": {
    "node": ">=24"
  },
  "scripts": {
    "build": "tsdown",
    "dev": "tsdown --watch",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "node --test",
    "publint": "publint",
    "prepack": "pnpm build"
  },
  "dependencies": {},
  "peerDependencies": {
    "optional-sdk": "^1.0.0"
  },
  "peerDependenciesMeta": {
    "optional-sdk": { "optional": true }
  },
  "devDependencies": {
    "@types/node": "^24.0.0",
    "publint": "^0.3.0",
    "tsdown": "^0.16.0",
    "typescript": "^5.0.0"
  }
}
```

### Appendix B: Root package.json Example

```json
{
  "name": "project-workspace",
  "private": true,
  "packageManager": "pnpm@10.26.1",
  "engines": {
    "node": ">=24"
  },
  "scripts": {
    "build": "pnpm -r build",
    "typecheck": "pnpm -r typecheck",
    "test": "pnpm -r test",
    "publint": "pnpm -r publint",
    "lint": "eslint .",
    "format": "prettier -w .",
    "changeset": "changeset",
    "version-packages": "changeset version",
    "release": "pnpm build && pnpm publint && changeset publish"
  },
  "devDependencies": {
    "@changesets/cli": "^2.28.0",
    "@changesets/changelog-github": "^0.5.0",
    "@eslint/js": "^9.0.0",
    "eslint": "^9.0.0",
    "prettier": "^3.0.0",
    "typescript": "^5.0.0",
    "typescript-eslint": "^8.0.0"
  }
}
```

### Appendix C: ESLint Flat Config Example

```javascript
// eslint.config.js
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.pnpm-store/**"
    ]
  }
];
```

### Appendix D: tsdown Config Example

```typescript
// tsdown.config.ts
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    cli: "src/cli/index.ts",
    bin: "src/bin.ts"
  },
  format: ["esm", "cjs"],
  platform: "node",
  target: "node24",
  sourcemap: true,
  dts: true,
  clean: true,
  banner: ({ fileName }) =>
    fileName.startsWith("bin.") ? "#!/usr/bin/env node\n" : ""
});
```
