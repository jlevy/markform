# Plan Spec: Refactor Parser Sentinel Handling

## Purpose

Refactor `packages/markform/src/engine/parse.ts` to extract duplicated sentinel value
handling logic into a reusable helper function.
Currently, each fence-based field parser (string, number, string-list, url, url-list,
date, year) contains nearly identical 35-line blocks for checking and handling `%SKIP%`
and `%ABORT%` sentinels.

## Background

**Current Problem:**

The sentinel handling code is duplicated across 7 field parsing functions:

| Function | Lines (approx) |
| --- | --- |
| `parseStringField` | 545-580 |
| `parseNumberField` | 621-655 |
| `parseStringListField` | 707-741 |
| `parseUrlField` | 1008-1042 |
| `parseUrlListField` | 1084-1118 |
| `parseDateField` | 1169-1203 |
| `parseYearField` | 1251-1285 |

Each contains this pattern:

```typescript
const fenceContent = extractFenceValue(node);
const stateAttr = getStringAttr(node, 'state');

const sentinel = parseSentinel(fenceContent);
if (sentinel) {
  if (sentinel.type === 'skip') {
    if (stateAttr !== undefined && stateAttr !== 'skipped') {
      throw new ParseError(`Field '${id}' has conflicting state...`);
    }
    if (required) {
      throw new ParseError(`Field '${id}' is required but has %SKIP%...`);
    }
    return {
      field,
      response: { state: 'skipped', ...(sentinel.reason && { reason: sentinel.reason }) },
    };
  }
  if (sentinel.type === 'abort') {
    // Similar 15 lines for abort
  }
}
```

**Why This Matters:**

1. **DRY Violation** - ~245 lines of duplicated logic (35 lines × 7 functions)

2. **Maintenance Risk** - Any change to sentinel handling must be made in 7 places

3. **Bug Risk** - Easy to introduce inconsistencies when adding new field types

4. **Readability** - Field parsers are cluttered with boilerplate

## Summary of Task

Extract sentinel handling into a helper function that field parsers call before parsing
their type-specific values.
This is a pure refactoring - no behavior changes.

### Proposed API

```typescript
/**
 * Check for sentinel values in fence content and validate against state attribute.
 * Returns a FieldResponse if a sentinel is found, null otherwise.
 */
function tryParseSentinelResponse(
  node: Node,
  fieldId: string,
  required: boolean,
): FieldResponse | null {
  const fenceContent = extractFenceValue(node);
  const stateAttr = getStringAttr(node, 'state');

  const sentinel = parseSentinel(fenceContent);
  if (!sentinel) {
    return null;
  }

  if (sentinel.type === 'skip') {
    if (stateAttr !== undefined && stateAttr !== 'skipped') {
      throw new ParseError(
        `Field '${fieldId}' has conflicting state='${stateAttr}' with %SKIP% sentinel`,
      );
    }
    if (required) {
      throw new ParseError(
        `Field '${fieldId}' is required but has %SKIP% sentinel. Cannot skip required fields.`,
      );
    }
    return { state: 'skipped', ...(sentinel.reason && { reason: sentinel.reason }) };
  }

  if (sentinel.type === 'abort') {
    if (stateAttr !== undefined && stateAttr !== 'aborted') {
      throw new ParseError(
        `Field '${fieldId}' has conflicting state='${stateAttr}' with %ABORT% sentinel`,
      );
    }
    return { state: 'aborted', ...(sentinel.reason && { reason: sentinel.reason }) };
  }

  return null;
}
```

### Updated Field Parser Pattern

After refactoring, each field parser becomes simpler:

```typescript
function parseDateField(node: Node): { field: DateField; response: FieldResponse } {
  const id = getStringAttr(node, 'id');
  const label = getStringAttr(node, 'label');
  // ... validation ...

  const required = getBooleanAttr(node, 'required') ?? false;

  const field: DateField = { kind: 'date', id, label, required, /* ... */ };

  // Check for sentinels first - single line!
  const sentinelResponse = tryParseSentinelResponse(node, id, required);
  if (sentinelResponse) {
    return { field, response: sentinelResponse };
  }

  // Parse type-specific value
  const fenceContent = extractFenceValue(node);
  // ... rest of value parsing ...
}
```

## Backward Compatibility

**BACKWARD COMPATIBILITY REQUIREMENTS:**

- **Code types, methods, and function signatures**: DO NOT MAINTAIN — This is internal
  refactoring; no public API changes

- **Library APIs**: DO NOT MAINTAIN — No changes to exported functions

- **Server APIs**: N/A — No server APIs affected

- **File formats**: DO NOT MAINTAIN — No changes to file format handling

- **Database schemas**: N/A — No database

## Acceptance Criteria

1. All existing tests pass without modification

2. `tryParseSentinelResponse()` helper function exists and is used by all fence-based
   field parsers

3. Sentinel handling logic exists in exactly one place (the helper function)

4. Each affected field parser is ~30 lines shorter

5. Tests for date-field and year-field sentinel handling are added (these were missing)

## Testing Plan

### Pre-Refactor: Add Missing Tests

Before refactoring, add tests for date and year field sentinels to ensure full coverage:

- [ ] Test `%SKIP%` in date-field

- [ ] Test `%ABORT%` in date-field

- [ ] Test `%SKIP%` in year-field

- [ ] Test `%ABORT%` in year-field

- [ ] Test conflicting state attribute with sentinel for date/year

### Post-Refactor: Verify Coverage

After refactoring:

- [ ] All 46 existing parse tests pass

- [ ] New date/year sentinel tests pass

- [ ] No behavior changes detected

## Implementation Checklist

### Phase 1: Add Missing Test Coverage

- [ ] Add sentinel tests for date-field

- [ ] Add sentinel tests for year-field

- [ ] Run tests to confirm current implementation passes

### Phase 2: Extract Helper Function

- [ ] Create `tryParseSentinelResponse()` helper

- [ ] Add unit test for the helper function directly (optional but recommended)

### Phase 3: Refactor Field Parsers

- [ ] Update `parseStringField()` to use helper

- [ ] Update `parseNumberField()` to use helper

- [ ] Update `parseStringListField()` to use helper

- [ ] Update `parseUrlField()` to use helper

- [ ] Update `parseUrlListField()` to use helper

- [ ] Update `parseDateField()` to use helper

- [ ] Update `parseYearField()` to use helper

### Phase 4: Cleanup and Verification

- [ ] Run full test suite

- [ ] Verify line count reduction (~245 lines removed)

- [ ] Code review for consistency

## Beads Reference

This spec is tracked by epic **markform-262** and its sub-tasks:

| Bead | Description |
| --- | --- |
| markform-262 | Epic: Refactor parser sentinel handling |
| markform-262.1 | Add sentinel tests for date-field and year-field |
| markform-262.2 | Create tryParseSentinelResponse helper function |
| markform-262.3 | Refactor all field parsers to use helper |

### Dependency Graph

```
markform-262.1 (Add tests) → markform-262.2 (Create helper) → markform-262.3 (Refactor parsers)
```

## Revision History

| Date | Author | Changes |
| --- | --- | --- |
| 2025-12-27 | Claude | Initial draft |
