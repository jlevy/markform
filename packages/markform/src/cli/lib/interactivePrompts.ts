/**
 * Interactive prompts module for console-based form filling.
 *
 * Uses @clack/prompts to provide a rich terminal UI for users to
 * fill form fields interactively.
 */

import * as p from "@clack/prompts";
import pc from "picocolors";


import type {
  Field,
  FieldValue,
  Patch,
  SkipFieldPatch,
  StringField,
  NumberField,
  StringListField,
  SingleSelectField,
  MultiSelectField,
  CheckboxesField,
  UrlField,
  UrlListField,
  ParsedForm,
  InspectIssue,
} from "../../engine/coreTypes.js";

/**
 * Context for a field prompt including description from docs.
 */
interface FieldPromptContext {
  field: Field;
  currentValue: FieldValue | undefined;
  description?: string;
  index: number;
  total: number;
}

/**
 * Get field description from form docs.
 */
function getFieldDescription(form: ParsedForm, fieldId: string): string | undefined {
  const doc = form.docs.find(
    (d) => d.ref === fieldId && (d.tag === "description" || d.tag === "instructions")
  );
  return doc?.bodyMarkdown;
}

/**
 * Get a field by ID from the form schema.
 */
function getFieldById(form: ParsedForm, fieldId: string): Field | undefined {
  for (const group of form.schema.groups) {
    const field = group.children.find((f) => f.id === fieldId);
    if (field) {
return field;
}
  }
  return undefined;
}

/**
 * Format field label with required indicator and progress.
 */
function formatFieldLabel(ctx: FieldPromptContext): string {
  const required = ctx.field.required ? pc.red("*") : "";
  const progress = pc.dim(`(${ctx.index} of ${ctx.total})`);
  return `${ctx.field.label}${required} ${progress}`;
}

/**
 * Create a skip_field patch for the given field.
 */
function createSkipPatch(field: Field): SkipFieldPatch {
  return {
    op: "skip_field",
    fieldId: field.id,
    reason: "User skipped in console",
  };
}

/**
 * For optional fields, prompt user to choose between filling or skipping.
 * Returns "fill" if user wants to enter a value, or a skip_field patch if skipping.
 * Returns null if user cancelled.
 */
async function promptSkipOrFill(ctx: FieldPromptContext): Promise<"fill" | SkipFieldPatch | null> {
  const field = ctx.field;

  // Required fields must be filled - no skip option
  if (field.required) {
    return "fill";
  }

  const result = await p.select({
    message: `${formatFieldLabel(ctx)} ${pc.dim("(optional)")}`,
    options: [
      { value: "fill", label: "Enter value" },
      { value: "skip", label: "Skip this field" },
    ],
  });

  if (p.isCancel(result)) {
    return null;
  }

  if (result === "skip") {
    return createSkipPatch(field);
  }

  return "fill";
}

/**
 * Prompt for a string field value.
 */
async function promptForString(ctx: FieldPromptContext): Promise<Patch | null> {
  const field = ctx.field as StringField;
  const currentVal =
    ctx.currentValue?.kind === "string" ? ctx.currentValue.value : null;

  const result = await p.text({
    message: formatFieldLabel(ctx),
    placeholder: currentVal ?? (ctx.description ? ctx.description.slice(0, 60) : undefined),
    initialValue: currentVal ?? "",
    validate: (value) => {
      if (field.required && !value.trim()) {
        return "This field is required";
      }
      if (field.minLength && value.length < field.minLength) {
        return `Minimum ${field.minLength} characters required`;
      }
      if (field.maxLength && value.length > field.maxLength) {
        return `Maximum ${field.maxLength} characters allowed`;
      }
      if (field.pattern && !new RegExp(field.pattern).test(value)) {
        return `Must match pattern: ${field.pattern}`;
      }
      return undefined;
    },
  });

  if (p.isCancel(result)) {
    return null;
  }

  // Skip if empty and not required (user pressed Enter to skip)
  if (!result && !field.required) {
    return null;
  }

  return {
    op: "set_string",
    fieldId: field.id,
    value: result || null,
  };
}

/**
 * Prompt for a number field value.
 */
