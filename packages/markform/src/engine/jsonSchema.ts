/**
 * JSON Schema export for Markform forms.
 *
 * Converts parsed forms to JSON Schema format (draft 2020-12).
 * Includes x-markform extension properties for Markform-specific metadata.
 */

import type {
  CheckboxesField,
  CheckboxMode,
  ApprovalMode,
  DateField,
  DocumentationBlock,
  Field,
  FieldPriorityLevel,
  MultiSelectField,
  NumberField,
  ParsedForm,
  SingleSelectField,
  StringField,
  StringListField,
  TableColumn,
  TableField,
  UrlField,
  UrlListField,
  YearField,
} from './coreTypes.js';

// =============================================================================
// JSON Schema Types (subset we use)
// =============================================================================

/** JSON Schema type values */
type JsonSchemaType = 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object' | 'null';

/** JSON Schema format values */
type JsonSchemaFormat = 'date' | 'uri' | 'email' | 'uri-reference';

/** JSON Schema property definition */
interface JsonSchemaProperty {
  type?: JsonSchemaType | JsonSchemaType[];
  title?: string;
  description?: string;
  enum?: (string | number | boolean | null)[];
  const?: string | number | boolean | null;
  format?: JsonSchemaFormat;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  // JSON Schema 2019-09/2020-12 format validation keywords
  formatMinimum?: string;
  formatMaximum?: string;
  items?: JsonSchemaProperty;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  additionalProperties?: boolean | JsonSchemaProperty;
  'x-markform'?: MarkformFieldExtension;
}

/** Root JSON Schema object (does not extend JsonSchemaProperty to allow different x-markform type) */
interface JsonSchemaRoot {
  $schema: string;
  $id?: string;
  type: 'object';
  title?: string;
  description?: string;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  'x-markform'?: MarkformSchemaExtension;
}

// =============================================================================
// Markform Extension Types
// =============================================================================

/** Form-level Markform extension data */
export interface MarkformSchemaExtension {
  spec: string;
  roles?: string[];
  roleInstructions?: Record<string, string>;
  groups?: { id: string; title?: string }[];
}

/** Field-level Markform extension data */
export interface MarkformFieldExtension {
  role?: string;
  priority?: FieldPriorityLevel;
  group?: string;
  checkboxMode?: CheckboxMode;
  approvalMode?: ApprovalMode;
  minDone?: number;
  placeholder?: string;
  examples?: string[];
}

// =============================================================================
// Options and Result Types
// =============================================================================

/** JSON Schema draft version */
export type JsonSchemaDraft = '2020-12' | '2019-09' | 'draft-07';

/** Options for JSON Schema generation */
export interface JsonSchemaOptions {
  /** Include x-markform extension properties (default: true) */
  includeExtensions?: boolean;
  /** JSON Schema draft version (default: '2020-12') */
  draft?: JsonSchemaDraft;
}

/** Result from JSON Schema generation */
export interface JsonSchemaResult {
  /** The generated JSON Schema */
  schema: JsonSchemaRoot;
}

// =============================================================================
// Schema URL Map
// =============================================================================

const SCHEMA_URLS: Record<JsonSchemaDraft, string> = {
  '2020-12': 'https://json-schema.org/draft/2020-12/schema',
  '2019-09': 'https://json-schema.org/draft/2019-09/schema',
  'draft-07': 'http://json-schema.org/draft-07/schema#',
};

// =============================================================================
// Documentation Helpers
// =============================================================================

/**
 * Find description for a field from doc blocks.
 */
function findDescription(docs: DocumentationBlock[], fieldId: string): string | undefined {
  // Look for 'description' or 'documentation' tags that reference this field
  for (const doc of docs) {
    if (doc.ref === fieldId && (doc.tag === 'description' || doc.tag === 'documentation')) {
      return doc.bodyMarkdown.trim();
    }
  }
  return undefined;
}

// =============================================================================
// Field Type Converters
// =============================================================================

function stringFieldToJsonSchema(
  field: StringField,
  docs: DocumentationBlock[],
  options: Required<JsonSchemaOptions>,
  groupId?: string,
): JsonSchemaProperty {
  const schema: JsonSchemaProperty = {
    type: 'string',
    title: field.label,
  };

  const description = findDescription(docs, field.id);
  if (description) {
    schema.description = description;
  }

  if (field.minLength !== undefined) {
    schema.minLength = field.minLength;
  }
  if (field.maxLength !== undefined) {
    schema.maxLength = field.maxLength;
  }
  if (field.pattern !== undefined) {
    schema.pattern = field.pattern;
  }

  if (options.includeExtensions) {
    schema['x-markform'] = buildFieldExtension(field, groupId);
  }

  return schema;
}

