/**
 * Markdoc parser for .form.md files.
 *
 * Parses Markdoc documents and extracts form schema, values, and documentation blocks.
 */

import Markdoc from "@markdoc/markdoc";
import type { Node } from "@markdoc/markdoc";

import { AGENT_ROLE, DEFAULT_PRIORITY } from "../settings.js";
import type {
  ApprovalMode,
  CheckboxesField,
  CheckboxesValue,
  CheckboxMode,
  CheckboxValue,
  DocumentationBlock,
  DocumentationTag,
  Field,
  FieldGroup,
  FieldValue,
  FormSchema,
  Id,
  IdIndexEntry,
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
  UrlField,
  UrlListField,
  UrlListValue,
  UrlValue,
  ValidatorRef,
} from "./coreTypes.js";

// =============================================================================
// Error Types
// =============================================================================

/** Parse error with source location info */
export class ParseError extends Error {
  constructor(
    message: string,
    public readonly line?: number,
    public readonly col?: number
  ) {
    super(message);
    this.name = "ParseError";
  }
}

// =============================================================================
// Frontmatter Parsing
// =============================================================================

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

interface FrontmatterResult {
  frontmatter: Record<string, unknown>;
  body: string;
}

/**
 * Extract YAML frontmatter from markdown content.
 */
function extractFrontmatter(content: string): FrontmatterResult {
  const match = FRONTMATTER_REGEX.exec(content);
  if (!match) {
    return { frontmatter: {}, body: content };
  }

  const yamlContent = match[1];
  const body = content.slice(match[0].length);

  // Parse YAML using a simple approach (yaml package will be used later)
  // For now, just extract the raw YAML and we'll parse it properly with the yaml package
  try {
    // Simple parse - we'll use yaml package for proper parsing
    const lines = (yamlContent ?? "").split("\n");
    const result: Record<string, unknown> = {};

    for (const line of lines) {
      const colonIndex = line.indexOf(":");
      if (colonIndex > 0 && !line.startsWith(" ") && !line.startsWith("\t")) {
        const key = line.slice(0, colonIndex).trim();
        const value = line.slice(colonIndex + 1).trim();
        // Handle quoted values
        if (value.startsWith('"') && value.endsWith('"')) {
          result[key] = value.slice(1, -1);
        } else if (value === "") {
          // Nested object marker - for now just mark it
          result[key] = {};
        } else {
          result[key] = value;
        }
      }
    }

    return { frontmatter: result, body };
  } catch (_error) {
    throw new ParseError("Failed to parse frontmatter YAML");
  }
}

// =============================================================================
// Checkbox Marker Parsing
// =============================================================================

/** Map checkbox marker to state value */
const CHECKBOX_MARKERS: Record<string, CheckboxValue> = {
  "[ ]": "todo",
  "[x]": "done",
  "[X]": "done",
  "[/]": "incomplete",
  "[*]": "active",
  "[-]": "na",
  "[y]": "yes",
  "[Y]": "yes",
  "[n]": "no",
  "[N]": "no",
};

// Regex to extract checkbox marker and label from text content
// Text is like "[ ] Label" or "[x] Label"
const OPTION_TEXT_PATTERN = /^(\[[^\]]\])\s*(.*?)\s*$/;

interface ParsedMarkerText {
  marker: string;
  label: string;
}

/**
 * Parse option text to extract marker and label.
 * Text is like "[ ] Label" or "[x] Label".
 */
function parseOptionText(text: string): ParsedMarkerText | null {
  const match = OPTION_TEXT_PATTERN.exec(text);
  if (!match) {
    return null;
  }

  const marker = match[1] ?? "";
  const label = (match[2] ?? "").trim();

  return { marker, label };
}

// =============================================================================
// Markdoc Tag Processing
// =============================================================================

/**
 * Check if a node is a tag node with specific name.
 * Works with raw AST nodes (not transformed Tags).
 */
function isTagNode(node: Node, name?: string): boolean {
  if (typeof node !== "object" || node === null) {
    return false;
  }
  if (node.type === "tag" && node.tag) {
    return name === undefined || node.tag === name;
  }
  return false;
}


/**
 * Get string attribute value or undefined.
 */
function getStringAttr(node: Node, name: string): string | undefined {
  const value: unknown = node.attributes?.[name];
  return typeof value === "string" ? value : undefined;
}

/**
 * Get number attribute value or undefined.
 */
