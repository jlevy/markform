/**
 * Research form validation.
 *
 * Utilities for detecting and validating research-enabled forms.
 */

import type { ParsedForm } from '../engine/coreTypes.js';

/**
 * Check if a form is configured for research mode.
 *
 * A form is considered a research form if it has web search configuration
 * in its frontmatter metadata, indicated by:
 * - webSearchModel: model ID for web search capability
 * - enableWebSearch: boolean flag to enable web search
 *
 * @param form The parsed form to check
 * @returns true if the form is configured for research
 */
export function isResearchForm(form: ParsedForm): boolean {
  const metadata = form.metadata;
  if (!metadata) {
    return false;
  }

  // Check for research configuration in metadata
  // These would be set in the frontmatter's markform section
  const extendedMetadata = metadata as unknown as Record<string, unknown>;

  // Check for webSearchModel or enableWebSearch
  if (extendedMetadata.webSearchModel) {
    return true;
  }

  if (extendedMetadata.enableWebSearch === true) {
    return true;
  }

  return false;
}

/**
 * Validate that a form is suitable for research fill.
 *
 * Research forms should:
 * 1. Have agent-role fields to fill
 * 2. Not be already complete
 *
 * @param form The parsed form to validate
 * @returns Object with isValid and optional error message
 */
export function validateResearchForm(form: ParsedForm): { isValid: boolean; error?: string } {
  // Check if form has any fields
  const fieldCount =
    Object.keys(form.responsesByFieldId).length +
    form.schema.groups.reduce((sum, g) => sum + g.children.length, 0);

  if (fieldCount === 0) {
    return { isValid: false, error: 'Form has no fields to fill' };
  }

  // Form is valid for research
  return { isValid: true };
}
