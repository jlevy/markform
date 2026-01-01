/**
 * Field kind parsers for Markform.
 *
 * This module contains the parsing logic for each field kind:
 * string, number, string-list, single-select, multi-select, checkboxes,
 * url, url-list, date, and year.
 */

import type { Node } from '@markdoc/markdoc';

import { AGENT_ROLE, DEFAULT_PRIORITY } from '../settings.js';
import { FIELD_KINDS, type FieldKind } from './fieldRegistry.js';
import type {
  ApprovalMode,
  CheckboxesField,
  CheckboxesValue,
  CheckboxMode,
  CheckboxValue,
  ColumnTypeName,
  ColumnTypeSpec,
  DateField,
  DateValue,
  Field,
  FieldResponse,
  FieldValue,
  MultiSelectField,
  MultiSelectValue,
  NumberField,
  NumberValue,
  Option,
  SingleSelectField,
  SingleSelectValue,
  StringField,
  StringListField,
  StringListValue,
  StringValue,
  TableColumn,
  TableField,
  TableValue,
  UrlField,
  UrlListField,
  UrlListValue,
  UrlValue,
  ValidatorRef,
  YearField,
  YearValue,
} from './coreTypes.js';
import {
  CHECKBOX_MARKERS,
  extractFenceValue,
  extractTableContent,
  extractOptionItems,
  getBooleanAttr,
  getNumberAttr,
  getStringArrayAttr,
  getStringAttr,
  getValidateAttr,
  isTagNode,
  parseOptionText,
} from './parseHelpers.js';
import { MarkformParseError } from '../errors.js';
import { tryParseSentinelResponse } from './parseSentinels.js';
import { parseMarkdownTable, extractTableHeaderLabels } from './table/parseTable.js';

// =============================================================================
// Field Response Helpers
// =============================================================================

/**
 * Determine if a field value is empty.
 * For old forms without state attributes, this infers whether the field has been filled.
 */
export function isValueEmpty(value: FieldValue): boolean {
  switch (value.kind) {
    case 'string':
    case 'number':
    case 'url':
    case 'date':
    case 'year':
      return value.value === null;
    case 'string_list':
    case 'url_list':
      return value.items.length === 0;
    case 'single_select':
      return value.selected === null;
    case 'multi_select':
      return value.selected.length === 0;
    case 'checkboxes': {
      // Empty if all checkboxes are in default unchecked state (todo/unfilled)
      const values = Object.values(value.values);
      return values.every((v) => v === 'todo' || v === 'unfilled');
    }
    case 'table':
      return (value.rows?.length ?? 0) === 0;
    default: {
      // Exhaustiveness check - TypeScript will error if a case is missing
      const _exhaustive: never = value;
      throw new Error(`Unhandled field value kind: ${(_exhaustive as { kind: string }).kind}`);
    }
  }
}

/**
 * Create a FieldResponse from a FieldValue.
 * For old forms without state attributes, infers state from value content.
 */
function createFieldResponse(value: FieldValue): FieldResponse {
  if (isValueEmpty(value)) {
    return { state: 'unanswered' };
  }
  return { state: 'answered', value };
}

/**
 * Parse state attribute from field node and validate consistency.
 * Returns a FieldResponse based on state attribute, sentinel values, or value content.
 */