function numberFieldToJsonSchema(
  field: NumberField,
  docs: DocumentationBlock[],
  options: Required<JsonSchemaOptions>,
  groupId?: string,
): JsonSchemaProperty {
  const schema: JsonSchemaProperty = {
    type: field.integer ? 'integer' : 'number',
    title: field.label,
  };

  const description = findDescription(docs, field.id);
  if (description) {
    schema.description = description;
  }

  if (field.min !== undefined) {
    schema.minimum = field.min;
  }
  if (field.max !== undefined) {
    schema.maximum = field.max;
  }

  if (options.includeExtensions) {
    schema['x-markform'] = buildFieldExtension(field, groupId);
  }

  return schema;
}

function dateFieldToJsonSchema(
  field: DateField,
  docs: DocumentationBlock[],
  options: Required<JsonSchemaOptions>,
  groupId?: string,
): JsonSchemaProperty {
  const schema: JsonSchemaProperty = {
    type: 'string',
    format: 'date',
    title: field.label,
  };

  const description = findDescription(docs, field.id);
  if (description) {
    schema.description = description;
  }

  // Use formatMinimum/formatMaximum for date constraints (JSON Schema 2019-09/2020-12 only)
  // These keywords don't exist in draft-07, so we skip them for that draft
  if (options.draft !== 'draft-07') {
    if (field.min) {
      schema.formatMinimum = field.min;
    }
    if (field.max) {
      schema.formatMaximum = field.max;
    }
  }

  // Also include in x-markform extension for backward compatibility
  if (options.includeExtensions) {
    const ext = buildFieldExtension(field, groupId);
    if (field.min) {
      (ext as MarkformFieldExtension & { minDate?: string }).minDate = field.min;
    }
    if (field.max) {
      (ext as MarkformFieldExtension & { maxDate?: string }).maxDate = field.max;
    }
    schema['x-markform'] = ext;
  }

  return schema;
}

function yearFieldToJsonSchema(
  field: YearField,
  docs: DocumentationBlock[],
  options: Required<JsonSchemaOptions>,
  groupId?: string,
): JsonSchemaProperty {
  const schema: JsonSchemaProperty = {
    type: 'integer',
    title: field.label,
  };

  const description = findDescription(docs, field.id);
  if (description) {
    schema.description = description;
  }

  if (field.min !== undefined) {
    schema.minimum = field.min;
  }
  if (field.max !== undefined) {
    schema.maximum = field.max;
  }

  if (options.includeExtensions) {
    schema['x-markform'] = buildFieldExtension(field, groupId);
  }

  return schema;
}

function urlFieldToJsonSchema(
  field: UrlField,
  docs: DocumentationBlock[],
  options: Required<JsonSchemaOptions>,
  groupId?: string,
): JsonSchemaProperty {
  const schema: JsonSchemaProperty = {
    type: 'string',
    format: 'uri',
    title: field.label,
  };

  const description = findDescription(docs, field.id);
  if (description) {
    schema.description = description;
  }

  if (options.includeExtensions) {
    schema['x-markform'] = buildFieldExtension(field, groupId);
  }

  return schema;
}

function stringListFieldToJsonSchema(
  field: StringListField,
  docs: DocumentationBlock[],
  options: Required<JsonSchemaOptions>,
  groupId?: string,
): JsonSchemaProperty {
  const itemSchema: JsonSchemaProperty = { type: 'string' };
  if (field.itemMinLength !== undefined) {
    itemSchema.minLength = field.itemMinLength;
  }
  if (field.itemMaxLength !== undefined) {
    itemSchema.maxLength = field.itemMaxLength;
  }

  const schema: JsonSchemaProperty = {
    type: 'array',
    items: itemSchema,
    title: field.label,
  };

  const description = findDescription(docs, field.id);
  if (description) {
    schema.description = description;
  }

  if (field.minItems !== undefined) {
    schema.minItems = field.minItems;
  }
  if (field.maxItems !== undefined) {
    schema.maxItems = field.maxItems;
  }
  if (field.uniqueItems) {
    schema.uniqueItems = true;
  }

  if (options.includeExtensions) {
    schema['x-markform'] = buildFieldExtension(field, groupId);
  }

  return schema;
}

function urlListFieldToJsonSchema(
  field: UrlListField,
  docs: DocumentationBlock[],
  options: Required<JsonSchemaOptions>,
  groupId?: string,
): JsonSchemaProperty {
  const schema: JsonSchemaProperty = {
    type: 'array',
    items: { type: 'string', format: 'uri' },
    title: field.label,
  };

  const description = findDescription(docs, field.id);
  if (description) {
    schema.description = description;
  }

  if (field.minItems !== undefined) {
    schema.minItems = field.minItems;
  }
  if (field.maxItems !== undefined) {
    schema.maxItems = field.maxItems;
  }
  if (field.uniqueItems) {
    schema.uniqueItems = true;
  }

  if (options.includeExtensions) {
    schema['x-markform'] = buildFieldExtension(field, groupId);
  }

  return schema;
}

