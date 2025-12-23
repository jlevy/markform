# Plan Spec: Political Figure Form - Live Agent Integration Test

## Purpose

This plan creates a comprehensive test case for validating the live agent form-filling
workflow end-to-end.
It uses a real-world use case: a political figure biographical form based on Wikipedia’s
president infobox structure.

**Related Docs:**

- [Fill Command Plan](plan-2025-12-23-fill-command-live-agent.md) - **Prerequisite** (must be
  implemented first)

- [Architecture Design](../../architecture/current/arch-markform-initial-design.md)

- [v0.1 Implementation Plan](../done/plan-2025-12-22-markform-v01-implementation.md) - Base
  implementation (complete)

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

This plan depends on the fill command plan being implemented first:

- **markform-100**: dotenv support (enables API key loading)
- **Fill Command Plan**: `markform fill --agent=live` command with model selection

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

- `name` (string, required) - Full name

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
├── Frontmatter (markform config)
├── Agent Instructions (doc block with research guidance)
├── Basic Information (field-group)
│   ├── name (string, required)
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

### Agent Instructions Pattern

The form will include a documentation block at the top with agent instructions:

```markdown
{% doc ref="agent_instructions" %}
## Research Instructions

Use web search to research and fill in all fields on this form for the specified
political figure. Follow these guidelines:

1. **Start with Wikipedia** - The subject's Wikipedia page is the primary source
2. **Verify with multiple sources** - Cross-reference dates and facts
3. **Use official formats** - Dates as YYYY-MM-DD, places as "City, State/Country"
4. **Fill offices chronologically** - Most recent first
5. **Include predecessors/successors** - These provide historical context
6. **Leave unknown fields empty** - Don't guess or fabricate information
{% /doc %}
```

### Test Workflow

```bash
# 1. Inspect empty form
markform inspect examples/political-figure/political-figure.form.md

# 2. Manually fill in the name (to seed the agent)
markform apply examples/political-figure/political-figure.form.md \
  --patch '[{"op":"set_string","fieldId":"name","value":"Abraham Lincoln"}]' \
  -o /tmp/lincoln-seeded.form.md

# 3. Verify partial state
markform inspect /tmp/lincoln-seeded.form.md

# 4. Run live agent to complete the form
markform fill /tmp/lincoln-seeded.form.md \
  --agent=live \
  --model=openai/gpt-5.2 \
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

**Note:** The `dump` command extracts only field values without structure/progress/issues,
making it ideal for:

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

  - [ ] Frontmatter with markform config

  - [ ] Agent instructions doc block

  - [ ] Basic Information field group

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

- [ ] Run full test workflow from docs/examples.md

- [ ] Verify live agent researches Abraham Lincoln correctly

- [ ] Verify all offices filled with correct dates

- [ ] Verify predecessors/successors are accurate

- [ ] Session transcript captures all turns

### Definition of Done

1. `political-figure.form.md` created and validates

2. Mock Lincoln form created for testing

3. Test workflow documented in `docs/examples.md`

4. Live agent successfully fills form with accurate data

5. All dates and facts verified against Wikipedia

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

- 2025-12-23: Added `dump` command usage in test workflow for value extraction
- 2025-12-23: Initial plan created
