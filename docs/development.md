# Development Guide

> This document covers essential developer workflows for this project.
> **Update this document** as new patterns and workflows are established during
> implementation.

## Prerequisites

- **Node.js 24** (LTS “Krypton”) — [nodejs.org](https://nodejs.org/)

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

## CLI Usage

After building, run the CLI from the repository root:

```bash
# Build first (required after code changes)
pnpm build

# Run the CLI using the pnpm script
pnpm markform --help
pnpm markform inspect <file>
pnpm markform export <file>
pnpm markform dump <file>
pnpm markform apply <file> --patch '<json>'
pnpm markform serve <file>
pnpm markform fill <file> --agent=mock --mock-source <mock-file>
pnpm markform fill <file> --agent=live --model=anthropic/claude-sonnet-4-5
```

### CLI Commands

| Command | Description |
| --- | --- |
| `inspect <file>` | Display form structure, progress, and issues (YAML or JSON) |
| `export <file>` | Export form schema and values as JSON |
| `dump <file>` | Extract and display form values only (lightweight inspect) |
| `apply <file>` | Apply JSON patches to update field values |
| `serve <file>` | Start a web server to browse/edit the form |
| `fill <file>` | Fill a form using an agent (mock or live LLM) |

### CLI Development

The CLI is built with Commander and uses these conventions:

- **picocolors** for terminal colors (never hardcoded ANSI)

- **@clack/prompts** for interactive UI

- Support `--verbose`, `--quiet`, `--dry-run` flags

## Testing

### Quick Reference

```bash
# Full precommit check (build, lint, test)
pnpm precommit

# Individual commands
pnpm build           # Build all packages
pnpm lint            # ESLint
pnpm typecheck       # TypeScript type checking
pnpm test            # All tests
pnpm test:unit       # Unit tests only
pnpm test:golden     # Golden session tests only
pnpm publint         # Validate package exports
```

### Test Categories

**Unit Tests** (`tests/unit/`): Test individual engine functions

```bash
pnpm test:unit
```

**Golden Tests** (`tests/golden/`): End-to-end session replay tests

```bash
pnpm test:golden
```

Golden tests replay recorded agent sessions to validate form filling works correctly.
Session files are in `tests/golden/sessions/`.

### Watch Mode

```bash
# Run tests in watch mode during development
pnpm --filter markform test:watch
```

### CI Consistency

The CI workflow (`.github/workflows/ci.yml`) runs these commands in order:

1. `pnpm install`

2. `pnpm lint`

3. `pnpm typecheck`

4. `pnpm build`

5. `pnpm publint`

6. `pnpm test`

To match CI behavior locally, run `pnpm precommit` which executes the same checks.

## AI SDK Integration

Markform provides AI SDK compatible tools for agent-driven form filling.

### Installation

```bash
# Install Markform
pnpm add markform

# For live agent testing, also install:
pnpm add ai @ai-sdk/anthropic
```

### Usage

```typescript
import { parseForm } from "markform";
import { createMarkformTools, MarkformSessionStore } from "markform/ai-sdk";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

// Parse a form
const form = parseForm(markdownContent);

// Create session store and tools
const store = new MarkformSessionStore(form);
const tools = createMarkformTools({ sessionStore: store });

// Use with AI SDK
const result = await generateText({
  model: anthropic("claude-sonnet-4-5-20250929"),
  prompt: "Fill out this form with appropriate values...",
  tools,
  maxSteps: 10,
});
```

### Available Tools

| Tool | Description |
| --- | --- |
| `markform_inspect` | Get current form state, issues, and progress |
| `markform_apply` | Apply patches to update field values |
| `markform_export` | Export schema and values as JSON |
| `markform_get_markdown` | Get canonical Markdown representation |

### Live Agent Test Script

A test script is provided for validating the AI SDK integration:

```bash
# Run with mock agent (no API key needed)
npx tsx packages/markform/scripts/test-live-agent.ts

# Run with live agent (requires ANTHROPIC_API_KEY)
ANTHROPIC_API_KEY=your-key npx tsx packages/markform/scripts/test-live-agent.ts

# Specify a different form
npx tsx packages/markform/scripts/test-live-agent.ts path/to/form.md
```

* * *

> **Note:** This is an initial version created during Phase 0 scaffolding.
> Update as implementation progresses and new patterns emerge.
