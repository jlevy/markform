/**
 * Export Helpers Tests
 *
 * Tests for the multi-format export functionality including:
 * - YAML values export (toStructuredValues)
 * - All field types are handled (exhaustiveness)
 */

import { describe, expect, it } from 'vitest';

import { parseForm } from '../../../src/engine/parse.js';
import { toStructuredValues } from '../../../src/cli/lib/exportHelpers.js';

// =============================================================================
// toStructuredValues Tests
// =============================================================================

describe('toStructuredValues', () => {
  describe('table field export', () => {
    it('exports table field as array of row objects', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="table" id="ratings" label="Ratings"
   columnIds=["source", "score", "votes"]
   columnLabels=["Source", "Score", "Votes"]
   columnTypes=["string", "number", "number"] %}
\`\`\`value
| Source | Score | Votes |
|--------|-------|-------|
| IMDB | 85 | 12500 |
| Rotten Tomatoes | 92 | 450 |
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const values = toStructuredValues(parsed);

      expect(values.ratings).toEqual({
        state: 'answered',
        value: [
          { source: 'IMDB', score: 85, votes: 12500 },
          { source: 'Rotten Tomatoes', score: 92, votes: 450 },
        ],
      });
    });

    it('exports empty table field as empty array', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="table" id="ratings" label="Ratings"
   columnIds=["source", "score"]
   columnLabels=["Source", "Score"]
   columnTypes=["string", "number"] %}
| Source | Score |
|--------|-------|
{% /field %}
{% /group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const values = toStructuredValues(parsed);

      // Empty table should be unanswered
      expect(values.ratings).toEqual({ state: 'unanswered' });
    });
  });

  describe('date field export', () => {
    it('exports date field value', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="date" id="created" label="Created Date" %}
\`\`\`value
2024-01-15
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const values = toStructuredValues(parsed);

      expect(values.created).toEqual({
        state: 'answered',
        value: '2024-01-15',
      });
    });
  });

  describe('year field export', () => {
    it('exports year field value', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="year" id="founded" label="Year Founded" %}
\`\`\`value
2020
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const values = toStructuredValues(parsed);

      expect(values.founded).toEqual({
        state: 'answered',
        value: 2020,
      });
    });
  });

  describe('exhaustiveness', () => {
    it('handles all standard field types without throwing', () => {
      // This test ensures all field kinds are handled in the switch statement
      // The exhaustiveness check in the code will throw if a case is missing
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}

{% field kind="string" id="name" label="Name" %}
\`\`\`value
Test Name
\`\`\`
{% /field %}

{% field kind="number" id="count" label="Count" %}
\`\`\`value
42
\`\`\`
{% /field %}

{% field kind="string_list" id="tags" label="Tags" %}
\`\`\`value
- tag1
- tag2
\`\`\`
{% /field %}

{% field kind="single_select" id="choice" label="Choice" %}
- [ ] Option A {% #a %}
- [x] Option B {% #b %}
- [ ] Option C {% #c %}
{% /field %}

{% field kind="multi_select" id="choices" label="Choices" %}
- [x] Option X {% #x %}
- [ ] Option Y {% #y %}
- [x] Option Z {% #z %}
{% /field %}

{% field kind="checkboxes" id="checks" label="Checks" %}
- [x] Check 1 {% #opt1 %}
- [ ] Check 2 {% #opt2 %}
{% /field %}

{% field kind="url" id="link" label="Link" %}
\`\`\`value
https://example.com
\`\`\`
{% /field %}

{% field kind="url_list" id="links" label="Links" %}
\`\`\`value
- https://a.com
- https://b.com
\`\`\`
{% /field %}

{% field kind="date" id="date" label="Date" %}
\`\`\`value
2024-01-01
\`\`\`
{% /field %}

{% field kind="year" id="year" label="Year" %}
\`\`\`value
2024
\`\`\`
{% /field %}

{% field kind="table" id="data" label="Data"
   columnIds=["col1"]
   columnLabels=["Column 1"]
   columnTypes=["string"] %}
\`\`\`value
| Column 1 |
|----------|
| value1 |
\`\`\`
{% /field %}

{% /group %}

{% /form %}
`;
      const parsed = parseForm(markdown);

      // This should not throw - all field types should be handled
      expect(() => toStructuredValues(parsed)).not.toThrow();

      const values = toStructuredValues(parsed);

      // Verify each field type was exported correctly
      expect(values.name).toEqual({ state: 'answered', value: 'Test Name' });
      expect(values.count).toEqual({ state: 'answered', value: 42 });
      expect(values.tags).toEqual({ state: 'answered', value: ['- tag1', '- tag2'] });
      expect(values.choice).toEqual({ state: 'answered', value: 'b' });
      expect(values.choices).toEqual({ state: 'answered', value: ['x', 'z'] });
      expect(values.checks).toEqual({ state: 'answered', value: { opt1: 'done', opt2: 'todo' } });
      expect(values.link).toEqual({ state: 'answered', value: 'https://example.com' });
      expect(values.links).toEqual({
        state: 'answered',
        value: ['- https://a.com', '- https://b.com'],
      });
      expect(values.date).toEqual({ state: 'answered', value: '2024-01-01' });
      expect(values.year).toEqual({ state: 'answered', value: 2024 });
      expect(values.data).toEqual({ state: 'answered', value: [{ col1: 'value1' }] });
    });
  });
});