export function parseFieldResponse(
  node: Node,
  value: FieldValue,
  fieldId: string,
  required: boolean,
): FieldResponse {
  const stateAttr = getStringAttr(node, 'state');
  const isFilled = !isValueEmpty(value);

  // Validate state attribute value if present
  if (stateAttr !== undefined) {
    if (
      stateAttr !== 'empty' &&
      stateAttr !== 'answered' &&
      stateAttr !== 'skipped' &&
      stateAttr !== 'aborted'
    ) {
      throw new MarkformParseError(
        `Invalid state attribute '${stateAttr}' on field '${fieldId}'. Must be empty, answered, skipped, or aborted`,
      );
    }

    // Validate state vs filled consistency
    if (stateAttr === 'skipped' || stateAttr === 'aborted') {
      if (isFilled) {
        throw new MarkformParseError(
          `Field '${fieldId}' has state='${stateAttr}' but contains a value. ${stateAttr} fields cannot have values.`,
        );
      }
    }

    // Validate skipped on required fields
    if (stateAttr === 'skipped' && required) {
      throw new MarkformParseError(
        `Field '${fieldId}' is required but has state='skipped'. Cannot skip required fields.`,
      );
    }

    // Return response based on explicit state attribute
    if (stateAttr === 'skipped') {
      return { state: 'skipped' };
    }
    if (stateAttr === 'aborted') {
      return { state: 'aborted' };
    }
    if (stateAttr === 'empty') {
      return { state: 'unanswered' };
    }
    if (stateAttr === 'answered') {
      if (!isFilled) {
        throw new MarkformParseError(`Field '${fieldId}' has state='answered' but has no value`);
      }
      return { state: 'answered', value };
    }
  }

  // No state attribute - infer from value content (backward compatibility)
  return createFieldResponse(value);
}

/**
 * Get priority attribute value or default to DEFAULT_PRIORITY.
 */
function getPriorityAttr(node: Node): 'high' | 'medium' | 'low' {
  const value = getStringAttr(node, 'priority');
  if (value === 'high' || value === 'medium' || value === 'low') {
    return value;
  }
  return DEFAULT_PRIORITY;
}

// =============================================================================
// Common Field Attribute Helpers
// =============================================================================

interface BaseFieldAttrs {
  id: string;
  label: string;
  required: boolean;
}

/**
 * Parse and validate base field attributes (id, label, required).
 * Throws ParseError if id or label is missing.
 */
function parseBaseFieldAttrs(node: Node, kind: FieldKind): BaseFieldAttrs {
  const id = getStringAttr(node, 'id');
  const label = getStringAttr(node, 'label');

  if (!id) {
    throw new MarkformParseError(`field kind="${kind}" missing required 'id' attribute`);
  }
  if (!label) {
    throw new MarkformParseError(`field '${id}' missing required 'label' attribute`);
  }

  const required = getBooleanAttr(node, 'required') ?? false;
  return { id, label, required };
}

interface CommonFieldAttrs {
  priority: 'high' | 'medium' | 'low';
  role: string;
  validate?: ValidatorRef[];
  report?: boolean;
}

/**
 * Get common field attributes (priority, role, validate, report).
 */
function getCommonFieldAttrs(node: Node): CommonFieldAttrs {
  return {
    priority: getPriorityAttr(node),
    role: getStringAttr(node, 'role') ?? AGENT_ROLE,
    validate: getValidateAttr(node),
    report: getBooleanAttr(node, 'report'),
  };
}

// =============================================================================
// Placeholder/Examples Validation Helpers
// =============================================================================

/**
 * Validate that placeholder/examples are not used on chooser fields.
 * Throws ParseError if either attribute is present.
 */
function validateNoPlaceholderExamples(node: Node, fieldType: string, fieldId: string): void {
  const placeholder = getStringAttr(node, 'placeholder');
  const examples = getStringArrayAttr(node, 'examples');

  if (placeholder !== undefined) {
    throw new MarkformParseError(
      `${fieldType} '${fieldId}' has 'placeholder' attribute, but placeholder is only valid on text-entry fields (string, number, string-list, url, url-list)`,
    );
  }
  if (examples !== undefined) {
    throw new MarkformParseError(
      `${fieldType} '${fieldId}' has 'examples' attribute, but examples is only valid on text-entry fields (string, number, string-list, url, url-list)`,
    );
  }
}

/**
 * Check if a string is a valid URL.
 */