async function promptForNumber(ctx: FieldPromptContext): Promise<Patch | null> {
  const field = ctx.field as NumberField;
  const currentVal =
    ctx.currentValue?.kind === "number" ? ctx.currentValue.value : null;

  const result = await p.text({
    message: formatFieldLabel(ctx),
    placeholder: currentVal !== null ? String(currentVal) : undefined,
    initialValue: currentVal !== null ? String(currentVal) : "",
    validate: (value) => {
      if (field.required && !value.trim()) {
        return "This field is required";
      }
      if (!value.trim()) {
        return undefined; // Allow empty for optional
      }
      const num = Number(value);
      if (isNaN(num)) {
        return "Please enter a valid number";
      }
      if (field.integer && !Number.isInteger(num)) {
        return "Please enter a whole number";
      }
      if (field.min !== undefined && num < field.min) {
        return `Minimum value is ${field.min}`;
      }
      if (field.max !== undefined && num > field.max) {
        return `Maximum value is ${field.max}`;
      }
      return undefined;
    },
  });

  if (p.isCancel(result)) {
    return null;
  }

  // Skip if empty and not required
  if (!result && !field.required) {
    return null;
  }

  return {
    op: "set_number",
    fieldId: field.id,
    value: result ? Number(result) : null,
  };
}

/**
 * Prompt for a string list field value.
 */
async function promptForStringList(ctx: FieldPromptContext): Promise<Patch | null> {
  const field = ctx.field as StringListField;
  const currentItems =
    ctx.currentValue?.kind === "string_list" ? ctx.currentValue.items : [];

  const hint = ctx.description
    ? `${ctx.description.slice(0, 50)}... (one item per line)`
    : "Enter items, one per line. Press Enter twice when done.";

  const result = await p.text({
    message: formatFieldLabel(ctx),
    placeholder: hint,
    initialValue: currentItems.join("\n"),
    validate: (value) => {
      const items = value
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      if (field.required && items.length === 0) {
        return "At least one item is required";
      }
      if (field.minItems && items.length < field.minItems) {
        return `Minimum ${field.minItems} items required`;
      }
      if (field.maxItems && items.length > field.maxItems) {
        return `Maximum ${field.maxItems} items allowed`;
      }
      return undefined;
    },
  });

  if (p.isCancel(result)) {
    return null;
  }

  const items = (result)
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  // Skip if empty and not required
  if (items.length === 0 && !field.required) {
    return null;
  }

  return {
    op: "set_string_list",
    fieldId: field.id,
    items,
  };
}

/**
 * Prompt for a single-select field value.
 */
async function promptForSingleSelect(ctx: FieldPromptContext): Promise<Patch | null> {
  const field = ctx.field as SingleSelectField;
  const currentSelected =
    ctx.currentValue?.kind === "single_select" ? ctx.currentValue.selected : null;

  const options = field.options.map((opt) => ({
    value: opt.id,
    label: opt.label,
  }));

  const result = await p.select({
    message: formatFieldLabel(ctx),
    options,
    initialValue: currentSelected ?? undefined,
  });

  if (p.isCancel(result)) {
    return null;
  }

  return {
    op: "set_single_select",
    fieldId: field.id,
    selected: result,
  };
}

/**
 * Prompt for a multi-select field value.
 */
async function promptForMultiSelect(ctx: FieldPromptContext): Promise<Patch | null> {
  const field = ctx.field as MultiSelectField;
  const currentSelected =
    ctx.currentValue?.kind === "multi_select" ? ctx.currentValue.selected : [];

  const options = field.options.map((opt) => ({
    value: opt.id,
    label: opt.label,
  }));

  const result = await p.multiselect({
    message: formatFieldLabel(ctx),
    options,
    initialValues: currentSelected,
    required: field.required,
  });

  if (p.isCancel(result)) {
    return null;
  }

  return {
    op: "set_multi_select",
    fieldId: field.id,
    selected: result,
  };
}

/**
 * Prompt for a checkboxes field value.
 *
 * Behavior varies by checkboxMode:
 * - simple: multiselect to pick items marked as done
 * - multi: per-option select with 5 states
 * - explicit: per-option yes/no/skip
 */
