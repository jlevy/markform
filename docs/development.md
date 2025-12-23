# Development Guide

> This document covers essential developer workflows for this project.
> **Update this document** as new patterns and workflows are established during
> implementation.

## Prerequisites

- **Node.js 24** (LTS "Krypton") — [nodejs.org](https://nodejs.org/)

- **pnpm 10.x** — Install via `corepack enable` or `npm install -g pnpm`

### Node 24 Setup

This project requires Node.js 24+. Setup depends on your environment:

#### Claude Code on the Web (Automatic)

A session-start hook (`.claude/hooks/session-start.sh`) automatically:

1. Downloads and installs Node 24 if not present
2. Configures PATH for the session
3. Runs `pnpm install`

No manual setup needed—the hook runs on session start.

#### Local Development

**Option 1: Direct installation**

Download from [nodejs.org](https://nodejs.org/) and install Node 24.

**Option 2: Using a version manager**

```bash
# Using nvm
nvm install 24
nvm use 24

# Using fnm
fnm install 24
fnm use 24

# Using mise
mise use node@24
```

**Option 3: Manual binary installation** (useful in containers/CI)

```bash
NODE_VERSION="v24.12.0"
mkdir -p ~/.local
curl -fsSL "https://nodejs.org/dist/latest-v24.x/node-${NODE_VERSION}-linux-x64.tar.xz" \
  -o /tmp/node24.tar.xz
tar -xJf /tmp/node24.tar.xz -C ~/.local
export PATH="$HOME/.local/node-${NODE_VERSION}-linux-x64/bin:$PATH"
```

#### Verify Installation

```bash
node --version   # Should show v24.x.x
pnpm --version   # Should show 10.x.x
```

## Project Structure

This is a pnpm monorepo with packages in `packages/`:

```
markform/
  packages/
    markform/           # Main package (CLI, engine, web UI)
      src/
        engine/         # Core: parsing, validation, serialization
        cli/            # CLI commands
        harness/        # Execution harness
        integrations/   # AI SDK tools
        web/            # Serve UI
      tests/
      examples/
  docs/                 # Project documentation
  .changeset/           # Version management
  .github/workflows/    # CI/CD
```

See [Architecture Design](project/architecture/current/arch-markform-initial-design.md)
for full technical specification.

## Common Commands

Run from repository root:

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Type checking (no emit)
pnpm typecheck

# Run tests
pnpm test

# Lint
pnpm lint

# Validate package exports
pnpm publint
```

Run commands for a specific package:

```bash
# Build only markform package
pnpm --filter markform build

# Watch mode during development
pnpm --filter markform dev

# Run tests for markform
pnpm --filter markform test
```

## Development Workflow

### Making Changes

1. Create a feature branch from `main`

2. Make changes and ensure tests pass

3. Run full validation: `pnpm lint && pnpm typecheck && pnpm build && pnpm test`

4. Create a changeset if user-facing: `pnpm changeset`

5. Commit and push

### Changesets

For any user-facing change, create a changeset:

```bash
pnpm changeset
# Follow prompts to describe the change and select version bump type
```

Changeset files are committed with your PR and processed during release.

### Pre-commit Checklist

Before committing, ensure:

```bash
pnpm lint        # No lint errors
pnpm typecheck   # No type errors
pnpm build       # Build succeeds
pnpm publint     # Package exports valid
pnpm test        # Tests pass
```

## CLI Development

The CLI is built with Commander and uses these conventions:

- **picocolors** for terminal colors (never hardcoded ANSI)

- **@clack/prompts** for interactive UI

- Support `--verbose`, `--quiet`, `--dry-run` flags

Run the CLI during development:

```bash
# After building
pnpm --filter markform build
node packages/markform/dist/bin.js <command>

# Or link globally
cd packages/markform && pnpm link --global
markform <command>
```

## Testing

```bash
# All tests
pnpm test

# Unit tests only
pnpm --filter markform test:unit

# Golden session tests
pnpm --filter markform test:golden

# Watch mode
pnpm --filter markform test -- --watch
```

* * *

> **Note:** This is an initial version created during Phase 0 scaffolding.
> Update as implementation progresses and new patterns emerge.
