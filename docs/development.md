# Development Guide

> This document covers essential developer workflows for this project.
> **Update this document** as new patterns and workflows are established during
> implementation.

## Prerequisites

- **Node.js 20+** — We recommend v24 (current) or v22 LTS.
  Minimum supported is v20. [nodejs.org](https://nodejs.org/)

- **pnpm 10.x** — Install via `corepack enable` or `npm install -g pnpm`

### Node.js Setup

This project requires Node.js 20 or higher. We recommend Node 24 (current) for best
performance. Setup depends on your environment:

#### Claude Code on the Web (Automatic)

A session-start hook (`.claude/hooks/session-start.sh`) automatically:

1. Downloads and installs Node 24 if not present

2. Configures PATH for the session

3. Runs `pnpm install`

No manual setup needed—the hook runs on session start.

#### Local Development

**Option 1: Direct installation**

Download from [nodejs.org](https://nodejs.org/) and install Node.js 24 (current) or
Node.js 22 LTS.

**Option 2: Using a version manager**

```bash
# Using nvm (recommended: install latest)
nvm install 24
nvm use 24

# Using fnm
fnm install 24
fnm use 24

# Using mise
mise use node@24
```

#### Verify Installation

```bash
node --version   # Should show v20.x.x or higher (v24 recommended)
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

See [Architecture Design](project/architecture/current/arch-markform-design.md.md) for
full technical specification.

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

4. Commit and push

### Releases

Changesets are created at release time, not per-PR. Just merge your work to `main`. See
[Publishing](publishing.md) for the release workflow.

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

Run the CLI from the repository root:

```bash
# Development: runs TypeScript source directly via tsx (always current, no build needed)
pnpm markform --help
pnpm markform inspect <file>
pnpm markform export <file>
pnpm markform dump <file>
pnpm markform apply <file> --patch '<json>'
pnpm markform serve <file>
pnpm markform fill <file> --interactive  # Interactive mode for user role fields
pnpm markform fill <file> --mock --mock-source <mock-file>
pnpm markform fill <file> --model=anthropic/claude-sonnet-4-5

# Testing built output (requires pnpm build first)
pnpm markform:bin --help
```

**Why two scripts?**

- `pnpm markform` — Runs source via `tsx`. Use this during development—always current,
  no build step needed.
- `pnpm markform:bin` — Runs the built binary from `dist/`. Use this to verify the
  published output works correctly before release.

### CLI Commands

| Command | Description |
| --- | --- |
| `examples` | Copy bundled example forms to the forms directory |
| `run [file]` | Browse and run forms from the forms directory |
| `status <file>` | Display form fill status with per-role breakdown |
| `inspect <file>` | Display form structure, progress, and issues (YAML or JSON) |
| `export <file>` | Export form schema and values as JSON |
| `dump <file>` | Extract and display form values only (lightweight inspect) |
| `apply <file>` | Apply JSON patches to update field values |
| `serve <file>` | Start a web server to browse/edit the form |
| `fill <file>` | Fill a form using an agent (mock or live LLM) |
| `research <file>` | Fill a form using a web-search-enabled model |

### CLI Development

The CLI is built with Commander and uses these conventions:

- **picocolors** for terminal colors (never hardcoded ANSI)

- **@clack/prompts** for interactive UI

- Support `--verbose`, `--quiet`, `--debug`, `--dry-run` flags

### Log Levels

The CLI supports four log levels, controlled by flags or `MARKFORM_LOG_LEVEL` environment variable:

| Level | Flag | Description |
| --- | --- | --- |
| `quiet` | `--quiet` | Suppress non-essential output |
| `default` | (none) | Model info, tool calls, result summaries, token counts |
| `verbose` | `--verbose` | Adds harness config, full result listings |
| `debug` | `--debug` | Adds full prompts, raw tool inputs/outputs (truncated) |

### Wire Format Capture

Use `--wire-log <file>` to capture the full LLM request/response for debugging:

```bash
# Capture wire format to YAML file
pnpm markform fill form.md --model=openai/gpt-5-mini --wire-log session-wire.yaml
pnpm markform research form.md --model=google/gemini-2.5-flash --wire-log session-wire.yaml
pnpm markform run form.md --wire-log session-wire.yaml

# Or use environment variable
MARKFORM_WIRE_LOG=session.yaml pnpm markform research form.md --model=openai/gpt-5-mini
```

The wire log captures:
- System and context prompts sent to the LLM
- Tool definitions
- Tool calls and results per step
- Reasoning content (for models with extended thinking)
- Token usage (including reasoning tokens)

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
Session files are in `examples/*/` directories.

### Regenerating Golden Tests

When format changes (like frontmatter updates) cause golden tests to fail with hash
mismatches, regenerate them:

```bash
# 1. Review failures to understand what changed
pnpm test:golden

# 2. Regenerate session files and schema snapshots
pnpm --filter markform test:golden:regen

# 3. Review diffs to verify changes are expected
git diff packages/markform/examples/

# 4. Run tests again to confirm they pass
pnpm test:golden

# 5. Commit the updated session and schema files
git add packages/markform/examples/
git commit -m "Update golden test files after format change"
```

The regeneration script updates two types of golden test files:

1. **Session transcripts** (`.session.yaml`): Records of mock agent interactions with
   SHA256 hashes for form state verification

2. **Schema snapshots** (`.schema.json`): JSON Schema exports that verify the schema
   generation logic remains stable

Both types of golden files are stored in `examples/` directories alongside the source
forms and can be reviewed/diffed like any other test artifact.

### Validating Prompt Changes

When modifying agent prompts or error messages in `prompts.ts` or `liveAgent.ts`:

1. **Make your changes** to the prompt text or error message format

2. **Regenerate golden tests** to capture the new message format:

   ```bash
   pnpm --filter markform test:golden:regen
   ```

3. **Review the wire format diffs** to verify changes are correct:

   ```bash
   git diff packages/markform/examples/**/*.session.yaml
   ```

   Look for changes in `wire.request.system` and `wire.request.prompt` sections.
   The session files capture the complete LLM request/response format, making it easy
   to verify exactly what agents see.

4. **Run golden tests** to verify the form filling logic still works:

   ```bash
   pnpm test:golden
   ```

5. **Commit the updated session files** along with your prompt changes

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

6. `pnpm test:coverage`

To match CI behavior locally, run `pnpm precommit` which executes the same checks.

### Code Coverage

Coverage is collected using Vitest with the v8 provider. Reports are generated in multiple
formats for different use cases.

**Before submitting a PR**, review coverage for your changes:

```bash
# Run tests with coverage
pnpm --filter markform test:coverage

# View detailed HTML report (recommended for PR review)
open packages/markform/coverage/index.html
```

The HTML report shows line-by-line coverage highlighting. Use it to:

- Identify untested code paths in your changes
- Verify edge cases are covered
- Find dead code that can be removed

**Coverage reports generated:**

| Format | Location | Purpose |
| --- | --- | --- |
| `text` | Terminal | Quick summary during development |
| `html` | `coverage/index.html` | **PR review** - detailed visual report |
| `json-summary` | `coverage/coverage-summary.json` | CI/PR comments |
| `lcov` | `coverage/lcov.info` | External tools (Codecov, etc.) |

**Current thresholds:**

| Metric | Threshold | Target |
| --- | --- | --- |
| Statements | 50% | 80% |
| Branches | 49% | 75% |
| Functions | 49% | 80% |
| Lines | 50% | 80% |

Thresholds will be increased as coverage improves. CI will fail if coverage drops below
thresholds.

**CI coverage visibility:**

- PRs automatically receive coverage comments with summary and changed-file coverage
- Coverage badge in README updates after merges to main
- Run `pnpm --filter markform test:coverage` locally to match CI behavior

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
