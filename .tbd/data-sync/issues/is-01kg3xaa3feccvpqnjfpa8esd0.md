---
close_reason: null
closed_at: 2025-12-23T09:39:19.408Z
created_at: 2025-12-23T08:29:50.583Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:59.414Z
    original_id: markform-mls
id: is-01kg3xaa3feccvpqnjfpa8esd0
kind: epic
labels: []
parent_id: null
priority: 1
status: closed
title: Fix Architecture & Plan Doc Issues (2025-12-23 Review)
type: is
updated_at: 2025-12-23T09:39:19.408Z
version: 1
---
Address all spec/fixture mismatches and ambiguities identified in the comprehensive documentation review before implementation begins.

## Scope
- 10 architecture issues (ARCH-001 through ARCH-013)
- 7 implementation plan issues (PLAN-001 through PLAN-007)  
- 6 sample form issues (FORM-SIMPLE-001, FORM-COMPANY-001 through 005)

## Critical Items (must fix before implementation)
1. Fix Markdoc comment syntax + decide preservation policy (ARCH-007)
2. Fix option indexing so option refs are resolvable (ARCH-001)
3. Fix doc placement rules to match fixtures (ARCH-005)
4. Fix clear_field semantics for select/checkbox (ARCH-006)
5. Align plan with architecture on process=false emission (PLAN-003)
6. Clarify requiredness vs minItems/minSelections (ARCH-013)

## Review Source
Analysis performed 2025-12-23 comparing:
- arch-markform-design.md.md
- plan-2025-12-22-markform-v01-implementation.md
- simple.form.md, simple-mock-filled.form.md
- earnings-analysis.form.md
- Markdoc official documentation
