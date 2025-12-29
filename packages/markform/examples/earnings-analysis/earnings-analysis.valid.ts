/**
 * Custom validators for earnings-analysis.form.md
 *
 * This simplified form uses only built-in validation (required, min/max, etc.)
 * Custom validators can be added here if needed.
 */

import type { ValidatorContext, ValidationIssue } from 'markform';

// Exported Validators Registry (empty for simplified form)
export const validators: Record<string, (ctx: ValidatorContext) => ValidationIssue[]> = {};
