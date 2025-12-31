# Plan Spec: Unified Field Tag Syntax

## Purpose

Simplify Markform syntax by replacing multiple distinct field tags (`string-field`,
`number-field`, `single-select`, etc.)
with a **single unified `field` tag** that uses a `kind` attribute to distinguish field
kinds.

**Current syntax:**

```markdown
{% string-field id="full_title" label="Full Title" role="agent" required=true %}{% /string-field %}
{% url-field id="rt_url" label="Rotten Tomatoes URL" role="agent" %}{% /url-field %}
{% single-select id="mpaa_rating" label="MPAA Rating" role="agent" %}
- [ ] G {% #g %}
- [ ] PG {% #pg %}
{% /single-select %}
```

**Proposed syntax:**

```markdown
{% field kind="string" id="full_title" label="Full Title" role="agent" required=true %}{% /field %}
{% field kind="url" id="rt_url" label="Rotten Tomatoes URL" role="agent" %}{% /field %}
{% field kind="single_select" id="mpaa_rating" label="MPAA Rating" role="agent" %}
- [ ] G {% #g %}
- [ ] PG {% #pg %}
{% /field %}
```

## Background

Markform currently uses 11 distinct tag names to define fields:

| Current Tag | Kind |
| --- | --- |
| `string-field` | `string` |
| `number-field` | `number` |
| `date-field` | `date` |
| `year-field` | `year` |
| `string-list` | `string_list` |
| `url-field` | `url` |
| `url-list` | `url_list` |
| `single-select` | `single_select` |
| `multi-select` | `multi_select` |
| `checkboxes` | `checkboxes` |
| `table-field` | `table` |

This design was inherited from early prototyping.
A unified tag offers:

1. **Simpler mental model**: One tag pattern instead of 11

2. **Easier documentation**: Single section covers all field kinds

3. **Extensibility**: Adding new kinds doesn’t require new tag names

4. **Consistency**: All fields follow identical syntax patterns

**Related docs:**

- `docs/project/specs/active/plan-2025-12-28-kind-vs-type-terminology.md` — Establishes
  the formal “field kind” vs “data type” terminology (assumed complete)

- `SPEC.md` — Root-level spec (symlink or copy of packages/markform/SPEC.md)

- `packages/markform/SPEC.md` — Package-level spec with distinct tag syntax

- `packages/markform/DOCS.md` — User-facing quick reference

- `docs/project/architecture/current/markform-spec.md` — Architecture spec with field
  tag examples

- `docs/project/architecture/current/arch-markform-design.md` — Design doc with field
  tag examples

## Summary of Task

Replace the 11 distinct field tag names with a single `{% field kind="..." %}` tag:

1. **Parser changes**: Single `parseField()` dispatcher that reads `kind` attribute

2. **Serializer changes**: Output `{% field kind="..." %}` instead of tag names

3. **Spec updates**: Document the unified syntax in all three layers

4. **Docs updates**: Update DOCS.md and README.md

5. **Example/fixture updates**: Convert all `.form.md` files to new syntax

6. **Test updates**: Update golden tests and any syntax-dependent assertions

## Backward Compatibility

**BACKWARD COMPATIBILITY REQUIREMENTS:**

- **Code types, methods, and function signatures**: DO NOT MAINTAIN

- **Library APIs**: N/A — no public API changes (ParsedForm structure unchanged)

- **Server APIs**: N/A

- **File formats**: DO NOT MAINTAIN — hard cut to new syntax only (pre-1.0)

- **Database schemas**: N/A

## Stage 1: Planning Stage

### Scope

**In scope:**

- Unified `{% field kind="..." %}` syntax for all 11 field kinds

- Parser that dispatches on `kind` attribute

- Serializer that outputs new syntax

- All documentation updates

- All example/fixture file conversions

**Not in scope:**

- Changing `FieldKind` enum values (already correct: `string`, `single_select`, etc.)

- Changing internal type structures (`StringField`, `NumberField`, etc.)

- Changing the `ParsedForm` API surface

### Acceptance Criteria

