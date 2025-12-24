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
} from "./coreTypes.js";
import { AGENT_ROLE, DEFAULT_PRIORITY } from "../settings.js";

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
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    const items = value.map((v) => serializeAttrValue(v)).join(", ");
    return `[${items}]`;
  }
  if (typeof value === "object") {
    // Serialize plain objects as Markdoc object literals: {key: value, key2: value2}
    const entries = Object.entries(value as Record<string, unknown>);
    const parts = entries.map(([k, v]) => `${k}: ${serializeAttrValue(v)}`);
    return `{${parts.join(", ")}}`;
  }
  // Handle remaining primitive types (bigint, symbol, undefined, function)
  // These shouldn't appear in form attributes but handle gracefully
  if (typeof value === "bigint") {
    return String(value);
  }
  if (typeof value === "undefined") {
    return "null";
  }
  // For functions and symbols, throw - these are invalid in form attributes
  throw new Error(`Cannot serialize value of type ${typeof value} to Markdoc`);
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
  if (field.priority !== DEFAULT_PRIORITY) {
    attrs.priority = field.priority;
  }
  if (field.role !== AGENT_ROLE) {
    attrs.role = field.role;
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
  if (field.priority !== DEFAULT_PRIORITY) {
    attrs.priority = field.priority;
  }
  if (field.role !== AGENT_ROLE) {
    attrs.role = field.role;
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
  if (field.priority !== DEFAULT_PRIORITY) {
    attrs.priority = field.priority;
  }
  if (field.role !== AGENT_ROLE) {
    attrs.role = field.role;
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
  if (field.priority !== DEFAULT_PRIORITY) {
    attrs.priority = field.priority;
  }
  if (field.role !== AGENT_ROLE) {
    attrs.role = field.role;
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
  if (field.priority !== DEFAULT_PRIORITY) {
    attrs.priority = field.priority;
  }
  if (field.role !== AGENT_ROLE) {
    attrs.role = field.role;
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
  if (field.priority !== DEFAULT_PRIORITY) {
    attrs.priority = field.priority;
  }
  if (field.role !== AGENT_ROLE) {
    attrs.role = field.role;
  }
  if (field.checkboxMode !== "multi") {
    attrs.checkboxMode = field.checkboxMode;
  }
  if (field.minDone !== undefined) {
    attrs.minDone = field.minDone;
  }
  if (field.approvalMode !== "none") {
    attrs.approvalMode = field.approvalMode;
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
 * Uses the semantic tag name (description, instructions, documentation).
 */
function serializeDocBlock(doc: DocumentationBlock): string {
  const attrs: Record<string, unknown> = { ref: doc.ref };
  const attrStr = serializeAttrs(attrs);
  return `{% ${doc.tag} ${attrStr} %}\n${doc.bodyMarkdown}\n{% /${doc.tag} %}`;
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

// =============================================================================
// Raw Markdown Serialization (human-readable, no markdoc)
// =============================================================================

/** Map checkbox state to GFM marker for raw markdown output */
const STATE_TO_GFM_MARKER: Record<CheckboxValue, string> = {
  // Multi mode
  todo: " ",
  done: "x",
  incomplete: "/",
  active: "*",
  na: "-",
  // Explicit mode
  unfilled: " ",
  yes: "x",
  no: " ",
};

/**
 * Serialize a field value to raw markdown (human-readable).
 */
function serializeFieldRaw(
  field: Field,
  values: Record<Id, FieldValue>,
): string {
  const value = values[field.id];
  const lines: string[] = [];

  lines.push(`**${field.label}:**`);

  switch (field.kind) {
    case "string": {
      const strValue = value as StringValue | undefined;
      if (strValue?.value) {
        lines.push(strValue.value);
      } else {
        lines.push("_(empty)_");
      }
      break;
    }
    case "number": {
      const numValue = value as NumberValue | undefined;
      if (numValue?.value !== null && numValue?.value !== undefined) {
        lines.push(String(numValue.value));
      } else {
        lines.push("_(empty)_");
      }
      break;
    }
    case "string_list": {
      const listValue = value as StringListValue | undefined;
      if (listValue?.items && listValue.items.length > 0) {
        for (const item of listValue.items) {
          lines.push(`- ${item}`);
        }
      } else {
        lines.push("_(empty)_");
      }
      break;
    }
    case "single_select": {
      const selectValue = value as SingleSelectValue | undefined;
      const selected = field.options.find(
        (opt) => opt.id === selectValue?.selected,
      );
      if (selected) {
        lines.push(selected.label);
      } else {
        lines.push("_(none selected)_");
      }
      break;
    }
    case "multi_select": {
      const multiValue = value as MultiSelectValue | undefined;
      const selectedSet = new Set(multiValue?.selected ?? []);
      const selectedOpts = field.options.filter((opt) =>
        selectedSet.has(opt.id),
      );
      if (selectedOpts.length > 0) {
        for (const opt of selectedOpts) {
          lines.push(`- ${opt.label}`);
        }
      } else {
        lines.push("_(none selected)_");
      }
      break;
    }
    case "checkboxes": {
      const cbValue = value as CheckboxesValue | undefined;
      for (const opt of field.options) {
        const state = cbValue?.values[opt.id] ?? "todo";
        const marker = STATE_TO_GFM_MARKER[state] ?? " ";
        lines.push(`- [${marker}] ${opt.label}`);
      }
      break;
    }
  }

  return lines.join("\n");
}

/**
 * Serialize a ParsedForm to plain, human-readable markdown.
 *
 * This output does NOT contain markdoc directives and cannot be parsed back
 * into a form. It's intended for human consumption and export.
 *
 * @param form - The parsed form to serialize
 * @returns Plain markdown string
 */
export function serializeRawMarkdown(form: ParsedForm): string {
  const lines: string[] = [];

  // Group doc blocks by ref
  const docsByRef = new Map<string, DocumentationBlock[]>();
  for (const doc of form.docs) {
    const list = docsByRef.get(doc.ref) ?? [];
    list.push(doc);
    docsByRef.set(doc.ref, list);
  }

  // Add form title
  if (form.schema.title) {
    lines.push(`# ${form.schema.title}`);
    lines.push("");
  }

  // Add form-level docs
  const formDocs = docsByRef.get(form.schema.id);
  if (formDocs) {
    for (const doc of formDocs) {
      lines.push(doc.bodyMarkdown.trim());
      lines.push("");
    }
  }

  // Process each group
  for (const group of form.schema.groups) {
    // Add group title as H2
    if (group.title) {
      lines.push(`## ${group.title}`);
      lines.push("");
    }

    // Add group-level docs
    const groupDocs = docsByRef.get(group.id);
    if (groupDocs) {
      for (const doc of groupDocs) {
        lines.push(doc.bodyMarkdown.trim());
        lines.push("");
      }
    }

    // Process fields
    for (const field of group.children) {
      lines.push(serializeFieldRaw(field, form.valuesByFieldId));
      lines.push("");

      // Add field-level docs
      const fieldDocs = docsByRef.get(field.id);
      if (fieldDocs) {
        for (const doc of fieldDocs) {
          lines.push(doc.bodyMarkdown.trim());
          lines.push("");
        }
      }
    }
  }

  return lines.join("\n").trim() + "\n";
}
