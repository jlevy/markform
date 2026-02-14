# Feature: CLI `set` Command, `apply --context`, and Agent-Friendly CLI Workflow

**Date:** 2026-02-14 (last updated 2026-02-14)

**Author:** Joshua Levy / Claude

**Status:** Ready for Review

## Overview

Add CLI commands that let an external agent (Claude Code skill, shell script, etc.) fill
markform forms with the same power and guided workflow as the TypeScript harness + AI SDK
tools, but entirely through shell invocations. Three new capabilities:

1. **`markform set`** — Set a single field value with auto-coercion.
2. **`markform apply --context`** — Bulk-set multiple fields from a JSON key-value map.
3. **`markform next`** — The CLI equivalent of `harness.step()`: returns the prioritized,
   filtered list of fields to fill next, with concrete examples and field metadata.

Together these give an external agent the same step-apply-step loop the internal harness
uses, but decomposed into independent CLI calls that the agent orchestrates.

## Goals

- Single-field CLI set with auto-coercion: `markform set form.md name "Alice"`
- Bulk set via input context: `markform apply form.md --context '{"name":"Alice","age":30}'`
- CLI equivalent of the harness step cycle (`next` -> `set`/`apply --context` -> `next`)
- Systematic mapping from all patch operations to CLI-friendly syntax
- Compound value support (tables, checkboxes, multi-select) with clear CLI syntax
- Structured JSON feedback after each operation (issues, progress, completion status)
- Zero knowledge of internal patch types required by the caller
- Harness-aware field ranking: order levels, priority, scope limits

## Non-Goals

