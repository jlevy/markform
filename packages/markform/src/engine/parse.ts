/**
 * Markdoc parser for .form.md files.
 *
 * Parses Markdoc documents and extracts form schema, values, and documentation blocks.
 */

import Markdoc from '@markdoc/markdoc';
import type { Node } from '@markdoc/markdoc';
import YAML from 'yaml';

import type {
  CheckboxesField,
  CheckboxesValue,
  DocumentationBlock,
  DocumentationTag,
  FieldGroup,
  FieldResponse,
  FormMetadata,
  FormSchema,
  Id,
  IdIndexEntry,
  Note,
  ParsedForm,
  SyntaxStyle,
  TagRegion,
  TagType,
} from './coreTypes.js';
import { MarkformSectionInputSchema } from './coreTypes.js';
import type { ZodError } from 'zod';
import {
  AGENT_ROLE,
  DEFAULT_PRIORITY,
  DEFAULT_ROLES,
  DEFAULT_ROLE_INSTRUCTIONS,
  transformHarnessConfigToTs,
} from '../settings.js';
import { parseField } from './parseFields.js';
import {
  getBooleanAttr,
  getNumberAttr,
  getStringAttr,
  getValidateAttr,
  isTagNode,
} from './parseHelpers.js';
import { MarkformParseError } from '../errors.js';
import { detectSyntaxStyle, preprocessCommentSyntax } from './preprocess.js';
import { findAllCheckboxes } from './injectIds.js';

// Re-export ParseError for backward compatibility
export { ParseError } from '../errors.js';

/**
 * Valid tag names inside a form.
 * Any other tag will produce a ParseError.
 */
const VALID_FORM_TAGS = new Set([
  'group',
  'field',
  'note',
  'description',
  'instructions',
  'documentation',
]);

// =============================================================================
// Frontmatter Parsing
// =============================================================================

interface FrontmatterResult {
  frontmatter: Record<string, unknown>;
  metadata?: FormMetadata;
  /** Description from markform.description in frontmatter */
  description?: string;
}

/**
 * Format Zod validation errors for user-friendly display.
 */
function formatZodError(error: ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.map(String).join('.');
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join('; ');
}

/**
 * Extract YAML frontmatter from Markdoc AST.
 * Uses Markdoc's native frontmatter extraction and parses the YAML.
 * Validates the markform section using Zod schema.
 */
function extractFrontmatter(ast: Node): FrontmatterResult {
  const rawFrontmatter = ast.attributes.frontmatter as string | undefined;
  if (!rawFrontmatter) {
    return { frontmatter: {} };
  }

  try {
    const parsed = YAML.parse(rawFrontmatter) as Record<string, unknown> | null;
    const frontmatter = parsed ?? {};

    // Extract metadata from markform section
    const rawMarkformSection = frontmatter.markform;
    if (!rawMarkformSection) {
      return { frontmatter };
    }

    // Validate markform section with Zod schema
    const validationResult = MarkformSectionInputSchema.safeParse(rawMarkformSection);
    if (!validationResult.success) {
      throw new MarkformParseError(
        `Invalid markform frontmatter: ${formatZodError(validationResult.error)}`,
      );
    }
    const markformSection = validationResult.data;

    // Transform harness config from snake_case to camelCase
    const harnessConfig =
      markformSection.harness && Object.keys(markformSection.harness).length > 0
        ? transformHarnessConfigToTs(markformSection.harness)
        : undefined;

    // Build metadata
    // Note: roles and role_instructions can be either inside markform: or at top-level
    // Prefer markform section, fall back to top-level for backwards compatibility
    const metadata: FormMetadata = {
      markformVersion: markformSection.spec ?? 'MF/0.1',
      ...(markformSection.title && { title: markformSection.title }),
      ...(markformSection.description && { description: markformSection.description }),
      roles: markformSection.roles ??
        (frontmatter.roles as string[] | undefined) ?? [...DEFAULT_ROLES],
      roleInstructions:
        markformSection.role_instructions ??
        (frontmatter.role_instructions as Record<string, string> | undefined) ??
        DEFAULT_ROLE_INSTRUCTIONS,
      ...(harnessConfig && { harnessConfig }),
      ...(markformSection.run_mode && { runMode: markformSection.run_mode }),
    };

    return { frontmatter, metadata, description: markformSection.description };
  } catch (error) {
    // Re-throw ParseError as-is, wrap other errors
    if (error instanceof MarkformParseError) {
      throw error;
    }
    throw new MarkformParseError('Failed to parse frontmatter YAML');
  }
}

