# Plan Spec: Examples and Placeholder Attributes

## Purpose

Add two new optional attributes (`examples` and `placeholder`) to text-entry field types
to provide better guidance for form fillers (agents and humans).
These attributes help illustrate expected values and provide placeholder text for UI
display.

## Background

Currently, Markform fields can have `label`, `required`, `priority`, and other
constraints, but there’s no standardized way to provide example values or placeholder
text. Form authors often include this guidance in `{% instructions %}` blocks, but:

1. Instructions are prose-based and harder for agents to parse programmatically

2. Placeholders are a common UI pattern but not supported natively

3. Examples are valuable for illustrating the expected format/content but must be
   extracted from free-text instructions

Adding dedicated `examples` and `placeholder` attributes provides structured,
machine-readable guidance that can be:

- Displayed in console and web UIs as placeholder text

- Included in tool schemas for agent consumption

- Validated by the engine (type checking, appropriate field types)

Reference: `SPEC.md` Layer 2 (Form Data Model) and Layer 1 (Syntax) for field type
definitions.

## Summary of Task

Add two new optional attributes to **text-entry field types only**:

1. **`placeholder`** (string): A short hint displayed in empty fields in console and web
   UIs. Agents also see this in the field schema.

2. **`examples`** (string[]): An array of example values showing typical valid inputs.
   Useful for agents to understand expected format and content.

**Applicable field types** (text-entry fields):

- `string-field` (kind: `'string'`)

- `number-field` (kind: `'number'`)

- `string-list` (kind: `'string_list'`)

- `url-field` (kind: `'url'`)

- `url-list` (kind: `'url_list'`)

**Inapplicable field types** (chooser fields):

- `single-select` (kind: `'single_select'`) — options define the choices

- `multi-select` (kind: `'multi_select'`) — options define the choices

- `checkboxes` (kind: `'checkboxes'`) — options define the choices

Applying `examples` or `placeholder` to an inapplicable field type is a **parse error**.

## Backward Compatibility

**BACKWARD COMPATIBILITY REQUIREMENTS:**

- **Code types, methods, and function signatures**: DO NOT MAINTAIN - Adding optional
  properties to interfaces is additive and compatible

- **Library APIs**: DO NOT MAINTAIN - New optional attributes; existing forms continue
  to work

- **Server APIs**: N/A

- **File formats**: DO NOT MAINTAIN - Adding new optional attributes is
  forward-compatible; old forms without these attributes parse correctly

- **Database schemas**: N/A

## Stage 1: Planning Stage

### Feature Requirements

**Must Have:**

1. **`placeholder` attribute** (string, optional):

   - Available on text-entry field types only

   - Displayed as placeholder/hint in console and web UIs

   - Included in exported field schema for agent tools

   - If applied to chooser field → parse error

2. **`examples` attribute** (string[], optional):

   - Available on text-entry field types only

   - Array of example values (strings, even for number fields - parsed for display)

   - Included in exported field schema for agent tools

   - If applied to chooser field → parse error

3. **Validation**:

   - Parse-time validation: reject `examples`/`placeholder` on chooser fields

   - Type validation: `placeholder` must be string, `examples` must be string array

   - **Examples type validation** (parse error): For number-field, all examples must
     parse as valid numbers.
     For url-field/url-list, all examples must be valid URLs.

   - **Placeholder type validation** (warning only): For number-field, warn if
     placeholder doesn’t parse as number.
     For url-field/url-list, warn if not valid URL. (Placeholders often include
     decorative text like “e.g., 123 …” that won’t parse.)

4. **UI Integration**:

   - Console UI: show placeholder in empty field prompts

   - Web UI: use as HTML placeholder attribute

   - Examples shown in field help/instructions area

   - For list fields (string-list, url-list): placeholder applies to **each item**
     input, not the field as a whole

5. **Tool/Export Integration**:

   - Include in `ExportedField` schema

   - Include in AI SDK tool schemas for agent consumption

**Nice to Have:**

1. Example count limits (e.g., max 5 examples recommended)

**Not in Scope:**

1. Validation that examples satisfy field constraints (pattern, min/max, etc.)

2. Dynamic placeholder generation from constraints

3. Examples for individual options within chooser fields

### Acceptance Criteria

1. **Parsing**: Forms with `placeholder="..."` and `examples=["a", "b"]` on string-field
   parse correctly

2. **Error on invalid usage**: Form with `placeholder="..."` on single-select produces
   parse error

3. **Serialization**: Attributes round-trip correctly through parse → serialize

