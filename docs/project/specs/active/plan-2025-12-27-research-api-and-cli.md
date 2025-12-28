# Plan Spec: Research API and CLI Command

## Purpose

This spec designs a complete “research workflow” for markform that enables agent-driven
research tasks with web search capabilities.
The feature includes:

1. A programmatic Research API for executing research forms end-to-end

2. A `markform research` CLI command for validating and executing research forms

3. Model validation to ensure web search is available before execution

## Background

### Current State

Markform currently supports:

- **Fill command** (`markform fill`): Runs agents to fill forms, supports
  `--interactive` for user fields and `--model` for agent fields

- **Examples command** (`markform examples`): Interactive scaffolding and filling
  workflow

- **Programmatic API** (`fillForm()`): Single-function entry point for form filling

The existing system uses a harness loop pattern with LiveAgent that supports web search
for OpenAI, Google, and xAI providers.
However, there’s no dedicated workflow for “research forms” that:

1. Validate the form has the right structure for research (user inputs → agent research)

2. Require web search capabilities

3. Provide a streamlined end-to-end execution

### What is a Research Form?

A “research form” is a markform document designed for agent research tasks:

- **User-role fields at the beginning**: Define the research problem (e.g., company
  name, topic, specific questions)

- **Agent-role fields**: Research tasks to be completed using web search (e.g., gather
  facts, analyze data, compile sources)

- **Later fields can depend on previous fields**: Research builds on gathered context

Examples in the codebase:

- `examples/startup-deep-research/startup-deep-research.form.md`

- `examples/political-research/political-research.form.md`

## Summary of Task

### 1. Research API

Create `runResearch()` function in a new `src/research/` module that:

- Accepts form as string (for API use) or ParsedForm

- Validates form is a valid research form

- Validates model supports web search (fail fast)

- Executes the research workflow end-to-end

- Returns structured result with markdown, values, and status

### 2. File I/O Helpers

Create helper functions for file-based workflows:

- `runResearchFromFile()` for reading form from disk and writing results

- Support multiple output formats (form, raw markdown, YAML values)

### 3. CLI Command

Add `markform research <file>` command that:

- Validates form structure (has user + agent roles, required fields)

- Validates model has web search capability

- Prompts for user-role field values interactively

- Executes agent research with web search

- Exports results in multiple formats

### 4. Web Search Model Validation

- Add `requiresWebSearch` option to model resolution

- Export list of web-search-capable providers

- Fail fast with clear error message if model lacks web search

## Backward Compatibility

**BACKWARD COMPATIBILITY REQUIREMENTS:**

- **Code types, methods, and function signatures**: DO NOT MAINTAIN - This is a new
  feature, no existing APIs change

- **Library APIs**: KEEP DEPRECATED for FillOptions/FillResult - the new ResearchOptions
  should be a superset that extends the existing pattern

- **Server APIs**: N/A

- **File formats**: DO NOT MAINTAIN - Research forms follow standard markform format

- **Database schemas**: N/A

## Stage 1: Planning Stage

### Feature Requirements

**Must Have:**

1. **Research API** (`runResearch()`):

   - Accept form as string or ParsedForm

   - Accept model ID (string only for now, must be web-search-capable)

   - Accept inputContext for pre-filling user fields

   - Run harness loop with web search enabled

   - Return ResearchResult with status, markdown, values, turns, etc.

2. **Form Validation**:

   - Validate form has `roles` including both ‘user’ and ‘agent’

   - Validate at least one user-role field exists

   - Validate at least one agent-role field exists

   - Validation should be a separate function for reuse

3. **Model Validation**:

   - Check model provider supports web search before execution

   - Fail fast with clear error: “Model X does not support web search.
     Use one of: ...”

   - Web-search-capable providers: openai, google, xai

4. **CLI Command** (`markform research <file>`):

   - `--model=<id>`: Required, web-search-capable model

   - `-o, --output=<file>`: Output file path

   - `--initial-values=<file>`: JSON/YAML file with initial field values

   - `-- field=value ...`: Inline field values after `--` separator

   - `--interactive` / `-i`: Prompt for missing user fields

   - `--roles=<roles>`: Target roles (default: ‘agent’ or ‘*’ for all)

   - Standard harness options: `--max-turns`, `--max-patches`, etc.

   - Value resolution order: form defaults → file → inline → interactive

5. **File I/O at CLI Layer**:

   - File reading/writing handled in CLI command, not core API

   - Follows `fillForm()` pattern: core API works with strings

   - Reuse existing `exportMultiFormat()` for output

6. **Frontmatter Harness Configuration**:

   - Forms can specify harness config in YAML frontmatter under `markform.harness`

   - Supported settings: `max_issues_per_turn`, `max_fields_per_turn`,
     `max_groups_per_turn`, `max_patches_per_turn`, `max_turns`

   - Research workflow uses different defaults than general fill (3 issues per turn)

   - Override hierarchy: built-in defaults → frontmatter → CLI flags

   - Shared logic between `fill` and `research` commands for parsing/merging config

7. **Naming Convention Cleanup** (engineering prerequisite):

   - Rename `maxIssues` → `maxIssuesPerTurn` for consistency with other per-turn limits

   - All per-turn limits use `*PerTurn` suffix in TypeScript, `*_per_turn` in YAML

   - Total limits (like `maxTurns`) have no suffix

   - CLI flags stay short for convenience: `--max-issues`, `--max-fields`, etc.

**Not in Scope:**

- MCP server integration (future work)

- Custom external search tools (Tavily, etc.)
  for anthropic

- Streaming results/progress callbacks (use existing onTurnComplete)

- Research form template generation/scaffolding

### Acceptance Criteria

1. `runResearch()` API works with string form input and returns complete result

2. `markform research simple.form.md --model openai/gpt-4o` executes successfully

3. Running with anthropic model fails fast with clear error about web search

4. Research forms without user-role fields are rejected with validation error

5. Output files are written in requested formats

