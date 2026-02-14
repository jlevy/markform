---
close_reason: "Review complete: current append/delete API is clean and well-designed. --append takes value (always at end), --delete takes 0-based index. No symmetry issues — these are fundamentally different operations (like list.append vs list.pop). --at/--offset for insert-at-position is low value for agent use cases (agents almost always append at end). Tabled as future enhancement if demand arises. next command correctly uses full-set for empty fields and --append for tables."
closed_at: 2026-02-14T19:49:59.413Z
created_at: 2026-02-14T18:52:52.448Z
dependencies: []
id: is-01kheqz9b0c6e3va77hkzhcqjm
kind: task
labels: []
priority: 3
status: closed
title: "Review append/delete CLI API design: consider --offset for position control and symmetry"
type: is
updated_at: 2026-02-14T20:17:37.976Z
version: 3
---
