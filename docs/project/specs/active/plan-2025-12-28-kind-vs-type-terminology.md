# Plan Spec: Kind vs Type Terminology Formalization

## Purpose

Formalize and document the distinction between **field kind** (Markform’s field
classification) and **data type** (the underlying value representation).
This creates a clear, consistent taxonomy for the spec, docs, and code.

## Background

The current codebase uses `FieldKind` correctly for field classification (`string`,
`single_select`, `table`, etc.), but documentation and comments inconsistently use terms
like “field type,” “field kind,” and “type” interchangeably.
This creates confusion, especially with the addition of `table-field` where `ColumnType`
introduces another layer.

**Current state:**

- `FieldKind` type exists and is used correctly in code

- `ColumnType` type exists for table cell types

- Comments and docs use “field type” when they mean “field kind”

- SPEC.md has scattered terminology but no formal taxonomy section

- The relationship between kinds and underlying data types is implicit

**Goal:** Establish clear terminology that:

1. Distinguishes **kind** (Markform concept for the type of a field) from **type** (data
   representation)

2. Documents the kind → type mapping explicitly

3. Provides a taxonomy of field kind categories (Simple, List, Chooser, Structured)

4. Updates all docs and key code comments for consistency

## Summary of Task

Add a formal “Type System” section to SPEC.md with:

1. Terminology definitions

2. Data type taxonomy (primitives, scalars, enums, collections, structured)

3. Field kind taxonomy (Simple, List, Chooser, Structured categories)

4. Complete kind → type mapping table

Update DOCS.md, README.md, and code comments to use consistent terminology.

## Backward Compatibility

**BACKWARD COMPATIBILITY REQUIREMENTS:**

- **Code types, methods, and function signatures**: DO NOT MAINTAIN — type names remain
  unchanged (`FieldKind`, `ColumnType` are already correct)

- **Library APIs**: N/A — no API changes

- **Server APIs**: N/A — no API changes

- **File formats**: N/A — no file format changes

- **Database schemas**: N/A — no database changes

This is a **documentation-only change**. No code behavior changes.

## Stage 1: Planning Stage

### Current Terminology Audit

**In SPEC.md:**

- Uses “field type” in 12+ places where “field kind” would be clearer

- Has a `FieldKind` type definition but no taxonomy explanation

- `ColumnType` is defined for tables but relationship to kinds is implicit

- No formal “Type System” section

**In code (`coreTypes.ts`, `fieldRegistry.ts`):**

- `FieldKind` — correct name, used consistently

- `ColumnType` — correct name, used consistently

- Comments say “field type” in several places (should be “field kind”)

- `FieldTypeMap` — confusing name (maps kinds to types, not types to types)

**In DOCS.md:**

- Uses “Field Types” as section header (should be “Field Kinds”)

- Otherwise reasonably consistent

**In README.md:**

- Uses “Field types” in feature list (should be “Field kinds”)

### Proposed Terminology

| Term | Definition | Examples |
| --- | --- | --- |
| **Field Kind** | Markform field classification. Determines syntax, validation, behavior. | `string`, `single_select`, `table` |
| **Data Type** | TypeScript/JSON type of the value. | `string`, `number`, `string[]` |
| **Value Type** | Complete type expression including nullability. | `string \| null`, `OptionId[]` |
| **Scalar Type** | Single atomic value (optionally format-constrained). | `string`, `url`, `date`, `year` |
| **Column Type** | Type of a cell in a table (subset of scalar types). | `string`, `number`, `url` |

### Field Kind Categories

The following taxonomy diagram is normative and should appear in SPEC.md exactly as
shown:

```
Field Kinds
├── Simple Kinds ──────── Single scalar value (nullable)
│   ├── string           Also usable as column types
│   ├── number           in table fields
│   ├── url
│   ├── date
│   └── year
│
├── List Kinds ────────── Ordered array of scalars
│   ├── string_list      Open-ended (user provides items)
│   └── url_list
│
├── Chooser Kinds ─────── Selection from predefined options
│   ├── single_select    Pick one
│   ├── multi_select     Pick many
│   └── checkboxes       State per option
│
└── Structured Kinds ──── Complex nested data
    └── table            Rows × typed columns
```

### Kind → Type Mapping

The following mapping table is normative and should appear in SPEC.md exactly as shown:

| Field Kind | Category | Value Type | Base Type | Notes |
| --- | --- | --- | --- | --- |
| `string` | Simple | `string \| null` | `string` | Plain text |
| `number` | Simple | `number \| null` | `number` | Integer or float |
| `url` | Simple | `string \| null` | `string` | URL format validated |
| `date` | Simple | `string \| null` | `string` | ISO 8601 format |
| `year` | Simple | `number \| null` | `number` | Integer year |
| `string_list` | List | `string[]` | `Array<string>` | Empty = `[]` |
| `url_list` | List | `string[]` | `Array<string>` | URL format validated |
| `single_select` | Chooser | `OptionId \| null` | `string` (enum) | One of options |
| `multi_select` | Chooser | `OptionId[]` | `Array<string>` (enum) | Subset of options |
| `checkboxes` | Chooser | `Record<OptionId, CheckboxValue>` | `Record<string, string>` | State per option |
| `table` | Structured | `TableRow[]` | `Array<Record<string, CellValue>>` | Typed columns |

### Not in Scope

- Changing the syntax (e.g., `{% field kind="string" %}` proposal is separate)

- Renaming `FieldTypeMap` (would require code changes; can be done separately)

- Adding new field kinds

## Stage 2: Architecture Stage

### Changes by File

#### SPEC.md Changes

1. **Add new section after “Layer 2: Form Data Model” intro** (~line 1045):

   - “Type System Terminology” subsection with definitions table

   - “Data Type Taxonomy” subsection (primitives, scalars, enums, collections)

   - “Field Kind Taxonomy” subsection with ASCII diagram

   - “Kind → Type Mapping” comprehensive table

2. **Update existing sections:**

   **Layer 1 (Syntax):**

   - Line 206-209: “identifies the field type” → “identifies the field kind”

   - Line 207: “reserved exclusively for field types” → “reserved exclusively for field
     kinds”

   - Line 229: “Common attributes (all field types)” → “(all field kinds)”

   - Line 248: “text-entry field types” → “text-entry field kinds”

   - Line 276: “selection field types” → “selection field kinds”

   - Line 279: Table header “Field Type” → “Field Kind” (this table lists kinds like
     `checkboxes`, `single-select`)

   - Line 510: “based on field type” → “based on field kind”

   **Layer 2 (Data Model):**

   - Line 1055: Comment “orthogonal to field type” → “orthogonal to field kind”

   - Line 1671: Section header “Comprehensive Field Type Reference” → “Comprehensive
     Field Kind Reference”

   - Line 1674: “for all field types” → “for all field kinds”

   - Line 1687: Table row “Kind values (field types)” → “Kind values (field kinds)”

   - Line 1699: “Reserved for field type discrimination” → “Reserved for field kind
     discrimination”

   - Line 1703: Section header “Field Type Mappings” → “Field Kind Mappings”

   **Layer 3 (Validation):**

   - Line 1484: Table header “Field Type” → “Field Kind” (implicit requiredness table)

   - Line 1875: Table header “Field Type” → “Field Kind” (validation checks table)

   - Line 1899: “semantics for each field type” → “semantics for each field kind”

   - Line 1902: Table header “Field Type” → “Field Kind” (required field semantics
     table)

   - Line 2228: Keep as-is (correctly refers to value type matching kind)

3. **Add cross-references:**

   - Link to new Type System section from Layer 1 field tag descriptions

   - Link from ColumnType definition to the Type System taxonomy

#### DOCS.md Changes

1. **Section header:** “Field Types” → “Field Kinds” (line ~57)

2. **Throughout:** Replace “field type” with “field kind” where referring to kinds

3. **Add brief terminology note** at start of Field Kinds section

#### README.md Changes

1. **Line 116:** “Field types” → “Field kinds”

2. **Line 141:** “field types” → “field kinds”

#### Code Comment Changes

**`packages/markform/src/engine/parseFields.ts`:**

- Line 2: “Field type parsers” → “Field kind parsers”

- Line 4: “each field type” → “each field kind”

**`packages/markform/src/engine/fieldRegistry.ts`:**

- Line 2: “Field Type Registry” → “Field Kind Registry” (or keep as-is with clarifying
  comment)

- Line 5: “field type requires” → “field kind requires”

- Line 86: “field kind to its corresponding types” — already correct

- Line 164-172: Comments about `FieldTypeMap` — add clarifying note that this maps kinds
  to types

**`packages/markform/src/engine/coreTypes.ts`:**

- Line 102: Section header “Field Types” → “Field Definitions” (types is ambiguous)

- Line 122: “all field types” → “all field kinds”

- Line 139: Section header “Field Kind Categories” — already correct

- Line 247: Section header “Table Field Types” → “Table Field Definitions”

- Line 297: “all field types” → “all field kinds”

**`packages/markform/src/cli/lib/interactivePrompts.ts`:**

- Line 703: “based on field type” → “based on field kind”

- Line 750: “Unknown field type” → “Unknown field kind”

**`packages/markform/src/cli/commands/serve.ts`:**

- Line 782: “unknown field type” → “unknown field kind”

**`packages/markform/src/harness/prompts.ts`:**

- Line 89: “each field type” → “each field kind”