6. **Harness config override hierarchy works correctly:**

   - Without frontmatter or CLI: uses research defaults (3 issues per turn)

   - With frontmatter `harness.max_issues_per_turn: 5`: uses 5 issues per turn

   - With frontmatter AND CLI `--max-issues 10`: CLI wins, uses 10 issues per turn

7. Frontmatter harness config is parsed and validated at form parse time

8. **Examples command detects and handles research forms correctly:**

   - `markform examples --name startup-deep-research` → prompts for user fields, then
     prompts for web-search-capable model only, uses research defaults

   - `markform examples --name simple` → prompts for user fields, then prompts for any
     model, uses standard fill defaults

9. Research forms in examples only show web-search-capable models in model picker

### Questions Resolved

- **Q: Should research require interactive prompting for user fields?** A: No, make it
  optional via `--interactive`. User fields can be pre-filled via `inputContext` for
  programmatic use.

- **Q: How to handle forms that don’t have user/agent role definitions?** A: Treat as
  validation error. Research workflow requires explicit roles.

- **Q: Should we add a new file extension like `.research.form.md`?** A: No, stick with
  standard `.form.md`. The research validation is opt-in when using the research
  command/API.

### Example Form Review: `startup-deep-research.form.md`

**Validation against research form criteria:**

| Criterion | Status | Details |
| --- | --- | --- |
| Roles defined | ✓ | `roles: [user, agent]` in frontmatter |
| User fields first | ✓ | `company_name`, `additional_context` (lines 31, 37) |
| Agent fields after | ✓ | All fields from line 55+ |
| No interleaving | ✓ | Clean separation by field group |
| Min 1 user field | ✓ | 2 user fields |
| Min 1 agent field | ✓ | 60+ agent fields |

**Form is valid per our criteria.** No changes needed to validation rules.

**Suggested improvements to the example form:**

1. **Add explicit `role="agent"` to some fields** - Currently all agent fields rely on
   default. For teaching purposes, explicitly mark at least the first few agent fields:
   ```
   {% string-field id="website" label="Website URL" role="agent" %}
   ```

2. **Add `harness` configuration** to demonstrate the new frontmatter feature:
   ```yaml
   markform:
     spec: MF/0.1
     roles:
       - user
       - agent
     harness:
       max_issues_per_turn: 3
   ```

3. **Review `required=true` on agent fields** - The `research_date` field (line 390) is
   required. This is fine since the agent should fill it with the current date, but
   document this pattern: required agent fields must have values the agent can determine
   without user input.

4. **Consider grouping pattern** - The form nicely separates user input into its own
   group (`user_input`). This is a good pattern to document: user-role fields should be
   in dedicated group(s) at the top.

**Implementation tasks for example improvements:**

- [ ] Add `harness.max_issues_per_turn: 3` to frontmatter

- [ ] Add explicit `role="agent"` to first few agent fields as teaching example

- [ ] Add comment in form description about the user→agent field order requirement

### Example Form Review: `celebrity-deep-research.form.md`

**Validation:** ✓ Valid research form (same structure as startup-deep-research)

**Positive patterns to preserve:**

1. **Good `{% documentation %}` block** (lines 33-56) - Provides research approach,
   source priority ranking, and table format conventions upfront.
   Other research forms should follow this pattern.

2. **Consistent instruction format** - Uses “Format:” and “Source:” consistently.

3. **Well-organized field groups** - 17 logical sections from biography to trivia.

4. **Handles edge cases** - “For Deceased Celebrities” section only filled if
   applicable.

**Suggested improvements:**

1. **Add `harness` configuration:**
   ```yaml
   harness:
     max_issues_per_turn: 3
   ```

2. **Add explicit `role="agent"` to first agent fields** for teaching:
   ```
   {% string-field id="full_legal_name" label="Full Legal Name" role="agent" %}
   ```

3. **Add `priority` attributes for optional deep-dive fields:**

   - Fields in “Specialized Sources” section → `priority="low"`

   - Helps agent prioritize core biographical data first

4. **Consolidate table format instructions:**

   - The documentation block defines table format once

   - But each table field repeats the format - consider referencing documentation

5. **Review form length (839 lines):**

   - Appropriate for “deep research” but long for single session

   - Consider adding `priority="low"` to sections 15-17 (Specialized, Deceased, Trivia)

   - Document that form may require multiple research sessions

6. **Minor: Add note about required agent fields:**

   - `stage_name`, `primary_profession`, `sources_consulted`, `research_date` are
     required

   - All are determinable by agent - this is the right pattern

7. **Add `sources_urls` field at the end of each field group:**

   Each field group should end with a URL list field for citations specific to that
   section. This consolidates source tracking and makes verification easier.

   ```
   {% string-list id="core_biography_sources" label="Core Bio Sources" %}{% /string-list %}
   
   {% instructions ref="core_biography_sources" %}
   URLs used as sources for this section. One URL per line.
   {% /instructions %}
   
   {% /field-group %}
   ```

   Benefits:

   - Consolidates source tracking per section (vs scattered in each field)

   - Makes verification of claims easier

   - Reduces repetition of “Source: ...” in individual instructions

   - Agent can batch-add sources after completing section

   - Final `research_metadata` section can aggregate or cross-reference

   Pattern for field ID: `{group_id}_sources` (e.g., `core_biography_sources`,
   `family_relationships_sources`, `financial_business_sources`)

**Best practices for research forms:**

1. The `{% documentation %}` block at form level sets expectations for source hierarchy
   and formatting. All research forms should include this.

2. Each field group should end with a `*_sources` URL list field for section citations.

3. Frontmatter ordering for clarity:

   - `spec`, `roles`, `role_instructions`, then `harness`

   - This makes human intent and role guidance visible before harness constraints.

4. Sources field labels should be descriptive, not generic:

   - Prefer labels like “Core Bio Sources”, “Filmography Sources”, “Press Coverage
     Sources”

   - Avoid “Section Source URLs”.

5. ID naming for sources fields:

   - Prefer `{group_id}_sources` unless the group id itself ends with `_sources`

   - In that case, use `{group_id}_urls` to avoid duplication (e.g.,
     `specialized_sources_urls`).

## Stage 2: Architecture Stage

### Component Overview

