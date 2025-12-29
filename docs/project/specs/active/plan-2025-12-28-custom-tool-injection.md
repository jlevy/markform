# Plan Spec: Custom Tool Injection for Live Agent

## Purpose

Extend the Markform TypeScript API to allow external callers to inject custom tools
(e.g., custom web search implementations) into the live agent, and to optionally disable
the built-in provider web search tools.

## Background

Markform’s live agent (`LiveAgent` class in `harness/liveAgent.ts`) uses Vercel AI SDK
to call LLMs for autonomous form filling.
The agent combines:

1. **Form-manipulation tools**: `generatePatches` tool for filling form fields

2. **Web search tools**: Provider-specific tools (OpenAI, Anthropic, Google, xAI)

Currently, the web search tools are hard-coded based on the provider.
Users who want to:

- Use a custom web search implementation (e.g., Tavily, Perplexity, custom API)

- Add additional tools (database lookup, URL fetcher, custom research tools)

- Disable web search entirely for privacy/cost reasons

… have no way to do so through the public API.

### Related Documentation

- `packages/markform/src/harness/liveAgent.ts` — Live agent implementation

- `packages/markform/src/harness/harnessTypes.ts` — `LiveAgentConfig` and `FillOptions`

- `packages/markform/src/integrations/vercelAiSdkTools.ts` — Low-level AI SDK tool
  factory

- `packages/markform/src/harness/programmaticFill.ts` — `fillForm()` high-level API

## Summary of Task

Add `additionalTools` option and make `enableWebSearch` required in `LiveAgentConfig` and
`FillOptions` to allow callers to:

1. Inject custom Vercel AI SDK tools

2. Explicitly control whether web search is enabled (no accidental exposure)

**Tool categories:**

- **Essential tool**: `generatePatches` — Always included, required for form filling

- **Web search tools**: Provider-specific (OpenAI, Anthropic, etc.) — Controlled by `enableWebSearch`

- **Custom tools**: User-provided via `additionalTools`

**Key behaviors:**

1. `enableWebSearch` is **required** — forces explicit choice, no accidental tool exposure

2. `additionalTools` are merged with enabled tools (custom wins on name collision)

3. When `enableWebSearch: false`, only `generatePatches` + `additionalTools` are used

**Configuration matrix:**

| `enableWebSearch` | Result |
| --- | --- |
| `true` | generatePatches + provider web search + additionalTools |
| `false` | generatePatches + additionalTools only |

Note: `enableWebSearch` is now **required** (was optional with default `true`).

**Not in scope:**

- CLI exposure (this is TypeScript API only)

- Custom tool validation/type checking beyond what AI SDK provides

- Tool result processing or transformation

## Backward Compatibility

**This is a hard cut — no backward compatibility maintained.**

- `enableWebSearch` changes from optional (default `true`) to **required**
- Existing code must be updated to explicitly pass `enableWebSearch: true` or `false`
- This is intentional to force explicit tool configuration

## Stage 1: Planning Stage

### Feature Requirements

**Core Requirements:**

1. Add `additionalTools?: Record<string, Tool>` to `LiveAgentConfig` interface

2. Change `enableWebSearch` from optional to **required** in `LiveAgentConfig`

3. Add both options to `FillOptions` interface (`enableWebSearch` required there too)

4. Merge `additionalTools` into the tool set in `LiveAgent.generatePatches()`

5. Wire options through `fillForm()` → `createLiveAgent()`

6. Update all existing call sites to pass `enableWebSearch` explicitly

7. Document the new options in JSDoc comments

**Usage Patterns:**

```typescript
// Pattern 1: Custom tools only (no web search)
import { createLiveAgent } from 'markform';

const agent = createLiveAgent({
  model: anthropic('claude-sonnet-4-5'),
  enableWebSearch: false,  // Required - explicit choice
  additionalTools: {
    web_search: tavilySearchTool,  // Custom web search
    fetch_url: myFetchTool,
  },
});

// Pattern 2: Native web search + custom tools
const agent = createLiveAgent({
  model: openai('gpt-4o'),
  provider: 'openai',
  enableWebSearch: true,  // Required - use native OpenAI web search
  additionalTools: {
    lookup_database: myDbTool,
    fetch_url: myFetchTool,
  },
});

// Pattern 3: Via fillForm() high-level API
const result = await fillForm({
  form: markdownContent,
  model: 'anthropic/claude-sonnet-4-5',
  enableWebSearch: false,
  additionalTools: {
    web_search: myCustomSearchTool,
  },
});

// Pattern 4: No web search, no custom tools (form filling only)
const agent = createLiveAgent({
  model: openai('gpt-4o'),
  enableWebSearch: false,
  // No additionalTools - agent can only fill forms
});

// Pattern 5: Native web search only (current default behavior, now explicit)
const agent = createLiveAgent({
  model: anthropic('claude-sonnet-4-5'),
  provider: 'anthropic',
  enableWebSearch: true,  // Must be explicit now
});
```

