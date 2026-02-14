# Feature: CLI `set` Command and `apply --context` for Streamlined Form Filling

**Date:** 2026-02-14

**Author:** Joshua Levy / Claude

**Status:** Draft

## Overview

Add a `markform set` command and a `--context` flag on `apply` to enable streamlined,
non-interactive, scriptable form filling from the CLI. This makes CLI form filling as
seamless as the programmatic API and AI SDK tools, enabling use from Claude Code skills
and other agent frameworks.

Today, CLI form filling requires either a TTY-interactive session (`fill --interactive`)
or manually constructing typed JSON patch blobs (`apply --patch`). Neither is suitable
for agent skills. The `set` command and `--context` flag eliminate the need for agents to
know internal patch operation types by leveraging the existing value coercion layer.

## Goals

- Single-field CLI set with auto-coercion: `markform set form.md name "Alice" -o form.md`
- Bulk set via input context: `markform apply form.md --context '{"name":"Alice","age":30}'`
- Systematic mapping from all 16 patch operations to CLI-friendly `set` invocations
- Compound value support (tables, checkboxes, multi-select) with clear CLI syntax
- Atomic read-then-write file operations to minimize conflict window for concurrent agents
- Structured feedback (issues, progress) after each operation
- Zero knowledge of internal patch types required by the caller

## Non-Goals

