# Plan Spec: Date and Year Field Types

## Purpose

This is a technical design doc for adding dedicated `date-field` and `year-field` types
to Markform. Dates and years are fundamental data types for forms involving deadlines,
fiscal periods, founding years, and time-based data, warranting first-class support
rather than being represented as generic strings with patterns.

## Background

**Markform** currently supports these field types:

| Tag | Type | Purpose |
| --- | --- | --- |
| `string-field` | string | Single text value |
| `number-field` | number | Numeric value |
| `string-list` | string_list | List of strings |
| `single-select` | single_select | Pick one from options |
| `multi-select` | multi_select | Pick multiple from options |
| `checkboxes` | checkboxes | Stateful checklist |
| `url-field` | url | Single URL value |
| `url-list` | url_list | List of URLs |

**Gap:** No dedicated date or year types.
Dates and years are currently represented as `string-field` with optional regex patterns
or `number-field`, which:

- Lacks semantic clarity for agents (they don’t know the expected format)

- Requires manual pattern configuration in each form

- Doesn’t provide built-in date/year format validation

- Can’t enforce min/max date constraints

- Can’t be rendered as date pickers or year inputs in UIs without heuristics

**Use Cases:**

- Research forms with deadlines and as-of dates

- Financial forms with fiscal period dates and fiscal years

- Startup forms with founding years

- Project management forms with milestones

- Event scheduling forms

- Any form requiring date or year entry with validation

**Related Docs:**

- [arch-markform-design.md](../architecture/current/arch-markform-design.md) — Date
  field specified in MF/0.2 Targets section

- [plan-2025-12-24-url-field-types.md](done/plan-2025-12-24-url-field-types.md) —
  Implementation pattern reference

## Summary of Task

Add two new field types to Markform:

1. **`date-field`** — Single date value with built-in format validation and optional
   min/max constraints

2. **`year-field`** — Single year value (4-digit integer) with built-in validation and
   sensible default range (1000-2500)

### date-field Syntax

```markdown
{% date-field id="deadline" label="Deadline" required=true %}{% /date-field %}

{% date-field id="fiscal_year_end" label="Fiscal year end" format="MM-DD" %}{% /date-field %}

{% date-field id="event_date" label="Event Date" min="2025-01-01" max="2025-12-31" %}{% /date-field %}
```

**Example filled value:**

```markdown
{% date-field id="deadline" label="Deadline" required=true %}
```value
2025-03-15
```
{% /date-field %}
```

### year-field Syntax

```markdown
{% year-field id="founded_year" label="Founded Year" required=true %}{% /year-field %}

{% year-field id="fiscal_year" label="Fiscal Year" min=2020 max=2030 %}{% /year-field %}
```

**Example filled value:**

```markdown
{% year-field id="founded_year" label="Founded Year" required=true %}
```value
2015
```
{% /year-field %}
```

**Year field design rationale:**

- Stored as integer (not string) for easy comparison

- Default range: 1000-2500 (reasonable heuristic for most use cases)

- Optional `min`/`max` attributes to override defaults

- Simpler than date-field: no format attribute, just a 4-digit year

## Backward Compatibility

**BACKWARD COMPATIBILITY REQUIREMENTS:**

- **Code types, methods, and function signatures**: DO NOT MAINTAIN — This is additive;
  new types extend existing unions without breaking changes

- **Library APIs**: DO NOT MAINTAIN — New exports only; existing exports unchanged

- **Server APIs**: N/A — No server APIs affected

- **File formats**: DO NOT MAINTAIN — New tags are additive; existing forms continue to
  work

- **Database schemas**: N/A — No database

## Stage 1: Planning Stage

### Current State Analysis

**Existing Field Implementation Pattern:**

Each field type requires changes in these files:

| File | Purpose |
| --- | --- |
| `src/engine/coreTypes.ts` | Type definitions + Zod schemas |
| `src/engine/parse.ts` | Parse Markdoc tags to internal types |
| `src/engine/serialize.ts` | Serialize internal types to Markdoc |
| `src/engine/validate.ts` | Field-level validation |
| `src/engine/apply.ts` | Apply patches |
| `src/engine/summaries.ts` | Progress/summary computation |
| `src/engine/valueCoercion.ts` | Value coercion for patches |
| `src/engine/fieldRegistry.ts` | Field tag registration |

**Pattern to Follow:** `url-field` and `string-field` are the closest analogs:

- `date-field` follows `string-field` pattern (single value in fence)

- Date validation follows URL validation pattern (format-specific)

### Feature Scope

**In Scope:**

- `date-field` tag with `kind: "date"` and built-in date format validation

- `year-field` tag with `kind: "year"` and built-in year validation

- `DateField`, `DateValue`, `YearField`, `YearValue` types

- `SetDatePatch`, `SetYearPatch` patch types

- Date attributes: `format` (default: "YYYY-MM-DD"), `min`, `max`

- Year attributes: `min` (default: 1000), `max` (default: 2500)

- Parser, serializer, validator, apply, summaries support for both types

- Web UI date/year input rendering

- Interactive prompt support for date/year input

- Unit tests for all components

- Update example forms with date and year field examples

**Out of Scope (Explicit Non-Goals):**

- Time or datetime types (date only for MF/0.2)

- Timezone handling (dates are timezone-naive)

- Relative date parsing ("next Monday", "in 3 days")

- Date range fields (use two separate date fields)

- Localized date display (stored in ISO format, display is UI concern)

- `date-list` or `year-list` types (can be added later if needed)

### Acceptance Criteria

**date-field:**

1. `date-field` tag parses correctly with all attributes

2. Date format validation accepts valid dates in specified format

3. Date format validation rejects invalid dates

4. Min/max date constraints are enforced correctly

5. Round-trip serialization preserves date values exactly

6. Patch (`set_date`) works correctly

7. Inspect reports issues for empty required date fields

8. Inspect reports issues for dates outside min/max range

**year-field:**

9. `year-field` tag parses correctly with all attributes

10. Year validation accepts valid 4-digit years

11. Year validation rejects invalid years (non-numeric, out of range)

12. Default range (1000-2500) is enforced when no min/max specified

13. Custom min/max year constraints are enforced correctly

14. Round-trip serialization preserves year values exactly

15. Patch (`set_year`) works correctly

16. Inspect reports issues for empty required year fields

17. Inspect reports issues for years outside min/max range

**Both:**

18. Web UI renders appropriate inputs (date picker, number input)

19. Interactive prompts support date/year entry

20. All existing tests continue to pass

21. New unit tests cover date and year field scenarios

### Testing Plan

#### 1. Unit Tests: Core Types (`tests/unit/coreTypes.test.ts`)

**date-field:**

- [ ] `DateFieldSchema` validates correctly

- [ ] `DateValueSchema` validates correctly

- [ ] `SetDatePatchSchema` validates correctly

- [ ] `DateField` with format attribute validates

- [ ] `DateField` with min/max attributes validates

**year-field:**

- [ ] `YearFieldSchema` validates correctly

- [ ] `YearValueSchema` validates correctly

- [ ] `SetYearPatchSchema` validates correctly

- [ ] `YearField` with min/max attributes validates

#### 2. Unit Tests: Parser (`tests/unit/parse.test.ts`)

**date-field:**

- [ ] Parses empty `date-field` tag

- [ ] Parses `date-field` with value in fence

- [ ] Parses `date-field` with required=true

- [ ] Parses `date-field` with format attribute

- [ ] Parses `date-field` with min/max attributes

- [ ] Handles whitespace in date values

**year-field:**

- [ ] Parses empty `year-field` tag

- [ ] Parses `year-field` with value in fence

- [ ] Parses `year-field` with required=true

- [ ] Parses `year-field` with min/max attributes

- [ ] Handles whitespace in year values

#### 3. Unit Tests: Serializer (`tests/unit/serialize.test.ts`)

**date-field:**

- [ ] Serializes empty `date-field`

- [ ] Serializes `date-field` with value

- [ ] Serializes `date-field` with all attributes

- [ ] Round-trip: parse → serialize → parse produces identical form

**year-field:**

- [ ] Serializes empty `year-field`

- [ ] Serializes `year-field` with value

- [ ] Serializes `year-field` with min/max attributes

- [ ] Round-trip: parse → serialize → parse produces identical form

#### 4. Unit Tests: Validator (`tests/unit/validate.test.ts`)

**date-field:**

- [ ] Valid dates: `2025-01-15`, `2024-12-31`

- [ ] Invalid dates: empty string, plain text, wrong format

- [ ] Invalid dates: `2025-02-30` (impossible date)

- [ ] Invalid dates: `2025-13-01` (invalid month)

