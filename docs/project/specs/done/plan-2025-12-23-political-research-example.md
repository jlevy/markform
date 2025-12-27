# Plan Spec: Political Research Example Form

## Purpose

This plan creates a comprehensive example form for the `examples` CLI command that
demonstrates live agent web research capabilities.
It uses a real-world use case: a political figure biographical form based on Wikipedia’s
president infobox structure.

**Related Docs:**

- [Examples CLI Command](plan-2025-12-23-examples-cli-command.md) - Parent command that
  scaffolds this example

- [Role System](../done/plan-2025-12-23-role-system.md) - Role-based field assignment

- [Architecture Design](../../architecture/current/arch-markform-design.md.md)

- [v0.1 Implementation Plan](../done/plan-2025-12-22-markform-v01-implementation.md) -
  Base implementation (complete)

## Background

To validate the live agent implementation, we need a realistic, complex form that:

1. Has multiple field types (strings, numbers, dates, lists, selections)

2. Includes repeating groups (offices held)

3. Requires web research to fill correctly

4. Can be verified against a known source (Wikipedia)

The Wikipedia president infobox provides an ideal template - it’s standardized, publicly
accessible, and contains structured biographical data that an agent must research to
fill.

## Summary of Task

1. Create `political-research.form.md` based on Wikipedia’s president infobox structure

2. Handle repeating “offices held” with role, dates, and predecessor/successor

3. Document test workflow with final `dump` output for verification

4. Integrate into the `examples` CLI command

5. Define agent instructions pattern for web research tasks

## Backward Compatibility

None required. This is a new example form.

## Prerequisites

- **Fill Command**: `markform fill` command with live agent support

- **Role System**: Role-based field assignment (`role="user"` for name field)

* * *

## Stage 1: Planning Stage

### Feature Requirements

**Must Have:**

- `political-research.form.md` with all standard infobox fields

- `name` field with `role="user"` (user provides the subject to research)

- All other fields with `role="agent"` (agent fills via web research)

- Repeating group for “offices held” (multiple positions)

- Test workflow ending with `dump` command for text output

- Agent instructions in frontmatter `role_instructions`

**Form Fields (based on Wikipedia president infobox):**

**Basic Info:**

- `name` (string, required, **role="user"**) - Full name (user provides this to seed
  agent)

- `portrait_description` (string, optional) - Description of official portrait

- `birth_date` (string, required, `pattern="^\d{4}-\d{2}-\d{2}$"`) - Format: YYYY-MM-DD

- `birth_place` (string, required) - City, State/Country

- `death_date` (string, optional, `pattern="^\d{4}-\d{2}-\d{2}$"`) - Format: YYYY-MM-DD
  (if deceased)

- `death_place` (string, optional) - City, State/Country

- `cause_of_death` (string, optional) - If applicable

- `resting_place` (string, optional) - Burial location

**Political Info:**

- `political_party` (string, required) - Primary party affiliation

- `other_parties` (string_list, optional) - Previous party affiliations

**Personal Life:**

- `spouse` (string, optional) - Name and years married

- `children` (string_list, optional) - Names of children

- `parents` (string_list, optional) - Names of parents

- `education` (string_list, optional) - Schools/degrees

**Offices Held (repeating group):**

> **Note:** True repeating groups (dynamic add/remove of field sets) are planned for
> v0.2. For v0.1, we use a fixed number of office slots with indexed field names (e.g.,
> `office_1_title`, `office_2_title`, etc.).

- `office_title` (string, required) - e.g., “16th President of the United States”

- `term_start` (string, required, `pattern="^\d{4}-\d{2}-\d{2}$"`) - YYYY-MM-DD

- `term_end` (string, required) - YYYY-MM-DD or “Incumbent”.
  Note: The dual format (date OR text) requires either no pattern validation, or a
  pattern that accepts both: `pattern="^(\d{4}-\d{2}-\d{2}|Incumbent)$"`

- `preceded_by` (string, optional, priority=medium) - Previous office holder

- `succeeded_by` (string, optional, priority=medium) - Next office holder

- `running_mate` (string, optional) - For presidential terms

**Sources and Citations:**

- `sources` (string_list, optional) - List of source URLs or citations used for
  research. Agent should include Wikipedia and any additional sources consulted.

### Acceptance Criteria

1. Form parses and validates correctly with `markform inspect`

2. Empty form shows appropriate required field issues