async function promptForCheckboxes(ctx: FieldPromptContext): Promise<Patch | null> {
  const field = ctx.field as CheckboxesField;
  const currentValues =
    ctx.currentValue?.kind === "checkboxes" ? ctx.currentValue.values : {};

  if (field.checkboxMode === "simple") {
    // Simple mode: multiselect to mark items as done
    const options = field.options.map((opt) => ({
      value: opt.id,
      label: opt.label,
    }));

    const currentlyDone = field.options
      .filter((opt) => currentValues[opt.id] === "done")
      .map((opt) => opt.id);

    const result = await p.multiselect({
      message: formatFieldLabel(ctx),
      options,
      initialValues: currentlyDone,
      required: field.required && field.minDone !== undefined && field.minDone > 0,
    });

    if (p.isCancel(result)) {
      return null;
    }

    const selected = result;
    const values: Record<string, "todo" | "done"> = {};
    for (const opt of field.options) {
      values[opt.id] = selected.includes(opt.id) ? "done" : "todo";
    }

    return {
      op: "set_checkboxes",
      fieldId: field.id,
      values,
    };
  }

  if (field.checkboxMode === "explicit") {
    // Explicit mode: yes/no for each option
    const values: Record<string, "yes" | "no" | "unfilled"> = {};

    for (const opt of field.options) {
      const current = currentValues[opt.id];
      const result = await p.select({
        message: `${opt.label}`,
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
          { value: "unfilled", label: "Skip" },
        ],
        initialValue: current === "yes" || current === "no" ? current : "unfilled",
      });

      if (p.isCancel(result)) {
        return null;
      }

      values[opt.id] = result as "yes" | "no" | "unfilled";
    }

    return {
      op: "set_checkboxes",
      fieldId: field.id,
      values,
    };
  }

  // Multi mode: 5 states per option
  const values: Record<string, "todo" | "done" | "incomplete" | "active" | "na"> = {};

  for (const opt of field.options) {
    const current = currentValues[opt.id] as
      | "todo"
      | "done"
      | "incomplete"
      | "active"
      | "na"
      | undefined;
    const result = await p.select({
      message: `${opt.label}`,
      options: [
        { value: "todo", label: "To do" },
        { value: "active", label: "In progress" },
        { value: "done", label: "Done" },
        { value: "incomplete", label: "Incomplete" },
        { value: "na", label: "N/A" },
      ],
      initialValue: current ?? "todo",
    });

    if (p.isCancel(result)) {
      return null;
    }

    values[opt.id] = result;
  }

  return {
    op: "set_checkboxes",
    fieldId: field.id,
    values,
  };
}

/**
 * Prompt for a URL field value.
 */
async function promptForUrl(ctx: FieldPromptContext): Promise<Patch | null> {
  const field = ctx.field as UrlField;
  const currentVal =
    ctx.currentValue?.kind === "url" ? ctx.currentValue.value : null;

  const result = await p.text({
    message: formatFieldLabel(ctx),
    placeholder: currentVal ?? "https://example.com",
    initialValue: currentVal ?? "",
    validate: (value) => {
      if (field.required && !value.trim()) {
        return "This field is required";
      }
      if (!value.trim()) {
        return undefined; // Allow empty for optional
      }
      // Basic URL validation
      try {
        new URL(value);
      } catch {
        return "Please enter a valid URL (e.g., https://example.com)";
      }
      return undefined;
    },
  });

  if (p.isCancel(result)) {
    return null;
  }

  // Skip if empty and not required (user pressed Enter to skip)
  if (!result && !field.required) {
    return null;
  }

  return {
    op: "set_url",
    fieldId: field.id,
    value: result || null,
  };
}

/**
 * Prompt for a URL list field value.
 */
async function promptForUrlList(ctx: FieldPromptContext): Promise<Patch | null> {
  const field = ctx.field as UrlListField;
  const currentItems =
    ctx.currentValue?.kind === "url_list" ? ctx.currentValue.items : [];

  const hint = ctx.description
    ? `${ctx.description.slice(0, 50)}... (one URL per line)`
    : "Enter URLs, one per line. Press Enter twice when done.";

  const result = await p.text({
    message: formatFieldLabel(ctx),
    placeholder: hint,
    initialValue: currentItems.join("\n"),
    validate: (value) => {
      const items = value
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      if (field.required && items.length === 0) {
        return "At least one URL is required";
      }
      if (field.minItems && items.length < field.minItems) {
        return `Minimum ${field.minItems} URLs required`;
      }
      if (field.maxItems && items.length > field.maxItems) {
        return `Maximum ${field.maxItems} URLs allowed`;
      }
      // Validate each URL
      for (const item of items) {
        try {
          new URL(item);
        } catch {
          return `Invalid URL: ${item}`;
        }
      }
      return undefined;
    },
  });

  if (p.isCancel(result)) {
    return null;
  }

  const items = (result)
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  // Skip if empty and not required
  if (items.length === 0 && !field.required) {
    return null;
  }

  return {
    op: "set_url_list",
    fieldId: field.id,
    items,
  };
}

