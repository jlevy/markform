# Plan Spec: Tryscript End-to-End CLI Testing

## Purpose

This plan spec documents the strategy for using [tryscript](https://github.com/jlevy/tryscript) to create comprehensive, readable end-to-end tests for the Markform CLI, replacing fragmented unit tests with clean `.tryscript.md` files.

## Background

### Current CLI Testing

The Markform CLI currently has 12 unit test files in `tests/unit/cli/` with ~328 test cases. These tests:

1. **Unit test utilities** (formatting, parsing, naming conventions) via mocked dependencies
2. **Golden session tests** that replay `.session.yaml` transcripts for LLM-driven form filling
3. Do **not** directly test CLI command execution end-to-end

### The Gap

While utility functions are well-tested, **actual CLI command execution** (running `markform inspect <file>`, `markform validate <file>`, etc.) is not directly tested. The golden tests cover the fill/research flow but don't test the 20 CLI commands as a user would invoke them.

### Why Tryscript

Tryscript is a TypeScript port of Rust's trycmd that enables:

- **Markdown-based test files** (`*.tryscript.md`) that are readable documentation
- **Console code blocks** that capture expected command output
- **Elision patterns** (`[..]`, `...`) for dynamic output like paths, dates, timings
- **Update mode** (`--update`) to regenerate expected output when behavior changes
- **Custom patterns** for project-specific dynamic values (versions, hashes)

## Summary of Task

Implement end-to-end CLI testing using tryscript with:

1. One or two master test scripts that test all CLI functionality
2. Clean organization by command category
3. Proper handling of dynamic output (versions, paths, colors)
4. Integration with existing Vitest test infrastructure

## Backward Compatibility

Not applicable - this adds new test infrastructure without changing existing functionality.

---

## Stage 1: Planning Stage

### Command Inventory

The Markform CLI has 20 commands organized by purpose:

| Category | Commands | Notes |
|----------|----------|-------|
| **Help/Docs** | `readme`, `docs`, `spec`, `apis` | Static documentation output |
| **Inspection** | `inspect`, `dump`, `status`, `validate` | Read-only form analysis |
| **Export** | `export`, `schema`, `report`, `render` | Format conversion |
| **Execution** | `fill`, `run`, `research`, `apply` | Form manipulation |
| **Utilities** | `examples`, `browse`, `models`, `serve` | Environment setup |

### Test Strategy

#### Master Test Files

Create two master tryscript files:

1. **`tests/cli/commands.tryscript.md`** - Tests all deterministic commands:
   - Help/docs commands
   - Inspection commands on example forms
   - Export commands with various formats
   - Validation and schema generation

2. **`tests/cli/workflows.tryscript.md`** - Tests command workflows:
   - Form filling with mock data via `apply`
   - Export after modification
   - Examples command copying forms
   - Status/progress tracking

#### Dynamic Output Handling

Configure custom patterns for:

| Pattern | Description | Example |
|---------|-------------|---------|
| `[VERSION]` | Package version | `0.1.0-next.51` |
| `[PATH]` | Absolute file paths | `/home/user/markform/...` |
| `[HASH]` | SHA256 hashes | Used in golden tests |
| `[DATE]` | ISO dates | `2026-01-02` |
| `[TIME]` | Timing values | `123ms` |

### Scope

**In scope:**
- Commands with deterministic, testable output
- Example forms already in the repository
- Non-interactive command execution

**Out of scope:**
- Interactive mode testing (requires TTY mock)
- Live LLM calls (covered by golden tests)
- `serve` command (requires server lifecycle)
- `browse`/`run` commands (interactive TUI)

### Acceptance Criteria

1. All non-interactive commands have tryscript coverage
2. Tests run via `npm run test:tryscript` script
3. Tests can be updated via `npm run test:tryscript:update`
4. CI includes tryscript tests
5. Tests are readable as command documentation

---

## Stage 2: Architecture Stage

### Project Structure

```
packages/markform/
├── tests/
│   ├── cli/                          # NEW: tryscript tests
│   │   ├── commands.tryscript.md     # Main command tests
│   │   └── workflows.tryscript.md    # Multi-command workflows
│   ├── unit/                         # Existing unit tests
│   └── golden/                       # Existing golden tests
├── tryscript.config.ts               # NEW: tryscript configuration
└── package.json                      # Add test scripts
```

### Configuration

```typescript
// tryscript.config.ts
import { defineConfig } from 'tryscript';

export default defineConfig({
  bin: './dist/cli.cjs',  // Built CLI binary
  env: {
    NO_COLOR: '1',        // Disable ANSI codes for predictable output
    FORCE_COLOR: '0',     // Redundant safety
  },
  timeout: 30000,         // 30s per command (some exports are slow)
  patterns: {
    VERSION: '\\d+\\.\\d+\\.\\d+(?:-[a-z]+\\.\\d+)?',
    PATH: '/[^\\s]+',
    HASH: '[a-f0-9]{64}',
    DATE: '\\d{4}-\\d{2}-\\d{2}',
    TIME: '\\d+(?:\\.\\d+)?(?:ms|s)',
  },
});
```

### Test File Structure

```markdown
---
bin: ./dist/cli.cjs
env:
  NO_COLOR: "1"
---

# Markform CLI Tests

## Help Commands

### --help shows usage

\`\`\`console
$ markform --help
Usage: markform [options] [command]

Agent-friendly, human-readable, editable forms
...
? 0
\`\`\`

## Inspection Commands

### inspect shows form structure

\`\`\`console
$ markform inspect examples/simple/simple.form.md
Form Inspection Report
Title: Simple Test Form
...
? 0
\`\`\`
```

### Package.json Scripts

```json
{
  "scripts": {
    "test:tryscript": "tryscript 'tests/cli/**/*.tryscript.md'",
    "test:tryscript:update": "tryscript --update 'tests/cli/**/*.tryscript.md'",
    "test:all": "pnpm test:unit && pnpm test:golden && pnpm test:tryscript"
  }
}
```

### Integration with Vitest (Optional)

Tryscript can also be called programmatically from Vitest:

```typescript
// tests/cli/tryscript.test.ts
import { describe, it, expect } from 'vitest';
import { parseTestFile, runBlock, createExecutionContext, cleanupExecutionContext } from 'tryscript';
import fs from 'node:fs/promises';
import path from 'node:path';

describe('CLI commands', async () => {
  const content = await fs.readFile('tests/cli/commands.tryscript.md', 'utf-8');
  const testFile = parseTestFile(content, 'commands.tryscript.md');

  for (const block of testFile.blocks) {
    it(block.name || `block at line ${block.lineNumber}`, async () => {
      const ctx = await createExecutionContext(testFile.config, 'tests/cli/commands.tryscript.md');
      try {
        const result = await runBlock(block, ctx);
        expect(result.passed, result.diff).toBe(true);
      } finally {
        await cleanupExecutionContext(ctx);
      }
    });
  }
});
```

This approach:
- Runs tryscript tests as part of `pnpm test`
- Shows failures in Vitest output
- Counts toward coverage (when using c8)

---

## Stage 3: Detailed Test Design

### commands.tryscript.md Structure

```markdown
---
bin: ./dist/cli.cjs
env:
  NO_COLOR: "1"
timeout: 30000
---

# Markform CLI Command Tests

This file tests all Markform CLI commands for correct output and exit codes.

---

## Global Options

### --version shows version number

\`\`\`console
$ markform --version
[VERSION]
? 0
\`\`\`

### --help shows usage summary

\`\`\`console
$ markform --help
Usage: markform [options] [command]

Agent-friendly, human-readable, editable forms

Options:
  --version                   output the version number
  --verbose                   Enable verbose output
...
  -h, --help                  display help for command

Commands:
  readme [options]            [..]
...
? 0
\`\`\`

---

## Documentation Commands

### readme displays README

\`\`\`console
$ markform readme | head -20
# Markform
...
? 0
\`\`\`

### docs shows syntax reference

\`\`\`console
$ markform docs | head -10
# Markform Syntax Reference
...
? 0
\`\`\`

### spec shows full specification

\`\`\`console
$ markform spec | head -10
# Markform Specification
...
? 0
\`\`\`

### apis shows TypeScript API docs

\`\`\`console
$ markform apis | head -10
# Markform API Documentation
...
? 0
\`\`\`

---

## Inspection Commands

### inspect on empty form

\`\`\`console
$ markform inspect examples/simple/simple.form.md
Form Inspection Report
Title: Simple Test Form

Form State: [..]

Structure:
  Groups: 8
  Fields: 21
  Options: 15

Progress:
  Total fields: 21
  Required: 12
...
? 0
\`\`\`

### inspect on filled form

\`\`\`console
$ markform inspect examples/simple/simple-mock-filled.form.md
Form Inspection Report
Title: Simple Test Form

Form State: [..]

Structure:
  Groups: 8
  Fields: 21
  Options: 15
...
? 0
\`\`\`

### status shows fill progress

\`\`\`console
$ markform status examples/simple/simple.form.md
Form Status: simple.form.md

Overall: 0/21 fields filled (0%)
  [..]

By Role:
  user: 0/21 filled (0%) [..]

Run Mode: interactive (explicit)
Suggested: markform fill simple.form.md --interactive
? 0
\`\`\`

### validate shows issues

\`\`\`console
$ markform validate examples/simple/simple.form.md
Form Validation Report
Title: Simple Test Form

Form State: [..]
...

Issues ([..]):
...
? 0
\`\`\`

### dump shows field values

\`\`\`console
$ markform dump examples/simple/simple-mock-filled.form.md
name: "Alice Johnson"
email: "alice@example.com"
age: 32
...
? 0
\`\`\`

---

## Export Commands

### export --format yaml

\`\`\`console
$ markform export examples/simple/simple.form.md --format yaml | head -20
schema:
  id: simple_test
  title: Simple Test Form
...
? 0
\`\`\`

### export --format json

\`\`\`console
$ markform export examples/simple/simple.form.md --format json | head -5
{
  "schema": {
    "id": "simple_test",
...
? 0
\`\`\`

### schema generates JSON Schema

\`\`\`console
$ markform schema examples/simple/simple.form.md | head -10
{
  "$schema": "http://json-schema.org/draft-07/schema#",
...
? 0
\`\`\`

### report generates filtered markdown

\`\`\`console
$ markform report examples/simple/simple-mock-filled.form.md | head -20
# Simple Test Form

## Basic Fields
...
? 0
\`\`\`

---

## Utility Commands

### examples --list shows available examples

\`\`\`console
$ markform examples --list
Available examples:
...
? 0
\`\`\`

### models lists available providers

\`\`\`console
$ markform models
Available AI Providers
...
? 0
\`\`\`

---

## Error Handling

### missing file returns error

\`\`\`console
$ markform inspect nonexistent.form.md
[..]
? 1
\`\`\`

### invalid file returns error

\`\`\`console
$ echo "not a form" | markform inspect /dev/stdin
[..]
? 1
\`\`\`
```

### workflows.tryscript.md Structure

```markdown
---
bin: ./dist/cli.cjs
env:
  NO_COLOR: "1"
timeout: 30000
---

# Markform CLI Workflow Tests

Tests for multi-step CLI workflows.

---

## Form Modification Workflow

### apply patches then inspect

\`\`\`console
$ cp examples/simple/simple.form.md /tmp/test.form.md
$ markform apply /tmp/test.form.md --patch '[{"op":"set_string","fieldId":"name","value":"Test User"}]'
...
$ markform dump /tmp/test.form.md | grep name
name: "Test User"
? 0
\`\`\`

---

## Export Workflow

### export all formats

\`\`\`console
$ markform export examples/simple/simple-mock-filled.form.md --format yaml > /tmp/out.yaml && echo "yaml ok"
yaml ok
$ markform export examples/simple/simple-mock-filled.form.md --format json > /tmp/out.json && echo "json ok"
json ok
$ markform export examples/simple/simple-mock-filled.form.md --format markdown > /tmp/out.md && echo "md ok"
md ok
? 0
\`\`\`
```

---

## Implementation Phases

### Phase 1: Setup (Minimal)

- [ ] Create `tryscript.config.ts`
- [ ] Create `tests/cli/` directory
- [ ] Add npm scripts to package.json
- [ ] Create minimal `commands.tryscript.md` with 5 commands
- [ ] Verify `npm run test:tryscript` works

### Phase 2: Core Commands

- [ ] Add all documentation commands (readme, docs, spec, apis)
- [ ] Add all inspection commands (inspect, dump, status, validate)
- [ ] Add all export commands (export, schema, report)
- [ ] Run `--update` to capture expected output

### Phase 3: Workflows and Edge Cases

- [ ] Create `workflows.tryscript.md`
- [ ] Add apply command tests
- [ ] Add examples command tests
- [ ] Add error case tests (missing files, invalid input)
- [ ] Add `models` command tests

### Phase 4: CI Integration

- [ ] Add tryscript to CI workflow
- [ ] Document test update process in development.md
- [ ] Consider c8 coverage integration

---

## Outstanding Questions

1. **Vitest integration vs standalone?** Recommend standalone initially for simplicity; Vitest integration can be added later if coverage tracking is needed.

2. **Where to put test files?** Recommend `tests/cli/` to parallel existing `tests/unit/` and `tests/golden/`.

3. **How to handle piped output?** Tryscript supports pipes (`|`), so commands like `markform readme | head -20` work.

4. **Multi-line commands?** Tryscript supports continuation with `> ` prefix for multi-line commands.

---

## References

- [Tryscript README](https://github.com/jlevy/tryscript)
- [trycmd (Rust original)](https://github.com/assert-rs/trycmd)
- Current CLI tests: `packages/markform/tests/unit/cli/`
- Golden tests: `packages/markform/tests/golden/`