function singleSelectFieldToJsonSchema(
  field: SingleSelectField,
  docs: DocumentationBlock[],
  options: Required<JsonSchemaOptions>,
  groupId?: string,
): JsonSchemaProperty {
  const schema: JsonSchemaProperty = {
    type: 'string',
    enum: field.options.map((opt) => opt.id),
    title: field.label,
  };

  const description = findDescription(docs, field.id);
  if (description) {
    schema.description = description;
  }

  if (options.includeExtensions) {
    schema['x-markform'] = buildFieldExtension(field, groupId);
  }

  return schema;
}

function multiSelectFieldToJsonSchema(
  field: MultiSelectField,
  docs: DocumentationBlock[],
  options: Required<JsonSchemaOptions>,
  groupId?: string,
): JsonSchemaProperty {
  const schema: JsonSchemaProperty = {
    type: 'array',
    items: {
      type: 'string',
      enum: field.options.map((opt) => opt.id),
    },
    title: field.label,
  };

  const description = findDescription(docs, field.id);
  if (description) {
    schema.description = description;
  }

  if (field.minSelections !== undefined) {
    schema.minItems = field.minSelections;
  }
  if (field.maxSelections !== undefined) {
    schema.maxItems = field.maxSelections;
  }

  if (options.includeExtensions) {
    schema['x-markform'] = buildFieldExtension(field, groupId);
  }

  return schema;
}

function checkboxesFieldToJsonSchema(
  field: CheckboxesField,
  docs: DocumentationBlock[],
  options: Required<JsonSchemaOptions>,
  groupId?: string,
): JsonSchemaProperty {
  // Checkboxes are represented as an object with each option as a property
  // The value for each property depends on the checkbox mode
  const validStates = getValidCheckboxStates(field.checkboxMode);

  const properties: Record<string, JsonSchemaProperty> = {};
  for (const opt of field.options) {
    properties[opt.id] = {
      type: 'string',
      enum: validStates,
      title: opt.label,
    };
  }

  const schema: JsonSchemaProperty = {
    type: 'object',
    properties,
    title: field.label,
  };

  const description = findDescription(docs, field.id);
  if (description) {
    schema.description = description;
  }

  if (options.includeExtensions) {
    const ext = buildFieldExtension(field, groupId);
    ext.checkboxMode = field.checkboxMode;
    if (field.minDone !== undefined) {
      ext.minDone = field.minDone;
    }
    if (field.approvalMode !== 'none') {
      ext.approvalMode = field.approvalMode;
    }
    schema['x-markform'] = ext;
  }

  return schema;
}

function getValidCheckboxStates(mode: CheckboxMode): string[] {
  switch (mode) {
    case 'multi':
      return ['todo', 'done', 'incomplete', 'active', 'na'];
    case 'simple':
      return ['todo', 'done'];
    case 'explicit':
      return ['unfilled', 'yes', 'no'];
  }
}

function tableFieldToJsonSchema(
  field: TableField,
  docs: DocumentationBlock[],
  options: Required<JsonSchemaOptions>,
  groupId?: string,
): JsonSchemaProperty {
  const rowProperties: Record<string, JsonSchemaProperty> = {};
  const requiredColumns: string[] = [];

  for (const col of field.columns) {
    rowProperties[col.id] = columnToJsonSchema(col);
    if (col.required) {
      requiredColumns.push(col.id);
    }
  }

  const rowSchema: JsonSchemaProperty = {
    type: 'object',
    properties: rowProperties,
  };

  if (requiredColumns.length > 0) {
    rowSchema.required = requiredColumns;
  }

  const schema: JsonSchemaProperty = {
    type: 'array',
    items: rowSchema,
    title: field.label,
  };

  const description = findDescription(docs, field.id);
  if (description) {
    schema.description = description;
  }

  if (field.minRows !== undefined) {
    schema.minItems = field.minRows;
  }
  if (field.maxRows !== undefined) {
    schema.maxItems = field.maxRows;
  }

  if (options.includeExtensions) {
    schema['x-markform'] = buildFieldExtension(field, groupId);
  }

  return schema;
}

function columnToJsonSchema(col: TableColumn): JsonSchemaProperty {
  const schema: JsonSchemaProperty = {
    title: col.label,
  };

  switch (col.type) {
    case 'string':
      schema.type = 'string';
      break;
    case 'number':
      schema.type = 'number';
      break;
    case 'url':
      schema.type = 'string';
      schema.format = 'uri';
      break;
    case 'date':
      schema.type = 'string';
      schema.format = 'date';
      break;
    case 'year':
      schema.type = 'integer';
      break;
  }

  return schema;
}

