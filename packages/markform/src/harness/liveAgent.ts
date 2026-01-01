/**
 * Live Agent - LLM-powered agent for form filling.
 *
 * Uses AI SDK to call an LLM that fills forms autonomously
 * by analyzing issues and generating appropriate patches.
 */

import type { LanguageModel, Tool } from 'ai';
import { generateText, stepCountIs, zodSchema } from 'ai';
import { z } from 'zod';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { xai } from '@ai-sdk/xai';

import type {
  DocumentationBlock,
  InspectIssue,
  ParsedForm,
  Patch,
  PatchRejection,
} from '../engine/coreTypes.js';
import { PatchSchema } from '../engine/coreTypes.js';
import { serialize } from '../engine/serialize.js';
import { DEFAULT_ROLE_INSTRUCTIONS, AGENT_ROLE } from '../settings.js';
import { getWebSearchConfig } from '../llms.js';
import type {
  Agent,
  AgentResponse,
  FillCallbacks,
  LiveAgentConfig,
  TurnStats,
} from './harnessTypes.js';
import {
  DEFAULT_SYSTEM_PROMPT,
  WEB_SEARCH_INSTRUCTIONS,
  ISSUES_HEADER,
  getIssuesIntro,
  PATCH_FORMAT_INSTRUCTIONS,
  SECTION_HEADERS,
  getPatchFormatHint,
} from './prompts.js';
import { FILL_FORM_TOOL_NAME, FILL_FORM_TOOL_DESCRIPTION } from './toolApi.js';

// Re-export types for backwards compatibility
export type { LiveAgentConfig } from './harnessTypes.js';

// =============================================================================
// Live Agent Implementation
// =============================================================================

/**
 * Live agent that uses an LLM to generate patches.
 */
export class LiveAgent implements Agent {
  private model: LanguageModel;
  private maxStepsPerTurn: number;
  private systemPromptAddition?: string;
  private targetRole: string;
  private provider?: string;
  private enableWebSearch: boolean;
  private webSearchTools: Record<string, Tool> | null = null;
  private additionalTools: Record<string, Tool>;
  private callbacks?: FillCallbacks;

  constructor(config: LiveAgentConfig) {
    this.model = config.model;
    this.maxStepsPerTurn = config.maxStepsPerTurn ?? 3;
    this.systemPromptAddition = config.systemPromptAddition;
    this.targetRole = config.targetRole ?? AGENT_ROLE;
    this.provider = config.provider;
    this.enableWebSearch = config.enableWebSearch;
    this.additionalTools = config.additionalTools ?? {};
    this.callbacks = config.callbacks;

    // Eagerly load web search tools to enable early logging
    if (this.enableWebSearch && this.provider) {
      this.webSearchTools = loadWebSearchTools(this.provider);
    }
  }

  /**
   * Get list of available tool names for this agent.
   * Useful for logging what capabilities the agent has.
   */
  getAvailableToolNames(): string[] {
    const tools = [FILL_FORM_TOOL_NAME];
    if (this.webSearchTools) {
      tools.push(...Object.keys(this.webSearchTools));
    }
    // Add custom tool names (may overlap with web search if replacing)
    tools.push(...Object.keys(this.additionalTools));
    // Dedupe in case custom tools replace built-in
    return [...new Set(tools)];
  }

