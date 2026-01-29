---
close_reason: Added per-call limit check with turnsThisCall tracking and batch_limit return
closed_at: 2026-01-03T00:01:41.863Z
created_at: 2026-01-02T23:42:56.465Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:58.762Z
    original_id: markform-540
id: is-01kg3xaa3ct6yz43nchw6tbrz8
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Implement per-call turn limit in programmaticFill.ts
type: is
updated_at: 2026-01-03T00:01:41.863Z
version: 1
---
Add per-call limit check at start of main loop. Track turnsThisCall separately from turnCount. Return batch_limit status when limit reached. Adjust callback turn numbers using startingTurnNumber. File: packages/markform/src/harness/programmaticFill.ts
