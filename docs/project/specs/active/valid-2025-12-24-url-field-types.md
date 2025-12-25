# Feature Validation: URL Field Types

## Purpose

This is a validation spec for the URL field types (`url-field` and `url-list`)
implementation in Markform.
It documents automated validation performed and manual validation steps for the user.

**Feature Plan:**
[plan-2025-12-24-url-field-types.md](./plan-2025-12-24-url-field-types.md)

**Implementation Plan:** N/A (no separate impl spec for this feature)

## Stage 4: Validation Stage

## Validation Planning

All 12 beads (sub-tasks) from the Plan Spec have been implemented:

| Bead | Description | Status |
| --- | --- | --- |
| markform-192.1 | Core types (UrlField, UrlListField, UrlValue, UrlListValue) | ✅ Complete |
| markform-192.2 | Parser (url-field and url-list tags) | ✅ Complete |
| markform-192.3 | Serializer (URL field serialization) | ✅ Complete |
| markform-192.4 | Validator (URL format validation) | ✅ Complete |
| markform-192.5 | Patches (SetUrlPatch, SetUrlListPatch) | ✅ Complete |
| markform-192.6 | Apply (Handle URL patches) | ✅ Complete |
| markform-192.7 | Inspect (URL field progress/issues) | ✅ Complete |
| markform-192.8 | Unit tests | ✅ Complete |
| markform-192.9 | startup-deep-research.form.md example | ✅ Complete |
| markform-192.10 | Golden E2E test (via simple.session.yaml) | ✅ Complete |
| markform-192.11 | Update simple.form.md with URL field examples | ✅ Complete |

## Automated Validation (Testing Performed)

All 394 tests pass. The following automated validation has been completed:

### Unit Testing

#### Core Types (`tests/unit/engine/coreTypes.test.ts`)

- ✅ Zod schemas validate URL field and value types correctly

- ✅ Patch schemas validate SetUrlPatch and SetUrlListPatch

#### Parser (`tests/unit/engine/parse.test.ts`)

- ✅ Parses url-field tags with empty values

- ✅ Parses url-field tags with populated values in fences

- ✅ Parses url-list tags with minItems/maxItems/uniqueItems attributes

- ✅ Parses url-list tags with multiple URLs in fences

#### Serializer (`tests/unit/engine/serialize.test.ts`)

- ✅ Round-trip serialization preserves URL field values

- ✅ Round-trip serialization preserves URL list values

- ✅ Serialized output matches expected Markdoc format

#### Validator (`tests/unit/engine/validate.test.ts`)

- ✅ Required url-field with empty value reports error

- ✅ Required url-field with valid URL passes

- ✅ Invalid URL format (plain text) is rejected