function isValidUrl(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate examples for number fields - all must parse as numbers.
 */
function validateNumberExamples(examples: string[] | undefined, fieldId: string): void {
  if (!examples) return;
  for (const example of examples) {
    const parsed = Number(example);
    if (Number.isNaN(parsed)) {
      throw new MarkformParseError(
        `number-field '${fieldId}' has invalid example '${example}' - must be a valid number`,
      );
    }
  }
}

/**
 * Validate examples for URL fields - all must be valid URLs.
 */
function validateUrlExamples(examples: string[] | undefined, fieldId: string): void {
  if (!examples) return;
  for (const example of examples) {
    if (!isValidUrl(example)) {
      throw new MarkformParseError(
        `url-field '${fieldId}' has invalid example '${example}' - must be a valid URL`,
      );
    }
  }
}

/**
 * Warn if placeholder doesn't match the expected type.
 * Returns a warning message or undefined.
 * Note: Currently unused as the warning system is not yet implemented.
 */
function _warnPlaceholderTypeMismatch(
  placeholder: string | undefined,
  fieldType: 'number' | 'url',
  fieldId: string,
): string | undefined {
  if (!placeholder) return undefined;

  if (fieldType === 'number') {
    const parsed = Number(placeholder);
    if (Number.isNaN(parsed)) {
      return `number-field '${fieldId}' has placeholder '${placeholder}' that doesn't parse as a number`;
    }
  } else if (fieldType === 'url') {
    if (!isValidUrl(placeholder)) {
      return `url-field '${fieldId}' has placeholder '${placeholder}' that doesn't look like a valid URL`;
    }
  }
  return undefined;
}

// =============================================================================
// String Field Parser
// =============================================================================

/**
 * Parse a string-field tag.
 */
export function parseStringField(node: Node): { field: StringField; response: FieldResponse } {
  const { id, label, required } = parseBaseFieldAttrs(node, 'string');

  const field: StringField = {
    kind: 'string',
    id,
    label,
    required,
    ...getCommonFieldAttrs(node),
    multiline: getBooleanAttr(node, 'multiline'),
    pattern: getStringAttr(node, 'pattern'),
    minLength: getNumberAttr(node, 'minLength'),
    maxLength: getNumberAttr(node, 'maxLength'),
    placeholder: getStringAttr(node, 'placeholder'),
    examples: getStringArrayAttr(node, 'examples'),
  };

  // Check for sentinel values first
  const sentinelResponse = tryParseSentinelResponse(node, id, required);
  if (sentinelResponse) {
    return { field, response: sentinelResponse };
  }

  // No sentinel - parse normally
  const fenceContent = extractFenceValue(node);
  const trimmedContent = fenceContent !== null ? fenceContent.trim() : null;
  const value: StringValue = {
    kind: 'string',
    value: trimmedContent,
  };

  const response = parseFieldResponse(node, value, id, required);
  return { field, response };
}

// =============================================================================
// Number Field Parser
// =============================================================================

/**
 * Parse a number-field tag.
 */
export function parseNumberField(node: Node): { field: NumberField; response: FieldResponse } {
  const { id, label, required } = parseBaseFieldAttrs(node, 'number');

  const placeholder = getStringAttr(node, 'placeholder');
  const examples = getStringArrayAttr(node, 'examples');

  // Validate examples are valid numbers
  validateNumberExamples(examples, id);

  // Note: Placeholder type mismatch is a warning, not an error
  // The warnPlaceholderTypeMismatch function is available but warnings are not yet surfaced

  const field: NumberField = {
    kind: 'number',
    id,
    label,
    required,
    ...getCommonFieldAttrs(node),
    min: getNumberAttr(node, 'min'),
    max: getNumberAttr(node, 'max'),
    integer: getBooleanAttr(node, 'integer'),
    placeholder,
    examples,
  };

  // Check for sentinel values first
  const sentinelResponse = tryParseSentinelResponse(node, id, required);
  if (sentinelResponse) {
    return { field, response: sentinelResponse };
  }

  // No sentinel - parse number normally
  const fenceContent = extractFenceValue(node);
  const trimmedContent = fenceContent !== null ? fenceContent.trim() : '';
  let numValue: number | null = null;
  if (trimmedContent) {
    const parsed = Number(trimmedContent);
    if (!Number.isNaN(parsed)) {
      numValue = parsed;
    }
  }

  const value: NumberValue = {
    kind: 'number',
    value: numValue,
  };

  const response = parseFieldResponse(node, value, id, required);
  return { field, response };
}

// =============================================================================
// String List Field Parser
// =============================================================================

/**
 * Parse a string-list tag.
 */
export function parseStringListField(node: Node): {
  field: StringListField;
  response: FieldResponse;
} {
  const { id, label, required } = parseBaseFieldAttrs(node, 'string_list');

  const field: StringListField = {
    kind: 'string_list',
    id,
    label,
    required,
    ...getCommonFieldAttrs(node),
    minItems: getNumberAttr(node, 'minItems'),
    maxItems: getNumberAttr(node, 'maxItems'),
    itemMinLength: getNumberAttr(node, 'itemMinLength'),
    itemMaxLength: getNumberAttr(node, 'itemMaxLength'),
    uniqueItems: getBooleanAttr(node, 'uniqueItems'),
    placeholder: getStringAttr(node, 'placeholder'),
    examples: getStringArrayAttr(node, 'examples'),
  };

  // Check for sentinel values first
  const sentinelResponse = tryParseSentinelResponse(node, id, required);
  if (sentinelResponse) {
    return { field, response: sentinelResponse };
  }

  // No sentinel - parse list normally
  const fenceContent = extractFenceValue(node);
  const items: string[] = [];
  if (fenceContent !== null) {
    const lines = fenceContent.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) {
        items.push(trimmed);
      }
    }
  }

  const value: StringListValue = {
    kind: 'string_list',
    items,
  };

  const response = parseFieldResponse(node, value, id, required);
  return { field, response };
}

