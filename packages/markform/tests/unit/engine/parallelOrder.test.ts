import { describe, expect, it } from 'vitest';

import { parseForm, ParseError } from '../../../src/engine/parse.js';
import { serializeForm } from '../../../src/engine/serialize.js';
import { computeExecutionPlan } from '../../../src/engine/executionPlan.js';

// =============================================================================
// Test helpers
// =============================================================================

function makeForm(body: string): string {
  return `---
markform:
  spec: MF/0.1
---

{% form id="test" title="Test" %}

${body}

{% /form %}
`;
}

// =============================================================================
// Parsing: parallel attribute
// =============================================================================

describe('parallel attribute', () => {
  describe('parsing', () => {
    it('parses parallel on a top-level field', () => {
      const md = makeForm(`
{% field kind="string" id="a" label="A" parallel="batch_1" %}{% /field %}
`);
      const result = parseForm(md);
      // Top-level fields go into implicit group
      const field = result.schema.groups[0]?.children[0];
      expect(field?.id).toBe('a');
      expect(field?.parallel).toBe('batch_1');
    });

    it('parses parallel on a group', () => {
      const md = makeForm(`
{% group id="g1" title="G1" parallel="research" %}
{% field kind="string" id="a" label="A" %}{% /field %}
{% /group %}
`);
      const result = parseForm(md);
      const group = result.schema.groups[0];
      expect(group?.id).toBe('g1');
      expect(group?.parallel).toBe('research');
    });

    it('omits parallel when not specified (undefined)', () => {
      const md = makeForm(`
{% field kind="string" id="a" label="A" %}{% /field %}
`);
      const result = parseForm(md);
      const field = result.schema.groups[0]?.children[0];
      expect(field?.parallel).toBeUndefined();
    });

    it('errors when parallel is on a field inside a group', () => {
      const md = makeForm(`
{% group id="g1" title="G1" %}
{% field kind="string" id="a" label="A" parallel="batch_1" %}{% /field %}
{% /group %}
`);
      expect(() => parseForm(md)).toThrow(ParseError);
      expect(() => parseForm(md)).toThrow(/parallel.*inside.*group/i);
    });
  });

  describe('validation', () => {
    it('errors when parallel batch items have different order values', () => {
      const md = makeForm(`
{% group id="g1" title="G1" parallel="batch" order=0 %}
{% field kind="string" id="a" label="A" %}{% /field %}
{% /group %}
{% group id="g2" title="G2" parallel="batch" order=5 %}
{% field kind="string" id="b" label="B" %}{% /field %}
{% /group %}
`);
      expect(() => parseForm(md)).toThrow(ParseError);
      expect(() => parseForm(md)).toThrow(/parallel batch.*different order/i);
    });

    it('allows parallel batch items with same order', () => {
      const md = makeForm(`
{% group id="g1" title="G1" parallel="batch" order=5 %}
{% field kind="string" id="a" label="A" %}{% /field %}
{% /group %}
{% group id="g2" title="G2" parallel="batch" order=5 %}
{% field kind="string" id="b" label="B" %}{% /field %}
{% /group %}
`);
      expect(() => parseForm(md)).not.toThrow();
    });

    it('allows parallel batch items with unset order (defaults to 0)', () => {
      const md = makeForm(`
{% group id="g1" title="G1" parallel="batch" %}
{% field kind="string" id="a" label="A" %}{% /field %}
{% /group %}
{% group id="g2" title="G2" parallel="batch" %}
{% field kind="string" id="b" label="B" %}{% /field %}
{% /group %}
`);
      expect(() => parseForm(md)).not.toThrow();
    });

    it('errors when parallel batch items have different roles', () => {
      const md = makeForm(`
{% field kind="string" id="a" label="A" parallel="batch" %}{% /field %}
{% field kind="string" id="b" label="B" parallel="batch" role="user" %}{% /field %}
`);
      expect(() => parseForm(md)).toThrow(ParseError);
      expect(() => parseForm(md)).toThrow(/parallel batch.*different role/i);
    });

    it('allows parallel batch items with same explicit role', () => {
      const md = makeForm(`
{% field kind="string" id="a" label="A" parallel="batch" role="user" %}{% /field %}
{% field kind="string" id="b" label="B" parallel="batch" role="user" %}{% /field %}
`);
      expect(() => parseForm(md)).not.toThrow();
    });
  });

  describe('serialization round-trip', () => {
    it('round-trips parallel on a group', () => {
      const md = makeForm(`
{% group id="g1" title="G1" parallel="research" %}

{% field kind="string" id="a" label="A" %}{% /field %}

{% /group %}
`);
      const parsed = parseForm(md);
      const serialized = serializeForm(parsed);
      expect(serialized).toContain('parallel="research"');

      // Re-parse and verify
      const reparsed = parseForm(serialized);
      expect(reparsed.schema.groups[0]?.parallel).toBe('research');
    });

    it('round-trips parallel on a top-level field', () => {
      const md = makeForm(`
{% field kind="string" id="a" label="A" parallel="batch_1" %}{% /field %}
`);
      const parsed = parseForm(md);
      const serialized = serializeForm(parsed);
      expect(serialized).toContain('parallel="batch_1"');
    });
  });
});