- [ ] Min constraint: date before min rejected

- [ ] Max constraint: date after max rejected

- [ ] Min/max: date within range accepted

- [ ] Required date field with null value reports issue

- [ ] Custom format validation (e.g., "MM-DD")

**year-field:**

- [ ] Valid years: `2025`, `1999`, `2100`

- [ ] Invalid years: empty string, plain text, non-numeric

- [ ] Invalid years: `999` (too short), `12345` (too long)

- [ ] Default range: years outside 1000-2500 rejected

- [ ] Custom min: year before custom min rejected

- [ ] Custom max: year after custom max rejected

- [ ] Required year field with null value reports issue

#### 5. Unit Tests: Apply (`tests/unit/apply.test.ts`)

**date-field:**

- [ ] `set_date` patch sets date value

- [ ] `set_date` patch with null clears value

- [ ] `clear_field` works on date fields

**year-field:**

- [ ] `set_year` patch sets year value

- [ ] `set_year` patch with null clears value

- [ ] `clear_field` works on year fields

#### 6. Unit Tests: Summaries (`tests/unit/summaries.test.ts`)

- [ ] Date field with value shows as complete

- [ ] Required date field without value shows as incomplete

- [ ] Date field counted in fieldCountByKind

- [ ] Year field with value shows as complete

- [ ] Required year field without value shows as incomplete

- [ ] Year field counted in fieldCountByKind

## Stage 2: Architecture Stage

### Type Definitions

#### New Types (`src/engine/coreTypes.ts`)

```typescript
// Field Kind - add to existing union
export type FieldKind =
  | "string"
  | "number"
  | "string_list"
  | "checkboxes"
  | "single_select"
  | "multi_select"
  | "url"
  | "url_list"
  | "date"         // NEW
  | "year";        // NEW

// Date Field - single date value
export interface DateField extends FieldBase {
  kind: "date";
  format?: string;   // default: 'YYYY-MM-DD' (ISO 8601)
  min?: string;      // minimum date in same format
  max?: string;      // maximum date in same format
}

// Year Field - single year value (4-digit integer)
export interface YearField extends FieldBase {
  kind: "year";
  min?: number;      // minimum year (default: 1000)
  max?: number;      // maximum year (default: 2500)
}

// Date Value
export interface DateValue {
  kind: "date";
  value: string | null;  // null if empty, validated date string otherwise
}

// Year Value
export interface YearValue {
  kind: "year";
  value: number | null;  // null if empty, validated year (integer) otherwise
}

// Update Field union
export type Field =
  | StringField
  | NumberField
  | StringListField
  | CheckboxesField
  | SingleSelectField
  | MultiSelectField
  | UrlField
  | UrlListField
  | DateField        // NEW
  | YearField;       // NEW

// Update FieldValue union
export type FieldValue =
  | StringValue
  | NumberValue
  | StringListValue
  | CheckboxesValue
  | SingleSelectValue
  | MultiSelectValue
  | UrlValue
  | UrlListValue
  | DateValue        // NEW
  | YearValue;       // NEW
```

#### New Patches

```typescript
// Set date field value
export interface SetDatePatch {
  op: "set_date";
  fieldId: Id;
  value: string | null;
}

// Set year field value
export interface SetYearPatch {
  op: "set_year";
  fieldId: Id;
  value: number | null;
}

// Update Patch union
export type Patch =
  | SetStringPatch
  | SetNumberPatch
  | SetStringListPatch
  | SetCheckboxesPatch
  | SetSingleSelectPatch
  | SetMultiSelectPatch
  | SetUrlPatch
  | SetUrlListPatch
  | SetDatePatch       // NEW
  | SetYearPatch       // NEW
  | ClearFieldPatch
  | SkipFieldPatch
  | AbortFieldPatch
  | AddNotePatch
  | RemoveNotePatch;
```

### Date Validation

Use JavaScript’s `Date` constructor for validation with format-aware parsing:

```typescript
/**
 * Default date format: ISO 8601 (YYYY-MM-DD)
 */
const DEFAULT_DATE_FORMAT = 'YYYY-MM-DD';

/**
 * Validate a date string against a format.
 * Returns true if valid, false otherwise.
 */
function isValidDate(value: string, format: string = DEFAULT_DATE_FORMAT): boolean {
  // For YYYY-MM-DD format (default)
  if (format === 'YYYY-MM-DD') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return false;

    const [, yearStr, monthStr, dayStr] = match;
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const day = parseInt(dayStr, 10);

    // Check ranges
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;

    // Validate actual date (handles Feb 30, etc.)
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year &&
           date.getMonth() === month - 1 &&
           date.getDate() === day;
  }

  // For MM-DD format
  if (format === 'MM-DD') {
    const match = value.match(/^(\d{2})-(\d{2})$/);
    if (!match) return false;

    const [, monthStr, dayStr] = match;
    const month = parseInt(monthStr, 10);
    const day = parseInt(dayStr, 10);

    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;

    // Use a leap year for validation to allow Feb 29
    const date = new Date(2000, month - 1, day);
    return date.getMonth() === month - 1 && date.getDate() === day;
  }

  // Add more format handlers as needed
  return false;
}

/**
 * Compare two date strings in the same format.
 * Returns -1 if a < b, 0 if equal, 1 if a > b.
 */
function compareDates(a: string, b: string, format: string = DEFAULT_DATE_FORMAT): number {
  // For ISO format, string comparison works correctly
  if (format === 'YYYY-MM-DD') {
    return a.localeCompare(b);
  }
  // For MM-DD, also works with string comparison
  if (format === 'MM-DD') {
    return a.localeCompare(b);
  }
  return 0;
}
```

### Year Validation

Year validation is simpler — just validate it’s a 4-digit integer within range:

```typescript
/**
 * Default year range constraints.
 * These are sensible defaults for most use cases involving historical or future years.
 */
const DEFAULT_YEAR_MIN = 1000;
const DEFAULT_YEAR_MAX = 2500;

/**
 * Validate a year value.
 * Returns true if valid, false otherwise.
 */
function isValidYear(
  value: number,
  min: number = DEFAULT_YEAR_MIN,
  max: number = DEFAULT_YEAR_MAX
): boolean {
  // Must be an integer
  if (!Number.isInteger(value)) return false;

  // Must be within range
  if (value < min || value > max) return false;

  return true;
}

/**
 * Parse a year from string input.
 * Returns the year as number, or null if invalid format.
 */
function parseYear(input: string): number | null {
  const trimmed = input.trim();

  // Must be exactly 4 digits
  if (!/^\d{4}$/.test(trimmed)) return null;

  return parseInt(trimmed, 10);
}
```

**Year field design notes:**

- Stored as integer (number type), not string

- Default range 1000-2500 covers virtually all practical use cases

- Supports custom `min`/`max` for specific needs (e.g., `min=2020 max=2030` for a
  planning form)

- Simple regex validation: exactly 4 digits

- No format attribute (unlike date-field) — years are always YYYY

### Files to Modify

| File | Changes |
| --- | --- |
| `src/engine/coreTypes.ts` | Add `DateField`, `DateValue`, `SetDatePatch`, `YearField`, `YearValue`, `SetYearPatch`, Zod schemas |
| `src/engine/parse.ts` | Add `parseDateField()`, `parseYearField()`, update `parseFieldNode()` switch |
| `src/engine/serialize.ts` | Add serialization for `date` and `year` kinds |
| `src/engine/validate.ts` | Add date format validation, year validation, min/max constraints |
| `src/engine/apply.ts` | Handle `set_date` and `set_year` patches |
| `src/engine/summaries.ts` | Handle `date` and `year` in field counts |
| `src/engine/valueCoercion.ts` | Add coercion for date and year types |
| `src/engine/fieldRegistry.ts` | Register `date-field` and `year-field` tags |
| `src/cli/lib/interactivePrompts.ts` | Add date and year prompt support |
| `src/web/renderForm.ts` (or equivalent) | Add date and year input rendering |
| `packages/markform/examples/simple/simple.form.md` | Add date and year field examples |

## Stage 3: Refine Architecture

### Reusable Components

The implementation follows existing patterns closely:

| Component | Reuse Strategy |
| --- | --- |
| `parseUrlField()` | Template for `parseDateField()` and `parseYearField()` |
| URL field serialization | Template for date and year field serialization |
| `validateUrlField()` | Template structure for `validateDateField()` |
| `validateNumberField()` | Template structure for `validateYearField()` (similar min/max) |
| URL value coercion | Template for date value coercion |
| Number value coercion | Template for year value coercion |

### Implementation Order

Implementation should proceed in dependency order:

1. **Core types** (coreTypes.ts) — Types and Zod schemas first

2. **Parser** (parse.ts) — Parse tags to types

3. **Serializer** (serialize.ts) — Serialize types to tags

4. **Validator** (validate.ts) — Date format validation

5. **Patches** (coreTypes.ts patches section) — Patch types

6. **Apply** (apply.ts) — Handle patches

7. **Summaries** (summaries.ts) — Progress computation

8. **Value Coercion** (valueCoercion.ts) — Patch value coercion

9. **Field Registry** (fieldRegistry.ts) — Tag registration

10. **Unit tests** — Per component

11. **Interactive prompts** — CLI date input

12. **Web UI** — Date input rendering

13. **Update simple.form.md** — Add date field example

### Example Form Updates

#### Updates to simple.form.md

Add date and year field examples in an appropriate group:

```markdown
{% date-field id="target_date" label="Target Date" role="user" %}{% /date-field %}

{% instructions ref="target_date" %}
Enter a target date in YYYY-MM-DD format (e.g., 2025-06-15).
{% /instructions %}

{% year-field id="target_year" label="Target Year" role="user" %}{% /year-field %}

{% instructions ref="target_year" %}
Enter a 4-digit year (e.g., 2025).
{% /instructions %}
```

#### Updates to startup-deep-research.form.md

Replace string patterns with proper date/year fields:

```markdown
{% year-field id="founded_year" label="Founded Year" %}{% /year-field %}

{% date-field id="last_round_date" label="Last Round Date" %}{% /date-field %}
```

This is a natural use case: startup research forms typically need:

- `founded_year` — Year the company was founded (year-field)

- `last_round_date` — Date of the last funding round (date-field)

## Documentation Updates Required

### 1. Architecture Doc Updates

Update `docs/project/architecture/current/arch-markform-design.md`:

**Move date-field from MF/0.2 Targets to current implementation:**

In the “MF/0.2 Targets” section (around line 1140), the `date-field` specification
should be moved to the current Layer 2 Field Types section once implemented.

**Add year-field to the specification:**

The `year-field` is a new addition not previously specified.
Add it alongside `date-field` in the architecture doc with:

```markdown
- **`year-field` type** — Dedicated field type for year values (4-digit integers) with
  built-in validation and sensible default range.

  ```md
  {% year-field id="founded_year" label="Founded Year" required=true %}{% /year-field %}
  {% year-field id="fiscal_year" label="Fiscal Year" min=2020 max=2030 %}{% /year-field %}
```

Attributes:

- `min`: Minimum year (default: 1000)

- `max`: Maximum year (default: 2500)

TypeScript types:
```ts
interface YearField extends FieldBase {
  kind: 'year';
  min?: number;   // default: 1000
  max?: number;   // default: 2500
}

// FieldValue
| { kind: 'year'; value: number | null }

// Patch
| { op: 'set_year'; fieldId: Id; value: number | null }
```

FieldKind enum gains `'year'` value.
```

**Update FieldKind enum documentation** in Layer 2 to include `date` and `year`.

**Update terminology table** to include date and year field definitions.

### 2. Markform Specification Updates

If `markform-spec.md` exists, update it to include:

- Date and year field tag syntax in Layer 1

- DateField, DateValue, YearField, YearValue types in Layer 2

- Date and year validation rules in Layer 3

- set_date and set_year patches in Layer 4

### 3. README Updates

Update `packages/markform/README.md` to list date-field and year-field as supported
field types.

## Beads Reference

This spec is tracked by epic **markform-300** and its sub-tasks:

| Bead | Description |
| --- | --- |
| markform-300 | Epic: Add date and year field types with full support |
| markform-300.1 | Core types: DateField, DateValue, SetDatePatch |
| markform-300.2 | Core types: YearField, YearValue, SetYearPatch |
| markform-300.3 | Parser: date-field and year-field tags |
| markform-300.4 | Serializer: date and year field serialization |
| markform-300.5 | Validator: date format and min/max validation |
| markform-300.6 | Validator: year range validation |
| markform-300.7 | Apply: Handle set_date and set_year patches |
| markform-300.8 | Summaries: date and year fields in counts |
| markform-300.9 | Value coercion: date and year types |
| markform-300.10 | Field registry: date-field and year-field tags |
| markform-300.11 | Interactive prompts: date and year input |
| markform-300.12 | Web UI: date and year input rendering |
| markform-300.13 | Unit tests |
| markform-300.14 | Update example forms |
| markform-300.15 | Documentation updates |

