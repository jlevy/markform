# Plan Spec: URL Field Types

## Purpose

This is a technical design doc for adding dedicated URL field types (`url-field` and
`url-list`) to markform.
URLs are a fundamental data type for research and citation-heavy forms, warranting
first-class support rather than being represented as generic strings.

## Background

**Markform** supports these field types in v0.1:

| Tag | Type | Purpose |
| --- | --- | --- |
| `string-field` | string | Single text value |
| `number-field` | number | Numeric value |
| `string-list` | string_list | List of strings |
| `single-select` | single_select | Pick one from options |
| `multi-select` | multi_select | Pick multiple from options |
| `checkboxes` | checkboxes | Stateful checklist |

**Gap:** No dedicated URL type.
URLs are currently represented as `string-field` with an optional regex pattern, which:

- Lacks semantic clarity for agents (they don’t know they need to provide a URL)

- Requires manual pattern configuration in each form

- Doesn’t provide built-in URL format validation

- Can’t be rendered as clickable links in UIs without heuristics

**Use Cases:**

- Research forms with citations (sources, references)

- Startup due diligence with links to PitchBook, Crunchbase, news articles

- Political research with Wikipedia, official sources

- Any form requiring verified external references

**Related Docs:**

- [arch-markform-design.md.md](../architecture/current/arch-markform-design.md.md)

## Summary of Task

Add two new field types to markform:

1. **`url-field`** - Single URL value with built-in format validation

2. **`url-list`** - List of URLs (for citations, sources, references)

**Syntax:**

```markdown
{% url-field id="website" label="Company Website" required=true %}{% /url-field %}

{% url-list id="sources" label="Source Citations" minItems=1 maxItems=10 %}{% /url-list %}
```

**Example filled values:**

```markdown
{% url-field id="website" label="Company Website" required=true %}
```value
https://example.com
```
{% /url-field %}

{% url-list id="sources" label="Source Citations" minItems=1 %}
```value
https://en.wikipedia.org/wiki/Example
https://www.crunchbase.com/organization/example
```
{% /url-list %}
```

## Backward Compatibility

**BACKWARD COMPATIBILITY REQUIREMENTS:**

- **Code types, methods, and function signatures**: DO NOT MAINTAIN - This is additive;
  new types extend existing unions without breaking changes

- **Library APIs**: DO NOT MAINTAIN - New exports only; existing exports unchanged

- **Server APIs**: N/A - No server APIs affected

- **File formats**: DO NOT MAINTAIN - New tags are additive; existing forms continue to
  work

- **Database schemas**: N/A - No database

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
| `src/engine/inspect.ts` | Progress/issue computation |

**Pattern to Follow:** `string-field` and `string-list` are the closest analogs:

- `url-field` follows `string-field` pattern (single value in fence)
- `url-list` follows `string-list` pattern (multiple lines in fence)

### Feature Scope

**In Scope:**

- `url-field` tag with `kind: "url"` and built-in URL format validation
- `url-list` tag with `kind: "url_list"`, `minItems`, `maxItems`, `uniqueItems`
- `UrlField`, `UrlListField`, `UrlValue`, `UrlListValue` types
- `SetUrlPatch`, `SetUrlListPatch` patch types
- Parser, serializer, validator, apply, inspect support
- Unit tests for all components
- Update `simple.form.md` example to include URL fields
- New `startup-deep-research.form.md` example demonstrating citation patterns
- Golden E2E test for the new example

**Out of Scope (Explicit Non-Goals):**

- URL shortening or normalization
- URL reachability/liveness checking
- Automatic title extraction from URLs
- Deep link validation (path/query validation)
- Non-http(s) URL schemes (mailto:, tel:, etc.) - may add later

### Acceptance Criteria

1. `url-field` and `url-list` tags parse correctly
2. URL format validation rejects obviously invalid URLs
3. URL format validation accepts common valid URLs (http, https)
4. Round-trip serialization preserves URL values exactly
5. Patches (`set_url`, `set_url_list`) work correctly
6. Inspect reports issues for empty required URL fields
7. `simple.form.md` updated with URL field examples
8. `startup-deep-research.form.md` example created with citation patterns
9. All existing tests continue to pass
10. New unit tests cover URL field scenarios
11. Golden E2E test validates end-to-end behavior

### Testing Plan

#### 1. Unit Tests: Core Types (`tests/unit/coreTypes.test.ts`)

- [ ] `UrlFieldSchema` validates correctly
- [ ] `UrlListFieldSchema` validates correctly
- [ ] `UrlValueSchema` validates correctly
- [ ] `UrlListValueSchema` validates correctly
- [ ] `SetUrlPatchSchema` validates correctly
- [ ] `SetUrlListPatchSchema` validates correctly

#### 2. Unit Tests: Parser (`tests/unit/parse.test.ts`)

- [ ] Parses empty `url-field` tag
- [ ] Parses `url-field` with value in fence
- [ ] Parses `url-field` with required=true
- [ ] Parses empty `url-list` tag
- [ ] Parses `url-list` with multiple URLs in fence
- [ ] Parses `url-list` with minItems/maxItems/uniqueItems attributes
- [ ] Handles whitespace in URL values