4. **Console UI**: Empty string-field shows placeholder text as hint

5. **Web UI**: Empty string-field input has placeholder attribute

6. **Export**: `ExportedField` includes `placeholder` and `examples` when present

### Open Questions

1. **Number field examples**: Should examples for number-field be strings (for display)
   or numbers (for type safety)?
   **Resolution**: Strings in markup (Markdoc attribute syntax).
   Validated as parseable numbers at parse time—**parse error** if any example doesn’t
   parse.

2. **List field placeholders**: For string-list and url-list, does placeholder apply to
   each item or the whole field?
   **Resolution**: Placeholder applies to **each item** input in the UI. This is the
   natural UX since list fields render as multiple input areas.

3. **Example length limits**: Should we enforce max length on examples to prevent abuse?
   **Resolution**: No hard limit; document as recommendation (3-5 examples typically
   sufficient).

4. **Placeholder type validation**: Should placeholder be validated as parseable for the
   field type? **Resolution**: **Warning only** (not error).
   Placeholders often include decorative text like ellipsis ("e.g., 123...") that
   wouldn’t parse as the target type.

## Stage 2: Architecture Stage

### Changes to SPEC.md

**Layer 1 (Syntax) Updates:**

1. Add `placeholder` and `examples` to **Common attributes (all field types)** table
   with note about applicability

2. Add new section **Text-Entry Field Attributes** documenting these attributes

3. Add validation error codes for inappropriate usage

**Layer 2 (Form Data Model) Updates:**

1. Update `FieldBase` interface to include optional `placeholder` and `examples`

2. Update field type mappings table to show which types support these attributes

3. Update Zod schemas for field parsing

**Layer 3 (Validation) Updates:**

1. Add parse-time validation for inappropriate attribute usage

2. Add error codes:

   - `PLACEHOLDER_NOT_ALLOWED` — placeholder on chooser field

   - `EXAMPLES_NOT_ALLOWED` — examples on chooser field

   - `EXAMPLE_TYPE_MISMATCH` — example doesn’t parse as field type (e.g., “abc” for
     number)

   - `PLACEHOLDER_TYPE_MISMATCH` (warning) — placeholder doesn’t parse as field type

**Layer 4 (Tool API) Updates:**

1. Update `ExportedField` to include optional `placeholder` and `examples`

### Code Changes

**1. Core Types (`src/core/coreTypes.ts`):**

```typescript
interface FieldBase {
  // ... existing fields ...
  placeholder?: string;    // NEW: hint text for empty field
  examples?: string[];     // NEW: example values
}
```

**2. Parser (`src/core/parser.ts`):**

- Extract `placeholder` and `examples` from field attributes

- Validate they are only on text-entry fields (string, number, string_list, url,
  url_list)

- Produce parse error if on chooser fields

**3. Serializer (`src/core/serialize.ts`):**

- Include `placeholder` and `examples` in serialized output

- Proper attribute ordering (alphabetical)

**4. Export Helpers (`src/core/exportHelpers.ts`):**

- Add to `ExportedField` interface

- Include in exported schema

**5. Console UI (`src/cli/`):**

- Show placeholder in field prompts

**6. Web UI (`src/serve/`):**

- Add placeholder attribute to input elements

- Display examples in help area

### Applicable Field Types

The following constants define which field kinds support these attributes:

```typescript
/** Field kinds that accept text entry (support placeholder/examples) */
export const TEXT_ENTRY_FIELD_KINDS = [
  'string',
  'number', 
  'string_list',
  'url',
  'url_list',
] as const;

/** Field kinds that are choosers (do NOT support placeholder/examples) */
export const CHOOSER_FIELD_KINDS = [
  'single_select',
  'multi_select',
  'checkboxes',
] as const;

export function isTextEntryFieldKind(kind: FieldKind): boolean {
  return (TEXT_ENTRY_FIELD_KINDS as readonly string[]).includes(kind);
}
```

## Stage 3: Refine Architecture

### Reusable Components

1. **Parser field extraction** (`src/core/parser.ts`):

   - Already extracts field attributes; add two more optional attributes

2. **Serializer attribute ordering** (`src/core/serialize.ts`):

   - Already handles alphabetical attribute ordering; new attributes integrate

3. **Export field mapping** (`src/core/exportHelpers.ts`):

   - Already maps Field → ExportedField; add passthrough for new attributes

4. **Console field rendering** (`src/cli/commands/fill.ts`):

   - Already renders field prompts; add placeholder display

### Simplification

- No new modules needed; this is additive to existing parsing/serialization

