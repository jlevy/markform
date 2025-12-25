/**
 * Live Agent - LLM-powered agent for form filling.
 *
 * Uses AI SDK to call an LLM that fills forms autonomously
 * by analyzing issues and generating appropriate patches.
 */

import type { LanguageModel, Tool } from "ai";
import { generateText, stepCountIs, zodSchema } from "ai";
import { z } from "zod";

import type {
  DocumentationBlock,
  InspectIssue,
  ParsedForm,
  Patch,
} from "../engine/coreTypes.js";
import { PatchSchema } from "../engine/coreTypes.js";
import { DEFAULT_ROLE_INSTRUCTIONS, AGENT_ROLE, getWebSearchConfig } from "../settings.js";
import type { Agent, LiveAgentConfig } from "./harnessTypes.js";

// Re-export types for backwards compatibility
export type { LiveAgentConfig } from "./harnessTypes.js";

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

  constructor(config: LiveAgentConfig) {
    this.model = config.model;
    this.maxStepsPerTurn = config.maxStepsPerTurn ?? 3;
    this.systemPromptAddition = config.systemPromptAddition;
    this.targetRole = config.targetRole ?? AGENT_ROLE;
    this.provider = config.provider;
    this.enableWebSearch = config.enableWebSearch ?? true;
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

    // Build composed system prompt from form instructions
    let systemPrompt = buildSystemPrompt(form, this.targetRole, issues);

    // Append additional context if provided (never overrides form instructions)
    if (this.systemPromptAddition) {
      systemPrompt += "\n\n# Additional Context\n" + this.systemPromptAddition;
    }

    // Load web search tools if enabled and not already loaded
    if (this.enableWebSearch && this.provider && !this.webSearchTools) {
      this.webSearchTools = await loadWebSearchTools(this.provider);

      // Log warning if web search was requested but not available
      if (!this.webSearchTools || Object.keys(this.webSearchTools).length === 0) {
        console.warn(
          `[markform] Web search not available for provider "${this.provider}". ` +
          `Agent will operate without web search capabilities.`
        );
      }
    }

    // If web search is available, add instructions to use it
    if (this.webSearchTools && Object.keys(this.webSearchTools).length > 0) {
      systemPrompt += "\n\n# Web Search\n" +
        "You have access to web search tools. Use them to research and find accurate, up-to-date information " +
        "for the form fields. Search for company websites, news articles, LinkedIn profiles, and other sources " +
        "to gather real data rather than using placeholder values.";
    }

    // Define the patch tool with properly typed parameters
    const patchesSchema = z.object({
      patches: z.array(PatchSchema).max(maxPatches).describe(
        "Array of patches. Each patch sets a value for one field."
      ),
    });

    // Create tool using zodSchema wrapper for AI SDK v6 compatibility
    const generatePatchesTool: Tool = {
      description:
        "Generate patches to fill form fields. Each patch sets a field value. " +
        "Use the field IDs from the issues list. Return patches for all issues you can address.",
      inputSchema: zodSchema(patchesSchema),
    };

    // Combine all tools
    const tools: Record<string, Tool> = {
      generatePatches: generatePatchesTool,
      ...this.webSearchTools,
    };

    // Call the model
    const result = await generateText({
      model: this.model,
      system: systemPrompt,
      prompt: contextPrompt,
      tools,
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
 * Extract doc blocks of a specific tag type for a given ref.
 */
function getDocBlocks(
  docs: DocumentationBlock[],
  ref: string,
  tag: string
): DocumentationBlock[] {
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
function buildSystemPrompt(
  form: ParsedForm,
  targetRole: string,
  issues: InspectIssue[]
): string {
  const sections: string[] = [];

  // Start with base system prompt guidelines
  sections.push(DEFAULT_SYSTEM_PROMPT);

  // 1. Form-level instructions (doc blocks with kind="instructions" for the form)
  const formInstructions = getDocBlocks(form.docs, form.schema.id, "instructions");
  if (formInstructions.length > 0) {
    sections.push("");
    sections.push("# Form Instructions");
    for (const doc of formInstructions) {
      sections.push(doc.bodyMarkdown.trim());
    }
  }

  // 2. Role-specific instructions from frontmatter
  const roleInstructions = form.metadata?.roleInstructions?.[targetRole];
  if (roleInstructions) {
    sections.push("");
    sections.push(`# Instructions for ${targetRole} role`);
    sections.push(roleInstructions);
  } else {
    // Fallback to default role instructions
    const defaultRoleInstr = DEFAULT_ROLE_INSTRUCTIONS[targetRole];
    if (defaultRoleInstr) {
      sections.push("");
      sections.push(`# Role guidance`);
      sections.push(defaultRoleInstr);
    }
  }

  // 3. Per-field instructions for fields being addressed
  const fieldIds = new Set(
    issues.filter((i) => i.scope === "field").map((i) => i.ref)
  );
  const fieldInstructions: string[] = [];

  for (const fieldId of fieldIds) {
    const fieldDocs = getDocBlocks(form.docs, fieldId, "instructions");
    if (fieldDocs.length > 0) {
      for (const doc of fieldDocs) {
        fieldInstructions.push(`**${fieldId}:** ${doc.bodyMarkdown.trim()}`);
      }
    }
  }

  if (fieldInstructions.length > 0) {
    sections.push("");
    sections.push("# Field-specific instructions");
    sections.push(...fieldInstructions);
  }

  return sections.join("\n");
}

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
  lines.push("- url: { op: \"set_url\", fieldId: \"...\", value: \"https://...\" }");
  lines.push("- url_list: { op: \"set_url_list\", fieldId: \"...\", items: [\"https://...\", \"https://...\"] }");

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
// Web Search Tools
// =============================================================================

/**
 * Load web search tools for a provider.
 *
 * Dynamically imports provider-specific web search tools if available.
 * Returns empty object if provider doesn't support web search or tools fail to load.
 */
async function loadWebSearchTools(provider: string): Promise<Record<string, Tool>> {
  const config = getWebSearchConfig(provider);
  if (!config) {
    return {};
  }

  try {
    switch (provider) {
      case "openai": {
        // OpenAI web search preview tool
        // Dynamic import - module structure varies by version
        const openaiModule = await import("@ai-sdk/openai");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
        const webSearch = (openaiModule as any).openaiTools?.webSearchPreview;
        if (webSearch) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          return { web_search: webSearch() as Tool };
        }
        // Try alternative export path
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
        const altWebSearch = (openaiModule as any).webSearchPreview;
        if (altWebSearch) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          return { web_search: altWebSearch() as Tool };
        }
        return {};
      }

      case "google": {
        // Google search grounding tool
        const googleModule = await import("@ai-sdk/google");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
        const googleSearch = (googleModule as any).googleSearch;
        if (googleSearch) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          return { google_search: googleSearch() as Tool };
        }
        return {};
      }

      case "xai": {
        // xAI Grok has built-in web search - no separate tool needed
        // The model itself handles search when prompted
        return {};
      }

      default:
        return {};
    }
  } catch {
    // If tools fail to load, continue without web search
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
