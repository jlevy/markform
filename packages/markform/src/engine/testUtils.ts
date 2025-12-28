import type { Node } from '@markdoc/markdoc';

/**
 * Create a mock Markdoc node for testing.
 */

export function createMockNode(
  tag: string,
  attributes: Record<string, any> = {},
  content?: string,
): Node {
  // Create a minimal mock node for testing
  return {
    tag,
    attributes,
    children: content ? [{ type: 'text', attributes: { content } } as any] : [],
    type: 'tag',
  } as any;
  return {
    tag,
    attributes,
    children: content ? [{ type: 'text', attributes: { content } }] : [],
    type: 'tag',
  } as unknown as Node;
}
