# Plan Spec: Examples CLI Command with Interactive Selection

## Purpose

This plan creates an `examples` CLI command that provides a menu-driven console UI for
users to discover and scaffold example forms into their current working directory.

**Related Docs:**

- [Political Research Example](plan-2025-12-23-political-research-example.md) - One of
  the example forms

- [Role System](../done/plan-2025-12-23-role-system.md) - Defines user/agent roles for
  fields

- [Interactive Fill Mode](plan-2025-12-23-fill-interactive-mode.md) - Console prompts
  for user role fields

- [Architecture Design](../../architecture/current/arch-markform-initial-design.md)

- [v0.1 Implementation Plan](../done/plan-2025-12-22-markform-v01-implementation.md) -
  Base implementation

## Background

Users who are new to Markform need a quick way to:

1. Discover what kinds of forms are possible

2. Get a working example to experiment with

3. See recommended commands to try on that form

Currently, users must find example files in the source repository.
This command provides a discoverable, built-in way to scaffold examples directly from
the CLI.

## Summary of Task

1. Create an `examples` CLI command with interactive menu selection

2. Bundle 3 example forms into the build:

   - **Simple Test Form** - Minimal form with all field types

   - **Political Research** - Biographical form for web research (agent test case)

   - **Company Quarterly Analysis** - Extensive financial analysis worksheet

3. Display title and description for each example in the selection menu

4. Write the selected example to the current directory

5. Print helpful commands the user can try on the scaffolded form

## Backward Compatibility

None required. This is a new command that adds functionality without changing existing
behavior.

## Prerequisites

- **Political Research Example**: Political Research form must be created first (per the
  political-research-example plan)

- **Role System**: The role system plan must be implemented so example forms can define
  `role="user"` fields

- **Interactive Fill Mode**: The `fill --interactive` mode must be implemented so users
  can fill their role fields in the console after scaffolding

* * *

## Stage 1: Planning Stage

### Feature Requirements

**Must Have:**

- Interactive selection menu using `@clack/prompts` (already a dependency)

- 3 bundled examples with title and description

- Editable filename prompt (pre-filled with default, user can modify)

- Overwrite confirmation if file already exists

- Write selected form to current directory

- Display suggested next commands after writing

**Nice to Have:**

- `--list` flag to show examples without interaction

- `--name <example>` flag to skip interactive selection (still prompts for filename)

**Out of Scope:**

- Multiple example selection at once

- Auto-running commands after scaffolding

### Example Definitions

| ID | Title | Filename | Description |
| --- | --- | --- | --- |
| `simple` | Simple Test Form | `simple.form.md` | Minimal form demonstrating all Markform v0.1 field types. Good for learning the basics. |
| `political-research` | Political Research | `political-research.form.md` | Biographical form for researching political figures using web search. Includes repeating groups for offices held. |
| `earnings-analysis` | Company Quarterly Analysis | `earnings-analysis.form.md` | Extensive financial analysis worksheet with company profile and quarterly analysis sections. |

### CLI Interface

```bash
# Interactive mode (default)
markform examples
# → Presents selection menu
# → Writes chosen example to current directory
# → Prints suggested commands

# List mode (non-interactive)
markform examples --list
# → Prints table of available examples

# Direct selection (non-interactive)
markform examples --name simple
# → Writes simple.form.md without prompting
```

### User Flow

**Normal flow (new file):**

```
$ markform examples

◆  Select an example form to scaffold:
│  ○ Simple Test Form
│     Minimal form demonstrating all Markform v0.1 field types.
│  ○ Political Research
│     Biographical form for researching political figures using web search.
│  ● Company Quarterly Analysis
│     Extensive financial analysis worksheet with company profile and quarterly analysis.

◆  Filename:
│  earnings-analysis.form.md
│  (edit or press Enter to accept)

✔ Created earnings-analysis.form.md

This form has fields for both you (user) and the AI agent.

Next steps:
  # 1. Fill in your fields (company name, ticker, period)
  markform fill earnings-analysis.form.md --interactive -o earnings-filled.form.md

  # 2. Let the agent complete the analysis
  markform fill earnings-filled.form.md -o earnings-done.form.md

  # 3. Review the final output
  markform dump earnings-done.form.md

Other useful commands:
  markform inspect earnings-analysis.form.md
```

