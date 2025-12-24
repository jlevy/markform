# Plan Spec: Political Figure Form - Live Agent Integration Test

## Purpose

This plan creates a comprehensive test case for validating the live agent form-filling
workflow end-to-end.
It uses a real-world use case: a political figure biographical form based on Wikipedia’s
president infobox structure.

**Related Docs:**

- [Fill Command Plan](plan-2025-12-23-fill-command-live-agent.md) - **Prerequisite**
  (must be implemented first)

- [Role System Plan](plan-2025-12-23-role-system.md) - Role-based field assignment

- [Architecture Design](../../architecture/current/arch-markform-initial-design.md)

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

1. Create `political-figure.form.md` based on Wikipedia’s president infobox structure

2. Handle repeating “offices held” with role, dates, and predecessor/successor

3. Create a documented test workflow for manual validation

4. Add example to `docs/examples.md`

5. Define agent instructions pattern for web research tasks

## Backward Compatibility

None required. This is a new example form and documentation.

## Prerequisites

This plan depends on the following being implemented first:

- **markform-100**: dotenv support (enables API key loading)

- **Fill Command Plan**: `markform fill --agent=live` command with model selection

- **Role System Plan**: Role-based field assignment (`role="user"` for name field)

* * *

## Stage 1: Planning Stage

### Feature Requirements

**Must Have:**

- `political-figure.form.md` with all standard infobox fields

- Repeating group for “offices held” (multiple positions)

- Test workflow documentation

- Agent instructions field for research guidance

**Form Fields (based on Wikipedia president infobox):**

**Basic Info:**

- `name` (string, required, **role="user"**) - Full name (user provides this to seed
  agent)

- `portrait_description` (string, optional) - Description of official portrait

- `birth_date` (string, required) - Format: YYYY-MM-DD

- `birth_place` (string, required) - City, State/Country

- `death_date` (string, optional) - Format: YYYY-MM-DD (if deceased)

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

- `office_title` (string, required) - e.g., “16th President of the United States”

- `term_start` (string, required) - YYYY-MM-DD

- `term_end` (string, required) - YYYY-MM-DD or “Incumbent”

- `preceded_by` (string, optional, priority=medium) - Previous office holder

- `succeeded_by` (string, optional, priority=medium) - Next office holder

- `running_mate` (string, optional) - For presidential terms

**Agent Instructions:**

- `research_instructions` (string, optional) - Instructions for agent on how to research

### Acceptance Criteria

1. Form parses and validates correctly with `markform inspect`

2. Empty form shows appropriate required field issues

3. Partially filled form (name only) shows remaining issues

4. Live agent can research and fill remaining fields using web search

5. Completed form passes validation

6. Test workflow is documented and reproducible

* * *

## Stage 2: Architecture Stage

### Form Structure

```
political-figure.form.md
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
    │   ├── office_1_preceded_by (string, optional, priority=medium)
    │   ├── office_1_succeeded_by (string, optional, priority=medium)
    │   └── office_1_running_mate (string, optional)
    ├── Office 2
    │   └── ... (same structure)
    └── Office 3
        └── ... (same structure)
```

### Frontmatter with Role Configuration

The form will include roles and per-role instructions in the frontmatter:

```yaml
---
markform:
  markform_version: "0.1.0"
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
---
```

### Agent Instructions Doc Block

Additionally, a documentation block provides in-form guidance:

```markdown
{% doc ref="political_figure" kind="instructions" %}
## Research Instructions

Use web search to research and fill in all fields on this form for the specified
political figure. The `name` field (role="user") should be filled first by the user,
then the agent fills all remaining fields.
{% /doc %}
```

### Test Workflow

The workflow demonstrates the two-stage role-based filling:

```bash
# 1. Inspect empty form (shows name as user-role field, rest as agent-role)
markform inspect examples/political-figure/political-figure.form.md

# 2. Stage 1: User fills their role fields (name) interactively
#    --interactive defaults to role="user"
markform fill examples/political-figure/political-figure.form.md \
  --interactive \
  -o /tmp/lincoln-seeded.form.md
# User enters: "Abraham Lincoln"

# 3. Verify partial state (name filled, agent fields empty)
markform inspect /tmp/lincoln-seeded.form.md

# 4. Stage 2: Agent fills remaining fields (default role="agent")
markform fill /tmp/lincoln-seeded.form.md \
  --agent=live \
  --model=openai/gpt-4.1 \
  -o /tmp/lincoln-completed.form.md \
  --record /tmp/lincoln-session.yaml

# 5. Inspect completed form
markform inspect /tmp/lincoln-completed.form.md

# 6. Dump values in various formats for verification
markform dump /tmp/lincoln-completed.form.md                  # Console (colored)
markform dump /tmp/lincoln-completed.form.md --format=yaml    # YAML for review
markform dump /tmp/lincoln-completed.form.md --format=json    # JSON for programmatic use

# 7. (Optional) Pipe plaintext values for scripting
markform dump /tmp/lincoln-completed.form.md --format=plaintext | grep birth
```

**Alternative: Single-stage with all roles**

For testing or when user provides name via patch:

```bash
# Fill all roles at once (user skipped, agent fills everything)
markform fill examples/political-figure/political-figure.form.md \
  --roles=* \
  --agent=live \
  -o /tmp/lincoln-completed.form.md
```

**Note:** The `dump` command extracts only field values without
structure/progress/issues, making it ideal for:

- Quick value verification after form completion

- Piping to other tools (use `--format=plaintext` or `--format=json`)

- Integration with external systems

- Comparing values between form versions

* * *

## Stage 3: Implementation Stage

### Phase 1: Create Form Template

**Goal:** Create the political-figure.form.md with all fields.

- [ ] Create `examples/political-figure/` directory

- [ ] Create `political-figure.form.md` with:

  - [ ] Frontmatter with markform config, `roles`, and `role_instructions`

  - [ ] Agent instructions doc block

  - [ ] Basic Information field group (`name` field with `role="user"`)

  - [ ] Political Affiliation field group

  - [ ] Personal Life field group

  - [ ] Offices Held field groups (3 slots for offices)

- [ ] Verify form parses: `markform inspect`

- [ ] Verify required fields show as issues

### Phase 2: Create Mock Completed Form

**Goal:** Create a pre-filled version for mock agent testing.

- [ ] Create `political-figure.mock.lincoln.form.md` with Abraham Lincoln data:

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

### Phase 3: Document Test Workflow

**Goal:** Add example to docs/examples.md.

- [ ] Create or update `docs/examples.md`

- [ ] Add “Political Figure - Live Agent Test” section

- [ ] Document step-by-step workflow

- [ ] Include expected outputs at each step

- [ ] Add troubleshooting notes

* * *

## Stage 4: Validation Stage

### Automated Tests

- [ ] `markform inspect political-figure.form.md` succeeds

- [ ] Empty form shows expected required field count

- [ ] Mock form parses and validates as complete

- [ ] `markform fill --agent=mock` completes successfully

### Manual Tests

- [ ] Run two-stage workflow: `fill --interactive` (user), then `fill` (agent)

- [ ] Verify `--interactive` only prompts for `name` field (role="user")

- [ ] Verify default `fill` skips `name` field (already filled by user role)

- [ ] Verify live agent researches Abraham Lincoln correctly

- [ ] Verify all offices filled with correct dates

- [ ] Verify predecessors/successors are accurate

- [ ] Session transcript captures all turns

### Definition of Done

1. `political-figure.form.md` created with `role="user"` on name field

2. Form frontmatter includes `roles` and `role_instructions`

3. Mock Lincoln form created for testing

4. Two-stage workflow works: `--interactive` (user) then default (agent)

5. Test workflow documented in `docs/examples.md`

6. Live agent successfully fills form with accurate data

7. All dates and facts verified against Wikipedia

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

- 2025-12-23: Updated to use role system (`role="user"` for name field, frontmatter
  roles)

- 2025-12-23: Added `dump` command usage in test workflow for value extraction

- 2025-12-23: Initial plan created
