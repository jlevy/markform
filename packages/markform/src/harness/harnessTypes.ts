/**
 * Harness types - Types for form filling agents and the programmatic fill API.
 *
 * This module consolidates types from:
 * - programmaticFill.ts: FillOptions, TurnProgress, FillStatus, FillResult
 * - mockAgent.ts: Agent interface
 * - liveAgent.ts: LiveAgentConfig
 * - modelResolver.ts: BuiltInProviderName, ParsedModelId, ResolvedModel, ProviderInfo
 */

import type { LanguageModel, Tool } from 'ai';

import type { FillRecord } from './fillRecord.js';
import type {
  FillMode,
  FieldValue,
  InspectIssue,
  ParsedForm,
  Patch,
  PatchRejection,
  PatchWarning,
  // Wire format types (defined in coreTypes for session logging)
  WireFormat,
  WireRequestFormat,
  WireResponseFormat,
  WireResponseStep,
  WireToolCall,
  WireToolResult,
} from '../engine/coreTypes.js';
import type { InputContext } from '../engine/valueCoercion.js';

// Re-export wire format types for convenience
export type {
  WireFormat,
  WireRequestFormat,
  WireResponseFormat,
  WireResponseStep,
  WireToolCall,
  WireToolResult,
};

// =============================================================================
// Agent Interface
// =============================================================================

/**
 * Per-turn statistics from LLM calls.
 *
 * Tracks token usage, tool calls, and form progress for observability.
 */
export interface TurnStats {
  /** Input tokens for this turn (from provider usage) */
  inputTokens?: number;
  /** Output tokens for this turn (from provider usage) */
  outputTokens?: number;
  /** Tool calls made during this turn */
  toolCalls: {
    /** Tool name */
    name: string;
    /** Number of times called */
    count: number;
  }[];
  /** Form progress after this turn */
  formProgress: {
    /** Fields with values */
    answeredFields: number;
    /** Fields marked as skipped */
    skippedFields: number;
    /** Required issues still remaining */
    requiredRemaining: number;
    /** Optional/recommended issues still remaining */
    optionalRemaining: number;
  };
  /** Full prompts sent to LLM (for verbose logging) */
  prompts?: {
    /** System prompt with instructions */
    system: string;
    /** Context prompt with form state and issues */
    context: string;
  };
  /**
   * Complete wire format for session logging.
   * Captures exact LLM request/response for regression testing.
   * Only populated when captureWireFormat is enabled (e.g., in golden tests).
   */
  wire?: WireFormat;
}

/**
 * Response from agent's fillFormTool call.
 */
export interface AgentResponse {
  /** Patches to apply */
  patches: Patch[];
  /** Per-turn stats (undefined for MockAgent) */
  stats?: TurnStats;
}

/**
 * Interface for agents that can fill form fields.
 */
export interface Agent {
  /**
   * Invoke the fill_form tool to address the given issues.
   *
   * @param issues - Prioritized issues from harness step
   * @param form - Current form state
   * @param maxPatches - Maximum number of patches to generate
   * @param previousRejections - Optional rejections from previous turn (helps agent learn from mistakes)
   * @returns Promise resolving to patches and optional stats
   */
  fillFormTool(
    issues: InspectIssue[],
    form: ParsedForm,
    maxPatches: number,
    previousRejections?: PatchRejection[],
  ): Promise<AgentResponse>;
}

// =============================================================================
// Live Agent Types
// =============================================================================

/**
 * Configuration for the live agent.
 */
export interface LiveAgentConfig {
  /** The language model to use */
  model: LanguageModel;
  /** Maximum AI SDK steps (tool call rounds) per turn (default: 20) */
  maxStepsPerTurn?: number;
  /** Additional context to append to the composed system prompt (never overrides) */
  systemPromptAddition?: string;
  /** Target role for instruction lookup (default: AGENT_ROLE) */
  targetRole?: string;
  /** Provider name (needed for web search tool selection) */
  provider?: string;
  /** Provider-adapter-supplied tools (e.g., web search from custom providers). */
  providerTools?: Record<string, Tool>;
  /**
   * Execution thread ID for parallel tracking.
   * Used to associate LLM calls, tool calls, and events with the correct execution thread.
   * Defaults to '0-serial' for serial execution.
   */
  executionId?: string;

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
  enableWebSearch: boolean;

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

  /** Optional callbacks for observing agent execution */
  callbacks?: FillCallbacks;

  /**
   * Tool choice strategy for the LLM.
   *
   * - 'auto': Model decides whether to use tools
   * - 'required' (default): Model MUST call a tool (some models like gpt-5-mini don't reliably call tools with 'auto')
   *
   * @default 'required'
   */
  toolChoice?: 'auto' | 'required';

