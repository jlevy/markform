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
  FieldResponse,
  FormSchema,
  Id,
  MultiSelectField,
  MultiSelectValue,
  Note,
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
  UrlField,
  UrlListField,
  UrlListValue,
  UrlValue,
} from './coreTypes.js';
import { AGENT_ROLE, DEFAULT_PRIORITY, MF_SPEC_VERSION } from '../settings.js';

// =============================================================================
// Sentinel Value Helpers
// =============================================================================

/**
 * Format a value fence block with the given content.
 */
function formatValueFence(content: string): string {
  return `\n\`\`\`value\n${content}\n\`\`\`\n`;
}

/**
 * Get sentinel value content for skipped/aborted fields with reason.
 * Returns the fence block if there's a reason, empty string otherwise.
 */
function getSentinelContent(response: FieldResponse | undefined): string {
  if (response?.state === 'skipped' && response.reason) {
    return formatValueFence(`|SKIP| (${response.reason})`);
  }
  if (response?.state === 'aborted' && response.reason) {
    return formatValueFence(`|ABORT| (${response.reason})`);
  }
  return '';
}

// =============================================================================
// Options
// =============================================================================

export interface SerializeOptions {
  /** Markform spec version to use in frontmatter. Defaults to MF_SPEC_VERSION. */
  specVersion?: string;
}

// =============================================================================
// Attribute Serialization
// =============================================================================

/**
 * Serialize an attribute value to Markdoc format.
 */
