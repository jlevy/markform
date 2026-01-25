import { describe, expect, it } from 'vitest';

import { findAllCheckboxes } from '../../../src/engine/injectIds.js';

describe('engine/injectIds', () => {
  describe('findAllCheckboxes', () => {
    it('finds no checkboxes in empty document', () => {
      const checkboxes = findAllCheckboxes('');
      expect(checkboxes).toHaveLength(0);
    });

    it('finds no checkboxes in document without checkboxes', () => {
      const markdown = `# Title

Some text here.

- Regular list item
- Another item
`;
      const checkboxes = findAllCheckboxes(markdown);
      expect(checkboxes).toHaveLength(0);
    });

    it('finds a single unchecked checkbox', () => {
      const markdown = `# Tasks

- [ ] First task
`;
      const checkboxes = findAllCheckboxes(markdown);
      expect(checkboxes).toHaveLength(1);
      expect(checkboxes[0]).toMatchObject({
        label: 'First task',
        state: 'todo',
        line: 3,
      });
    });

    it('finds a checked checkbox', () => {
      const markdown = `- [x] Completed task
`;
      const checkboxes = findAllCheckboxes(markdown);
      expect(checkboxes).toHaveLength(1);
      expect(checkboxes[0]).toMatchObject({
        label: 'Completed task',
        state: 'done',
      });
    });

    it('finds all multi-mode checkbox states', () => {
      const markdown = `- [ ] Todo item
- [x] Done item
- [/] Incomplete item
- [*] Active item
- [-] Not applicable
`;
      const checkboxes = findAllCheckboxes(markdown);
      expect(checkboxes).toHaveLength(5);
      expect(checkboxes[0]?.state).toBe('todo');
      expect(checkboxes[1]?.state).toBe('done');
      expect(checkboxes[2]?.state).toBe('incomplete');
      expect(checkboxes[3]?.state).toBe('active');
      expect(checkboxes[4]?.state).toBe('na');
    });

    it('extracts ID from Markdoc annotation', () => {
      const markdown = `- [ ] Task one {% #task_one %}
- [ ] Task two {% #task_two %}
`;
      const checkboxes = findAllCheckboxes(markdown);
      expect(checkboxes).toHaveLength(2);
      expect(checkboxes[0]).toMatchObject({
        id: 'task_one',
        label: 'Task one',
      });
      expect(checkboxes[1]).toMatchObject({
        id: 'task_two',
        label: 'Task two',
      });
    });

    it('extracts ID from HTML comment annotation', () => {
      const markdown = `- [ ] Task one <!-- #task_one -->
- [ ] Task two <!-- #task_two -->
`;
      const checkboxes = findAllCheckboxes(markdown);
      expect(checkboxes).toHaveLength(2);
      expect(checkboxes[0]?.id).toBe('task_one');
      expect(checkboxes[1]?.id).toBe('task_two');
    });

    it('finds checkboxes without IDs', () => {
      const markdown = `- [ ] Task without ID
- [ ] Another task {% #has_id %}
`;
      const checkboxes = findAllCheckboxes(markdown);
      expect(checkboxes).toHaveLength(2);
      expect(checkboxes[0]?.id).toBeUndefined();
      expect(checkboxes[1]?.id).toBe('has_id');
    });

    it('includes enclosing headings (innermost first)', () => {
      const markdown = `# Project

## Phase 1

- [ ] Research

### Details

- [ ] Deep task
`;
      const checkboxes = findAllCheckboxes(markdown);
      expect(checkboxes).toHaveLength(2);

      // First checkbox is under "Phase 1" and "Project"
      expect(checkboxes[0]?.enclosingHeadings).toHaveLength(2);
      expect(checkboxes[0]?.enclosingHeadings[0]?.title).toBe('Phase 1');
      expect(checkboxes[0]?.enclosingHeadings[1]?.title).toBe('Project');

      // Second checkbox is under "Details", "Phase 1", and "Project"
      expect(checkboxes[1]?.enclosingHeadings).toHaveLength(3);
      expect(checkboxes[1]?.enclosingHeadings[0]?.title).toBe('Details');
      expect(checkboxes[1]?.enclosingHeadings[1]?.title).toBe('Phase 1');
      expect(checkboxes[1]?.enclosingHeadings[2]?.title).toBe('Project');
    });

    it('ignores checkboxes in code blocks', () => {
      const markdown = `# Tasks

- [ ] Real task

\`\`\`markdown
- [ ] This is in a code block
\`\`\`

- [ ] Another real task
`;
      const checkboxes = findAllCheckboxes(markdown);
      expect(checkboxes).toHaveLength(2);
      expect(checkboxes[0]?.label).toBe('Real task');
      expect(checkboxes[1]?.label).toBe('Another real task');
    });

    it('handles nested checkboxes (indented)', () => {
      const markdown = `- [ ] Parent task
  - [ ] Child task
  - [x] Another child
`;
      const checkboxes = findAllCheckboxes(markdown);
      expect(checkboxes).toHaveLength(3);
    });

    it('returns checkboxes in document order', () => {
      const markdown = `## Section 1
- [ ] First
- [ ] Second

## Section 2
- [ ] Third
`;
      const checkboxes = findAllCheckboxes(markdown);
      expect(checkboxes).toHaveLength(3);
      expect(checkboxes[0]?.label).toBe('First');
      expect(checkboxes[1]?.label).toBe('Second');
      expect(checkboxes[2]?.label).toBe('Third');
    });
  });
});
