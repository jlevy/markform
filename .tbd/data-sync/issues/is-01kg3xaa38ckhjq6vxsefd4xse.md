---
close_reason: null
closed_at: 2025-12-27T23:48:22.131Z
created_at: 2025-12-27T23:26:01.371Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:57.451Z
    original_id: markform-270
id: is-01kg3xaa38ckhjq6vxsefd4xse
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Update SPEC.md and arch docs with smart fence selection
type: is
updated_at: 2025-12-27T23:48:22.131Z
version: 1
---
After implementation is verified working, update documentation to reflect smart fence selection behavior:

SPEC.md changes (Layer 1: Syntax):
1. Add new section 'Value fence selection' before 'The process=false Attribute' (line ~684) documenting:
   - Smart fence char selection algorithm (backticks vs tildes)
   - Fence length determination: max(3, maxRun + 1) where maxRun is max run of fence chars at line start (indent ≤ 3)
   - Tie-breaker rule: prefer backticks

2. Update 'Canonical formatting rules' table (line ~886) to add:
   - 'Value fence char' | Backticks preferred; use tildes when backticks would require longer fence
   - 'Value fence length' | Minimum 3; increase to maxRun+1 when content contains fence chars at line start

3. Add examples showing fence selection in action (after line ~728):
   - Content with inner triple backticks → outer uses 4 backticks
   - Content with many tildes → use backticks (shorter)
   - Content with Markdoc tags + code blocks → process=false + smart fence

arch-markform-design.md changes:
1. Under '### 3) Canonical serialization' (line ~963), add detail about smart fence selection preventing value fence collision

2. Add note in 'Design Decisions' section about the algorithm choice (simple content scan, no escaping)