  /**
   * Maximum retries for transient API errors (429 rate limit, 503 service unavailable).
   * Uses the Vercel AI SDK's built-in exponential backoff with jitter.
   * Set to 0 to disable retries (useful for fast tests).
   *
   * @default 3
   */
  maxRetries?: number;
}

// =============================================================================
// Model Resolver Types
// =============================================================================

/**
 * Built-in provider names corresponding to the @ai-sdk/* packages from Vercel AI SDK.
 */
export type BuiltInProviderName = 'anthropic' | 'openai' | 'google' | 'xai' | 'deepseek';

/**
 * Any provider name — built-in or custom. Provides autocomplete for built-in names.
 */
export type ProviderName = BuiltInProviderName | (string & {});

/**
 * Parsed model identifier.
 */
export interface ParsedModelId {
  provider: ProviderName;
  modelId: string;
}

/**
 * Model resolution result.
 */
export interface ResolvedModel {
  model: LanguageModel;
  provider: ProviderName;
  modelId: string;
  /** Adapter-provided tools (e.g., web search) */
  tools?: Record<string, Tool>;
}

/**
 * Provider configuration info for display purposes.
 */
export interface ProviderInfo {
  package: string;
  envVar: string;
}

/**
 * Adapter for an AI provider. Clients import their own @ai-sdk/* package,
 * configure it, and pass the adapter to markform.
 *
 * The interface matches the AI SDK provider shape so providers can often
 * be passed directly without wrapping.
 */
export interface ProviderAdapter {
  /** Resolve a model name to a LanguageModel instance. */
  model(modelId: string): LanguageModel;
  /** Optional provider-specific tools (e.g., web search). */
  tools?: Record<string, Tool>;
}

/**
 * AI SDK providers are callable: provider(modelId) => LanguageModel.
 * They may also have a .tools property with tool factories.
 */
export type AiSdkProviderCallable = ((modelId: string) => LanguageModel) & {
  tools?: Record<string, (...args: unknown[]) => Tool>;
};

/**
 * A ProviderInput is either a ProviderAdapter (with `.model()` method)
 * or an AI SDK provider callable (auto-normalized via `normalizeProvider()`).
 */
export type ProviderInput = ProviderAdapter | AiSdkProviderCallable;

// =============================================================================
// Fill Callbacks
// =============================================================================

/**
 * Callbacks for observing form-filling execution in real-time.
 *
 * All callbacks are optional - implement only what you need.
 * Callback errors are caught and ignored (won't abort fill).
 *
 * @example
 * ```typescript
 * await fillForm({
 *   form: formMarkdown,
 *   model: 'anthropic/claude-sonnet-4-5',
 *   enableWebSearch: true,
 *   callbacks: {
 *     onTurnStart: ({ turnNumber }) => console.log(`Starting turn ${turnNumber}`),
 *     onIssuesIdentified: ({ issues }) => console.log(`Found ${issues.length} issues`),
 *     onPatchesGenerated: ({ patches }) => console.log(`Generated ${patches.length} patches`),
 *     onToolStart: ({ name }) => spinner.message(`🔧 ${name}...`),
 *     onTurnComplete: (progress) => console.log(`Turn ${progress.turnNumber} done`),
 *   },
 * });
 * ```
 */
export interface FillCallbacks {
  /** Called when a turn begins */
  onTurnStart?(turn: {
    turnNumber: number;
    issuesCount: number;
    /** Field ordering level for parallel execution (can be negative) */
    order: number;
    /** Execution thread ID (e.g., "0-serial", "1-batch-contacts-0") */
    executionId: string;
  }): void;

  /** Called after inspect identifies issues for this turn (before agent generates patches) */
  onIssuesIdentified?(info: { turnNumber: number; issues: InspectIssue[] }): void;

  /** Called after LLM generates patches (before applying) */
  onPatchesGenerated?(info: { turnNumber: number; patches: Patch[]; stats?: TurnStats }): void;

  /** Called when a turn completes */
  onTurnComplete?(progress: TurnProgress): void;

  /** Called before a tool executes */
  onToolStart?(call: {
    name: string;
    input: unknown;
    /** Execution thread ID for parallel tracking */
    executionId: string;
  }): void;

  /** Called after a tool completes */
  onToolEnd?(call: {
    name: string;
    output: unknown;
    durationMs: number;
    error?: string;
    /** Execution thread ID for parallel tracking */
    executionId: string;
  }): void;

