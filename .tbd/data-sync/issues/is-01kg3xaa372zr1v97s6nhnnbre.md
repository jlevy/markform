---
close_reason: null
closed_at: 2025-12-27T01:13:08.958Z
created_at: 2025-12-27T00:17:22.781Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:57.292Z
    original_id: markform-260
id: is-01kg3xaa372zr1v97s6nhnnbre
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Include scripts/ in TypeScript type checking
type: is
updated_at: 2025-12-27T01:13:08.958Z
version: 1
---
Currently `packages/markform/tsconfig.json` explicitly excludes `scripts/` directory. This means scripts like `regen-golden-sessions.ts` are not type-checked during `pnpm typecheck`.

**Why excluded:** `test-live-agent.ts` has type errors from outdated AI SDK usage:
- Uses `maxSteps` instead of `stopWhen: stepCountIs(n)`
- `MarkformToolSet` doesn't satisfy `ToolSet` index signature
- Missing `answeredFieldCount`/`skippedFieldCount` in session turn recording
- Missing `expectedCompletedForm` in session final

**To fix:**
1. Update `test-live-agent.ts` to use current AI SDK API (`stopWhen: stepCountIs()`)
2. Fix `MarkformToolSet` type to include index signature
3. Update session recording to include all required fields
4. Remove `exclude: ["scripts"]` from tsconfig.json
5. Verify `pnpm typecheck` passes