function getNumberAttr(node: Node, name: string): number | undefined {
  const value: unknown = node.attributes?.[name];
  return typeof value === "number" ? value : undefined;
}

/**
 * Get boolean attribute value or undefined.
 */
function getBooleanAttr(node: Node, name: string): boolean | undefined {
  const value: unknown = node.attributes?.[name];
  return typeof value === "boolean" ? value : undefined;
}

/**
 * Get validator references from validate attribute.
 * Handles both single string and array formats.
 */
function getValidateAttr(node: Node): ValidatorRef[] | undefined {
  const value: unknown = node.attributes?.validate;
  if (value === undefined || value === null) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value as ValidatorRef[];
  }
  if (typeof value === "string") {
    return [value];
  }
  if (typeof value === "object") {
    // Single object validator ref like { id: "foo", param: 1 }
    return [value as ValidatorRef];
  }
  return undefined;
}

/**
 * Parsed option item from AST.
 */
interface ParsedOptionItem {
  /** ID from {% #id %} annotation */
  id: string | null;
  /** Text content (e.g., "[ ] Label" or "[x] Label") */
  text: string;
}

/**
 * Extract option items from node children (for option lists).
 * Works with raw AST nodes. Collects text and ID from list items.
 */
function extractOptionItems(node: Node): ParsedOptionItem[] {
  const items: ParsedOptionItem[] = [];

  /**
   * Collect all text content from a node tree into a single string.
   */
  function collectText(n: Node): string {
    let text = "";

    // Text nodes have content in attributes
    if (n.type === "text" && typeof n.attributes?.content === "string") {
      text += n.attributes.content;
    }

    // Softbreak is a newline
    if (n.type === "softbreak") {
      text += "\n";
    }

    // Recurse into children
    if (n.children && Array.isArray(n.children)) {
      for (const c of n.children) {
        text += collectText(c);
      }
    }

    return text;
  }

  /**
   * Traverse to find list items and extract their content.
   */
  function traverse(child: Node): void {
    if (!child || typeof child !== "object") {
      return;
    }

    // List items contain the option text and ID
    if (child.type === "item") {
      const text = collectText(child);
      // Markdoc parses {% #id %} as an id attribute on the item
      const id = typeof child.attributes?.id === "string" ? child.attributes.id : null;
      if (text.trim()) {
        items.push({ id, text: text.trim() });
      }
      return; // Don't recurse further into item children
    }

    // Recurse into children
    if (child.children && Array.isArray(child.children)) {
      for (const c of child.children) {
        traverse(c);
      }
    }
  }

  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      traverse(child);
    }
  }

  return items;
}

/**
 * Extract fence value from node children.
 * Looks for ```value code blocks.
 */
function extractFenceValue(node: Node): string | null {
  function traverse(child: Node): string | null {
    if (!child || typeof child !== "object") {
      return null;
    }

    // Check if this is a fence node with language="value"
    if (child.type === "fence") {
      const lang = child.attributes?.language as string | undefined;
      if (lang === "value") {
        return typeof child.attributes?.content === "string"
          ? child.attributes.content
          : null;
      }
    }

    // Traverse children
    if (child.children && Array.isArray(child.children)) {
      for (const c of child.children) {
        const result = traverse(c);
        if (result !== null) {
          return result;
        }
      }
    }

    return null;
  }

  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      const result = traverse(child);
      if (result !== null) {
        return result;
      }
    }
  }

  return null;
}

// =============================================================================
// Field Parsing
// =============================================================================

/**
 * Get priority attribute value or default to DEFAULT_PRIORITY.
 */
function getPriorityAttr(node: Node): "high" | "medium" | "low" {
  const value = getStringAttr(node, "priority");
  if (value === "high" || value === "medium" || value === "low") {
    return value;
  }
  return DEFAULT_PRIORITY;
}

/**
 * Parse a string-field tag.
 */
function parseStringField(node: Node): { field: StringField; value: StringValue } {
  const id = getStringAttr(node, "id");
  const label = getStringAttr(node, "label");

  if (!id) {
    throw new ParseError("string-field missing required 'id' attribute");
  }
  if (!label) {
    throw new ParseError(`string-field '${id}' missing required 'label' attribute`);
  }

  const field: StringField = {
    kind: "string",
    id,
    label,
    required: getBooleanAttr(node, "required") ?? false,
    priority: getPriorityAttr(node),
    role: getStringAttr(node, "role") ?? AGENT_ROLE,
    multiline: getBooleanAttr(node, "multiline"),
    pattern: getStringAttr(node, "pattern"),
    minLength: getNumberAttr(node, "minLength"),
    maxLength: getNumberAttr(node, "maxLength"),
    validate: getValidateAttr(node),
  };

  const fenceContent = extractFenceValue(node);
  const value: StringValue = {
    kind: "string",
    value: fenceContent !== null ? fenceContent.trim() : null,
  };

  return { field, value };
}

