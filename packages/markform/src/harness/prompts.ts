/**
 * Agent Prompts - Centralized prompt definitions for the live agent.
 *
 * All hardcoded prompts are defined here for easy review, modification,
 * and future configurability. This file serves as the single source of
 * truth for agent behavior instructions.
 */

// =============================================================================
// System Prompts
// =============================================================================

/**
 * Default system prompt for the live agent.
 *
 * This is the base instruction set that defines the agent's core behavior
 * for form filling. It emphasizes accuracy over completeness and prohibits
 * fabrication of data.
 */
export const DEFAULT_SYSTEM_PROMPT = `You are a form-filling assistant. Your task is to analyze form issues and generate patches to fill in the required fields.

Guidelines:
1. Focus on required fields first (severity: "required")
2. NEVER fabricate or guess information - only use data you can verify
3. Leave fields empty when information cannot be found or verified
4. Match the expected field types exactly
5. For string fields: use appropriate text from verified sources
6. For number fields: use appropriate numeric values from verified sources
7. For single_select: choose one valid option ID
8. For multi_select: choose one or more valid option IDs
9. For checkboxes: set appropriate states (done/todo for simple, yes/no for explicit)

CRITICAL: Accuracy is more important than completeness. An empty field is better than fabricated data.

Always use the generatePatches tool to submit your field values.`;

/**
 * Web search instructions appended when web search tools are available.
 *
 * These instructions enforce that the agent must verify all information
 * through web search before filling fields.
 */
export const WEB_SEARCH_INSTRUCTIONS = `# Web Search
You have access to web search tools. You MUST use them to verify ALL information before filling fields.

REQUIREMENTS:
1. Search for official sources (company websites, Crunchbase, LinkedIn, press releases)
2. Cross-reference information across multiple sources when possible
3. Only fill fields with data you found and verified through search
4. If a search returns no results or uncertain information, leave the field empty
5. NEVER fill fields with guessed or assumed information

Remember: An empty field is always better than fabricated data.`;

// =============================================================================
// Tool Descriptions
// =============================================================================

/**
 * Description for the generatePatches tool.
 *
 * This tells the model how to use the patch submission tool.
 */
export const GENERATE_PATCHES_TOOL_DESCRIPTION =
  "Generate patches to fill form fields. Each patch sets a field value. " +
  "Use the field IDs from the issues list. Return patches for all issues you can address.";

// =============================================================================
// Context Prompt Templates
// =============================================================================

/**
 * Header for the issues section in the context prompt.
 */
export const ISSUES_HEADER = "# Current Form Issues";

/**
 * Template for the issues intro text.
 * @param maxPatches - Maximum number of patches to generate
 */
export function getIssuesIntro(maxPatches: number): string {
  return `You need to address up to ${maxPatches} issues. Here are the current issues:`;
}

/**
 * Instructions section for the context prompt.
 *
 * This explains the patch format for each field type.
 */
export const PATCH_FORMAT_INSTRUCTIONS = `# Instructions

Use the generatePatches tool to submit patches for the fields above.
Each patch should match the field type:
- string: { op: "set_string", fieldId: "...", value: "..." }
- number: { op: "set_number", fieldId: "...", value: 123 }
- string_list: { op: "set_string_list", fieldId: "...", items: ["...", "..."] }
- single_select: { op: "set_single_select", fieldId: "...", selected: "option_id" }
- multi_select: { op: "set_multi_select", fieldId: "...", selected: ["opt1", "opt2"] }
- checkboxes: { op: "set_checkboxes", fieldId: "...", values: { "opt1": "done", "opt2": "todo" } }
- url: { op: "set_url", fieldId: "...", value: "https://..." }
- url_list: { op: "set_url_list", fieldId: "...", items: ["https://...", "https://..."] }`;

// =============================================================================
// Section Headers
// =============================================================================

/**
 * Section headers used when building the composed system prompt.
 */
export const SECTION_HEADERS = {
  formInstructions: "# Form Instructions",
  roleInstructions: (role: string) => `# Instructions for ${role} role`,
  roleGuidance: "# Role guidance",
  fieldInstructions: "# Field-specific instructions",
  additionalContext: "# Additional Context",
} as const;