// =============================================================================
// Option Parsing (for Select/Checkbox fields)
// =============================================================================

/**
 * Parse options from a select/checkbox field.
 */
function parseOptions(
  node: Node,
  fieldId: string,
): { options: Option[]; selected: Record<string, CheckboxValue> } {
  const items = extractOptionItems(node);
  const options: Option[] = [];
  const selected: Record<string, CheckboxValue> = {};
  const seenIds = new Set<string>();

  for (const item of items) {
    const parsed = parseOptionText(item.text);
    if (!parsed) {
      continue;
    }

    if (!item.id) {
      throw new MarkformParseError(
        `Option in field '${fieldId}' missing ID annotation. Use {% #option_id %}`,
      );
    }

    if (seenIds.has(item.id)) {
      throw new MarkformParseError(`Duplicate option ID '${item.id}' in field '${fieldId}'`);
    }
    seenIds.add(item.id);

    options.push({ id: item.id, label: parsed.label });

    const state = CHECKBOX_MARKERS[parsed.marker];
    if (state !== undefined) {
      selected[item.id] = state;
    }
  }

  return { options, selected };
}

// =============================================================================
// Single Select Field Parser
// =============================================================================

/**
 * Parse a single-select tag.
 */
export function parseSingleSelectField(node: Node): {
  field: SingleSelectField;
  response: FieldResponse;
} {
  const { id, label, required } = parseBaseFieldAttrs(node, 'single_select');

  // Validate that placeholder/examples are not used on chooser fields
  validateNoPlaceholderExamples(node, 'single-select', id);

  const { options, selected } = parseOptions(node, id);

  const field: SingleSelectField = {
    kind: 'single_select',
    id,
    label,
    required,
    ...getCommonFieldAttrs(node),
    options,
  };

  // Find the selected option (exactly one with done/[x] state)
  let selectedOption: string | null = null;
  for (const [optId, state] of Object.entries(selected)) {
    if (state === 'done') {
      selectedOption = optId;
      break;
    }
  }

  const value: SingleSelectValue = {
    kind: 'single_select',
    selected: selectedOption,
  };

  const response = parseFieldResponse(node, value, id, required);
  return { field, response };
}

// =============================================================================
// Multi Select Field Parser
// =============================================================================

/**
 * Parse a multi-select tag.
 */
