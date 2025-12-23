/**
 * Canonical serializer for .form.md files.
 *
 * Serializes a ParsedForm back to a Markdoc markdown document.
 * The output is deterministic and suitable for round-trip testing.
 */

import type {
  CheckboxesField,
  CheckboxesValue,
  CheckboxValue,
  DocumentationBlock,
  Field,
  FieldGroup,
  FieldValue,
  FormSchema,
  Id,
  MultiSelectField,
  MultiSelectValue,
  NumberField,
  NumberValue,
  Option,
  ParsedForm,
  SingleSelectField,
  SingleSelectValue,
  StringField,
  StringListField,
  StringListValue,
  StringValue,
} from "./types.js";

// =============================================================================
// Options
// =============================================================================

export interface SerializeOptions {
  /** Markform version to use in frontmatter. Defaults to "0.1.0". */
  markformVersion?: string;
}

// =============================================================================
// Attribute Serialization
// =============================================================================

/**
 * Serialize an attribute value to Markdoc format.
 */
function serializeAttrValue(value: unknown): string {
  if (typeof value === "string") {
    // Escape backslashes and quotes
    const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return `"${escaped}"`;
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (Array.isArray(value)) {
    const items = value.map((v) => serializeAttrValue(v)).join(", ");
    return `[${items}]`;
  }
  return String(value);
}

/**
 * Serialize attributes to Markdoc format with alphabetical ordering.
 */
function serializeAttrs(attrs: Record<string, unknown>): string {
  const keys = Object.keys(attrs).sort();
  const parts: string[] = [];

  for (const key of keys) {
    const value = attrs[key];
    if (value !== undefined) {
      parts.push(`${key}=${serializeAttrValue(value)}`);
    }
  }

  return parts.join(" ");
}

// =============================================================================
// Checkbox Marker Serialization
// =============================================================================

/** Map checkbox state to marker character */
const STATE_TO_MARKER: Record<CheckboxValue, string> = {
  // Multi mode
  todo: " ",
  done: "x",
  incomplete: "/",
  active: "*",
  na: "-",
  // Explicit mode
  unfilled: " ",
  yes: "y",
  no: "n",
};

/**
 * Get the checkbox marker for a state.
 */
function getMarker(state: CheckboxValue): string {
  return STATE_TO_MARKER[state] ?? " ";
}

// =============================================================================
// Field Serialization
// =============================================================================

/**
 * Serialize a string field.
 */
function serializeStringField(
  field: StringField,
  value: StringValue | undefined,
): string {
  const attrs: Record<string, unknown> = { id: field.id, label: field.label };
  if (field.required) {
    attrs.required = field.required;
  }
  if (field.priority !== "medium") {
    attrs.priority = field.priority;
  }
  if (field.multiline) {
    attrs.multiline = field.multiline;
  }
  if (field.pattern) {
    attrs.pattern = field.pattern;
  }
  if (field.minLength !== undefined) {
    attrs.minLength = field.minLength;
  }
  if (field.maxLength !== undefined) {
    attrs.maxLength = field.maxLength;
  }
  if (field.validate) {
    attrs.validate = field.validate;
  }

  const attrStr = serializeAttrs(attrs);
  let content = "";

  if (value?.value) {
    content = `\n\`\`\`value\n${value.value}\n\`\`\`\n`;
  }

  return `{% string-field ${attrStr} %}${content}{% /string-field %}`;
}

/**
 * Serialize a number field.
 */
function serializeNumberField(
  field: NumberField,
  value: NumberValue | undefined,
): string {
  const attrs: Record<string, unknown> = { id: field.id, label: field.label };
  if (field.required) {
    attrs.required = field.required;
  }
  if (field.priority !== "medium") {
    attrs.priority = field.priority;
  }
  if (field.min !== undefined) {
    attrs.min = field.min;
  }
  if (field.max !== undefined) {
    attrs.max = field.max;
  }
  if (field.integer) {
    attrs.integer = field.integer;
  }
  if (field.validate) {
    attrs.validate = field.validate;
  }

  const attrStr = serializeAttrs(attrs);
  let content = "";

  if (value?.value !== null && value?.value !== undefined) {
    content = `\n\`\`\`value\n${value.value}\n\`\`\`\n`;
  }

  return `{% number-field ${attrStr} %}${content}{% /number-field %}`;
}

/**
 * Serialize a string-list field.
 */
function serializeStringListField(
  field: StringListField,
  value: StringListValue | undefined,
): string {
  const attrs: Record<string, unknown> = { id: field.id, label: field.label };
  if (field.required) {
    attrs.required = field.required;
  }
  if (field.priority !== "medium") {
    attrs.priority = field.priority;
  }
  if (field.minItems !== undefined) {
    attrs.minItems = field.minItems;
  }
  if (field.maxItems !== undefined) {
    attrs.maxItems = field.maxItems;
  }
  if (field.itemMinLength !== undefined) {
    attrs.itemMinLength = field.itemMinLength;
  }
  if (field.itemMaxLength !== undefined) {
    attrs.itemMaxLength = field.itemMaxLength;
  }
  if (field.uniqueItems) {
    attrs.uniqueItems = field.uniqueItems;
  }
  if (field.validate) {
    attrs.validate = field.validate;
  }

  const attrStr = serializeAttrs(attrs);
  let content = "";

  if (value?.items && value.items.length > 0) {
    content = `\n\`\`\`value\n${value.items.join("\n")}\n\`\`\`\n`;
  }

  return `{% string-list ${attrStr} %}${content}{% /string-list %}`;
}

/**
 * Serialize options (for single-select, multi-select, checkboxes).
 */
function serializeOptions(
  options: Option[],
  selected: Record<string, CheckboxValue>,
): string {
  const lines: string[] = [];

  for (const opt of options) {
    const state = selected[opt.id] ?? "todo";
    const marker = getMarker(state);
    lines.push(`- [${marker}] ${opt.label} {% #${opt.id} %}`);
  }

  return lines.join("\n");
}

/**
 * Serialize a single-select field.
 */
function serializeSingleSelectField(
  field: SingleSelectField,
  value: SingleSelectValue | undefined,
): string {
  const attrs: Record<string, unknown> = { id: field.id, label: field.label };
  if (field.required) {
    attrs.required = field.required;
  }
  if (field.priority !== "medium") {
    attrs.priority = field.priority;
  }
  if (field.validate) {
    attrs.validate = field.validate;
  }

  const attrStr = serializeAttrs(attrs);

  // Convert selected to checkbox state format
  const selected: Record<string, CheckboxValue> = {};
  for (const opt of field.options) {
    selected[opt.id] = opt.id === value?.selected ? "done" : "todo";
  }

  const options = serializeOptions(field.options, selected);
  return `{% single-select ${attrStr} %}\n${options}\n{% /single-select %}`;
}

/**
 * Serialize a multi-select field.
 */
function serializeMultiSelectField(
  field: MultiSelectField,
  value: MultiSelectValue | undefined,
): string {
  const attrs: Record<string, unknown> = { id: field.id, label: field.label };
  if (field.required) {
    attrs.required = field.required;
  }
  if (field.priority !== "medium") {
    attrs.priority = field.priority;
  }
  if (field.minSelections !== undefined) {
    attrs.minSelections = field.minSelections;
  }
  if (field.maxSelections !== undefined) {
    attrs.maxSelections = field.maxSelections;
  }
  if (field.validate) {
    attrs.validate = field.validate;
  }

  const attrStr = serializeAttrs(attrs);

  // Convert selected to checkbox state format
  const selected: Record<string, CheckboxValue> = {};
  const selectedSet = new Set(value?.selected ?? []);
  for (const opt of field.options) {
    selected[opt.id] = selectedSet.has(opt.id) ? "done" : "todo";
  }

  const options = serializeOptions(field.options, selected);
  return `{% multi-select ${attrStr} %}\n${options}\n{% /multi-select %}`;
}

/**
 * Serialize a checkboxes field.
 */
function serializeCheckboxesField(
  field: CheckboxesField,
  value: CheckboxesValue | undefined,
): string {
  const attrs: Record<string, unknown> = { id: field.id, label: field.label };
  if (field.required) {
    attrs.required = field.required;
  }
  if (field.priority !== "medium") {
    attrs.priority = field.priority;
  }
  if (field.checkboxMode !== "multi") {
    attrs.checkboxMode = field.checkboxMode;
  }
  if (field.minDone !== undefined) {
    attrs.minDone = field.minDone;
  }
  if (field.validate) {
    attrs.validate = field.validate;
  }

  const attrStr = serializeAttrs(attrs);

  const options = serializeOptions(field.options, value?.values ?? {});
  return `{% checkboxes ${attrStr} %}\n${options}\n{% /checkboxes %}`;
}

/**
 * Serialize a field to Markdoc format.
 */
function serializeField(field: Field, values: Record<Id, FieldValue>): string {
  const value = values[field.id];

  switch (field.kind) {
    case "string":
      return serializeStringField(field, value as StringValue | undefined);
    case "number":
      return serializeNumberField(field, value as NumberValue | undefined);
    case "string_list":
      return serializeStringListField(
        field,
        value as StringListValue | undefined,
      );
    case "single_select":
      return serializeSingleSelectField(
        field,
        value as SingleSelectValue | undefined,
      );
    case "multi_select":
      return serializeMultiSelectField(
        field,
        value as MultiSelectValue | undefined,
      );
    case "checkboxes":
      return serializeCheckboxesField(
        field,
        value as CheckboxesValue | undefined,
      );
  }
}

// =============================================================================
// Doc Block Serialization
// =============================================================================

/**
 * Serialize a documentation block.
 */
function serializeDocBlock(doc: DocumentationBlock): string {
  const attrs: Record<string, unknown> = { ref: doc.ref };
  if (doc.kind) {
    attrs.kind = doc.kind;
  }

  const attrStr = serializeAttrs(attrs);
  return `{% doc ${attrStr} %}\n${doc.bodyMarkdown}\n{% /doc %}`;
}

// =============================================================================
// Group and Form Serialization
// =============================================================================

/**
 * Serialize a field group.
 */
function serializeFieldGroup(
  group: FieldGroup,
  values: Record<Id, FieldValue>,
  docs: DocumentationBlock[],
): string {
  const attrs: Record<string, unknown> = { id: group.id };
  if (group.title) {
    attrs.title = group.title;
  }
  if (group.validate) {
    attrs.validate = group.validate;
  }

  const attrStr = serializeAttrs(attrs);
  const lines: string[] = [`{% field-group ${attrStr} %}`];

  // Group doc blocks by ref
  const docsByRef = new Map<string, DocumentationBlock[]>();
  for (const doc of docs) {
    const list = docsByRef.get(doc.ref) ?? [];
    list.push(doc);
    docsByRef.set(doc.ref, list);
  }

  for (const field of group.children) {
    lines.push("");
    lines.push(serializeField(field, values));

    // Add any doc blocks for this field
    const fieldDocs = docsByRef.get(field.id);
    if (fieldDocs) {
      for (const doc of fieldDocs) {
        lines.push("");
        lines.push(serializeDocBlock(doc));
      }
    }
  }

  lines.push("");
  lines.push("{% /field-group %}");

  return lines.join("\n");
}

/**
 * Serialize a form schema.
 */
function serializeFormSchema(
  schema: FormSchema,
  values: Record<Id, FieldValue>,
  docs: DocumentationBlock[],
): string {
  const attrs: Record<string, unknown> = { id: schema.id };
  if (schema.title) {
    attrs.title = schema.title;
  }

  const attrStr = serializeAttrs(attrs);
  const lines: string[] = [`{% form ${attrStr} %}`];

  // Group doc blocks by ref
  const docsByRef = new Map<string, DocumentationBlock[]>();
  for (const doc of docs) {
    const list = docsByRef.get(doc.ref) ?? [];
    list.push(doc);
    docsByRef.set(doc.ref, list);
  }

  // Add form-level doc blocks
  const formDocs = docsByRef.get(schema.id);
  if (formDocs) {
    for (const doc of formDocs) {
      lines.push("");
      lines.push(serializeDocBlock(doc));
    }
  }

  for (const group of schema.groups) {
    lines.push("");
    lines.push(serializeFieldGroup(group, values, docs));
  }

  lines.push("");
  lines.push("{% /form %}");

  return lines.join("\n");
}

// =============================================================================
// Main Serializer
// =============================================================================

/**
 * Serialize a ParsedForm to canonical Markdoc markdown format.
 *
 * @param form - The parsed form to serialize
 * @param opts - Serialization options
 * @returns The canonical markdown string
 */
export function serialize(form: ParsedForm, opts?: SerializeOptions): string {
  const version = opts?.markformVersion ?? "0.1.0";

  // Build frontmatter
  const frontmatter = `---
markform:
  markform_version: "${version}"
---`;

  // Serialize form body
  const body = serializeFormSchema(
    form.schema,
    form.valuesByFieldId,
    form.docs,
  );

  return `${frontmatter}\n\n${body}\n`;
}