**Out of Scope (Not Implementing):**

- CLI flags for tool configuration

- Tool schemas/validation beyond AI SDK types

- Tool result transformation or interception

- Built-in custom tool implementations (users bring their own)

### Acceptance Criteria

1. `LiveAgentConfig.additionalTools` accepts `Record<string, Tool>` from AI SDK

2. `LiveAgentConfig.enableWebSearch` is required (not optional)

3. `FillOptions` has both options and wires through to live agent

4. Custom tools appear in `getAvailableToolNames()` output

5. Custom tools with same name as built-in tools replace them

6. `enableWebSearch: false` results in only `generatePatches` + `additionalTools`

7. `enableWebSearch: true` includes provider web search tools

8. All existing call sites updated to pass `enableWebSearch` explicitly

9. TypeScript compiler errors if `enableWebSearch` is missing

10. Unit tests verify tool merging behavior

11. JSDoc comments document the options with examples

## Stage 2: Architecture Stage

### File Changes

```
packages/markform/src/
  harness/
    harnessTypes.ts          # MODIFY: Add additionalTools to LiveAgentConfig, FillOptions
    liveAgent.ts             # MODIFY: Store and merge additionalTools in LiveAgent
    programmaticFill.ts      # MODIFY: Wire additionalTools through to createLiveAgent
```

### Type Definitions

Modify `harnessTypes.ts`:

```typescript
import type { Tool } from 'ai';

export interface LiveAgentConfig {
  /** The language model to use */
  model: LanguageModel;
  /** Provider name (needed for web search tool selection) */
  provider?: string;
  /** Maximum tool call steps per turn (default: 3) */
  maxStepsPerTurn?: number;
  /** Additional context to append to the composed system prompt */
  systemPromptAddition?: string;
  /** Target role for instruction lookup (default: AGENT_ROLE) */
  targetRole?: string;

  /**
   * Enable provider web search tools.
   *
   * **Required** — must explicitly choose to avoid accidental tool exposure.
   *
   * @example
   * ```typescript
   * enableWebSearch: true   // Use native provider web search
   * enableWebSearch: false  // No web search (use additionalTools for custom)
   * ```
   */
  enableWebSearch: boolean;  // Required, not optional

  /**
   * Additional custom tools to include.
   *
   * Tools are merged with enabled built-in tools.
   * If a custom tool has the same name as a built-in tool, the custom tool wins.
   *
   * @example
   * ```typescript
   * additionalTools: {
   *   web_search: myCustomSearchTool,  // Replace native
   *   lookup_database: myDbTool,       // Add new capability
   * }
   * ```
   */
  additionalTools?: Record<string, Tool>;
}

export interface FillOptions {
  // ... existing properties

  /**
   * Enable provider web search tools.
   * **Required** — must explicitly choose.
   */
  enableWebSearch: boolean;  // Required, not optional

  /** Additional custom tools for the agent */
  additionalTools?: Record<string, Tool>;
}
```

### Implementation in LiveAgent

Modify `liveAgent.ts`:

```typescript
export class LiveAgent implements Agent {
  // ... existing properties
  private enableWebSearch: boolean;
  private additionalTools: Record<string, Tool>;

  constructor(config: LiveAgentConfig) {
    // ... existing initialization
    this.enableWebSearch = config.enableWebSearch;  // Required, no default
    this.additionalTools = config.additionalTools ?? {};

    // Only load web search tools if enabled and provider is set
    if (this.enableWebSearch && config.provider) {
      this.webSearchTools = loadWebSearchTools(config.provider);
    }
  }

  getAvailableToolNames(): string[] {
    const tools = ['generatePatches'];
    if (this.webSearchTools) {
      tools.push(...Object.keys(this.webSearchTools));
    }
    // Add custom tool names (may overlap with web search if replacing)
    tools.push(...Object.keys(this.additionalTools));
    // Dedupe in case custom tools replace built-in
    return [...new Set(tools)];
  }

  async generatePatches(...): Promise<AgentResponse> {
    // ... existing prompt building

    // Combine all tools (custom wins on collision)
    const tools: Record<string, Tool> = {
      generatePatches: generatePatchesTool,
      ...this.webSearchTools,
      ...this.additionalTools,  // Custom tools override built-in
    };

    // ... rest of implementation
  }
}
```

### Implementation in programmaticFill

Modify `programmaticFill.ts`:

```typescript
export async function fillForm(options: FillOptions): Promise<FillResult> {
  // ... existing code

  const liveAgent = createLiveAgent({
    model,
    provider,
    systemPromptAddition: options.systemPromptAddition,
    targetRole: primaryRole,
    enableWebSearch: options.enableWebSearch,  // Required, wire through
    additionalTools: options.additionalTools,  // Optional, wire through
  });

  // ... rest of implementation
}
```

