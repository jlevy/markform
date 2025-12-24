/**
 * Custom validators for earnings-analysis.form.md
 *
 * These validators demonstrate parameterized validation patterns.
 * Parameters are passed via ctx.params from the validate attribute:
 *
 *   validate=[{id: "min_words", min: 50}]
 *
 * The validator receives { min: 50 } in ctx.params.
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

function getNumberValue(values: Record<string, unknown>, fieldId: string): number | null {
  const field = values[fieldId] as { kind: string; value?: number | null } | undefined;
  return field?.kind === 'number' && field.value != null ? field.value : null;
}

function getStringListItems(values: Record<string, unknown>, fieldId: string): string[] {
  const field = values[fieldId] as { kind: string; items?: string[] } | undefined;
  return field?.kind === 'string_list' && field.items ? field.items : [];
}

function getMultiSelectSelections(values: Record<string, unknown>, fieldId: string): string[] {
  const field = values[fieldId] as { kind: string; selected?: string[] } | undefined;
  return field?.kind === 'multi_select' && field.selected ? field.selected : [];
}

function getSingleSelectValue(values: Record<string, unknown>, fieldId: string): string | null {
  const field = values[fieldId] as { kind: string; selected?: string | null } | undefined;
  return field?.kind === 'single_select' && field.selected ? field.selected : null;
}

// Parameterized Validators

/**
 * Validate minimum word count.
 * Params: { min: number }
 */
function minWords(ctx: ValidatorContext): ValidationIssue[] {
  const min = ctx.params.min as number;
  if (typeof min !== 'number') {
    return [{ severity: 'error', message: 'min_words requires "min" parameter', ref: ctx.targetId, source: 'code' }];
  }

  const value = getStringValue(ctx.values, ctx.targetId);
  if (!value) return [];

  const wordCount = countWords(value);
  if (wordCount < min) {
    return [{
      severity: 'error',
      message: `Field requires at least ${min} words (currently ${wordCount})`,
      ref: ctx.targetId,
      source: 'code',
    }];
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
    return [{ severity: 'error', message: 'max_words requires "max" parameter', ref: ctx.targetId, source: 'code' }];
  }

  const value = getStringValue(ctx.values, ctx.targetId);
  if (!value) return [];

  const wordCount = countWords(value);
  if (wordCount > max) {
    return [{
      severity: 'warning',
      message: `Field exceeds ${max} word limit (currently ${wordCount})`,
      ref: ctx.targetId,
      source: 'code',
    }];
  }
  return [];
}

/**
 * Validate that specified number fields sum to a target.
 * Params: { fields: string[], target?: number, tolerance?: number }
 */
function sumTo(ctx: ValidatorContext): ValidationIssue[] {
  const fields = ctx.params.fields as string[];
  const target = (ctx.params.target as number) ?? 100;
  const tolerance = (ctx.params.tolerance as number) ?? 0.1;

  if (!Array.isArray(fields)) {
    return [{ severity: 'error', message: 'sum_to requires "fields" array parameter', ref: ctx.targetId, source: 'code' }];
  }

  const values = fields.map(fieldId => getNumberValue(ctx.values, fieldId) ?? 0);
  const sum = values.reduce((a, b) => a + b, 0);

  // Only validate if at least one value is set
  if (values.every(v => v === 0)) return [];

  if (Math.abs(sum - target) > tolerance) {
    return [{
      severity: 'error',
      message: `Fields must sum to ${target}% (currently ${sum.toFixed(1)}%)`,
      ref: fields[0],
      source: 'code',
    }];
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

  const percentages = items.map(item => extractPercentage(item)).filter((p): p is number => p !== null);

  if (percentages.length === 0) {
    return [{
      severity: 'warning',
      message: 'Items should include percentages (format: "Label: XX%")',
      ref: ctx.targetId,
      source: 'code',
    }];
  }

  const sum = percentages.reduce((a, b) => a + b, 0);
  if (Math.abs(sum - target) > 0.1) {
    return [{
      severity: 'warning',
      message: `Items should sum to ${target}% (currently ${sum.toFixed(1)}%)`,
      ref: ctx.targetId,
      source: 'code',
    }];
  }
  return [];
}

/**
 * Require field when another field has a value.
 * Params: { when: string, then?: string }
 */
function requiredIf(ctx: ValidatorContext): ValidationIssue[] {
  const triggerField = ctx.params.when as string;
  const targetField = (ctx.params.then as string) ?? ctx.targetId;

  if (!triggerField) {
    return [{ severity: 'error', message: 'required_if requires "when" parameter', ref: ctx.targetId, source: 'code' }];
  }

  const trigger = ctx.values[triggerField] as Record<string, unknown> | undefined;
  const target = ctx.values[targetField] as Record<string, unknown> | undefined;

  const triggerHasValue =
    (trigger?.kind === 'string' && (trigger.value as string)?.trim()) ||
    (trigger?.kind === 'number' && trigger.value != null) ||
    (trigger?.kind === 'multi_select' && (trigger.selected as string[])?.length > 0);

  const targetEmpty =
    !target ||
    (target.kind === 'string' && !(target.value as string)?.trim()) ||
    (target.kind === 'number' && target.value == null);

  if (triggerHasValue && targetEmpty) {
    return [{
      severity: 'error',
      message: `This field is required when ${triggerField} has a value`,
      ref: targetField,
      source: 'code',
    }];
  }
  return [];
}

/**
 * Require field when another field equals a specific value.
 * Params: { when: string, equals: string, then?: string }
 */
function requiredIfEquals(ctx: ValidatorContext): ValidationIssue[] {
  const triggerField = ctx.params.when as string;
  const expectedValue = ctx.params.equals as string;
  const targetField = (ctx.params.then as string) ?? ctx.targetId;

  if (!triggerField || expectedValue === undefined) {
    return [{ severity: 'error', message: 'required_if_equals requires "when" and "equals" parameters', ref: ctx.targetId, source: 'code' }];
  }

  const triggerValue = getSingleSelectValue(ctx.values, triggerField);
  const target = getStringValue(ctx.values, targetField);

  if (triggerValue === expectedValue && (!target || target.trim().length === 0)) {
    return [{
      severity: 'error',
      message: `This field is required when ${triggerField} is "${expectedValue}"`,
      ref: targetField,
      source: 'code',
    }];
  }
  return [];
}

/**
 * Validate that list items match a regex pattern.
 * Params: { pattern: string, example?: string }
 */
function itemFormat(ctx: ValidatorContext): ValidationIssue[] {
  const pattern = ctx.params.pattern as string;
  const example = ctx.params.example as string ?? '';

  if (!pattern) {
    return [{ severity: 'error', message: 'item_format requires "pattern" parameter', ref: ctx.targetId, source: 'code' }];
  }

  const items = getStringListItems(ctx.values, ctx.targetId);
  if (items.length === 0) return [];

  const regex = new RegExp(pattern);
  const malformed = items.filter(item => !regex.test(item));

  if (malformed.length > 0) {
    const hint = example ? ` Expected format: "${example}"` : '';
    return [{
      severity: 'warning',
      message: `${malformed.length} item(s) don't match expected format.${hint}`,
      ref: ctx.targetId,
      source: 'code',
    }];
  }
  return [];
}

// Exported Validators Registry

export const validators: Record<string, (ctx: ValidatorContext) => ValidationIssue[]> = {
  // Parameterized validators
  min_words: minWords,
  max_words: maxWords,
  sum_to: sumTo,
  sum_to_percent_list: sumToPercentList,
  required_if: requiredIf,
  required_if_equals: requiredIfEquals,
  item_format: itemFormat,
};