3. Partially filled form (name only) shows remaining issues

4. Live agent can research and fill remaining fields using web search

5. Completed form passes validation

6. `dump` command outputs clean text format for verification

* * *

## Stage 2: Architecture Stage

### Form Structure

```
political-research.form.md
├── Frontmatter (markform config with roles and role_instructions)
├── Agent Instructions (doc block with research guidance)
├── Basic Information (field-group)
│   ├── name (string, required, role="user")
│   ├── birth_date (string, required)
│   ├── birth_place (string, required)
│   ├── death_date (string, optional)
│   ├── death_place (string, optional)
│   ├── cause_of_death (string, optional)
│   └── resting_place (string, optional)
├── Political Affiliation (field-group)
│   ├── political_party (string, required)
│   └── other_parties (string_list, optional)
├── Personal Life (field-group)
│   ├── spouse (string, optional)
│   ├── children (string_list, optional)
│   ├── parents (string_list, optional)
│   └── education (string_list, optional)
└── Offices Held (field-group, repeating pattern)
    ├── Office 1
    │   ├── office_1_title (string, required)
    │   ├── office_1_term_start (string, required)
    │   ├── office_1_term_end (string, required)
    │   ├── office_1_preceded_by (string, optional)
    │   ├── office_1_succeeded_by (string, optional)
    │   └── office_1_running_mate (string, optional)
    ├── Office 2
    │   └── ... (same structure)
    └── Office 3
        └── ... (same structure)
```

### Frontmatter with Role Configuration

```yaml
---
markform:
  spec: "MF/0.1"
  roles:
    - user
    - agent
  role_instructions:
    user: "Enter the full name of the political figure you want to research."
    agent: |
      Research and fill in all biographical fields for the specified political figure.
      Guidelines:
      1. Start with Wikipedia - The subject's Wikipedia page is the primary source
      2. Verify with multiple sources - Cross-reference dates and facts
      3. Use official formats - Dates as YYYY-MM-DD, places as "City, State/Country"
      4. Fill offices chronologically - Most recent first
      5. Include predecessors/successors - These provide historical context
      6. Leave unknown fields empty - Don't guess or fabricate information
      7. Keep text fields concise - Aim for 50-100 words max for descriptive fields
         (e.g., portrait_description, cause_of_death). Lists should have 3-10 items.
---
```

### Test Workflow

The workflow demonstrates the two-stage role-based filling, ending with text dump:

```bash
# 1. Scaffold the example
markform examples --name political-research
# Creates: political-research.form.md

# 2. Inspect empty form (shows name as user-role field, rest as agent-role)
markform inspect political-research.form.md

# 3. Stage 1: User fills their role fields (name) interactively
#    --interactive defaults to role="user"
markform fill political-research.form.md \
  --interactive \
  -o lincoln.form.md
# User enters: "Abraham Lincoln"

# 4. Verify partial state (name filled, agent fields empty)
markform inspect lincoln.form.md

# 5. Stage 2: Agent fills remaining fields (default role="agent")
markform fill lincoln.form.md \
  \
  --model=openai/gpt-4.1 \
  -o lincoln-filled.form.md \
  --record /tmp/lincoln-session.yaml

# 6. Inspect completed form
markform inspect lincoln-filled.form.md

# 7. Dump final values as text for verification
markform dump lincoln-filled.form.md
```

**Expected dump output:**

```
name: Abraham Lincoln
birth_date: 1809-02-12
birth_place: Hodgenville, Kentucky
death_date: 1865-04-15
death_place: Washington, D.C.
cause_of_death: Assassination
resting_place: Oak Ridge Cemetery, Springfield, Illinois
political_party: Republican
other_parties:
  - Whig
spouse: Mary Todd Lincoln (1842-1865)
children:
  - Robert Todd Lincoln
  - Edward Baker Lincoln
  - William Wallace Lincoln
  - Thomas Lincoln III
parents:
  - Thomas Lincoln
  - Nancy Hanks Lincoln
education:
  - Self-educated
office_1_title: 16th President of the United States
office_1_term_start: 1861-03-04
office_1_term_end: 1865-04-15
office_1_preceded_by: James Buchanan
office_1_succeeded_by: Andrew Johnson
office_1_running_mate: Hannibal Hamlin, Andrew Johnson
...
sources:
  - https://en.wikipedia.org/wiki/Abraham_Lincoln
```

