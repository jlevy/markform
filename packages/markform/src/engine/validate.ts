/**
 * Validation engine for Markform documents.
 *
 * Runs built-in validators and optional code validators.
 */

import type {
  CheckboxesField,
  CheckboxesValue,
  Field,
  FieldGroup,
  FieldValue,
  FormSchema,
  Id,
  MultiSelectField,
  MultiSelectValue,
  NumberField,
  NumberValue,
  ParsedForm,
  SingleSelectField,
  SingleSelectValue,
  StringField,
  StringListField,
  StringListValue,
  StringValue,
  ValidationIssue,
  ValidatorContext,
  ValidatorRef,
  ValidatorRegistry,
} from "./coreTypes.js";

// =============================================================================
// Validation Options and Results
// =============================================================================

export interface ValidateOptions {
  /** Skip code validators (only run built-in validation). */
  skipCodeValidators?: boolean;
  /** Custom validator registry (for testing or overrides). */
  validatorRegistry?: ValidatorRegistry;
}

export interface ValidateResult {
  /** All validation issues found. */
  issues: ValidationIssue[];
  /** Whether the form is valid (no required-severity issues). */
  isValid: boolean;
}

// =============================================================================
// Built-in Validators
// =============================================================================

/**
 * Validate a string field.
 */
function validateStringField(
  field: StringField,
  value: StringValue | undefined,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const strValue = value?.value ?? null;

  // Required check
  if (field.required && (strValue === null || strValue.trim() === "")) {
    issues.push({
      severity: "error",
      message: `Required field "${field.label}" is empty`,
      ref: field.id,
      source: "builtin",
    });
    return issues; // Skip other checks if required and empty
  }

  // Skip other checks if no value
  if (strValue === null || strValue === "") {
    return issues;
  }

  // Min length
  if (field.minLength !== undefined && strValue.length < field.minLength) {
    issues.push({
      severity: "error",
      message: `"${field.label}" must be at least ${field.minLength} characters (got ${strValue.length})`,
      ref: field.id,
      source: "builtin",
    });
  }

  // Max length
  if (field.maxLength !== undefined && strValue.length > field.maxLength) {
    issues.push({
      severity: "error",
      message: `"${field.label}" must be at most ${field.maxLength} characters (got ${strValue.length})`,
      ref: field.id,
      source: "builtin",
    });
  }

  // Pattern
  if (field.pattern) {
    try {
      const regex = new RegExp(field.pattern);
      if (!regex.test(strValue)) {
        issues.push({
          severity: "error",
          message: `"${field.label}" does not match required pattern`,
          ref: field.id,
          source: "builtin",
        });
      }
    } catch {
      issues.push({
        severity: "error",
        message: `Invalid pattern "${field.pattern}" for field "${field.label}"`,
        ref: field.id,
        source: "builtin",
      });
    }
  }

  return issues;
}

/**
 * Validate a number field.
 */
function validateNumberField(
  field: NumberField,
  value: NumberValue | undefined,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const numValue = value?.value ?? null;

  // Required check
  if (field.required && numValue === null) {
    issues.push({
      severity: "error",
      message: `Required field "${field.label}" is empty`,
      ref: field.id,
      source: "builtin",
    });
    return issues;
  }

  // Skip other checks if no value
  if (numValue === null) {
    return issues;
  }

  // Integer check
  if (field.integer && !Number.isInteger(numValue)) {
    issues.push({
      severity: "error",
      message: `"${field.label}" must be an integer`,
      ref: field.id,
      source: "builtin",
    });
  }

  // Min
  if (field.min !== undefined && numValue < field.min) {
    issues.push({
      severity: "error",
      message: `"${field.label}" must be at least ${field.min} (got ${numValue})`,
      ref: field.id,
      source: "builtin",
    });
  }

  // Max
  if (field.max !== undefined && numValue > field.max) {
    issues.push({
      severity: "error",
      message: `"${field.label}" must be at most ${field.max} (got ${numValue})`,
      ref: field.id,
      source: "builtin",
    });
  }

  return issues;
}

/**
 * Validate a string-list field.
 */