/**
 * Parse a number-field tag.
 */
function parseNumberField(node: Node): { field: NumberField; value: NumberValue } {
  const id = getStringAttr(node, "id");
  const label = getStringAttr(node, "label");

  if (!id) {
    throw new ParseError("number-field missing required 'id' attribute");
  }
  if (!label) {
    throw new ParseError(`number-field '${id}' missing required 'label' attribute`);
  }

  const field: NumberField = {
    kind: "number",
    id,
    label,
    required: getBooleanAttr(node, "required") ?? false,
    priority: getPriorityAttr(node),
    role: getStringAttr(node, "role") ?? AGENT_ROLE,
    min: getNumberAttr(node, "min"),
    max: getNumberAttr(node, "max"),
    integer: getBooleanAttr(node, "integer"),
    validate: getValidateAttr(node),
  };

  const fenceContent = extractFenceValue(node);
  let numValue: number | null = null;

  if (fenceContent !== null) {
    const trimmed = fenceContent.trim();
    if (trimmed) {
      const parsed = Number(trimmed);
      if (!Number.isNaN(parsed)) {
        numValue = parsed;
      }
    }
  }

  const value: NumberValue = {
    kind: "number",
    value: numValue,
  };

  return { field, value };
}

/**
 * Parse a string-list tag.
 */
function parseStringListField(node: Node): { field: StringListField; value: StringListValue } {
  const id = getStringAttr(node, "id");
  const label = getStringAttr(node, "label");

  if (!id) {
    throw new ParseError("string-list missing required 'id' attribute");
  }
  if (!label) {
    throw new ParseError(`string-list '${id}' missing required 'label' attribute`);
  }

  const field: StringListField = {
    kind: "string_list",
    id,
    label,
    required: getBooleanAttr(node, "required") ?? false,
    priority: getPriorityAttr(node),
    role: getStringAttr(node, "role") ?? AGENT_ROLE,
    minItems: getNumberAttr(node, "minItems"),
    maxItems: getNumberAttr(node, "maxItems"),
    itemMinLength: getNumberAttr(node, "itemMinLength"),
    itemMaxLength: getNumberAttr(node, "itemMaxLength"),
    uniqueItems: getBooleanAttr(node, "uniqueItems"),
    validate: getValidateAttr(node),
  };

  const fenceContent = extractFenceValue(node);
  const items: string[] = [];

  if (fenceContent !== null) {
    const lines = fenceContent.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) {
        items.push(trimmed);
      }
    }
  }

  const value: StringListValue = {
    kind: "string_list",
    items,
  };

  return { field, value };
}

/**
 * Parse options from a select/checkbox field.
 */