/**
 * Extract the raw source content minus frontmatter.
 * This is the content that will be used for splice-based serialization.
 */
function extractRawSource(preprocessed: string): string {
  // YAML frontmatter is delimited by --- at start and end
  const frontmatterRegex = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;
  const frontmatterMatch = frontmatterRegex.exec(preprocessed);
  if (frontmatterMatch) {
    return preprocessed.slice(frontmatterMatch[0].length);
  }
  return preprocessed;
}

/**
 * Build a line-to-offset mapping for converting Markdoc line numbers to byte offsets.
 * Returns an array where lineOffsets[lineNumber] = byte offset of line start.
 * Line numbers are 0-indexed (Markdoc uses 0-indexed lines).
 */
function buildLineOffsets(source: string): number[] {
  const offsets: number[] = [0]; // Line 0 starts at offset 0
  for (let i = 0; i < source.length; i++) {
    if (source[i] === '\n') {
      offsets.push(i + 1); // Next line starts after the newline
    }
  }
  return offsets;
}

/**
 * Extract tag region from a Markdoc AST node.
 * Uses the node's location property (line numbers) and converts to byte offsets.
 */
function extractTagRegion(
  node: Node,
  tagType: TagType,
  tagId: Id,
  lineOffsets: number[],
  frontmatterLineCount: number,
  sourceLength: number,
  hasValue?: boolean,
): TagRegion | null {
  // Markdoc nodes have location with start/end line numbers (0-indexed)
  const location = node.location;
  if (!location?.start || !location?.end) {
    return null;
  }

  // Adjust line numbers for frontmatter removal
  // rawSource starts after frontmatter, so we need to adjust the line numbers
  const startLine = location.start.line - frontmatterLineCount;
  const endLine = location.end.line - frontmatterLineCount;

  // Skip if the tag is in the frontmatter area (shouldn't happen, but be safe)
  if (startLine < 0 || endLine < 0) {
    return null;
  }

  // Convert line numbers to byte offsets
  // Markdoc's end line is the line containing the closing tag
  // We need to find the end of that line
  const startOffset = lineOffsets[startLine] ?? 0;
  let endOffset: number;

  // For end offset, we want the end of the end line (start of next line or end of source)
  if (endLine + 1 < lineOffsets.length) {
    endOffset = lineOffsets[endLine + 1] ?? sourceLength;
  } else {
    endOffset = sourceLength;
  }

  // Sanity check: make sure offsets are valid
  if (startOffset >= endOffset || startOffset < 0 || endOffset > sourceLength) {
    return null;
  }

  return {
    tagId,
    tagType,
    startOffset,
    endOffset,
    ...(hasValue !== undefined && { includesValue: hasValue }),
  };
}

/**
 * Collect all tag regions from the AST for content preservation.
 * Traverses the AST and extracts positions of all Markform tags.
 */