// =============================================================================
// Extension Builders
// =============================================================================

function buildFieldExtension(field: Field, groupId?: string): MarkformFieldExtension {
  const ext: MarkformFieldExtension = {};

  if (field.role) {
    ext.role = field.role;
  }

  if (field.priority && field.priority !== 'medium') {
    ext.priority = field.priority;
  }

  if (groupId) {
    ext.group = groupId;
  }

  if (field.placeholder) {
    ext.placeholder = field.placeholder;
  }

  if (field.examples && field.examples.length > 0) {
    ext.examples = field.examples;
  }

  return ext;
}

function buildSchemaExtension(form: ParsedForm): MarkformSchemaExtension {
  const ext: MarkformSchemaExtension = {
    spec: form.metadata?.markformVersion ?? 'MF/0.1',
  };

  if (form.metadata?.roles && form.metadata.roles.length > 0) {
    ext.roles = form.metadata.roles;
  }

  if (form.metadata?.roleInstructions && Object.keys(form.metadata.roleInstructions).length > 0) {
    ext.roleInstructions = form.metadata.roleInstructions;
  }

  // Build groups list (excluding implicit groups)
  const groups: { id: string; title?: string }[] = [];
  for (const group of form.schema.groups) {
    if (!group.implicit) {
      groups.push({
        id: group.id,
        ...(group.title ? { title: group.title } : {}),
      });
    }
  }
  if (groups.length > 0) {
    ext.groups = groups;
  }

  return ext;
}

// =============================================================================
// Main Converter
// =============================================================================

/**
 * Convert a single field to its JSON Schema representation.
 */
export function fieldToJsonSchema(
  field: Field,
  docs: DocumentationBlock[],
  options?: JsonSchemaOptions,
  groupId?: string,
): JsonSchemaProperty {
  const opts: Required<JsonSchemaOptions> = {
    includeExtensions: options?.includeExtensions ?? true,
    draft: options?.draft ?? '2020-12',
  };

  switch (field.kind) {
    case 'string':
      return stringFieldToJsonSchema(field, docs, opts, groupId);
    case 'number':
      return numberFieldToJsonSchema(field, docs, opts, groupId);
    case 'date':
      return dateFieldToJsonSchema(field, docs, opts, groupId);
    case 'year':
      return yearFieldToJsonSchema(field, docs, opts, groupId);
    case 'url':
      return urlFieldToJsonSchema(field, docs, opts, groupId);
    case 'string_list':
      return stringListFieldToJsonSchema(field, docs, opts, groupId);
    case 'url_list':
      return urlListFieldToJsonSchema(field, docs, opts, groupId);
    case 'single_select':
      return singleSelectFieldToJsonSchema(field, docs, opts, groupId);
    case 'multi_select':
      return multiSelectFieldToJsonSchema(field, docs, opts, groupId);
    case 'checkboxes':
      return checkboxesFieldToJsonSchema(field, docs, opts, groupId);
    case 'table':
      return tableFieldToJsonSchema(field, docs, opts, groupId);
    default: {
      // Exhaustiveness check - TypeScript will error if a case is missing
      const _exhaustive: never = field;
      throw new Error(`Unhandled field kind: ${(_exhaustive as { kind: string }).kind}`);
    }
  }
}

/**
 * Convert a parsed form to JSON Schema.
 *
 * Main API for JSON Schema generation. Use from libraries or CLI.
 */
export function formToJsonSchema(form: ParsedForm, options?: JsonSchemaOptions): JsonSchemaResult {
  const opts: Required<JsonSchemaOptions> = {
    includeExtensions: options?.includeExtensions ?? true,
    draft: options?.draft ?? '2020-12',
  };

  const properties: Record<string, JsonSchemaProperty> = {};
  const requiredFields: string[] = [];

  // Process all fields from all groups
  for (const group of form.schema.groups) {
    const groupId = group.implicit ? undefined : group.id;
    for (const field of group.children) {
      properties[field.id] = fieldToJsonSchema(field, form.docs, opts, groupId);
      if (field.required) {
        requiredFields.push(field.id);
      }
    }
  }

  // Build root schema
  const schema: JsonSchemaRoot = {
    $schema: SCHEMA_URLS[opts.draft],
    $id: form.schema.id,
    type: 'object',
    properties,
  };

  if (form.schema.title) {
    schema.title = form.schema.title;
  }

  // Find form-level description
  const formDescription = findDescription(form.docs, form.schema.id);
  if (formDescription) {
    schema.description = formDescription;
  }

  if (requiredFields.length > 0) {
    schema.required = requiredFields;
  }

  if (opts.includeExtensions) {
    schema['x-markform'] = buildSchemaExtension(form);
  }

  return { schema };
}
