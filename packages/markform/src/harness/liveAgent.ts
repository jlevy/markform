/**
 * Live Agent - LLM-powered agent for form filling.
 *
 * Uses AI SDK to call an LLM that fills forms autonomously
 * by analyzing issues and generating appropriate patches.
 */

import type { LanguageModel } from "ai";
import { generateText, stepCountIs, zodSchema } from "ai";
import { z } from "zod";

import type {
  InspectIssue,
  ParsedForm,
  Patch,
} from "../engine/types.js";
import { PatchSchema } from "../engine/types.js";
import type { Agent } from "./mockAgent.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Configuration for the live agent.
 */
export interface LiveAgentConfig {
  /** The language model to use */
  model: LanguageModel;
  /** Maximum tool call steps per turn (default: 3) */
  maxStepsPerTurn?: number;
  /** Custom system prompt (optional) */
  systemPrompt?: string;
}

// =============================================================================
// Live Agent Implementation
// =============================================================================

/**
 * Live agent that uses an LLM to generate patches.
 */
export class LiveAgent implements Agent {
  private model: LanguageModel;
  private maxStepsPerTurn: number;
  private systemPrompt: string;

  constructor(config: LiveAgentConfig) {
    this.model = config.model;
    this.maxStepsPerTurn = config.maxStepsPerTurn ?? 3;
    this.systemPrompt = config.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
  }

  /**
   * Generate patches using the LLM.
   *
   * Calls the model with the current form state and issues,
   * and extracts patches from the tool calls.
   */
  async generatePatches(
    issues: InspectIssue[],
    form: ParsedForm,
    maxPatches: number
  ): Promise<Patch[]> {
    // Build context prompt with issues and form schema
    const contextPrompt = buildContextPrompt(issues, form, maxPatches);

    // Define the patch tool with properly typed parameters
    const patchesSchema = z.object({
      patches: z.array(PatchSchema).max(maxPatches).describe(
        "Array of patches. Each patch sets a value for one field."
      ),
    });

    // Create tool using zodSchema wrapper for AI SDK v6 compatibility
    const generatePatchesTool = {
      description:
        "Generate patches to fill form fields. Each patch sets a field value. " +
        "Use the field IDs from the issues list. Return patches for all issues you can address.",
      inputSchema: zodSchema(patchesSchema),
    };

    // Call the model
    const result = await generateText({
      model: this.model,
      system: this.systemPrompt,
      prompt: contextPrompt,
      tools: { generatePatches: generatePatchesTool },
      stopWhen: stepCountIs(this.maxStepsPerTurn),
    });

    // Extract patches from tool calls
    const patches: Patch[] = [];
    for (const step of result.steps) {
      for (const toolCall of step.toolCalls) {
        if (toolCall.toolName === "generatePatches" && "input" in toolCall) {
          const input = toolCall.input as { patches: Patch[] };
          patches.push(...input.patches);
        }
      }
    }

    // Limit to maxPatches
    return patches.slice(0, maxPatches);
  }
}

// =============================================================================
// Context Building
// =============================================================================

/**
 * Default system prompt for the live agent.
 */
const DEFAULT_SYSTEM_PROMPT = `You are a form-filling assistant. Your task is to analyze form issues and generate patches to fill in the required fields.

Guidelines:
1. Focus on required fields first (severity: "required")
2. Use realistic but generic values when specific data is not provided
3. Match the expected field types exactly
4. For string fields: use appropriate text
5. For number fields: use appropriate numeric values
6. For single_select: choose one valid option ID
7. For multi_select: choose one or more valid option IDs
8. For checkboxes: set appropriate states (done/todo for simple, yes/no for explicit)

Always use the generatePatches tool to submit your field values.`;

/**
 * Build a context prompt with issues and form information.
 */
function buildContextPrompt(
  issues: InspectIssue[],
  form: ParsedForm,
  maxPatches: number
): string {
  const lines: string[] = [];

  lines.push("# Current Form Issues");
  lines.push("");
  lines.push(`You need to address up to ${maxPatches} issues. Here are the current issues:`);
  lines.push("");

  for (const issue of issues) {
    lines.push(`- **${issue.ref}** (${issue.scope}): ${issue.message}`);
    lines.push(`  Severity: ${issue.severity}, Priority: P${issue.priority}`);

    // If it's a field issue, include field schema info
    if (issue.scope === "field") {
      const field = findField(form, issue.ref);
      if (field) {
        lines.push(`  Type: ${field.kind}`);
        if ("options" in field && field.options) {
          const optionIds = field.options.map((o) => o.id).join(", ");
          lines.push(`  Options: ${optionIds}`);
        }
        if (field.kind === "checkboxes" && "checkboxMode" in field) {
          lines.push(`  Mode: ${field.checkboxMode ?? "multi"}`);
        }
      }
    }
    lines.push("");
  }

  lines.push("# Instructions");
  lines.push("");
  lines.push("Use the generatePatches tool to submit patches for the fields above.");
  lines.push("Each patch should match the field type:");
  lines.push("- string: { op: \"set_string\", fieldId: \"...\", value: \"...\" }");
  lines.push("- number: { op: \"set_number\", fieldId: \"...\", value: 123 }");
  lines.push("- string_list: { op: \"set_string_list\", fieldId: \"...\", items: [\"...\", \"...\"] }");
  lines.push("- single_select: { op: \"set_single_select\", fieldId: \"...\", selected: \"option_id\" }");
  lines.push("- multi_select: { op: \"set_multi_select\", fieldId: \"...\", selected: [\"opt1\", \"opt2\"] }");
  lines.push("- checkboxes: { op: \"set_checkboxes\", fieldId: \"...\", values: { \"opt1\": \"done\", \"opt2\": \"todo\" } }");

  return lines.join("\n");
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
// Factory Function
// =============================================================================

/**
 * Create a live agent with the given configuration.
 */
export function createLiveAgent(config: LiveAgentConfig): LiveAgent {
  return new LiveAgent(config);
}
