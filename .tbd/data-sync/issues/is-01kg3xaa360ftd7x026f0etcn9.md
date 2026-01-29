---
close_reason: null
closed_at: 2025-12-26T08:27:07.251Z
created_at: 2025-12-25T21:36:38.100Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:56.852Z
    original_id: markform-203
id: is-01kg3xaa360ftd7x026f0etcn9
kind: epic
labels: []
parent_id: null
priority: 1
status: closed
title: "Unified Response Model: Skip/Abort Sentinels and Notes"
type: is
updated_at: 2025-12-26T08:27:07.251Z
version: 1
---
Implement unified response model with ResponseState/FieldResponse wrapper and notes as first-class concepts.

Key design: Response state (empty/answered/skipped/aborted) is orthogonal to field type. FieldValue.kind remains strictly for field types. Each field has a FieldResponse with state and optional value.

Replaces valuesByFieldId + skipsByFieldId with unified responsesByFieldId. Adds notes as general-purpose mechanism for attaching text to form elements.

Specs:
- Plan: docs/project/specs/active/plan-2025-12-25-unified-response-model-with-notes.md
- Implementation: docs/project/specs/active/impl-2025-12-25-unified-response-model-with-notes.md

8 implementation phases: Core Types, Parsing, Serialization, Apply Logic, Progress & Completion, Testing, CLI Updates, Architecture Documentation.
