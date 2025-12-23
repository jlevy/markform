# Plan Spec: Markform v0.1 Full Implementation

## Purpose

This plan spec covers the complete implementation of Markform v0.1 as defined in the
[architecture design document](../../architecture/current/arch-markform-initial-design.md).

The implementation is organized into five phases:

- **Phase 0**: Project scaffolding and monorepo setup

- **Phase 1**: Core engine (parsing, serialization, validation, patches) with unit tests

- **Phase 2**: Web UI (serve) for form browsing and basic CLI commands

- **Phase 3**: End-to-end CLI, harness loop, and golden session tests

- **Phase 4**: Vercel AI SDK integration research and testing

## Background

Markform is a system for agent-friendly, human-readable, editable forms stored as
`.form.md` files. It supports:

- Structured context, schema, and form values in one text file

- Incremental filling (field-by-field or batch)

- Flexible validation at multiple scopes

- A harness loop for agentic form-filling workflows

- Golden session testing for end-to-end validation

**Key References**:

- [Architecture Design](../../architecture/current/arch-markform-initial-design.md) -
  Full technical specification

- [TypeScript Monorepo Research](../../research/current/research-modern-typescript-monorepo-package.md)
  \- Modern project setup patterns

- [TypeScript CLI Rules](../../../general/agent-rules/typescript-cli-tool-rules.md) -
  CLI development standards

- [TypeScript Rules](../../../general/agent-rules/typescript-rules.md) - General coding
  standards

- [TDD Guidelines](../../../general/agent-guidelines/general-tdd-guidelines.md) -
  Test-driven development methodology

## Development Methodology: TDD

This implementation follows **Test-Driven Development (TDD)** per the
[TDD Guidelines](../../../general/agent-guidelines/general-tdd-guidelines.md):

- **Red → Green → Refactor** in small slices

- Write one failing test at a time with clear, specific failures

- Name tests by observable behavior

- Prefer state-based assertions; only mock external boundaries

- Keep tests fast, deterministic, and isolated

- Separate structural vs behavioral commits

### Test Form Strategy

We use two test forms for progressive validation:

1. **Simple form** (`examples/simple/simple.form.md`) - Minimal form covering all field
   types and features. Used during Phase 1 for rapid TDD iteration.
   Already created.

2. **Complex form**
   (`examples/company-quarterly-analysis/company-quarterly-analysis.form.md`) -
   Comprehensive real-world form with many fields, nested groups, validators.
   Used in Phase 3+ for golden session tests and comprehensive validation.
   To be provided.

This approach allows fast iteration during core development while ensuring comprehensive
coverage before completion.

### Automated vs Manual Testing

Tests are categorized to clarify what the coding agent can run autonomously vs what
requires user interaction:

**Automated Tests** (agent can run independently):

- Unit tests (`vitest`)

- Integration tests

- Golden session replay tests

- CLI command tests with assertions

- Round-trip parse/serialize verification

**Manual User Tests** (require human interaction):

- Visual inspection of `serve` web UI

- Browsing form rendering in browser

- Verifying UI styling and layout

- Confirming save dialog behavior

- Reviewing AI agent session logs for quality

At the end of each phase, the plan indicates:

- **Automated checkpoint**: Tests the agent should run and verify pass

- **Manual checkpoint**: Points where the agent should pause and ask the user to verify

## Summary of Task

Implement the complete Markform v0.1 proof of concept as specified in the architecture
document, including:

1. Core engine for parsing, validating, and serializing `.form.md` files

2. CLI for inspect, apply, export, serve, and run commands

3. Harness loop for mock and live agent modes

4. Golden session testing framework

5. AI SDK tool integration

## Backward Compatibility

This is a new project with no backward compatibility requirements for v0.1.

* * *

## Stage 1: Planning Stage

### Feature Requirements

**Must Have (v0.1)**:

- Parse `.form.md` Markdoc documents to canonical model

- Round-trip safely: parse -> model -> serialize (deterministic)

