---
close_reason: null
closed_at: 2025-12-29T23:37:08.278Z
created_at: 2025-12-29T23:23:28.434Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:05.160Z
    original_id: markform-458
id: is-01kg3x1bv96pm6fpwdkcnygmep
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: Add VERSION define to tsdown.config.ts
type: is
updated_at: 2025-12-29T23:37:08.278Z
version: 1
---
Update `packages/markform/tsdown.config.ts`:
```typescript
import pkg from './package.json';

export default defineConfig({
  // ... existing config
  define: {
    '__MARKFORM_VERSION__': JSON.stringify(pkg.version),
  },
});
```

This injects VERSION at build time instead of reading package.json at runtime.

**Ref:** markform-453
