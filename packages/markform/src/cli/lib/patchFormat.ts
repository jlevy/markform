/**
 * Patch formatting utilities for CLI display.
 *
 * Shared between fill.ts and examples.ts for consistent logging.
 */

import type { Patch } from '../../engine/coreTypes.js';

/** Maximum characters for a patch value display before truncation */
const PATCH_VALUE_MAX_LENGTH = 1000;

/**
 * Truncate a string to max length with ellipsis if needed.
 */
function truncate(value: string, maxLength: number = PATCH_VALUE_MAX_LENGTH): string {
  if (value.length <= maxLength) {
    return value;
  }
  return value.slice(0, maxLength) + '…';
}

/**
 * Format a patch value for display with truncation.
 */
export function formatPatchValue(patch: Patch): string {
  switch (patch.op) {
    case 'set_string':
      return patch.value ? truncate(`"${patch.value}"`) : '(empty)';
    case 'set_number':
      return patch.value !== null ? String(patch.value) : '(empty)';
    case 'set_string_list':
      return patch.items.length > 0 ? truncate(`[${patch.items.join(', ')}]`) : '(empty)';
    case 'set_single_select':
      return patch.selected ?? '(none)';
    case 'set_multi_select':
      return patch.selected.length > 0 ? truncate(`[${patch.selected.join(', ')}]`) : '(none)';
    case 'set_checkboxes':
      return truncate(
        Object.entries(patch.values)
          .map(([k, v]) => `${k}:${v}`)
          .join(', '),
      );
    case 'clear_field':
      return '(cleared)';
    case 'skip_field':
      return patch.reason ? truncate(`(skipped: ${patch.reason})`) : '(skipped)';
    case 'abort_field':
      return patch.reason ? truncate(`(aborted: ${patch.reason})`) : '(aborted)';
    case 'set_url':
      return patch.value ? truncate(`"${patch.value}"`) : '(empty)';
    case 'set_url_list':
      return patch.items.length > 0 ? truncate(`[${patch.items.join(', ')}]`) : '(empty)';
    case 'set_date':
      return patch.value ? truncate(`"${patch.value}"`) : '(empty)';
    case 'set_year':
      return patch.value !== null ? String(patch.value) : '(empty)';
    case 'add_note':
      return truncate(`note: ${patch.text}`);
    case 'remove_note':
      return `(remove note ${patch.noteId})`;
  }
}

/**
 * Get a short display name for the patch operation type.
 */
export function formatPatchType(patch: Patch): string {
  switch (patch.op) {
    case 'set_string':
      return 'string';
    case 'set_number':
      return 'number';
    case 'set_string_list':
      return 'string_list';
    case 'set_single_select':
      return 'select';
    case 'set_multi_select':
      return 'multi_select';
    case 'set_checkboxes':
      return 'checkboxes';
    case 'clear_field':
      return 'clear';
    case 'skip_field':
      return 'skip';
    case 'abort_field':
      return 'abort';
    case 'set_url':
      return 'url';
    case 'set_url_list':
      return 'url_list';
    case 'set_date':
      return 'date';
    case 'set_year':
      return 'year';
    case 'add_note':
      return 'note';
    case 'remove_note':
      return 'remove_note';
  }
}