export function parseMultiSelectField(node: Node): {
  field: MultiSelectField;
  response: FieldResponse;
} {
  const { id, label, required } = parseBaseFieldAttrs(node, 'multi_select');

  // Validate that placeholder/examples are not used on chooser fields
  validateNoPlaceholderExamples(node, 'multi-select', id);

  const { options, selected } = parseOptions(node, id);

  const field: MultiSelectField = {
    kind: 'multi_select',
    id,
    label,
    required,
    ...getCommonFieldAttrs(node),
    options,
    minSelections: getNumberAttr(node, 'minSelections'),
    maxSelections: getNumberAttr(node, 'maxSelections'),
  };

  // Collect all selected options (those with done/[x] state)
  const selectedOptions: string[] = [];
  for (const [optId, state] of Object.entries(selected)) {
    if (state === 'done') {
      selectedOptions.push(optId);
    }
  }

  const value: MultiSelectValue = {
    kind: 'multi_select',
    selected: selectedOptions,
  };

  const response = parseFieldResponse(node, value, id, required);
  return { field, response };
}

// =============================================================================
// Checkboxes Field Parser
// =============================================================================

/**
 * Parse a checkboxes tag.
 */
export function parseCheckboxesField(node: Node): {
  field: CheckboxesField;
  response: FieldResponse;
} {
  // Checkboxes has special id/label handling (can't use parseBaseFieldAttrs due to required logic)
  const id = getStringAttr(node, 'id');
  const label = getStringAttr(node, 'label');

  if (!id) {
    throw new MarkformParseError('field kind="checkboxes" missing required \'id\' attribute');
  }
  if (!label) {
    throw new MarkformParseError(`field '${id}' missing required 'label' attribute`);
  }

  // Validate that placeholder/examples are not used on chooser fields
  validateNoPlaceholderExamples(node, 'checkboxes', id);

  const { options, selected } = parseOptions(node, id);

  const checkboxModeStr = getStringAttr(node, 'checkboxMode');
  let checkboxMode: CheckboxMode = 'multi'; // default
  if (
    checkboxModeStr === 'multi' ||
    checkboxModeStr === 'simple' ||
    checkboxModeStr === 'explicit'
  ) {
    checkboxMode = checkboxModeStr;
  }

  const approvalModeStr = getStringAttr(node, 'approvalMode');
  let approvalMode: ApprovalMode = 'none'; // default
  if (approvalModeStr === 'blocking') {
    approvalMode = 'blocking';
  }

  // Handle required attribute based on checkboxMode:
  // - explicit mode is inherently required (cannot be set to false)
  // - multi/simple modes default to optional (false)
  const explicitRequired = getBooleanAttr(node, 'required');
  let required: boolean;
  if (checkboxMode === 'explicit') {
    if (explicitRequired === false) {
      throw new MarkformParseError(
        `Checkbox field "${label}" has checkboxMode="explicit" which is inherently required. ` +
          `Cannot set required=false. Remove required attribute or change checkboxMode.`,
      );
    }
    required = true; // explicit mode is always required
  } else {
    required = explicitRequired ?? false; // multi/simple default to optional
  }

  const field: CheckboxesField = {
    kind: 'checkboxes',
    id,
    label,
    required,
    ...getCommonFieldAttrs(node),
    checkboxMode,
    minDone: getNumberAttr(node, 'minDone'),
    options,
    approvalMode,
  };

  // Initialize all options to their default state based on mode
  const values: Record<string, CheckboxValue> = {};

  for (const opt of options) {
    const state = selected[opt.id];
    if (state === undefined || state === 'todo') {
      // For explicit mode, "todo" (from [ ]) means "unfilled"
      values[opt.id] = checkboxMode === 'explicit' ? 'unfilled' : 'todo';
    } else {
      values[opt.id] = state;
    }
  }

  const value: CheckboxesValue = {
    kind: 'checkboxes',
    values,
  };

  const response = parseFieldResponse(node, value, id, required);
  return { field, response };
}

// =============================================================================
// URL Field Parser
// =============================================================================

/**
 * Parse a url-field tag.
 */
