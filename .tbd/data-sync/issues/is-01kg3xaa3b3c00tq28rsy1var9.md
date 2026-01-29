---
close_reason: null
closed_at: 2025-12-29T03:29:41.138Z
created_at: 2025-12-29T02:38:44.076Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:58.219Z
    original_id: markform-430
id: is-01kg3xaa3b3c00tq28rsy1var9
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: "Final validation: unified field tag migration"
type: is
updated_at: 2025-12-29T03:29:41.138Z
version: 1
---
Run final validation checks per spec.

**Checklist:**
- [ ] `pnpm precommit` passes
- [ ] Golden tests regenerated and pass
- [ ] Manual: `pnpm markform inspect` on converted form
- [ ] Legacy tag produces clear ParseError
- [ ] Documentation consistent across all files
- [ ] No old tag names in active source/tests/examples/docs

**Verification commands:**
```bash
# No old tags in source
grep -rn 'string-field\|number-field\|...' packages/markform/src tests examples docs

# No old tags in form files
find . -name '*.form.md' -exec grep -l 'string-field\|...' {} \;

# Test legacy rejection
echo '{% form id="test" %}{% field-group id="g" %}{% string-field id="f" label="L" %}{% /string-field %}{% /field-group %}{% /form %}' | pnpm markform inspect -
```
