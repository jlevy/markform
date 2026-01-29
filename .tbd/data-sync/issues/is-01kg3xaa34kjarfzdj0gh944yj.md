---
close_reason: null
closed_at: 2025-12-24T04:33:21.747Z
created_at: 2025-12-24T02:06:39.151Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:56.283Z
    original_id: markform-149
id: is-01kg3xaa34kjarfzdj0gh944yj
kind: epic
labels: []
parent_id: null
priority: 1
status: closed
title: Implement Role System for Multi-Stage Form Workflows
type: is
updated_at: 2025-12-24T04:33:21.747Z
version: 1
---
## Overview

Implement the role-based field assignment system as specified in:
`docs/project/specs/active/plan-2025-12-23-role-system.md`

## Key Features

1. Form-level `roles` list and `role_instructions` in frontmatter
2. Field-level `role` attribute (default: "agent")
3. `FillMode` type: "continue" | "overwrite"
4. `approvalMode` attribute on checkboxes: "none" | "blocking"
5. CLI `--roles` and `--mode` flags on fill command
6. Blocking checkpoint logic
7. Role validation and normalization

## Implementation Phases

- Phase 1: Core Types and Settings
- Phase 2: Parser Updates  
- Phase 3: Fill Command and Harness Updates
- Phase 4: Serializer Updates
- Phase 5: Tests

## Backward Compatibility

- Forms without `roles` default to ["user", "agent"]
- Fields without `role` default to "agent"
- Existing CLI usage unchanged