1. All `.form.md` files use `{% field kind="..." %}` syntax

2. Parser accepts new syntax and produces identical `ParsedForm` structures

3. Parser rejects legacy field tags with clear `ParseError` messages

4. Parser rejects `{% field %}` without valid `kind` attribute

5. Serializer outputs new syntax with `kind` attribute first

6. All tests pass

7. Documentation is complete and consistent across all docs

### Decisions

1. **No backward compatibility**: Hard cut to new syntax only.
   Old tag names will not be accepted.
   We are pre-1.0 and can break freely.

2. **Kind values use `snake_case`**: Matches `FieldKind` enum values (e.g.,
   `kind="single_select"`, `kind="string_list"`). This follows ID conventions documented
   in SPEC.md and the terminology spec.

3. **Legacy tags produce parse errors**: The 11 legacy field tags (`string-field`,
   `number-field`, `date-field`, `year-field`, `string-list`, `url-field`, `url-list`,
   `single-select`, `multi-select`, `checkboxes`, `table-field`) must produce explicit
   `ParseError` when encountered.
   This ensures old forms fail fast with clear messages rather than silently dropping
   fields.

4. **Attribute ordering**: The serializer outputs priority keys (`kind`, `id`, `role`)
   first in that order, followed by remaining attributes alphabetically.
   This is implemented via `priorityKeyComparator(['kind', 'id', 'role'])` in
   `serializeAttrs()`. (Already done.)

### Error Semantics

The parser must produce clear `ParseError` messages for:

| Condition | Error Message |
| --- | --- |
| `{% field %}` without `kind` attribute | `field tag missing required 'kind' attribute` |
| `{% field kind="invalid" %}` with unknown kind | `field tag has invalid kind 'invalid'. Valid kinds: string, number, date, year, string_list, url, url_list, single_select, multi_select, checkboxes, table` |
| `{% string-field %}` or other legacy tag | `Legacy field tag 'string-field' is no longer supported. Use {% field kind="string" %} instead` |

The valid `kind` values are defined in `FIELD_KINDS` tuple in
`packages/markform/src/engine/fieldRegistry.ts` — this is the single source of truth.

## Stage 2: Architecture Stage

### Current Parser Flow

```
parseField(node) → switch(node.tag) → parseStringField/parseNumberField/...
```

The dispatcher in `parseFields.ts` uses `node.tag` to route to specific parsers.

### Proposed Parser Flow

```
parseField(node) → if node.tag === 'field' → switch(node.kind) → parseStringField/...
```

Change the dispatcher to:

1. Check if tag is `field`

2. Read `kind` attribute

3. Dispatch to existing field-specific parsers

### Files to Modify

**Engine (parsing/serializing):**

- `packages/markform/src/engine/parseFields.ts` — Modify `parseField()` dispatcher to:

  - Accept only `{% field kind="..." %}` tags

  - Produce `ParseError` for legacy field tags

  - Produce `ParseError` for missing/invalid `kind` attribute

- `packages/markform/src/engine/serialize.ts` — Change tag name output to `field` with
  `kind` attribute first, using `priorityKeyComparator` from utils

**Utilities (already created):**

- `packages/markform/src/utils/keySort.ts` — Key sorting utilities for attribute
  ordering (created, with tests)

**Documentation (all contain field tag syntax examples):**

- `SPEC.md` — Root-level spec (if separate from packages/markform/SPEC.md)

- `packages/markform/SPEC.md` — Layer 1 syntax section updates

- `packages/markform/DOCS.md` — Field Types section becomes unified

- `packages/markform/README.md` — Package README syntax examples

- `README.md` — Root README if it contains syntax examples

- `docs/project/architecture/current/markform-spec.md` — Architecture spec examples

- `docs/project/architecture/current/arch-markform-design.md` — Design doc examples

**Examples and fixtures:**

- `packages/markform/examples/**/*.form.md` — All example forms

- `forms/**/*.form.md` — Root-level form files

- `attic/**/*.form.md` — Archived examples

- Any other `.form.md` files in the repo

