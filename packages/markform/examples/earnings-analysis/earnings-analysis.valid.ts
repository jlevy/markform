/**
 * Custom validators for earnings-analysis.form.md
 *
 * These validators demonstrate parameterized validation patterns.
 * Parameters are passed via ctx.params from the validate attribute:
 *
 *   validate=[{id: "min_words", min: 20}]
 *
 * The validator receives { min: 20 } in ctx.params.
 */

import type { ValidatorContext, ValidationIssue } from 'markform';

// Helper Functions

function countWords(text: string): number {
  if (!text || text.trim().length === 0) return 0;
  return text.trim().split(/\s+/).length;
}

function extractPercentage(text: string): number | null {
  const match = text.match(/(\d+(?:\.\d+)?)\s*%/);
  return match ? parseFloat(match[1]) : null;
}

function getStringValue(values: Record<string, unknown>, fieldId: string): string | null {
  const field = values[fieldId] as { kind: string; value?: string | null } | undefined;
  return field?.kind === 'string' && field.value ? field.value : null;
}

function getStringListItems(values: Record<string, unknown>, fieldId: string): string[] {
  const field = values[fieldId] as { kind: string; items?: string[] } | undefined;
  return field?.kind === 'string_list' && field.items ? field.items : [];
}

function getSingleSelectValue(values: Record<string, unknown>, fieldId: string): string | null {
  const field = values[fieldId] as { kind: string; selected?: string | null } | undefined;
  return field?.kind === 'single_select' && field.selected ? field.selected : null;
}

// Validators

/**
 * Validate minimum word count.
 * Params: { min: number }
 */
function minWords(ctx: ValidatorContext): ValidationIssue[] {
  const min = ctx.params.min as number;
  if (typeof min !== 'number') {
    return [
      {
        severity: 'error',
        message: 'min_words requires "min" parameter',
        ref: ctx.targetId,
        source: 'code',
      },
    ];
  }

  const value = getStringValue(ctx.values, ctx.targetId);
  if (!value) return [];

  const wordCount = countWords(value);
  if (wordCount < min) {
    return [
      {
        severity: 'error',
        message: `Field requires at least ${min} words (currently ${wordCount})`,
        ref: ctx.targetId,
        source: 'code',
      },
    ];
  }
  return [];
}

/**
 * Validate maximum word count.
 * Params: { max: number }
 */
function maxWords(ctx: ValidatorContext): ValidationIssue[] {
  const max = ctx.params.max as number;
  if (typeof max !== 'number') {
    return [
      {
        severity: 'error',
        message: 'max_words requires "max" parameter',
        ref: ctx.targetId,
        source: 'code',
      },
    ];
  }

  const value = getStringValue(ctx.values, ctx.targetId);
  if (!value) return [];

  const wordCount = countWords(value);
  if (wordCount > max) {
    return [
      {
        severity: 'warning',
        message: `Field exceeds ${max} word limit (currently ${wordCount})`,
        ref: ctx.targetId,
        source: 'code',
      },
    ];
  }
  return [];
}

/**
 * Validate that string-list items with "Label: XX%" format sum to target.
 * Params: { target?: number }
 */
function sumToPercentList(ctx: ValidatorContext): ValidationIssue[] {
  const target = (ctx.params.target as number) ?? 100;
  const items = getStringListItems(ctx.values, ctx.targetId);

  if (items.length === 0) return [];

  const percentages = items
    .map((item) => extractPercentage(item))
    .filter((p): p is number => p !== null);

  if (percentages.length === 0) {
    return [
      {
        severity: 'warning',
        message: 'Items should include percentages (format: "Label: XX%")',
        ref: ctx.targetId,
        source: 'code',
      },
    ];
  }

  const sum = percentages.reduce((a, b) => a + b, 0);
  if (Math.abs(sum - target) > 0.1) {
    return [
      {
        severity: 'warning',
        message: `Items should sum to ${target}% (currently ${sum.toFixed(1)}%)`,
        ref: ctx.targetId,
        source: 'code',
      },
    ];
  }
  return [];
}

/**
 * Require field when another field has any value set.
 * Params: { when: string }
 */
function requiredIfSet(ctx: ValidatorContext): ValidationIssue[] {
  const triggerField = ctx.params.when as string;

  if (!triggerField) {
    return [
      {
        severity: 'error',
        message: 'required_if_set requires "when" parameter',
        ref: ctx.targetId,
        source: 'code',
      },
    ];
  }

  // Check if trigger field has a value
  const triggerHasValue =
    getStringValue(ctx.values, triggerField) !== null ||
    getSingleSelectValue(ctx.values, triggerField) !== null ||
    getStringListItems(ctx.values, triggerField).length > 0;

  // Check if target field is empty
  const targetValue = getStringValue(ctx.values, ctx.targetId);
  const targetEmpty = !targetValue || targetValue.trim().length === 0;

  if (triggerHasValue && targetEmpty) {
    return [
      {
        severity: 'error',
        message: `This field is required when "${triggerField}" has a value`,
        ref: ctx.targetId,
        source: 'code',
      },
    ];
  }
  return [];
}

// Exported Validators Registry

export const validators: Record<string, (ctx: ValidatorContext) => ValidationIssue[]> = {
  min_words: minWords,
  max_words: maxWords,
  sum_to_percent_list: sumToPercentList,
  required_if_set: requiredIfSet,
};