- Line 94: “match the field type” → “match the field kind”

**`packages/markform/src/engine/inspect.ts`:**

- Line 148: “various field types” → “various field kinds”

**`packages/markform/src/index.ts`:**

- Line 32: Comment “Field types” → “Field kinds”

**`packages/markform/src/harness/mockAgent.ts`:**

- Line 122: “based on field kind” — already correct

### Test File Changes

No test logic changes needed.
Update comments only:

**`packages/markform/tests/unit/web/serve-render.test.ts`:**

- Line 5: “all field types” → “all field kinds”

- Line 756-792: Update test description strings

**`packages/markform/tests/unit/cli/interactivePrompts.test.ts`:**

- Line 1039-1151: Update test description strings

### Type Name Decisions

| Current Name | Decision | Rationale |
| --- | --- | --- |
| `FieldKind` | Keep | Correct terminology |
| `ColumnType` | Keep | Correct — columns have types, not kinds |
| `FieldTypeMap` | Keep (for now) | Renaming would require code changes; add clarifying docstring |
| `CellValue` | Keep | Correct — values have types |

## Stage 3: Implementation

### Phase 1: SPEC.md Type System Section

**Goal:** Add the formal taxonomy to SPEC.md as specified below.

- [ ] Add “Type System” subsection after Layer 2 intro (~line 1045)

- [ ] Add terminology definitions table (as shown below)

- [ ] Add data type taxonomy (primitives, scalars, enums, collections, structured)

- [ ] Add field kind taxonomy diagram (as shown below)

- [ ] Add kind → type mapping table (as shown below)

- [ ] Cross-reference from ColumnType definition