**Tests:**

- Update any tests that check for specific tag names in output

- Golden tests will auto-update when regenerated

### Serializer Changes

Current output:

```markdown
{% string-field id="name" label="Name" %}{% /string-field %}
```

New output:

```markdown
{% field kind="string" id="name" label="Name" %}{% /field %}
```

The `kind` attribute should appear **first** in the attribute list for consistency and
readability.

### Kind Values

The `kind` attribute uses exact `FieldKind` values (snake_case):

| Kind Value | Field Type |
| --- | --- |
| `string` | StringField |
| `number` | NumberField |
| `date` | DateField |
| `year` | YearField |
| `string_list` | StringListField |
| `url` | UrlField |
| `url_list` | UrlListField |
| `single_select` | SingleSelectField |
| `multi_select` | MultiSelectField |
| `checkboxes` | CheckboxesField |
| `table` | TableField |

## Stage 3: Refine Architecture

### Reusable Components

- **Existing field parsers**: All `parseStringField()`, `parseNumberField()`, etc.
  remain unchanged — only the dispatcher changes

- **Existing attribute helpers**: `getStringAttr()`, `getBooleanAttr()`, etc.
  unchanged

- **Serializer attribute helpers**: `serializeAttrValue()` unchanged

### Minimal Code Changes

The change is primarily in two places:

1. **`parseField()` dispatcher** (~50 lines): Add `kind` attribute check, legacy tag
   errors

2. **`serializeXxxField()` functions** (~20 lines each × 11 kinds): Change tag name to
   `field` and add `kind` attribute first

Total estimated: ~300 lines changed, mostly mechanical find/replace.

## Stage 4: Implementation

### Phase 1: Parser Update

- [ ] Modify `parseField()` in `parseFields.ts`:

  - Accept only `{% field kind="..." %}` tags

  - Read `kind` from `getStringAttr(node, 'kind')` (not `node.kind`)

  - Dispatch to existing `parseStringField()`, `parseNumberField()`, etc.
    based on kind

- [ ] Add explicit `ParseError` for legacy field tags:

  - Check if `node.tag` matches any of the 11 legacy tag names

  - Throw `ParseError` with message like: `Legacy field tag 'string-field' is no longer
    supported. Use {% field kind="string" %} instead`

- [ ] Add `ParseError` for invalid `kind` attribute:

  - Missing `kind` → `field tag missing required 'kind' attribute`

  - Invalid `kind` → `field tag has invalid kind 'xxx'.
    Valid kinds: ...`

  - Use `FIELD_KINDS` from `fieldRegistry.ts` as the canonical list

### Phase 2: Serializer Update

- [ ] Update all `serializeXxxField()` functions to output `{% field kind="xxx" %}`

- [x] Ensure priority keys appear first in attribute list: ✅ DONE

  - Using `priorityKeyComparator(['kind', 'id', 'role'])` from `src/utils/keySort.ts`

  - `serializeAttrs()` updated to use this instead of plain `.sort()`

  - Golden tests regenerated with new attribute ordering

- [ ] Update closing tag to `{% /field %}`

- [ ] Table field note: Table content remains raw markdown table inside the tag (not a
  value fence). The serializer already handles this correctly; just change the tag name.

### Phase 3: Documentation

- [ ] Update `packages/markform/SPEC.md` Layer 1 syntax section

- [ ] Update Field Tags table to show unified syntax

- [ ] Update `packages/markform/DOCS.md` Field Types section

- [ ] Update `packages/markform/README.md` examples if any

- [ ] Update `README.md` (root) examples if any

- [ ] Update `docs/project/architecture/current/markform-spec.md` field tag examples

- [ ] Update `docs/project/architecture/current/arch-markform-design.md` field tag
  examples

- [ ] Verify `SPEC.md` (root) is in sync with `packages/markform/SPEC.md`

### Phase 4: Form File Migration

Convert all `.form.md` files to the new unified syntax.

**Migration approach:** Run serializer on each file (parse → serialize) to auto-convert,
or use find/replace with manual review.

