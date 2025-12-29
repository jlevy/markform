# Plan: Examples & Run Commands Redesign

**Date:** 2025-12-29 **Status:** Draft **Scope:** CLI commands, frontmatter schema,
validation

## Summary

Redesign the `examples` command to be copy-only, add a new `run` command for browsing
and running forms, add a `status` command for form inspection per-role, and introduce
`run_mode` to frontmatter schema.

## Goals

1. Separate concerns: `examples` copies, `run` executes

2. Enable users to browse and run their own forms (not just bundled examples)

3. Provide per-role status information via `status` command

4. Explicit `run_mode` in frontmatter (no heuristics)

5. Consistent global options: `--forms-dir`, `--overwrite`

* * *

## Global CLI Options

### Existing: `--forms-dir`

Already exists. Apply consistently to all relevant commands.

```
--forms-dir <dir>   Directory for form output (default: ./forms)
```

### New: `--overwrite`

Add as global option.
When set, overwrites existing values instead of continuing.

```
--overwrite         Overwrite existing field values (default: continue/skip filled)
```

**Implementation:**

- Add to `cli.ts` global options

- Maps to `fillMode: 'overwrite'` vs `'continue'`

- Remove any confirmation prompts for pre-filled forms

- Log info when form has pre-filled values: `ℹ Form has 5 pre-filled fields
  (continuing)` or `(overwriting)`

* * *

## Command: `examples` (Phase 1 - Copy Only)

### New Behavior

```bash
markform examples              # Copy all bundled examples to ./forms/
markform examples --list       # List bundled examples (no copy)
markform examples --name=foo   # Copy specific example only
```

### Flow

1. If `--list`: print example list and exit

2. Log: `Copying N example forms to ./forms/...`

3. For each example:

   - Copy to `./forms/{filename}`

   - Log: ` ✓ movie-research-deep.form.md`

   - If file exists and no `--overwrite`: skip with warning

4. Log: `Done. Run 'markform run' to try one.`

### No Confirmations

Remove all `p.confirm()` prompts.
Use `--overwrite` flag instead.

### Changes from Current

| Current | New |
| --- | --- |
| Prompts for confirmation | No prompts |
| Scaffolds + runs form | Copy only |
| Interactive flow | Removed (moved to `run`) |

* * *

## Command: `run` (Phase 2 - Interactive Launcher)

### Usage

```bash
markform run                   # Browse forms, select, run
markform run movie.form.md     # Run specific form directly
markform run --limit=50        # Override menu limit
```

### Flow (No Argument)

1. Scan `--forms-dir` for `*.form.md` files

2. If none found: `No forms found in ./forms/. Run 'markform examples' to get started.`

3. Sort: mtime desc, then alphabetically

4. Limit to `MAX_FORMS_IN_MENU` (30, configurable in settings.ts)

5. Display menu:
   ```
   ? Select a form to run:
   ❯ Movie Research (Deep)          [research]  2h ago
     Earnings Analysis              [research]  1d ago
     Simple Form                    [fill]      3d ago
   ```

6. Parse selected form

7. Determine run mode (see below)

8. Execute appropriate workflow

### Flow (With Argument)

1. Resolve path (relative to `--forms-dir` or absolute)

2. Parse form

3. Determine run mode

4. Execute workflow

### Run Mode Determination

**No heuristics.** Use explicit `run_mode` from frontmatter, with fallback based on
field roles.

```typescript
function determineRunMode(form: ParsedForm): RunMode | Error {
  // 1. Explicit run_mode in frontmatter takes precedence
  const explicitMode = form.metadata?.runMode;
  if (explicitMode) {
    // Validate it matches form structure (see validation section)
    const validation = validateRunMode(form, explicitMode);
    if (!validation.valid) {
      return new Error(validation.error);
    }
    return explicitMode;
  }

  // 2. Infer from field roles (no complex heuristics)
  const roles = getFieldRoles(form);

  if (roles.size === 1 && roles.has('user')) {
    return 'interactive';
  }

  if (roles.size === 1 && roles.has('agent')) {
    // Check if research-configured
    if (isResearchForm(form)) {
      return 'research';
    }
    return 'fill';
  }

  // 3. Mixed roles or unknown - require explicit run_mode
  return new Error(
    `Cannot determine run mode. Form has roles: ${[...roles].join(', ')}. ` +
    `Add 'run_mode' to frontmatter: interactive, fill, or research.`
  );
}
```

### Run Mode Execution

| Mode | Action |
| --- | --- |
| `interactive` | Launch interactive fill (`fill -i` style) |
| `fill` | Prompt for model, run agent fill |
| `research` | Prompt for web-search model, run research fill |

* * *

## Command: `status` (New)

### Purpose

Display form fill status with per-role breakdown.
Complementary to `inspect` (which shows all details).

### Usage

```bash
markform status form.md        # Summary + per-role stats
markform status form.md --json # Machine-readable
```

### Output

