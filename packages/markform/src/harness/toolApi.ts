/**
 * Tool API Definitions
 *
 * Single source of truth for all LLM tool names, descriptions, and schemas.
 * This file defines the contract between markform and LLM agents.
 */

// =============================================================================
// Tool Names
// =============================================================================

/** The primary tool for filling form fields */
export const FILL_FORM_TOOL_NAME = 'fill_form';

// =============================================================================
// Tool Descriptions
// =============================================================================

/** Description shown to LLMs for the fill_form tool */
export const FILL_FORM_TOOL_DESCRIPTION =
  'Fill form fields by submitting patches. Each patch sets a value for one field. ' +
  'Use the field IDs from the issues list. Return patches for all issues you can address.';

// =============================================================================
// Patch Operations
// =============================================================================

/** All valid patch operation names */
export const PATCH_OPERATIONS = [
  'set_string',
  'set_number',
  'set_string_list',
  'set_checkboxes',
  'set_single_select',
  'set_multi_select',
  'set_url',
  'set_url_list',
  'set_date',
  'set_year',
  'set_table',
  'append_table',
  'delete_table',
  'append_string_list',
  'delete_string_list',
  'append_url_list',
  'delete_url_list',
  'clear_field',
  'skip_field',
  'abort_field',
] as const;

export type PatchOperation = (typeof PATCH_OPERATIONS)[number];