**Precondition:** The serializer must be updated (Phase 2) before migration.
The migration should happen BEFORE the parser is updated to reject legacy tags (Phase
1), or use a transitional parser that accepts both old and new syntax during migration.

**Recommended implementation order** (differs from phase numbering):

1. Update serializer to output new syntax (Phase 2)

2. Migrate all form files using parse → serialize (Phase 4)

3. Migrate unit tests (Phase 5)

4. Update parser to reject legacy tags (Phase 1)

5. Update documentation (Phase 3)

6. Final validation (Phase 6)

This ensures forms and tests are converted before the parser starts rejecting them.
The phase numbering reflects logical grouping, not execution order.

**Example template files** (10 files):

- [ ] `packages/markform/examples/simple/simple.form.md`

- [ ] `packages/markform/examples/movie-research/movie-research-minimal.form.md`

- [ ] `packages/markform/examples/movie-research/movie-research-basic.form.md`

- [ ] `packages/markform/examples/movie-research/movie-deep-research.form.md`

- [ ] `packages/markform/examples/startup-research/startup-research.form.md`

- [ ] `packages/markform/examples/startup-deep-research/startup-deep-research.form.md`

- [ ] `packages/markform/examples/earnings-analysis/earnings-analysis.form.md`

- [ ]
  `packages/markform/examples/celebrity-deep-research/celebrity-deep-research.form.md`

- [ ] `packages/markform/examples/simple/simple-mock-filled.form.md`

- [ ] `packages/markform/examples/startup-research/startup-research-mock-filled.form.md`

**Example filled files** (auto-converted when templates are re-serialized):

- `packages/markform/examples/simple/simple-filled*.form.md` (5 files)

- `packages/markform/examples/simple/simple-skipped-filled.form.md`

- `packages/markform/examples/startup-deep-research/startup-deep-research-filled*.form.md`
  (6 files)

**Root-level form files** (test outputs, can delete or convert):

- `forms/*.form.md` (12 files)

- `*.form.md` in repo root (7 files: simple-filled*, political-research-filled*,
  startup-deep-research-filled1)

**Attic files** (archived, low priority):

- `attic/*.form.md` (4 files)

- `attic/docs-for-review/*.form.md` (3 files)

**Session files** (YAML, reference form content):

- [ ] `packages/markform/examples/simple/simple.session.yaml`

- [ ] `packages/markform/examples/simple/simple-with-skips.session.yaml`

After conversion, regenerate golden test sessions:

```bash
pnpm --filter markform test:golden:regen
```

### Phase 5: Unit Test Migration

Update all unit tests that contain inline form markdown with old tag syntax.

**Tests with inline form content** (17 files):

- [ ] `tests/unit/engine/parse.test.ts`

- [ ] `tests/unit/engine/serialize.test.ts`

- [ ] `tests/unit/engine/serialize-fence.test.ts`

- [ ] `tests/unit/engine/validate.test.ts`

- [ ] `tests/unit/engine/apply.test.ts`

- [ ] `tests/unit/engine/inspect.test.ts`

- [ ] `tests/unit/engine/summaries.test.ts`

- [ ] `tests/unit/engine/simple-form-validation.test.ts`

- [ ] `tests/unit/engine/coreTypes.test.ts`

- [ ] `tests/unit/engine/fieldRegistry.test.ts`

- [ ] `tests/unit/harness/harness.test.ts`

- [ ] `tests/unit/harness/programmaticFill.test.ts`

- [ ] `tests/unit/valueCoercion.test.ts`

- [ ] `tests/unit/integrations/ai-sdk.test.ts`

- [ ] `tests/unit/web/serve-render.test.ts`

- [ ] `tests/unit/cli/interactivePrompts.test.ts`

**Migration approach:** Find/replace in each test file:

```
{% string-field   →  {% field kind="string"
{% number-field   →  {% field kind="number"
{% date-field     →  {% field kind="date"
{% year-field     →  {% field kind="year"
{% string-list    →  {% field kind="string_list"
{% url-field      →  {% field kind="url"
{% url-list       →  {% field kind="url_list"
{% single-select  →  {% field kind="single_select"
{% multi-select   →  {% field kind="multi_select"
{% checkboxes     →  {% field kind="checkboxes"
{% table-field    →  {% field kind="table"
```

