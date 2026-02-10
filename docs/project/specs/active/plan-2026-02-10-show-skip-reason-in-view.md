---
title: Show Skip Reason in Serve View
description: Display skip reasons in the View and Edit tabs of the serve UI
author: Claude (AI assistant)
---
# Feature: Show Skip Reason in Serve View

**Date:** 2026-02-10

**Author:** Claude

**Status:** Implemented

## Overview

When an agent skips a form field, it often provides a reason (e.g., "Not applicable to
this company type"). This reason is correctly parsed, stored in `FieldResponse.reason`, and
serialized back to markdown as `%SKIP% (reason text)`. However, the View and Edit tabs in
the serve UI only show "Skipped" or "(skipped)" without displaying the reason. This spec
addresses showing the skip reason in both tabs.

## Goals

- Show the skip reason in the View tab's field value area, e.g., "(skipped: Not applicable)"
- Show the skip reason in the Edit tab's skipped badge or field area
- Follow the existing pattern used by table cell rendering, which already correctly
  displays skip reasons as `[skipped: reason text]`
- Maintain TDD: write failing tests first, then implement

## Non-Goals

- Changing how skip reasons are parsed or stored (already working correctly)
- Changing the markdown serialization format
- ~~Modifying the Report tab~~ (added: report tab also fixed)
- Adding UI for users to enter skip reasons (separate feature)

## Background

The data flow for skip reasons:

1. **Parsing** (`parseSentinels.ts:70-84`): Correctly extracts reason from
   `%SKIP% (reason text)` syntax
2. **Storage** (`coreTypes.ts:43-47`): `FieldResponse.reason` field holds the reason string
3. **Serialization** (`serialize.ts:336-340`): Correctly writes `%SKIP% (reason text)` back
4. **Table cells** (`serve.ts:1677-1678`): Already shows `[skipped: reason]` — the correct
   pattern

The bug is in the rendering layer only:
- `renderGroup` (`serve.ts:1296`): Extracts `isSkipped` boolean, discards `response.reason`
- `renderFieldHtml` (`serve.ts:1312-1320`): Only accepts `isSkipped?: boolean`, shows
  hardcoded "Skipped" badge
- `renderViewContent` (`serve.ts:2005-2014`): Extracts `isSkipped` boolean, shows hardcoded
  "Skipped" badge
- `renderViewFieldValue` (`serve.ts:2064-2065`): Shows hardcoded `(skipped)` text

## Design

### Approach

Pass the skip reason string through the rendering pipeline instead of just a boolean.
Change `isSkipped?: boolean` parameters to `skipReason?: string` (where presence indicates
skipped state, and the value is the optional reason text).

### Components

Single file change: `packages/markform/src/cli/commands/serve.ts`

**Edit tab (renderFieldHtml):**
- Change signature: `isSkipped?: boolean` → `skipReason?: string | boolean`
  (boolean for backward compat, string carries the reason)
- Update badge rendering to include reason when available

**View tab (renderViewContent + renderViewFieldValue):**
- Pass `response?.reason` alongside the skipped state
- Update `renderViewFieldValue` to show `(skipped: reason)` when reason is present
- Update the "Skipped" badge to include reason text

### API Changes

`renderFieldHtml` (exported for testing): The `isSkipped` parameter changes to accept
`string | boolean | undefined` where a string value is the skip reason.

## Implementation Plan

### Phase 1: Show Skip Reason in View and Edit Tabs

- [ ] Write failing unit tests for skip reason display in `renderViewContent`
- [ ] Write failing unit tests for skip reason display in `renderFieldHtml` (Edit tab)
- [ ] Update `renderViewContent` to pass reason to badge and value renderer
- [ ] Update `renderViewFieldValue` to show `(skipped: reason)` when reason exists
- [ ] Update `renderGroup` to pass reason to `renderFieldHtml`
- [ ] Update `renderFieldHtml` to accept and display skip reason
- [ ] Verify all tests pass
- [ ] Run full quality gates (lint, typecheck, build, test)

## Testing Strategy

**Unit tests** in `tests/unit/web/serve-render.test.ts`:

1. **View tab with skip reason**: Parse a form, set `responsesByFieldId` with
   `{ state: 'skipped', reason: 'Not applicable' }`, verify `renderViewContent` output
   contains `(skipped: Not applicable)`
2. **View tab without skip reason**: Existing test - verify `(skipped)` still renders for
   skips with no reason
3. **View tab skip badge with reason**: Verify the "Skipped" badge or nearby text includes
   the reason
4. **Edit tab with skip reason**: Set `responsesByFieldId` with a reason, verify
   `renderFormHtml` output contains the reason text
5. **Edit tab without skip reason**: Existing test - verify basic "Skipped" still works

All tests follow the existing pattern of parsing form content, mutating
`responsesByFieldId`, and asserting on HTML output.

## Rollout Plan

Standard merge to main after CI passes.

## Open Questions

None — the fix is straightforward and follows established patterns.

## References

- Table cell rendering with reasons: `serve.ts:1677-1680`
- Sentinel parsing: `parseSentinels.ts:70-84`
- FieldResponse type: `coreTypes.ts:43-47`
- Existing skip tests: `serve-render.test.ts:857-931`, `serve-render.test.ts:1236-1243`
