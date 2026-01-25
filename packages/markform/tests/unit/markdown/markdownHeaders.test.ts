import { describe, expect, it } from 'vitest';

import { findAllHeadings, findEnclosingHeadings } from '../../../src/markdown/markdownHeaders.js';

describe('markdown/markdownHeaders', () => {
  describe('findAllHeadings', () => {
    it('finds no headings in empty document', () => {
      const headings = findAllHeadings('');
      expect(headings).toHaveLength(0);
    });

    it('finds no headings in document without headings', () => {
      const markdown = `This is some text.

More text here.

- A list item
- Another item
`;
      const headings = findAllHeadings(markdown);
      expect(headings).toHaveLength(0);
    });

    it('finds a single h1 heading', () => {
      const markdown = `# Main Title

Some content.
`;
      const headings = findAllHeadings(markdown);
      expect(headings).toHaveLength(1);
      expect(headings[0]).toMatchObject({
        level: 1,
        title: 'Main Title',
        line: 1,
      });
    });

    it('finds multiple headings in order', () => {
      const markdown = `# Title

## Section 1

Content.

### Subsection

More content.

## Section 2

Final content.
`;
      const headings = findAllHeadings(markdown);
      expect(headings).toHaveLength(4);
      expect(headings[0]).toMatchObject({ level: 1, title: 'Title', line: 1 });
      expect(headings[1]).toMatchObject({ level: 2, title: 'Section 1', line: 3 });
      expect(headings[2]).toMatchObject({ level: 3, title: 'Subsection', line: 7 });
      expect(headings[3]).toMatchObject({ level: 2, title: 'Section 2', line: 11 });
    });

    it('handles all heading levels 1-6', () => {
      const markdown = `# H1
## H2
### H3
#### H4
##### H5
###### H6
`;
      const headings = findAllHeadings(markdown);
      expect(headings).toHaveLength(6);
      for (let i = 0; i < 6; i++) {
        expect(headings[i]).toMatchObject({ level: i + 1, title: `H${i + 1}` });
      }
    });

    it('ignores headings in code blocks', () => {
      const markdown = `# Real Heading

\`\`\`markdown
# This is in a code block
## Also in code block
\`\`\`

## Another Real Heading
`;
      const headings = findAllHeadings(markdown);
      expect(headings).toHaveLength(2);
      expect(headings[0]).toMatchObject({ level: 1, title: 'Real Heading' });
      expect(headings[1]).toMatchObject({ level: 2, title: 'Another Real Heading' });
    });

    it('trims whitespace from heading titles', () => {
      const markdown = `#    Spaced Title

##  Another
`;
      const headings = findAllHeadings(markdown);
      expect(headings[0]?.title).toBe('Spaced Title');
      expect(headings[1]?.title).toBe('Another');
    });

    it('handles headings with inline formatting', () => {
      const markdown = `# **Bold** and *italic*

## Code \`inline\` here
`;
      const headings = findAllHeadings(markdown);
      // The raw title includes the markdown syntax
      expect(headings[0]?.title).toBe('**Bold** and *italic*');
      expect(headings[1]?.title).toBe('Code `inline` here');
    });
  });

  describe('findEnclosingHeadings', () => {
    it('returns empty array for line before any heading', () => {
      const markdown = `Some intro text.

# First Heading

Content.
`;
      const headings = findEnclosingHeadings(markdown, 1);
      expect(headings).toHaveLength(0);
    });

    it('returns the heading for a line directly under it', () => {
      const markdown = `# Main

Content on line 3.
`;
      const headings = findEnclosingHeadings(markdown, 3);
      expect(headings).toHaveLength(1);
      expect(headings[0]).toMatchObject({ level: 1, title: 'Main' });
    });

    it('returns innermost heading first for nested sections', () => {
      const markdown = `# Level 1

## Level 2

### Level 3

Content here on line 7.
`;
      const headings = findEnclosingHeadings(markdown, 7);
      expect(headings).toHaveLength(3);
      expect(headings[0]).toMatchObject({ level: 3, title: 'Level 3' });
      expect(headings[1]).toMatchObject({ level: 2, title: 'Level 2' });
      expect(headings[2]).toMatchObject({ level: 1, title: 'Level 1' });
    });

    it('stops at heading of equal or higher level', () => {
      const markdown = `# First Section

## Subsection

# Second Section

Content here.
`;
      const headings = findEnclosingHeadings(markdown, 7);
      expect(headings).toHaveLength(1);
      expect(headings[0]).toMatchObject({ level: 1, title: 'Second Section' });
    });

    it('handles complex nesting', () => {
      const markdown = `# A

## B

### C

## D

### E

#### F

Content on line 13.
`;
      const headings = findEnclosingHeadings(markdown, 13);
      expect(headings).toHaveLength(4);
      expect(headings[0]).toMatchObject({ level: 4, title: 'F' });
      expect(headings[1]).toMatchObject({ level: 3, title: 'E' });
      expect(headings[2]).toMatchObject({ level: 2, title: 'D' });
      expect(headings[3]).toMatchObject({ level: 1, title: 'A' });
    });

    it('returns empty for line 0 or negative', () => {
      const markdown = `# Heading

Content.
`;
      expect(findEnclosingHeadings(markdown, 0)).toHaveLength(0);
      expect(findEnclosingHeadings(markdown, -1)).toHaveLength(0);
    });

    it('handles line at exact heading position', () => {
      const markdown = `# First

## Second
`;
      // Line 3 is the second heading itself
      const headings = findEnclosingHeadings(markdown, 3);
      // The heading at line 3 doesn't enclose line 3 - only what comes after
      expect(headings).toHaveLength(1);
      expect(headings[0]).toMatchObject({ level: 1, title: 'First' });
    });
  });
});