- Support all field types: string, number, string-list, checkboxes, single-select,
  multi-select

- Built-in validation (required, patterns, ranges, checkbox states)

- Code validators via sidecar `.valid.ts` files

- Patch application with structural and semantic validation

- CLI commands: inspect, apply, export, serve, run

- Harness loop with mock mode for testing

- Golden session test framework

**Explicitly Not Included (v0.1)**:

- MCP server integration (deferred to v0.2)

- LLM validators (deferred to v0.2)

- PDF generation

- Conditional sections / branching logic

- Python validator runtime

### Acceptance Criteria

1. `markform inspect <file.form.md>` prints YAML report with structure summary, progress
   summary, form state, and prioritized issues

2. `markform serve <file.form.md>` opens browser to browse form with Save functionality

3. `markform run --mock` executes harness with mock agent, produces session transcript

4. Golden session tests pass: replay transcript, verify snapshots match

5. Example quarterly earnings form demonstrates all features

* * *

## Stage 2: Architecture Stage

### Project Structure (pnpm Monorepo)

Following the
[TypeScript Monorepo Research](../../research/current/research-modern-typescript-monorepo-package.md):

```
markform/
  .changeset/
    config.json
    README.md
  .github/
    workflows/
      ci.yml
      release.yml
  packages/
    markform/
      src/
        engine/           # Core parsing, serialization, validation
          types.ts        # All TypeScript types + Zod schemas
          parse.ts        # Markdoc parsing to ParsedForm
          serialize.ts    # Canonical markdown serialization
          validate.ts     # Built-in + code validator execution
          apply.ts        # Patch application
          inspect.ts      # Issue prioritization
          summaries.ts    # Structure/progress summary computation
        harness/          # Execution harness
          harness.ts      # Step protocol implementation
          mockAgent.ts    # Mock agent for testing
        cli/              # CLI commands
          commands/
            inspect.ts
            apply.ts
            export.ts
            serve.ts
            run.ts
          bin.ts          # CLI entry point
        integrations/     # External integrations
          ai-sdk.ts       # Vercel AI SDK tools
        web/              # Web UI for serve
          server.ts       # HTTP server
          templates/      # HTML templates
        index.ts          # Library entry point
      tests/
        unit/             # Unit tests per module
        golden/           # Golden session tests
          runner.ts       # Session replay runner
      examples/
        simple/           # Simple test form (TDD iteration)
          simple.form.md
          simple.mock.filled.form.md
          simple.session.yaml
        company-quarterly-analysis/  # Complex form (golden tests)
          company-quarterly-analysis.form.md
          company-quarterly-analysis.mock.filled.form.md
          company-quarterly-analysis.valid.ts
          company-quarterly-analysis.session.yaml
      package.json
      tsconfig.json
      tsdown.config.ts
  .gitignore
  .npmrc
  eslint.config.js
  package.json
  pnpm-workspace.yaml
  tsconfig.base.json
```

### Key Dependencies

| Package | Purpose |
| --- | --- |
| `@markdoc/markdoc` | Markdoc parsing and AST |
| `zod` | Schema validation |
| `jiti` | Runtime TypeScript loading for validators |
| `yaml` | YAML parsing/serialization |
| `commander` | CLI framework |
| `picocolors` | Terminal colors |
| `@clack/prompts` | Interactive CLI UI |
| `atomically` | Atomic file writes |
| `publint` | Package validation |
| `tsdown` | Build tooling |
| `vitest` | Testing framework |

### CLI Tool Standards

Per [TypeScript CLI Rules](../../../general/agent-rules/typescript-cli-tool-rules.md):

- Use `picocolors` for all terminal colors (never hardcoded ANSI)

- Use `commander` for CLI framework

- Use `@clack/prompts` for interactive UI (spinners, prompts)

- Support `--dry-run`, `--verbose`, `--quiet` flags

- Display timing for long operations

- Exit with proper codes (0 success, 1 failure)

