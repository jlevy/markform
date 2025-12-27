# Feature Validation: Export Formats and Prompt Composition

## Purpose

This is a validation spec for changes driven by beads issues (markform-128,
markform-146, markform-147, markform-123, markform-124) covering export format updates
and live agent prompt composition.

**Feature Plan:** N/A (beads-driven)

**Implementation Plan:** N/A (beads-driven)

## Summary of Changes

1. **Export Format Rename (markform-128):** Renamed ‘markdown’ format to ‘markform’,
   added new ‘markdown’ format for human-readable output without markdoc directives

2. **Fill Command Prompt Flags (markform-146):** Added `--prompt` and `--instructions`
   flags to fill command for custom system prompts

3. **Prompt Composition (markform-147):** Live agent now composes prompts from
   form-level instructions (doc blocks), role instructions (frontmatter), and
   field-level instructions

4. **Testing (markform-123, markform-124):** Added unit tests for doc block edge cases
   and validation edge cases

## Stage 4: Validation Stage

## Validation Planning

## Automated Validation (Testing Performed)

### Unit Testing

- **serialize.test.ts:** 8 new tests for `serializeRawMarkdown()` covering all field
  types

- **parse.test.ts:** 4 new tests for doc block uniqueness edge cases

- **validate.test.ts:** 5 new tests for checkboxes minDone/multi-mode validation

- **Total:** 271 tests passing (17 new tests added)

### Integration and End-to-End Testing

- Build passes with all exports verified

- Lint passes with no warnings

- Pre-commit hooks (typecheck, lint) pass

- Pre-push hooks (test) pass

### Manual Testing Needed

The following manual validation steps should be performed:

#### 1. Export Command Format Changes

Test the new export formats work correctly:

```bash
# Test default format (markform - canonical with markdoc directives)
pnpm markform export packages/markform/examples/simple/simple.form.md

# Test new markdown format (human-readable, no directives)
pnpm markform export packages/markform/examples/simple/simple.form.md --format markdown

# Test explicit markform format
pnpm markform export packages/markform/examples/simple/simple.form.md --format markform

# Test JSON/YAML still work
pnpm markform export packages/markform/examples/simple/simple.form.md --format json
pnpm markform export packages/markform/examples/simple/simple.form.md --format yaml
```

**Expected:**

- `--format markform` (or default): Output contains `{%` and `%}` markdoc directives

- `--format markdown`: Output is clean markdown with `# Title`, `## Group`, `**Label:**`
  format, no `{%` directives

- JSON/YAML: Same as before

#### 2. Fill Command Prompt Flags

Test the new `--prompt` and `--instructions` flags (requires API key):

```bash
# View help to confirm new flags appear
pnpm markform fill --help
```

**Expected:**

- Help shows `--prompt <file>` option

- Help shows `--instructions <text>` option

#### 3. Visual Inspection of Raw Markdown Output

Review the raw markdown output format:

```bash
pnpm markform export packages/markform/examples/simple/simple.form.md --format markdown
```

**Expected format:**

- Form title as `# Title`

- Group titles as `## Group Title`

- Fields as `**Label:**` followed by value or `_(empty)_`

- Doc blocks included as regular markdown text

- No `{%` or `%}` characters in output
