/**
 * AI SDK Integration for Markform.
 *
 * Provides Vercel AI SDK compatible tools for agent-driven form filling.
 * Use createMarkformTools() to create a toolset that wraps the Markform engine.
 *
 * @example
 * ```typescript
 * import { createMarkformTools, MarkformSessionStore } from 'markform/ai-sdk';
 * import { generateText } from 'ai';
 *
 * const store = new MarkformSessionStore(parsedForm);
 * const tools = createMarkformTools({ sessionStore: store });
 *
 * const { text } = await generateText({
 *   model: openai('gpt-4'),
 *   prompt: 'Fill out this form...',
 *   tools,
 * });
 * ```
 */

import { z } from 'zod';
import type { ParsedForm, Patch, ValidatorRegistry } from '../engine/coreTypes.js';
import { inspect } from '../engine/inspect.js';
import { applyPatches } from '../engine/apply.js';
import { serialize } from '../engine/serialize.js';
import { PatchSchema } from '../engine/coreTypes.js';

// =============================================================================
// Session Store
// =============================================================================

/**
 * Session store for managing form state during AI interactions.
 *
 * The AI SDK tools operate on a shared form instance through this store.
 * Create one store per form-filling session.
 */
export class MarkformSessionStore {
  private form: ParsedForm;
  private validatorRegistry: ValidatorRegistry;

  constructor(form: ParsedForm, validatorRegistry?: ValidatorRegistry) {
    this.form = form;
    this.validatorRegistry = validatorRegistry ?? {};
  }

  /**
   * Get the current form.
   */
  getForm(): ParsedForm {
    return this.form;
  }

  /**
   * Get the validator registry.
   */
  getValidatorRegistry(): ValidatorRegistry {
    return this.validatorRegistry;
  }

  /**
   * Update the form values.
   */
  updateForm(form: ParsedForm): void {
    this.form = form;
  }
}

// =============================================================================
// Tool Creation Options
// =============================================================================

/**
 * Options for creating Markform AI SDK tools.
 */
export interface CreateMarkformToolsOptions {
  /**
   * Session store managing the form state.
   */
  sessionStore: MarkformSessionStore;

  /**
   * Whether to include the markform_get_markdown tool.
   * Defaults to true.
   */
  includeGetMarkdown?: boolean;
}

// =============================================================================
// Tool Types (imported from toolTypes.ts)
// =============================================================================

import type {
  ApplyToolResult,
  ExportToolResult,
  GetMarkdownToolResult,
  InspectToolResult,
  MarkformTool,
  MarkformToolSet,
} from './toolTypes.js';

// Re-export types for backwards compatibility
export type {
  ApplyToolResult,
  ExportToolResult,
  GetMarkdownToolResult,
  InspectToolResult,
  MarkformTool,
  MarkformToolSet,
} from './toolTypes.js';

// =============================================================================
// Zod Schemas for Tool Inputs
// =============================================================================

/**
 * Input schema for markform_inspect tool (no parameters).
 */
const InspectInputSchema = z
  .object({})
  .describe('No input parameters required. Call this tool to inspect the current form state.');

/**
 * Input schema for markform_apply tool.
 */
const ApplyInputSchema = z
  .object({
    patches: z
      .array(PatchSchema)
      .min(1)
      .max(20)
      .describe(
        'Array of patches to apply to the form. Each patch sets or clears a field value. ' +
          'Operations: set_string, set_number, set_string_list, set_single_select, set_multi_select, ' +
          'set_checkboxes, set_url, set_url_list, set_date, set_year, set_table, clear_field, skip_field, abort_field. ' +
          'Example: [{ "op": "set_string", "fieldId": "name", "value": "Alice" }]',
      ),
  })
  .describe('Apply patches to update form field values.');

/**
 * Input schema for markform_export tool (no parameters).
 */
const ExportInputSchema = z
  .object({})
  .describe(
    'No input parameters required. Call this tool to export the form schema and current values as JSON.',
  );

/**
 * Input schema for markform_get_markdown tool (no parameters).
 */
const GetMarkdownInputSchema = z
  .object({})
  .describe(
    'No input parameters required. Call this tool to get the canonical Markdown representation of the current form.',
  );

// =============================================================================
// Tool Factory
// =============================================================================