  /** Called before an LLM request */
  onLlmCallStart?(call: {
    model: string;
    /** Execution thread ID for parallel tracking */
    executionId: string;
  }): void;

  /** Called after an LLM response */
  onLlmCallEnd?(call: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    /** Execution thread ID for parallel tracking */
    executionId: string;
  }): void;

  /** Called when a parallel batch starts execution */
  onBatchStart?(info: { batchId: string; itemCount: number }): void;

  /** Called when a parallel batch completes */
  onBatchComplete?(info: { batchId: string; patchesApplied: number }): void;

  /** Called when an order level starts processing */
  onOrderLevelStart?(info: { order: number }): void;

  /** Called when an order level completes */
  onOrderLevelComplete?(info: { order: number; patchesApplied: number }): void;

  /**
   * Called when a web search is performed.
   *
   * This provides access to the search query and result count for analytics and debugging.
   * Note: Not all providers expose the exact query. When available, this is called.
   */
  onWebSearch?(info: {
    /** The search query that was executed */
    query: string;
    /** Number of results returned (0 if none) */
    resultCount: number;
    /** Provider that performed the search (e.g., "anthropic", "openai") */
    provider: string;
    /** Execution thread ID for parallel tracking */
    executionId: string;
  }): void;

  /**
   * Called when an error occurs during the fill loop (agent threw during fillFormTool).
   *
   * Fires before the error is returned as part of FillResult, so consumers can
   * log or report errors in real time during long-running fills.
   *
   * For MarkformLlmError instances, the error object carries `.statusCode`,
   * `.responseBody`, `.provider`, `.model`, and `.retryable` properties.
   * The full `.cause` chain is also preserved.
   */
  onError?(error: Error, context: { turnNumber: number }): void;
}

// =============================================================================
// Programmatic Fill Types
// =============================================================================

/**
 * Options for the fillForm function.
 */
export interface FillOptions {
  /** Form content as markdown string or parsed form */
  form: string | ParsedForm;
  /**
   * Model identifier (e.g., 'anthropic/claude-sonnet-4-5') or LanguageModel instance.
   * The string accepts any provider/model format for extensibility.
   */
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  model: string | LanguageModel;
  /** Pre-fill fields by ID before agent runs */
  inputContext?: InputContext;
  /** Additional context to append to the composed system prompt (never overrides) */
  systemPromptAddition?: string;
  /**
   * Maximum TOTAL turns across all calls combined.
   * This is a safety limit to prevent runaway sessions.
   * When resuming, pass the same value—the limit is enforced by comparing
   * against `startingTurnNumber + turnsExecutedThisCall`.
   *
   * @default 100
   */
  maxTurnsTotal?: number;
  /**
   * Maximum turns to execute in THIS call only.
   * When reached, returns with status `{ ok: false, reason: 'batch_limit' }`.
   * Caller can resume by passing the returned form markdown back.
   *
   * Use for orchestrated environments with timeout constraints (e.g., Convex, Step Functions).
   *
   * @default undefined (no per-call limit - runs until complete or maxTurnsTotal)
   */
  maxTurnsThisCall?: number;
  /**
   * Starting turn number for progress tracking when resuming.
   * Affects callback turn numbers and FillResult.turns calculation.
   *
   * @default 0
   */
  startingTurnNumber?: number;
  /** Maximum patches per turn (default: 20) */
  maxPatchesPerTurn?: number;
  /** Maximum issues to show per turn (default: 10) */
  maxIssuesPerTurn?: number;
  /** Maximum AI SDK steps (tool call rounds) per turn (default: 20) */
  maxStepsPerTurn?: number;
  /** Target roles to fill (default: ['agent']) */
  targetRoles?: string[];
  /** Fill mode: 'continue' (skip filled) or 'overwrite' (re-fill) */
  fillMode?: FillMode;
  /**
   * Enable parallel execution for forms with `parallel` batches.
   * When false (default), parallel attributes are ignored and everything runs serially.
   * When true, batch items run concurrently up to `maxParallelAgents`.
   *
   * @default false
   */
  enableParallel?: boolean;
  /** Max concurrent agents for parallel batches (default: 4) */
  maxParallelAgents?: number;
  /** Callbacks for observing form-filling execution */
  callbacks?: FillCallbacks;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;

  /**
   * Enable provider web search tools.
   *
   * **Required** — must explicitly choose to avoid accidental tool exposure.
   */
  enableWebSearch: boolean;

  /**
   * Additional custom tools for the agent.
   *
   * Tools are merged with enabled built-in tools.
   * If a custom tool has the same name as a built-in tool, the custom tool wins.
   */
  additionalTools?: Record<string, Tool>;

