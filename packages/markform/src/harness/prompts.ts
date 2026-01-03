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
export const DEFAULT_SYSTEM_PROMPT = `# Form Instructions

Research and fill the form fields using all available tools. Focus on accuracy over completeness.

## Guidelines
1. Address required fields first (severity: "required"), then optional fields (severity: "recommended")
2. NEVER fabricate or guess information - only use data you can verify
3. If you cannot find verifiable information, use skip_field with a reason

## Patch Format Examples

Use the fill_form tool with patches in these formats:

| Type | Example |
|------|---------|
| string | \`{ op: "set_string", fieldId: "name", value: "Acme Corp" }\` |
| number | \`{ op: "set_number", fieldId: "age", value: 32 }\` |
| string_list | \`{ op: "set_string_list", fieldId: "tags", value: ["ai", "ml"] }\` |
| url | \`{ op: "set_url", fieldId: "website", value: "https://example.com" }\` |
| url_list | \`{ op: "set_url_list", fieldId: "sources", value: ["https://a.com", "https://b.com"] }\` |
| date | \`{ op: "set_date", fieldId: "event_date", value: "2024-06-15" }\` |
| year | \`{ op: "set_year", fieldId: "founded", value: 2024 }\` |
| single_select | \`{ op: "set_single_select", fieldId: "priority", value: "high" }\` |
| multi_select | \`{ op: "set_multi_select", fieldId: "categories", value: ["frontend", "backend"] }\` |
| checkboxes | \`{ op: "set_checkboxes", fieldId: "tasks", value: { "task1": "done", "task2": "todo" } }\` |

## ⚠️ CRITICAL: checkboxes vs multi_select

These two types look similar but have DIFFERENT value formats:

- **multi_select** → array of option IDs: \`["opt1", "opt2"]\`
- **checkboxes** → object mapping IDs to states: \`{ "opt1": "done", "opt2": "todo" }\`

**Checkbox states by mode:**
- Mode "simple": \`"done"\` or \`"todo"\`
- Mode "multi": \`"done"\`, \`"todo"\`, or \`"na"\`
- Mode "explicit": \`"yes"\` or \`"no"\`

**WRONG:** \`{ op: "set_checkboxes", value: ["task1", "task2"] }\`
**RIGHT:** \`{ op: "set_checkboxes", value: { "task1": "done", "task2": "done" } }\`

## Skipping Fields

If you cannot find verifiable information:
\`{ op: "skip_field", fieldId: "...", reason: "Could not find verified data" }\`
`;

/**
 * Web search instructions appended when web search tools are available.
 *
 * These instructions enforce that the agent must verify all information
 * through web search before filling fields.
 */
export const WEB_SEARCH_INSTRUCTIONS = `# Web Search
You have access to web search tools. You MUST use them to verify ALL information before filling fields.

Guidelines:
1. Search for official sources (company websites, Crunchbase, LinkedIn, press releases)
2. Cross-reference information across multiple sources when possible
3. Only fill fields with data you found and verified through search
4. If a search returns no results or uncertain information, use skip_field with a reason explaining what you searched for
5. NEVER fill fields with guessed or assumed information
`;

// =============================================================================
// Context Prompt Templates
// =============================================================================

/**
 * Header for the issues section in the context prompt.
 */
export const ISSUES_HEADER = '# Current Form Issues';

/**
 * Template for the issues intro text.
 * @param issueCount - Actual number of issues shown
 */
export function getIssuesIntro(issueCount: number): string {
  return `You need to address ${issueCount} issue${issueCount === 1 ? '' : 's'}. Here are the current issues:`;
}

/**
 * Patch format examples by field kind.
 *
 * This is the single source of truth for patch format documentation.
 * Used in PATCH_FORMAT_INSTRUCTIONS and rejection feedback hints.
 */
export const PATCH_FORMATS: Record<string, string> = {
  string: '{ op: "set_string", fieldId: "...", value: "text here" }',
  number: '{ op: "set_number", fieldId: "...", value: 42 }',
  string_list: '{ op: "set_string_list", fieldId: "...", value: ["item1", "item2"] }',
  single_select: '{ op: "set_single_select", fieldId: "...", value: "option_id" }',
  multi_select: '{ op: "set_multi_select", fieldId: "...", value: ["opt1", "opt2"] }',
  checkboxes: '{ op: "set_checkboxes", fieldId: "...", value: { "opt1": "done", "opt2": "todo" } }',
  url: '{ op: "set_url", fieldId: "...", value: "https://example.com" }',
  url_list: '{ op: "set_url_list", fieldId: "...", value: ["https://a.com", "https://b.com"] }',
  date: '{ op: "set_date", fieldId: "...", value: "2024-06-15" }',
  year: '{ op: "set_year", fieldId: "...", value: 2024 }',
  table: '{ op: "set_table", fieldId: "...", value: [{ col1: "val1", col2: "val2" }] }',
};