  /**
   * Invoke the fill_form tool using the LLM.
   *
   * Each call is stateless - the full form context is provided fresh each turn.
   * The form itself carries all state (filled values, remaining issues).
   * Returns patches and per-turn stats for observability.
   *
   * @param issues - Current issues to address
   * @param form - Current form state
   * @param maxPatches - Maximum patches to generate
   * @param previousRejections - Rejections from previous turn (helps LLM learn from mistakes)
   */
  async fillFormTool(
    issues: InspectIssue[],
    form: ParsedForm,
    maxPatches: number,
    previousRejections?: PatchRejection[],
  ): Promise<AgentResponse> {
    // Build context prompt with issues and form schema (include previous rejections if any)
    const contextPrompt = buildContextPrompt(issues, form, maxPatches, previousRejections);

    // Build composed system prompt from form instructions
    let systemPrompt = buildSystemPrompt(form, this.targetRole, issues);

    // Append additional context if provided (never overrides form instructions)
    if (this.systemPromptAddition) {
      systemPrompt += '\n\n# Additional Context\n' + this.systemPromptAddition;
    }

    // Web search tools are loaded in constructor, but check again for runtime changes
    if (this.enableWebSearch && this.provider && !this.webSearchTools) {
      this.webSearchTools = loadWebSearchTools(this.provider);
    }

    // If web search is available, add instructions to use it
    if (this.webSearchTools && Object.keys(this.webSearchTools).length > 0) {
      systemPrompt += '\n\n' + WEB_SEARCH_INSTRUCTIONS;
    }

    // Define the patch tool with properly typed parameters
    const patchesSchema = z.object({
      patches: z
        .array(PatchSchema)
        .max(maxPatches)
        .describe('Array of patches. Each patch sets a value for one field.'),
    });

    // Create tool using zodSchema wrapper for AI SDK v6 compatibility
    const fillFormToolDef: Tool = {
      description: FILL_FORM_TOOL_DESCRIPTION,
      inputSchema: zodSchema(patchesSchema),
    };

    // Combine all tools (custom tools win on name collision)
    const rawTools: Record<string, Tool> = {
      [FILL_FORM_TOOL_NAME]: fillFormToolDef,
      ...this.webSearchTools,
      ...this.additionalTools,
    };

    // Wrap tools with callbacks for observability
    const tools = wrapToolsWithCallbacks(rawTools, this.callbacks);

    // Get model ID for callbacks (may not be available on all model types)
    const modelId = (this.model as { modelId?: string }).modelId ?? 'unknown';

    // Call onLlmCallStart callback (errors don't abort)
    if (this.callbacks?.onLlmCallStart) {
      try {
        this.callbacks.onLlmCallStart({ model: modelId });
      } catch {
        // Ignore callback errors
      }
    }

    // Call the model (stateless - full context provided each turn)
    const result = await generateText({
      model: this.model,
      system: systemPrompt,
      prompt: contextPrompt,
      tools,
      stopWhen: stepCountIs(this.maxStepsPerTurn),
    });

    // Call onLlmCallEnd callback (errors don't abort)
    if (this.callbacks?.onLlmCallEnd) {
      try {
        this.callbacks.onLlmCallEnd({
          model: modelId,
          inputTokens: result.usage?.inputTokens ?? 0,
          outputTokens: result.usage?.outputTokens ?? 0,
        });
      } catch {
        // Ignore callback errors
      }
    }

    // Extract patches from tool calls and count tool usage
    const patches: Patch[] = [];
    const toolCallCounts = new Map<string, number>();

    for (const step of result.steps) {
      for (const toolCall of step.toolCalls) {
        // Count tool calls
        const count = toolCallCounts.get(toolCall.toolName) ?? 0;
        toolCallCounts.set(toolCall.toolName, count + 1);

        // Extract patches from fill_form calls
        if (toolCall.toolName === FILL_FORM_TOOL_NAME && 'input' in toolCall) {
          const input = toolCall.input as { patches: Patch[] };
          patches.push(...input.patches);
        }
      }
    }

    // Build tool call stats
    const toolCalls: TurnStats['toolCalls'] = [];
    for (const [name, count] of toolCallCounts) {
      toolCalls.push({ name, count });
    }

    // Count remaining issues by severity
    const requiredRemaining = issues.filter((i) => i.severity === 'required').length;
    const optionalRemaining = issues.filter((i) => i.severity === 'recommended').length;

    // Build stats
    const stats: TurnStats = {
      inputTokens: result.usage?.inputTokens,
      outputTokens: result.usage?.outputTokens,
      toolCalls,
      formProgress: {
        // Note: these are the counts BEFORE this turn's patches are applied
        // The caller will update these after applying patches
        answeredFields: Object.values(form.responsesByFieldId).filter(
          (response) => response?.state === 'answered',
        ).length,
        skippedFields: Object.values(form.responsesByFieldId).filter(
          (response) => response?.state === 'skipped',
        ).length,
        requiredRemaining,
        optionalRemaining,
      },
      prompts: {
        system: systemPrompt,
        context: contextPrompt,
      },
    };

    // Limit to maxPatches and return with stats
    return {
      patches: patches.slice(0, maxPatches),
      stats,
    };
  }
}

// =============================================================================
// Context Building
// =============================================================================

/**
 * Extract doc blocks of a specific tag type for a given ref.
 */
function getDocBlocks(docs: DocumentationBlock[], ref: string, tag: string): DocumentationBlock[] {
  return docs.filter((d) => d.ref === ref && d.tag === tag);
}

/**
 * Build a composed system prompt from form instructions.
 *
 * Instruction sources (later ones augment earlier):
 * 1. Base form instructions - Doc blocks with ref=formId and tag="instructions"
 * 2. Role-specific instructions - From form.metadata.roleInstructions[targetRole]
 * 3. Per-field instructions - Doc blocks with ref=fieldId and tag="instructions"
 * 4. System defaults - DEFAULT_ROLE_INSTRUCTIONS[targetRole] or DEFAULT_SYSTEM_PROMPT
 */