**Overwrite flow (file exists):**

```
$ markform examples

◆  Select an example form to scaffold:
│  ● Simple Test Form
│     Minimal form demonstrating all Markform v0.1 field types.

◆  Filename:
│  simple.form.md

⚠  simple.form.md already exists.
◆  Overwrite?
│  ○ Yes / ● No

✖ Cancelled.
```

**Custom filename flow:**

```
$ markform examples

◆  Select an example form to scaffold:
│  ● Simple Test Form

◆  Filename:
│  my-project.form.md  ← user edited the default

✔ Created my-project.form.md

Next steps:
  markform fill my-project.form.md --interactive -o my-project-filled.form.md
  markform fill my-project-filled.form.md -o my-project-done.form.md
  markform dump my-project-done.form.md
```

### Acceptance Criteria

1. `markform examples` shows interactive menu with 3 options

2. Each option displays title and description

3. After selection, prompts for filename (pre-filled with default)

4. User can edit filename or press Enter to accept default

5. If file exists, prompts for overwrite confirmation

6. Output confirms file creation and shows three-step workflow (interactive fill,
   agent fill, then dump for verification)

7. `markform examples --list` shows non-interactive list

8. `markform examples --name simple` skips selection but still prompts for filename

* * *

## Stage 2: Architecture Stage

### Build-time Bundling Strategy

The example forms must be available at runtime without requiring filesystem access to
the source repository.
Two approaches:

**Option A: Embedded String Constants (Recommended)**

- Create `src/cli/examples/index.ts` that exports example content as string constants

- Each example is a TypeScript file exporting the form content

- Pros: Simple, no build config changes, tree-shakeable

- Cons: Slightly larger bundle size

**Option B: Asset Files with Build Copy**

- Use tsdown’s asset copying to include `.form.md` files in dist

- Read files at runtime using `import.meta.dirname`

- Pros: Cleaner source files

- Cons: Requires build config changes, runtime file system access

**Decision: Option A** - Embedded strings are simpler and more portable.

### Module Structure

```
src/cli/
├── commands/
│   └── examples.ts          # Command implementation
└── examples/
    ├── index.ts             # Example registry (title, description, content)
    ├── simple.ts            # Simple form content
    ├── political-research.ts  # Political research form content
    └── earnings-analysis.ts # Company quarterly analysis form content
```

### Example Registry Interface

```typescript
interface ExampleDefinition {
  id: string;           // Machine-readable identifier
  title: string;        // Human-readable title for menu
  description: string;  // One-line description
  filename: string;     // Default output filename
  content: string;      // Full form content
}

const EXAMPLES: ExampleDefinition[] = [
  // ... definitions
];
```

### Dependencies

- `@clack/prompts` - Already installed, provides:

  - `select()` - Example selection menu

  - `text()` - Editable filename input with default value

  - `confirm()` - Overwrite confirmation

  - `log.success()`, `log.warning()` - Status messages

- `fs/promises` - For writing output file and checking existence

- `picocolors` - Already installed, for colored output

* * *

## Stage 3: Implementation Stage

### Phase 1: Create Example Content Modules

**Goal:** Extract existing examples into importable string modules.

- [ ] Create `src/cli/examples/` directory

- [ ] Create `src/cli/examples/simple.ts` with `SIMPLE_FORM_CONTENT` export

- [ ] Create `src/cli/examples/earnings-analysis.ts` with `EARNINGS_ANALYSIS_CONTENT`
  export

- [ ] Create `src/cli/examples/political-research.ts` with `POLITICAL_RESEARCH_CONTENT`
  export

  - Note: Depends on political-research-example plan

- [ ] Create `src/cli/examples/index.ts` with `EXAMPLES` registry array

### Phase 2: Implement Examples Command

**Goal:** Create the CLI command with interactive selection and filename editing.

- [ ] Create `src/cli/commands/examples.ts`

- [ ] Implement interactive selection using `@clack/prompts.select()`