function serializeAttrValue(value: unknown): string {
  if (typeof value === 'string') {
    // Escape backslashes and quotes
    const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `"${escaped}"`;
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    const items = value.map((v) => serializeAttrValue(v)).join(', ');
    return `[${items}]`;
  }
  if (typeof value === 'object') {
    // Serialize plain objects as Markdoc object literals: {key: value, key2: value2}
    const entries = Object.entries(value as Record<string, unknown>);
    const parts = entries.map(([k, v]) => `${k}: ${serializeAttrValue(v)}`);
    return `{${parts.join(', ')}}`;
  }
  // Handle remaining primitive types (bigint, symbol, undefined, function)
  // These shouldn't appear in form attributes but handle gracefully
  if (typeof value === 'bigint') {
    return String(value);
  }
  if (typeof value === 'undefined') {
    return 'null';
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

  return parts.join(' ');
}

// =============================================================================
// Checkbox Marker Serialization
// =============================================================================

/** Map checkbox state to marker character */
const STATE_TO_MARKER: Record<CheckboxValue, string> = {
  // Multi mode
  todo: ' ',
  done: 'x',
  incomplete: '/',
  active: '*',
  na: '-',
  // Explicit mode
  unfilled: ' ',
  yes: 'y',
  no: 'n',
};

/**
 * Get the checkbox marker for a state.
 */
function getMarker(state: CheckboxValue): string {
  return STATE_TO_MARKER[state] ?? ' ';
}

// =============================================================================
// Field Serialization
// =============================================================================

/**
 * Serialize a string field.
 */
function serializeStringField(field: StringField, response: FieldResponse | undefined): string {
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

  // Add state attribute for skipped/aborted (markform-216)
  if (response?.state === 'skipped' || response?.state === 'aborted') {
    attrs.state = response.state;
  }

  const attrStr = serializeAttrs(attrs);
  let content = '';

  // Extract value from response if state is "answered"
  if (response?.state === 'answered' && response.value) {
    const value = response.value as StringValue;
    if (value.value) {
      content = `\n\`\`\`value\n${value.value}\n\`\`\`\n`;
    }
  }

  // Sentinel with reason for skipped/aborted overrides value content
  const sentinelContent = getSentinelContent(response);
  if (sentinelContent) {
    content = sentinelContent;
  }

  return `{% string-field ${attrStr} %}${content}{% /string-field %}`;
}

/**
 * Serialize a number field.
 */
function serializeNumberField(field: NumberField, response: FieldResponse | undefined): string {
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

  // Add state attribute for skipped/aborted (markform-216)
  if (response?.state === 'skipped' || response?.state === 'aborted') {
    attrs.state = response.state;
  }

  const attrStr = serializeAttrs(attrs);
  let content = '';

  // Extract value from response if state is "answered"
  if (response?.state === 'answered' && response.value) {
    const value = response.value as NumberValue;
    if (value.value !== null && value.value !== undefined) {
      content = `\n\`\`\`value\n${value.value}\n\`\`\`\n`;
    }
  }

  // Sentinel with reason for skipped/aborted overrides value content
  const sentinelContent = getSentinelContent(response);
  if (sentinelContent) {
    content = sentinelContent;
  }

  return `{% number-field ${attrStr} %}${content}{% /number-field %}`;
}

/**
 * Serialize a string-list field.
 */
function serializeStringListField(
  field: StringListField,
  response: FieldResponse | undefined,
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

  // Add state attribute for skipped/aborted (markform-216)
  if (response?.state === 'skipped' || response?.state === 'aborted') {
    attrs.state = response.state;
  }

  const attrStr = serializeAttrs(attrs);
  let content = '';

  // Extract value from response if state is "answered"
  if (response?.state === 'answered' && response.value) {
    const value = response.value as StringListValue;
    if (value.items && value.items.length > 0) {
      content = `\n\`\`\`value\n${value.items.join('\n')}\n\`\`\`\n`;
    }
  }

  // Sentinel with reason for skipped/aborted overrides value content
  const sentinelContent = getSentinelContent(response);
  if (sentinelContent) {
    content = sentinelContent;
  }

  return `{% string-list ${attrStr} %}${content}{% /string-list %}`;
}

/**
 * Serialize options (for single-select, multi-select, checkboxes).
 */
function serializeOptions(options: Option[], selected: Record<string, CheckboxValue>): string {
  const lines: string[] = [];

  for (const opt of options) {
    const state = selected[opt.id] ?? 'todo';
    const marker = getMarker(state);
    lines.push(`- [${marker}] ${opt.label} {% #${opt.id} %}`);
  }

  return lines.join('\n');
}

/**
 * Serialize a single-select field.
 */
function serializeSingleSelectField(
  field: SingleSelectField,
  response: FieldResponse | undefined,
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

  // Add state attribute for skipped/aborted (markform-216)
  if (response?.state === 'skipped' || response?.state === 'aborted') {
    attrs.state = response.state;
  }

  const attrStr = serializeAttrs(attrs);

  // Extract value from response if state is "answered"
  let value: SingleSelectValue | undefined;
  if (response?.state === 'answered' && response.value) {
    value = response.value as SingleSelectValue;
  }

  // Convert selected to checkbox state format
  const selected: Record<string, CheckboxValue> = {};
  for (const opt of field.options) {
    selected[opt.id] = opt.id === value?.selected ? 'done' : 'todo';
  }

  const options = serializeOptions(field.options, selected);
  return `{% single-select ${attrStr} %}\n${options}\n{% /single-select %}`;
}

/**
 * Serialize a multi-select field.
 */
function serializeMultiSelectField(
  field: MultiSelectField,
  response: FieldResponse | undefined,
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

  // Add state attribute for skipped/aborted (markform-216)
  if (response?.state === 'skipped' || response?.state === 'aborted') {
    attrs.state = response.state;
  }

  const attrStr = serializeAttrs(attrs);

  // Extract value from response if state is "answered"
  let value: MultiSelectValue | undefined;
  if (response?.state === 'answered' && response.value) {
    value = response.value as MultiSelectValue;
  }

  // Convert selected to checkbox state format
  const selected: Record<string, CheckboxValue> = {};
  const selectedSet = new Set(value?.selected ?? []);
  for (const opt of field.options) {
    selected[opt.id] = selectedSet.has(opt.id) ? 'done' : 'todo';
  }

  const options = serializeOptions(field.options, selected);
  return `{% multi-select ${attrStr} %}\n${options}\n{% /multi-select %}`;
}

/**
 * Serialize a checkboxes field.
 */
function serializeCheckboxesField(
  field: CheckboxesField,
  response: FieldResponse | undefined,
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
  if (field.checkboxMode !== 'multi') {
    attrs.checkboxMode = field.checkboxMode;
  }
  if (field.minDone !== undefined) {
    attrs.minDone = field.minDone;
  }
  if (field.approvalMode !== 'none') {
    attrs.approvalMode = field.approvalMode;
  }
  if (field.validate) {
    attrs.validate = field.validate;
  }

  // Add state attribute for skipped/aborted (markform-216)
  if (response?.state === 'skipped' || response?.state === 'aborted') {
    attrs.state = response.state;
  }

  const attrStr = serializeAttrs(attrs);

  // Extract value from response if state is "answered"
  let value: CheckboxesValue | undefined;
  if (response?.state === 'answered' && response.value) {
    value = response.value as CheckboxesValue;
  }

  const options = serializeOptions(field.options, value?.values ?? {});
  return `{% checkboxes ${attrStr} %}\n${options}\n{% /checkboxes %}`;
}

/**
 * Serialize a url-field.
 */
function serializeUrlField(field: UrlField, response: FieldResponse | undefined): string {
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

  // Add state attribute for skipped/aborted (markform-216)
  if (response?.state === 'skipped' || response?.state === 'aborted') {
    attrs.state = response.state;
  }

  const attrStr = serializeAttrs(attrs);
  let content = '';

  // Extract value from response if state is "answered"
  if (response?.state === 'answered' && response.value) {
    const value = response.value as UrlValue;
    if (value.value) {
      content = `\n\`\`\`value\n${value.value}\n\`\`\`\n`;
    }
  }

  // Sentinel with reason for skipped/aborted overrides value content
  const sentinelContent = getSentinelContent(response);
  if (sentinelContent) {
    content = sentinelContent;
  }

  return `{% url-field ${attrStr} %}${content}{% /url-field %}`;
}

/**
 * Serialize a url-list field.
 */
function serializeUrlListField(field: UrlListField, response: FieldResponse | undefined): string {
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
  if (field.uniqueItems) {
    attrs.uniqueItems = field.uniqueItems;
  }
  if (field.validate) {
    attrs.validate = field.validate;
  }

  // Add state attribute for skipped/aborted (markform-216)
  if (response?.state === 'skipped' || response?.state === 'aborted') {
    attrs.state = response.state;
  }

  const attrStr = serializeAttrs(attrs);
  let content = '';

  // Extract value from response if state is "answered"
  if (response?.state === 'answered' && response.value) {
    const value = response.value as UrlListValue;
    if (value.items && value.items.length > 0) {
      content = `\n\`\`\`value\n${value.items.join('\n')}\n\`\`\`\n`;
    }
  }

  // Sentinel with reason for skipped/aborted overrides value content
  const sentinelContent = getSentinelContent(response);
  if (sentinelContent) {
    content = sentinelContent;
  }

  return `{% url-list ${attrStr} %}${content}{% /url-list %}`;
}

/**
 * Serialize a field to Markdoc format.
 */
function serializeField(field: Field, responses: Record<Id, FieldResponse>): string {
  const response = responses[field.id];

  switch (field.kind) {
    case 'string':
      return serializeStringField(field, response);
    case 'number':
      return serializeNumberField(field, response);
    case 'string_list':
      return serializeStringListField(field, response);
    case 'single_select':
      return serializeSingleSelectField(field, response);
    case 'multi_select':
      return serializeMultiSelectField(field, response);
    case 'checkboxes':
      return serializeCheckboxesField(field, response);
    case 'url':
      return serializeUrlField(field, response);
    case 'url_list':
      return serializeUrlListField(field, response);
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
// Note Serialization (markform-217)
// =============================================================================

/**
 * Serialize notes in sorted order.
 * Notes are sorted numerically by ID suffix (n1, n2, n10 not n1, n10, n2).
 */
function serializeNotes(notes: Note[]): string {
  if (notes.length === 0) {
    return '';
  }

  // Sort numerically by ID suffix (n1, n2, n10 not n1, n10, n2)
  const sorted = [...notes].sort((a, b) => {
    const aNum = Number.parseInt(a.id.replace(/^n/, ''), 10) || 0;
    const bNum = Number.parseInt(b.id.replace(/^n/, ''), 10) || 0;
    return aNum - bNum;
  });

  const lines: string[] = [];
  for (const note of sorted) {
    const attrs: Record<string, unknown> = {
      id: note.id,
      ref: note.ref,
      role: note.role,
    };

    const attrStr = serializeAttrs(attrs);
    lines.push(`{% note ${attrStr} %}\n${note.text}\n{% /note %}`);
  }

  return lines.join('\n\n');
}

// =============================================================================
// Group and Form Serialization
// =============================================================================

/**
 * Serialize a field group.
 */
function serializeFieldGroup(
  group: FieldGroup,
  responses: Record<Id, FieldResponse>,
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
    lines.push('');
    lines.push(serializeField(field, responses));

    // Add any doc blocks for this field
    const fieldDocs = docsByRef.get(field.id);
    if (fieldDocs) {
      for (const doc of fieldDocs) {
        lines.push('');
        lines.push(serializeDocBlock(doc));
      }
    }
  }

  lines.push('');
  lines.push('{% /field-group %}');

  return lines.join('\n');
}

/**
 * Serialize a form schema.
 */
function serializeFormSchema(
  schema: FormSchema,
  responses: Record<Id, FieldResponse>,
  docs: DocumentationBlock[],
  notes: Note[],
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
      lines.push('');
      lines.push(serializeDocBlock(doc));
    }
  }

  for (const group of schema.groups) {
    lines.push('');
    lines.push(serializeFieldGroup(group, responses, docs));
  }

  // Add notes at end of form, before closing tag (markform-217)
  const notesContent = serializeNotes(notes);
  if (notesContent) {
    lines.push('');
    lines.push(notesContent);
  }

  lines.push('');
  lines.push('{% /form %}');

  return lines.join('\n');
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
  const specVersion = opts?.specVersion ?? MF_SPEC_VERSION;

  // Build frontmatter
  const frontmatter = `---
markform:
  spec: "${specVersion}"
---`;

  // Serialize form body
  const body = serializeFormSchema(form.schema, form.responsesByFieldId, form.docs, form.notes);

  return `${frontmatter}\n\n${body}\n`;
}