* * *

## Stage 3: Refine Architecture

### Reusable Components

- **Markdoc**: Use existing parsing/validation infrastructure

- **Zod**: Standard schema validation patterns

- **Commander + Clack**: Standard CLI patterns

### Simplifications

- Single package initially (can split later via subpath exports)

- In-memory form state (no persistence layer needed)

- Local-only serve (no auth, no multi-user)

* * *

## Stage 4: Implementation Stage

### Phase 0: Project Scaffolding

**Goal**: Set up the pnpm monorepo with all tooling configured.

**Deliverables**:

- [ ] Initialize pnpm workspace structure

- [ ] Create root `package.json` with workspace scripts

- [ ] Create `pnpm-workspace.yaml`

- [ ] Create `.npmrc` with workspace settings

- [ ] Create `tsconfig.base.json` with shared TypeScript config

- [ ] Create `packages/markform/` directory structure

- [ ] Create package `package.json` with:

  - Proper exports configuration (ESM/CJS dual)

  - All dependencies listed

  - Build/test/lint scripts

- [ ] Create `tsdown.config.ts` for build

- [ ] Create `tsconfig.json` extending base

- [ ] Create `eslint.config.js` (flat config)

- [ ] Set up `.changeset/` for versioning

- [ ] Create `.github/workflows/ci.yml`

- [ ] Create placeholder `src/index.ts` that exports version

- [ ] Create initial test file `tests/unit/index.test.ts` with placeholder test

- [ ] Verify `pnpm build`, `pnpm test`, `pnpm lint` all pass

- [ ] Verify `examples/simple/simple.form.md` is in place (already created)

- [ ] Review and update `docs/development.md` with any scaffolding changes

**Phase 0 Checkpoints**:

*Automated* (agent runs):

- `pnpm build` passes

- `pnpm test` passes (placeholder test)

- `pnpm lint` passes

- `pnpm typecheck` passes

*Manual* (ask user): None for Phase 0 - all automated.

**Configuration Details**:

```yaml
# pnpm-workspace.yaml
packages:
  - "packages/*"
```

```json
// Root package.json
{
  "name": "markform-workspace",
  "private": true,
  "packageManager": "pnpm@10.26.1",
  "engines": { "node": ">=24" },
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "lint": "eslint .",
    "typecheck": "pnpm -r typecheck"
  }
}
```

```typescript
// tsdown.config.ts
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    bin: "src/cli/bin.ts"
  },
  format: ["esm", "cjs"],
  platform: "node",
  target: "node24",
  sourcemap: true,
  dts: true,
  clean: true,
  banner: ({ fileName }) =>
    fileName.startsWith("bin.") ? "#!/usr/bin/env node\n" : ""
});
```

* * *

### Phase 1: Core Engine with Unit Tests

**Goal**: Implement all core engine functionality using TDD with the simple test form.

**TDD Approach**: For each module, follow Red → Green → Refactor:

1. Write a failing test using `simple.form.md` as input where applicable

2. Implement minimum code to pass

3. Refactor for clarity

4. Commit (structural changes separate from behavioral)

**Test Form**: `examples/simple/simple.form.md` covers all 6 field types, all 3 checkbox
modes, documentation blocks, required/optional fields, and various constraints.

#### 1.1 Types and Schemas (`engine/types.ts`)

- [ ] Define all TypeScript types from architecture doc:

  - `Id`, `OptionId`, `QualifiedOptionRef`

  - `MultiCheckboxState`, `SimpleCheckboxState`, `ExplicitCheckboxValue`,
    `CheckboxValue`

  - `Field` union type (all 6 field types)

  - `FormSchema`, `FieldGroup`, `FieldBase`

  - All field interfaces: `StringField`, `NumberField`, `StringListField`,
    `CheckboxesField`, `SingleSelectField`, `MultiSelectField`

  - `FieldValue` union type

  - `DocumentationBlock`

  - `ParsedForm`, `IdIndexEntry`

  - `Patch` union type

  - `ValidationIssue`, `Severity`, `IssueReason`, `SourcePosition`, `SourceRange`

  - `InspectIssue`, `InspectResult`, `ApplyResult`

  - `StructureSummary`, `ProgressSummary`, `FieldProgress`, `ProgressState`

  - `CheckboxProgressCounts`, `ProgressCounts`

  - `StepResult` (harness step output)

  - Session transcript types: `SessionTranscript`, `SessionTurn`, `HarnessConfig`

  - `MarkformFrontmatter` (for frontmatter parsing/serialization)

