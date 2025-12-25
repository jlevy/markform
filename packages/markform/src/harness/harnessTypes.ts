/**
 * Harness types - Types for form filling agents and the programmatic fill API.
 *
 * This module consolidates types from:
 * - programmaticFill.ts: FillOptions, TurnProgress, FillStatus, FillResult
 * - mockAgent.ts: Agent interface
 * - liveAgent.ts: LiveAgentConfig
 * - modelResolver.ts: ProviderName, ParsedModelId, ResolvedModel, ProviderInfo
 */

import type { LanguageModel } from "ai";

import type {
  FillMode,
  FieldValue,
  InspectIssue,
  ParsedForm,
  Patch,
} from "../engine/coreTypes.js";
import type { InputContext } from "../engine/valueCoercion.js";

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
}

/**
 * Response from agent's generatePatches call.
 */
export interface AgentResponse {
  /** Patches to apply */
  patches: Patch[];
  /** Per-turn stats (undefined for MockAgent) */
  stats?: TurnStats;
}

/**
 * Interface for agents that can generate patches.
 */
export interface Agent {
  /**
   * Generate patches to address the given issues.
   *
   * @param issues - Prioritized issues from harness step
   * @param form - Current form state
   * @param maxPatches - Maximum number of patches to generate
   * @returns Promise resolving to patches and optional stats
   */
  generatePatches(
    issues: InspectIssue[],
    form: ParsedForm,
    maxPatches: number
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
  /** Maximum tool call steps per turn (default: 3) */
  maxStepsPerTurn?: number;
  /** Additional context to append to the composed system prompt (never overrides) */
  systemPromptAddition?: string;
  /** Target role for instruction lookup (default: AGENT_ROLE) */
  targetRole?: string;
  /** Provider name (needed for web search tool selection) */
  provider?: string;
  /** Enable web search for providers that support it (default: true) */
  enableWebSearch?: boolean;
}

// =============================================================================
// Model Resolver Types
// =============================================================================

/**
 * Supported provider names.
 *
 * These correspond to the @ai-sdk/* packages from Vercel AI SDK.
 */
export type ProviderName =
  | "anthropic"
  | "openai"
  | "google"
  | "xai"
  | "deepseek";

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
}

/**
 * Provider configuration info for display purposes.
 */
export interface ProviderInfo {
  package: string;
  envVar: string;
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
  /** Maximum harness turns (default: 100) */
  maxTurns?: number;
  /** Maximum patches per turn (default: 20) */
  maxPatchesPerTurn?: number;
  /** Maximum issues to show per turn (default: 10) */
  maxIssues?: number;
  /** Target roles to fill (default: ['agent']) */
  targetRoles?: string[];
  /** Fill mode: 'continue' (skip filled) or 'overwrite' (re-fill) */
  fillMode?: FillMode;
  /** Progress callback called after each turn */
  onTurnComplete?: (progress: TurnProgress) => void;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
  /**
   * TEST ONLY: Override agent for testing with MockAgent.
   * When provided, model is ignored and this agent is used instead.
   */
  _testAgent?: Agent;
}

/**
 * Progress information for each turn.
 */
export interface TurnProgress {
  turnNumber: number;
  issuesShown: number;
  patchesApplied: number;
  requiredIssuesRemaining: number;
  isComplete: boolean;
  /** Per-turn stats from LLM (undefined for MockAgent) */
  stats?: TurnStats;
}

/**
 * Fill status indicating success or failure reason.
 */
export type FillStatus =
  | { ok: true }
  | { ok: false; reason: "max_turns" | "cancelled" | "error"; message?: string };

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
    severity: "required" | "recommended";
    priority: number;
  }[];
}
