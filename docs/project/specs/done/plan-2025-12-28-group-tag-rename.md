# Plan Spec: Rename field-group Tag to group

## Purpose

Simplify the Markform syntax by renaming the `{% field-group %}` tag to just `{% group %}`.
This is a cleaner, shorter name that is still clear in context.

**Current syntax:**

```markdown
{% field-group id="basic_info" title="Basic Information" %}
{% field kind="string" id="name" label="Name" %}{% /field %}
{% /field-group %}
```

**Proposed syntax:**

```markdown
{% group id="basic_info" title="Basic Information" %}
{% field kind="string" id="name" label="Name" %}{% /field %}
{% /group %}
```

## Background

Markform forms are structured with fields organized into groups. Currently, groups use the
`field-group` tag, which is verbose. Since the context is always clear (groups contain
fields), the shorter `group` tag is preferred.

This is a simple tag rename, similar in structure to the unified field tag migration
(see `plan-2025-12-28-unified-field-tag.md`), but much smaller in scope since there's
only one tag to change.

**Related docs:**

- `plan-2025-12-28-unified-field-tag.md` - Similar migration pattern (many tags → unified)
- `docs/markform-spec.md` - Full specification with `field-group` examples
- `docs/markform-reference.md` - User-facing quick reference

## Summary of Task

Rename the `{% field-group %}` tag to `{% group %}` everywhere:

1. **Serializer changes**: Output `{% group %}` instead of `{% field-group %}`
2. **Parser changes**: Accept `group`, reject legacy `field-group` with clear error
3. **Form file migration**: Convert all `.form.md` files to new syntax
4. **Documentation updates**: Update spec, reference docs, README
5. **Test updates**: Update inline form markdown in tests

## Backward Compatibility

**BACKWARD COMPATIBILITY REQUIREMENTS:**

- **Code types, methods, and function signatures**: DO NOT MAINTAIN
  - Internal `FieldGroup` TypeScript type name stays unchanged (describes what it is)
  - Only the Markdoc tag name changes

- **Library APIs**: N/A - ParsedForm structure unchanged

- **Server APIs**: N/A

- **File formats**: DO NOT MAINTAIN - hard cut to new syntax only (pre-1.0)

- **Database schemas**: N/A

## Stage 1: Planning Stage

### Scope

**In scope:**

- Rename Markdoc tag from `field-group` to `group`
- Update serializer to output `{% group %}`
- Update parser to accept `group` and reject `field-group`
- Update all `.form.md` files
- Update all documentation

**Not in scope:**

- Changing the `FieldGroup` TypeScript interface name (it describes the concept)
- Changing any internal variable names or types

### Acceptance Criteria

1. All `.form.md` files use `{% group %}` syntax
2. Parser accepts new syntax and produces identical `ParsedForm` structures
3. Parser rejects legacy `field-group` tag with clear `ParseError` message
4. Serializer outputs new syntax
5. All tests pass
6. Documentation is complete and consistent

### Decisions

1. **No backward compatibility**: Hard cut to new syntax only. Pre-1.0, we can break freely.

2. **TypeScript type name unchanged**: `FieldGroup` interface keeps its name.
   The type name describes what the object represents; the tag name is just syntax.

3. **Legacy tag produces parse error**: The parser will produce explicit `ParseError` when
   `field-group` is encountered, with a clear migration hint.

### Error Semantics

| Condition | Error Message |
| --- | --- |
| `{% field-group %}` (legacy tag) | `Legacy tag 'field-group' is no longer supported. Use {% group %} instead` |

## Stage 2: Architecture Stage

### Files to Modify

**Engine (parsing/serializing):**

- `packages/markform/src/engine/parse.ts` - Change tag check from `field-group` to `group`
- `packages/markform/src/engine/serialize.ts` - Change output tag to `group`

**Documentation:**

- `docs/markform-spec.md` - Update field-group tag examples and references
- `docs/markform-reference.md` - Update field-group references
- `README.md` - Update any field-group examples
- `packages/markform/README.md` - Update any field-group examples
- `docs/project/architecture/current/markform-spec.md` - Update examples
- `docs/project/architecture/current/arch-markform-design.md` - Update examples

**Examples and fixtures:**