```
src/research/ # NEW: Application-layer research module ├── research.ts # Research API
(runResearch, runResearchFromFile) ├── researchTypes.ts # Research-specific types ├──
researchFormValidation.ts # Form structure validation for research workflow └── index.ts
\# Public exports

src/harness/ # EXISTING: Core execution infrastructure (no changes) ├── harness.ts #
FormHarness ├── liveAgent.ts # LiveAgent with web search ├── programmaticFill.ts #
fillForm() └── harnessTypes.ts # Core types

src/cli/ ├── commands/ │ ├── research.ts # NEW: CLI command │ └── fill.ts # Update: Use
shared config resolver └── lib/ ├── harnessConfigResolver.ts # NEW: Shared harness
config resolution ├── initialValues.ts # NEW: Parse --initial-values and -- field=value
└── ...existing files

src/llms.ts # NEW: Consolidated LLM settings (from settings.ts)

src/settings.ts # Update: Remove LLM section, add research defaults

src/engine/coreTypes.ts # Update: Add FrontmatterHarnessConfig type
```

**Why a separate module?**

The `harness/` module is core execution infrastructure - it provides the form filling
loop, agent abstractions, and programmatic API. The research workflow is an
application-layer feature built ON TOP of that infrastructure:

- `research/` imports from `harness/` (not vice versa)

- `research/` adds domain-specific validation and workflow logic

- This separation keeps the core harness simple and reusable

- Future application workflows (e.g., analysis, summarization) can follow the same
  pattern

### API Design

#### LLM Settings (`src/llms.ts`)

```typescript
/**
 * Consolidated LLM configuration and utilities.
 * Single source of truth for model suggestions and web search support.
 */

/**
 * Suggested LLM models for form filling, organized by provider.
 * Shown in help/error messages.
 */
export const SUGGESTED_LLMS: Record<string, string[]>;

/**
 * Format suggested LLMs for display in help/error messages.
 */
export function formatSuggestedLlms(): string;

/**
 * Web search support configuration by provider.
 */
export interface WebSearchConfig {
  /** Whether the provider has native web search */
  supported: boolean;
  /** Tool name for web search (provider-specific) */
  toolName?: string;
  /** Package export name for the web search tool */
  exportName?: string;
}

/**
 * Web search configuration per provider.
 */
export const WEB_SEARCH_CONFIG: Record<string, WebSearchConfig>;

/**
 * Check if a provider supports native web search.
 */
export function hasWebSearchSupport(provider: string): boolean;

/**
 * Get web search tool configuration for a provider.
 * Returns undefined if provider doesn't support web search.
 */
export function getWebSearchConfig(provider: string): WebSearchConfig | undefined;

// === NEW HELPERS FOR RESEARCH ===

/**
 * Get list of providers that support web search.
 */
export function getWebSearchProviders(): string[];

/**
 * Format web-search-capable models for error messages.
 * Example output:
 *   "Use a model with web search: openai/gpt-4o, google/gemini-2.0-flash, xai/grok-4"
 */
export function formatWebSearchModels(): string;

/**
 * Check if a full model ID (provider/model) supports web search.
 * Parses the provider from the model ID and checks WEB_SEARCH_CONFIG.
 */
export function isWebSearchModel(modelId: string): boolean;

/**
 * Get suggested models for a specific provider.
 */
export function getSuggestedModels(provider: string): string[];
```

#### Research Types (`research/researchTypes.ts`)

```typescript
/**
 * Options for the runResearch function.
 * 
 * Naming convention for limits:
 * - Total limits: no suffix (maxTurns)
 * - Per-turn limits: PerTurn suffix (maxIssuesPerTurn, maxPatchesPerTurn, etc.)
 */
export interface ResearchOptions {
  /** Form content as markdown string or parsed form */
  form: string | ParsedForm;
  /** Model identifier (must support web search) */
  model: string;
  /**
   * Pre-fill fields by ID. CLI populates this from:
   * 1. --initial-values=file.json/yml
   * 2. -- field=value pairs
   * Values are merged (later overrides earlier).
   */
  inputContext?: InputContext;
  /** Additional context for agent prompt */
  systemPromptAddition?: string;
  /** Maximum harness turns (default: 100) */
  maxTurns?: number;
  /** Maximum issues per turn (default: 3 for research) */
  maxIssuesPerTurn?: number;
  /** Maximum patches per turn (default: 20) */
  maxPatchesPerTurn?: number;
  /** Maximum unique fields per turn */
  maxFieldsPerTurn?: number;
  /** Maximum unique groups per turn */
  maxGroupsPerTurn?: number;
  /** Target roles to fill (default: ['agent']) */
  targetRoles?: string[];
  /** Fill mode: 'continue' or 'overwrite' */
  fillMode?: FillMode;
  /** Progress callback */
  onTurnComplete?: (progress: TurnProgress) => void;
  /** Cancellation signal */
  signal?: AbortSignal;
  /** Skip research form validation (for testing) */
  skipValidation?: boolean;
}

/**
 * Result of research execution.
 * Extends FillResult with research-specific info.
 */
export interface ResearchResult extends FillResult {
  /** Was the form validated as a research form */
  researchFormValid: boolean;
  /** Model used for research */
  modelId: string;
  /** Whether web search was used */
  webSearchUsed: boolean;
}

// ResearchFormValidation is defined in researchFormValidation.ts
// Re-exported here for convenience
export type { ResearchFormValidation } from './researchFormValidation.js';
```

#### Frontmatter Harness Config (`engine/coreTypes.ts` - update)