/**
 * Create Markform AI SDK tools for agent-driven form filling.
 *
 * Returns a toolset compatible with Vercel AI SDK's generateText and streamText.
 *
 * @param options - Tool creation options including session store
 * @returns MarkformToolSet containing all tools
 *
 * @example
 * ```typescript
 * import { parseForm } from 'markform';
 * import { createMarkformTools, MarkformSessionStore } from 'markform/ai-sdk';
 *
 * const form = parseForm(markdownContent);
 * const store = new MarkformSessionStore(form);
 * const tools = createMarkformTools({ sessionStore: store });
 *
 * // Use with AI SDK
 * const result = await generateText({
 *   model: yourModel,
 *   tools,
 *   prompt: 'Fill out this form based on the user information...',
 * });
 * ```
 */
export function createMarkformTools(options: CreateMarkformToolsOptions): MarkformToolSet {
  const { sessionStore, includeGetMarkdown = true } = options;

  // markform_inspect - Get current form state with issues
  const markform_inspect: MarkformTool<Record<string, never>, InspectToolResult> = {
    description:
      'Inspect the current form state. Returns structure summary, progress summary, validation issues, ' +
      'and completion status. Use this to understand what fields need to be filled and what issues exist. ' +
      "Issues are sorted by priority (1 = highest). Focus on 'required' severity issues first.",
    inputSchema: InspectInputSchema,
    execute: () => {
      const form = sessionStore.getForm();
      const result = inspect(form);

      const requiredCount = result.issues.filter((i) => i.severity === 'required').length;
      const message = result.isComplete
        ? 'Form is complete. All required fields are filled.'
        : `Form has ${requiredCount} required issue(s) to resolve.`;

      return Promise.resolve({
        success: true,
        data: result,
        message,
      });
    },
  };

  // markform_apply - Apply patches to update form values
  const markform_apply: MarkformTool<{ patches: Patch[] }, ApplyToolResult> = {
    description:
      'Apply patches to update form field values. Use this after inspecting the form to set values for ' +
      'fields that need to be filled. Patches are applied as a transaction - all succeed or all fail. ' +
      'Returns the updated form state and any remaining issues. ' +
      'Patch operations: set_string, set_number, set_string_list, set_single_select, set_multi_select, ' +
      'set_checkboxes, set_url, set_url_list, set_date, set_year, set_table, clear_field, skip_field, abort_field.',
    inputSchema: ApplyInputSchema,
    execute: ({ patches }) => {
      const form = sessionStore.getForm();
      const result = applyPatches(form, patches);

      // Update the store with the modified form
      sessionStore.updateForm(form);

      const message =
        result.applyStatus === 'applied'
          ? `Applied ${patches.length} patch(es). ${
              result.isComplete
                ? 'Form is now complete!'
                : `${result.issues.filter((i) => i.severity === 'required').length} required issue(s) remaining.`
            }`
          : `Patches rejected. Check field IDs and value types.`;

      return Promise.resolve({
        success: result.applyStatus === 'applied',
        data: result,
        message,
      });
    },
  };

  // markform_export - Export schema and values as JSON
  const markform_export: MarkformTool<Record<string, never>, ExportToolResult> = {
    description:
      'Export the form schema and current values as JSON. Use this to get a machine-readable ' +
      'representation of the form structure and all field values. Useful for processing or analysis.',
    inputSchema: ExportInputSchema,
    execute: () => {
      const form = sessionStore.getForm();

      // Count answered fields
      const answeredCount = Object.values(form.responsesByFieldId).filter(
        (response) => response.state === 'answered',
      ).length;

      return Promise.resolve({
        success: true,
        data: {
          schema: form.schema,
          values: form.responsesByFieldId,
        },
        message: `Exported form with ${form.schema.groups.length} group(s) and ${answeredCount} answered field(s).`,
      });
    },
  };

  // Build the toolset
  const toolset: MarkformToolSet = {
    markform_inspect,
    markform_apply,
    markform_export,
  };

  // Optionally include markform_get_markdown
  if (includeGetMarkdown) {
    const markform_get_markdown: MarkformTool<Record<string, never>, GetMarkdownToolResult> = {
      description:
        'Get the canonical Markdown representation of the current form. ' +
        'Use this to see the complete form with all current values in Markform format. ' +
        'The output is deterministic and round-trip safe.',
      inputSchema: GetMarkdownInputSchema,
      execute: () => {
        const form = sessionStore.getForm();
        const markdown = serialize(form);

        return Promise.resolve({
          success: true,
          data: {
            markdown,
          },
          message: `Generated Markdown (${markdown.length} characters).`,
        });
      },
    };

    toolset.markform_get_markdown = markform_get_markdown;
  }

  return toolset;
}

// =============================================================================
// Convenience Exports
// =============================================================================

export { PatchSchema } from '../engine/coreTypes.js';