// =============================================================================
// Parsing: order attribute
// =============================================================================

describe('order attribute', () => {
  describe('parsing', () => {
    it('parses order on a field', () => {
      const md = makeForm(`
{% field kind="string" id="a" label="A" order=99 %}{% /field %}
`);
      const result = parseForm(md);
      const field = result.schema.groups[0]?.children[0];
      expect(field?.order).toBe(99);
    });

    it('parses order on a group', () => {
      const md = makeForm(`
{% group id="g1" title="G1" order=10 %}
{% field kind="string" id="a" label="A" %}{% /field %}
{% /group %}
`);
      const result = parseForm(md);
      expect(result.schema.groups[0]?.order).toBe(10);
    });

    it('parses negative order', () => {
      const md = makeForm(`
{% field kind="string" id="a" label="A" order=-10 %}{% /field %}
`);
      const result = parseForm(md);
      const field = result.schema.groups[0]?.children[0];
      expect(field?.order).toBe(-10);
    });

    it('defaults to undefined when not specified', () => {
      const md = makeForm(`
{% field kind="string" id="a" label="A" %}{% /field %}
`);
      const result = parseForm(md);
      const field = result.schema.groups[0]?.children[0];
      expect(field?.order).toBeUndefined();
    });

    it('errors when field inside group has different order than group', () => {
      const md = makeForm(`
{% group id="g1" title="G1" order=5 %}
{% field kind="string" id="a" label="A" order=10 %}{% /field %}
{% /group %}
`);
      expect(() => parseForm(md)).toThrow(ParseError);
      expect(() => parseForm(md)).toThrow(/order/i);
    });

    it('allows field inside group with same order as group', () => {
      const md = makeForm(`
{% group id="g1" title="G1" order=5 %}
{% field kind="string" id="a" label="A" order=5 %}{% /field %}
{% /group %}
`);
      expect(() => parseForm(md)).not.toThrow();
    });

    it('errors when field inside group has order but group defaults to 0', () => {
      const md = makeForm(`
{% group id="g1" title="G1" %}
{% field kind="string" id="a" label="A" order=5 %}{% /field %}
{% /group %}
`);
      expect(() => parseForm(md)).toThrow(ParseError);
      expect(() => parseForm(md)).toThrow(/order/i);
    });

    it('allows field with order=0 inside group with no order', () => {
      const md = makeForm(`
{% group id="g1" title="G1" %}
{% field kind="string" id="a" label="A" order=0 %}{% /field %}
{% /group %}
`);
      expect(() => parseForm(md)).not.toThrow();
    });
  });

  describe('serialization round-trip', () => {
    it('round-trips order on a field', () => {
      const md = makeForm(`
{% field kind="string" id="a" label="A" order=99 %}{% /field %}
`);
      const parsed = parseForm(md);
      const serialized = serializeForm(parsed);
      expect(serialized).toContain('order=99');

      const reparsed = parseForm(serialized);
      const field = reparsed.schema.groups[0]?.children[0];
      expect(field?.order).toBe(99);
    });

    it('round-trips order on a group', () => {
      const md = makeForm(`
{% group id="g1" title="G1" order=10 %}

{% field kind="string" id="a" label="A" %}{% /field %}

{% /group %}
`);
      const parsed = parseForm(md);
      const serialized = serializeForm(parsed);
      expect(serialized).toContain('order=10');
    });

    it('does not emit order when undefined', () => {
      const md = makeForm(`
{% field kind="string" id="a" label="A" %}{% /field %}
`);
      const parsed = parseForm(md);
      const serialized = serializeForm(parsed);
      expect(serialized).not.toContain('order=');
    });
  });
});