#### 3. Unit Tests: Serializer (`tests/unit/serialize.test.ts`)

- [ ] Serializes empty `url-field`
- [ ] Serializes `url-field` with value
- [ ] Serializes empty `url-list`
- [ ] Serializes `url-list` with multiple items
- [ ] Round-trip: parse → serialize → parse produces identical form

#### 4. Unit Tests: Validator (`tests/unit/validate.test.ts`)

- [ ] Valid URLs: `https://example.com`, `http://localhost:3000`
- [ ] Valid URLs with paths: `https://example.com/path/to/page`
- [ ] Valid URLs with query: `https://example.com?foo=bar`
- [ ] Invalid URLs: empty string, plain text, missing scheme
- [ ] `url-list` validates minItems constraint
- [ ] `url-list` validates maxItems constraint
- [ ] `url-list` validates uniqueItems constraint (if set)
- [ ] Required URL field with null value reports issue

#### 5. Unit Tests: Apply (`tests/unit/apply.test.ts`)

- [ ] `set_url` patch sets URL value
- [ ] `set_url` patch with null clears value
- [ ] `set_url_list` patch sets URL list
- [ ] `set_url_list` patch with empty array clears list
- [ ] `clear_field` works on URL fields

#### 6. Unit Tests: Inspect (`tests/unit/inspect.test.ts`)

- [ ] URL field with value shows as complete
- [ ] Required URL field without value shows as incomplete
- [ ] URL list with items shows as complete
- [ ] Required URL list without items shows as incomplete

#### 7. Integration Tests

- [ ] Parse and fill `simple.form.md` with URL fields
- [ ] Parse and fill `startup-deep-research.form.md`
- [ ] Golden session test for startup-deep-research form

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
  | "url"        // NEW
  | "url_list";  // NEW

// URL Field - single URL value
export interface UrlField extends FieldBase {
  kind: "url";
  // No additional constraints - URL format validation is built-in
}

// URL List Field - multiple URLs
export interface UrlListField extends FieldBase {
  kind: "url_list";
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
}

// URL Value
export interface UrlValue {
  kind: "url";
  value: string | null;  // null if empty, validated URL string otherwise
}

// URL List Value
export interface UrlListValue {
  kind: "url_list";
  items: string[];  // Array of URL strings
}

// Update Field union
export type Field =
  | StringField
  | NumberField
  | StringListField
  | CheckboxesField
  | SingleSelectField
  | MultiSelectField
  | UrlField       // NEW
  | UrlListField;  // NEW

// Update FieldValue union
export type FieldValue =
  | StringValue
  | NumberValue
  | StringListValue
  | CheckboxesValue
  | SingleSelectValue
  | MultiSelectValue
  | UrlValue       // NEW
  | UrlListValue;  // NEW
```

#### New Patches

```typescript
// Set URL field value
export interface SetUrlPatch {
  op: "set_url";
  fieldId: Id;
  value: string | null;
}

// Set URL list field value
export interface SetUrlListPatch {
  op: "set_url_list";
  fieldId: Id;
  items: string[];
}

// Update Patch union
export type Patch =
  | SetStringPatch
  | SetNumberPatch
  | SetStringListPatch
  | SetCheckboxesPatch
  | SetSingleSelectPatch
  | SetMultiSelectPatch
  | SetUrlPatch       // NEW
  | SetUrlListPatch   // NEW
  | ClearFieldPatch;
```

### URL Validation

Use a practical URL regex that:

- Requires `http://` or `https://` scheme

- Allows common URL characters in path/query/fragment

- Is not overly strict (allows localhost, IP addresses, ports)

```typescript
// Practical URL pattern for http/https URLs
const URL_PATTERN = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;

// Or use URL constructor for validation:
function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
```

**Recommendation:** Use the `URL` constructor for validation - it’s built into
JavaScript and handles edge cases correctly.

### Files to Modify

| File | Changes |
| --- | --- |
| `src/engine/coreTypes.ts` | Add `UrlField`, `UrlListField`, `UrlValue`, `UrlListValue`, patches, Zod schemas |
| `src/engine/parse.ts` | Add `parseUrlField()`, `parseUrlListField()`, update `parseField()` switch |
| `src/engine/serialize.ts` | Add serialization for `url` and `url_list` kinds |
| `src/engine/validate.ts` | Add URL format validation, minItems/maxItems/uniqueItems for url_list |
| `src/engine/apply.ts` | Handle `set_url` and `set_url_list` patches |
| `src/engine/inspect.ts` | Handle `url` and `url_list` in progress/issue computation |
| `src/engine/values.ts` | Add coercion support for URL types |
| `packages/markform/examples/simple/simple.form.md` | Add URL field examples |

### New Files

| File | Purpose |
| --- | --- |
| `packages/markform/examples/startup-deep-research/startup-deep-research.form.md` | Template form |
| `packages/markform/examples/startup-deep-research/startup-deep-research.mock.filled.form.md` | Mock filled form |
| `packages/markform/examples/startup-deep-research/README.md` | Example description |
| `tests/golden/sessions/startup-deep-research.session.yaml` | Golden E2E test |