**Alternative: Single-stage with all roles**

For testing or when user provides name via patch:

```bash
# Fill all roles at once (user skipped, agent fills everything)
markform fill political-research.form.md \
  --roles=* \
  \
  -o lincoln-filled.form.md
```

* * *

## Stage 3: Implementation Stage

### Phase 1: Create Form Template

**Goal:** Create the political-research.form.md with all fields.

- [ ] Create `examples/political-research/` directory

- [ ] Create `political-research.form.md` with:

  - [ ] Frontmatter with markform config, `roles`, and `role_instructions`

  - [ ] Agent instructions doc block

  - [ ] Basic Information field group (`name` field with `role="user"`)

  - [ ] Political Affiliation field group

  - [ ] Personal Life field group

  - [ ] Offices Held field groups (3 slots for offices)

  - [ ] Sources field

- [ ] Verify form parses: `markform inspect`

- [ ] Verify required fields show as issues

### Phase 2: Create Mock Completed Form

**Goal:** Create a pre-filled version for mock agent testing.

- [ ] Create `political-research.mock.lincoln.form.md` with Abraham Lincoln data:

  - Name: Abraham Lincoln

  - Birth: 1809-02-12, Hodgenville, Kentucky

  - Death: 1865-04-15, Washington, D.C., Assassination

  - Party: Republican (Whig previously)

  - Spouse: Mary Todd Lincoln (1842-1865)

  - Children: Robert, Edward, William, Thomas

  - Office 1: 16th President (1861-1865), Buchanan/Johnson

  - Office 2: US Representative IL-7 (1847-1849)

  - Office 3: Illinois State Representative (1834-1842)

- [ ] Verify mock form is complete: `markform inspect` shows no required issues

### Phase 3: Integrate with Examples CLI

**Goal:** Add to examples command.

- [ ] Create `src/cli/examples/political-research.ts` with form content

- [ ] Register in `src/cli/examples/index.ts`:

  ```typescript
  {
    id: 'political-research',
    title: 'Political Research',
    filename: 'political-research.form.md',
    description: 'Biographical form for researching political figures using web search. Includes repeating groups for offices held.',
    content: POLITICAL_RESEARCH_CONTENT
  }
  ```

- [ ] Update CLI output to show `dump` as final step

* * *

## Stage 4: Validation Stage

### Automated Tests

- [ ] `markform inspect political-research.form.md` succeeds

- [ ] Empty form shows expected required field count

- [ ] Mock form parses and validates as complete

- [ ] `markform fill --mock` completes successfully

- [ ] `markform dump` outputs expected format

### Manual Tests

- [ ] Run two-stage workflow: `fill --interactive` (user), then `fill` (agent)

- [ ] Verify `--interactive` only prompts for `name` field (role="user")

- [ ] Verify default `fill` skips `name` field (already filled by user role)

- [ ] Verify live agent researches Abraham Lincoln correctly

- [ ] Verify all offices filled with correct dates

- [ ] Verify predecessors/successors are accurate

- [ ] Verify `dump` outputs clean text

### Definition of Done

1. `political-research.form.md` created with `role="user"` on name field

2. Form frontmatter includes `roles` and `role_instructions`

3. Mock Lincoln form created for testing

4. Two-stage workflow works: `--interactive` (user) then default (agent)

5. Form integrated into `examples` CLI command

6. Live agent successfully fills form with accurate data

7. `dump` command outputs clean text for verification

* * *

## Open Questions

1. **Number of office slots:** Should we have 3, 5, or configurable?

   - **Decision:** Start with 3 slots (covers most cases)

2. **Date format validation:** Should we add pattern validation for YYYY-MM-DD?

   - **Decision:** Yes, add pattern for date fields

3. **Portrait field:** Include image URL or just description?

   - **Decision:** Description only (no image URLs in v0.1)

* * *

## Revision History

- 2025-12-23: Renamed from “political-figure-live-agent-test” to
  “political-research-example”; aligned with examples CLI command framework; added dump
  command as final step

- 2025-12-24: Added date pattern validation, term_end dual-format note, sources field,
  repeating groups v0.2 note, and word limit guidance (markform-122)

- 2025-12-23: Updated to use role system (`role="user"` for name field, frontmatter
  roles)

- 2025-12-23: Added `dump` command usage in test workflow for value extraction

- 2025-12-23: Initial plan created