### Dependency Graph
```
markform-300.1, 300.2 (Core types) ├── markform-300.3 (Parser) ├── markform-300.4
(Serializer) ├── markform-300.5, 300.6 (Validators) ├── markform-300.7 (Apply) ├──
markform-300.8 (Summaries) ├── markform-300.9 (Value coercion) └── markform-300.10
(Field registry)

markform-300.3, 300.4, 300.5, 300.6 ──► markform-300.13 (Unit tests)

markform-300.7, 300.8, 300.9, 300.10 ──► markform-300.11 (Interactive prompts) ──►
markform-300.12 (Web UI)

markform-300.11, 300.12, 300.13 ──► markform-300.14 (Example forms) ──► markform-300.15
(Documentation)
```

## Implementation Checklist

### Phase 1: Core Engine — Date Types

- [ ] Add `DateField` interface to coreTypes.ts

- [ ] Add `DateValue` type to coreTypes.ts

- [ ] Add `SetDatePatch` type to coreTypes.ts

- [ ] Add Zod schemas for date types

- [ ] Update `FieldKind` to include `'date'`

### Phase 2: Core Engine — Year Types

- [ ] Add `YearField` interface to coreTypes.ts

- [ ] Add `YearValue` type to coreTypes.ts

- [ ] Add `SetYearPatch` type to coreTypes.ts

- [ ] Add Zod schemas for year types

- [ ] Update `FieldKind` to include `'year'`

- [ ] Update `Field` union type (both date and year)

- [ ] Update `FieldValue` union type (both date and year)

- [ ] Update `Patch` union type (both date and year)

### Phase 3: Parser & Serializer

- [ ] Add `parseDateField()` function in parse.ts

- [ ] Add `parseYearField()` function in parse.ts

- [ ] Update `parseFieldNode()` switch for `date-field` tag

- [ ] Update `parseFieldNode()` switch for `year-field` tag

- [ ] Add date field serialization in serialize.ts

- [ ] Add year field serialization in serialize.ts

- [ ] Verify round-trip parsing works for both types

### Phase 4: Validation & Apply

- [ ] Add `validateDateField()` in validate.ts

- [ ] Add `validateYearField()` in validate.ts

- [ ] Implement date format validation (YYYY-MM-DD default)

- [ ] Implement year range validation (default 1000-2500)

- [ ] Implement min/max constraint validation for both types

- [ ] Handle `set_date` patch in apply.ts

- [ ] Handle `set_year` patch in apply.ts

- [ ] Add date coercion in valueCoercion.ts

- [ ] Add year coercion in valueCoercion.ts

### Phase 5: Summaries & Registry

- [ ] Update `computeStructureSummary()` for date and year fields

- [ ] Update `computeProgressSummary()` for date and year fields

- [ ] Register `date-field` tag in fieldRegistry.ts

- [ ] Register `year-field` tag in fieldRegistry.ts

### Phase 6: CLI & Web UI

- [ ] Add date prompt in interactivePrompts.ts

- [ ] Add year prompt in interactivePrompts.ts

- [ ] Add date input rendering in web UI

- [ ] Add year input rendering in web UI

- [ ] Test interactive fill with date and year fields

### Phase 7: Tests

- [ ] Add unit tests for DateField schema

- [ ] Add unit tests for YearField schema

- [ ] Add unit tests for parser (date-field)

- [ ] Add unit tests for parser (year-field)

- [ ] Add unit tests for serializer (date-field)

- [ ] Add unit tests for serializer (year-field)

- [ ] Add unit tests for validator (date-field)

- [ ] Add unit tests for validator (year-field)

- [ ] Add unit tests for apply (set_date)

- [ ] Add unit tests for apply (set_year)

- [ ] Run full test suite

### Phase 8: Examples & Documentation

- [ ] Update simple.form.md with date and year examples

- [ ] Update startup-deep-research.form.md with proper date/year fields

- [ ] Update arch-markform-design.md (move date from MF/0.2, add year)

- [ ] Update README.md

- [ ] Update any specification docs

## Revision History

| Date | Author | Changes |
| --- | --- | --- |
| 2025-12-27 | Claude | Initial draft |
| 2025-12-27 | Claude | Added year-field type alongside date-field |
```
