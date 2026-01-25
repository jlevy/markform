import { describe, expect, it } from 'vitest';

import { findAllCheckboxes, injectCheckboxIds } from '../../../src/engine/injectIds.js';
import { MarkformParseError } from '../../../src/errors.js';

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

  describe('injectCheckboxIds', () => {
    it('injects IDs into checkboxes without IDs', () => {
      const markdown = `- [ ] Task one
- [ ] Task two
`;
      const result = injectCheckboxIds(markdown, {
        generator: (_info, index) => `task_${index + 1}`,
      });

      expect(result.injectedCount).toBe(2);
      expect(result.markdown).toContain('Task one {% #task_1 %}');
      expect(result.markdown).toContain('Task two {% #task_2 %}');
    });

    it('preserves existing IDs by default (onlyMissing=true)', () => {
      const markdown = `- [ ] Task one {% #existing %}
- [ ] Task two
`;
      const result = injectCheckboxIds(markdown, {
        generator: (_info, index) => `task_${index + 1}`,
      });

      expect(result.injectedCount).toBe(1);
      expect(result.markdown).toContain('{% #existing %}');
      expect(result.markdown).toContain('Task two {% #task_1 %}');
    });

    it('replaces all IDs when onlyMissing=false', () => {
      const markdown = `- [ ] Task one {% #old_id %}
- [ ] Task two
`;
      const result = injectCheckboxIds(markdown, {
        generator: (_info, index) => `new_${index + 1}`,
        onlyMissing: false,
      });

      expect(result.injectedCount).toBe(2);
      expect(result.markdown).not.toContain('{% #old_id %}');
      expect(result.markdown).toContain('{% #new_1 %}');
      expect(result.markdown).toContain('{% #new_2 %}');
    });

    it('throws on duplicate generated IDs', () => {
      const markdown = `- [ ] Task one
- [ ] Task two
`;
      expect(() =>
        injectCheckboxIds(markdown, {
          generator: () => 'same_id',
        }),
      ).toThrow(MarkformParseError);
      expect(() =>
        injectCheckboxIds(markdown, {
          generator: () => 'same_id',
        }),
      ).toThrow(/duplicate/i);
    });

    it('throws when generated ID conflicts with existing', () => {
      const markdown = `- [ ] Task one {% #task_1 %}
- [ ] Task two
`;
      expect(() =>
        injectCheckboxIds(markdown, {
          generator: () => 'task_1',
        }),
      ).toThrow(MarkformParseError);
      expect(() =>
        injectCheckboxIds(markdown, {
          generator: () => 'task_1',
        }),
      ).toThrow(/conflict/i);
    });

    it('returns injected IDs map', () => {
      const markdown = `- [ ] First task
- [ ] Second task
`;
      const result = injectCheckboxIds(markdown, {
        generator: (info) => info.label.toLowerCase().replace(/\s+/g, '_'),
      });

      expect(result.injectedIds.get('First task')).toBe('first_task');
      expect(result.injectedIds.get('Second task')).toBe('second_task');
    });

    it('uses generator with enclosing headings context', () => {
      const markdown = `# Project

## Phase 1

- [ ] Research
- [ ] Design

## Phase 2

- [ ] Build
`;
      const result = injectCheckboxIds(markdown, {
        generator: (info) => {
          const section =
            info.enclosingHeadings[0]?.title.toLowerCase().replace(/\s+/g, '_') ?? 'default';
          const task = info.label.toLowerCase();
          return `${section}_${task}`;
        },
      });

      expect(result.markdown).toContain('{% #phase_1_research %}');
      expect(result.markdown).toContain('{% #phase_1_design %}');
      expect(result.markdown).toContain('{% #phase_2_build %}');
    });

    it('handles checkboxes with no changes needed', () => {
      const markdown = `- [ ] Task {% #already_has %}
`;
      const result = injectCheckboxIds(markdown, {
        generator: () => 'unused',
      });

      expect(result.injectedCount).toBe(0);
      expect(result.markdown).toBe(markdown);
    });
  });
});
