/**
 * Tests for the plan command logic (computeExecutionPlan + inspect integration).
 *
 * Validates that the execution plan correctly partitions forms by order level
 * and parallel batches, and only includes remaining (unanswered) work.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { computeExecutionPlan } from '../../../src/engine/executionPlan.js';
import { inspect } from '../../../src/engine/inspect.js';
import { parseForm } from '../../../src/engine/parse.js';

// =============================================================================
// Fixtures
// =============================================================================

const EXAMPLES_DIR = join(__dirname, '../../../examples');

const PARALLEL_RESEARCH_FORM = readFileSync(
  join(EXAMPLES_DIR, 'parallel/parallel-research.form.md'),
  'utf-8',
);

// =============================================================================
// Tests
// =============================================================================

describe('computeExecutionPlan', () => {
  describe('parallel-research example', () => {
    it('produces correct order levels', () => {
      const form = parseForm(PARALLEL_RESEARCH_FORM);
      const plan = computeExecutionPlan(form);

      expect(plan.orderLevels).toEqual([0, 10]);
    });

    it('has one parallel batch with 3 items', () => {
      const form = parseForm(PARALLEL_RESEARCH_FORM);
      const plan = computeExecutionPlan(form);

      expect(plan.parallelBatches).toHaveLength(1);
      expect(plan.parallelBatches[0]!.batchId).toBe('deep_research');
      expect(plan.parallelBatches[0]!.items).toHaveLength(3);
    });

    it('has loose serial items for overview and synthesis groups', () => {
      const form = parseForm(PARALLEL_RESEARCH_FORM);
      const plan = computeExecutionPlan(form);

      const looseIds = plan.looseSerial.map((item) => item.itemId);
      expect(looseIds).toContain('overview');
      expect(looseIds).toContain('synthesis');
    });

    it('assigns correct order to items', () => {
      const form = parseForm(PARALLEL_RESEARCH_FORM);
      const plan = computeExecutionPlan(form);

      const overview = plan.looseSerial.find((i) => i.itemId === 'overview');
      expect(overview?.order).toBe(0);

      const synthesis = plan.looseSerial.find((i) => i.itemId === 'synthesis');
      expect(synthesis?.order).toBe(10);

      // All parallel batch items at order 0
      for (const item of plan.parallelBatches[0]!.items) {
        expect(item.order).toBe(0);
      }
    });

    it('parallel batch items are groups', () => {
      const form = parseForm(PARALLEL_RESEARCH_FORM);
      const plan = computeExecutionPlan(form);

      const batchItemIds = plan.parallelBatches[0]!.items.map((i) => i.itemId);
      expect(batchItemIds).toEqual(['financials', 'team', 'market']);
      for (const item of plan.parallelBatches[0]!.items) {
        expect(item.itemType).toBe('group');
      }
    });
  });

  describe('integration with inspect', () => {
    it('empty form has all fields as unanswered', () => {
      const form = parseForm(PARALLEL_RESEARCH_FORM);
      const result = inspect(form);

      // Should have issues for required unanswered fields
      const requiredIssues = result.issues.filter((i) => i.severity === 'required');
      expect(requiredIssues.length).toBeGreaterThan(0);

      // Form should not be complete
      expect(result.isComplete).toBe(false);
    });
  });
});