- All `packages/markform/examples/**/*.form.md` files
- All `forms/**/*.form.md` files
- All root-level `*.form.md` files

**Tests:**

- Update any tests that check for specific tag names in output or contain inline forms

### Serializer Changes

**Current output:**

```markdown
{% field-group id="info" title="Information" %}
...
{% /field-group %}
```

**New output:**

```markdown
{% group id="info" title="Information" %}
...
{% /group %}
```

## Stage 3: Refine Architecture

### Minimal Code Changes

The change is primarily in two places:

1. **Parser** (~5 lines): Change `isTagNode(child, 'field-group')` to `isTagNode(child, 'group')`
   and add legacy tag error handling

2. **Serializer** (~5 lines): Change `{% field-group %}` to `{% group %}` and
   `{% /field-group %}` to `{% /group %}`

Total estimated: ~20 lines of code changes, plus many find/replace in docs and forms.

## Stage 4: Implementation

### Phase 1: Serializer Update

- [ ] Update `serializeFieldGroup()` in `serialize.ts`:
  - Change opening tag from `{% field-group` to `{% group`
  - Change closing tag from `{% /field-group %}` to `{% /group %}`

### Phase 2: Form File Migration

Convert all `.form.md` files to the new syntax.

**Migration approach:** Run serializer on each file (parse → serialize) to auto-convert,
or use find/replace:

```
{% field-group  →  {% group
{% /field-group %}  →  {% /group %}
```

**Files to migrate:**

- [ ] All files in `packages/markform/examples/`
- [ ] All files in `forms/`
- [ ] Any root-level `.form.md` files
- [ ] Any session YAML files that embed form content

### Phase 3: Unit Test Migration

Update all unit tests that contain inline form markdown with old tag syntax.

**Find/replace in test files:**

```
{% field-group  →  {% group
{% /field-group %}  →  {% /group %}
```

### Phase 4: Parser Update

- [ ] Modify parser in `parse.ts`:
  - Change `isTagNode(child, 'field-group')` to `isTagNode(child, 'group')`
  - Update error message from "field-group missing required 'id'" to "group missing required 'id'"

- [ ] Add explicit `ParseError` for legacy tag:
  - Check if `isTagNode(child, 'field-group')` and throw:
    `Legacy tag 'field-group' is no longer supported. Use {% group %} instead`

### Phase 5: Documentation

- [ ] Update `docs/markform-spec.md` - all field-group references
- [ ] Update `docs/markform-reference.md` - all field-group references
- [ ] Update `README.md` examples if any
- [ ] Update `packages/markform/README.md` examples if any
- [ ] Update `docs/project/architecture/current/markform-spec.md`
- [ ] Update `docs/project/architecture/current/arch-markform-design.md`

### Phase 6: Final Validation

- [ ] Run full test suite: `pnpm precommit`
- [ ] Verify no old tag names in source:
  ```bash
  grep -rn 'field-group' packages/markform/src packages/markform/tests packages/markform/examples docs/project/architecture/current
  ```
- [ ] Verify no old tag names in form files:
  ```bash
  find . -name '*.form.md' -exec grep -l 'field-group' {} \;
  ```
- [ ] Exceptions allowed: CHANGELOG.md, docs/project/specs/done/*, comments explaining migration

## Stage 5: Validation

### Final Checklist

- [ ] `pnpm precommit` passes
- [ ] Manual test: `pnpm markform inspect` on a converted form
- [ ] Legacy tag produces clear `ParseError`
- [ ] Documentation consistent across all docs
- [ ] No old tag names in active source/tests/examples/docs

### Verification Commands

```bash
# Verify no old tag names remain
grep -rn 'field-group' \
  packages/markform/src \
  packages/markform/tests \
  packages/markform/examples \
  docs/project/architecture/current \
  docs/markform-spec.md \
  docs/markform-reference.md

# Verify no old tags in form files
find . -name '*.form.md' -exec grep -l 'field-group' {} \;

# Test that legacy tag produces parse error (after implementation)
echo '{% form id="test" %}{% field-group id="g" %}{% field kind="string" id="f" label="L" %}{% /field %}{% /field-group %}{% /form %}' | pnpm markform inspect -
# Should produce: ParseError: Legacy tag 'field-group' is no longer supported...

# Full quality gate
pnpm precommit
```