```typescript
/**
 * Harness configuration that can be specified in form frontmatter.
 * All fields are optional - unspecified fields use workflow defaults.
 * 
 * YAML location: markform.harness
 * 
 * Naming convention:
 * - Total limits: no suffix (max_turns)
 * - Per-turn limits: _per_turn suffix (max_issues_per_turn, max_fields_per_turn, etc.)
 */
export interface FrontmatterHarnessConfig {
  /** Maximum turns before stopping (total limit) */
  max_turns?: number;
  /** Maximum issues to show per turn */
  max_issues_per_turn?: number;
  /** Maximum unique fields per turn */
  max_fields_per_turn?: number;
  /** Maximum unique groups per turn */
  max_groups_per_turn?: number;
  /** Maximum patches per turn */
  max_patches_per_turn?: number;
}

/**
 * Extended form metadata including harness config.
 */
export interface FormMetadata {
  /** Markform spec version (e.g., "MF/0.1") */
  markformVersion: string;
  /** Defined roles for this form */
  roles: string[];
  /** Instructions per role */
  roleInstructions: Record<string, string>;
  /** Optional harness configuration from frontmatter */
  harness?: FrontmatterHarnessConfig;
}
```

**YAML Frontmatter Example:**

```yaml
---
markform:
  spec: MF/0.1
  roles:
    - user
    - agent
  harness:
    max_issues_per_turn: 5
    max_fields_per_turn: 3
    max_groups_per_turn: 2
---
```

#### Harness Defaults (`settings.ts` - update)

```typescript
// =============================================================================
// Harness Defaults
// =============================================================================
// Naming convention:
// - Total limits: DEFAULT_MAX_* (no suffix)
// - Per-turn limits: DEFAULT_MAX_*_PER_TURN

/**
 * Default maximum turns for the fill harness (total limit).
 * Prevents runaway loops during agent execution.
 */
export const DEFAULT_MAX_TURNS = 100;

/**
 * Default maximum patches per turn.
 */
export const DEFAULT_MAX_PATCHES_PER_TURN = 20;

/**
 * Default maximum issues to show per turn (general form filling).
 * Note: Renamed from DEFAULT_MAX_ISSUES for naming consistency.
 */
export const DEFAULT_MAX_ISSUES_PER_TURN = 10;

/**
 * Default maximum issues per turn for research workflow.
 * Research uses fewer issues per turn to encourage focused, deep research
 * on individual fields before moving to the next.
 */
export const RESEARCH_DEFAULT_MAX_ISSUES_PER_TURN = 3;

/**
 * Research forms focus on one field group at a time to avoid overwhelming
 * the agent with too much context.
 */
export const RESEARCH_DEFAULT_MAX_GROUPS_PER_TURN = 1;
```

#### Harness Config Resolution (`cli/lib/harnessConfigResolver.ts` - new)

```typescript
import {
  DEFAULT_MAX_ISSUES_PER_TURN,
  DEFAULT_MAX_PATCHES_PER_TURN,
  DEFAULT_MAX_TURNS,
  RESEARCH_DEFAULT_MAX_ISSUES_PER_TURN,
  RESEARCH_DEFAULT_MAX_GROUPS_PER_TURN,
} from '../../settings.js';

/**
 * Default harness configuration for general form filling.
 * 
 * Naming: TypeScript uses camelCase with PerTurn suffix for per-turn limits.
 */
export const FILL_DEFAULTS: Partial<HarnessConfig> = {
  maxTurns: DEFAULT_MAX_TURNS,                     // 100 (total limit)
  maxIssuesPerTurn: DEFAULT_MAX_ISSUES_PER_TURN,   // 10
  maxPatchesPerTurn: DEFAULT_MAX_PATCHES_PER_TURN, // 20
  // No limits on fields/groups per turn
};

/**
 * Default harness configuration for research workflow.
 * Research uses fewer issues per turn to encourage focused, deep research.
 */
export const RESEARCH_DEFAULTS: Partial<HarnessConfig> = {
  maxTurns: DEFAULT_MAX_TURNS,                             // 100
  maxIssuesPerTurn: RESEARCH_DEFAULT_MAX_ISSUES_PER_TURN,  // 3
  maxPatchesPerTurn: DEFAULT_MAX_PATCHES_PER_TURN,         // 20
  maxGroupsPerTurn: RESEARCH_DEFAULT_MAX_GROUPS_PER_TURN,  // 1 - focus on one section at a time
};

/**
 * Resolve harness configuration with override hierarchy:
 * 1. Built-in defaults (workflow-specific)
 * 2. Form frontmatter (markform.harness)
 * 3. CLI options (highest priority)
 * 
 * @param workflow - 'fill' or 'research' for workflow-specific defaults
 * @param frontmatter - Harness config from form frontmatter (optional)
 * @param cliOptions - Harness config from CLI flags (optional)
 * @returns Merged HarnessConfig
 */
export function resolveHarnessConfig(
  workflow: 'fill' | 'research',
  frontmatter?: FrontmatterHarnessConfig,
  cliOptions?: Partial<HarnessConfig>,
): HarnessConfig;

/**
 * Convert frontmatter snake_case keys to HarnessConfig camelCase.
 */
export function frontmatterToHarnessConfig(
  fm: FrontmatterHarnessConfig,
): Partial<HarnessConfig>;
```

**Override Hierarchy:**

```
┌─────────────────────────────────────────────────────────────────┐
│  CLI Flags (highest priority)                                   │
│  --max-issues 10 --max-fields 5                                 │
│  (short names for convenience, maps to *PerTurn internally)     │
├─────────────────────────────────────────────────────────────────┤
│  Form Frontmatter (snake_case with _per_turn suffix)            │
│  markform.harness.max_issues_per_turn: 5                        │
├─────────────────────────────────────────────────────────────────┤
│  Workflow Defaults (camelCase with PerTurn suffix)              │
│  RESEARCH_DEFAULTS.maxIssuesPerTurn: 3                          │
│  RESEARCH_DEFAULTS.maxGroupsPerTurn: 1                          │
│  FILL_DEFAULTS.maxIssuesPerTurn: 10                             │
└─────────────────────────────────────────────────────────────────┘
```

**Naming Convention Summary:**

| Layer | Format | Example |
| --- | --- | --- |
| Constants | `SCREAMING_SNAKE_CASE` | `DEFAULT_MAX_ISSUES_PER_TURN` |
| TypeScript | `camelCase` + `PerTurn` suffix | `maxIssuesPerTurn` |
| YAML frontmatter | `snake_case` + `_per_turn` suffix | `max_issues_per_turn` |
| CLI flags | short form (no suffix) | `--max-issues` |

