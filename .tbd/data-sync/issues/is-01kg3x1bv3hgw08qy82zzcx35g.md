---
close_reason: null
closed_at: 2025-12-25T09:30:05.906Z
created_at: 2025-12-25T09:26:35.520Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:03.664Z
    original_id: markform-202.22
id: is-01kg3x1bv3hgw08qy82zzcx35g
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Update Agent interface to return AgentResponse with stats
type: is
updated_at: 2025-12-25T09:30:05.906Z
version: 1
---
Change Agent.generatePatches() return type from Promise<Patch[]> to Promise<AgentResponse> where AgentResponse = { patches: Patch[], stats?: TurnStats }.
