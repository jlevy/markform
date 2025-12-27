/**
 * Markdoc parser for .form.md files.
 *
 * Parses Markdoc documents and extracts form schema, values, and documentation blocks.
 */

import Markdoc from '@markdoc/markdoc';
import type { Node } from '@markdoc/markdoc';

import type {
  DocumentationBlock,
  DocumentationTag,
  FieldGroup,
  FieldResponse,
  FormSchema,
  Id,
  IdIndexEntry,
  Note,
  ParsedForm,
} from './coreTypes.js';
import { parseField } from './parseFields.js';
import { getStringAttr, getValidateAttr, isTagNode, ParseError } from './parseHelpers.js';

// Re-export ParseError for backward compatibility
export { ParseError } from './parseHelpers.js';

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
    const lines = (yamlContent ?? '').split('\n');
    const result: Record<string, unknown> = {};

    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0 && !line.startsWith(' ') && !line.startsWith('\t')) {
        const key = line.slice(0, colonIndex).trim();
        const value = line.slice(colonIndex + 1).trim();
        // Handle quoted values
        if (value.startsWith('"') && value.endsWith('"')) {
          result[key] = value.slice(1, -1);
        } else if (value === '') {
          // Nested object marker - for now just mark it
          result[key] = {};
        } else {
          result[key] = value;
        }
      }
    }

    return { frontmatter: result, body };
  } catch (_error) {
    throw new ParseError('Failed to parse frontmatter YAML');
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
  responsesByFieldId: Record<Id, FieldResponse>,
  orderIndex: Id[],
  idIndex: Map<Id, IdIndexEntry>,
  parentId?: Id,
): FieldGroup {
  const id = getStringAttr(node, 'id');
  const title = getStringAttr(node, 'title');

  if (!id) {
    throw new ParseError("field-group missing required 'id' attribute");
  }

  if (idIndex.has(id)) {
    throw new ParseError(`Duplicate ID '${id}'`);
  }

  // Validate that state attribute is not on field-group
  const stateAttr = getStringAttr(node, 'state');
  if (stateAttr !== undefined) {
    throw new ParseError(
      `Field-group '${id}' has state attribute. state attribute is not allowed on field-groups.`,
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
        throw new ParseError(`Duplicate ID '${result.field.id}'`);
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
            throw new ParseError(`Duplicate option ref '${qualifiedRef}'`);
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
  };
}

/**
 * Parse a form tag.
 */
function parseFormTag(
  node: Node,
  responsesByFieldId: Record<Id, FieldResponse>,
  orderIndex: Id[],
  idIndex: Map<Id, IdIndexEntry>,
): FormSchema {
  const id = getStringAttr(node, 'id');
  const title = getStringAttr(node, 'title');

  if (!id) {
    throw new ParseError("form missing required 'id' attribute");
  }

  if (idIndex.has(id)) {
    throw new ParseError(`Duplicate ID '${id}'`);
  }

  idIndex.set(id, { nodeType: 'form' });

  const groups: FieldGroup[] = [];

  // Process children to find field-groups
  function findFieldGroups(child: Node): void {
    if (!child || typeof child !== 'object') {
      return;
    }

    if (isTagNode(child, 'field-group')) {
      const group = parseFieldGroup(child, responsesByFieldId, orderIndex, idIndex, id);
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
        throw new ParseError("note missing required 'id' attribute");
      }
      if (!ref) {
        throw new ParseError(`note '${id}' missing required 'ref' attribute`);
      }
      if (!role) {
        throw new ParseError(`note '${id}' missing required 'role' attribute`);
      }

      // Reject state attribute on notes (markform-254: notes are general-purpose only)
      if (stateAttr !== undefined) {
        throw new ParseError(
          `note '${id}' has 'state' attribute. Notes no longer support state linking; use FieldResponse.reason for skip/abort reasons.`,
        );
      }

      // Validate ref exists in idIndex
      if (!idIndex.has(ref)) {
        throw new ParseError(`note '${id}' references unknown ID '${ref}'`);
      }

      // Validate duplicate note IDs
      if (seenIds.has(id)) {
        throw new ParseError(`Duplicate note ID '${id}'`);
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
        throw new ParseError(`${tag} block missing required 'ref' attribute`);
      }

      // Validate ref exists
      if (!idIndex.has(ref)) {
        throw new ParseError(`${tag} block references unknown ID '${ref}'`);
      }

      const uniqueKey = `${ref}:${tag}`;

      if (seenRefs.has(uniqueKey)) {
        throw new ParseError(`Duplicate ${tag} block for ref='${ref}'`);
      }
      seenRefs.add(uniqueKey);

      // Extract body content - collect all text from children
      let bodyMarkdown = '';
      function extractText(n: Node): void {
        if (n.type === 'text' && typeof n.attributes?.content === 'string') {
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
  const responsesByFieldId: Record<Id, FieldResponse> = {};
  const orderIndex: Id[] = [];
  const idIndex = new Map<Id, IdIndexEntry>();

  function findFormTag(node: Node): void {
    if (!node || typeof node !== 'object') {
      return;
    }

    if (isTagNode(node, 'form')) {
      if (formSchema) {
        throw new ParseError('Multiple form tags found - only one allowed');
      }
      formSchema = parseFormTag(node, responsesByFieldId, orderIndex, idIndex);
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
    throw new ParseError('No form tag found in document');
  }

  // Step 4: Extract notes (needs idIndex to validate refs)
  const notes = extractNotes(ast, idIndex);

  // Step 5: Extract doc blocks (needs idIndex to validate refs)
  const docs = extractDocBlocks(ast, idIndex);

  return {
    schema: formSchema,
    responsesByFieldId,
    notes,
    docs,
    orderIndex,
    idIndex,
  };
}