```
Form Status: movie-research-deep.form.md

Overall: 12/25 fields filled (48%)
  ✓ Complete: 12
  ○ Empty: 10
  ⊘ Skipped: 2
  ✗ Aborted: 1

By Role:
  user:  3/5 filled   (60%)  ← needs attention
  agent: 9/20 filled  (45%)

Run Mode: research (explicit)
Suggested: markform run movie-research-deep.form.md
```

### Implementation

```typescript
interface StatusReport {
  path: string;
  runMode: RunMode | null;
  runModeSource: 'explicit' | 'inferred' | 'unknown';
  overall: {
    total: number;
    answered: number;
    skipped: number;
    aborted: number;
    unanswered: number;
  };
  byRole: Record<string, {
    total: number;
    answered: number;
    skipped: number;
    aborted: number;
    unanswered: number;
  }>;
  suggestedCommand: string | null;
}
```

* * *

## Frontmatter Schema: `run_mode`

**Note:** `run_mode` has been added to `docs/markform-spec.md` as a *recommended* (not
required) field. It's a hint for CLI tools, not enforced by the engine.

### Schema Addition

Add to `FormMetadata` in `coreTypes.ts`:

```typescript
/** Run mode for the form - determines how 'markform run' executes */
export type RunMode = 'interactive' | 'fill' | 'research';

export interface FormMetadata {
  markformVersion: string;
  roles: string[];
  roleInstructions: Record<string, string>;
  harnessConfig?: FrontmatterHarnessConfig;
  /** How this form should be executed by 'markform run' */
  runMode?: RunMode;
}
```

### Frontmatter Example

```yaml
---
markform:
  title: "Movie Research"
  run_mode: research
  roles:
    - user
    - agent
  role_instructions:
    user: "Enter the movie title"
    agent: "Research the movie details"
---
```

### Validation Rules

`run_mode` must be consistent with form structure:

| run_mode | Validation |
| --- | --- |
| `interactive` | Form MUST have at least one `role="user"` field |
| `fill` | Form MUST have at least one `role="agent"` field |
| `research` | Form MUST have at least one `role="agent"` field |

**Validation error if mismatch:**

```
Validation error: run_mode="interactive" but form has no user-role fields.
Available roles in form: agent
```

### Parser Changes

- Add `runMode` to `FormMetadata` parsing in `parse.ts`

- Add `RunModeSchema` Zod schema

- Validate run_mode against form structure during parse

* * *

## Settings Additions

Add to `settings.ts`:

```typescript
/** Maximum forms to display in 'markform run' menu */
export const MAX_FORMS_IN_MENU = 30;

/** Run modes for forms */
export type RunMode = 'interactive' | 'fill' | 'research';
```

* * *

## Info Logging

### Pre-filled Forms

When running a form with existing values:

```
ℹ Form has 5 pre-filled fields (continuing with unfilled)
```

Or with `--overwrite`:

```
ℹ Form has 5 pre-filled fields (overwriting all)
```

### Run Mode Detection

```
ℹ Run mode: research (from frontmatter)
```

Or:

```
ℹ Run mode: fill (inferred: all fields are agent role)
```

* * *

## Test Plan

### Unit Tests

1. **run_mode validation**

   - `run_mode=interactive` with no user fields → error

   - `run_mode=fill` with no agent fields → error

   - `run_mode=research` with no agent fields → error

   - Valid combinations pass

2. **run mode inference**

   - All user fields → interactive

   - All agent fields → fill

   - All agent fields + isResearchForm → research

   - Mixed roles + no run_mode → error

3. **status command output**

   - Per-role counts are accurate

   - Overall counts match sum of roles

   - suggestedCommand is correct

### Integration Tests

1. **examples command**

   - Copies all examples to forms dir

   - Skips existing without --overwrite

   - Overwrites with --overwrite

   - --list prints list without copying

2. **run command**

   - Menu shows forms sorted by mtime

   - Respects --limit

   - Direct path argument works

   - Errors gracefully on invalid run_mode

* * *

## Migration

### Bundled Examples

Add `run_mode` to all bundled example forms:

| Example | run_mode |
| --- | --- |
| simple.form.md | fill |
| movie-research-*.form.md | research |
| earnings-analysis.form.md | research |
| startup-deep-research.form.md | research |

### Existing User Forms

Forms without `run_mode` will use inference.
If inference fails, user gets helpful error message.

* * *

## Implementation Order

1. **Global options**: Add `--overwrite` to cli.ts

2. **Schema**: Add `RunMode` type and `runMode` to FormMetadata

3. **Parser**: Parse and validate `run_mode` from frontmatter

4. **Validation**: Add run_mode vs form structure validation

5. **status command**: New command with per-role stats

6. **examples refactor**: Make copy-only, remove interactive flow

7. **run command**: New command with menu + execution

8. **Migrate examples**: Add run_mode to bundled forms

9. **Update docs**: README, DOCS.md

* * *

## Open Questions (Resolved)

| Question | Resolution |
| --- | --- |
| Confirmations for overwrite? | No - use `--overwrite` flag |
| Complex run_mode heuristics? | No - explicit or simple role-based inference |
| Per-role status? | Yes - `status` command |
| Validation for run_mode? | Yes - must match form structure |
