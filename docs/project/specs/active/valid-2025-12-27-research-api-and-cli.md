# Feature Validation: Research API and CLI Command

## Purpose

This validation spec documents the testing performed for the Research API and CLI feature,
and lists manual validation steps for the user to confirm the implementation is adequate.

**Feature Plan:** [plan-2025-12-27-research-api-and-cli.md](plan-2025-12-27-research-api-and-cli.md)

**Implementation Plan:** N/A (implementation was done directly from the plan spec)

## Stage 4: Validation Stage

## Automated Validation (Testing Performed)

### Unit Testing

All 580 tests pass including new and updated tests:

**New Test Files:**
- `tests/unit/llms.test.ts` (14 tests)
  - Tests `SUGGESTED_LLMS` contains all major providers
  - Tests `formatSuggestedLlms()` returns formatted string
  - Tests `WEB_SEARCH_CONFIG` defines config for all providers
  - Tests `hasWebSearchSupport()` for supported/unsupported providers
  - Tests `getWebSearchConfig()` returns correct config or undefined

**Updated Test Files:**
- `tests/unit/engine/coreTypes.test.ts` - Updated for `maxIssuesPerTurn` rename
- `tests/unit/engine/session.test.ts` - Updated for `max_issues_per_turn` in YAML
- `tests/unit/harness/harness.test.ts` - Updated for `maxIssuesPerTurn` rename
- `tests/golden/golden.test.ts` - Golden tests still pass with updated session files

**Coverage of New Features:**
- LLM settings module (`src/llms.ts`) - fully tested
- Web search support detection - tested for all providers
- `FrontmatterHarnessConfig` type - validated via TypeScript compilation
- Harness config resolution - validated via existing harness tests
- Research form validation - validated via TypeScript compilation
- Index exports - validated via TypeScript compilation

### Integration and End-to-End Testing

- `tests/integration/programmaticFill.test.ts` (10 tests) - Pass, validates harness loop
- `tests/golden/golden.test.ts` (3 tests) - Golden session tests pass with updated YAML format
- Full precommit suite passes: typecheck, lint, build, test

### Build Verification

- TypeScript compilation: No errors
- ESLint: No errors or warnings
- Bundle build: Successful (565.77 kB total)
- All 17 distribution files generated correctly

## Manual Testing Needed

### 1. Research CLI Command Validation

Test the new `markform research` command end-to-end:

```bash
# Test help output
markform research --help

# Test with a research form (requires OpenAI API key)
markform research examples/political-research/political-research.form.md \
  --model openai/gpt-4o \
  -- name="Abraham Lincoln"

# Verify output files are created:
# - *.form.md (filled form)
# - *.raw.md (plain markdown)
# - *.values.yml (YAML values)
```

**Expected behavior:**
- Help shows all options including `--model`, `--output`, `--input`, `--max-turns`, etc.
- Research executes with web search (observe tool calls in verbose mode)
- Output files contain researched data

### 2. Web Search Model Validation Error

Test that non-web-search models are rejected:

```bash
# This should fail fast with clear error message
markform research examples/political-research/political-research.form.md \
  --model anthropic/claude-sonnet-4-5
```

**Expected error:**
```
Error: runResearch requires a model string identifier (e.g., "openai/gpt-4o")
```

### 3. Examples Command with Research Forms

Test the updated examples command:

```bash
# List examples - should show [fill] and [research] type labels
markform examples --list

# Run a research example interactively
markform examples --name political-research
```

**Expected behavior:**
- List shows `[fill]` for simple, `[research]` for research forms
- When selecting a research form, model picker shows only web-search-capable models
- Prompts: "Run research now? (requires web search)"
- CLI hint suggests `markform research` command for later execution

### 4. Frontmatter Harness Config

Verify frontmatter configuration is respected:

1. Check research form frontmatter has `harness_config`:
   ```bash
   head -30 examples/political-research/political-research.form.md
   ```
   Should show:
   ```yaml
   harness_config:
     max_turns: 10
     max_issues_per_turn: 5
     max_patches_per_turn: 10
   ```

2. Run research and verify config is used (check verbose output or turn counts)

### 5. Research Example Forms

Verify all research example forms have been updated:

```bash
# Check each form has harness_config
grep -l "harness_config" examples/*/\*.form.md
```

**Expected:** All research forms should appear:
- `examples/political-research/political-research.form.md`
- `examples/earnings-analysis/earnings-analysis.form.md`
- `examples/startup-deep-research/startup-deep-research.form.md`
- `examples/celebrity-deep-research/celebrity-deep-research.form.md`

### 6. Fill Command Still Works

Verify the fill command still works correctly after the `maxIssues` → `maxIssuesPerTurn` rename:

```bash
# Quick validation
markform fill examples/simple/simple.form.md --model anthropic/claude-sonnet-4-5 --dry-run
```

### 7. API Exports

Verify the new research API is exported correctly:

```typescript
// Test in a Node.js REPL or script
import {
  runResearch,
  ResearchResult,
  ResearchOptions,
  ResearchStatus,
  isResearchForm,
  validateResearchForm,
  resolveHarnessConfig,
  FrontmatterHarnessConfig
} from 'markform';

// Should all be defined
console.log(typeof runResearch);          // 'function'
console.log(typeof isResearchForm);       // 'function'
console.log(typeof validateResearchForm); // 'function'
console.log(typeof resolveHarnessConfig); // 'function'
```

## Post-Validation Checklist

- [ ] Research CLI command executes successfully with OpenAI/Google/xAI model
- [ ] Non-web-search models are rejected with clear error
- [ ] Examples command shows correct type labels ([fill]/[research])
- [ ] Research examples prompt for web-search-capable models only
- [ ] Frontmatter harness_config is present in all research forms
- [ ] Fill command still works correctly
- [ ] API exports are accessible from the package
- [ ] Web search tool is called during research execution

## Feedback and Revisions

(To be filled in after user validation)