// =============================================================================
// Raw Markdown Serialization (human-readable, no markdoc)
// =============================================================================

/** Map checkbox state to GFM marker for raw markdown output */
const STATE_TO_GFM_MARKER: Record<CheckboxValue, string> = {
  // Multi mode
  todo: ' ',
  done: 'x',
  incomplete: '/',
  active: '*',
  na: '-',
  // Explicit mode
  unfilled: ' ',
  yes: 'x',
  no: ' ',
};

/**
 * Serialize a field value to raw markdown (human-readable).
 */
function serializeFieldRaw(field: Field, responses: Record<Id, FieldResponse>): string {
  const response = responses[field.id];
  const lines: string[] = [];

  lines.push(`**${field.label}:**`);

  // Extract value from response if state is "answered"
  const value = response?.state === 'answered' ? response.value : undefined;

  switch (field.kind) {
    case 'string': {
      const strValue = value as StringValue | undefined;
      if (strValue?.value) {
        lines.push(strValue.value);
      } else {
        lines.push('_(empty)_');
      }
      break;
    }
    case 'number': {
      const numValue = value as NumberValue | undefined;
      if (numValue?.value !== null && numValue?.value !== undefined) {
        lines.push(String(numValue.value));
      } else {
        lines.push('_(empty)_');
      }
      break;
    }
    case 'string_list': {
      const listValue = value as StringListValue | undefined;
      if (listValue?.items && listValue.items.length > 0) {
        for (const item of listValue.items) {
          lines.push(`- ${item}`);
        }
      } else {
        lines.push('_(empty)_');
      }
      break;
    }
    case 'single_select': {
      const selectValue = value as SingleSelectValue | undefined;
      const selected = field.options.find((opt) => opt.id === selectValue?.selected);
      if (selected) {
        lines.push(selected.label);
      } else {
        lines.push('_(none selected)_');
      }
      break;
    }
    case 'multi_select': {
      const multiValue = value as MultiSelectValue | undefined;
      const selectedSet = new Set(multiValue?.selected ?? []);
      const selectedOpts = field.options.filter((opt) => selectedSet.has(opt.id));
      if (selectedOpts.length > 0) {
        for (const opt of selectedOpts) {
          lines.push(`- ${opt.label}`);
        }
      } else {
        lines.push('_(none selected)_');
      }
      break;
    }
    case 'checkboxes': {
      const cbValue = value as CheckboxesValue | undefined;
      for (const opt of field.options) {
        const state = cbValue?.values[opt.id] ?? 'todo';
        const marker = STATE_TO_GFM_MARKER[state] ?? ' ';
        lines.push(`- [${marker}] ${opt.label}`);
      }
      break;
    }
    case 'url': {
      const urlValue = value as UrlValue | undefined;
      if (urlValue?.value) {
        lines.push(urlValue.value);
      } else {
        lines.push('_(empty)_');
      }
      break;
    }
    case 'url_list': {
      const urlListValue = value as UrlListValue | undefined;
      if (urlListValue?.items && urlListValue.items.length > 0) {
        for (const item of urlListValue.items) {
          lines.push(`- ${item}`);
        }
      } else {
        lines.push('_(empty)_');
      }
      break;
    }
  }

  return lines.join('\n');
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
    lines.push('');
  }

  // Add form-level docs
  const formDocs = docsByRef.get(form.schema.id);
  if (formDocs) {
    for (const doc of formDocs) {
      lines.push(doc.bodyMarkdown.trim());
      lines.push('');
    }
  }

  // Process each group
  for (const group of form.schema.groups) {
    // Add group title as H2
    if (group.title) {
      lines.push(`## ${group.title}`);
      lines.push('');
    }

    // Add group-level docs
    const groupDocs = docsByRef.get(group.id);
    if (groupDocs) {
      for (const doc of groupDocs) {
        lines.push(doc.bodyMarkdown.trim());
        lines.push('');
      }
    }

    // Process fields
    for (const field of group.children) {
      lines.push(serializeFieldRaw(field, form.responsesByFieldId));
      lines.push('');

      // Add field-level docs
      const fieldDocs = docsByRef.get(field.id);
      if (fieldDocs) {
        for (const doc of fieldDocs) {
          lines.push(doc.bodyMarkdown.trim());
          lines.push('');
        }
      }
    }
  }

  return lines.join('\n').trim() + '\n';
}