- Replacing `apply --patch` (it remains for full control over typed patches)
- Interactive TTY prompts (that's `fill --interactive`)
- LLM-based filling (that's `fill --model`)
- File locking or distributed coordination (last-write-wins is acceptable)

## Background

### Current CLI form-filling methods

| Method | Requires | Agent-friendly? |
|---|---|---|
| `fill --interactive` | TTY, human at keyboard | No |
| `fill --model <id>` | LLM API key, full harness | Overkill for known values |
| `apply --patch '<json>'` | Knowledge of patch ops, JSON construction | Functional but brittle |
| Programmatic `fillForm()` | TypeScript runtime | Yes, but not CLI |
| AI SDK tools | Vercel AI SDK | Yes, but not CLI |

### The coercion layer already exists

`valueCoercion.ts` provides `coerceToFieldPatch(form, fieldId, rawValue)` and
`coerceInputContext(form, inputContext)`. These functions look up the field kind from the
schema and auto-coerce raw values (strings, numbers, booleans, arrays, objects) to the
correct typed patch. All the hard work is done.

### Atomic file operations for concurrent agents

When two agents modify the same form file concurrently, we want to minimize the conflict
window. The approach:

1. **Parse phase** (can be slow): Read form, parse, validate, compute coercion
2. **Atomic apply phase** (must be fast): Re-read file, re-parse, apply patches,
   write immediately

The re-read ensures we apply patches against the latest file state, not a stale copy.
The write follows immediately, so the window for conflicts is only the time to read +
parse + serialize + write (typically <50ms). This is a last-write-wins strategy — no
file locking needed.

## Design

### New command: `markform set`

```
markform set <file> <fieldId> <value> [options]

Options:
  -o, --output <file>   Output file (default: modify in place)
  --clear               Clear the field value
  --skip                Skip the field (marks as skipped)
  --abort               Abort the field (marks as unable to complete)
  --role <role>         Role for skip/abort (default: "user")
  --reason <text>       Reason for skip/abort
  --report              Output apply result report (JSON) instead of form
  --format <format>     Output format for --report (default: json)
  --normalize           Regenerate form without preserving external content
```

### New flag on `apply`: `--context`

```
markform apply <file> --context '<json>' [options]

  --context <json>   JSON object of {fieldId: rawValue} pairs (auto-coerced)
```

This is mutually exclusive with `--patch`. When `--context` is used, the values are
coerced via `coerceInputContext()` instead of being validated as typed patches.

### Atomic read-write protocol

Both `set` and `apply --context` use this protocol:

```
1. Read file, parse form (may be slow — schema analysis, validation)
2. Compute patches from raw values via coercion layer
3. Validate patches will apply cleanly (dry-run against parsed form)
4. --- ATOMIC SECTION START ---
5. Re-read file from disk (fresh read)
6. Re-parse form
7. Apply patches to fresh form
8. Serialize and write to output file immediately
9. --- ATOMIC SECTION END ---
```

Steps 5-8 are the critical section. No other work happens between the re-read and the
write. For `--output` pointing to a different file, the re-read is unnecessary (no
conflict possible), so we skip steps 5-6 and use the form from step 2.

For in-place modifications (output === input), the atomic section ensures we read the
latest state before writing. This is the minimum viable concurrency strategy: no locks,
last-write-wins, sub-50ms conflict window.

### Systematic mapping: Patch operations to `set` CLI syntax

This is the complete mapping from every patch operation to its `set` command equivalent.
The coercion layer handles type inference from the field schema.

#### Scalar fields (value is a single CLI argument)

| Field Kind | Patch Op | CLI `set` Syntax | Example |
|---|---|---|---|
| `string` | `set_string` | `set <file> <id> "<value>"` | `set f.md name "Alice Smith"` |
| `number` | `set_number` | `set <file> <id> <value>` | `set f.md age 30` |
| `url` | `set_url` | `set <file> <id> "<url>"` | `set f.md website "https://x.com"` |
| `date` | `set_date` | `set <file> <id> "<YYYY-MM-DD>"` | `set f.md event_date "2025-06-15"` |
| `year` | `set_year` | `set <file> <id> <YYYY>` | `set f.md founded_year 2020` |

**Coercion behavior for scalars:**
- Strings pass through directly
- Numbers: `"30"` string is coerced to `30` for number/year fields
- Booleans: `"true"` stays as the string `"true"` for string fields

#### Selection fields (value is an option ID or list of IDs)

| Field Kind | Patch Op | CLI `set` Syntax | Example |
|---|---|---|---|
| `single_select` | `set_single_select` | `set <file> <id> <optionId>` | `set f.md priority high` |
| `multi_select` | `set_multi_select` | `set <file> <id> '<json-array>'` | `set f.md categories '["frontend","backend"]'` |

**Coercion behavior for selections:**
- `single_select`: Raw string is validated against option IDs. Error lists valid options if invalid.
- `multi_select`: Accepts JSON array of option IDs. A single string is coerced to `["string"]` with a warning.

#### List fields (value is a JSON array)

| Field Kind | Patch Op | CLI `set` Syntax | Example |
|---|---|---|---|
| `string_list` | `set_string_list` | `set <file> <id> '<json-array>'` | `set f.md tags '["rust","wasm","perf"]'` |
| `url_list` | `set_url_list` | `set <file> <id> '<json-array>'` | `set f.md refs '["https://a.com","https://b.com"]'` |

**Coercion behavior for lists:**
- JSON array of strings passes through
- Single string is coerced to single-element array with a warning
- Non-string array items are coerced to strings where possible

#### Checkbox fields (value is a JSON object or array)

| Field Kind | Patch Op | CLI `set` Syntax | Example |
|---|---|---|---|
| `checkboxes` (multi) | `set_checkboxes` | `set <file> <id> '<json-object>'` | `set f.md tasks '{"research":"done","design":"active","test":"todo"}'` |
| `checkboxes` (simple) | `set_checkboxes` | `set <file> <id> '<json-object-or-array>'` | `set f.md agreements '["read_guidelines","agree_terms"]'` |
| `checkboxes` (explicit) | `set_checkboxes` | `set <file> <id> '<json-object>'` | `set f.md confirms '{"backed_up":"yes","notified":"no"}'` |

**Coercion behavior for checkboxes:**

This is the most complex compound type. The coercion layer handles three input shapes:

1. **Object with state values** (explicit control):
   ```json
   {"research": "done", "design": "active", "test": "todo"}
   ```
   Valid states depend on `checkboxMode`:
   - `multi` (default): `todo`, `done`, `incomplete`, `active`, `na`
   - `simple`: `todo`, `done`
   - `explicit`: `unfilled`, `yes`, `no`

2. **Array of option IDs** (shorthand for "mark these as done/yes"):
   ```json
   ["research", "design"]
   ```
   Listed options get `done` (multi/simple) or `yes` (explicit). Unlisted stay unchanged.

3. **Object with boolean values** (coerced to state strings):
   ```json
   {"backed_up": true, "notified": false}
   ```
   `true` becomes `done` (multi/simple) or `yes` (explicit).
   `false` becomes `todo` (multi/simple) or `no` (explicit).

#### Table fields (value is a JSON array of row objects)

| Field Kind | Patch Op | CLI `set` Syntax | Example |
|---|---|---|---|
| `table` | `set_table` | `set <file> <id> '<json-array>'` | See below |

**Table example (team_members with columns: name(string), role(string), start_date(date)):**

```bash
markform set form.md team_members '[
  {"name": "Alice", "role": "Engineer", "start_date": "2024-01-15"},
  {"name": "Bob", "role": "PM"}
]'
```

**Coercion behavior for tables:**
- Value must be a JSON array of row objects
- Each row is a `Record<columnId, CellValue | null>`
- Missing columns in a row are treated as empty/skipped
- `null` values become `%SKIP%` sentinel on serialization
- Cell values are `string | number` matching `columnTypes` from the field schema
- Empty array `[]` clears the table (valid when `minRows=0`)

**Table column types and per-cell coercion:**

Table fields define `columnTypes` per column. Each cell value should match its column
type, but the coercion layer is lenient:

| Column Type | Accepts | Example |
|---|---|---|
| `string` | String, number (coerced to string) | `"Alice"`, `42` -> `"42"` |
| `number` | Number, numeric string | `9.3`, `"9.3"` -> `9.3` |
| `url` | String (URL format) | `"https://example.com"` |
| `date` | String (ISO 8601) | `"2024-01-15"` |
| `{type: "string", required: true}` | Same as string, but row invalid if missing | `"Alice"` |

#### Meta operations (not value-setting)

| Patch Op | CLI `set` Syntax | Example |
|---|---|---|
| `clear_field` | `set <file> <id> --clear` | `set f.md name --clear` |
| `skip_field` | `set <file> <id> --skip [--reason "..."]` | `set f.md notes --skip --reason "N/A"` |
| `abort_field` | `set <file> <id> --abort [--reason "..."]` | `set f.md score --abort --reason "Data unavailable"` |
| `add_note` | Not in `set` (use `apply --patch`) | Full patch syntax only |
| `remove_note` | Not in `set` (use `apply --patch`) | Full patch syntax only |

`add_note` and `remove_note` are excluded from `set` because they operate on form
elements (not just fields) and have a different structure (`ref` instead of `fieldId`,
`noteId` for removal). They remain available via `apply --patch`.

### Value parsing logic in `set` command

The `set` command receives `<value>` as a CLI string argument. It must decide how to
interpret it before passing to the coercion layer:

```
1. If value starts with '[' or '{': parse as JSON
2. If value is "true" or "false": pass as boolean
3. If value is a valid number (and not quoted): pass as number
4. Otherwise: pass as string
```

This means:
- `markform set f.md age 30` -> coercion receives number `30`
- `markform set f.md name "30"` -> coercion receives string `"30"`
- `markform set f.md tags '["a","b"]'` -> coercion receives array `["a","b"]`
- `markform set f.md priority high` -> coercion receives string `"high"`

The coercion layer then converts based on the field's kind (from the schema). If the
raw type doesn't match, coercion either converts automatically (string "30" -> number 30
for a number field) or returns an error with helpful context.

### Output and feedback

Both `set` and `apply --context` default to writing the modified form.

With `--report`, they output a JSON report identical to `apply --report`:

```json
{
  "apply_status": "applied",
  "form_state": "incomplete",
  "is_complete": false,
  "progress": { "counts": { ... } },
  "issues": [ ... ]
}
```

This gives agents structured feedback: what issues remain, whether the form is complete,
etc. An agent skill loop becomes:

```bash
# 1. Inspect to get field IDs and current state
markform inspect form.md --format json

# 2. Set fields one at a time (or bulk via --context)
markform set form.md name "Alice" -o form.md
markform set form.md age 30 -o form.md
markform set form.md priority high -o form.md

# 3. Check completion
markform inspect form.md --format json
```

Or in a tighter loop with `--report`:

```bash
markform set form.md name "Alice" -o form.md --report --format json
# -> immediately see remaining issues in output
```

### Comparison: `set` vs `apply --patch` vs `apply --context`

| Aspect | `set` | `apply --patch` | `apply --context` |
|---|---|---|---|
| Fields per call | 1 | N (batch) | N (batch) |
| Type knowledge needed | None | Must know op per kind | None |
| Value format | CLI arg (auto-parsed) | Typed JSON patch array | Raw JSON key-value |
| Compound types | JSON string arg | Full patch JSON | Raw JSON values |
| Meta ops (skip/abort/clear) | `--skip`/`--abort`/`--clear` flags | Full patch object | Not supported |
| Notes (add/remove) | Not supported | Full patch object | Not supported |
| Error messages | Coercion errors + valid options | Zod schema errors | Coercion errors |
| Best for | Agent skills, scripting | Full control, complex patches | Bulk pre-fill |

## Implementation Plan

### Phase 1: `set` command and `apply --context`

- [ ] Add `parseCliValue(rawString)` utility to parse CLI value argument
  (JSON detect, number detect, boolean detect, string fallback)
- [ ] Add `registerSetCommand()` in `src/cli/commands/set.ts`
  - Parse `<fieldId>` and `<value>` args
  - Handle `--clear`, `--skip`, `--abort` flags
  - Call `coerceToFieldPatch()` for value operations
  - Implement atomic read-write protocol for in-place modifications
  - Output modified form or `--report` JSON
- [ ] Add `--context` option to `registerApplyCommand()`
  - Mutually exclusive with `--patch`
  - Parse JSON, call `coerceInputContext()`
  - Reuse existing apply + report logic
- [ ] Implement atomic read-write helper function
  - `atomicApplyToFile(filePath, patches, options)` — re-reads, re-parses, applies, writes
  - Used by both `set` and `apply --context` when output === input
  - When output is a different file, skip the re-read (no conflict possible)
- [ ] Register `set` command in CLI program (`bin.ts` or `commands/index.ts`)
- [ ] Add unit tests for `parseCliValue()`
- [ ] Add tryscript CLI tests for `set` command (all field kinds)
- [ ] Add tryscript CLI tests for `apply --context`
- [ ] Update `markform docs` / quick reference to include `set` command

## Testing Strategy

### Unit tests

- `parseCliValue()`: number detection, JSON detection, boolean detection, string fallback
- Atomic read-write helper: verify re-read behavior, verify no re-read for different output

### Tryscript CLI tests

One test per field kind for `set`:

```bash
markform set form.md name "Alice" -o /tmp/test.md
markform set form.md age 30 -o /tmp/test.md
markform set form.md priority high -o /tmp/test.md
markform set form.md categories '["frontend","backend"]' -o /tmp/test.md
markform set form.md tags '["rust","wasm"]' -o /tmp/test.md
markform set form.md tasks '{"research":"done","design":"todo"}' -o /tmp/test.md
markform set form.md agreements '["read_guidelines"]' -o /tmp/test.md
markform set form.md website "https://example.com" -o /tmp/test.md
markform set form.md event_date "2025-06-15" -o /tmp/test.md
markform set form.md founded_year 2020 -o /tmp/test.md
markform set form.md team_members '[{"name":"Alice","role":"Eng"}]' -o /tmp/test.md
markform set form.md name --clear -o /tmp/test.md
markform set form.md notes --skip -o /tmp/test.md
```

Error case tests:
```bash
markform set form.md nonexistent_field "value"  # -> field not found
markform set form.md priority "invalid_option"  # -> lists valid options
markform set form.md age "not_a_number"         # -> coercion error
```

Tests for `apply --context`:
```bash
markform apply form.md --context '{"name":"Alice","age":30,"priority":"high"}' --report --format json
```

### Golden tests

Not needed for this feature — the coercion layer already has comprehensive golden
test coverage via the existing `fillForm()` tests.

## Open Questions

- Should `set` support setting multiple fields in one call via repeated args?
  e.g., `markform set form.md name "Alice" age 30 priority high`
  (Decision: No, keep it single-field for simplicity. Use `apply --context` for bulk.)

- Should `set` default to in-place modification or stdout?
  (Decision: Default to in-place when `-o` is not specified, matching the mental model
  of "set a field in this form". Use `--dry-run` to preview without writing.)

## References

- `packages/markform/src/engine/valueCoercion.ts` — coercion layer (core of this feature)
- `packages/markform/src/cli/commands/apply.ts` — existing apply command
- `packages/markform/src/cli/commands/fill.ts` — interactive and agent fill
- `packages/markform/src/engine/coreTypes.ts` — Patch types (lines 838-979)
- `packages/markform/src/integrations/vercelAiSdkTools.ts` — AI SDK tool patterns
