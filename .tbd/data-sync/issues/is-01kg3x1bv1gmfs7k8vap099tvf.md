---
close_reason: null
closed_at: 2025-12-24T06:43:25.232Z
created_at: 2025-12-24T06:21:30.217Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:34:03.219Z
    original_id: markform-155
id: is-01kg3x1bv1gmfs7k8vap099tvf
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Create political-research.form.md template
type: is
updated_at: 2025-12-24T06:43:25.232Z
version: 1
---
Create the political-research.form.md template file per plan-2025-12-23-political-research-example.md.

**Location:** packages/markform/examples/political-research/political-research.form.md

**Structure:**
1. Frontmatter with:
   - markform_version: "0.1.0"
   - roles: [user, agent]
   - role_instructions for user and agent

2. Field Groups:
   - Basic Information: name (role=user, required), portrait_description, birth_date (pattern), birth_place, death_date, death_place, cause_of_death, resting_place
   - Political Affiliation: political_party (required), other_parties (string_list)
   - Personal Life: spouse, children (string_list), parents (string_list), education (string_list)
   - Office 1: office_1_title (required), office_1_term_start (required, pattern), office_1_term_end (required), office_1_preceded_by, office_1_succeeded_by, office_1_running_mate
   - Office 2: Same structure with office_2_ prefix
   - Office 3: Same structure with office_3_ prefix
   - Sources: sources (string_list)

**Validation:**
- markform inspect should succeed
- Required fields should show as issues when empty