**The following content should be added to SPEC.md** (insert after line 1045, before
“#### Canonical TypeScript Types”). The taxonomy diagram and mapping table are normative
— use exactly as drafted:

```markdown
#### Type System

This section formalizes the distinction between **field kinds** (Markform's field
classification) and **data types** (the underlying value representation).

##### Terminology

| Term | Definition | Examples |
| --- | --- | --- |
| **Field Kind** | Markform field classification. Determines syntax, validation, and behavior. | `string`, `single_select`, `table` |
| **Data Type** | TypeScript/JSON type of the value. | `string`, `number`, `string[]` |
| **Value Type** | Complete type expression including nullability. | `string \| null`, `OptionId[]` |
| **Scalar Type** | Single atomic value (optionally format-constrained). | `string`, `url`, `date` |
| **Column Type** | Type of a cell in a table field (subset of scalar types). | `string`, `number`, `url` |

##### Data Type Taxonomy

**Primitive Types** — Base JSON types:

| Primitive | Description |
| --- | --- |
| `string` | UTF-8 text |
| `number` | IEEE 754 float (includes integers) |
| `boolean` | true/false |
| `null` | Absence of value |

**Scalar Types** — Primitives with optional format constraints:

| Scalar Type | Base Primitive | Format Constraint |
| --- | --- | --- |
| `string` | `string` | — |
| `number` | `number` | — |
| `url` | `string` | Valid URL |
| `date` | `string` | ISO 8601 (YYYY-MM-DD) |
| `year` | `number` | Integer in valid year range |

**Enum Types** — Values constrained to a defined set:

| Enum Type | Base Primitive | Values |
| --- | --- | --- |
| `OptionId` | `string` | One of the field's defined option IDs |
| `CheckboxValue` | `string` | State tokens based on `checkboxMode` |

**Collection Types** — Compound types:

| Collection Type | Structure |
| --- | --- |
| `Array<T>` | Ordered list of `T` |
| `Record<K, V>` | Key-value map |

**Structured Types** — Complex domain objects:

| Structured Type | Definition |
| --- | --- |
| `TableRow` | `Record<ColumnId, CellValue>` |
| `CellValue` | Scalar type determined by column's type |

##### Field Kind Taxonomy

Field kinds are organized into four categories:

~~~
Field Kinds
├── Simple Kinds ──────── Single scalar value (nullable)
│   ├── string           Also usable as column types
│   ├── number           in table fields
│   ├── url
│   ├── date
│   └── year
│
├── List Kinds ────────── Ordered array of scalars
│   ├── string_list      Open-ended (user provides items)
│   └── url_list
│
├── Chooser Kinds ─────── Selection from predefined options
│   ├── single_select    Pick one
│   ├── multi_select     Pick many
│   └── checkboxes       State per option
│
└── Structured Kinds ──── Complex nested data
    └── table            Rows × typed columns
~~~

**Simple Kinds** can also be used as column types in table fields.

##### Kind → Type Mapping

| Field Kind | Category | Value Type | Base Type | Notes |
| --- | --- | --- | --- | --- |
| `string` | Simple | `string \| null` | `string` | Plain text |
| `number` | Simple | `number \| null` | `number` | Integer or float |
| `url` | Simple | `string \| null` | `string` | URL format validated |
| `date` | Simple | `string \| null` | `string` | ISO 8601 format |
| `year` | Simple | `number \| null` | `number` | Integer year |
| `string_list` | List | `string[]` | `Array<string>` | Empty = `[]` |
| `url_list` | List | `string[]` | `Array<string>` | URL format validated |
| `single_select` | Chooser | `OptionId \| null` | `string` (enum) | One of defined options |
| `multi_select` | Chooser | `OptionId[]` | `Array<string>` (enum) | Subset of options |
| `checkboxes` | Chooser | `Record<OptionId, CheckboxValue>` | `Record<string, string>` | State per option |
| `table` | Structured | `TableRow[]` | `Array<Record<string, CellValue>>` | Typed columns |
```

### Phase 2: SPEC.md Terminology Fixes

**Goal:** Update existing SPEC.md text for consistency

**Layer 1 (Syntax) updates:**

- [ ] Line 206-209: “field type” → “field kind” (2 occurrences)

- [ ] Line 229: “all field types” → “all field kinds”

- [ ] Line 248: “text-entry field types” → “text-entry field kinds”

- [ ] Line 276: “selection field types” → “selection field kinds”

- [ ] Line 279: Table header “Field Type” → “Field Kind”

- [ ] Line 510: “field type” → “field kind”

**Layer 2 (Data Model) updates:**

- [ ] Line 1055: Comment “orthogonal to field type” → “orthogonal to field kind”

- [ ] Line 1671: Section header “Field Type Reference” → “Field Kind Reference”

- [ ] Line 1674: “for all field types” → “for all field kinds”

- [ ] Line 1687: Table row update

- [ ] Line 1699: “field type discrimination” → “field kind discrimination”

- [ ] Line 1703: Section header “Field Type Mappings” → “Field Kind Mappings”

**Layer 3 (Validation) updates:**

- [ ] Line 1484: Table header “Field Type” → “Field Kind” (implicit requiredness table)

- [ ] Line 1875: Table header “Field Type” → “Field Kind” (validation checks table)

- [ ] Line 1899: “for each field type” → “for each field kind”

- [ ] Line 1902: Table header “Field Type” → “Field Kind”

### Phase 3: DOCS.md and README.md

**Goal:** Update user-facing docs

- [ ] DOCS.md: “Field Types” section header → “Field Kinds”

- [ ] DOCS.md: Add terminology note

- [ ] DOCS.md: Replace “field type” → “field kind” throughout

- [ ] README.md: Line 116 update

- [ ] README.md: Line 141 update

### Phase 4: Code Comments

**Goal:** Update code comments for consistency

- [ ] `parseFields.ts`: Lines 2, 4

- [ ] `fieldRegistry.ts`: Lines 2, 5, 186, 298 + add clarifying docstring for
  `FieldTypeMap`

- [ ] `coreTypes.ts`: Lines 102, 122, 247, 297 section headers

- [ ] `interactivePrompts.ts`: Lines 703, 750

- [ ] `serve.ts`: Line 782

- [ ] `prompts.ts`: Lines 89, 94

- [ ] `inspect.ts`: Line 148

- [ ] `index.ts`: Line 32

### Phase 5: Test Comments

**Goal:** Update test descriptions

- [ ] `serve-render.test.ts`: Update descriptions

- [ ] `interactivePrompts.test.ts`: Update descriptions

## Stage 4: Validation

### Checklist

- [ ] SPEC.md has formal Type System section with complete taxonomy

- [ ] All “field type” occurrences reviewed and updated where appropriate

- [ ] DOCS.md section headers use “Field Kinds”

- [ ] README.md uses consistent terminology

- [ ] Code comments updated

- [ ] No functional changes to code behavior

- [ ] `grep -i "field type"` shows only intentional uses (data types, not field kinds)

### Verification Commands

```bash
# Check for remaining "field type" that should be "field kind"
grep -rn "field type" packages/markform/src --include="*.ts" | grep -v "value type"

# Verify FieldKind usage is consistent
grep -rn "FieldKind" packages/markform/src --include="*.ts"

# Check test descriptions
grep -rn "field type" packages/markform/tests --include="*.ts"
```

## Open Questions

1. **Should we rename `FieldTypeMap`?** It maps kinds to types, so `FieldKindTypeMap` or
   `KindToTypeMap` would be clearer.
   However, this requires code changes beyond comments.
   **Decision:** Keep name, add clarifying docstring.
   Can rename in separate PR.

2. **Should we add a glossary to DOCS.md?** The quick reference is meant to be concise.
   **Decision:** Add brief terminology note only; full taxonomy is in SPEC.md.