#### Research Form Definition

A **research form** is a Markform document structured for agent-driven research:

1. **User fields define the research problem** (at the top)

2. **Agent fields perform the research tasks** (after all user fields)

**Structural Requirements:**

| Requirement | Description |
| --- | --- |
| **Roles defined** | Frontmatter must include `roles: [user, agent]` |
| **User fields first** | All user-role fields must appear before any agent-role fields |
| **No interleaving** | Cannot have agent fields, then user fields, then agent fields |
| **At least one of each** | Minimum 1 user-role field and 1 agent-role field |
| **Default role is agent** | Fields without explicit `role` attribute are agent-role |

**Valid Research Form Structure:**

```
┌─────────────────────────────────────┐
│  Frontmatter (roles: user, agent)   │
├─────────────────────────────────────┤
│  User Fields (1+)                   │  ← Define research problem
│  - company_name (role=user)         │
│  - additional_context (role=user)   │
├─────────────────────────────────────┤
│  Agent Fields (1+)                  │  ← Research tasks
│  - website (role=agent or default)  │
│  - funding_info (role=agent)        │
│  - competitors (role=agent)         │
│  - ...                              │
└─────────────────────────────────────┘
```

**Invalid Structures (rejected with clear error):**

```
✗ User fields in the middle:
  [agent] → [user] → [agent]
  Error: "User fields must appear before agent fields"

✗ No user fields:
  [agent] → [agent] → [agent]
  Error: "Research forms require at least one user-role field"

✗ No agent fields:
  [user] → [user]
  Error: "Research forms require at least one agent-role field"

✗ Missing role definitions:
  Frontmatter without roles: [user, agent]
  Error: "Research forms require explicit user and agent roles"
```

#### Research Form Validation (`research/researchFormValidation.ts`)

```typescript
/**
 * Research form validation result.
 * 
 * Contains validation status plus metrics for diagnostics and error messages.
 */
export interface ResearchFormValidation {
  /** Whether the form is a valid research form */
  valid: boolean;
  /** Validation errors (if invalid) */
  errors: string[];
  /** Non-fatal warnings */
  warnings: string[];
  /** Whether form has user-role fields */
  hasUserFields: boolean;
  /** Whether form has agent-role fields */
  hasAgentFields: boolean;
  /** Count of user-role fields */
  userFieldCount: number;
  /** Count of agent-role fields */
  agentFieldCount: number;
  /** Index of last user field in orderIndex (-1 if none) */
  lastUserFieldIndex: number;
  /** Index of first agent field in orderIndex (-1 if none) */
  firstAgentFieldIndex: number;
}

/**
 * Validate that a form is structured for research.
 * 
 * Checks:
 * 1. Frontmatter includes both 'user' and 'agent' roles
 * 2. At least one user-role field exists
 * 3. At least one agent-role field exists
 * 4. All user-role fields come before all agent-role fields (no interleaving)
 * 
 * Fields without explicit role attribute are treated as agent-role.
 */
export function validateResearchForm(form: ParsedForm): ResearchFormValidation;

/**
 * Quick check if a form appears to be a research form.
 * Returns true if form has both user and agent role fields in correct order.
 * Does not return detailed errors - use validateResearchForm() for that.
 */
export function isResearchForm(form: ParsedForm): boolean;
```

**Implementation Notes:**

- Use `form.orderIndex` to check field order (preserves document order)

- Check `field.role` attribute, defaulting to ‘agent’ if not specified

- `lastUserFieldIndex < firstAgentFieldIndex` ensures no interleaving

- Return clear, actionable error messages

#### Research API (`research/research.ts`)

```typescript
/**
 * Run research on a form using a web-search-capable model.
 * 
 * This is the primary programmatic entry point for research workflows.
 * It validates the form structure, validates the model supports web search,
 * and executes the fill workflow with web search enabled.
 * 
 * API design follows fillForm() pattern:
 * - Core API works with strings/ParsedForm (no file I/O)
 * - File I/O is handled at CLI layer using shared helpers
 * - This keeps the API simple and testable
 */
export async function runResearch(options: ResearchOptions): Promise<ResearchResult>;
```

#### Settings Updates (`settings.ts`)

```typescript
/**
 * Providers that support native web search.
 */
export const WEB_SEARCH_PROVIDERS: readonly string[] = ['openai', 'google', 'xai'];

/**
 * Check if a provider supports web search.
 */
export function hasWebSearchSupport(provider: string): boolean;

/**
 * Get list of suggested models with web search support.
 */
export function getWebSearchModels(): Record<string, string[]>;

/**
 * Format web search models for display in error messages.
 */
export function formatWebSearchModels(): string;
```

### CLI Design

```
markform research <file> [options] [-- field=value ...]

Arguments:
  file                       Path to research form (.form.md)

Options:
  --model=<id>               Model ID (required, must support web search)
  -o, --output=<file>        Output file path
  --initial-values=<file>    JSON/YAML file with initial field values
  -i, --interactive          Prompt for user-role fields interactively
  --max-turns=<n>            Maximum turns (default: 100)
  --max-patches=<n>          Maximum patches per turn (default: 20)
  --max-issues=<n>           Maximum issues per step (default: 10)
  --roles=<roles>            Target roles to fill (default: agent)
  --mode=<mode>              Fill mode: continue or overwrite
  --verbose                  Verbose output
  --quiet                    Minimal output
  --dry-run                  Validate without executing

Field Values:
  Field values can be provided in three ways (later overrides earlier):
  1. --initial-values=file.json or file.yml (JSON/YAML file)
  2. -- field=value field2=value2 (inline after --)
  3. -i/--interactive (prompts for missing user fields)

  The -- separator marks the end of options; everything after is field=value pairs.
  Values are split on first = only, so values can contain = characters.
  Shell quoting rules apply: use quotes for values with spaces.

Examples:
  # Inline field values (most common for quick use)
  markform research celebrity.form.md --model=openai/gpt-4o \
    -- celebrity_name="Leonard Cohen" disambiguation="Canadian singer-songwriter"

  # From JSON/YAML file (for scripting or complex values)
  markform research startup.form.md --model=openai/gpt-4o \
    --initial-values=inputs.json

  # Combined: file provides defaults, inline overrides
  markform research startup.form.md --model=openai/gpt-4o \
    --initial-values=defaults.yml -- company_name="Acme Corp"

  # Interactive mode prompts for any missing user fields
  markform research startup.form.md --model=google/gemini-2.0-flash -i

  # Specify output location
  markform research startup.form.md --model=xai/grok-4 -o=results/
```