  /**
   * Additional providers for string-based model resolution.
   * Keys are provider names (the part before the `/` in model IDs).
   * Values are ProviderAdapter objects or AI SDK provider callables.
   * These take priority over built-in providers.
   */
  providers?: Record<string, ProviderInput>;

  /**
   * TEST ONLY: Override agent for testing with MockAgent.
   * When provided, model is ignored and this agent is used instead.
   */
  _testAgent?: Agent;

  /**
   * Capture wire format (full LLM request/response) in session logs.
   *
   * Wire format includes complete system prompts, context prompts, tool schemas,
   * and LLM responses. This is useful for:
   * - Golden tests requiring exact prompt matching
   * - Debugging prompt issues
   * - LLM regression testing
   *
   * **Warning**: Wire format significantly increases session file size (~2000+ lines
   * per multi-turn session). Set to false for production use.
   */
  captureWireFormat: boolean;

  /**
   * Collect a complete FillRecord capturing all execution details.
   *
   * When true, the FillResult will include a `record` field containing:
   * - Turn-by-turn timeline with token usage
   * - Tool calls with timing and results
   * - Aggregated statistics with percentiles
   * - Execution metadata for parallel fills
   *
   * Useful for:
   * - Cost analysis and billing
   * - Debugging and troubleshooting
   * - Analytics and optimization
   * - Audit trails and provenance
   */
  recordFill: boolean;

  /**
   * Tool choice strategy for the LLM.
   *
   * - 'auto': Model decides whether to use tools
   * - 'required' (default): Model MUST call a tool (some models like gpt-5-mini don't reliably call tools with 'auto')
   *
   * @default 'required'
   */
  toolChoice?: 'auto' | 'required';
}

/**
 * Progress information for each turn.
 */
export interface TurnProgress {
  turnNumber: number;
  issuesShown: number;
  /** Actual number of patches applied (0 if rejected due to validation errors) */
  patchesApplied: number;
  requiredIssuesRemaining: number;
  isComplete: boolean;
  /** Per-turn stats from LLM (undefined for MockAgent) */
  stats?: TurnStats;
  /** Issues shown this turn (for detailed logging) */
  issues: InspectIssue[];
  /** Patches generated this turn (may not all be applied if rejected) */
  patches: Patch[];
  /** Empty if patches applied successfully, contains rejection details if failed */
  rejectedPatches: PatchRejection[];
  /** Coercion warnings from patch normalization (e.g., string auto-wrapped to array) */
  coercionWarnings?: PatchWarning[];
  /** Execution ID for parallel tracking (e.g., "1-batch-research-0") */
  executionId?: string;
}

/**
 * Fill status indicating success or failure reason.
 *
 * - `ok: true` - Form completed successfully
 * - `max_turns` - Hit overall maxTurnsTotal safety limit
 * - `batch_limit` - Hit maxTurnsThisCall per-call limit (resume by calling again)
 * - `cancelled` - Aborted via signal
 * - `error` - Unexpected error
 */
export type FillStatus =
  | { ok: true }
  | {
      ok: false;
      reason: 'max_turns' | 'batch_limit' | 'cancelled' | 'error';
      message?: string;
      /**
       * The original Error object with its full cause chain preserved.
       *
       * Available when `reason` is `'error'` and the caught value was an Error instance.
       * Consumers can inspect `.cause`, and for `MarkformLlmError` instances,
       * `.statusCode`, `.responseBody`, `.provider`, `.model`, and `.retryable`.
       *
       * Not serialized into FillRecord — use for in-memory diagnostics, logging,
       * and real-time error handling.
       */
      error?: Error;
    };

/**
 * Result of the fillForm operation.
 */
export interface FillResult {
  /** Status indicating success or failure */
  status: FillStatus;
  /** Serialized markdown (always present, may be partial) */
  markdown: string;
  /** Field values keyed by field ID (always present, may be partial) */
  values: Record<string, FieldValue>;
  /** The parsed form (always present) */
  form: ParsedForm;
  /** Number of turns executed */
  turns: number;
  /** Total patches applied */
  totalPatches: number;
  /** Warnings from input context coercion */
  inputContextWarnings?: string[];
  /** Remaining issues (present if not complete) */
  remainingIssues?: {
    ref: string;
    message: string;
    severity: 'required' | 'recommended';
    priority: number;
  }[];
  /**
   * Complete fill record when recordFill option is enabled.
   *
   * Contains timeline, token usage, tool calls, and execution metadata.
   * Useful for cost analysis, debugging, and analytics.
   */
  record?: FillRecord;
}
