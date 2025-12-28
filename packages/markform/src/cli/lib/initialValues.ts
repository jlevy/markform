/**
 * Initial values helper for CLI commands.
 *
 * Parses --input flags and converts them to field patches.
 */

import type { Patch } from '../../engine/coreTypes.js';

/**
 * Parse initial value inputs from CLI flags.
 *
 * Supports formats:
 * - fieldId=value (string values)
 * - fieldId:number=123 (explicit number)
 * - fieldId:list=a,b,c (comma-separated list)
 *
 * @param inputs Array of input strings in "fieldId=value" format
 * @returns Array of patches to apply as initial values
 */
export function parseInitialValues(inputs: string[]): Patch[] {
  const patches: Patch[] = [];

  for (const input of inputs) {
    const equalsIndex = input.indexOf('=');
    if (equalsIndex === -1) {
      throw new Error(`Invalid input format: "${input}" (expected "fieldId=value")`);
    }

    const fieldSpec = input.slice(0, equalsIndex);
    const value = input.slice(equalsIndex + 1);

    // Check for type specifier (fieldId:type)
    const colonIndex = fieldSpec.indexOf(':');
    let fieldId: string;
    let type: string | null = null;

    if (colonIndex !== -1) {
      fieldId = fieldSpec.slice(0, colonIndex);
      type = fieldSpec.slice(colonIndex + 1).toLowerCase();
    } else {
      fieldId = fieldSpec;
    }

    // Create patch based on type
    if (type === 'number') {
      const numValue = parseFloat(value);
      if (isNaN(numValue)) {
        throw new Error(`Invalid number value for "${fieldId}": "${value}"`);
      }
      patches.push({ op: 'set_number', fieldId, value: numValue });
    } else if (type === 'list') {
      const items = value
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      patches.push({ op: 'set_string_list', fieldId, items });
    } else {
      // Default to string
      patches.push({ op: 'set_string', fieldId, value });
    }
  }

  return patches;
}

/**
 * Validate that all initial values reference valid field IDs.
 *
 * @param patches Patches to validate
 * @param validFieldIds Set of valid field IDs from the form
 * @returns Array of invalid field IDs (empty if all valid)
 */
export function validateInitialValueFields(patches: Patch[], validFieldIds: Set<string>): string[] {
  const invalid: string[] = [];

  for (const patch of patches) {
    if ('fieldId' in patch && patch.fieldId && !validFieldIds.has(patch.fieldId)) {
      invalid.push(patch.fieldId);
    }
  }

  return invalid;
}