export function parseUrlField(node: Node): { field: UrlField; response: FieldResponse } {
  const { id, label, required } = parseBaseFieldAttrs(node, 'url');

  const placeholder = getStringAttr(node, 'placeholder');
  const examples = getStringArrayAttr(node, 'examples');

  // Validate examples are valid URLs
  validateUrlExamples(examples, id);

  // Note: Placeholder type mismatch is a warning, not an error

  const field: UrlField = {
    kind: 'url',
    id,
    label,
    required,
    ...getCommonFieldAttrs(node),
    placeholder,
    examples,
  };

  // Check for sentinel values first
  const sentinelResponse = tryParseSentinelResponse(node, id, required);
  if (sentinelResponse) {
    return { field, response: sentinelResponse };
  }

  // No sentinel - parse normally
  const fenceContent = extractFenceValue(node);
  const trimmedContent = fenceContent !== null ? fenceContent.trim() : null;
  const value: UrlValue = {
    kind: 'url',
    value: trimmedContent,
  };

  const response = parseFieldResponse(node, value, id, required);
  return { field, response };
}

// =============================================================================
// URL List Field Parser
// =============================================================================

/**
 * Parse a url-list tag.
 */
export function parseUrlListField(node: Node): { field: UrlListField; response: FieldResponse } {
  const { id, label, required } = parseBaseFieldAttrs(node, 'url_list');

  const placeholder = getStringAttr(node, 'placeholder');
  const examples = getStringArrayAttr(node, 'examples');

  // Validate examples are valid URLs
  validateUrlExamples(examples, id);

  // Note: Placeholder type mismatch is a warning, not an error

  const field: UrlListField = {
    kind: 'url_list',
    id,
    label,
    required,
    ...getCommonFieldAttrs(node),
    minItems: getNumberAttr(node, 'minItems'),
    maxItems: getNumberAttr(node, 'maxItems'),
    uniqueItems: getBooleanAttr(node, 'uniqueItems'),
    placeholder,
    examples,
  };

  // Check for sentinel values first
  const sentinelResponse = tryParseSentinelResponse(node, id, required);
  if (sentinelResponse) {
    return { field, response: sentinelResponse };
  }

  // No sentinel - parse list normally
  const fenceContent = extractFenceValue(node);
  const items: string[] = [];
  if (fenceContent !== null) {
    const lines = fenceContent.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) {
        items.push(trimmed);
      }
    }
  }

  const value: UrlListValue = {
    kind: 'url_list',
    items,
  };

  const response = parseFieldResponse(node, value, id, required);
  return { field, response };
}

// =============================================================================
// Date Field Parser
// =============================================================================

/**
 * Parse a date-field tag.
 */
export function parseDateField(node: Node): { field: DateField; response: FieldResponse } {
  const { id, label, required } = parseBaseFieldAttrs(node, 'date');

  const field: DateField = {
    kind: 'date',
    id,
    label,
    required,
    ...getCommonFieldAttrs(node),
    min: getStringAttr(node, 'min'),
    max: getStringAttr(node, 'max'),
  };

  // Check for sentinel values first
  const sentinelResponse = tryParseSentinelResponse(node, id, required);
  if (sentinelResponse) {
    return { field, response: sentinelResponse };
  }

  // No sentinel - parse normally
  // Convert empty strings to null explicitly (nullish coalescing doesn't work for empty strings)
  const fenceContent = extractFenceValue(node);
  let dateValue: string | null = null;
  if (fenceContent !== null) {
    const trimmed = fenceContent.trim();
    if (trimmed.length > 0) {
      dateValue = trimmed;
    }
  }
  const value: DateValue = {
    kind: 'date',
    value: dateValue,
  };

  const response = parseFieldResponse(node, value, id, required);
  return { field, response };
}

// =============================================================================
// Year Field Parser
// =============================================================================

/**
 * Parse a year-field tag.
 */