function buildSystemPrompt(form: ParsedForm, targetRole: string, issues: InspectIssue[]): string {
  const sections: string[] = [];

  // Start with base system prompt guidelines
  sections.push(DEFAULT_SYSTEM_PROMPT);

  // 1. Form-level instructions (doc blocks with kind="instructions" for the form)
  const formInstructions = getDocBlocks(form.docs, form.schema.id, 'instructions');
  if (formInstructions.length > 0) {
    sections.push('');
    sections.push(SECTION_HEADERS.formInstructions);
    for (const doc of formInstructions) {
      sections.push(doc.bodyMarkdown.trim());
    }
  }

  // 2. Role-specific instructions from frontmatter
  const roleInstructions = form.metadata?.roleInstructions?.[targetRole];
  if (roleInstructions) {
    sections.push('');
    sections.push(SECTION_HEADERS.roleInstructions(targetRole));
    sections.push(roleInstructions);
  } else {
    // Fallback to default role instructions
    const defaultRoleInstr = DEFAULT_ROLE_INSTRUCTIONS[targetRole];
    if (defaultRoleInstr) {
      sections.push('');
      sections.push(SECTION_HEADERS.roleGuidance);
      sections.push(defaultRoleInstr);
    }
  }

  // 3. Per-field instructions for fields being addressed
  const fieldIds = new Set(issues.filter((i) => i.scope === 'field').map((i) => i.ref));
  const fieldInstructions: string[] = [];

  for (const fieldId of fieldIds) {
    const fieldDocs = getDocBlocks(form.docs, fieldId, 'instructions');
    if (fieldDocs.length > 0) {
      for (const doc of fieldDocs) {
        fieldInstructions.push(`**${fieldId}:** ${doc.bodyMarkdown.trim()}`);
      }
    }
  }

  if (fieldInstructions.length > 0) {
    sections.push('');
    sections.push(SECTION_HEADERS.fieldInstructions);
    sections.push(...fieldInstructions);
  }

  return sections.join('\n');
}

/**
 * Build a context prompt with full form state and remaining issues.
 *
 * The form markdown shows the agent exactly what's been filled so far,
 * making each turn stateless - all state is in the form itself.
 *
 * @param issues - Current issues to address
 * @param form - Current form state
 * @param maxPatches - Maximum patches to generate
 * @param previousRejections - Rejections from previous turn (helps LLM learn from mistakes)
 */
function buildContextPrompt(
  issues: InspectIssue[],
  form: ParsedForm,
  maxPatches: number,
  previousRejections?: PatchRejection[],
): string {
  const lines: string[] = [];

  // If there were rejections from previous turn, show them first so the model learns
  if (previousRejections && previousRejections.length > 0) {
    lines.push('# Previous Patch Errors');
    lines.push('');
    lines.push(
      'Your previous patches were rejected due to the following errors. Please fix these issues:',
    );
    lines.push('');
    for (const rejection of previousRejections) {
      lines.push(`- **Error:** ${rejection.message}`);
      // If we have field info, show the correct patch format
      if (rejection.fieldKind) {
        const hint = getPatchFormatHint(
          rejection.fieldKind,
          rejection.fieldId,
          rejection.columnIds,
        );
        lines.push(`  **Use instead:** ${hint}`);
      }
    }
    lines.push('');
  }

  // Include full form markdown so agent sees current state
  lines.push('# Current Form State');
  lines.push('');
  lines.push('Below is the complete form with all currently filled values.');
  lines.push('Fields marked with `[ ]` or empty values still need to be filled.');
  lines.push('');
  lines.push('```markdown');
  lines.push(serialize(form));
  lines.push('```');
  lines.push('');

  // List remaining issues
  lines.push(ISSUES_HEADER);
  lines.push('');
  lines.push(getIssuesIntro(maxPatches));
  lines.push('');

  for (const issue of issues) {
    lines.push(`- **${issue.ref}** (${issue.scope}): ${issue.message}`);
    lines.push(`  Severity: ${issue.severity}, Priority: P${issue.priority}`);

    // If it's a field issue, include field schema info
    if (issue.scope === 'field') {
      const field = findField(form, issue.ref);
      if (field) {
        lines.push(`  Type: ${field.kind}`);
        if ('options' in field && field.options) {
          const optionIds = field.options.map((o) => o.id).join(', ');
          lines.push(`  Options: ${optionIds}`);
        }
        if (field.kind === 'checkboxes' && 'checkboxMode' in field) {
          lines.push(`  Mode: ${field.checkboxMode ?? 'multi'}`);
        }
        // For table fields, show column IDs so the model knows the expected row structure
        if (field.kind === 'table' && 'columns' in field && field.columns) {
          const columnInfo = field.columns
            .map((c) => `${c.id}${c.required ? ' (required)' : ''}`)
            .join(', ');
          lines.push(`  Columns: ${columnInfo}`);
          if (field.minRows !== undefined || field.maxRows !== undefined) {
            const constraints = [];
            if (field.minRows !== undefined) constraints.push(`min: ${field.minRows}`);
            if (field.maxRows !== undefined) constraints.push(`max: ${field.maxRows}`);
            lines.push(`  Rows: ${constraints.join(', ')}`);
          }
        }
      }
    }
    lines.push('');
  }

  lines.push(PATCH_FORMAT_INSTRUCTIONS);

  return lines.join('\n');
}