function parseOptions(
  node: Node,
  fieldId: string
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
        `Option in field '${fieldId}' missing ID annotation. Use {% #option_id %}`
      );
    }

    if (seenIds.has(item.id)) {
      throw new ParseError(
        `Duplicate option ID '${item.id}' in field '${fieldId}'`
      );
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

/**
 * Parse a single-select tag.
 */
function parseSingleSelectField(node: Node): { field: SingleSelectField; value: SingleSelectValue } {
  const id = getStringAttr(node, "id");
  const label = getStringAttr(node, "label");

  if (!id) {
    throw new ParseError("single-select missing required 'id' attribute");
  }
  if (!label) {
    throw new ParseError(`single-select '${id}' missing required 'label' attribute`);
  }

  const { options, selected } = parseOptions(node, id);

  const field: SingleSelectField = {
    kind: "single_select",
    id,
    label,
    required: getBooleanAttr(node, "required") ?? false,
    priority: getPriorityAttr(node),
    role: getStringAttr(node, "role") ?? AGENT_ROLE,
    options,
    validate: getValidateAttr(node),
  };

  // Find the selected option (exactly one with done/[x] state)
  let selectedOption: string | null = null;
  for (const [optId, state] of Object.entries(selected)) {
    if (state === "done") {
      selectedOption = optId;
      break;
    }
  }

  const value: SingleSelectValue = {
    kind: "single_select",
    selected: selectedOption,
  };

  return { field, value };
}

/**
 * Parse a multi-select tag.
 */
function parseMultiSelectField(node: Node): { field: MultiSelectField; value: MultiSelectValue } {
  const id = getStringAttr(node, "id");
  const label = getStringAttr(node, "label");

  if (!id) {
    throw new ParseError("multi-select missing required 'id' attribute");
  }
  if (!label) {
    throw new ParseError(`multi-select '${id}' missing required 'label' attribute`);
  }

  const { options, selected } = parseOptions(node, id);

  const field: MultiSelectField = {
    kind: "multi_select",
    id,
    label,
    required: getBooleanAttr(node, "required") ?? false,
    priority: getPriorityAttr(node),
    role: getStringAttr(node, "role") ?? AGENT_ROLE,
    options,
    minSelections: getNumberAttr(node, "minSelections"),
    maxSelections: getNumberAttr(node, "maxSelections"),
    validate: getValidateAttr(node),
  };

  // Collect all selected options (those with done/[x] state)
  const selectedOptions: string[] = [];
  for (const [optId, state] of Object.entries(selected)) {
    if (state === "done") {
      selectedOptions.push(optId);
    }
  }

  const value: MultiSelectValue = {
    kind: "multi_select",
    selected: selectedOptions,
  };

  return { field, value };
}

/**
 * Parse a checkboxes tag.
 */
function parseCheckboxesField(node: Node): { field: CheckboxesField; value: CheckboxesValue } {
  const id = getStringAttr(node, "id");
  const label = getStringAttr(node, "label");

  if (!id) {
    throw new ParseError("checkboxes missing required 'id' attribute");
  }
  if (!label) {
    throw new ParseError(`checkboxes '${id}' missing required 'label' attribute`);
  }

  const { options, selected } = parseOptions(node, id);

  const checkboxModeStr = getStringAttr(node, "checkboxMode");
  let checkboxMode: CheckboxMode = "multi"; // default
  if (checkboxModeStr === "multi" || checkboxModeStr === "simple" || checkboxModeStr === "explicit") {
    checkboxMode = checkboxModeStr;
  }

  const approvalModeStr = getStringAttr(node, "approvalMode");
  let approvalMode: ApprovalMode = "none"; // default
  if (approvalModeStr === "blocking") {
    approvalMode = "blocking";
  }

  // Handle required attribute based on checkboxMode:
  // - explicit mode is inherently required (cannot be set to false)
  // - multi/simple modes default to optional (false)
  const explicitRequired = getBooleanAttr(node, "required");
  let required: boolean;
  if (checkboxMode === "explicit") {
    if (explicitRequired === false) {
      throw new ParseError(
        `Checkbox field "${label}" has checkboxMode="explicit" which is inherently required. ` +
          `Cannot set required=false. Remove required attribute or change checkboxMode.`
      );
    }
    required = true; // explicit mode is always required
  } else {
    required = explicitRequired ?? false; // multi/simple default to optional
  }

  const field: CheckboxesField = {
    kind: "checkboxes",
    id,
    label,
    required,
    priority: getPriorityAttr(node),
    role: getStringAttr(node, "role") ?? AGENT_ROLE,
    checkboxMode,
    minDone: getNumberAttr(node, "minDone"),
    options,
    approvalMode,
    validate: getValidateAttr(node),
  };

  // Initialize all options to their default state based on mode
  const values: Record<string, CheckboxValue> = {};

  for (const opt of options) {
    const state = selected[opt.id];
    if (state === undefined || state === "todo") {
      // For explicit mode, "todo" (from [ ]) means "unfilled"
      values[opt.id] = checkboxMode === "explicit" ? "unfilled" : "todo";
    } else {
      values[opt.id] = state;
    }
  }

  const value: CheckboxesValue = {
    kind: "checkboxes",
    values,
  };

  return { field, value };
}

/**
 * Parse a url-field tag.
 */
function parseUrlField(node: Node): { field: UrlField; value: UrlValue } {
  const id = getStringAttr(node, "id");
  const label = getStringAttr(node, "label");

  if (!id) {
    throw new ParseError("url-field missing required 'id' attribute");
  }
  if (!label) {
    throw new ParseError(`url-field '${id}' missing required 'label' attribute`);
  }

  const field: UrlField = {
    kind: "url",
    id,
    label,
    required: getBooleanAttr(node, "required") ?? false,
    priority: getPriorityAttr(node),
    role: getStringAttr(node, "role") ?? AGENT_ROLE,
    validate: getValidateAttr(node),
  };

  const fenceContent = extractFenceValue(node);
  const value: UrlValue = {
    kind: "url",
    value: fenceContent !== null ? fenceContent.trim() : null,
  };

  return { field, value };
}

/**
 * Parse a url-list tag.
 */
function parseUrlListField(node: Node): { field: UrlListField; value: UrlListValue } {
  const id = getStringAttr(node, "id");
  const label = getStringAttr(node, "label");

  if (!id) {
    throw new ParseError("url-list missing required 'id' attribute");
  }
  if (!label) {
    throw new ParseError(`url-list '${id}' missing required 'label' attribute`);
  }

  const field: UrlListField = {
    kind: "url_list",
    id,
    label,
    required: getBooleanAttr(node, "required") ?? false,
    priority: getPriorityAttr(node),
    role: getStringAttr(node, "role") ?? AGENT_ROLE,
    minItems: getNumberAttr(node, "minItems"),
    maxItems: getNumberAttr(node, "maxItems"),
    uniqueItems: getBooleanAttr(node, "uniqueItems"),
    validate: getValidateAttr(node),
  };

  const fenceContent = extractFenceValue(node);
  const items: string[] = [];

  if (fenceContent !== null) {
    const lines = fenceContent.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) {
        items.push(trimmed);
      }
    }
  }

  const value: UrlListValue = {
    kind: "url_list",
    items,
  };

  return { field, value };
}

