/**
 * Field type parsers for Markform.
 *
 * This module contains the parsing logic for each field type:
 * string, number, string-list, single-select, multi-select, checkboxes,
 * url, url-list, date, and year.
 */

import type { Node } from '@markdoc/markdoc';

import { AGENT_ROLE, DEFAULT_PRIORITY } from '../settings.js';
import type {
  ApprovalMode,
  CheckboxesField,
  CheckboxesValue,
  CheckboxMode,
  CheckboxValue,
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
  UrlField,
  UrlListField,
  UrlListValue,
  UrlValue,
  YearField,
  YearValue,
} from './coreTypes.js';
import {
  CHECKBOX_MARKERS,
  extractFenceValue,
  extractOptionItems,
  getBooleanAttr,
  getNumberAttr,
  getStringAttr,
  getValidateAttr,
  isTagNode,
  ParseError,
  parseOptionText,
} from './parseHelpers.js';
import { tryParseSentinelResponse } from './parseSentinels.js';

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
      throw new ParseError(
        `Invalid state attribute '${stateAttr}' on field '${fieldId}'. Must be empty, answered, skipped, or aborted`,
      );
    }

    // Validate state vs filled consistency
    if (stateAttr === 'skipped' || stateAttr === 'aborted') {
      if (isFilled) {
        throw new ParseError(
          `Field '${fieldId}' has state='${stateAttr}' but contains a value. ${stateAttr} fields cannot have values.`,
        );
      }
    }

    // Validate skipped on required fields
    if (stateAttr === 'skipped' && required) {
      throw new ParseError(
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
        throw new ParseError(`Field '${fieldId}' has state='answered' but has no value`);
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
// String Field Parser
// =============================================================================

/**
 * Parse a string-field tag.
 */
export function parseStringField(node: Node): { field: StringField; response: FieldResponse } {
  const id = getStringAttr(node, 'id');
  const label = getStringAttr(node, 'label');

  if (!id) {
    throw new ParseError("string-field missing required 'id' attribute");
  }
  if (!label) {
    throw new ParseError(`string-field '${id}' missing required 'label' attribute`);
  }

  const required = getBooleanAttr(node, 'required') ?? false;

  const field: StringField = {
    kind: 'string',
    id,
    label,
    required,
    priority: getPriorityAttr(node),
    role: getStringAttr(node, 'role') ?? AGENT_ROLE,
    multiline: getBooleanAttr(node, 'multiline'),
    pattern: getStringAttr(node, 'pattern'),
    minLength: getNumberAttr(node, 'minLength'),
    maxLength: getNumberAttr(node, 'maxLength'),
    validate: getValidateAttr(node),
    report: getBooleanAttr(node, 'report'),
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
  const id = getStringAttr(node, 'id');
  const label = getStringAttr(node, 'label');

  if (!id) {
    throw new ParseError("number-field missing required 'id' attribute");
  }
  if (!label) {
    throw new ParseError(`number-field '${id}' missing required 'label' attribute`);
  }

  const required = getBooleanAttr(node, 'required') ?? false;

  const field: NumberField = {
    kind: 'number',
    id,
    label,
    required,
    priority: getPriorityAttr(node),
    role: getStringAttr(node, 'role') ?? AGENT_ROLE,
    min: getNumberAttr(node, 'min'),
    max: getNumberAttr(node, 'max'),
    integer: getBooleanAttr(node, 'integer'),
    validate: getValidateAttr(node),
    report: getBooleanAttr(node, 'report'),
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
  const id = getStringAttr(node, 'id');
  const label = getStringAttr(node, 'label');

  if (!id) {
    throw new ParseError("string-list missing required 'id' attribute");
  }
  if (!label) {
    throw new ParseError(`string-list '${id}' missing required 'label' attribute`);
  }

  const required = getBooleanAttr(node, 'required') ?? false;

  const field: StringListField = {
    kind: 'string_list',
    id,
    label,
    required,
    priority: getPriorityAttr(node),
    role: getStringAttr(node, 'role') ?? AGENT_ROLE,
    minItems: getNumberAttr(node, 'minItems'),
    maxItems: getNumberAttr(node, 'maxItems'),
    itemMinLength: getNumberAttr(node, 'itemMinLength'),
    itemMaxLength: getNumberAttr(node, 'itemMaxLength'),
    uniqueItems: getBooleanAttr(node, 'uniqueItems'),
    validate: getValidateAttr(node),
    report: getBooleanAttr(node, 'report'),
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
      throw new ParseError(
        `Option in field '${fieldId}' missing ID annotation. Use {% #option_id %}`,
      );
    }

    if (seenIds.has(item.id)) {
      throw new ParseError(`Duplicate option ID '${item.id}' in field '${fieldId}'`);
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
  const id = getStringAttr(node, 'id');
  const label = getStringAttr(node, 'label');

  if (!id) {
    throw new ParseError("single-select missing required 'id' attribute");
  }
  if (!label) {
    throw new ParseError(`single-select '${id}' missing required 'label' attribute`);
  }

  const required = getBooleanAttr(node, 'required') ?? false;
  const { options, selected } = parseOptions(node, id);

  const field: SingleSelectField = {
    kind: 'single_select',
    id,
    label,
    required,
    priority: getPriorityAttr(node),
    role: getStringAttr(node, 'role') ?? AGENT_ROLE,
    options,
    validate: getValidateAttr(node),
    report: getBooleanAttr(node, 'report'),
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
  const id = getStringAttr(node, 'id');
  const label = getStringAttr(node, 'label');

  if (!id) {
    throw new ParseError("multi-select missing required 'id' attribute");
  }
  if (!label) {
    throw new ParseError(`multi-select '${id}' missing required 'label' attribute`);
  }

  const required = getBooleanAttr(node, 'required') ?? false;
  const { options, selected } = parseOptions(node, id);

  const field: MultiSelectField = {
    kind: 'multi_select',
    id,
    label,
    required,
    priority: getPriorityAttr(node),
    role: getStringAttr(node, 'role') ?? AGENT_ROLE,
    options,
    minSelections: getNumberAttr(node, 'minSelections'),
    maxSelections: getNumberAttr(node, 'maxSelections'),
    validate: getValidateAttr(node),
    report: getBooleanAttr(node, 'report'),
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
  const id = getStringAttr(node, 'id');
  const label = getStringAttr(node, 'label');

  if (!id) {
    throw new ParseError("checkboxes missing required 'id' attribute");
  }
  if (!label) {
    throw new ParseError(`checkboxes '${id}' missing required 'label' attribute`);
  }

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
      throw new ParseError(
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
    priority: getPriorityAttr(node),
    role: getStringAttr(node, 'role') ?? AGENT_ROLE,
    checkboxMode,
    minDone: getNumberAttr(node, 'minDone'),
    options,
    approvalMode,
    validate: getValidateAttr(node),
    report: getBooleanAttr(node, 'report'),
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
  const id = getStringAttr(node, 'id');
  const label = getStringAttr(node, 'label');

  if (!id) {
    throw new ParseError("url-field missing required 'id' attribute");
  }
  if (!label) {
    throw new ParseError(`url-field '${id}' missing required 'label' attribute`);
  }

  const required = getBooleanAttr(node, 'required') ?? false;

  const field: UrlField = {
    kind: 'url',
    id,
    label,
    required,
    priority: getPriorityAttr(node),
    role: getStringAttr(node, 'role') ?? AGENT_ROLE,
    validate: getValidateAttr(node),
    report: getBooleanAttr(node, 'report'),
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
  const id = getStringAttr(node, 'id');
  const label = getStringAttr(node, 'label');

  if (!id) {
    throw new ParseError("url-list missing required 'id' attribute");
  }
  if (!label) {
    throw new ParseError(`url-list '${id}' missing required 'label' attribute`);
  }

  const required = getBooleanAttr(node, 'required') ?? false;

  const field: UrlListField = {
    kind: 'url_list',
    id,
    label,
    required,
    priority: getPriorityAttr(node),
    role: getStringAttr(node, 'role') ?? AGENT_ROLE,
    minItems: getNumberAttr(node, 'minItems'),
    maxItems: getNumberAttr(node, 'maxItems'),
    uniqueItems: getBooleanAttr(node, 'uniqueItems'),
    validate: getValidateAttr(node),
    report: getBooleanAttr(node, 'report'),
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
  const id = getStringAttr(node, 'id');
  const label = getStringAttr(node, 'label');

  if (!id) {
    throw new ParseError("date-field missing required 'id' attribute");
  }
  if (!label) {
    throw new ParseError(`date-field '${id}' missing required 'label' attribute`);
  }

  const required = getBooleanAttr(node, 'required') ?? false;

  const field: DateField = {
    kind: 'date',
    id,
    label,
    required,
    priority: getPriorityAttr(node),
    role: getStringAttr(node, 'role') ?? AGENT_ROLE,
    min: getStringAttr(node, 'min'),
    max: getStringAttr(node, 'max'),
    validate: getValidateAttr(node),
    report: getBooleanAttr(node, 'report'),
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
  const id = getStringAttr(node, 'id');
  const label = getStringAttr(node, 'label');

  if (!id) {
    throw new ParseError("year-field missing required 'id' attribute");
  }
  if (!label) {
    throw new ParseError(`year-field '${id}' missing required 'label' attribute`);
  }

  const required = getBooleanAttr(node, 'required') ?? false;

  const field: YearField = {
    kind: 'year',
    id,
    label,
    required,
    priority: getPriorityAttr(node),
    role: getStringAttr(node, 'role') ?? AGENT_ROLE,
    min: getNumberAttr(node, 'min'),
    max: getNumberAttr(node, 'max'),
    validate: getValidateAttr(node),
    report: getBooleanAttr(node, 'report'),
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
// Field Dispatcher
// =============================================================================

/**
 * Parse a field tag and return field schema and response.
 */
export function parseField(node: Node): { field: Field; response: FieldResponse } | null {
  if (!isTagNode(node)) {
    return null;
  }
  switch (node.tag) {
    case 'string-field':
      return parseStringField(node);
    case 'number-field':
      return parseNumberField(node);
    case 'string-list':
      return parseStringListField(node);
    case 'single-select':
      return parseSingleSelectField(node);
    case 'multi-select':
      return parseMultiSelectField(node);
    case 'checkboxes':
      return parseCheckboxesField(node);
    case 'url-field':
      return parseUrlField(node);
    case 'url-list':
      return parseUrlListField(node);
    case 'date-field':
      return parseDateField(node);
    case 'year-field':
      return parseYearField(node);
    default:
      return null;
  }
}