function validateStringListField(
  field: StringListField,
  value: StringListValue | undefined,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const items = value?.items ?? [];

  // Required check
  if (field.required && items.length === 0) {
    issues.push({
      severity: "error",
      message: `Required field "${field.label}" is empty`,
      ref: field.id,
      source: "builtin",
    });
    return issues;
  }

  // Skip other checks if no items
  if (items.length === 0) {
    return issues;
  }

  // Min items
  if (field.minItems !== undefined && items.length < field.minItems) {
    issues.push({
      severity: "error",
      message: `"${field.label}" must have at least ${field.minItems} items (got ${items.length})`,
      ref: field.id,
      source: "builtin",
    });
  }

  // Max items
  if (field.maxItems !== undefined && items.length > field.maxItems) {
    issues.push({
      severity: "error",
      message: `"${field.label}" must have at most ${field.maxItems} items (got ${items.length})`,
      ref: field.id,
      source: "builtin",
    });
  }

  // Item constraints
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item === undefined) {
      continue;
    }

    // Item min length
    if (
      field.itemMinLength !== undefined &&
      item.length < field.itemMinLength
    ) {
      issues.push({
        severity: "error",
        message: `Item ${i + 1} in "${field.label}" must be at least ${field.itemMinLength} characters`,
        ref: field.id,
        source: "builtin",
      });
    }

    // Item max length
    if (
      field.itemMaxLength !== undefined &&
      item.length > field.itemMaxLength
    ) {
      issues.push({
        severity: "error",
        message: `Item ${i + 1} in "${field.label}" must be at most ${field.itemMaxLength} characters`,
        ref: field.id,
        source: "builtin",
      });
    }
  }

  // Unique items
  if (field.uniqueItems) {
    const seen = new Set<string>();
    for (const item of items) {
      if (seen.has(item)) {
        issues.push({
          severity: "error",
          message: `Duplicate item "${item}" in "${field.label}"`,
          ref: field.id,
          source: "builtin",
        });
        break; // Only report once
      }
      seen.add(item);
    }
  }

  return issues;
}

/**
 * Validate a single-select field.
 */
function validateSingleSelectField(
  field: SingleSelectField,
  value: SingleSelectValue | undefined,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const selected = value?.selected ?? null;

  // Required check
  if (field.required && selected === null) {
    issues.push({
      severity: "error",
      message: `Required field "${field.label}" has no selection`,
      ref: field.id,
      source: "builtin",
    });
    return issues;
  }

  // Validate selected option exists
  if (selected !== null) {
    const validOptions = new Set(field.options.map((o) => o.id));
    if (!validOptions.has(selected)) {
      issues.push({
        severity: "error",
        message: `Invalid selection "${selected}" in "${field.label}"`,
        ref: field.id,
        source: "builtin",
      });
    }
  }

  return issues;
}

/**
 * Validate a multi-select field.
 */
function validateMultiSelectField(
  field: MultiSelectField,
  value: MultiSelectValue | undefined,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const selected = value?.selected ?? [];

  // Required check
  if (field.required && selected.length === 0) {
    issues.push({
      severity: "error",
      message: `Required field "${field.label}" has no selections`,
      ref: field.id,
      source: "builtin",
    });
    return issues;
  }

  // Skip other checks if no selections
  if (selected.length === 0) {
    return issues;
  }

  // Min selections
  if (
    field.minSelections !== undefined &&
    selected.length < field.minSelections
  ) {
    issues.push({
      severity: "error",
      message: `"${field.label}" must have at least ${field.minSelections} selections (got ${selected.length})`,
      ref: field.id,
      source: "builtin",
    });
  }

  // Max selections
  if (
    field.maxSelections !== undefined &&
    selected.length > field.maxSelections
  ) {
    issues.push({
      severity: "error",
      message: `"${field.label}" must have at most ${field.maxSelections} selections (got ${selected.length})`,
      ref: field.id,
      source: "builtin",
    });
  }

  // Validate selected options exist
  const validOptions = new Set(field.options.map((o) => o.id));
  for (const sel of selected) {
    if (!validOptions.has(sel)) {
      issues.push({
        severity: "error",
        message: `Invalid selection "${sel}" in "${field.label}"`,
        ref: field.id,
        source: "builtin",
      });
    }
  }

  return issues;
}

/**
 * Validate a checkboxes field.
 */
function validateCheckboxesField(
  field: CheckboxesField,
  value: CheckboxesValue | undefined,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const values = value?.values ?? {};
  const mode = field.checkboxMode ?? "multi";

  // Count completed items based on mode
  let doneCount = 0;
  let incompleteCount = 0;
  let unfilledCount = 0;

  for (const opt of field.options) {
    const state = values[opt.id] ?? (mode === "explicit" ? "unfilled" : "todo");

    if (mode === "explicit") {
      if (state === "unfilled") {
        unfilledCount++;
      } else {
        doneCount++; // yes or no counts as answered
      }
    } else if (mode === "multi") {
      if (state === "done" || state === "na") {
        doneCount++;
      } else if (state === "incomplete" || state === "active") {
        incompleteCount++;
      }
    } else {
      // simple mode
      if (state === "done") {
        doneCount++;
      }
    }
  }

  // Required check - for checkboxes, required means all must be addressed
  if (field.required) {
    if (mode === "explicit" && unfilledCount > 0) {
      issues.push({
        severity: "error",
        message: `All items in "${field.label}" must be answered (${unfilledCount} unfilled)`,
        ref: field.id,
        source: "builtin",
      });
    } else if (mode === "multi" && (incompleteCount > 0 || doneCount === 0)) {
      issues.push({
        severity: "error",
        message: `All items in "${field.label}" must be completed`,
        ref: field.id,
        source: "builtin",
      });
    } else if (mode === "simple" && doneCount < field.options.length) {
      const remaining = field.options.length - doneCount;
      issues.push({
        severity: "error",
        message: `All items in "${field.label}" must be checked (${remaining} unchecked)`,
        ref: field.id,
        source: "builtin",
      });
    }
  }

  // Min done (optional constraint)
  if (field.minDone !== undefined && doneCount < field.minDone) {
    issues.push({
      severity: "error",
      message: `"${field.label}" requires at least ${field.minDone} items done (got ${doneCount})`,
      ref: field.id,
      source: "builtin",
    });
  }

  return issues;
}

