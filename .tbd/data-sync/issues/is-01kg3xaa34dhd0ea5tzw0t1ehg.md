---
close_reason: null
closed_at: 2025-12-24T06:47:21.818Z
created_at: 2025-12-24T06:21:30.836Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-29T03:38:56.362Z
    original_id: markform-156
id: is-01kg3xaa34dhd0ea5tzw0t1ehg
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Create mock Lincoln form for testing
type: is
updated_at: 2025-12-24T06:47:21.818Z
version: 1
---
Create a pre-filled political-research form with Abraham Lincoln data for mock agent testing.

**Location:** packages/markform/examples/political-research/political-research.mock.lincoln.form.md

**Data to include:**
- name: Abraham Lincoln
- birth_date: 1809-02-12
- birth_place: Hodgenville, Kentucky
- death_date: 1865-04-15
- death_place: Washington, D.C.
- cause_of_death: Assassination
- resting_place: Oak Ridge Cemetery, Springfield, Illinois
- political_party: Republican
- other_parties: [Whig]
- spouse: Mary Todd Lincoln (1842-1865)
- children: Robert Todd Lincoln, Edward Baker Lincoln, William Wallace Lincoln, Thomas Lincoln III
- parents: Thomas Lincoln, Nancy Hanks Lincoln
- education: Self-educated

**Offices:**
- Office 1: 16th President of the United States (1861-03-04 to 1865-04-15)
  - preceded_by: James Buchanan, succeeded_by: Andrew Johnson
  - running_mate: Hannibal Hamlin, Andrew Johnson
- Office 2: US Representative IL-7 (1847-03-04 to 1849-03-04)
- Office 3: Illinois State Representative (1834-12-01 to 1842-12-05)

**Validation:**
- markform inspect should show no required field issues