#### Initial Values File Format

JSON and YAML are both supported (YAML parser handles JSON transparently):

```yaml
# inputs.yml
celebrity_name: Leonard Cohen
disambiguation: Canadian singer-songwriter, poet, 1960s-2010s
```

```json
{
  "celebrity_name": "Leonard Cohen",
  "disambiguation": "Canadian singer-songwriter, poet, 1960s-2010s"
}
```

#### Field Value Resolution Order

Values are merged with later sources overriding earlier:

1. **Form defaults** (from field `default` attribute if any)

2. **--initial-values file** (JSON/YAML)

3. **Inline `-- field=value`** pairs

4. **Interactive prompts** (if `-i` flag, prompts for still-empty required user fields)

### Error Messages

```
Error: Model "anthropic/claude-sonnet-4-5" does not support web search.

Research forms require web search capabilities for accurate results.
Use one of these web-search-enabled models:

  openai/gpt-5-mini, gpt-5-nano, gpt-5.1, ...
  google/gemini-2.5-pro, gemini-2.5-flash, ...
  xai/grok-4, grok-4-fast
```

```
Error: Form is not structured for research.

Research forms require:
  ✗ Roles must include 'user' and 'agent' (found: ['agent'])
  ✓ At least one user-role field
  ✓ At least one agent-role field
```

### Data Flow

```
User Input                      Research API                    Output
───────────                     ────────────                    ──────
                                     │
Form String ──────────────────> parseForm()
or ParsedForm                        │
                                     ▼
                            validateResearchForm()
                                     │
Model ID ─────────────────────> validateWebSearch()
                                     │
                                     ▼
                            resolveModel() ─────────> LanguageModel
                                     │
                                     ▼
                            resolveHarnessConfig() ──────────────────────┐
                                     │                                   │
                  ┌──────────────────┼──────────────────┐                │
                  │                  │                  │                │
            RESEARCH_DEFAULTS   frontmatter.harness   CLI options        │
                  │                  │                  │                │
                  └─────────> merge (last wins) <──────┘                 │
                                     │                                   │
                                     ▼                                   │
InputContext ─────────────────> coerceInputContext()                     │
(user values)                        │                                   │
                                     ▼                                   │
                            createHarness(resolvedConfig) <──────────────┘
                                     + createLiveAgent()
                                     │
                            ┌────────┴────────┐
                            │  Harness Loop   │
                            │  step() → apply │
                            │   (with web     │
                            │    search)      │
                            └────────┬────────┘
                                     │
                                     ▼
                            buildResult() ────────> ResearchResult
                                                             │
                                                             ├─> markdown (string)
                                                             ├─> values (Record)
                                                             └─> status

                                  CLI layer (if using `markform research` command)
                                       │
                                       ▼
                              exportMultiFormat() ───> .form.md, .raw.md, .yml
```

## Stage 3: Refine Architecture

### Reusable Components Found

1. **`fillForm()` in `programmaticFill.ts`**:

   - Already handles form parsing, model resolution, harness loop

   - Research API will delegate to this after validation

   - No need to duplicate the harness loop logic

2. **`resolveModel()` in `modelResolver.ts`**:

   - Already does provider detection and API key validation

   - Can add optional `requireWebSearch` parameter

3. **`exportMultiFormat()` in `cli/lib/exportHelpers.ts`**:

   - Already handles writing form, raw, and YAML outputs

   - Perfect for file-based research output

4. **`runInteractiveFill()` in `cli/lib/interactivePrompts.ts`**:

   - Already handles interactive user field prompting

   - Reuse for CLI `--interactive` mode

5. **`hasWebSearchSupport()` in `settings.ts`**:

   - Already exists! Just need to export and use it

6. **`WEB_SEARCH_CONFIG` in `settings.ts`**:

   - Already defines which providers support web search

   - Just need to derive the suggested models list

### Simplifications

1. **Delegate to `fillForm()`**: The `runResearch()` function should:

   - Validate research form structure

   - Validate web search capability

   - Call `fillForm()` with appropriate options

   - Wrap result with research-specific metadata

2. **Reuse LiveAgent**: No changes needed to LiveAgent - it already supports web search
   when provider is detected

3. **CLI shares logic with `fill` command**: Extract shared option parsing into helper

### Integration with `examples` Command

The `examples` command should detect research forms and use the research workflow:

**Behavior by Form Type:**

| Form Type | User Fields | Agent Fields | Model Requirement | Workflow |
| --- | --- | --- | --- | --- |
| **Research Form** | ✓ (define problem) | ✓ (research tasks) | Web search required | Research workflow |
| **Standard Form** | ✓ or ○ | ✓ or ○ | Any model | Standard fill workflow |

**Detection:**

- Use `validateResearchForm()` to check if a form is a research form

- Research forms have both user-role and agent-role fields with structured roles

**Example Registry Updates:**

```typescript
// cli/lib/cliTypes.ts
/**
 * Definition of an example form for the examples command.
 */
export interface ExampleDefinition {
  /** Machine-readable identifier (e.g., 'simple', 'startup-deep-research') */
  id: string;
  /** Human-readable title for menu display */
  title: string;
  /** One-line description of the example */
  description: string;
  /** Default output filename (e.g., 'simple.form.md') */
  filename: string;
  /** Relative path within examples directory */
  path: string;
  /** Form type: 'research' uses research workflow with web search */
  type?: 'standard' | 'research';
}

// cli/examples/exampleRegistry.ts
export const EXAMPLE_DEFINITIONS: ExampleDefinition[] = [
  {
    id: 'simple',
    title: 'Simple Test Form',
    type: 'standard',  // Interactive fill only
    ...
  },
  {
    id: 'startup-deep-research',
    title: 'Startup Deep Research',
    type: 'research',  // Uses research workflow with web search
    ...
  },
];
```