/**
 * Validate a single field.
 */
function validateField(
  field: Field,
  values: Record<Id, FieldValue>,
): ValidationIssue[] {
  const value = values[field.id];

  switch (field.kind) {
    case "string":
      return validateStringField(field, value as StringValue | undefined);
    case "number":
      return validateNumberField(field, value as NumberValue | undefined);
    case "string_list":
      return validateStringListField(
        field,
        value as StringListValue | undefined,
      );
    case "single_select":
      return validateSingleSelectField(
        field,
        value as SingleSelectValue | undefined,
      );
    case "multi_select":
      return validateMultiSelectField(
        field,
        value as MultiSelectValue | undefined,
      );
    case "checkboxes":
      return validateCheckboxesField(
        field,
        value as CheckboxesValue | undefined,
      );
  }
}

// =============================================================================
// Code Validator Support
// =============================================================================

/**
 * Parse a validator reference to extract id and params.
 */
function parseValidatorRef(ref: ValidatorRef): {
  id: string;
  params: Record<string, unknown>;
} {
  if (typeof ref === "string") {
    return { id: ref, params: {} };
  }
  const { id, ...params } = ref;
  return { id, params };
}

/**
 * Run code validators for a field.
 */
function runCodeValidators(
  field: Field,
  schema: FormSchema,
  values: Record<Id, FieldValue>,
  registry: ValidatorRegistry,
): ValidationIssue[] {
  if (!field.validate) {
    return [];
  }

  const refs = Array.isArray(field.validate)
    ? field.validate
    : [field.validate];
  const issues: ValidationIssue[] = [];

  for (const ref of refs) {
    const { id, params } = parseValidatorRef(ref);
    const validator = registry[id];

    if (!validator) {
      issues.push({
        severity: "warning",
        message: `Validator "${id}" not found for field "${field.label}"`,
        ref: field.id,
        source: "code",
        validatorId: id,
      });
      continue;
    }

    const ctx: ValidatorContext = {
      schema,
      values,
      targetId: field.id,
      targetSchema: field,
      params,
    };

    try {
      const validatorIssues = validator(ctx);
      issues.push(...validatorIssues);
    } catch (err) {
      issues.push({
        severity: "error",
        message: `Validator "${id}" threw an error: ${err instanceof Error ? err.message : String(err)}`,
        ref: field.id,
        source: "code",
        validatorId: id,
      });
    }
  }

  return issues;
}

/**
 * Run code validators for a field group.
 */
function runGroupValidators(
  group: FieldGroup,
  schema: FormSchema,
  values: Record<Id, FieldValue>,
  registry: ValidatorRegistry,
): ValidationIssue[] {
  if (!group.validate) {
    return [];
  }

  const refs = Array.isArray(group.validate)
    ? group.validate
    : [group.validate];
  const issues: ValidationIssue[] = [];

  for (const ref of refs) {
    const { id, params } = parseValidatorRef(ref);
    const validator = registry[id];

    if (!validator) {
      issues.push({
        severity: "warning",
        message: `Validator "${id}" not found for group "${group.id}"`,
        ref: group.id,
        source: "code",
        validatorId: id,
      });
      continue;
    }

    const ctx: ValidatorContext = {
      schema,
      values,
      targetId: group.id,
      targetSchema: group,
      params,
    };

    try {
      const validatorIssues = validator(ctx);
      issues.push(...validatorIssues);
    } catch (err) {
      issues.push({
        severity: "error",
        message: `Validator "${id}" threw an error: ${err instanceof Error ? err.message : String(err)}`,
        ref: group.id,
        source: "code",
        validatorId: id,
      });
    }
  }

  return issues;
}

// =============================================================================
// Main Validate Function
// =============================================================================

/**
 * Validate a parsed form.
 *
 * @param form - The parsed form to validate
 * @param opts - Validation options
 * @returns Validation result with issues and validity flag
 */
export function validate(
  form: ParsedForm,
  opts?: ValidateOptions,
): ValidateResult {
  const issues: ValidationIssue[] = [];
  const registry = opts?.validatorRegistry ?? {};

  // Validate each field
  for (const group of form.schema.groups) {
    for (const field of group.children) {
      // Built-in validation
      issues.push(...validateField(field, form.valuesByFieldId));

      // Code validators
      if (!opts?.skipCodeValidators) {
        issues.push(
          ...runCodeValidators(
            field,
            form.schema,
            form.valuesByFieldId,
            registry,
          ),
        );
      }
    }

    // Group-level validators
    if (!opts?.skipCodeValidators) {
      issues.push(
        ...runGroupValidators(
          group,
          form.schema,
          form.valuesByFieldId,
          registry,
        ),
      );
    }
  }

  // Determine if valid (no error-severity issues)
  const isValid = !issues.some((i) => i.severity === "error");

  return { issues, isValid };
}
