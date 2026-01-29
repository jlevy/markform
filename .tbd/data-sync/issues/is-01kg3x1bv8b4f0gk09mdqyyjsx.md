---
close_reason: null
closed_at: 2025-12-29T03:29:41.138Z
created_at: 2025-12-29T02:38:41.194Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:05.031Z
    original_id: markform-427
id: is-01kg3x1bv8b4f0gk09mdqyyjsx
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: Migrate unit tests to unified field syntax
type: is
updated_at: 2025-12-29T03:29:41.138Z
version: 1
---
Update all unit tests with inline form markdown to use new syntax.

**17 test files to update:**
- tests/unit/engine/parse.test.ts
- tests/unit/engine/serialize.test.ts
- tests/unit/engine/serialize-fence.test.ts
- tests/unit/engine/validate.test.ts
- tests/unit/engine/apply.test.ts
- tests/unit/engine/inspect.test.ts
- tests/unit/engine/summaries.test.ts
- tests/unit/engine/simple-form-validation.test.ts
- tests/unit/engine/coreTypes.test.ts
- tests/unit/engine/fieldRegistry.test.ts
- tests/unit/harness/harness.test.ts
- tests/unit/harness/programmaticFill.test.ts
- tests/unit/valueCoercion.test.ts
- tests/unit/integrations/ai-sdk.test.ts
- tests/unit/web/serve-render.test.ts
- tests/unit/cli/interactivePrompts.test.ts

**Find/replace patterns:**
- `{% string-field` → `{% field kind="string"`
- `{% /string-field %}` → `{% /field %}`
- (repeat for all 11 field types)