**Updated `examples` Command Flow:**

```
1. Select example form (with type indicators)
2. Scaffold to versioned filename
3. Check form type (from registry or auto-detect via validateResearchForm)

IF research form:
  4a. Prompt for user-role fields interactively
  5a. Prompt for model (show only web-search-capable models)
  6a. Run research workflow with RESEARCH_DEFAULTS (3 issues/turn, 1 group/turn)
  7a. Export results

ELSE (standard form):
  4b. Prompt for user-role fields interactively (if any)
  5b. Prompt for model (any model)
  6b. Run standard fill with FILL_DEFAULTS (10 issues/turn)
  7b. Export results
```

**Example Selection Menu UI:**

The interactive menu should clearly distinguish form types:

```
Select an example form to scaffold:

  ○ Simple Test Form                    [interactive]
    User and agent roles for testing...

  ○ Political Research                  [research]
    Biographical research with web search...

  ○ Company Quarterly Analysis          [research]
    Financial analysis with web search...

  ○ Startup Deep Research               [research]
    Comprehensive startup intelligence...
```

- `[interactive]` - Standard forms: user fills fields interactively, then optionally
  agent fill

- `[research]` - Research forms: user defines problem, agent researches with web search

**Shared Components:**

- `validateResearchForm()` - shared between `examples` and `research` commands

- `promptForWebSearchModel()` - filters model list to web-search-capable only

- `resolveHarnessConfig()` - applies correct defaults based on workflow type

- `exportMultiFormat()` - already shared for output

### Implementation Phases

#### Phase 0a: Engineering Cleanup - Naming Consistency

Rename `maxIssues` → `maxIssuesPerTurn` for consistency with other per-turn limits:

- [ ] Rename `DEFAULT_MAX_ISSUES` → `DEFAULT_MAX_ISSUES_PER_TURN` in `settings.ts`

- [ ] Rename `maxIssues` → `maxIssuesPerTurn` in `HarnessConfig` type (in
  `coreTypes.ts`)

- [ ] Rename `maxIssues` → `maxIssuesPerTurn` in `FillOptions` type

- [ ] Update all usages in `programmaticFill.ts`, `harness.ts`, `fill.ts`

- [ ] Update CLI help text (keep short flag `--max-issues` for convenience)

- [ ] Update tests to use new naming

**Why this cleanup?**

- Consistency: all per-turn limits should use `*PerTurn` suffix

- Clarity: distinguishes total limits (maxTurns) from per-turn limits

#### Phase 0b: Engineering Cleanup - Consolidate LLM Settings

Move all LLM-related configuration from `settings.ts` to a new `src/llms.ts` file:

- [ ] Create `src/llms.ts` with all LLM-related exports

- [ ] Move `SUGGESTED_LLMS` constant

- [ ] Move `formatSuggestedLlms()` function

- [ ] Move `WebSearchConfig` interface

- [ ] Move `WEB_SEARCH_CONFIG` constant

- [ ] Move `hasWebSearchSupport()` function

- [ ] Move `getWebSearchConfig()` function

- [ ] Add new helpers needed for research:

  - `getWebSearchProviders()`: returns list of providers with web search

  - `formatWebSearchModels()`: formats available web search models for error messages

  - `isWebSearchModel(modelId)`: validates full model ID supports web search

- [ ] Update all imports across codebase (harness/, cli/, research/)

- [ ] Remove LLM section from `settings.ts`

- [ ] Update public exports in `src/index.ts`

**Why this cleanup?**

- Single source of truth for LLM configuration

- Makes it easy to add new providers or update model lists

- Clear separation: `settings.ts` = general config, `llms.ts` = LLM-specific

- New research feature relies heavily on these settings

#### Phase 1: Frontmatter Harness Config (Shared Infrastructure)

- [ ] Add research defaults to `src/settings.ts`:

  - `RESEARCH_DEFAULT_MAX_ISSUES_PER_TURN = 3`

  - `RESEARCH_DEFAULT_MAX_GROUPS_PER_TURN = 1`

- [ ] Add `FrontmatterHarnessConfig` type to `src/engine/coreTypes.ts`

- [ ] Update `FormMetadata` to include optional `harness` field

- [ ] Update form parser to extract `markform.harness` from frontmatter

  **Note**: Current `parseForm()` in `parse.ts` extracts frontmatter but discards it!
  The returned `ParsedForm.metadata` is always undefined.
  This needs to be fixed to:

  1. Parse frontmatter YAML properly (may need `yaml` package)

  2. Extract `markform.spec`, `roles`, `role_instructions`, and new `harness` config

  3. Populate `metadata` field in returned `ParsedForm`

- [ ] Add `src/cli/lib/harnessConfigResolver.ts` with:

  - `FILL_DEFAULTS` and `RESEARCH_DEFAULTS` (using settings.ts constants)

  - `resolveHarnessConfig()` function for merge logic

  - `frontmatterToHarnessConfig()` for snake_case → camelCase conversion

- [ ] Unit tests for config resolution override hierarchy

#### Phase 2: Core Research Types and Validation

- [ ] Create `src/research/` module directory

- [ ] Add `src/research/researchTypes.ts` with ResearchOptions, ResearchResult,
  ResearchFormValidation

- [ ] Add `src/research/researchFormValidation.ts` with `validateResearchForm()`
  function

- [ ] Unit tests for research validation in `tests/unit/research/`

#### Phase 3: Research API

- [ ] Implement `src/research/research.ts` with `runResearch()` that:

  - Uses `resolveHarnessConfig('research', form.metadata?.harness, options)`

  - Delegates to `fillForm()` with resolved config

- [ ] Add model web search validation before execution

- [ ] Add `src/research/index.ts` with public exports

- [ ] Integration tests with mock agent

#### Phase 4: CLI Commands

