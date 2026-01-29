---
close_reason: null
closed_at: 2025-12-23T21:21:29.766Z
created_at: 2025-12-23T21:03:08.122Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:02.894Z
    original_id: markform-101
id: is-01kg3x1bv0ncsemegndvrr8qr6
kind: feature
labels: []
parent_id: null
priority: 1
status: closed
title: Implement fill command with live agent support
type: is
updated_at: 2025-12-23T21:21:29.766Z
version: 1
---
Refactor the 'run' command into a general 'fill' command supporting both mock and live agent modes.

**Key Changes:**
- Rename `run` → `fill` (no backward compatibility needed for v0.1)
- Add `--agent` flag: `mock` | `live` (default: live)
- Add `--model` flag: `provider/model-name` format (e.g., `anthropic/claude-sonnet-4-5`)
- Implement live agent using Vercel AI SDK
- Update architecture doc to reflect changes

**Plan:** docs/project/specs/active/plan-2025-12-23-fill-command-live-agent.md

**Implementation Phases:**
1. Refactor command structure (rename run → fill, add flags)
2. Implement live agent with AI SDK integration  
3. Update documentation (architecture, development, README)