/**
 * Checkbox-mode-specific format hints.
 * Used to provide clearer examples based on the checkbox mode.
 */
export const CHECKBOX_MODE_HINTS: Record<string, string> = {
  simple: '{ "opt1": "done", "opt2": "todo" }  // states: done, todo',
  multi: '{ "opt1": "done", "opt2": "na" }  // states: done, todo, na',
  explicit: '{ "opt1": "yes", "opt2": "no" }  // states: yes, no',
};

/**
 * Options for generating patch format hints.
 */
export interface PatchFormatHintOptions {
  fieldId?: string;
  columnIds?: string[];
  checkboxMode?: 'simple' | 'multi' | 'explicit';
  optionIds?: string[];
}

/**
 * Get the correct patch format for a field kind.
 *
 * @param fieldKind - The field kind (e.g., "table", "string")
 * @param options - Optional configuration for the hint
 * @returns The patch format example string
 */
export function getPatchFormatHint(
  fieldKind: string,
  fieldIdOrOptions?: string | PatchFormatHintOptions,
  columnIds?: string[],
): string {
  // Handle legacy call signature: getPatchFormatHint(kind, fieldId, columnIds)
  let options: PatchFormatHintOptions = {};
  if (typeof fieldIdOrOptions === 'string') {
    options = { fieldId: fieldIdOrOptions, columnIds };
  } else if (fieldIdOrOptions) {
    options = fieldIdOrOptions;
  }

  let format = PATCH_FORMATS[fieldKind];
  if (!format) {
    return `Use the correct set_${fieldKind} operation for this field type.`;
  }

  // Substitute field ID if provided
  if (options.fieldId) {
    format = format.replace('fieldId: "..."', `fieldId: "${options.fieldId}"`);
  }

  // For checkboxes, use mode-specific hints with actual option IDs if available
  if (fieldKind === 'checkboxes') {
    const mode = options.checkboxMode ?? 'multi';
    const optIds = options.optionIds ?? ['opt1', 'opt2'];
    const stateMap: Record<string, [string, string]> = {
      simple: ['done', 'todo'],
      multi: ['done', 'todo'],
      explicit: ['yes', 'no'],
    };
    const [state1, state2] = stateMap[mode] ?? ['done', 'todo'];

    // Build concrete example with actual option IDs
    const valueExample =
      optIds.length >= 2
        ? `{ "${optIds[0]}": "${state1}", "${optIds[1]}": "${state2}" }`
        : optIds.length === 1
          ? `{ "${optIds[0]}": "${state1}" }`
          : `{ "opt1": "${state1}", "opt2": "${state2}" }`;

    format = format.replace('{ "opt1": "done", "opt2": "todo" }', valueExample);
  }

  // For table fields, show actual column IDs if available
  if (fieldKind === 'table' && options.columnIds && options.columnIds.length > 0) {
    const colExample = options.columnIds.map((id) => `"${id}": "..."`).join(', ');
    format = format.replace('{ col1: "val1", col2: "val2" }', `{ ${colExample} }`);
  }

  return format;
}

/**
 * Instructions section for the context prompt.
 *
 * This explains the patch format for each field kind.
 * Generated from PATCH_FORMATS to ensure consistency.
 */
export const PATCH_FORMAT_INSTRUCTIONS = `# Instructions

Use the fill_form tool to submit patches for the fields above.
Each patch should match the field kind:
${Object.entries(PATCH_FORMATS)
  .map(([kind, format]) => `- ${kind}: ${format}`)
  .join('\n')}

For table fields, use the column IDs shown in the field schema. Each row is an object with column ID keys.

If you cannot find verifiable information for a field, skip it:
- skip: { op: "skip_field", fieldId: "...", reason: "Information not available" }`;

/**
 * Simplified general instructions for use with inline field instructions.
 *
 * When inline field instructions are shown after each issue, we only need
 * general guidance about using the fill_form tool.
 */
export const GENERAL_INSTRUCTIONS = `# General Instructions

Use the fill_form tool to submit patches for the fields above.
For table fields, each row is an object with column ID keys.`;

// =============================================================================
// Section Headers
// =============================================================================

/**
 * Section headers used when building the composed system prompt.
 */
export const SECTION_HEADERS = {
  formInstructions: '# Form Instructions',
  roleInstructions: (role: string) => `# Instructions for ${role} role`,
  roleGuidance: '# Role guidance',
  fieldInstructions: '# Field-specific instructions',
  additionalContext: '# Additional Context',
} as const;