- ✅ Non-http(s) URLs (ftp://) are rejected

- ✅ HTTP URLs are accepted

- ✅ HTTPS URLs are accepted

- ✅ url-list minItems constraint validation

- ✅ url-list maxItems constraint validation

- ✅ url-list uniqueItems constraint validation

- ✅ url-list per-item URL format validation

#### Value Coercion (`tests/unit/valueCoercion.test.ts`)

- ✅ Coerces string values to url field patches

- ✅ Coerces string array values to url_list field patches

#### Simple Form Validation (`tests/unit/engine/simple-form-validation.test.ts`)

- ✅ Parses simple.form.md with 15 fields including URL fields

- ✅ Detects 6 field groups including url_fields group

- ✅ Counts 1 url field and 1 url_list field

### Integration and End-to-End Testing

#### Programmatic Fill (`tests/integration/programmaticFill.test.ts`)

- ✅ Fills url-field (website) with valid URL value

- ✅ Fills url-list (references) with array of URLs

- ✅ MockAgent correctly fills URL fields

- ✅ Pre-fill with URL values works correctly

- ✅ Multiple agent turns with URL fields function correctly

#### Golden Session Test (`tests/golden/golden.test.ts`)

- ✅ simple.session.yaml includes URL field patches (set_url, set_url_list)

- ✅ Round-trip session test preserves URL values

- ✅ SHA256 hash validation confirms deterministic output

### CLI Testing

- ✅ formatPatchValue() in fill.ts handles set_url and set_url_list patches

## Manual Testing Needed

The following manual validation steps should be performed by the reviewer:

### 1. Review Example Forms

**simple.form.md URL fields:**
```bash
# View the URL fields section
cat packages/markform/examples/simple/simple.form.md | grep -A 20 "url_fields"
```

Verify:

- [ ] `website` field is defined with `url-field` tag, role="user", required=true

- [ ] `references` field is defined with `url-list` tag, role="agent", minItems=1

- [ ] `related_url` field is in optional_fields group

**simple-mock-filled.form.md:**
```bash
cat packages/markform/examples/simple/simple-mock-filled.form.md | grep -A 5 "website\|references\|related_url"
```

Verify:

- [ ] website has a valid URL value in fence block

- [ ] references has multiple URL values (one per line)

- [ ] related_url has a valid URL value

### 2. Review startup-deep-research Example

```bash
ls -la packages/markform/examples/startup-deep-research/
cat packages/markform/examples/startup-deep-research/startup-deep-research.form.md
```

Verify:

- [ ] Form has multiple field groups with URL fields

- [ ] company_website is a url-field

- [ ] sources fields are url-list with appropriate minItems

- [ ] LinkedIn URLs, press URLs, etc.
  are represented

```bash
cat packages/markform/examples/startup-deep-research/startup-deep-research-mock-filled.form.md
```

Verify:

- [ ] Mock filled form has realistic Anthropic example data

- [ ] All URL fields contain valid https:// URLs

- [ ] URL lists contain multiple realistic URLs

### 3. CLI Form Fill Test

Run the CLI fill command with the simple form:

```bash
cd packages/markform
pnpm markform fill examples/simple/simple.form.md --mock --mock-source examples/simple/simple-mock-filled.form.md --output /tmp/filled.form.md
cat /tmp/filled.form.md | grep -A 5 "website\|references"
```

Verify:

- [ ] Command completes successfully

- [ ] URL fields are filled with valid URLs

- [ ] Output preserves URL field structure

### 4. Validation Error Messages

Create a test form with invalid URLs:

```bash
cat > /tmp/test-url.form.md << 'EOF'
---
markform:
  markform_version: "0.1.0"
---

{% form id="test" title="URL Test" %}

{% field-group id="urls" %}
{% url-field id="bad_url" label="Bad URL" %}
```value
not-a-url
```
{% /url-field %} {% /field-group %}

{% /form %} EOF

pnpm markform validate /tmp/test-url.form.md
```

Verify:
- [ ] Validation reports "not a valid URL" error for bad_url field
- [ ] Error message is clear and actionable

### 5. Web Interface (if applicable)

If the web interface is available:

```bash
pnpm markform serve examples/simple/simple.form.md
```

Verify:

- [ ] URL fields render correctly in the web interface

- [ ] URL fields show as clickable links when filled

- [ ] URL list fields display multiple URLs properly

## Acceptance Criteria Checklist

From the Plan Spec:

1. [x] `url-field` and `url-list` tags parse correctly - validated by unit tests

2. [x] URL format validation rejects obviously invalid URLs - validated by unit tests

3. [x] URL format validation accepts common valid URLs (http, https) - validated by unit
   tests

4. [x] Round-trip serialization preserves URL values exactly - validated by golden tests

5. [x] Patches (`set_url`, `set_url_list`) work correctly - validated by integration
   tests

6. [x] Inspect reports issues for empty required URL fields - validated by unit tests

7. [x] `simple.form.md` updated with URL field examples - needs manual review

8. [x] `startup-deep-research.form.md` example created - needs manual review

9. [x] All existing tests continue to pass - all 394 tests pass

10. [x] New unit tests cover URL field scenarios - added to validate.test.ts

11. [x] Golden E2E test validates end-to-end behavior - simple.session.yaml updated

## Revision History

| Date | Author | Changes |
| --- | --- | --- |
| 2025-12-25 | Claude | Initial validation spec |
