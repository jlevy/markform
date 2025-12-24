/**
 * Tool types - Types for AI SDK integration tools.
 *
 * This module consolidates types from ai-sdk.ts:
 * - Tool result types (InspectToolResult, ApplyToolResult, etc.)
 * - MarkformTool and MarkformToolSet interfaces
 *
 * Note: CreateMarkformToolsOptions stays in ai-sdk.ts since it references
 * MarkformSessionStore class.
 */

import type { z } from "zod";

import type {
  ApplyResult,
  FieldValue,
  FormSchema,
  Id,
  InspectResult,
  Patch,
} from "../engine/coreTypes.js";

// =============================================================================
// Tool Result Types
// =============================================================================

/**
 * Result from markform_inspect tool.
 */
export interface InspectToolResult {
  success: boolean;
  data: InspectResult;
  message: string;
}

/**
 * Result from markform_apply tool.
 */
export interface ApplyToolResult {
  success: boolean;
  data: ApplyResult;
  message: string;
}

/**
 * Result from markform_export tool.
 */
export interface ExportToolResult {
  success: boolean;
  data: {
    schema: FormSchema;
    values: Record<Id, FieldValue>;
  };
  message: string;
}

/**
 * Result from markform_get_markdown tool.
 */
export interface GetMarkdownToolResult {
  success: boolean;
  data: {
    markdown: string;
  };
  message: string;
}

// =============================================================================
// Tool Definitions
// =============================================================================

/**
 * AI SDK tool interface (compatible with Vercel AI SDK).
 */
export interface MarkformTool<TInput, TOutput> {
  description: string;
  inputSchema: z.ZodType<TInput>;
  execute: (input: TInput) => Promise<TOutput>;
}

/**
 * The complete set of Markform AI SDK tools.
 */
export interface MarkformToolSet {
  markform_inspect: MarkformTool<Record<string, never>, InspectToolResult>;
  markform_apply: MarkformTool<{ patches: Patch[] }, ApplyToolResult>;
  markform_export: MarkformTool<Record<string, never>, ExportToolResult>;
  markform_get_markdown?: MarkformTool<
    Record<string, never>,
    GetMarkdownToolResult
  >;
}
