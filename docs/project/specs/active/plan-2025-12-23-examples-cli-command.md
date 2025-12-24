# Plan Spec: Examples CLI Command with Interactive Selection

## Purpose

This plan creates an `examples` CLI command that provides a menu-driven console UI for
users to discover and scaffold example forms into their current working directory.

**Related Docs:**

- [Political Figure Live Agent
  Test](plan-2025-12-23-political-figure-live-agent-test.md) - One of the example forms

- [Role System](plan-2025-12-23-role-system.md) - Defines user/agent roles for fields

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

   - **Political Figure** - Biographical form for web research (agent test case)

   - **Company Quarterly Analysis** - Extensive financial analysis worksheet

3. Display title and description for each example in the selection menu

4. Write the selected example to the current directory

5. Print helpful commands the user can try on the scaffolded form

## Backward Compatibility

None required. This is a new command that adds functionality without changing existing
behavior.

## Prerequisites

- **markform-111**: Political Figure form must be created first (per the
  political-figure plan)

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
| `political-figure` | Political Figure | `political-figure.form.md` | Biographical form for researching political figures using web search. Includes repeating groups for offices held. |
| `company-quarterly` | Company Quarterly Analysis | `earnings-analysis.form.md` | Extensive financial analysis worksheet with company profile and quarterly analysis sections. |

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
│  ○ Political Figure
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
  markform fill earnings-analysis.form.md --interactive

  # 2. Let the agent complete the analysis
  markform fill earnings-analysis-v1.form.md

Other useful commands:
  markform inspect earnings-analysis.form.md
  markform dump earnings-analysis.form.md
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
  markform fill my-project.form.md --interactive
  markform fill my-project-v1.form.md
```

### Acceptance Criteria

1. `markform examples` shows interactive menu with 3 options

2. Each option displays title and description

3. After selection, prompts for filename (pre-filled with default)

4. User can edit filename or press Enter to accept default

5. If file exists, prompts for overwrite confirmation

6. Output confirms file creation and shows two-stage workflow hint (interactive fill,
   then agent fill)

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
    ├── political-figure.ts  # Political figure form content
    └── company-quarterly.ts # Company quarterly form content
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

- [ ] Create `src/cli/examples/company-quarterly.ts` with `COMPANY_QUARTERLY_CONTENT`
  export

- [ ] Create `src/cli/examples/political-figure.ts` with `POLITICAL_FIGURE_CONTENT`
  export

  - Note: Depends on markform-111 (political-figure form creation)

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

6. Success message shows two-stage workflow (interactive fill, then agent fill)

7. Tests pass

* * *

## Open Questions

1. **Output directory:** Should we support `--output <dir>` or just use current
   directory?

   - **Decision:** Current directory only.
     Users can `cd` before running the command.

2. **File naming:** Should we allow custom output filename?

   - **Decision:** Yes. User can edit the pre-filled filename before writing.
     This allows customization while keeping the default easy.

3. **Political Figure form dependency:** Should this plan wait for markform-111?

   - **Decision:** Yes. Add markform-111 as prerequisite.
     Can stub the content initially.

* * *

## Revision History

- 2025-12-23: Added role system and interactive fill mode as prerequisites; updated
  suggested commands to show two-stage workflow (user fills interactively, then agent)

- 2025-12-23: Added editable filename prompt and overwrite confirmation flow

- 2025-12-23: Initial plan created