/**
 * Parse a field tag and return field schema and value.
 */
function parseField(node: Node): { field: Field; value: FieldValue } | null {
  if (!isTagNode(node)) {
    return null;
  }
  switch (node.tag) {
    case "string-field":
      return parseStringField(node);
    case "number-field":
      return parseNumberField(node);
    case "string-list":
      return parseStringListField(node);
    case "single-select":
      return parseSingleSelectField(node);
    case "multi-select":
      return parseMultiSelectField(node);
    case "checkboxes":
      return parseCheckboxesField(node);
    case "url-field":
      return parseUrlField(node);
    case "url-list":
      return parseUrlListField(node);
    default:
      return null;
  }
}

// =============================================================================
// Group and Form Parsing
// =============================================================================

/**
 * Parse a field-group tag.
 */
function parseFieldGroup(
  node: Node,
  valuesByFieldId: Record<Id, FieldValue>,
  orderIndex: Id[],
  idIndex: Map<Id, IdIndexEntry>,
  parentId?: Id
): FieldGroup {
  const id = getStringAttr(node, "id");
  const title = getStringAttr(node, "title");

  if (!id) {
    throw new ParseError("field-group missing required 'id' attribute");
  }

  if (idIndex.has(id)) {
    throw new ParseError(`Duplicate ID '${id}'`);
  }

  idIndex.set(id, { kind: "group", parentId });

  const children: Field[] = [];

  // Traverse children to find fields
  function processChildren(child: Node): void {
    if (!child || typeof child !== "object") {
      return;
    }

    const result = parseField(child);
    if (result) {
      if (idIndex.has(result.field.id)) {
        throw new ParseError(`Duplicate ID '${result.field.id}'`);
      }

      idIndex.set(result.field.id, { kind: "field", parentId: id });
      children.push(result.field);
      valuesByFieldId[result.field.id] = result.value;
      orderIndex.push(result.field.id);

      // Add options to idIndex for select/checkbox fields
      if ("options" in result.field) {
        for (const opt of result.field.options) {
          const qualifiedRef = `${result.field.id}.${opt.id}`;
          if (idIndex.has(qualifiedRef)) {
            throw new ParseError(`Duplicate option ref '${qualifiedRef}'`);
          }
          idIndex.set(qualifiedRef, {
            kind: "option",
            parentId: id,
            fieldId: result.field.id,
          });
        }
      }
    }

    if (child.children && Array.isArray(child.children)) {
      for (const c of child.children) {
        processChildren(c);
      }
    }
  }

  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      processChildren(child);
    }
  }

  return {
    kind: "field_group",
    id,
    title,
    validate: getValidateAttr(node),
    children,
  };
}

/**
 * Parse a form tag.
 */