function collectTagRegions(
  ast: Node,
  rawSource: string,
  frontmatterLineCount: number,
  responsesByFieldId: Record<Id, FieldResponse>,
): TagRegion[] {
  const regions: TagRegion[] = [];
  const lineOffsets = buildLineOffsets(rawSource);
  const sourceLength = rawSource.length;

  function traverse(node: Node): void {
    if (!node || typeof node !== 'object') {
      return;
    }

    // Check for form tag
    if (isTagNode(node, 'form')) {
      const id = getStringAttr(node, 'id');
      if (id) {
        const region = extractTagRegion(
          node,
          'form',
          id,
          lineOffsets,
          frontmatterLineCount,
          sourceLength,
        );
        if (region) regions.push(region);
      }
    }

    // Check for group tag
    if (isTagNode(node, 'group')) {
      const id = getStringAttr(node, 'id');
      if (id) {
        const region = extractTagRegion(
          node,
          'group',
          id,
          lineOffsets,
          frontmatterLineCount,
          sourceLength,
        );
        if (region) regions.push(region);
      }
    }

    // Check for field tag
    if (isTagNode(node, 'field')) {
      const id = getStringAttr(node, 'id');
      if (id) {
        // Check if field has a value by looking at responsesByFieldId
        const hasValue = responsesByFieldId[id]?.value !== undefined;
        const region = extractTagRegion(
          node,
          'field',
          id,
          lineOffsets,
          frontmatterLineCount,
          sourceLength,
          hasValue,
        );
        if (region) regions.push(region);
      }
    }

    // Check for note tag
    if (isTagNode(node, 'note')) {
      const id = getStringAttr(node, 'id');
      if (id) {
        const region = extractTagRegion(
          node,
          'note',
          id,
          lineOffsets,
          frontmatterLineCount,
          sourceLength,
        );
        if (region) regions.push(region);
      }
    }

    // Check for documentation tags (instructions, description, etc.)
    const DOC_TAGS = ['instructions', 'description', 'documentation'];
    if (node.type === 'tag' && node.tag && DOC_TAGS.includes(node.tag)) {
      const ref = getStringAttr(node, 'ref');
      // Use ref as the ID for doc blocks, or generate one
      const docId = ref ?? `doc_${regions.length}`;
      const region = extractTagRegion(
        node,
        'documentation',
        docId,
        lineOffsets,
        frontmatterLineCount,
        sourceLength,
      );
      if (region) regions.push(region);
    }

    // Recurse into children
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  traverse(ast);

  // Sort by startOffset to ensure document order
  regions.sort((a, b) => a.startOffset - b.startOffset);

  return regions;
}

// =============================================================================
// Group and Form Parsing
// =============================================================================

/**
 * Parse a group tag.
 */
function parseFieldGroup(
  node: Node,
  responsesByFieldId: Record<Id, FieldResponse>,
  orderIndex: Id[],
  idIndex: Map<Id, IdIndexEntry>,
  parentId?: Id,
): FieldGroup {
  const id = getStringAttr(node, 'id');
  const title = getStringAttr(node, 'title');

  if (!id) {
    throw new MarkformParseError("group missing required 'id' attribute");
  }

  if (idIndex.has(id)) {
    throw new MarkformParseError(`Duplicate ID '${id}'`);
  }

  // Validate that state attribute is not on group
  const stateAttr = getStringAttr(node, 'state');
  if (stateAttr !== undefined) {
    throw new MarkformParseError(
      `Field-group '${id}' has state attribute. state attribute is not allowed on groups.`,
    );
  }

  idIndex.set(id, { nodeType: 'group', parentId });

  const children: FieldGroup['children'] = [];

  // Traverse children to find fields
  function processChildren(child: Node): void {
    if (!child || typeof child !== 'object') {
      return;
    }

    const result = parseField(child);
    if (result) {
      if (idIndex.has(result.field.id)) {
        throw new MarkformParseError(`Duplicate ID '${result.field.id}'`);
      }

      idIndex.set(result.field.id, { nodeType: 'field', parentId: id });
      children.push(result.field);
      responsesByFieldId[result.field.id] = result.response;
      orderIndex.push(result.field.id);

      // Add options to idIndex for select/checkbox fields
      if ('options' in result.field) {
        for (const opt of result.field.options) {
          const qualifiedRef = `${result.field.id}.${opt.id}`;
          if (idIndex.has(qualifiedRef)) {
            throw new MarkformParseError(`Duplicate option ref '${qualifiedRef}'`);
          }
          idIndex.set(qualifiedRef, {
            nodeType: 'option',
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

  const parallel = getStringAttr(node, 'parallel');
  const order = getNumberAttr(node, 'order');

  // Validate: fields inside a group must not have `parallel`
  // Validate: fields inside a group must not explicitly specify a different `order`
  const groupEffectiveOrder = order ?? 0;
  for (const child of children) {
    if (child.parallel) {
      throw new MarkformParseError(
        `Field '${child.id}' has parallel='${child.parallel}' but is inside ` +
          `group '${id}'. The parallel attribute is only allowed on ` +
          `top-level fields and groups.`,
      );
    }
    // Only error if the child *explicitly* sets order to a different value.
    // Unset order on a child is fine — it inherits the group's order.
    if (child.order !== undefined) {
      const childEffectiveOrder = child.order;
      if (childEffectiveOrder !== groupEffectiveOrder) {
        throw new MarkformParseError(
          `Field '${child.id}' has order=${child.order} but is inside ` +
            `group '${id}' with order=${groupEffectiveOrder}. ` +
            `A field inside a group must not specify a different order.`,
        );
      }
    }
  }

  return {
    id,
    title,
    validate: getValidateAttr(node),
    children,
    report: getBooleanAttr(node, 'report'),
    parallel,
    order,
  };
}

/**
 * Parse a form tag.
 * Handles both explicit groups and fields placed directly under the form.
 * Also handles implicit checkboxes when form has no explicit fields.
 */
function parseFormTag(
  node: Node,
  responsesByFieldId: Record<Id, FieldResponse>,
  orderIndex: Id[],
  idIndex: Map<Id, IdIndexEntry>,
  markdown: string,
): FormSchema {
  const id = getStringAttr(node, 'id');
  const title = getStringAttr(node, 'title');

  if (!id) {
    throw new MarkformParseError("form missing required 'id' attribute");
  }

  if (idIndex.has(id)) {
    throw new MarkformParseError(`Duplicate ID '${id}'`);
  }

  idIndex.set(id, { nodeType: 'form' });

  const groups: FieldGroup[] = [];
  const ungroupedFields: FieldGroup['children'] = [];

  // Process children to find groups and ungrouped fields
  function processContent(child: Node): void {
    if (!child || typeof child !== 'object') {
      return;
    }

    // Check for unknown tags inside form
    if (isTagNode(child) && !VALID_FORM_TAGS.has((child as { tag: string }).tag)) {
      throw new MarkformParseError(`Unknown tag '${(child as { tag: string }).tag}' inside form`);
    }

    if (isTagNode(child, 'group')) {
      const group = parseFieldGroup(child, responsesByFieldId, orderIndex, idIndex, id);
      groups.push(group);
      return; // parseFieldGroup already processed the children
    }

    // Check for field tags directly under the form (not in a group)
    const result = parseField(child);
    if (result) {
      if (idIndex.has(result.field.id)) {
        throw new MarkformParseError(`Duplicate ID '${result.field.id}'`);
      }

      idIndex.set(result.field.id, { nodeType: 'field', parentId: id });
      ungroupedFields.push(result.field);
      responsesByFieldId[result.field.id] = result.response;
      orderIndex.push(result.field.id);

      // Add options to idIndex for select/checkbox fields
      if ('options' in result.field) {
        for (const opt of result.field.options) {
          const qualifiedRef = `${result.field.id}.${opt.id}`;
          if (idIndex.has(qualifiedRef)) {
            throw new MarkformParseError(`Duplicate option ref '${qualifiedRef}'`);
          }
          idIndex.set(qualifiedRef, {
            nodeType: 'option',
            parentId: id,
            fieldId: result.field.id,
          });
        }
      }
      return; // Don't recurse into field children
    }

    // Recurse into children for non-group, non-field nodes
    if (child.children && Array.isArray(child.children)) {
      for (const c of child.children) {
        processContent(c);
      }
    }
  }

  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      processContent(child);
    }
  }

  // If there are ungrouped fields, create an implicit group to hold them
  // The 'default' ID is a special name for implicit groups, but can also be used explicitly
  if (ungroupedFields.length > 0) {
    const implicitGroupId = 'default';
    // Check if 'default' was already used explicitly - if so, merge fields into it
    const existingDefault = groups.find((g) => g.id === implicitGroupId);
    if (existingDefault) {
      // Merge ungrouped fields into the existing explicit 'default' group
      existingDefault.children = [...(existingDefault.children ?? []), ...ungroupedFields];
    } else {
      idIndex.set(implicitGroupId, { nodeType: 'group', parentId: id });
      groups.push({
        id: implicitGroupId,
        children: ungroupedFields,
        implicit: true,
      });
    }
  }

  // Count all explicit fields
  const hasExplicitFields =
    ungroupedFields.length > 0 || groups.some((g) => g.children && g.children.length > 0);

  // Check if there are explicit fields that use checkbox syntax
  // (checkboxes, single_select, multi_select all use checkbox-like list items)
  const hasExplicitCheckboxStyleFields = groups.some((g) =>
    g.children?.some(
      (f) => f.kind === 'checkboxes' || f.kind === 'single_select' || f.kind === 'multi_select',
    ),
  );

  // Find all checkboxes in the markdown
  const allCheckboxes = findAllCheckboxes(markdown);

  if (allCheckboxes.length > 0) {
    if (hasExplicitFields) {
      // If there are explicit fields that use checkbox syntax, checkboxes are inside them
      // But if there are only non-checkbox-style fields, the checkboxes are orphans
      if (!hasExplicitCheckboxStyleFields) {
        throw new MarkformParseError(
          'Checkboxes found outside of field tags. Either wrap all checkboxes in ' +
            'fields or remove all explicit fields for implicit checkboxes mode.',
        );
      }
      // If there are explicit checkboxes fields, the checkboxes are inside them (OK)
    } else {
      // No explicit fields - create implicit checkboxes field
      const seenIds = new Set<string>();
      const options: { id: string; label: string }[] = [];
      const values: CheckboxesValue['values'] = {};

      for (const checkbox of allCheckboxes) {
        if (!checkbox.id) {
          throw new MarkformParseError(
            `Option in implicit field 'checkboxes' missing ID annotation. Use {% #option_id %}`,
            { line: checkbox.line },
          );
        }

        if (seenIds.has(checkbox.id)) {
          throw new MarkformParseError(
            `Duplicate option ID '${checkbox.id}' in field 'checkboxes'`,
            { line: checkbox.line },
          );
        }

        seenIds.add(checkbox.id);
        options.push({
          id: checkbox.id,
          label: checkbox.label,
        });
        values[checkbox.id] = checkbox.state;
      }

      // Create implicit checkboxes field
      // The 'checkboxes' ID is a special name for implicit checkboxes, but can also be used explicitly
      const implicitField: CheckboxesField = {
        kind: 'checkboxes',
        id: 'checkboxes',
        label: 'Checkboxes',
        checkboxMode: 'multi',
        implicit: true,
        options,
        required: false,
        priority: DEFAULT_PRIORITY,
        role: AGENT_ROLE,
        approvalMode: 'none',
      };

      // Add to idIndex
      idIndex.set('checkboxes', { nodeType: 'field', parentId: id });
      orderIndex.push('checkboxes');

      // Add options to idIndex
      for (const opt of options) {
        const qualifiedRef = `checkboxes.${opt.id}`;
        idIndex.set(qualifiedRef, {
          nodeType: 'option',
          parentId: id,
          fieldId: 'checkboxes',
        });
      }

      // Create response for the implicit field
      const checkboxesValue: CheckboxesValue = {
        kind: 'checkboxes',
        values,
      };
      responsesByFieldId.checkboxes = {
        state: 'answered',
        value: checkboxesValue,
      };

      // Create or get default group for implicit field
      let defaultGroup = groups.find((g) => g.id === 'default');
      if (!defaultGroup) {
        defaultGroup = {
          id: 'default',
          children: [],
          implicit: true,
        };
        idIndex.set('default', { nodeType: 'group', parentId: id });
        groups.push(defaultGroup);
      }
      defaultGroup.children = defaultGroup.children || [];
      defaultGroup.children.push(implicitField);
    }
  }

  // Validate parallel batch consistency: same order and same role within each batch.
  // Collect all top-level items that have parallel set.
  // For explicit groups, the group itself is the item.
  // For implicit groups, each child field is a top-level item.
  validateParallelBatches(groups);

  return { id, title, groups };
}

/**
 * Validate that parallel batches have consistent order and role values.
 */
function validateParallelBatches(groups: FieldGroup[]): void {
  // Collect batch membership: batchId → array of { order, role, itemId }
  const batches = new Map<string, { order: number; role: string; itemId: string }[]>();

  for (const group of groups) {
    if (group.implicit) {
      // Implicit group: each child field is a top-level item
      for (const field of group.children) {
        if (field.parallel) {
          const list = batches.get(field.parallel) ?? [];
          list.push({
            order: field.order ?? 0,
            role: field.role,
            itemId: field.id,
          });
          batches.set(field.parallel, list);
        }
      }
    } else {
      // Explicit group: the group is the item
      if (group.parallel) {
        // For a group's role, use the role of the first child (they should all match
        // since fields inside a group share the group's execution context).
        // If the group has no children, use AGENT_ROLE as default.
        const groupRole = group.children[0]?.role ?? AGENT_ROLE;
        const list = batches.get(group.parallel) ?? [];
        list.push({
          order: group.order ?? 0,
          role: groupRole,
          itemId: group.id,
        });
        batches.set(group.parallel, list);
      }
    }
  }

  // Validate each batch
  for (const [batchId, items] of batches) {
    if (items.length < 2) continue;

    const firstOrder = items[0]!.order;
    const firstRole = items[0]!.role;

    const differentOrders = items.filter((i) => i.order !== firstOrder);
    if (differentOrders.length > 0) {
      const orderValues = [...new Set(items.map((i) => i.order))].join(', ');
      throw new MarkformParseError(
        `Parallel batch '${batchId}' has items with different order values (${orderValues}). ` +
          `All items in a parallel batch must have the same order.`,
      );
    }

    const differentRoles = items.filter((i) => i.role !== firstRole);
    if (differentRoles.length > 0) {
      const roles = [...new Set(items.map((i) => i.role))].join(', ');
      throw new MarkformParseError(
        `Parallel batch '${batchId}' has items with different roles (${roles}). ` +
          `All items in a parallel batch must have the same role.`,
      );
    }
  }
}

// =============================================================================
// Note Parsing
// =============================================================================

/**
 * Extract all notes from AST.
 * Looks for {% note %} tags with id, ref, role, and optional state.
 */
function extractNotes(ast: Node, idIndex: Map<Id, IdIndexEntry>): Note[] {
  const notes: Note[] = [];
  const seenIds = new Set<string>();

  function traverse(node: Node): void {
    if (!node || typeof node !== 'object') {
      return;
    }

    // Check for note tags
    if (isTagNode(node, 'note')) {
      const id = getStringAttr(node, 'id');
      const ref = getStringAttr(node, 'ref');
      const role = getStringAttr(node, 'role');
      const stateAttr = getStringAttr(node, 'state');

      // Validate required attributes
      if (!id) {
        throw new MarkformParseError("note missing required 'id' attribute");
      }
      if (!ref) {
        throw new MarkformParseError(`note '${id}' missing required 'ref' attribute`);
      }
      if (!role) {
        throw new MarkformParseError(`note '${id}' missing required 'role' attribute`);
      }

      // Reject state attribute on notes (markform-254: notes are general-purpose only)
      if (stateAttr !== undefined) {
        throw new MarkformParseError(
          `note '${id}' has 'state' attribute. Notes no longer support state linking; use FieldResponse.reason for skip/abort reasons.`,
        );
      }

      // Validate ref exists in idIndex
      if (!idIndex.has(ref)) {
        throw new MarkformParseError(`note '${id}' references unknown ID '${ref}'`);
      }

      // Validate duplicate note IDs
      if (seenIds.has(id)) {
        throw new MarkformParseError(`Duplicate note ID '${id}'`);
      }
      seenIds.add(id);

      // Extract text content
      let text = '';
      function extractText(n: Node): void {
        if (n.type === 'text' && typeof n.attributes?.content === 'string') {
          text += n.attributes.content;
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

      notes.push({
        id,
        ref,
        role,
        text: text.trim(),
      });
    }

    // Recurse into children
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  traverse(ast);
  return notes;
}

// =============================================================================
// Documentation Block Parsing
// =============================================================================

/** Valid documentation tag names */
const DOC_TAG_NAMES = ['description', 'instructions', 'documentation'] as const;

/**
 * Extract all documentation blocks from AST.
 * Looks for {% description %}, {% instructions %}, and {% documentation %} tags.
 */
function extractDocBlocks(ast: Node, idIndex: Map<Id, IdIndexEntry>): DocumentationBlock[] {
  const docs: DocumentationBlock[] = [];
  const seenRefs = new Set<string>();

  function traverse(node: Node): void {
    if (!node || typeof node !== 'object') {
      return;
    }

    // Check for description, instructions, or documentation tags
    const nodeTag = node.type === 'tag' && node.tag ? node.tag : null;
    if (nodeTag && (DOC_TAG_NAMES as readonly string[]).includes(nodeTag)) {
      const tag = nodeTag as DocumentationTag;
      const ref = getStringAttr(node, 'ref');

      if (!ref) {
        throw new MarkformParseError(`${tag} block missing required 'ref' attribute`);
      }

      // Validate ref exists
      if (!idIndex.has(ref)) {
        throw new MarkformParseError(`${tag} block references unknown ID '${ref}'`);
      }

      const uniqueKey = `${ref}:${tag}`;

      if (seenRefs.has(uniqueKey)) {
        throw new MarkformParseError(`Duplicate ${tag} block for ref='${ref}'`);
      }
      seenRefs.add(uniqueKey);

      // Extract body content - collect all text from children
      let bodyMarkdown = '';
      function extractText(n: Node): void {
        if (n.type === 'text' && typeof n.attributes?.content === 'string') {
          bodyMarkdown += n.attributes.content;
        } else if (n.type === 'softbreak' || n.type === 'hardbreak') {
          // Preserve line breaks from markdown - softbreak is a single newline,
          // hardbreak is an explicit break (e.g., two spaces at end of line)
          bodyMarkdown += '\n';
        }
        if (n.children && Array.isArray(n.children)) {
          for (const c of n.children) {
            extractText(c);
          }
        }
      }
      if (node.children && Array.isArray(node.children)) {
        for (let ci = 0; ci < node.children.length; ci++) {
          const child = node.children[ci]!;
          // Add paragraph breaks between block-level children (e.g., paragraphs)
          if (ci > 0 && child.type === 'paragraph') {
            bodyMarkdown += '\n\n';
          }
          extractText(child);
        }
      }

      docs.push({
        tag,
        ref,
        bodyMarkdown: bodyMarkdown.trim(),
        report: getBooleanAttr(node, 'report'),
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
 * Supports both Markdoc syntax (`{% tag %}`) and HTML comment syntax (`<!-- f:tag -->`).
 * The original syntax style is detected and preserved for round-trip serialization.
 *
 * @param markdown - The full markdown content including frontmatter
 * @returns The parsed form representation
 * @throws ParseError if the document is invalid
 */
export function parseForm(markdown: string): ParsedForm {
  // Step 0: Detect syntax style and preprocess HTML comment syntax to Markdoc
  const syntaxStyle: SyntaxStyle = detectSyntaxStyle(markdown);
  const preprocessed = preprocessCommentSyntax(markdown);

  // Step 0.5: Extract raw source (content minus frontmatter) for content preservation
  const rawSource = extractRawSource(preprocessed);
  // Calculate the number of lines in frontmatter for line number adjustment
  const frontmatter = preprocessed.slice(0, preprocessed.length - rawSource.length);
  const frontmatterLineCount = (frontmatter.match(/\n/g) ?? []).length;

  // Step 1: Parse Markdoc AST (raw AST, not transformed)
  // Markdoc natively handles frontmatter extraction and stores it in ast.attributes.frontmatter
  const ast = Markdoc.parse(preprocessed);

  // Step 2: Extract frontmatter and metadata from AST
  const { metadata, description } = extractFrontmatter(ast);

  // Step 3: Find the form tag in the raw AST
  let formSchema: FormSchema | null = null;
  const responsesByFieldId: Record<Id, FieldResponse> = {};
  const orderIndex: Id[] = [];
  const idIndex = new Map<Id, IdIndexEntry>();

  function findFormTag(node: Node): void {
    if (!node || typeof node !== 'object') {
      return;
    }

    if (isTagNode(node, 'form')) {
      if (formSchema) {
        throw new MarkformParseError('Multiple form tags found - only one allowed');
      }
      formSchema = parseFormTag(node, responsesByFieldId, orderIndex, idIndex, preprocessed);
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
    throw new MarkformParseError('No form tag found in document');
  }

  // Build final schema with description from frontmatter
  // Type assertion needed because TypeScript doesn't track closure assignments well
  const parsedSchema = formSchema as FormSchema;
  const schema: FormSchema = {
    ...parsedSchema,
    ...(description && { description }),
  };

  // Step 4: Extract notes (needs idIndex to validate refs)
  const notes = extractNotes(ast, idIndex);

  // Step 5: Extract doc blocks (needs idIndex to validate refs)
  const docs = extractDocBlocks(ast, idIndex);

  // Step 6: Collect tag regions for content preservation
  const tagRegions = collectTagRegions(ast, rawSource, frontmatterLineCount, responsesByFieldId);

  return {
    schema,
    responsesByFieldId,
    notes,
    docs,
    orderIndex,
    idIndex,
    ...(metadata && { metadata }),
    syntaxStyle,
    rawSource,
    tagRegions,
  };
}