export function parseYearField(node: Node): { field: YearField; response: FieldResponse } {
  const { id, label, required } = parseBaseFieldAttrs(node, 'year');

  const field: YearField = {
    kind: 'year',
    id,
    label,
    required,
    ...getCommonFieldAttrs(node),
    min: getNumberAttr(node, 'min'),
    max: getNumberAttr(node, 'max'),
  };

  // Check for sentinel values first
  const sentinelResponse = tryParseSentinelResponse(node, id, required);
  if (sentinelResponse) {
    return { field, response: sentinelResponse };
  }

  // No sentinel - parse year normally
  const fenceContent = extractFenceValue(node);
  const trimmedContent = fenceContent !== null ? fenceContent.trim() : '';
  let yearValue: number | null = null;
  if (trimmedContent) {
    const parsed = Number.parseInt(trimmedContent, 10);
    if (!Number.isNaN(parsed)) {
      yearValue = parsed;
    }
  }

  const value: YearValue = {
    kind: 'year',
    value: yearValue,
  };

  const response = parseFieldResponse(node, value, id, required);
  return { field, response };
}

// =============================================================================
// Table Field Parser
// =============================================================================

/**
 * Validate column type string.
 */
function isValidColumnType(type: unknown): type is ColumnTypeName {
  return (
    type === 'string' || type === 'number' || type === 'url' || type === 'date' || type === 'year'
  );
}

/**
 * Parse column definitions from attributes.
 * columnIds is required. columnLabels is optional (backfilled from tableHeaderLabels if provided).
 */
function parseColumnsFromAttributes(
  node: Node,
  fieldId: string,
  tableHeaderLabels?: string[],
): TableColumn[] {
  const columnIds = getStringArrayAttr(node, 'columnIds');
  const columnLabels = getStringArrayAttr(node, 'columnLabels');
  const columnTypesRaw = node.attributes?.columnTypes as ColumnTypeSpec[] | undefined;

  if (!columnIds || columnIds.length === 0) {
    throw new MarkformParseError(
      `table-field '${fieldId}' requires 'columnIds' attribute. ` +
        `Example: columnIds=["name", "title", "department"]`,
    );
  }

  // Validate unique column IDs
  const seenIds = new Set<string>();
  for (const id of columnIds) {
    if (seenIds.has(id)) {
      throw new MarkformParseError(`table-field '${fieldId}' has duplicate column ID '${id}'`);
    }
    seenIds.add(id);
  }

  const columns: TableColumn[] = [];
  for (let i = 0; i < columnIds.length; i++) {
    const id = columnIds[i]!;
    // Priority: explicit columnLabels > table header labels > column ID
    const label = columnLabels?.[i] ?? tableHeaderLabels?.[i] ?? id;

    // Parse column type - can be string or { type, required }
    const typeSpec = columnTypesRaw?.[i];
    let type: ColumnTypeName = 'string'; // default
    let required = false;

    if (typeSpec !== undefined) {
      if (typeof typeSpec === 'string') {
        if (!isValidColumnType(typeSpec)) {
          throw new MarkformParseError(
            `table-field '${fieldId}' has invalid column type '${String(typeSpec)}' for column '${id}'. ` +
              `Valid types: string, number, url, date, year`,
          );
        }
        type = typeSpec;
      } else if (typeof typeSpec === 'object' && typeSpec !== null) {
        const typeObj = typeSpec as { type?: unknown; required?: boolean };
        if (!isValidColumnType(typeObj.type)) {
          throw new MarkformParseError(
            `table-field '${fieldId}' has invalid column type '${String(typeObj.type)}' for column '${id}'. ` +
              `Valid types: string, number, url, date, year`,
          );
        }
        type = typeObj.type;
        required = typeObj.required ?? false;
      }
    }

    columns.push({ id, label, type, required });
  }

  return columns;
}

/**
 * Parse a table-field tag.
 *
 * Column definitions come from attributes:
 * - columnIds (required): array of snake_case column identifiers
 * - columnLabels (optional): array of display labels (backfilled from table header row if omitted)
 * - columnTypes (optional): array of column types (defaults to all 'string')
 *
 * Table content is a raw markdown table inside the tag (NOT a value fence).
 */