- [ ] Create Zod schemas for all types (including session transcripts)

- [ ] Implement session transcript parsing and validation helpers

- [ ] Unit tests for schema validation (forms and sessions)

#### 1.2 Markdoc Parsing (`engine/parse.ts`)

- [ ] Implement `parseForm(markdown: string): ParsedForm`

- [ ] Frontmatter extraction and parsing

- [ ] AST traversal for form/group/field tags

- [ ] Option extraction from list items (checkbox markers)

- [ ] Value extraction from `fence` nodes with `language="value"`

- [ ] Documentation block extraction

- [ ] Semantic validation:

  - Global ID uniqueness

  - Option ID uniqueness within field

  - Doc block ref resolution

  - Checkbox mode enforcement

  - Label requirement

  - Option ID annotation requirement

- [ ] Build `orderIndex` and `idIndex`

- [ ] Unit tests for:

  - Empty form parsing

  - All field types

  - All checkbox modes and states

  - Documentation blocks

  - Validation error cases

  - Edge cases (whitespace, special characters)

#### 1.3 Canonical Serialization (`engine/serialize.ts`)

- [ ] Implement `serialize(form: ParsedForm, opts?): string`

- [ ] Frontmatter generation with computed summaries

- [ ] Tag serialization with alphabetical attributes

- [ ] Value fence generation (omit for empty)

- [ ] Option list serialization with markers

- [ ] Doc block placement

- [ ] Ensure `process=false` on all value fences

- [ ] Round-trip tests: parse -> serialize -> parse -> compare

#### 1.4 Summaries (`engine/summaries.ts`)

- [ ] Implement `computeStructureSummary(schema: FormSchema): StructureSummary`

- [ ] Implement `computeProgressSummary(schema, values, issues): ProgressSummary`

- [ ] Implement submission/completion state computation

- [ ] Unit tests for summary computation

#### 1.5 Validation (`engine/validate.ts`)

- [ ] Implement `validate(form: ParsedForm, opts?): ValidationResult`

- [ ] Built-in validators:

  - Required field checks

  - Number parsing and range validation

  - String pattern and length validation

  - String-list item count and constraints

  - Selection count constraints

  - Checkbox state validation

  - Explicit checkbox completion

- [ ] Code validator loading via jiti

- [ ] Validator execution and error collection

- [ ] Unit tests for all validation rules

#### 1.6 Patch Application (`engine/apply.ts`)

- [ ] Implement `applyPatches(form: ParsedForm, patches: Patch[]): ApplyResult`

- [ ] Structural validation (pre-apply):

  - Field ID existence

  - Option ID existence

  - Value type checking

- [ ] Patch semantics:

  - `set_*` operations

  - `clear_field` operation

  - `set_checkboxes` merge behavior

- [ ] Transaction semantics (all-or-nothing)

- [ ] Unit tests for all patch operations and error cases

#### 1.7 Inspect (`engine/inspect.ts`)

- [ ] Implement `inspect(form: ParsedForm): InspectResult`

- [ ] Issue prioritization logic

- [ ] Mapping from ValidationIssue to InspectIssue

- [ ] Completion check (`isComplete`)

- [ ] Unit tests for issue ordering

#### 1.8 Validate with Simple Form

The simple form is already created at `examples/simple/`. Use it throughout Phase 1:

- [x] `examples/simple/simple.form.md` (template) - already created

- [x] `examples/simple/simple.mock.filled.form.md` (completed mock) - already created

- [ ] Verify parse/serialize round-trip with simple form

- [ ] Verify all field types parse correctly

- [ ] Verify all checkbox modes work

- [ ] Verify validation catches expected issues

**Phase 1 Checkpoints**:

*Automated* (agent runs):

- All unit tests pass (`pnpm test`)

- Parse `simple.form.md` → structure summary matches expected counts

- Parse `simple.mock.filled.form.md` → all fields report as complete

- Round-trip test: parse → serialize → parse produces identical `ParsedForm`

- Validation tests: empty required fields produce correct issues

- Patch tests: valid patches apply, invalid patches reject batch

*Manual* (ask user): None for Phase 1 - all automated.

#### 1.9 Session Transcript Handling (`engine/session.ts`)

- [ ] Implement `parseSession(yaml: string): SessionTranscript`

- [ ] Implement `serializeSession(session: SessionTranscript): string`

- [ ] Session schema validation via Zod

- [ ] Session transcript structure per architecture doc:

  - `session_version`, `mode`, `form`, `validators`, `mock`, `harness` config

  - `turns` array with `turn`, `inspect`, `apply`, `after` sections

  - `final` section with completion expectations

- [ ] YAML serialization with snake_case key conversion

- [ ] Unit tests for:

  - Valid session parsing

  - Invalid session rejection (schema errors)

  - Round-trip: parse -> serialize -> parse (validates determinism)

  - Partial session handling (for recording in progress)

- [ ] **Comprehensive round-trip validation tests**:

  Session transcripts embed many nested types (InspectIssue, Patch, HarnessConfig,
  etc.), so round-trip testing sessions validates the entire type system:

  - Create test sessions with all patch operation types

  - Include all issue reason codes and severities

  - Include all checkbox modes and states

  - Verify serialized YAML matches expected canonical format

  - Parse serialized output and deep-compare to original

* * *

### Phase 2: Web UI (serve) and Basic CLI

**Goal**: Enable browsing forms via web UI and basic CLI inspection.

#### 2.1 CLI Infrastructure (`cli/`)

Per [TypeScript CLI Rules](../../../general/agent-rules/typescript-cli-tool-rules.md):

- [ ] Create `bin.ts` entry point with commander setup

- [ ] Create shared utilities:

  - `lib/colors.ts` - picocolors wrapper

  - `lib/shared.ts` - context helpers, debug, dry-run

  - `lib/formatting.ts` - output formatting

- [ ] Implement global options: `--verbose`, `--quiet`, `--dry-run`

- [ ] Add colored help text

#### 2.2 Inspect Command (`cli/commands/inspect.ts`)

- [ ] Parse form file

- [ ] Run validation

- [ ] Output YAML report:

  - Structure summary

  - Progress summary

  - Form state

  - Issues (sorted by priority)

- [ ] Colored output for terminal

#### 2.3 Export Command (`cli/commands/export.ts`)

- [ ] Parse form file

- [ ] Output JSON: `{ schema, values }`

#### 2.4 Serve Command (`cli/commands/serve.ts`)

- [ ] HTTP server setup

- [ ] HTML rendering of form structure:

  - Groups with headers

  - Fields with labels and values

  - Checkbox states with markers

  - Documentation blocks

- [ ] CSS styling for readability

- [ ] Save button with versioned filename logic:

  - Detect existing version pattern (`-vN`, `_vN`, ` vN`)

  - Increment or append `-v1`

  - Confirmation before write

**Phase 2 Checkpoints**:

*Automated* (agent runs):

- `markform inspect examples/simple/simple.form.md` outputs valid YAML

- `markform inspect examples/simple/simple.mock.filled.form.md` shows form_state:
  complete

- `markform export examples/simple/simple.form.md --json` outputs valid JSON

- CLI integration tests pass

*Manual* (ask user to verify):

