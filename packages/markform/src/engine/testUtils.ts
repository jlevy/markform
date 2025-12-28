import type { Node } from '@markdoc/markdoc';

/**
 * Create a mock Markdoc node for testing.
 */
export function createMockNode(
  tag: string,
  attributes: Record<string, any> = {},
  content?: string,
): Node {
  return {
    tag,
    attributes,
    children: content ? [{ type: 'text', attributes: { content } }] : [],
    type: 'tag',
  } as unknown as Node;
}