export function parseTableField(node: Node): { field: TableField; response: FieldResponse } {
  const { id, label, required } = parseBaseFieldAttrs(node, 'table');

  // Check for sentinel values first (entire field can be skipped/aborted)
  const sentinelResponse = tryParseSentinelResponse(node, id, required);

  // Get table content - raw markdown table inside the tag
  const tableContent = extractTableContent(node);

  // Extract header labels from table content for label backfilling
  const tableHeaderLabels = extractTableHeaderLabels(tableContent);

  // Parse columns from attributes (columnIds is required)
  const columns = parseColumnsFromAttributes(node, id, tableHeaderLabels);
  const dataStartLine = 2; // header + separator

  const field: TableField = {
    kind: 'table',
    id,
    label,
    required,
    ...getCommonFieldAttrs(node),
    columns,
    minRows: getNumberAttr(node, 'minRows'),
    maxRows: getNumberAttr(node, 'maxRows'),
  };

  if (sentinelResponse) {
    return { field, response: sentinelResponse };
  }

  if (tableContent === null || tableContent.trim() === '') {
    // Empty table
    const value: TableValue = { kind: 'table', rows: [] };
    const response = parseFieldResponse(node, value, id, required);
    return { field, response };
  }

  // Parse the markdown table with column schema
  // dataStartLine = 2 to skip header + separator rows
  const parseResult = parseMarkdownTable(tableContent, columns, dataStartLine);
  if (!parseResult.ok) {
    throw new MarkformParseError(`table-field '${id}': ${parseResult.error}`);
  }

  const response = parseFieldResponse(node, parseResult.value, id, required);
  return { field, response };
}

// =============================================================================
// Unified Field Parser
// =============================================================================

/**
 * Map legacy tag names to field kinds for error messages.
 */
const LEGACY_TAG_TO_KIND: Record<string, FieldKind> = {
  'string-field': 'string',
  'number-field': 'number',
  'string-list': 'string_list',
  'single-select': 'single_select',
  'multi-select': 'multi_select',
  checkboxes: 'checkboxes',
  'url-field': 'url',
  'url-list': 'url_list',
  'date-field': 'date',
  'year-field': 'year',
  'table-field': 'table',
};

/**
 * Parse a unified field tag: {% field kind="..." ... %}
 */
function parseUnifiedField(node: Node): { field: Field; response: FieldResponse } {
  const kind = getStringAttr(node, 'kind');

  if (!kind) {
    throw new MarkformParseError("field tag missing required 'kind' attribute");
  }

  // Validate kind is a known field kind
  if (!FIELD_KINDS.includes(kind as FieldKind)) {
    throw new MarkformParseError(
      `field tag has invalid kind '${kind}'. Valid kinds: ${FIELD_KINDS.join(', ')}`,
    );
  }

  // Dispatch to specific parsers based on kind
  switch (kind as FieldKind) {
    case 'string':
      return parseStringField(node);
    case 'number':
      return parseNumberField(node);
    case 'string_list':
      return parseStringListField(node);
    case 'single_select':
      return parseSingleSelectField(node);
    case 'multi_select':
      return parseMultiSelectField(node);
    case 'checkboxes':
      return parseCheckboxesField(node);
    case 'url':
      return parseUrlField(node);
    case 'url_list':
      return parseUrlListField(node);
    case 'date':
      return parseDateField(node);
    case 'year':
      return parseYearField(node);
    case 'table':
      return parseTableField(node);
  }
}

// =============================================================================
// Field Dispatcher
// =============================================================================

/**
 * Parse a field tag and return field schema and response.
 * Accepts both unified field syntax {% field kind="..." %} and legacy tags.
 */
export function parseField(node: Node): { field: Field; response: FieldResponse } | null {
  if (!isTagNode(node)) {
    return null;
  }

  // Handle unified field tag
  if (node.tag === 'field') {
    return parseUnifiedField(node);
  }

  // Reject legacy tags with clear error messages
  if (node.tag) {
    const kind = LEGACY_TAG_TO_KIND[node.tag];
    if (kind !== undefined) {
      throw new MarkformParseError(
        `Legacy field tag '${node.tag}' is no longer supported. Use {% field kind="${kind}" %} instead`,
      );
    }
  }

  return null;
}
