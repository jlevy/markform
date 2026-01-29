---
close_reason: null
closed_at: 2025-12-27T01:04:49.137Z
created_at: 2025-12-26T18:00:00.000Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:59.410Z
    original_id: markform-mf01
id: is-01kg3xaa3f8vxrdzz1pnzfzd79
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Introduce MF/0.1 spec version notation
type: is
updated_at: 2025-12-27T01:04:49.137Z
version: 1
---
## Summary
Introduce explicit spec version notation (`MF/0.1`) distinct from npm package version to clearly track format/schema versions.

## Rationale
- Package versions (v0.1.1, v0.1.2) track library releases
- Spec versions track the format that `.form.md` files conform to
- Clear separation prevents confusion about compatibility
- Follows precedent from HTTP/1.1, YAML 1.2, etc.

## Changes Required

### 1. settings.ts — Add Spec Version Constant
Add at top of `packages/markform/src/settings.ts`:
```typescript
// Spec Version
export const MF_SPEC_VERSION = "MF/0.1";
export const MF_SPEC_VERSION_NUMBER = "0.1";
```

### 2. Architecture Doc — Update Spec References
Update `docs/project/architecture/current/arch-markform-design.md.md`:
- Line 3: `Version: v0.1` → `Version: MF/0.1`
- `## v0.1 Scope` → `## MF/0.1 Scope`
- `Deferred to v0.2` → `Deferred to MF/0.2`
- All `(v0.1)` scope notes → `(MF/0.1)`
- `### v0.2 Targets` → `### MF/0.2 Targets`

### 3. Frontmatter Schema — Consider Field Rename
Consider updating frontmatter from:
```yaml
markform:
  markform_version: "0.1.0"
```
To:
```yaml
markform:
  spec: "MF/0.1"
```

### 4. Code Updates (if frontmatter changes)
- `packages/markform/src/engine/parse.ts` — field name
- `packages/markform/src/engine/serialize.ts` — writes frontmatter
- Example `.form.md` files in `packages/markform/examples/`
- Tests validating frontmatter

## Priority
P2 — important for clarity before wider adoption.
