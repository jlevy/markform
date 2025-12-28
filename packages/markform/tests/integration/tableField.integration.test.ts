import { describe, it, expect } from 'vitest';

import { parseTableField } from '../../src/engine/parseFields.js';
import { serializeTableField } from '../../src/engine/table/serializeTable.js';
import { createMockNode } from '../../src/engine/testUtils.js';

/**
 * Integration test for table field parsing and serialization.
 * Verifies end-to-end round-trip functionality.
 */
describe('table-field integration', () => {
  it('round-trips table field with data', () => {
    // Original markdown
    const _originalMarkdown = `{% table-field id="films" label="Films"
   columnIds=["title", "year", "rating"]
   columnLabels=["Title", "Year", "Rating"]
   columnTypes=["string", "year", "number"] %}
| Title | Year | Rating |
|-------|------|--------|
| Inception | 2010 | 8.8 |
| Interstellar | 2014 | 8.6 |
{% /table-field %}`;

    // Create mock node
    const node = createMockNode(
      'table-field',
      {
        id: 'films',
        label: 'Films',
        columnIds: ['title', 'year', 'rating'],
        columnLabels: ['Title', 'Year', 'Rating'],
        columnTypes: ['string', 'year', 'number'],
      },
      `
| Title | Year | Rating |
|-------|------|--------|
| Inception | 2010 | 8.8 |
| Interstellar | 2014 | 8.6 |
`.trim(),
    );

    // Parse the field
    const parsed = parseTableField(node);

    // Verify parsing worked
    expect(parsed.field.kind).toBe('table');
    expect(parsed.field.columns).toHaveLength(3);
    expect(parsed.response.state).toBe('answered');
    expect((parsed.response.value as any)?.rows).toHaveLength(2);

    // Serialize back

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const serialized = serializeTableField(parsed.field, (parsed.response.value as any).rows);

    // Verify serialization includes key elements
    expect(serialized).toContain('{% table-field');
    expect(serialized).toContain('id="films"');
    expect(serialized).toContain('label="Films"');
    expect(serialized).toContain('columnIds=["title", "year", "rating"]');
    expect(serialized).toContain('columnLabels=["Title", "Year", "Rating"]');
    expect(serialized).toContain('columnTypes=["string", "year", "number"]');
    expect(serialized).toContain('| Inception | 2010 | 8.8 |');
    expect(serialized).toContain('| Interstellar | 2014 | 8.6 |');
    expect(serialized).toContain('{% /table-field %}');
  });

  it('round-trips empty table', () => {
    const node = createMockNode(
      'table-field',
      {
        id: 'empty_table',
        label: 'Empty Table',
        columnIds: ['name', 'value'],
      },
      `
| Name | Value |
|------|-------|
`.trim(),
    );

    const parsed = parseTableField(node);
    // For empty tables, response.value might be undefined, so use empty array
    const rows = parsed.response.value ? (parsed.response.value as any).rows : [];
    const serialized = serializeTableField(parsed.field, rows);

    expect(serialized).toContain('columnIds=["name", "value"]');
    expect(serialized).toContain('columnLabels=["Name", "Value"]');
    expect(serialized).toContain('| Name | Value |');
    expect(serialized).toContain('| --- | --- |');
  });

  it('handles sentinel values in round-trip', () => {
    const node = createMockNode(
      'table-field',
      {
        id: 'with_sentinels',
        label: 'Table with Sentinels',
        columnIds: ['item', 'status'],
      },
      `
| Item | Status |
|------|--------|
| Task A | done |
| Task B | %SKIP% (Not applicable) |
| Task C | %ABORT% (Error occurred) |
`.trim(),
    );

    const parsed = parseTableField(node);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const serialized = serializeTableField(parsed.field, (parsed.response.value as any).rows);

    expect(serialized).toContain('| Task A | done |');
    expect(serialized).toContain('| Task B | %SKIP% (Not applicable) |');
    expect(serialized).toContain('| Task C | %ABORT% (Error occurred) |');
  });
});