- Validation logic adds ~20 lines for field kind checking

- UI integration is minimal (placeholder attribute, examples display)

## Stage 4: Implementation

### Phase 1: Core Type and Parser Updates

- [ ] Add `placeholder?: string` and `examples?: string[]` to `FieldBase` in
  coreTypes.ts

- [ ] Add `TEXT_ENTRY_FIELD_KINDS` and `CHOOSER_FIELD_KINDS` constants

- [ ] Add `isTextEntryFieldKind()` helper function

- [ ] Update parser to extract `placeholder` and `examples` from field attributes

- [ ] Add parse-time validation: error if these attributes appear on chooser fields

- [ ] Add type validation for examples: error if example doesn’t parse as field type

- [ ] Add type validation for placeholder: warning if doesn’t parse as field type

- [ ] Add error codes to error taxonomy:

  - `PLACEHOLDER_NOT_ALLOWED`, `EXAMPLES_NOT_ALLOWED`

  - `EXAMPLE_TYPE_MISMATCH`, `PLACEHOLDER_TYPE_MISMATCH` (warning)

- [ ] Write parser tests for valid usage (string-field with placeholder/examples)

- [ ] Write parser tests for invalid usage (single-select with placeholder → error)

- [ ] Write parser tests for type validation (number-field with non-numeric example →
  error)

- [ ] Write parser tests for placeholder warning (number-field with “e.g., 123...” →
  warning)

### Phase 2: Serialization and Export

- [ ] Update serializer to include `placeholder` and `examples` in output

- [ ] Verify alphabetical attribute ordering includes new attributes

- [ ] Update `ExportedField` interface to include optional `placeholder` and `examples`

- [ ] Update export helpers to include these in schema export

- [ ] Write round-trip tests (parse → serialize → parse)

- [ ] Write export tests verifying attributes appear in JSON/YAML export

### Phase 3: UI Integration

- [ ] Update console fill prompts to display placeholder for empty fields

- [ ] Update console fill to show examples as hints

- [ ] Update web UI input elements with placeholder attribute

- [ ] Update web UI to display examples in field help area

- [ ] Manual test console UI with placeholder/examples

- [ ] Manual test web UI with placeholder/examples

### Phase 4: Spec and Documentation

**Update SPEC.md:**

- [ ] Layer 1 (Syntax): Add `placeholder` and `examples` to **Common attributes** table
  with note: “Text-entry fields only (string, number, string_list, url, url_list)”

- [ ] Layer 1 (Syntax): Add new subsection **Text-Entry Field Attributes** after Common
  attributes, documenting `placeholder` (string) and `examples` (string[])

- [ ] Layer 2 (Data Model): Update `FieldBase` interface to include:
  ```typescript
  placeholder?: string;    // Hint text for empty field (text-entry only)
  examples?: string[];     // Example values (text-entry only)
  ```

- [ ] Layer 2 (Data Model): Update **Comprehensive Field Type Reference** table to show
  which types support placeholder/examples

- [ ] Layer 3 (Validation): Add to **Standard error codes** table:

  - `PLACEHOLDER_NOT_ALLOWED` — placeholder on chooser field (error)

  - `EXAMPLES_NOT_ALLOWED` — examples on chooser field (error)

  - `EXAMPLE_TYPE_MISMATCH` — example doesn’t parse as field type (error)

  - `PLACEHOLDER_TYPE_MISMATCH` — placeholder doesn’t parse as field type (warning)

- [ ] Layer 4 (Tool API): Update `ExportedField` interface to include:
  ```typescript
  placeholder?: string;
  examples?: string[];
  ```

**Update packages/markform/DOCS.md:**

- [ ] Add `placeholder` and `examples` to **Common Attributes** table

- [ ] Add note about text-entry field applicability

- [ ] Add example usage in **String Field** section showing placeholder/examples

- [ ] Add example usage in **Number Field** section showing placeholder/examples

- [ ] Update **Complete Example** form to include a field with placeholder/examples

**Update README.md:**

- [ ] In **A Simple Form** section, add placeholder/examples to one field as
  illustration

- [ ] In **Key concepts** bullet list, add mention of `placeholder` and `examples`

- [ ] Ensure the simple form example demonstrates these attributes naturally

**Update example forms:**

- [ ] Add placeholder/examples to `simple/simple.form.md` demonstrating usage

- [ ] Add placeholder/examples to at least one field in `movie-research-simple.form.md`

## Stage 5: Validation

### Automated Test Coverage

- [ ] Parser extracts placeholder from string-field correctly