/**
 * Prompt user for a single field value based on field type.
 * Returns a Patch to set the value, or null if skipped/cancelled.
 *
 * For optional fields, first offers a choice to skip or fill.
 */
export async function promptForField(
  ctx: FieldPromptContext
): Promise<Patch | null> {
  // Show description if available
  if (ctx.description) {
    p.note(ctx.description, pc.dim("Instructions"));
  }

  // For optional fields, offer skip/fill choice first
  const skipOrFillResult = await promptSkipOrFill(ctx);

  if (skipOrFillResult === null) {
    // User cancelled
    return null;
  }

  if (typeof skipOrFillResult !== "string") {
    // User chose to skip - return the skip_field patch
    return skipOrFillResult;
  }

  // User chose to fill - proceed to field-specific prompt
  switch (ctx.field.kind) {
    case "string":
      return promptForString(ctx);
    case "number":
      return promptForNumber(ctx);
    case "string_list":
      return promptForStringList(ctx);
    case "single_select":
      return promptForSingleSelect(ctx);
    case "multi_select":
      return promptForMultiSelect(ctx);
    case "checkboxes":
      return promptForCheckboxes(ctx);
    case "url":
      return promptForUrl(ctx);
    case "url_list":
      return promptForUrlList(ctx);
    default:
      // Unknown field type - skip
      return null;
  }
}

/**
 * Run an interactive fill session for a list of field issues.
 * Returns patches for all filled fields.
 *
 * @param form - The parsed form
 * @param issues - The issues indicating fields to fill
 * @returns Array of patches to apply
 */
export async function runInteractiveFill(
  form: ParsedForm,
  issues: InspectIssue[]
): Promise<{ patches: Patch[]; cancelled: boolean }> {
  // Filter to field-level issues only (not form/group/option)
  const fieldIssues = issues.filter((i) => i.scope === "field");

  // Deduplicate by fieldId (a field might have multiple issues)
  const seenFieldIds = new Set<string>();
  const uniqueFieldIssues = fieldIssues.filter((issue) => {
    if (seenFieldIds.has(issue.ref)) {
return false;
}
    seenFieldIds.add(issue.ref);
    return true;
  });

  if (uniqueFieldIssues.length === 0) {
    p.note("No fields to fill for the selected role.", "Info");
    return { patches: [], cancelled: false };
  }

  const patches: Patch[] = [];
  let index = 0;

  for (const issue of uniqueFieldIssues) {
    const field = getFieldById(form, issue.ref);
    if (!field) {
continue;
}

    index++;
    const ctx: FieldPromptContext = {
      field,
      currentValue: form.valuesByFieldId[field.id],
      description: getFieldDescription(form, field.id),
      index,
      total: uniqueFieldIssues.length,
    };

    const patch = await promptForField(ctx);

    if (patch === null && p.isCancel(patch)) {
      // User cancelled (Ctrl+C)
      const shouldContinue = await p.confirm({
        message: "Cancel and discard changes?",
        initialValue: false,
      });

      if (p.isCancel(shouldContinue) || shouldContinue) {
        return { patches: [], cancelled: true };
      }
      // Continue filling - re-prompt this field
      index--;
      continue;
    }

    if (patch) {
      patches.push(patch);
    }
  }

  return { patches, cancelled: false };
}

/**
 * Show intro message for interactive fill session.
 */
export function showInteractiveIntro(
  formTitle: string,
  role: string,
  fieldCount: number
): void {
  p.intro(pc.bgCyan(pc.black(" Markform Interactive Fill ")));

  const lines = [
    `${pc.bold("Form:")} ${formTitle}`,
    `${pc.bold("Role:")} ${role}`,
    `${pc.bold("Fields:")} ${fieldCount} to fill`,
  ];

  p.note(lines.join("\n"), "Session Info");
}

/**
 * Show outro message after interactive fill.
 */
export function showInteractiveOutro(
  patchCount: number,
  cancelled: boolean
): void {
  if (cancelled) {
    p.cancel("Interactive fill cancelled.");
    return;
  }

  if (patchCount === 0) {
    p.outro(pc.yellow("No changes made."));
    return;
  }

  p.outro(`✓ ${patchCount} field(s) updated.`);
}