- Replacing `apply --patch` (it remains for full control over typed patches)
- Interactive TTY prompts (that's `fill --interactive`)
- LLM-based filling (that's `fill --model`)
- File locking or distributed coordination (last-write-wins is acceptable)
- Maintaining stateful session across CLI calls (each call is stateless; the form file
  IS the state)
- **Fill records from CLI operations** — CLI form-filling commands (`set`,
  `apply --context`, `next`) do NOT produce fill records. Fill records are exclusively
  for harness-driven filling via the `fill` command and programmatic `fillForm()` API.
  See [Fill Record Policy](#fill-record-policy) for rationale.

---

## Background

### How the internal harness loop works today

The internal harness (`FormHarness`) implements a state machine:

```
INIT -> STEP -> WAIT -> APPLY -> (repeat) -> COMPLETE
```

Each cycle:

1. **`harness.step()`** — Inspects the form, computes all issues (missing required
   fields, incomplete checkboxes, etc.), then applies a three-stage filtering pipeline:

   a. **Order filtering** — Only surfaces issues for the lowest incomplete order level.
      Fields at higher `order` levels are deferred until all lower-order fields complete.

   b. **Scope filtering** — If `maxFieldsPerTurn` or `maxGroupsPerTurn` is configured,
      limits how many distinct fields/groups appear in the issue set.

   c. **Count cap** — `slice(0, maxIssuesPerTurn)` (default 10).

   Returns a `StepResult` with filtered issues, step budget, completion status.

2. **Agent generates patches** — The agent sees each issue enriched with:
   - Field ID, kind, severity, priority (P1-P5)
   - Option IDs (for select/checkbox fields)
   - Checkbox mode (`simple`/`multi`/`explicit`)
   - Column definitions (for table fields)
   - Concrete patch format example with actual field IDs and option IDs
   - Skip instruction for optional fields

3. **`harness.apply(patches)`** — Applies patches with best-effort semantics (valid
   patches succeed even if some fail). Re-inspects form. Returns updated `StepResult`
   with `patchesApplied` count and `rejectedPatches` details.

4. **Repeat** until `isComplete` (zero issues remain) or `maxTurns` reached.

### Priority scoring

Priority is computed from two factors:

| Factor | Values |
|---|---|
| Field priority weight | high=3, medium=2 (default), low=1 |
| Issue type score | required_missing=3, validation_error=2, checkbox_incomplete=2-3, min_items_not_met=2, optional_unanswered=1 |

Total score maps to tiers: P1 (>=5), P2 (>=4), P3 (>=3), P4 (>=2), P5 (>=1).

Within each tier: required before recommended, higher score first, then alphabetical.

### What the AI SDK tools expose (for comparison)

The standalone AI SDK integration (`vercelAiSdkTools.ts`) exposes four tools operating
on a shared session store:

| Tool | Purpose | Maps to CLI... |
|---|---|---|
| `markform_inspect` | Get structure, progress, issues, completion | `inspect --format json` |
| `markform_apply` | Apply typed patches (1-20) | `apply --patch` |
| `markform_export` | Export schema + values as JSON | `inspect --format json` (values section) |
| `markform_get_markdown` | Get canonical markdown | `cat form.md` |

**What's missing from the CLI:** The AI SDK tools require the agent to know typed patch
operations (`set_string`, `set_number`, etc.). The internal harness gives even more
guidance: concrete patch examples per field, filtered/prioritized issue lists, and the
step-by-step loop. Neither maps cleanly to the current CLI.

### What the `inspect` command provides today

`markform inspect form.md --format json` returns:

```json
{
  "title": "...",
  "structure": { "fields_by_id": { "name": "string", "age": "number", ... }, ... },
  "progress": { "counts": { "total_fields": 21, "empty_required_fields": 12, ... }, ... },
  "values": { ... },
  "issues": [
    { "ref": "name", "scope": "field", "reason": "required_missing",
      "message": "Required field \"Name\" is empty", "priority": 1, "severity": "required" }
  ],
  "form_state": "empty"
}
```

This is useful but lacks:
- Harness-aware filtering (order levels, max fields/groups per turn)
- Field metadata per issue (kind, options, checkbox mode, column defs)
- Concrete `set` command examples
- Step budget / turn guidance

### Current CLI form-filling methods

| Method | Requires | Agent-friendly? |
|---|---|---|
| `fill --interactive` | TTY, human at keyboard | No |
| `fill --model <id>` | LLM API key, full harness | Overkill for known values |
| `apply --patch '<json>'` | Knowledge of patch ops, JSON construction | Functional but brittle |
| Programmatic `fillForm()` | TypeScript runtime | Yes, but not CLI |
| AI SDK tools | Vercel AI SDK runtime | Yes, but not CLI |
| **`set` (proposed)** | Just field ID + value | **Yes** |
| **`next` (proposed)** | Nothing (reads form) | **Yes** |

---

## Design

### The CLI agent workflow: `next` -> `set` -> `next` -> ...

The CLI agent workflow mirrors the internal harness loop but is stateless — the form
file on disk IS the state. Each CLI call reads the latest form, operates, writes back.

```
┌─────────────────────────────────────────────────────┐
│                 CLI Agent Loop                       │
│                                                      │
│  1. markform next form.md --format json              │
│     ├── Returns: prioritized issues with metadata    │
│     ├── Each issue has: fieldId, kind, options,      │
│     │   concrete `set` example, severity, priority   │
│     └── Also returns: step budget, completion status │
│                                                      │
│  2. Agent decides what to fill based on issues       │
│                                                      │
│  3. For each field (or batch):                       │
│     ├── markform set form.md <fieldId> <value>       │
│     └── or: markform apply form.md --context '{...}' │
│                                                      │
│  4. If not complete, go to 1                         │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**Key difference from the internal harness:** The CLI workflow is stateless across calls.
There is no persistent turn counter, session transcript, or harness state. Each `next`
call is a fresh inspect + filter. This is simpler and more robust for external agents
that may crash, retry, or interleave with other work.

### New command: `markform next`

The CLI equivalent of `harness.step()`. Inspects the form and returns the prioritized,
filtered list of fields to fill, enriched with field metadata and concrete examples.

```
markform next <file> [options]

Options:
  --roles <roles>           Target roles (comma-separated, default: all)
  --max-fields <n>          Max fields per batch (default: unlimited)
  --max-groups <n>          Max groups per batch (default: unlimited)
  --max-issues <n>          Max issues to return (default: 10)
  --format <format>         Output format (default: console; json for agents)
```

#### JSON output format

```json
{
  "is_complete": false,
  "form_state": "incomplete",
  "step_budget": 5,
  "progress": {
    "total_fields": 21,
    "required_fields": 12,
    "filled_fields": 7,
    "empty_required_fields": 5
  },
  "issues": [
    {
      "ref": "age",
      "scope": "field",
      "reason": "required_missing",
      "message": "Required field \"Age\" is empty",
      "severity": "required",
      "priority": 1,
      "field": {
        "kind": "number",
        "required": true,
        "label": "Age"
      },
      "set_example": "markform set form.md age 30",
      "skip_example": null
    },
    {
      "ref": "priority",
      "scope": "field",
      "reason": "required_missing",
      "message": "Required field \"Priority\" has no selection",
      "severity": "required",
      "priority": 1,
      "field": {
        "kind": "single_select",
        "required": true,
        "label": "Priority",
        "options": ["low", "medium", "high"]
      },
      "set_example": "markform set form.md priority high",
      "skip_example": null
    },
    {
      "ref": "confirmations",
      "scope": "field",
      "reason": "required_missing",
      "message": "All items in \"Confirmations\" must be answered (2 unfilled)",
      "severity": "required",
      "priority": 1,
      "field": {
        "kind": "checkboxes",
        "required": true,
        "label": "Confirmations (Explicit Mode)",
        "checkbox_mode": "explicit",
        "options": ["backed_up", "notified_team"]
      },
      "set_example": "markform set form.md confirmations '{\"backed_up\":\"yes\",\"notified_team\":\"no\"}'",
      "skip_example": null
    },
    {
      "ref": "team_members",
      "scope": "field",
      "reason": "required_missing",
      "message": "Required field \"Team Members\" is empty",
      "severity": "required",
      "priority": 1,
      "field": {
        "kind": "table",
        "required": true,
        "label": "Team Members",
        "columns": [
          { "id": "name", "type": "string", "required": true },
          { "id": "role", "type": "string" },
          { "id": "start_date", "type": "date" }
        ],
        "min_rows": 1,
        "max_rows": 10
      },
      "set_example": "markform set form.md team_members '[{\"name\":\"Alice\",\"role\":\"Eng\",\"start_date\":\"2024-01-15\"}]'",
      "skip_example": null
    },
    {
      "ref": "notes",
      "scope": "field",
      "reason": "optional_unanswered",
      "message": "Optional field not yet addressed",
      "severity": "recommended",
      "priority": 3,
      "field": {
        "kind": "string",
        "required": false,
        "label": "Notes"
      },
      "set_example": "markform set form.md notes \"Some notes here\"",
      "skip_example": "markform set form.md notes --skip --reason \"Not applicable\""
    }
  ]
}
```

#### Console output format

For human use or quick inspection:

```
Form: Simple Test Form
State: incomplete (7/21 fields filled, 5 required remaining)

Next fields to fill (5 issues):

  P1 [required] age (number)
     Required field "Age" is empty
     → markform set form.md age 30

  P1 [required] priority (single_select: low, medium, high)
     Required field "Priority" has no selection
     → markform set form.md priority high

  P1 [required] confirmations (checkboxes/explicit: backed_up, notified_team)
     All items in "Confirmations" must be answered (2 unfilled)
     → markform set form.md confirmations '{"backed_up":"yes","notified_team":"no"}'

  P1 [required] team_members (table: name*, role, start_date)
     Required field "Team Members" is empty
     → markform set form.md team_members '[{"name":"Alice","role":"Eng"}]'

  P3 [recommended] notes (string)
     Optional field not yet addressed
     → markform set form.md notes "Some notes here"
     → markform set form.md notes --skip --reason "Not applicable"
```

#### How `next` relates to `inspect`

| Aspect | `inspect` | `next` |
|---|---|---|
| Purpose | Full form report | Actionable next-step guidance |
| Issues | All issues, flat list | Filtered by order/scope/count, enriched |
| Field metadata | In `structure.fields_by_id` (separate) | Inline per issue |
| Examples | None | Concrete `set` commands per issue |
| Harness settings | None (raw inspect) | Respects max-fields, max-groups, order |
| Completion | `form_state` + `is_complete` | Same, plus `step_budget` |
| Values | Full values dump | Not included (use `inspect` for that) |

`inspect` gives the full picture. `next` gives "what should I do right now?"

### New command: `markform set`

```
markform set <file> <fieldId> [value] [options]

Arguments:
  file                    Form file to modify
  fieldId                 Field ID to set
  value                   Value to set (auto-parsed: JSON, number, boolean, string)

Options:
  -o, --output <file>     Output file (default: modify in place)
  --clear                 Clear the field value
  --skip                  Skip the field (marks as skipped)
  --abort                 Abort the field (marks as unable to complete)
  --role <role>           Role for skip/abort (default: "user")
  --reason <text>         Reason for skip/abort
  --report                Output JSON report after applying (issues, progress)
  --format <format>       Output format for report (default: json)
  --normalize             Regenerate form without preserving external content
```

### New flag on `apply`: `--context`

```
markform apply <file> --context '<json>' [options]

  --context <json>   JSON object of {fieldId: rawValue} pairs (auto-coerced)
```

Mutually exclusive with `--patch`. When `--context` is used, values are coerced via
`coerceInputContext()` instead of being validated as typed patches.

---

### Mapping: Harness cycle to CLI commands

| Harness concept | Internal API | CLI equivalent |
|---|---|---|
| Initialize harness | `new FormHarness(form, config)` | (stateless — form file is the state) |
| Step (get next issues) | `harness.step()` | `markform next form.md --format json` |
| Agent generates patches | LLM tool call | Agent reads `next` output, decides values |
| Apply patches | `harness.apply(patches)` | `markform set` (single) or `apply --context` (batch) |
| Check completion | `stepResult.isComplete` | `next` output has `is_complete: true` |
| Session transcript | `harness.getSessionTranscript()` | Not needed (agent has its own context) |
| Turn budget | `stepResult.stepBudget` | `next` output `step_budget` |
| Rejected patches feedback | `stepResult.rejectedPatches` | `set --report` shows errors inline |
| Order-level gating | `filterIssuesByOrder()` | `next` applies same filter |
| Scope limits | `maxFieldsPerTurn`, `maxGroupsPerTurn` | `next --max-fields`, `next --max-groups` |
| Max issues | `maxIssuesPerTurn` | `next --max-issues` |
| Max turns | `config.maxTurns` | Agent controls its own loop limit |
| Fill mode (overwrite) | `fillMode: 'overwrite'` in config | Not needed (agent explicitly sets values) |

### Example: Complete CLI agent session

```bash
# Step 1: Get the next batch of fields to fill
NEXT=$(markform next form.md --format json --max-fields 5)

# Step 2: Agent reads $NEXT, determines values, fills them
markform set form.md name "Acme Corp"
markform set form.md email "info@acme.com"
markform set form.md age 15
markform set form.md priority high
markform set form.md categories '["frontend","backend"]'

# Step 3: Check what's next
NEXT=$(markform next form.md --format json)
# -> issues now show checkboxes, tables, optional fields

# Step 4: Fill compound fields
markform set form.md confirmations '{"backed_up":"yes","notified_team":"yes"}'
markform set form.md team_members '[{"name":"Alice","role":"Eng","start_date":"2024-01-15"},{"name":"Bob","role":"PM"}]'

# Step 5: Skip optional fields
markform set form.md notes --skip --reason "Not applicable"
markform set form.md optional_number --skip --reason "No data"

# Step 6: Check completion
markform next form.md --format json
# -> { "is_complete": true, "form_state": "complete", "issues": [] }
```

Or more efficiently with `apply --context` for batch operations:

```bash
# Bulk fill in one shot
markform apply form.md --context '{
  "name": "Acme Corp",
  "email": "info@acme.com",
  "age": 15,
  "priority": "high",
  "categories": ["frontend", "backend"],
  "confirmations": {"backed_up": "yes", "notified_team": "yes"},
  "team_members": [{"name": "Alice", "role": "Eng"}]
}' --report --format json

# Check what remains
markform next form.md --format json
```

---

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
- `single_select`: Raw string validated against option IDs. Error lists valid options.
- `multi_select`: JSON array of option IDs. Single string coerced to `["string"]` with warning.

#### List fields (value is a JSON array)

| Field Kind | Patch Op | CLI `set` Syntax | Example |
|---|---|---|---|
| `string_list` | `set_string_list` | `set <file> <id> '<json-array>'` | `set f.md tags '["rust","wasm","perf"]'` |
| `url_list` | `set_url_list` | `set <file> <id> '<json-array>'` | `set f.md refs '["https://a.com","https://b.com"]'` |

**Coercion behavior for lists:**
- JSON array of strings passes through
- Single string coerced to single-element array with warning
- Non-string array items coerced to strings where possible

#### Checkbox fields (value is a JSON object or array)

| Field Kind | Patch Op | CLI `set` Syntax | Example |
|---|---|---|---|
| `checkboxes` (multi) | `set_checkboxes` | `set <file> <id> '<json-object>'` | `set f.md tasks '{"research":"done","design":"active"}'` |
| `checkboxes` (simple) | `set_checkboxes` | `set <file> <id> '<json-object-or-array>'` | `set f.md agreements '["read_guidelines","agree_terms"]'` |
| `checkboxes` (explicit) | `set_checkboxes` | `set <file> <id> '<json-object>'` | `set f.md confirms '{"backed_up":"yes","notified":"no"}'` |

**Coercion behavior for checkboxes:**

Three input shapes are supported:

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
   `true` -> `done`/`yes`. `false` -> `todo`/`no`.

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
- Each row is `Record<columnId, CellValue | null>`
- Missing columns treated as empty/skipped
- `null` values become `%SKIP%` sentinel on serialization
- Cell values are `string | number` matching `columnTypes`
- Empty array `[]` clears the table (valid when `minRows=0`)

**Table column types and per-cell coercion:**

| Column Type | Accepts | Coercion |
|---|---|---|
| `string` | String, number | `42` -> `"42"` |
| `number` | Number, numeric string | `"9.3"` -> `9.3` |
| `url` | String (URL format) | Pass-through |
| `date` | String (ISO 8601) | Pass-through |

#### Meta operations (not value-setting)

| Patch Op | CLI `set` Syntax | Example |
|---|---|---|
| `clear_field` | `set <file> <id> --clear` | `set f.md name --clear` |
| `skip_field` | `set <file> <id> --skip [--reason "..."]` | `set f.md notes --skip --reason "N/A"` |
| `abort_field` | `set <file> <id> --abort [--reason "..."]` | `set f.md score --abort --reason "Unavailable"` |
| `add_note` | Not in `set` (use `apply --patch`) | Full patch syntax only |
| `remove_note` | Not in `set` (use `apply --patch`) | Full patch syntax only |

`add_note`/`remove_note` are excluded from `set` because they operate on form elements
(not just fields) and use `ref`/`noteId` rather than `fieldId`.

### Value parsing logic in `set` command

The `set` command receives `<value>` as a CLI string argument. Parsing order:

```
1. If value starts with '[' or '{': parse as JSON
2. If value is "true" or "false": pass as boolean
3. If value is a valid number: pass as number
4. Otherwise: pass as string
```

The coercion layer then converts based on the field's kind from the schema. Mismatches
are either auto-converted (string "30" -> number 30 for a number field) or produce an
error with helpful context (e.g., listing valid option IDs for a select field).

### Comparison: All CLI form-filling approaches

| Aspect | `next` + `set` | `apply --patch` | `apply --context` | `fill --interactive` | `fill --model` |
|---|---|---|---|---|---|
| Agent-friendly | Yes | Yes (verbose) | Yes | No (TTY) | N/A (autonomous) |
| Type knowledge | None | Full | None | None | None |
| Field guidance | Full (`next`) | None | None | Prompts | Harness prompts |
| Batch support | Per-field | N patches | N fields | Per-field | N per turn |
| Compound types | JSON arg | Full JSON | Raw JSON | Prompts | Harness |
| Meta ops | Flags | Full patch | No | Skip prompts | Harness |
| Completion check | `next` | Separate inspect | `--report` | Automatic | Automatic |
| Best for | CLI agents | Power users | Bulk pre-fill | Humans | LLM filling |

---

### Fill Record Policy

CLI form-filling operations and harness-driven filling serve different purposes and have
different observability needs. The design draws a clear boundary:

**CLI operations (`set`, `apply --context`, `next`) do NOT produce fill records.**

| Path | Produces FillRecord? | Writes `.fill.json`? |
|---|---|---|
| `markform set` | No | No |
| `markform apply --context` | No | No |
| `markform apply --patch` | No | No |
| `markform next` | No (read-only) | No |
| `markform fill --model` (harness) | Yes (always, for summary) | Only with `--record-fill` |
| Programmatic `fillForm()` | Yes (if `recordFill: true`) | Caller's responsibility |

**Rationale:**

1. **No session data to capture.** CLI operations are stateless one-shot commands. There
   is no session, no turns, no LLM calls, no token usage — the data that makes fill
   records valuable doesn't exist.

2. **Maintenance burden.** Tracking CLI operations in a fill record would require
   inventing a different schema (no LLM/tool timeline, no execution threads). This adds
   complexity for little value.

3. **The form file IS the audit trail.** After CLI operations, the form markdown contains
   all values and state. `markform inspect` can show progress at any time. There's no
   information loss.

4. **The agent has its own context.** An external agent (Claude Code, shell script) that
   orchestrates `next` -> `set` -> `next` loops already has its own execution context,
   logs, and audit trail. Duplicating this in a markform-specific format is redundant.

**Empty fill record guard (for the `fill` command):**

When `--record-fill` is set on the `fill` command, the sidecar `.fill.json` file should
NOT be written if the fill record is essentially empty — meaning no actual work was done.
The check is: `timeline.length === 0`. This handles edge cases like:

- Form was already complete when `fill` was invoked
- Agent errored before any turns executed
- Pre-fill configuration failed (already handled: no collector is created)

If at least one turn executed (even if it applied zero patches), the record is written
because the timeline contains useful debugging information.

---

### Workflow Walkthrough

This section traces through the key workflows to show how CLI form filling fits into the
broader system, and where fill records do and don't apply.

#### Workflow 1: External agent fills a form via CLI

An agent (Claude Code skill, shell script, etc.) fills a form using CLI commands. No fill
record is produced — the form file is the state and the agent has its own context.

```
Agent context (Claude Code, script, etc.)
│
├── markform next form.md --format json
│   └── Returns: prioritized issues, set_example per field
│
├── markform set form.md name "Acme Corp"
│   └── Writes form.md in-place. No fill record.
│
├── markform set form.md age 15
│   └── Writes form.md in-place. No fill record.
│
├── markform next form.md --format json
│   └── Returns: remaining issues (name and age gone from list)
│
├── markform apply form.md --context '{"priority":"high","categories":["a","b"]}'
│   └── Bulk set. No fill record.
│
├── markform next form.md --format json
│   └── is_complete: true? Done. Otherwise loop.
│
└── Agent's own audit trail captures the full session.
    No markform fill record needed.
```

#### Workflow 2: Harness-driven fill (LLM agent)

The `fill` command runs the full harness loop with an LLM. A fill record is produced
because there is session/turn/LLM/tool data to capture.

```
markform fill form.md --model anthropic/claude-sonnet-4-5 --record-fill
│
├── Harness creates FillRecordCollector
├── Turn 1: step() → agent sees issues → generates patches → apply()
│   └── Collector records: LLM tokens, tool calls, patches, timing
├── Turn 2: step() → agent sees remaining issues → generates patches → apply()
│   └── Collector records turn 2 data
├── ...
├── Complete: collector.getRecord() → FillRecord
│
├── If timeline.length > 0 AND --record-fill:
│   └── Write form.fill.json (sidecar)
├── If timeline.length === 0 AND --record-fill:
│   └── Skip writing (empty record guard)
│
└── Form written to output path
```

#### Workflow 3: Bulk pre-fill then agent finish

A common pattern: pre-fill known values via CLI, then let an LLM handle the rest.

```
# Phase 1: CLI pre-fill (no fill record)
markform apply form.md --context '{"company":"Acme","ticker":"ACME","sector":"Tech"}'

# Phase 2: Agent finishes remaining fields (fill record captures LLM work)
markform fill form.md --model openai/gpt-4o --record-fill
```

The fill record from Phase 2 accurately reflects only the LLM's work — not the pre-filled
values. This is correct behavior: the record shows what the agent did, not what was given.

#### Workflow 4: Form already complete

```
markform fill form.md --model anthropic/claude-sonnet-4-5 --record-fill
# Harness runs step() → isComplete=true → 0 turns → empty timeline
# Empty record guard: .fill.json NOT written
# Exit code 0 (form is complete)
```

---

## Implementation Plan

### Phase 1: `set` command and `apply --context`

- [ ] Add `parseCliValue(rawString)` utility to parse CLI value argument
  (JSON detect, number detect, boolean detect, string fallback)
- [ ] Add `registerSetCommand()` in `src/cli/commands/set.ts`
  - Parse `<fieldId>` and `<value>` args
  - Handle `--clear`, `--skip`, `--abort` flags with `--role` and `--reason`
  - Call `coerceToFieldPatch()` for value operations
  - Default to in-place modification; `-o` for different output file
  - Output modified form, or `--report` JSON with issues/progress
  - **No fill record** — `set` is a stateless patch operation
- [ ] Add `--context` option to `registerApplyCommand()`
  - Mutually exclusive with `--patch`
  - Parse JSON, call `coerceInputContext()`
  - Reuse existing apply + report logic
  - **No fill record** — same as `--patch`
- [ ] Register `set` command in CLI program
- [ ] Add unit tests for `parseCliValue()`
- [ ] Add CLI tests for `set` command (all field kinds including compound types)
- [ ] Add CLI tests for `apply --context`

### Phase 2: `next` command

- [ ] Add `registerNextCommand()` in `src/cli/commands/next.ts`
  - Read form, call `inspect()` with target roles
  - Apply three-stage filtering (reuse harness logic or extract into shared utility):
    order filtering, scope filtering, count cap
  - Enrich each issue with field metadata: kind, label, options, checkbox_mode,
    columns (for tables), min/max constraints
  - Generate concrete `set_example` string for each issue based on field kind
  - Generate `skip_example` for optional fields
  - JSON output: `{ is_complete, form_state, step_budget, progress, issues }`
  - Console output: human-readable priority list with `->` command examples
- [ ] Extract issue filtering logic from `FormHarness` into a shared utility
  (so `next` can reuse `filterIssuesByOrder()` and `filterIssuesByScope()` without
  instantiating a full harness)
- [ ] Add CLI flags: `--roles`, `--max-fields`, `--max-groups`, `--max-issues`
- [ ] Add CLI tests for `next` (empty form, partially filled, complete form)
- [ ] Add CLI tests for `next` with order-level gating
- [ ] Update `markform docs` / quick reference to include `set` and `next` commands

### Phase 3: Empty fill record guard (for `fill` command)

- [ ] Add `isFillRecordEmpty(record: FillRecord): boolean` helper
  - Returns `true` when `record.timeline.length === 0`
- [ ] Guard the sidecar write in the serial path (`fill.ts` ~line 902):
  skip `writeFileSync` if `isFillRecordEmpty(fillRecord)` and log info message
- [ ] Guard the sidecar write in the parallel path (`fill.ts` ~line 457):
  skip write if `result.record` timeline is empty
- [ ] Guard the error handler path (`fill.ts` ~line 958):
  skip write if collector has zero events (no turns started)
- [ ] Add unit test: `fill` on already-complete form with `--record-fill` does not
  write `.fill.json`

## Testing Strategy

### Unit tests

- `parseCliValue()`: number detection, JSON detection, boolean detection, string fallback
- Issue filtering utility: order filtering, scope filtering, count cap
  (if extracted from harness)

### CLI tests

**`set` command — one per field kind:**
```bash
markform set form.md name "Alice" -o /tmp/test.md
markform set form.md age 30 -o /tmp/test.md
markform set form.md priority high -o /tmp/test.md
markform set form.md categories '["frontend","backend"]' -o /tmp/test.md
markform set form.md tags '["rust","wasm"]' -o /tmp/test.md
markform set form.md tasks_multi '{"research":"done","design":"todo"}' -o /tmp/test.md
markform set form.md tasks_simple '["task_a","task_b"]' -o /tmp/test.md
markform set form.md confirmations '{"backed_up":"yes","notified_team":"no"}' -o /tmp/test.md
markform set form.md website "https://example.com" -o /tmp/test.md
markform set form.md references '["https://a.com","https://b.com"]' -o /tmp/test.md
markform set form.md event_date "2025-06-15" -o /tmp/test.md
markform set form.md founded_year 2020 -o /tmp/test.md
markform set form.md team_members '[{"name":"Alice","role":"Eng"}]' -o /tmp/test.md
markform set form.md name --clear -o /tmp/test.md
markform set form.md notes --skip --reason "N/A" -o /tmp/test.md
```

**`set` command — error cases:**
```bash
markform set form.md nonexistent_field "value"  # -> field not found
markform set form.md priority "invalid_option"  # -> lists valid options
markform set form.md age "not_a_number"         # -> coercion error
```

**`apply --context`:**
```bash
markform apply form.md --context '{"name":"Alice","age":30,"priority":"high"}' --report --format json
```

**`next` command:**
```bash
markform next form.md --format json                        # empty form -> all issues
markform next partially-filled.md --format json            # -> only remaining issues
markform next complete-form.md --format json               # -> is_complete: true
markform next form.md --max-fields 3 --format json         # -> at most 3 fields
markform next ordered-form.md --format json                # -> only lowest order level
```

**End-to-end workflow test:**
```bash
# Full cycle: next -> set -> next -> ... -> complete
cp template.form.md /tmp/e2e.md
markform next /tmp/e2e.md --format json  # get first batch
markform set /tmp/e2e.md name "Test"
markform set /tmp/e2e.md age 25
# ... fill all required fields ...
markform next /tmp/e2e.md --format json  # verify is_complete: true
```

## Resolved Questions

1. **Should `next` show current values of partially-filled fields?**
   **Yes.** Include `current_value` in the issue metadata when the field has a partial
   value. This is especially useful for tables (some rows exist, more needed) and
   checkboxes (some checked, some remaining). The value is already available from
   `inspect()` — just include it inline.

2. **Should `next` respect frontmatter `harnessConfig` settings as defaults?**
   **Yes.** Read `maxFieldsPerTurn`, `maxGroupsPerTurn`, `maxIssuesPerTurn` from
   frontmatter `markform.harness` as defaults. CLI flags (`--max-fields`, etc.) override.
   This matches the internal harness behavior and means a form author's settings are
   respected regardless of whether the form is filled via CLI or harness.

3. **Should `set --report` output enriched issues like `next`?**
   **No.** `set --report` outputs the basic `apply` report (apply_status, progress,
   issues as flat list). Use `next` for the enriched view with field metadata and
   examples. Keeps each command focused: `set` mutates, `next` advises.

4. **Should CLI form filling produce fill records?**
   **No.** See [Fill Record Policy](#fill-record-policy). CLI operations are stateless
   one-shot commands with no session/turn/LLM data. The form file is the audit trail.
   Fill records are exclusively for harness-driven filling.

## References

- `packages/markform/src/engine/valueCoercion.ts` — coercion layer (core of `set`/`--context`)
- `packages/markform/src/harness/harness.ts` — FormHarness state machine, issue filtering
- `packages/markform/src/harness/liveAgent.ts` — prompt building, field metadata enrichment
- `packages/markform/src/harness/prompts.ts` — PATCH_FORMATS, getPatchFormatHint()
- `packages/markform/src/harness/harnessConfigResolver.ts` — config merge precedence
- `packages/markform/src/engine/inspect.ts` — inspect(), priority scoring
- `packages/markform/src/engine/coreTypes.ts` — Patch types, StepResult, HarnessConfig
- `packages/markform/src/integrations/vercelAiSdkTools.ts` — AI SDK tool patterns
- `packages/markform/src/cli/commands/apply.ts` — existing apply command
- `packages/markform/src/cli/commands/inspect.ts` — existing inspect command
- `packages/markform/src/cli/commands/fill.ts` — interactive and agent fill