function parseFormTag(
  node: Node,
  valuesByFieldId: Record<Id, FieldValue>,
  orderIndex: Id[],
  idIndex: Map<Id, IdIndexEntry>
): FormSchema {
  const id = getStringAttr(node, "id");
  const title = getStringAttr(node, "title");

  if (!id) {
    throw new ParseError("form missing required 'id' attribute");
  }

  if (idIndex.has(id)) {
    throw new ParseError(`Duplicate ID '${id}'`);
  }

  idIndex.set(id, { kind: "form" });

  const groups: FieldGroup[] = [];

  // Process children to find field-groups
  function findFieldGroups(child: Node): void {
    if (!child || typeof child !== "object") {
      return;
    }

    if (isTagNode(child, "field-group")) {
      const group = parseFieldGroup(
        child,
        valuesByFieldId,
        orderIndex,
        idIndex,
        id
      );
      groups.push(group);
      return;
    }

    if (child.children && Array.isArray(child.children)) {
      for (const c of child.children) {
        findFieldGroups(c);
      }
    }
  }

  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      findFieldGroups(child);
    }
  }

  return { id, title, groups };
}

// =============================================================================
// Documentation Block Parsing
// =============================================================================

/** Valid documentation tag names */
const DOC_TAG_NAMES = ["description", "instructions", "documentation"] as const;

/**
 * Extract all documentation blocks from AST.
 * Looks for {% description %}, {% instructions %}, and {% documentation %} tags.
 */
function extractDocBlocks(ast: Node, idIndex: Map<Id, IdIndexEntry>): DocumentationBlock[] {
  const docs: DocumentationBlock[] = [];
  const seenRefs = new Set<string>();

  function traverse(node: Node): void {
    if (!node || typeof node !== "object") {
      return;
    }

    // Check for description, instructions, or documentation tags
    const nodeTag = node.type === "tag" && node.tag ? node.tag : null;
    if (nodeTag && (DOC_TAG_NAMES as readonly string[]).includes(nodeTag)) {
      const tag = nodeTag as DocumentationTag;
      const ref = getStringAttr(node, "ref");

      if (!ref) {
        throw new ParseError(`${tag} block missing required 'ref' attribute`);
      }

      // Validate ref exists
      if (!idIndex.has(ref)) {
        throw new ParseError(`${tag} block references unknown ID '${ref}'`);
      }

      const uniqueKey = `${ref}:${tag}`;

      if (seenRefs.has(uniqueKey)) {
        throw new ParseError(
          `Duplicate ${tag} block for ref='${ref}'`
        );
      }
      seenRefs.add(uniqueKey);

      // Extract body content - collect all text from children
      let bodyMarkdown = "";
      function extractText(n: Node): void {
        if (n.type === "text" && typeof n.attributes?.content === "string") {
          bodyMarkdown += n.attributes.content;
        }
        if (n.children && Array.isArray(n.children)) {
          for (const c of n.children) {
            extractText(c);
          }
        }
      }
      if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
          extractText(child);
        }
      }

      docs.push({
        tag,
        ref,
        bodyMarkdown: bodyMarkdown.trim(),
      });
    }

    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  traverse(ast);
  return docs;
}

// =============================================================================
// Main Parser
// =============================================================================

/**
 * Parse a Markform .form.md document.
 *
 * @param markdown - The full markdown content including frontmatter
 * @returns The parsed form representation
 * @throws ParseError if the document is invalid
 */
export function parseForm(markdown: string): ParsedForm {
  // Step 1: Extract frontmatter
  const { body } = extractFrontmatter(markdown);

  // Step 2: Parse Markdoc AST (raw AST, not transformed)
  const ast = Markdoc.parse(body);

  // Step 3: Find the form tag in the raw AST
  let formSchema: FormSchema | null = null;
  const valuesByFieldId: Record<Id, FieldValue> = {};
  const orderIndex: Id[] = [];
  const idIndex = new Map<Id, IdIndexEntry>();

  function findFormTag(node: Node): void {
    if (!node || typeof node !== "object") {
      return;
    }

    if (isTagNode(node, "form")) {
      if (formSchema) {
        throw new ParseError("Multiple form tags found - only one allowed");
      }
      formSchema = parseFormTag(node, valuesByFieldId, orderIndex, idIndex);
      return;
    }

    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        findFormTag(child);
      }
    }
  }

  findFormTag(ast);

  if (!formSchema) {
    throw new ParseError("No form tag found in document");
  }

  // Step 4: Extract doc blocks (needs idIndex to validate refs)
  const docs = extractDocBlocks(ast, idIndex);

  return {
    schema: formSchema,
    valuesByFieldId,
    skipsByFieldId: {}, // Initially empty; skip_field patches populate this
    docs,
    orderIndex,
    idIndex,
  };
}