- [ ] Implement filename prompt using `@clack/prompts.text()` with default value

- [ ] Implement file existence check and overwrite confirmation using
  `@clack/prompts.confirm()`

- [ ] Implement success message with suggested commands (using actual filename)

- [ ] Add `--list` flag for non-interactive listing

- [ ] Add `--name <example>` flag to skip selection (still prompts for filename)

- [ ] Register command in `src/cli/cli.ts`

### Phase 3: Add Tests

**Goal:** Unit tests for examples command.

- [ ] Test example registry has all required fields

- [ ] Test `--list` output format

- [ ] Test `--name` selection with valid/invalid names

- [ ] Test file overwrite confirmation logic

* * *

## Stage 4: Validation Stage

### Automated Tests

- [ ] All example content modules export valid form markdown

- [ ] Example registry contains 3 examples with required fields

- [ ] `markform examples --list` exits successfully

- [ ] `markform examples --name simple` creates file (in temp dir)

### Manual Tests

- [ ] Run `markform examples` and verify menu renders correctly

- [ ] Select each example and verify file is written

- [ ] Verify suggested commands work on the scaffolded form

- [ ] Test overwrite confirmation with existing file

### Definition of Done

1. `markform examples` command works interactively

2. All 3 examples scaffold successfully

3. Example forms include `role="user"` fields for user context

4. `--list` and `--name` flags work as documented

5. Existing file prompts for confirmation

6. Success message shows three-step workflow (interactive fill, agent fill, dump)

7. Tests pass

* * *

## Stage 5: Complete Workflow (Post-MVP)

### Overview

After the basic scaffold + interactive fill is working, extend the command to provide
a complete end-to-end workflow:

1. **Scaffold** - Write example form to disk
2. **Interactive Fill** - User fills their role fields
3. **Agent Fill** - LLM agent fills remaining fields
4. **Multi-format Export** - Export completed form in multiple formats

### Phase 4: Agent Fill Integration

**Goal:** After user completes interactive fill, optionally run agent to fill remaining fields.

#### 4.1: Prompt for Agent Fill

After interactive fill completes with remaining agent-role fields:

```
✓ 3 field(s) updated. Saved to simple-filled1.form.md

This form has agent-role fields remaining.

◆  Run agent fill now?
│  ○ Yes - configure model and run
│  ● No - exit (you can run 'markform fill' later)
```

- [x] Add prompt after interactive fill completes
- [x] Only show if there are unfilled agent-role fields
- [x] Allow user to skip and run manually later

#### 4.2: Model Selection

If user chooses to run agent fill:

```
◆  Select LLM provider:
│  ○ OpenAI (gpt-4o, gpt-4o-mini)
│  ○ Anthropic (claude-sonnet-4-20250514, claude-3-5-haiku-20241022)
│  ○ Google (gemini-2.0-flash, gemini-1.5-pro)
│  ● Enter custom model ID

◆  Model ID:
│  anthropic/claude-sonnet-4-20250514
```

- [x] Show common model options from supported providers
- [x] Allow custom model ID entry
- [x] Validate model ID format (provider/model-id)
- [x] Check for API key in environment (OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.)

#### 4.3: Agent Output Filename

Generate versioned output filename:

```
◆  Agent output filename:
│  simple-filled2.form.md
```

- [x] Use `generateVersionedPath()` to get next version (e.g., `-filled2` after `-filled1`)
- [x] Pre-fill with `initialValue` (not placeholder)
- [x] Allow user to edit

#### 4.4: Run Agent Harness

Execute the live agent:

```
◆  Running agent fill...
│  Model: anthropic/claude-sonnet-4-20250514
│  Turn 1: 5 issues → 5 patches → 0 remaining
│
✓ Form completed in 1 turn(s)
```

- [x] Import and use `createLiveAgent` and `createHarness`
- [x] Display progress during execution
- [x] Handle errors gracefully (API failures, rate limits)
- [x] Support cancellation (Ctrl+C)

### Phase 5: Multi-format Export

**Goal:** After agent fill completes, export results in multiple formats.

#### 5.1: Export Formats

After successful agent fill, generate additional output files:

| Format | Filename Pattern | Description |
|--------|------------------|-------------|
| Form | `{base}-filled2.form.md` | Complete Markform with all values |
| Raw MD | `{base}-filled2.raw.md` | Plain markdown without Markform syntax |
| YAML | `{base}-filled2.yml` | Field values as YAML for programmatic use |

```
✓ Agent fill complete. Outputs:
  simple-filled2.form.md    (markform)
  simple-filled2.raw.md     (plain markdown)
  simple-filled2.yml        (values as YAML)
```

- [x] Use `serialize()` for `.form.md` output
- [x] Use `serializeRawMarkdown()` for `.raw.md` output
- [x] Use YAML library to serialize `form.valuesByFieldId` for `.yml` output

#### 5.2: Automatic Export

All formats are exported automatically after agent fill completes (no prompt needed for MVP):

- [x] Export all three formats automatically
- [ ] Future: Add prompt to select formats (deferred)

### Implementation Sub-tasks

The following beads should be created for tracking:

| Bead | Title | Description |
|------|-------|-------------|
| markform-163 | Add prompt for agent fill after interactive fill | Check for agent fields, prompt user to continue |
| markform-164 | Add model selection UI | Provider list, custom model entry, API key check |
| markform-165 | Add agent output filename prompt | Versioned naming with generateVersionedPath |
| markform-166 | Integrate live agent harness | Run agent, display progress, handle errors |
| markform-167 | Add multi-format export | Raw markdown and YAML export after completion |
| markform-168 | Normalize file path display | Use formatPath() helper for consistent relative paths |
| markform-169 | Extract reusable multi-format export logic | Move export helpers to shared module |
| markform-170 | Enable verbose logging during agent fill | Show each turn and patch during agent execution |
| markform-171 | Check API availability at start | Display API status for each provider at startup |

### Acceptance Criteria (Complete Workflow)

1. After interactive fill, prompts to run agent fill if agent fields remain
2. Model selection shows common options and allows custom entry
3. Agent output uses versioned naming convention
4. Agent progress is displayed during execution (verbose: turns, patches)
5. On completion, exports to `.form.md`, `.raw.md`, and `.yml`
6. User can skip agent fill and run manually later
7. Graceful error handling for API failures
8. File paths displayed consistently as relative paths (e.g., `./simple-filled1.form.md`)
9. API availability status shown at startup (✓ for configured, ○ for missing)

* * *

## Open Questions

1. **Output directory:** Should we support `--output <dir>` or just use current
   directory?

   - **Decision:** Current directory only.
     Users can `cd` before running the command.

2. **File naming:** Should we allow custom output filename?

   - **Decision:** Yes. User can edit the pre-filled filename before writing.
     This allows customization while keeping the default easy.

3. **Political Research form dependency:** Should this plan wait for the
   political-research-example plan?

   - **Decision:** Yes. Add political-research-example as prerequisite.
     Can stub the content initially.

* * *

## Revision History

- 2025-12-24: UX improvements - added formatPath() for consistent path display, extracted
  reusable export helpers to shared module, added verbose logging during agent fill,
  added API availability status at startup; closed markform-168 through markform-171

- 2025-12-24: Implemented Stage 5 (Complete Workflow) - agent fill prompt, model selection,
  versioned output naming, live agent harness integration, and multi-format export;
  closed markform-163 through markform-167

- 2025-12-24: Added Stage 5 (Complete Workflow) with agent fill integration and
  multi-format export; defined 5 implementation sub-tasks (markform-163 to markform-167)

- 2025-12-24: Updated Stage 3 implementation - auto-run interactive fill after scaffold,
  simple form now has all user-role fields for testing

- 2025-12-23: Renamed "political-figure" to "political-research"; renamed
  "company-quarterly" to "earnings-analysis"; added dump command as final workflow step;
  updated three-step workflow (interactive fill, agent fill, dump)

- 2025-12-23: Added role system and interactive fill mode as prerequisites; updated
  suggested commands to show two-stage workflow (user fills interactively, then agent)

- 2025-12-23: Added editable filename prompt and overwrite confirmation flow

- 2025-12-23: Initial plan created
