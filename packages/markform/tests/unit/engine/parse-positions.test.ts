/**
 * Tests for position tracking and raw source storage in ParsedForm.
 * TDD: These tests are written first, before implementation.
 *
 * Phase 1 of Content Preservation feature (mf-6hsf).
 */

import { describe, expect, it } from 'vitest';

import { parseForm } from '../../../src/engine/parse.js';

describe('engine/parse position tracking', () => {
  describe('rawSource storage', () => {
    it('stores the preprocessed source in rawSource', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}
{% group id="g1" %}
{% field kind="string" id="name" label="Name" %}{% /field %}
{% /group %}
{% /form %}
`;
      const result = parseForm(markdown);

      expect(result.rawSource).toBeDefined();
      expect(typeof result.rawSource).toBe('string');
      // rawSource should contain the form content (post-frontmatter)
      expect(result.rawSource).toContain('{% form id="test" %}');
    });

    it('stores preprocessed source for comment syntax forms', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

<!-- form id="test" -->
<!-- group id="g1" -->
<!-- field kind="string" id="name" label="Name" --><!-- /field -->
<!-- /group -->
<!-- /form -->
`;
      const result = parseForm(markdown);

      expect(result.rawSource).toBeDefined();
      // For comment syntax, rawSource stores the preprocessed (tag syntax) version
      expect(result.rawSource).toContain('{% form id="test" %}');
    });

    it('rawSource excludes frontmatter', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}
{% group id="g1" %}
{% field kind="string" id="name" label="Name" %}{% /field %}
{% /group %}
{% /form %}
`;
      const result = parseForm(markdown);

      expect(result.rawSource).toBeDefined();
      // rawSource should NOT contain frontmatter delimiters
      expect(result.rawSource).not.toMatch(/^---/);
    });
  });

  describe('tagRegions tracking', () => {
    it('tracks form tag region', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}
{% group id="g1" %}
{% field kind="string" id="name" label="Name" %}{% /field %}
{% /group %}
{% /form %}
`;
      const result = parseForm(markdown);

      expect(result.tagRegions).toBeDefined();
      expect(Array.isArray(result.tagRegions)).toBe(true);

      const formRegion = result.tagRegions?.find((r) => r.tagType === 'form');
      expect(formRegion).toBeDefined();
      expect(formRegion?.tagId).toBe('test');
    });

    it('tracks group tag regions', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}
{% group id="section_a" %}
{% field kind="string" id="q1" label="Q1" %}{% /field %}
{% /group %}
{% group id="section_b" %}
{% field kind="string" id="q2" label="Q2" %}{% /field %}
{% /group %}
{% /form %}
`;
      const result = parseForm(markdown);

      const groupRegions = result.tagRegions?.filter((r) => r.tagType === 'group');
      expect(groupRegions).toHaveLength(2);

      const groupIds = groupRegions?.map((r) => r.tagId);
      expect(groupIds).toContain('section_a');
      expect(groupIds).toContain('section_b');
    });

    it('tracks field tag regions', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}
{% group id="g1" %}
{% field kind="string" id="name" label="Name" %}{% /field %}
{% field kind="number" id="age" label="Age" %}{% /field %}
{% /group %}
{% /form %}
`;
      const result = parseForm(markdown);

      const fieldRegions = result.tagRegions?.filter((r) => r.tagType === 'field');
      expect(fieldRegions).toHaveLength(2);

      const fieldIds = fieldRegions?.map((r) => r.tagId);
      expect(fieldIds).toContain('name');
      expect(fieldIds).toContain('age');
    });

    it('tracks field regions with values (includesValue flag)', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}
{% group id="g1" %}
{% field kind="string" id="filled" label="Filled" %}
\`\`\`value
Hello World
\`\`\`
{% /field %}
{% field kind="string" id="empty" label="Empty" %}{% /field %}
{% /group %}
{% /form %}
`;
      const result = parseForm(markdown);

      const filledRegion = result.tagRegions?.find((r) => r.tagId === 'filled');
      const emptyRegion = result.tagRegions?.find((r) => r.tagId === 'empty');

      expect(filledRegion?.includesValue).toBe(true);
      expect(emptyRegion?.includesValue).toBeFalsy(); // undefined or false
    });

    it('tag regions have valid offsets', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}
{% group id="g1" %}
{% field kind="string" id="name" label="Name" %}{% /field %}
{% /group %}
{% /form %}
`;
      const result = parseForm(markdown);

      expect(result.rawSource).toBeDefined();
      expect(result.tagRegions).toBeDefined();

      for (const region of result.tagRegions ?? []) {
        // Offsets should be valid numbers
        expect(typeof region.startOffset).toBe('number');
        expect(typeof region.endOffset).toBe('number');

        // Start should be before end
        expect(region.startOffset).toBeLessThan(region.endOffset);

        // Offsets should be within rawSource bounds
        expect(region.startOffset).toBeGreaterThanOrEqual(0);
        expect(region.endOffset).toBeLessThanOrEqual(result.rawSource!.length);

        // The extracted region should contain the tag
        const extracted = result.rawSource!.slice(region.startOffset, region.endOffset);
        expect(extracted).toContain(`id="${region.tagId}"`);
      }
    });

    it('tracks regions in correct document order', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}
{% group id="g1" %}
{% field kind="string" id="first" label="First" %}{% /field %}
{% field kind="string" id="second" label="Second" %}{% /field %}
{% /group %}
{% /form %}
`;
      const result = parseForm(markdown);

      // Regions should be in document order (by startOffset)
      const offsets = result.tagRegions?.map((r) => r.startOffset) ?? [];
      const sortedOffsets = [...offsets].sort((a, b) => a - b);
      expect(offsets).toEqual(sortedOffsets);
    });

    it('tracks documentation block regions', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}
{% group id="g1" %}
{% field kind="string" id="name" label="Name" %}{% /field %}
{% instructions ref="name" %}
Fill in your full name.
{% /instructions %}
{% /group %}
{% /form %}
`;
      const result = parseForm(markdown);

      const docRegions = result.tagRegions?.filter((r) => r.tagType === 'documentation');
      expect(docRegions).toBeDefined();
      expect(docRegions!.length).toBeGreaterThanOrEqual(1);
    });

    it('tracks note tag regions', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}
{% group id="g1" %}
{% field kind="string" id="name" label="Name" %}
\`\`\`value
John Doe
\`\`\`
{% /field %}
{% note id="note1" ref="name" role="agent" %}
Selected based on user profile.
{% /note %}
{% /group %}
{% /form %}
`;
      const result = parseForm(markdown);

      const noteRegions = result.tagRegions?.filter((r) => r.tagType === 'note');
      expect(noteRegions).toBeDefined();
      expect(noteRegions!.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('rawSource with content outside tags', () => {
    it('preserves markdown content before form tag in rawSource', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

# My Form Title

Some introductory text.

{% form id="test" %}
{% group id="g1" %}
{% field kind="string" id="name" label="Name" %}{% /field %}
{% /group %}
{% /form %}
`;
      const result = parseForm(markdown);

      expect(result.rawSource).toContain('# My Form Title');
      expect(result.rawSource).toContain('Some introductory text.');
    });

    it('preserves markdown content after form tag in rawSource', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}
{% group id="g1" %}
{% field kind="string" id="name" label="Name" %}{% /field %}
{% /group %}
{% /form %}

## Footer

Some footer content.
`;
      const result = parseForm(markdown);

      expect(result.rawSource).toContain('## Footer');
      expect(result.rawSource).toContain('Some footer content.');
    });

    it('preserves markdown content between groups in rawSource', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

## Section A

{% group id="section_a" %}
{% field kind="string" id="q1" label="Q1" %}{% /field %}
{% /group %}

## Section B

Some text between sections.

{% group id="section_b" %}
{% field kind="string" id="q2" label="Q2" %}{% /field %}
{% /group %}

{% /form %}
`;
      const result = parseForm(markdown);

      expect(result.rawSource).toContain('## Section A');
      expect(result.rawSource).toContain('## Section B');
      expect(result.rawSource).toContain('Some text between sections.');
    });
  });
});