## Stage 3: Refine Architecture

### Reuse Opportunities Found

1. **Tool type**: Import `Tool` from `ai` package (already a dependency)

2. **Spread pattern**: Existing pattern at L125-128 of liveAgent.ts already spreads
   tools

3. **Test patterns**: Existing unit tests in `tests/unit/harness/liveAgent.test.ts`

### Simplified Architecture

No changes needed from Stage 2 — the implementation is minimal:

- Make `enableWebSearch` required (remove `?` and default)

- Add optional `additionalTools` property to both interfaces

- Store `additionalTools` in LiveAgent constructor

- Add one spread operation in tool merging

- Wire through properties in programmaticFill

- Update all existing call sites to pass `enableWebSearch` explicitly

### Implementation Phases

**Single Phase** (this is a small, focused change):

- [ ] Make `enableWebSearch` required in `LiveAgentConfig` (remove `?`)

- [ ] Add `additionalTools?: Record<string, Tool>` to `LiveAgentConfig`

- [ ] Add both options to `FillOptions` in `harnessTypes.ts`

- [ ] Store `additionalTools` in `LiveAgent` constructor

- [ ] Merge `additionalTools` in `LiveAgent.generatePatches()` tool object

- [ ] Update `getAvailableToolNames()` to include custom tools

- [ ] Wire options through `programmaticFill.ts`

- [ ] Update all existing call sites to pass `enableWebSearch` explicitly:
  - [ ] `fill.ts` CLI command
  - [ ] `test-live-agent.ts` script
  - [ ] Any tests that create `LiveAgent` directly

- [ ] Add unit tests for `additionalTools` merging behavior

- [ ] Add JSDoc comments with examples

- [ ] Verify TypeScript compiler errors when `enableWebSearch` is missing

## Stage 4: Validation Stage

### Test Plan

**1. Unit tests** (`tests/unit/harness/liveAgent.test.ts`):

Add tests for:

- Custom tools appear in `getAvailableToolNames()`

- Custom tools override built-in tools with same name

- `enableWebSearch: false` + `additionalTools` works

- `enableWebSearch: true` + `additionalTools` merges correctly

- `enableWebSearch: false` with no additionalTools = only generatePatches

- Empty `additionalTools` has no effect

**2. Type checking**:

- Verify `Tool` type from `ai` package is correctly imported

- Verify TypeScript errors when `enableWebSearch` is missing

**3. Call site updates**:

- All existing call sites updated and passing `enableWebSearch` explicitly

- Tests pass after updates

### Test Implementation

```typescript
// tests/unit/harness/liveAgent.test.ts

describe('LiveAgent additionalTools', () => {
  it('includes custom tools in getAvailableToolNames', () => {
    const agent = new LiveAgent({
      model: mockModel,
      enableWebSearch: false,  // Required
      additionalTools: {
        my_custom_tool: mockTool,
      },
    });

    const names = agent.getAvailableToolNames();
    expect(names).toContain('generatePatches');
    expect(names).toContain('my_custom_tool');
  });

  it('custom tools override built-in tools with same name', () => {
    const agent = new LiveAgent({
      model: mockModel,
      provider: 'openai',
      enableWebSearch: true,
      additionalTools: {
        web_search: customWebSearchTool,  // Override native
      },
    });

    // Verify custom tool is used instead of native
    // (implementation detail: custom spreads after native)
  });

  it('works with enableWebSearch: false and custom tools', () => {
    const agent = new LiveAgent({
      model: mockModel,
      enableWebSearch: false,
      additionalTools: {
        web_search: customWebSearchTool,
      },
    });

    const names = agent.getAvailableToolNames();
    expect(names).toContain('web_search');
    expect(names).toContain('generatePatches');
    // Native web_search tools are not loaded
  });

  it('enableWebSearch: false with no additionalTools = only generatePatches', () => {
    const agent = new LiveAgent({
      model: mockModel,
      enableWebSearch: false,
    });

    const names = agent.getAvailableToolNames();
    expect(names).toEqual(['generatePatches']);
  });

  it('enableWebSearch: true includes provider web search', () => {
    const agent = new LiveAgent({
      model: mockModel,
      provider: 'openai',
      enableWebSearch: true,
    });

    const names = agent.getAvailableToolNames();
    expect(names).toContain('generatePatches');
    expect(names).toContain('web_search');
  });
});
```

### Success Criteria

- [ ] All existing tests pass (after updating call sites)

- [ ] New unit tests for `additionalTools` pass

- [ ] TypeScript compiles without errors

- [ ] TypeScript errors when `enableWebSearch` is missing from call sites

- [ ] `npm run build` succeeds

- [ ] JSDoc comments render correctly

- [ ] Manual test: create agent with `additionalTools`, verify in `getAvailableToolNames()`

- [ ] Manual test: create agent with `enableWebSearch: false`, verify only essential tools