Also update closing tags (all become `{% /field %}`):

```
{% /string-field %}   →  {% /field %}
{% /number-field %}   →  {% /field %}
{% /date-field %}     →  {% /field %}
{% /year-field %}     →  {% /field %}
{% /string-list %}    →  {% /field %}
{% /url-field %}      →  {% /field %}
{% /url-list %}       →  {% /field %}
{% /single-select %}  →  {% /field %}
{% /multi-select %}   →  {% /field %}
{% /checkboxes %}     →  {% /field %}
{% /table-field %}    →  {% /field %}
```

**Note:** `checkboxes` is a legacy tag even though the tag name matches the kind value.
It still needs to become `{% field kind="checkboxes" %}`.

**Add new tests for error cases:**

- [ ] Add test: `{% field %}` without `kind` produces `ParseError`

- [ ] Add test: `{% field kind="invalid" %}` produces `ParseError` with valid kinds list

- [ ] Add test for each legacy tag: `{% string-field %}` etc.
  produces `ParseError` with migration hint

### Phase 6: Final Validation

- [ ] Run full test suite: `pnpm precommit`

- [ ] Verify no old tag names in source (note: pattern includes all 11 legacy tags):
  ```bash
  grep -rn 'string-field\|number-field\|date-field\|year-field\|string-list\|url-field\|url-list\|single-select\|multi-select\|checkboxes\|table-field' \
    packages/markform/src \
    packages/markform/tests \
    packages/markform/examples \
    docs/project/architecture/current
  ```

- [ ] Verify no old tag names in form files across repo:
  ```bash
  find . -name '*.form.md' -exec grep -l 'string-field\|number-field\|date-field\|year-field\|string-list\|url-field\|url-list\|single-select\|multi-select\|checkboxes\|table-field' {} \;
  ```

- [ ] Exceptions allowed: CHANGELOG.md, docs/project/specs/done/*, revision history,
  comments explaining the migration

## Stage 5: Validation

### Final Checklist

- [ ] `pnpm precommit` passes (all tests green)

- [ ] Golden tests regenerated and pass

- [ ] Manual inspection: `pnpm markform inspect` on a converted form

- [ ] Legacy tag produces clear `ParseError` (test with old syntax)

- [ ] Documentation consistent across:

  - `packages/markform/SPEC.md`

  - `packages/markform/DOCS.md`

  - `packages/markform/README.md`

  - `docs/project/architecture/current/markform-spec.md`

  - `docs/project/architecture/current/arch-markform-design.md`

- [ ] No old tag names in active source/tests/examples/docs

- [ ] No old tag names in any `.form.md` files in repo

### Verification Commands

```bash
# Verify no old tag names remain in active code (includes all 11 legacy tags)
grep -rn 'string-field\|number-field\|date-field\|year-field\|string-list\|url-field\|url-list\|single-select\|multi-select\|checkboxes\|table-field' \
  packages/markform/src \
  packages/markform/tests \
  packages/markform/examples \
  docs/project/architecture/current

# Should return nothing (or only comments explaining the migration)

# Verify no old tags in any form files across repo
find . -name '*.form.md' -exec grep -l 'string-field\|number-field\|date-field\|year-field\|string-list\|url-field\|url-list\|single-select\|multi-select\|checkboxes\|table-field' {} \;

# Should return nothing

# Test that legacy tags produce parse errors (after implementation)
echo '{% form id="test" %}{% field-group id="g" %}{% string-field id="f" label="L" %}{% /string-field %}{% /field-group %}{% /form %}' | pnpm markform inspect -
# Should produce: ParseError: Legacy field tag 'string-field' is no longer supported...

# Test a converted form
pnpm markform inspect packages/markform/examples/movie-research/movie-research-minimal.form.md

# Full quality gate
pnpm precommit
```