- Run `markform serve examples/simple/simple.form.md`

- User browses form in browser and confirms:

  - All field groups render with headers

  - All field types display correctly

  - Documentation blocks appear

  - Values from filled form display properly

- User clicks Save and confirms:

  - Versioned filename dialog appears

  - File saves correctly to new versioned name

* * *

### Phase 3: End-to-End CLI and Session Tests

**Goal**: Complete CLI functionality and golden session testing with both test forms.

**Test Forms**:

- **Simple form**: Quick iteration for harness development

- **Complex form** (`company-quarterly-analysis.form.md`): Comprehensive golden tests

At this phase, you will be provided with `company-quarterly-analysis.form.md` - a
comprehensive real-world form with many fields, nested groups, and code validators.

#### 3.1 Apply Command (`cli/commands/apply.ts`)

- [ ] Parse form file

- [ ] Parse patches from `--patch` JSON argument

- [ ] Apply patches

- [ ] Write canonical output

- [ ] Report issues

#### 3.2 Harness Implementation (`harness/`)

- [ ] Implement `FormHarness` class with step protocol

- [ ] State machine: INIT -> STEP -> WAIT -> APPLY -> COMPLETE

- [ ] `step()` returns `StepResult` with summaries and issues

- [ ] `apply(patches)` applies and revalidates

- [ ] `max_turns` safety limit

#### 3.3 Mock Agent (`harness/mockAgent.ts`)

- [ ] Load completed mock file

- [ ] Extract values from mock

- [ ] On each step, pick recommended fields and generate patches

- [ ] Deterministic execution for testing

#### 3.4 Run Command (`cli/commands/run.ts`)

- [ ] `--mock` flag for mock mode

- [ ] `--completed-mock <file>` for mock values source

- [ ] `--record <file>` to output session transcript

- [ ] Execute harness loop to completion

- [ ] Output session YAML

#### 3.5 Golden Session Tests (`tests/golden/`)

- [ ] Session transcript schema validation

- [ ] Implement `runGoldenTest(sessionPath)`:

  - Load session YAML

  - Load template form

  - Replay each turn’s patches

  - Verify issues match expected

  - Verify snapshots (sha256) match

  - Verify final form matches completed mock

- [ ] Create `examples/simple/simple.session.yaml` - quick golden test

- [ ] Create
  `examples/company-quarterly-analysis/company-quarterly-analysis.session.yaml` -
  comprehensive golden test

- [ ] Integration test runner that runs all golden tests

**Phase 3 Checkpoints**:

*Automated* (agent runs):

- `markform apply` with valid patches updates form correctly

- `markform apply` with invalid patches returns rejection + issues

- `markform run --mock` completes and produces session transcript

- Golden test replay for `simple.session.yaml` passes:

  - All turns replay with matching issues

  - Final form matches `simple.mock.filled.form.md`

- Golden test replay for `company-quarterly-analysis.session.yaml` passes:

  - Code validators execute correctly

  - All turns replay with matching issues

  - Final form matches completed mock

*Manual* (ask user to verify):

- Review generated session transcript YAML for readability

- Optionally: user runs `markform serve` on completed forms to visually verify

* * *

### Phase 4: Vercel AI SDK Integration

**Goal**: Research and validate AI SDK tool integration for live agent mode.

#### 4.1 AI SDK Tool Definitions (`integrations/ai-sdk.ts`)

- [ ] Implement `createMarkformTools(options)` factory

- [ ] Define tools:

  - `markform_inspect` - Get form state

  - `markform_apply` - Apply patches

  - `markform_export` - Get schema/values JSON

  - `markform_get_markdown` - Get canonical source

- [ ] Zod input schemas for all tools

- [ ] Tool execute functions wrapping engine

#### 4.2 Live Agent Test Script

- [ ] Create `scripts/test-live-agent.ts`

- [ ] Load simple form template for quick iteration

- [ ] Configure AI SDK with tools

- [ ] Run agent loop to fill form

