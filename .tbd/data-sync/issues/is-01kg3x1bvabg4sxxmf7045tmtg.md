---
close_reason: null
closed_at: 2026-01-04T01:57:20.542Z
created_at: 2026-01-02T23:36:06.865Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:05.501Z
    original_id: markform-519
id: is-01kg3x1bvabg4sxxmf7045tmtg
kind: bug
labels: []
parent_id: null
priority: 2
status: closed
title: "tryscript: Fix bin config - binPath set but never used"
type: is
updated_at: 2026-01-04T01:57:20.542Z
version: 1
---
The `bin` config is parsed and stored in `binPath` but never used to replace commands.

**Current behavior (in runner.ts):**
```typescript
async function createExecutionContext(config, testFilePath) {
  let binPath = config.bin ?? "";
  if (binPath && !binPath.startsWith("/")) 
    binPath = join(testDir, binPath);
  return { binPath, ... };  // binPath stored but never used!
}

async function executeCommand(command, ctx) {
  const proc = spawn(command, {  // Raw command, binPath not applied!
    shell: true,
    cwd: ctx.tempDir,
    ...
  });
}
```

**Expected behavior:**
When `bin: ./dist/bin.mjs` is set, commands starting with `bin.mjs` should use the resolved path.

**Proposed fix:**
In `executeCommand`, replace the first word of the command with `binPath` if it matches.

Reference: docs/project/specs/active/plan-2026-01-02-tryscript-cli-testing.md