// =============================================================================
// Execution Plan
// =============================================================================

describe('computeExecutionPlan', () => {
  it('returns all items as loose-serial when no parallel attributes', () => {
    const md = makeForm(`
{% group id="g1" title="G1" %}
{% field kind="string" id="a" label="A" %}{% /field %}
{% /group %}
{% group id="g2" title="G2" %}
{% field kind="string" id="b" label="B" %}{% /field %}
{% /group %}
`);
    const parsed = parseForm(md);
    const plan = computeExecutionPlan(parsed);

    expect(plan.looseSerial).toHaveLength(2);
    expect(plan.parallelBatches).toHaveLength(0);
    expect(plan.orderLevels).toEqual([0]);
  });

  it('separates parallel items into batches', () => {
    const md = makeForm(`
{% group id="g1" title="G1" %}
{% field kind="string" id="a" label="A" %}{% /field %}
{% /group %}
{% group id="g2" title="G2" parallel="research" %}
{% field kind="string" id="b" label="B" %}{% /field %}
{% /group %}
{% group id="g3" title="G3" parallel="research" %}
{% field kind="string" id="c" label="C" %}{% /field %}
{% /group %}
`);
    const parsed = parseForm(md);
    const plan = computeExecutionPlan(parsed);

    expect(plan.looseSerial).toHaveLength(1);
    expect(plan.looseSerial[0]?.itemId).toBe('g1');

    expect(plan.parallelBatches).toHaveLength(1);
    expect(plan.parallelBatches[0]?.batchId).toBe('research');
    expect(plan.parallelBatches[0]?.items).toHaveLength(2);
    expect(plan.parallelBatches[0]?.items[0]?.itemId).toBe('g2');
    expect(plan.parallelBatches[0]?.items[1]?.itemId).toBe('g3');
  });

  it('supports multiple parallel batches', () => {
    const md = makeForm(`
{% field kind="string" id="a" label="A" parallel="batch_1" %}{% /field %}
{% field kind="string" id="b" label="B" parallel="batch_1" %}{% /field %}
{% field kind="string" id="c" label="C" parallel="batch_2" %}{% /field %}
{% field kind="string" id="d" label="D" parallel="batch_2" %}{% /field %}
`);
    const parsed = parseForm(md);
    const plan = computeExecutionPlan(parsed);

    expect(plan.looseSerial).toHaveLength(0);
    expect(plan.parallelBatches).toHaveLength(2);
    expect(plan.parallelBatches[0]?.batchId).toBe('batch_1');
    expect(plan.parallelBatches[1]?.batchId).toBe('batch_2');
  });

  it('computes order levels', () => {
    const md = makeForm(`
{% group id="g1" title="G1" order=-1 %}
{% field kind="string" id="a" label="A" %}{% /field %}
{% /group %}
{% group id="g2" title="G2" %}
{% field kind="string" id="b" label="B" %}{% /field %}
{% /group %}
{% group id="g3" title="G3" order=10 %}
{% field kind="string" id="c" label="C" %}{% /field %}
{% /group %}
`);
    const parsed = parseForm(md);
    const plan = computeExecutionPlan(parsed);

    expect(plan.orderLevels).toEqual([-1, 0, 10]);
  });

  it('includes order on execution plan items', () => {
    const md = makeForm(`
{% group id="g1" title="G1" order=5 %}
{% field kind="string" id="a" label="A" %}{% /field %}
{% /group %}
`);
    const parsed = parseForm(md);
    const plan = computeExecutionPlan(parsed);

    expect(plan.looseSerial[0]?.order).toBe(5);
  });

  it('handles top-level fields in implicit groups', () => {
    const md = makeForm(`
{% field kind="string" id="a" label="A" parallel="batch" %}{% /field %}
{% field kind="string" id="b" label="B" %}{% /field %}
`);
    const parsed = parseForm(md);
    const plan = computeExecutionPlan(parsed);

    // a is in a parallel batch, b is loose serial
    // But both may be in implicit groups — plan should work at field level for implicit groups
    expect(plan.parallelBatches).toHaveLength(1);
    expect(plan.parallelBatches[0]?.items[0]?.itemId).toBe('a');
  });
});