- [ ] Log session transcript

- [ ] Validate final form completeness

- [ ] Run with complex form to verify comprehensive handling

**Phase 4 Checkpoints**:

*Automated* (agent runs):

- AI SDK tools have correct Zod schemas

- Tool execute functions return correct types

- Integration test: mock LLM responses trigger correct tool calls

*Manual* (ask user to verify):

- User runs `scripts/test-live-agent.ts` with real LLM

- User reviews agent conversation log for quality

- User verifies final form is correctly filled

- User confirms session transcript captures all turns

- User reviews AI behavior on complex form (edge cases, validation recovery)

#### 4.3 Documentation

- [ ] Document AI SDK integration in README

- [ ] Document tool schemas

- [ ] Document harness configuration options

* * *

## Validation Stage

### Test Coverage Requirements

Per [TDD Guidelines](../../../general/agent-guidelines/general-tdd-guidelines.md):

- **Unit tests**: Fast, focused tests for business logic (no network/web)

- **Integration tests**: Exercise multiple components with mocked externals

- **Golden tests**: Fine-grained behavior checks across known scenarios

### Test Matrix

| Test Type | Simple Form | Complex Form |
| --- | --- | --- |
| Parse/serialize round-trip | Phase 1 | Phase 3 |
| Validation rules | Phase 1 | Phase 3 |
| Patch operations | Phase 1 | Phase 3 |
| CLI commands | Phase 2 | Phase 3 |
| Golden session replay | Phase 3 | Phase 3 |
| AI SDK integration | Phase 4 | Phase 4 |

### Automated Test Checklist (Agent Runs)

These tests are run by the coding agent and must all pass:

- [ ] All unit tests pass (`pnpm test`)

- [ ] All integration tests pass

- [ ] `pnpm lint` passes

- [ ] `pnpm typecheck` passes

- [ ] `pnpm build` succeeds

- [ ] `pnpm publint` passes

- [ ] `markform inspect` outputs valid YAML for both forms

- [ ] `markform export --json` outputs valid JSON

- [ ] `markform apply` with valid patches succeeds

- [ ] `markform apply` with invalid patches rejects batch

- [ ] `markform run --mock` completes for both forms

- [ ] Golden session replay passes for `simple.session.yaml`

- [ ] Golden session replay passes for `company-quarterly-analysis.session.yaml`

### Manual Test Checklist (User Verifies)

These tests require human interaction.
Agent should pause and ask user to verify:

**Phase 2 - Web UI**:

- [ ] `markform serve` renders simple form correctly in browser

- [ ] All field groups, fields, and doc blocks display properly

- [ ] Save button works with versioned filename dialog

- [ ] Saved file is valid (can be re-opened)

**Phase 4 - AI Integration**:

- [ ] Live AI agent fills simple form successfully

- [ ] Live AI agent fills complex form successfully

- [ ] Agent handles validation errors gracefully (retries with fixes)

- [ ] Session transcript is readable and accurate

- [ ] Final forms are correctly and completely filled

### Definition of Done

1. Both test forms created and validated:

   - `examples/simple/simple.form.md` + mock (already done)

   - `examples/company-quarterly-analysis/company-quarterly-analysis.form.md` + mock +
     validators

2. Run and verify with simple form:

   - `markform inspect examples/simple/simple.form.md`

   - `markform serve examples/simple/simple.form.md`

   - `markform run --mock --completed-mock <mock> --record <session>`

3. Run and verify with complex form:

   - `markform inspect
     examples/company-quarterly-analysis/company-quarterly-analysis.form.md`

   - `markform run --mock` with code validators

4. Golden session tests pass:

   - Replay session transcripts for both forms

   - Confirm same patches applied, same digests after each turn

   - Final completed forms match expected files exactly

5. All CI checks pass:

   - `pnpm lint`

   - `pnpm typecheck`

   - `pnpm build`

   - `pnpm publint`

   - `pnpm test`