## Stage 3: Refine Architecture

### Reusable Components

The implementation follows existing patterns closely:

| Component | Reuse Strategy |
| --- | --- |
| `parseStringField()` | Template for `parseUrlField()` |
| `parseStringListField()` | Template for `parseUrlListField()` |
| String field serialization | Template for URL field serialization |
| String list serialization | Template for URL list serialization |
| `validateStringField()` | Add URL-specific validation |
| `validateStringListField()` | Add URL-specific validation per item |

### Implementation Order

Implementation should proceed in dependency order:

1. **Core types** (coreTypes.ts) - Types and Zod schemas first

2. **Parser** (parse.ts) - Parse tags to types

3. **Serializer** (serialize.ts) - Serialize types to tags

4. **Validator** (validate.ts) - URL format validation

5. **Patches** (coreTypes.ts patches section) - Patch types

6. **Apply** (apply.ts) - Handle patches

7. **Inspect** (inspect.ts) - Progress/issues

8. **Unit tests** - Per component

9. **Update simple.form.md** - Add URL field examples

10. **Create startup-deep-research example** - New example form

11. **Golden E2E test** - End-to-end validation

### Example Forms

#### Updates to simple.form.md

Add a new field group with URL examples:

```markdown
{% field-group id="url_fields" title="URL Fields" %}

{% url-field id="website" label="Website" role="user" %}{% /url-field %}

{% instructions ref="website" %}
Enter a valid website URL (e.g., https://example.com).
{% /instructions %}

{% url-list id="references" label="References" role="agent" minItems=1 %}{% /url-list %}

{% instructions ref="references" %}
Add relevant reference URLs. At least one is required.
{% /instructions %}

{% /field-group %}
```

#### startup-deep-research.form.md Structure

```markdown
{% form id="startup_research" title="Startup Research Form" %}

{% field-group id="basic_info" title="Basic Information" %}
  - company_name (string, user-provided)
  - company_website (url, required)
  - founded_year (string, pattern YYYY)
  - hq_location (string)
  - one_liner (string, max 200 chars)
  - basic_info_sources (url-list, minItems=1)
{% /field-group %}

{% field-group id="founders" title="Founders" %}
  - founder_names (string-list)
  - founder_linkedin_urls (url-list)
  - founder_backgrounds (string, multiline)
  - founder_sources (url-list)
{% /field-group %}

{% field-group id="funding" title="Funding History" %}
  - total_raised (string, e.g., "$50M")
  - last_round (string, e.g., "Series B - $25M")
  - last_round_date (string, YYYY-MM)
  - key_investors (string-list)
  - funding_sources (url-list, minItems=1, required)
{% /field-group %}

{% field-group id="product" title="Product & Market" %}
  - product_description (string, multiline)
  - target_market (string)
  - competitors (string-list)
  - product_sources (url-list)
{% /field-group %}

{% field-group id="community" title="Community Presence" %}
  - hacker_news_posts (url-list) - HN submission/discussion links
  - product_hunt_launches (url-list)
  - notable_press (url-list)
{% /field-group %}

{% field-group id="assessment" title="Assessment" %}
  - strengths (string-list)
  - risks (string-list)
  - overall_rating (single-select: bullish/neutral/bearish)
  - assessment_notes (string, multiline)
{% /field-group %}

{% /form %}
```

## Beads Reference

This spec is tracked by epic **markform-192** and its sub-tasks:

| Bead | Description |
| --- | --- |
| markform-192 | Epic: Add URL field types with end-to-end support |
| markform-192.1 | Core types: UrlField, UrlListField, UrlValue, UrlListValue |
| markform-192.2 | Parser: url-field and url-list tags |
| markform-192.3 | Serializer: URL field serialization |
| markform-192.4 | Validator: URL format validation |
| markform-192.5 | Patches: SetUrlPatch, SetUrlListPatch |
| markform-192.6 | Apply: Handle URL patches |
| markform-192.7 | Inspect: URL field progress/issues |
| markform-192.8 | Unit tests |
| markform-192.9 | Example: startup-deep-research.form.md |
| markform-192.10 | Golden E2E test |
| markform-192.11 | Update simple.form.md with URL field examples |

### Dependency Graph

```
markform-192.1 (Core types)
    ├── markform-192.2 (Parser)
    ├── markform-192.3 (Serializer)
    ├── markform-192.4 (Validator)
    │       └── markform-192.7 (Inspect)
    └── markform-192.5 (Patches)
            └── markform-192.6 (Apply)

markform-192.2, 192.3, 192.4 ──► markform-192.8 (Unit tests)
                                        ├── markform-192.9 (startup-deep-research example)
                                        └── markform-192.11 (simple.form.md update)

markform-192.6, 192.7, 192.9, 192.11 ──► markform-192.10 (Golden E2E test)
```

## Revision History

| Date | Author | Changes |
| --- | --- | --- |
| 2025-12-24 | Claude | Initial draft |
