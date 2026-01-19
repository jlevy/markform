/**
 * Tests for content-preserving serialization (splice-based).
 * TDD: These tests are written first, before implementation.
 *
 * Phase 2 of Content Preservation feature (mf-4nzv).
 */

import { describe, expect, it } from 'vitest';

import { parseForm } from '../../../src/engine/parse.js';
import { serializeForm } from '../../../src/engine/serialize.js';

describe('engine/serialize content preservation', () => {
  describe('preserves content outside Markform tags', () => {
    it('preserves markdown heading before form tag', () => {
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
      const form = parseForm(markdown);
      const output = serializeForm(form);

      expect(output).toContain('# My Form Title');
      expect(output).toContain('Some introductory text.');
    });

    it('preserves markdown content after form tag', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}
{% group id="g1" %}
{% field kind="string" id="name" label="Name" %}{% /field %}
{% /group %}
{% /form %}

## Footer Section

Some footer content here.
`;
      const form = parseForm(markdown);
      const output = serializeForm(form);

      expect(output).toContain('## Footer Section');
      expect(output).toContain('Some footer content here.');
    });

    // SKIPPED: Phase 3 feature - preserving content INSIDE the form (between groups)
    // Current implementation (Phase 2) only preserves content OUTSIDE the form tag.
    // See bead mf-k57e for Phase 3: Polish and edge cases
    it.skip('preserves markdown content between groups', () => {
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

Some explanatory text between sections.

{% group id="section_b" %}
{% field kind="string" id="q2" label="Q2" %}{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const output = serializeForm(form);

      expect(output).toContain('## Section A');
      expect(output).toContain('## Section B');
      expect(output).toContain('Some explanatory text between sections.');
    });

    it('preserves code blocks outside form tags', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

# Example Form

Here is some example code:

\`\`\`python
def hello():
    print("Hello, world!")
\`\`\`

{% form id="test" %}
{% group id="g1" %}
{% field kind="string" id="name" label="Name" %}{% /field %}
{% /group %}
{% /form %}
`;
      const form = parseForm(markdown);
      const output = serializeForm(form);

      expect(output).toContain('```python');
      expect(output).toContain('def hello():');
      expect(output).toContain('print("Hello, world!")');
    });

    it('preserves lists outside form tags', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

## Instructions

Please follow these steps:

- Step 1: Read carefully
- Step 2: Fill in fields
- Step 3: Review

{% form id="test" %}
{% group id="g1" %}
{% field kind="string" id="name" label="Name" %}{% /field %}
{% /group %}
{% /form %}
`;
      const form = parseForm(markdown);
      const output = serializeForm(form);

      expect(output).toContain('- Step 1: Read carefully');
      expect(output).toContain('- Step 2: Fill in fields');
      expect(output).toContain('- Step 3: Review');
    });

    it('preserves blockquotes outside form tags', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

# Form

> This is an important note.
> Please read carefully.

{% form id="test" %}
{% group id="g1" %}
{% field kind="string" id="name" label="Name" %}{% /field %}
{% /group %}
{% /form %}
`;
      const form = parseForm(markdown);
      const output = serializeForm(form);

      expect(output).toContain('> This is an important note.');
      expect(output).toContain('> Please read carefully.');
    });
  });

  describe('preserveContent option', () => {
    it('regenerates from scratch when preserveContent is false', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

# Extra Title That Should Be Lost

{% form id="test" %}
{% group id="g1" %}
{% field kind="string" id="name" label="Name" %}{% /field %}
{% /group %}
{% /form %}
`;
      const form = parseForm(markdown);
      const output = serializeForm(form, { preserveContent: false });

      // When preserveContent is false, content outside tags should NOT be preserved
      expect(output).not.toContain('# Extra Title That Should Be Lost');
    });

    it('preserves content by default (preserveContent defaults to true)', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

# Title Should Be Preserved

{% form id="test" %}
{% group id="g1" %}
{% field kind="string" id="name" label="Name" %}{% /field %}
{% /group %}
{% /form %}
`;
      const form = parseForm(markdown);
      const output = serializeForm(form); // No options - should default to preserving

      expect(output).toContain('# Title Should Be Preserved');
    });
  });

  describe('handles value changes while preserving content', () => {
    it('preserves outside content when field value changes', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

# Important Header

{% form id="test" %}
{% group id="g1" %}
{% field kind="string" id="name" label="Name" %}
\`\`\`value
Original Name
\`\`\`
{% /field %}
{% /group %}
{% /form %}

## Footer
`;
      const form = parseForm(markdown);

      // Modify the value
      form.responsesByFieldId.name = {
        state: 'answered',
        value: { kind: 'string', value: 'New Name' },
      };

      const output = serializeForm(form);

      // Content outside tags should be preserved
      expect(output).toContain('# Important Header');
      expect(output).toContain('## Footer');

      // New value should be serialized
      expect(output).toContain('New Name');
      expect(output).not.toContain('Original Name');
    });
  });

  describe('fallback behavior when rawSource unavailable', () => {
    it('regenerates from scratch when rawSource is undefined', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

# Title

{% form id="test" %}
{% group id="g1" %}
{% field kind="string" id="name" label="Name" %}{% /field %}
{% /group %}
{% /form %}
`;
      const form = parseForm(markdown);

      // Simulate a programmatically created form with no rawSource
      form.rawSource = undefined;
      form.tagRegions = undefined;

      const output = serializeForm(form);

      // Should still produce valid output (regenerated from scratch)
      expect(output).toContain('{% form');
      expect(output).toContain('{% field');
      // But should NOT contain the title since we removed rawSource
      expect(output).not.toContain('# Title');
    });
  });

  describe('round-trip stability', () => {
    it('produces stable output after multiple round-trips', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

# Multi Round-Trip Test

Introduction paragraph.

{% form id="test" title="Test Form" %}

## Section One

{% group id="g1" title="Group 1" %}
{% field kind="string" id="name" label="Name" required=true %}{% /field %}
{% field kind="number" id="age" label="Age" %}{% /field %}
{% /group %}

## Section Two

{% group id="g2" title="Group 2" %}
{% field kind="string" id="color" label="Favorite Color" %}{% /field %}
{% /group %}

{% /form %}

## Appendix

Footer content.
`;
      const form1 = parseForm(markdown);
      const output1 = serializeForm(form1);

      const form2 = parseForm(output1);
      const output2 = serializeForm(form2);

      // After two round-trips, output should be identical
      expect(output2).toBe(output1);
    });
  });

  describe('comment syntax preservation', () => {
    it('preserves content with comment syntax forms', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

# Comment Syntax Form

Introduction text.

<!-- form id="test" -->
<!-- group id="g1" -->
<!-- field kind="string" id="name" label="Name" --><!-- /field -->
<!-- /group -->
<!-- /form -->

## Footer
`;
      const form = parseForm(markdown);
      const output = serializeForm(form);

      // Content should be preserved
      expect(output).toContain('# Comment Syntax Form');
      expect(output).toContain('Introduction text.');
      expect(output).toContain('## Footer');
    });
  });
});