- [ ] Add `src/cli/lib/initialValues.ts` with:

  - `parseInlineFieldValues(args: string[])`: parse `field=value` pairs after `--`

  - `loadInitialValuesFile(path: string)`: load JSON/YAML file, return InputContext

  - `mergeInitialValues(file, inline)`: merge with inline overriding file

- [ ] Add `src/cli/commands/research.ts` command using `resolveHarnessConfig()`

  - Support `--initial-values=<file>` option

  - Support `-- field=value` pairs via positional args after `--`

  - Support `--interactive` mode for missing user fields

  - Support `--model` with web search validation

- [ ] Update `src/cli/commands/fill.ts` to use shared `resolveHarnessConfig()`

- [ ] Unit tests for initial values parsing and merging

- [ ] Integration tests for CLI config override hierarchy

#### Phase 5: Examples Command Integration

Update `examples` command to use research workflow for research forms:

- [ ] Add `type?: 'standard' | 'research'` to `ExampleDefinition` in `cliTypes.ts`

- [ ] Update `exampleRegistry.ts` to tag examples with their type:

  - `simple` → `'standard'`

  - `political-research` → `'research'`

  - `earnings-analysis` → `'research'`

  - `startup-deep-research` → `'research'`

- [ ] Update example selection menu to show type indicators:

  - Add `[interactive]` hint for standard forms

  - Add `[research]` hint for research forms

  - Makes form type visible before user selects

- [ ] Add `promptForWebSearchModel()` helper (filters to web-search-capable models)

- [ ] Update `examples.ts` to:

  - Detect form type from registry or via `validateResearchForm()`

  - Use `promptForWebSearchModel()` for research forms

  - Use `RESEARCH_DEFAULTS` (3 issues/turn, 1 group/turn) for research forms

  - Use `FILL_DEFAULTS` (10 issues/turn) for standard forms

- [ ] Ensure `startup-deep-research` works end-to-end as research example

- [ ] Integration tests for examples command with research forms

#### Phase 6: Update Research Example Forms

Improve research example forms to demonstrate best practices:

- [ ] Update `startup-deep-research.form.md`:

  - Add `harness.max_issues_per_turn: 3` to frontmatter

  - Add explicit `role="agent"` to first few agent fields (teaching example)

  - Update form description to mention user→agent field ordering

- [ ] Update `political-research.form.md`:

  - Add `harness` config if missing

  - Verify meets research form validation criteria

- [ ] Update `earnings-analysis.form.md`:

  - Add `harness` config if missing

  - Verify meets research form validation criteria

- [ ] Add research form documentation to SPEC.md or README

## Stage 4: Validation Stage

### Test Plan

1. **LLM Settings Tests** (`tests/unit/llms.test.ts`):

   - `getWebSearchProviders()` returns ['openai', ‘google’, 'xai']

   - `hasWebSearchSupport('openai')` returns true

   - `hasWebSearchSupport('anthropic')` returns false

   - `isWebSearchModel('openai/gpt-4o')` returns true

   - `isWebSearchModel('anthropic/claude-3-5-sonnet')` returns false

   - `formatWebSearchModels()` includes all web-search providers

   - All imports in codebase updated correctly (no broken imports)

2. **Harness Config Tests** (`tests/unit/harnessConfigResolver.test.ts`):

   - `resolveHarnessConfig('fill')` returns FILL_DEFAULTS when no overrides

   - `resolveHarnessConfig('research')` returns RESEARCH_DEFAULTS (maxIssuesPerTurn: 3,
     maxGroupsPerTurn: 1)

   - Frontmatter config overrides workflow defaults

   - CLI options override frontmatter config

   - Full override chain: defaults → frontmatter → CLI

   - `frontmatterToHarnessConfig()` converts snake_case to camelCase (e.g.,
     `max_issues_per_turn` → `maxIssuesPerTurn`)

   - Invalid frontmatter values are rejected with clear errors

3. **Research Validation Tests** (`tests/unit/research/`):

   - `validateResearchForm()` accepts valid research forms

   - `validateResearchForm()` rejects forms without user fields

   - `validateResearchForm()` rejects forms without agent fields

4. **Integration Tests** (`tests/integration/`):

   - `runResearch()` with mock agent completes successfully

   - `runResearch()` fails fast with non-web-search model

   - `runResearch()` uses frontmatter harness config when present

   - `runResearch()` uses inputContext to pre-fill fields

   - `runResearchFromFile()` writes expected output files

5. **Initial Values Tests** (`tests/unit/cli/initialValues.test.ts`):

   - Parse `-- field=value` pairs correctly

   - Handle values containing `=` (split on first `=` only)

   - Handle quoted values with spaces

   - Load JSON file via `--initial-values=file.json`

   - Load YAML file via `--initial-values=file.yml`

   - Merge order: file values, then inline values (inline wins)

   - Error on missing initial-values file

   - Error on invalid JSON/YAML syntax

6. **Examples Command Tests** (`tests/integration/examples.test.ts`):

   - Example registry includes `type` field for all examples

   - `startup-deep-research` is tagged as `type: 'research'`

   - `simple` is tagged as `type: 'standard'`

   - `promptForWebSearchModel()` only shows openai/google/xai models

7. **CLI Tests**:

   - `markform research --help` shows correct options

   - `markform research <file> --model=anthropic/claude-...` fails with web search error

   - `markform research <file> --model=openai/gpt-4o -- field=value` pre-fills field

   - `markform research <file> --initial-values=test.json` loads values from file

   - `markform research <file> --model openai/gpt-4o` succeeds

   - CLI `--max-issues` overrides frontmatter `harness.max_issues_per_turn`

   - `markform fill` also respects frontmatter harness config

### Manual Validation

- Run research on `startup-deep-research.form.md` with OpenAI model

- Run research on `political-research.form.md` with Google model

- Verify web search tool is called during execution

- Verify output files are generated correctly

- Test with form containing `harness.max_issues_per_turn: 5` in frontmatter

- Verify CLI `--max-issues 10` overrides frontmatter value

* * *

**Status**: Stage 2 Complete - Ready for Implementation **Created**: 2025-12-27
**Author**: Agent
