/**
 * Live Agent - LLM-powered agent for form filling.
 *
 * Uses AI SDK to call an LLM that fills forms autonomously
 * by analyzing issues and generating appropriate patches.
 */

import type { LanguageModel, Tool } from "ai";
import { generateText, stepCountIs, zodSchema } from "ai";
import { z } from "zod";
import { openai } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";

import type {
  DocumentationBlock,
  InspectIssue,
  ParsedForm,
  Patch,
} from "../engine/coreTypes.js";
import { PatchSchema } from "../engine/coreTypes.js";
import { DEFAULT_ROLE_INSTRUCTIONS, AGENT_ROLE, getWebSearchConfig } from "../settings.js";
import type { Agent, LiveAgentConfig } from "./harnessTypes.js";
import {
  DEFAULT_SYSTEM_PROMPT,
  WEB_SEARCH_INSTRUCTIONS,
  GENERATE_PATCHES_TOOL_DESCRIPTION,
  ISSUES_HEADER,
  getIssuesIntro,
  PATCH_FORMAT_INSTRUCTIONS,
  SECTION_HEADERS,
} from "./prompts.js";

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
      this.webSearchTools = loadWebSearchTools(this.provider);

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
      systemPrompt += "\n\n" + WEB_SEARCH_INSTRUCTIONS;
    }

    // Define the patch tool with properly typed parameters
    const patchesSchema = z.object({
      patches: z.array(PatchSchema).max(maxPatches).describe(
        "Array of patches. Each patch sets a value for one field."
      ),
    });

    // Create tool using zodSchema wrapper for AI SDK v6 compatibility
    const generatePatchesTool: Tool = {
      description: GENERATE_PATCHES_TOOL_DESCRIPTION,
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
    sections.push(SECTION_HEADERS.formInstructions);
    for (const doc of formInstructions) {
      sections.push(doc.bodyMarkdown.trim());
    }
  }

  // 2. Role-specific instructions from frontmatter
  const roleInstructions = form.metadata?.roleInstructions?.[targetRole];
  if (roleInstructions) {
    sections.push("");
    sections.push(SECTION_HEADERS.roleInstructions(targetRole));
    sections.push(roleInstructions);
  } else {
    // Fallback to default role instructions
    const defaultRoleInstr = DEFAULT_ROLE_INSTRUCTIONS[targetRole];
    if (defaultRoleInstr) {
      sections.push("");
      sections.push(SECTION_HEADERS.roleGuidance);
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
    sections.push(SECTION_HEADERS.fieldInstructions);
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

  lines.push(ISSUES_HEADER);
  lines.push("");
  lines.push(getIssuesIntro(maxPatches));
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

  lines.push(PATCH_FORMAT_INSTRUCTIONS);

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
 * Uses statically imported provider modules to get web search tools.
 * Returns empty object if provider doesn't support web search.
 */
function loadWebSearchTools(provider: string): Record<string, Tool> {
  const config = getWebSearchConfig(provider);
  if (!config) {
    return {};
  }

  switch (provider) {
    case "openai": {
      // OpenAI web search tool via openai.tools
      // Prefer webSearch (newer) over webSearchPreview (legacy)
      if (openai.tools.webSearch) {
        return { web_search: openai.tools.webSearch({}) as Tool };
      }
      if (openai.tools.webSearchPreview) {
        return { web_search: openai.tools.webSearchPreview({}) as Tool };
      }
      return {};
    }

    case "google": {
      // Google search grounding tool via google.tools
      if (google.tools?.googleSearch) {
        return { google_search: google.tools.googleSearch({}) as Tool };
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