- [ ] Parser extracts examples array from string-field correctly

- [ ] Parser rejects placeholder on single-select with parse error

- [ ] Parser rejects examples on multi-select with parse error

- [ ] Parser rejects placeholder on checkboxes with parse error

- [ ] Parser rejects non-numeric example on number-field with parse error

- [ ] Parser rejects invalid URL example on url-field with parse error

- [ ] Parser emits warning for non-numeric placeholder on number-field

- [ ] Serializer includes placeholder/examples in output

- [ ] Round-trip preserves placeholder/examples

- [ ] Export includes placeholder/examples in ExportedField

### Manual Testing Checklist

- [ ] Create form with string-field having placeholder and examples

- [ ] Run `markform fill` and verify placeholder shown in console

- [ ] Run `markform serve` and verify placeholder in web UI input

- [ ] Run `markform export --format=json` and verify attributes in schema

- [ ] Create form with placeholder on single-select → verify parse error message

- [ ] Verify examples displayed appropriately in both UIs

- [ ] Verify SPEC.md has all updates (Layer 1-4)

- [ ] Verify DOCS.md Common Attributes table includes new attributes

- [ ] Verify README.md example form demonstrates placeholder/examples

- [ ] Run `markform docs` and verify new attributes appear in output

- [ ] Run `markform spec` and verify new attributes appear in output

## Appendix: Example Syntax

### Valid Usage

```md
{% string-field id="company_name" label="Company name" required=true 
   placeholder="e.g., Acme Corporation" 
   examples=["Apple Inc.", "Microsoft Corporation", "Alphabet Inc."] %}
{% /string-field %}

{% number-field id="revenue_m" label="Revenue (millions USD)" 
   placeholder="e.g., 1234.56"
   examples=["100.5", "1000", "50000.75"] %}
{% /number-field %}

{% url-field id="website" label="Company website" 
   placeholder="https://example.com"
   examples=["https://apple.com", "https://microsoft.com"] %}
{% /url-field %}

{% string-list id="key_risks" label="Key risks" minItems=3
   placeholder="Describe one specific risk"
   examples=["Supply chain disruption", "Key person dependency", "Regulatory changes"] %}
{% /string-list %}

<!-- Note: placeholder applies to each item input, not the field as a whole -->
```

### Invalid Usage (Parse Errors)

```md

<!-- ERROR: placeholder not allowed on single-select -->

{% single-select id="rating" label="Rating" placeholder="Choose one" %}
- [ ] Bullish {% #bullish %}
- [ ] Bearish {% #bearish %}
{% /single-select %}

<!-- ERROR: examples not allowed on checkboxes -->

{% checkboxes id="tasks" label="Tasks" examples=["Task A", "Task B"] %}
- [ ] Review docs {% #review %}
- [ ] Write tests {% #tests %}
{% /checkboxes %}

<!-- ERROR: example doesn't parse as number -->

{% number-field id="revenue" label="Revenue" 
   examples=["100", "not a number", "300"] %}
{% /number-field %}

<!-- ERROR: example is not a valid URL -->

{% url-field id="website" label="Website" 
   examples=["https://example.com", "not-a-url"] %}
{% /url-field %}
```

### Valid Usage with Decorative Placeholder (Warning)

```md

<!-- WARNING: placeholder doesn't parse as number, but allowed -->

{% number-field id="revenue_m" label="Revenue (millions)" 
   placeholder="e.g., 1234.56..."
   examples=["100.5", "1000", "50000.75"] %}
{% /number-field %}
```

The placeholder `"e.g., 1234.56..."` doesn’t parse as a number (due to “e.g.” and
“...”), so the parser emits a warning.
This is allowed since placeholders are for human display and often include decorative
text.

## Appendix: Spec Diff Summary

Changes needed to SPEC.md:

| Section | Change |
| --- | --- |
| Layer 1: Common attributes table | Add `placeholder` and `examples` with applicability note |
| Layer 1: New section | "Text-Entry Field Attributes" explaining these |
| Layer 2: FieldBase interface | Add `placeholder?: string` and `examples?: string[]` |
| Layer 2: Field type mappings | Add Attributes column showing placeholder/examples support |
| Layer 3: Standard error codes | Add `PLACEHOLDER_NOT_ALLOWED`, `EXAMPLES_NOT_ALLOWED`, `EXAMPLE_TYPE_MISMATCH`, `PLACEHOLDER_TYPE_MISMATCH` (warning) |
| Layer 4: ExportedField | Add `placeholder?: string` and `examples?: string[]` |
