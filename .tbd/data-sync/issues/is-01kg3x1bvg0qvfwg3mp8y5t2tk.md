---
close_reason: null
closed_at: 2025-12-23T19:43:33.314Z
created_at: 2025-12-23T19:37:46.726Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:05.962Z
    original_id: markform-86
id: is-01kg3x1bvg0qvfwg3mp8y5t2tk
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Ensure inspect output structure is consistent across all formats
type: is
updated_at: 2025-12-23T19:43:33.314Z
version: 1
---
The inspect command's console/plaintext output should systematically mirror the YAML output structure.

**Current gap:**
- Progress tallies don't include 'invalid' count (YAML has it, console doesn't)
- Need to audit all sections for structural parity

**Example of inconsistency:**
Console shows:
```
Progress:
  Total fields: 12
  Required: 9
  Complete: 0
  Incomplete: 0
  Empty (required): 9
```

But YAML likely includes an 'invalid' count that's missing from console.

**Task:**
1. Compare YAML output structure with console output
2. Ensure all fields present in YAML are also in console/plaintext
3. Keep same logical groupings and ordering
4. Only difference should be syntax (YAML vs human-readable formatting)