/**
 * Find a field by ID in the form.
 */
function findField(form: ParsedForm, fieldId: string) {
  for (const group of form.schema.groups) {
    for (const field of group.children) {
      if (field.id === fieldId) {
        return field;
      }
    }
  }
  return null;
}

// =============================================================================
// Tool Wrapping for Callbacks
// =============================================================================

/**
 * Wrap tools with callbacks for observability.
 *
 * Only wraps tools that have an execute function.
 * Declarative tools (schema only) are passed through unchanged.
 */
function wrapToolsWithCallbacks(
  tools: Record<string, Tool>,
  callbacks?: FillCallbacks,
): Record<string, Tool> {
  // Skip wrapping if no tool callbacks
  if (!callbacks?.onToolStart && !callbacks?.onToolEnd) {
    return tools;
  }

  const wrapped: Record<string, Tool> = {};
  for (const [name, tool] of Object.entries(tools)) {
    // Check if tool has an execute function we can wrap
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
    const execute = (tool as any).execute;
    if (typeof execute === 'function') {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      wrapped[name] = wrapTool(name, tool, execute, callbacks);
    } else {
      // Pass through declarative tools unchanged
      wrapped[name] = tool;
    }
  }
  return wrapped;
}

/**
 * Wrap a single tool with callbacks.
 */
function wrapTool(
  name: string,
  tool: Tool,
  originalExecute: (input: unknown) => Promise<unknown>,
  callbacks: FillCallbacks,
): Tool {
  return {
    ...tool,
    execute: async (input: unknown) => {
      const startTime = Date.now();

      // Call onToolStart (errors don't abort)
      if (callbacks.onToolStart) {
        try {
          callbacks.onToolStart({ name, input });
        } catch {
          // Ignore callback errors
        }
      }

      try {
        const output = await originalExecute(input);

        // Call onToolEnd on success (errors don't abort)
        if (callbacks.onToolEnd) {
          try {
            callbacks.onToolEnd({
              name,
              output,
              durationMs: Date.now() - startTime,
            });
          } catch {
            // Ignore callback errors
          }
        }

        return output;
      } catch (error) {
        // Call onToolEnd on error (errors don't abort)
        if (callbacks.onToolEnd) {
          try {
            callbacks.onToolEnd({
              name,
              output: null,
              durationMs: Date.now() - startTime,
              error: error instanceof Error ? error.message : String(error),
            });
          } catch {
            // Ignore callback errors
          }
        }
        throw error;
      }
    },
  };
}

// =============================================================================
// Web Search Tools
// =============================================================================

/**
 * Load web search tools for a provider.
 * Uses centralized config from llms.ts.
 */
function loadWebSearchTools(provider: string): Record<string, Tool> {
  const config = getWebSearchConfig(provider);
  if (!config?.toolName) return {};

  switch (provider) {
    case 'openai': {
      const tool = openai.tools?.webSearch?.({}) ?? openai.tools?.webSearchPreview?.({});
      if (tool) return { web_search: tool as Tool };
      return {};
    }
    case 'anthropic': {
      const tool = anthropic.tools?.webSearch_20250305?.({});
      if (tool) return { web_search: tool as Tool };
      return {};
    }
    case 'google': {
      const tool = google.tools?.googleSearch?.({});
      if (tool) return { google_search: tool as Tool };
      return {};
    }
    case 'xai': {
      const tool = xai.tools?.webSearch?.({});
      if (tool) return { web_search: tool as Tool };
      return {};
    }
    default:
      return {};
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a live agent with the given configuration.
 */
export function createLiveAgent(config: LiveAgentConfig): LiveAgent {
  return new LiveAgent(config);
}
