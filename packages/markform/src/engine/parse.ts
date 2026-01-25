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
  FrontmatterHarnessConfig,
  Id,
  IdIndexEntry,
  Note,
  ParsedForm,
  RunMode,
  SyntaxStyle,
} from './coreTypes.js';
import { RunModeSchema } from './coreTypes.js';
import {
  AGENT_ROLE,
  DEFAULT_PRIORITY,
  DEFAULT_ROLES,
  DEFAULT_ROLE_INSTRUCTIONS,
} from '../settings.js';
import { parseField } from './parseFields.js';
import { getBooleanAttr, getStringAttr, getValidateAttr, isTagNode } from './parseHelpers.js';
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
 * Parse harness configuration from frontmatter.
 * Converts snake_case keys to camelCase.
 */
function parseHarnessConfig(raw: unknown): FrontmatterHarnessConfig | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }

  const config = raw as Record<string, unknown>;
  const result: FrontmatterHarnessConfig = {};

  // Map snake_case to camelCase
  const keyMap: Record<string, keyof FrontmatterHarnessConfig> = {
    max_turns: 'maxTurns',
    maxTurns: 'maxTurns',
    max_patches_per_turn: 'maxPatchesPerTurn',
    maxPatchesPerTurn: 'maxPatchesPerTurn',
    max_issues_per_turn: 'maxIssuesPerTurn',
    maxIssuesPerTurn: 'maxIssuesPerTurn',
  };

  for (const [key, value] of Object.entries(config)) {
    const camelKey = keyMap[key];
    if (camelKey && typeof value === 'number') {
      result[camelKey] = value;
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Extract YAML frontmatter from Markdoc AST.
 * Uses Markdoc's native frontmatter extraction and parses the YAML.
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
    const markformSection = frontmatter.markform as Record<string, unknown> | undefined;
    if (!markformSection) {
      return { frontmatter };
    }

    // Parse harness config from markform.harness
    const harnessConfig = parseHarnessConfig(markformSection.harness);

    // Parse run_mode from markform.run_mode
    let runMode: RunMode | undefined;
    const rawRunMode = markformSection.run_mode;
    if (rawRunMode !== undefined) {
      const parsed = RunModeSchema.safeParse(rawRunMode);
      if (!parsed.success) {
        throw new MarkformParseError(
          `Invalid run_mode: '${typeof rawRunMode === 'string' ? rawRunMode : JSON.stringify(rawRunMode)}'. Must be one of: interactive, fill, research`,
        );
      }
      runMode = parsed.data;
    }

    // Extract description from markform.description
    const description =
      typeof markformSection.description === 'string' ? markformSection.description : undefined;

    // Build metadata
    const metadata: FormMetadata = {
      markformVersion: (markformSection.spec as string) ?? 'MF/0.1',
      roles: (frontmatter.roles as string[]) ?? [...DEFAULT_ROLES],
      roleInstructions:
        (frontmatter.role_instructions as Record<string, string>) ?? DEFAULT_ROLE_INSTRUCTIONS,
      ...(harnessConfig && { harnessConfig }),
      ...(runMode && { runMode }),
    };

    return { frontmatter, metadata, description };
  } catch (error) {
    // Re-throw ParseError as-is, wrap other errors
    if (error instanceof MarkformParseError) {
      throw error;
    }
    throw new MarkformParseError('Failed to parse frontmatter YAML');
  }
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

  return {
    id,
    title,
    validate: getValidateAttr(node),
    children,
    report: getBooleanAttr(node, 'report'),
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

  return { id, title, groups };
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
        for (const child of node.children) {
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

  return {
    schema,
    responsesByFieldId,
    notes,
    docs,
    orderIndex,
    idIndex,
    ...(metadata && { metadata }),
    syntaxStyle,
  };
}
