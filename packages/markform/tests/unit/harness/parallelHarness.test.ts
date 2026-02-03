/**
 * Tests for parallel form filling (Phase 3).
 *
 * Covers:
 * - ScopedFillRequest type and scoped agent filtering
 * - ParallelHarness orchestrating concurrent agents
 * - Patch merge from parallel agents
 * - Parallel FillCallbacks (onBatchStart, onBatchComplete)
 * - Integration with MockAgent for parallel fill sessions
 */

import { describe, expect, it } from 'vitest';

import type { InspectIssue } from '../../../src/engine/coreTypes.js';
import { computeExecutionPlan } from '../../../src/engine/executionPlan.js';
import { parseForm } from '../../../src/engine/parse.js';
import { createMockAgent } from '../../../src/harness/mockAgent.js';
import type { Agent, AgentResponse } from '../../../src/harness/harnessTypes.js';
import {
  createParallelHarness,
  runWithConcurrency,
  type ScopedFillRequest,
  scopeIssuesForItem,
} from '../../../src/harness/parallelHarness.js';

// =============================================================================
// Test Fixtures
// =============================================================================

/** Form with parallel batches and order levels */
const PARALLEL_FORM = `---
markform:
  spec: MF/0.1
  roles:
    - agent
  role_instructions:
    agent: "Fill in all fields."
---
{% form id="test_form" %}

{% group id="overview" order=0 %}

{% field kind="string" id="company_name" label="Company Name" role="agent" required=true %}{% /field %}

{% /group %}

{% group id="financials" parallel="research" order=0 %}

{% field kind="string" id="revenue" label="Revenue" role="agent" required=true %}{% /field %}

{% field kind="string" id="margins" label="Margins" role="agent" %}{% /field %}

{% /group %}

{% group id="team" parallel="research" order=0 %}

{% field kind="string" id="leadership" label="Leadership" role="agent" required=true %}{% /field %}

{% /group %}

{% group id="market" parallel="research" order=0 %}

{% field kind="string" id="competitors" label="Competitors" role="agent" %}{% /field %}

{% /group %}

{% group id="synthesis" order=10 %}

{% field kind="string" id="overall" label="Overall" role="agent" required=true %}{% /field %}

{% /group %}

{% /form %}
`;

/** Filled version of the parallel form */
const PARALLEL_FORM_FILLED = `---
markform:
  spec: MF/0.1
  roles:
    - agent
  role_instructions:
    agent: "Fill in all fields."
---
{% form id="test_form" %}

{% group id="overview" order=0 %}

{% field kind="string" id="company_name" label="Company Name" role="agent" required=true %}
\`\`\`value
Acme Corp
\`\`\`
{% /field %}

{% /group %}

{% group id="financials" parallel="research" order=0 %}

{% field kind="string" id="revenue" label="Revenue" role="agent" required=true %}
\`\`\`value
$10M ARR
\`\`\`
{% /field %}

{% field kind="string" id="margins" label="Margins" role="agent" %}
\`\`\`value
40% gross
\`\`\`
{% /field %}

{% /group %}

{% group id="team" parallel="research" order=0 %}

{% field kind="string" id="leadership" label="Leadership" role="agent" required=true %}
\`\`\`value
CEO: Jane Doe
\`\`\`
{% /field %}

{% /group %}

{% group id="market" parallel="research" order=0 %}

{% field kind="string" id="competitors" label="Competitors" role="agent" %}
\`\`\`value
BigCorp, SmallCo
\`\`\`
{% /field %}

{% /group %}

{% group id="synthesis" order=10 %}

{% field kind="string" id="overall" label="Overall" role="agent" required=true %}
\`\`\`value
Strong company with good fundamentals
\`\`\`
{% /field %}

{% /group %}

{% /form %}
`;

/** Simple form with no parallel/order (should work as sequential) */
const SIMPLE_FORM = `---
markform:
  spec: MF/0.1
---
{% form id="simple_test" %}

{% group id="basics" %}

{% field kind="string" id="name" label="Name" required=true %}{% /field %}

{% field kind="number" id="age" label="Age" required=true %}{% /field %}

{% /group %}

{% /form %}
`;

const SIMPLE_FORM_FILLED = `---
markform:
  spec: MF/0.1
---
{% form id="simple_test" %}

{% group id="basics" %}

{% field kind="string" id="name" label="Name" required=true %}
\`\`\`value
Alice
\`\`\`
{% /field %}

{% field kind="number" id="age" label="Age" required=true %}
\`\`\`value
30
\`\`\`
{% /field %}

{% /group %}

{% /form %}
`;

// =============================================================================
// scopeIssuesForItem Tests
// =============================================================================

describe('scopeIssuesForItem', () => {
  it('filters issues to only target field IDs for a group item', () => {
    const form = parseForm(PARALLEL_FORM);
    const plan = computeExecutionPlan(form);
    const financialsItem = plan.parallelBatches[0]!.items.find((i) => i.itemId === 'financials')!;

    const allIssues: InspectIssue[] = [
      {
        ref: 'revenue',
        scope: 'field',
        reason: 'required_missing',
        message: 'Required',
        severity: 'required',
        priority: 1,
      },
      {
        ref: 'margins',
        scope: 'field',
        reason: 'optional_unanswered',
        message: 'Empty',
        severity: 'recommended',
        priority: 3,
      },
      {
        ref: 'leadership',
        scope: 'field',
        reason: 'required_missing',
        message: 'Required',
        severity: 'required',
        priority: 1,
      },
    ];

    const scoped = scopeIssuesForItem(form, financialsItem, allIssues);

    expect(scoped).toHaveLength(2);
    expect(scoped.map((i) => i.ref)).toEqual(['revenue', 'margins']);
  });

  it('filters issues for a single field item', () => {
    const form = parseForm(PARALLEL_FORM);
    const plan = computeExecutionPlan(form);
    // overview group is loose serial, find it
    const overviewItem = plan.looseSerial.find((i) => i.itemId === 'overview')!;

    const allIssues: InspectIssue[] = [
      {
        ref: 'company_name',
        scope: 'field',
        reason: 'required_missing',
        message: 'Required',
        severity: 'required',
        priority: 1,
      },
      {
        ref: 'revenue',
        scope: 'field',
        reason: 'required_missing',
        message: 'Required',
        severity: 'required',
        priority: 1,
      },
    ];

    const scoped = scopeIssuesForItem(form, overviewItem, allIssues);

    expect(scoped).toHaveLength(1);
    expect(scoped[0]!.ref).toBe('company_name');
  });

  it('returns empty array when no issues match target fields', () => {
    const form = parseForm(PARALLEL_FORM);
    const plan = computeExecutionPlan(form);
    const financialsItem = plan.parallelBatches[0]!.items.find((i) => i.itemId === 'financials')!;

    const unrelatedIssues: InspectIssue[] = [
      {
        ref: 'leadership',
        scope: 'field',
        reason: 'required_missing',
        message: 'Required',
        severity: 'required',
        priority: 1,
      },
    ];

    const scoped = scopeIssuesForItem(form, financialsItem, unrelatedIssues);
    expect(scoped).toHaveLength(0);
  });

  it('passes through form-scoped issues', () => {
    const form = parseForm(PARALLEL_FORM);
    const plan = computeExecutionPlan(form);
    const financialsItem = plan.parallelBatches[0]!.items.find((i) => i.itemId === 'financials')!;

    const issues: InspectIssue[] = [
      {
        ref: 'test_form',
        scope: 'form',
        reason: 'validation_error',
        message: 'Form error',
        severity: 'required',
        priority: 0,
      },
      {
        ref: 'revenue',
        scope: 'field',
        reason: 'required_missing',
        message: 'Required',
        severity: 'required',
        priority: 1,
      },
    ];

    const scoped = scopeIssuesForItem(form, financialsItem, issues);
    // Form-scoped issues are NOT passed to individual agents
    expect(scoped).toHaveLength(1);
    expect(scoped[0]!.ref).toBe('revenue');
  });
});

// =============================================================================
// ParallelHarness Tests
// =============================================================================

describe('ParallelHarness', () => {
  describe('creation', () => {
    it('creates harness from form with parallel batches', () => {
      const form = parseForm(PARALLEL_FORM);
      const harness = createParallelHarness(form);
      expect(harness).toBeDefined();
    });

    it('creates harness from form with no parallel batches', () => {
      const form = parseForm(SIMPLE_FORM);
      const harness = createParallelHarness(form);
      expect(harness).toBeDefined();
    });
  });

  describe('getExecutionPlan', () => {
    it('returns the execution plan', () => {
      const form = parseForm(PARALLEL_FORM);
      const harness = createParallelHarness(form);
      const plan = harness.getExecutionPlan();

      expect(plan.orderLevels).toEqual([0, 10]);
      expect(plan.parallelBatches).toHaveLength(1);
      expect(plan.looseSerial).toHaveLength(2);
    });
  });

  describe('runOrderLevel', () => {
    it('runs loose serial items sequentially', async () => {
      const form = parseForm(PARALLEL_FORM);
      const filledForm = parseForm(PARALLEL_FORM_FILLED);
      const agent = createMockAgent(filledForm);

      const harness = createParallelHarness(form);
      const result = await harness.runOrderLevel(0, agent);

      expect(result.patchesApplied).toBeGreaterThan(0);
      // overview group fields should be filled
      expect(form.responsesByFieldId.company_name?.state).toBe('answered');
    });

    it('runs parallel batch items concurrently', async () => {
      const form = parseForm(PARALLEL_FORM);
      const filledForm = parseForm(PARALLEL_FORM_FILLED);

      // Track which agents were called and when
      const callOrder: string[] = [];

      const agentFactory = (_request: ScopedFillRequest): Agent => {
        return {
          async fillFormTool(issues: InspectIssue[]): Promise<AgentResponse> {
            const fieldIds = issues.filter((i) => i.scope === 'field').map((i) => i.ref);
            callOrder.push(fieldIds.join(','));

            // Use the filled form as source for patches
            const mockAgent = createMockAgent(filledForm);
            return mockAgent.fillFormTool(issues, form, 20);
          },
        };
      };

      const harness = createParallelHarness(form, { agentFactory });
      const result = await harness.runOrderLevel(0, createMockAgent(filledForm));

      // All parallel batch agents should have been called
      expect(callOrder.length).toBeGreaterThanOrEqual(3); // 3 groups in parallel batch
      expect(result.patchesApplied).toBeGreaterThan(0);
    });

    it('respects maxParallelAgents', async () => {
      const form = parseForm(PARALLEL_FORM);
      const filledForm = parseForm(PARALLEL_FORM_FILLED);
      const agent = createMockAgent(filledForm);

      const harness = createParallelHarness(form, { maxParallelAgents: 1 });
      const result = await harness.runOrderLevel(0, agent);

      // Should still complete, just with limited concurrency
      expect(result.patchesApplied).toBeGreaterThan(0);
    });
  });

  describe('runAll', () => {
    it('fills entire form across all order levels', async () => {
      const form = parseForm(PARALLEL_FORM);
      const filledForm = parseForm(PARALLEL_FORM_FILLED);
      const agent = createMockAgent(filledForm);

      const harness = createParallelHarness(form);
      const result = await harness.runAll(agent);

      expect(result.isComplete).toBe(true);
      expect(result.totalPatchesApplied).toBeGreaterThan(0);

      // All required fields should be filled
      expect(form.responsesByFieldId.company_name?.state).toBe('answered');
      expect(form.responsesByFieldId.revenue?.state).toBe('answered');
      expect(form.responsesByFieldId.leadership?.state).toBe('answered');
      expect(form.responsesByFieldId.overall?.state).toBe('answered');
    });

    it('processes order levels sequentially', async () => {
      const form = parseForm(PARALLEL_FORM);
      const filledForm = parseForm(PARALLEL_FORM_FILLED);
      const agent = createMockAgent(filledForm);

      const orderLevelsProcessed: number[] = [];
      const harness = createParallelHarness(form, {
        onOrderLevelStart: (order) => orderLevelsProcessed.push(order),
      });
      await harness.runAll(agent);

      // Order 0 before order 10
      expect(orderLevelsProcessed).toEqual([0, 10]);
    });

    it('works with form that has no parallel/order attributes', async () => {
      const form = parseForm(SIMPLE_FORM);
      const filledForm = parseForm(SIMPLE_FORM_FILLED);
      const agent = createMockAgent(filledForm);

      const harness = createParallelHarness(form);
      const result = await harness.runAll(agent);

      expect(result.isComplete).toBe(true);
      expect(form.responsesByFieldId.name?.state).toBe('answered');
      expect(form.responsesByFieldId.age?.state).toBe('answered');
    });
  });

  describe('patch merge', () => {
    it('merges patches from parallel agents into single apply', async () => {
      const form = parseForm(PARALLEL_FORM);
      const filledForm = parseForm(PARALLEL_FORM_FILLED);
      const agent = createMockAgent(filledForm);

      const harness = createParallelHarness(form);
      const result = await harness.runOrderLevel(0, agent);

      // Patches from all parallel agents + loose serial should be merged
      expect(result.patchesApplied).toBeGreaterThan(0);
    });

    it('parallel agents patch disjoint field sets', async () => {
      const form = parseForm(PARALLEL_FORM);
      const filledForm = parseForm(PARALLEL_FORM_FILLED);

      const patchedFieldIds: Set<string>[] = [];

      const agentFactory = (_request: ScopedFillRequest): Agent => {
        return {
          async fillFormTool(issues: InspectIssue[]): Promise<AgentResponse> {
            const mockAgent = createMockAgent(filledForm);
            const response = await mockAgent.fillFormTool(issues, form, 20);
            const fieldIds = new Set(
              response.patches.map((p) => ('fieldId' in p ? p.fieldId : '')),
            );
            patchedFieldIds.push(fieldIds);
            return response;
          },
        };
      };

      const harness = createParallelHarness(form, { agentFactory });
      await harness.runOrderLevel(0, createMockAgent(filledForm));

      // Verify no overlap between batch agents
      for (let i = 0; i < patchedFieldIds.length; i++) {
        for (let j = i + 1; j < patchedFieldIds.length; j++) {
          const intersection = new Set(
            [...patchedFieldIds[i]!].filter((id) => patchedFieldIds[j]!.has(id)),
          );
          expect(intersection.size).toBe(0);
        }
      }
    });
  });

  describe('callbacks', () => {
    it('calls onBatchStart and onBatchComplete', async () => {
      const form = parseForm(PARALLEL_FORM);
      const filledForm = parseForm(PARALLEL_FORM_FILLED);
      const agent = createMockAgent(filledForm);

      const batchStartCalls: string[] = [];
      const batchCompleteCalls: string[] = [];

      const harness = createParallelHarness(form, {
        onBatchStart: (batchId) => batchStartCalls.push(batchId),
        onBatchComplete: (batchId) => batchCompleteCalls.push(batchId),
      });

      await harness.runAll(agent);

      expect(batchStartCalls).toContain('research');
      expect(batchCompleteCalls).toContain('research');
    });

    it('calls onOrderLevelStart and onOrderLevelComplete', async () => {
      const form = parseForm(PARALLEL_FORM);
      const filledForm = parseForm(PARALLEL_FORM_FILLED);
      const agent = createMockAgent(filledForm);

      const starts: number[] = [];
      const completes: number[] = [];

      const harness = createParallelHarness(form, {
        onOrderLevelStart: (order) => starts.push(order),
        onOrderLevelComplete: (order) => completes.push(order),
      });

      await harness.runAll(agent);

      expect(starts).toEqual([0, 10]);
      expect(completes).toEqual([0, 10]);
    });
  });
});

// =============================================================================
// runWithConcurrency Tests
// =============================================================================

describe('runWithConcurrency', () => {
  describe('basic functionality', () => {
    it('returns empty array for empty input', async () => {
      const results = await runWithConcurrency([], 5);
      expect(results).toEqual([]);
    });

    it('returns results in correct order', async () => {
      const factories = [
        () => Promise.resolve('a'),
        () => Promise.resolve('b'),
        () => Promise.resolve('c'),
      ];

      const results = await runWithConcurrency(factories, 10);

      expect(results).toHaveLength(3);
      expect(results[0]).toEqual({ status: 'fulfilled', value: 'a' });
      expect(results[1]).toEqual({ status: 'fulfilled', value: 'b' });
      expect(results[2]).toEqual({ status: 'fulfilled', value: 'c' });
    });

    it('handles rejected promises', async () => {
      const error = new Error('Test error');
      const factories = [
        () => Promise.resolve('success'),
        () => Promise.reject(error),
        () => Promise.resolve('also success'),
      ];

      const results = await runWithConcurrency(factories, 10);

      expect(results).toHaveLength(3);
      expect(results[0]).toEqual({ status: 'fulfilled', value: 'success' });
      expect(results[1]).toEqual({ status: 'rejected', reason: error });
      expect(results[2]).toEqual({ status: 'fulfilled', value: 'also success' });
    });

    it('handles all rejected promises', async () => {
      const factories = [
        () => Promise.reject(new Error('error1')),
        () => Promise.reject(new Error('error2')),
      ];

      const results = await runWithConcurrency(factories, 10);

      expect(results).toHaveLength(2);
      expect(results[0]?.status).toBe('rejected');
      expect(results[1]?.status).toBe('rejected');
    });
  });

  describe('concurrency limiting', () => {
    it('limits concurrent executions to maxConcurrent', async () => {
      let currentConcurrency = 0;
      let maxObservedConcurrency = 0;

      const createDelayedFactory = (value: number, delayMs: number) => async () => {
        currentConcurrency++;
        maxObservedConcurrency = Math.max(maxObservedConcurrency, currentConcurrency);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        currentConcurrency--;
        return value;
      };

      const factories = [
        createDelayedFactory(1, 50),
        createDelayedFactory(2, 50),
        createDelayedFactory(3, 50),
        createDelayedFactory(4, 50),
        createDelayedFactory(5, 50),
      ];

      const results = await runWithConcurrency(factories, 2);

      expect(results).toHaveLength(5);
      expect(maxObservedConcurrency).toBeLessThanOrEqual(2);
      // Verify all results are correct
      expect(results.map((r) => (r as PromiseFulfilledResult<number>).value)).toEqual([
        1, 2, 3, 4, 5,
      ]);
    });

    it('runs all at once when maxConcurrent >= factories.length', async () => {
      let currentConcurrency = 0;
      let maxObservedConcurrency = 0;

      const createDelayedFactory = (value: number) => async () => {
        currentConcurrency++;
        maxObservedConcurrency = Math.max(maxObservedConcurrency, currentConcurrency);
        await new Promise((resolve) => setTimeout(resolve, 20));
        currentConcurrency--;
        return value;
      };

      const factories = [createDelayedFactory(1), createDelayedFactory(2), createDelayedFactory(3)];

      await runWithConcurrency(factories, 10);

      // All 3 should run concurrently since maxConcurrent (10) >= factories.length (3)
      expect(maxObservedConcurrency).toBe(3);
    });

    it('processes with maxConcurrent=1 (sequential)', async () => {
      const executionOrder: number[] = [];

      const createFactory = (value: number) => async () => {
        executionOrder.push(value);
        await new Promise((resolve) => setTimeout(resolve, 10));
        return value;
      };

      const factories = [createFactory(1), createFactory(2), createFactory(3)];

      const results = await runWithConcurrency(factories, 1);

      expect(results).toHaveLength(3);
      // With maxConcurrent=1, execution should be sequential
      expect(executionOrder).toEqual([1, 2, 3]);
    });
  });

  describe('factory lazy evaluation', () => {
    it('does not call factories until slot is available', async () => {
      const factoryCallTimes: number[] = [];
      const startTime = Date.now();

      const createSlowFactory = (value: number, delayMs: number) => () => {
        factoryCallTimes.push(Date.now() - startTime);
        return new Promise<number>((resolve) =>
          setTimeout(() => {
            resolve(value);
          }, delayMs),
        );
      };

      // First two factories take 100ms each, third one should start ~100ms later
      const factories = [
        createSlowFactory(1, 100),
        createSlowFactory(2, 100),
        createSlowFactory(3, 10), // Quick once it starts
      ];

      await runWithConcurrency(factories, 2);

      // First two factories should be called immediately (within ~5ms)
      expect(factoryCallTimes[0]).toBeLessThan(20);
      expect(factoryCallTimes[1]).toBeLessThan(20);

      // Third factory should be called after one of the first two finishes (~100ms)
      expect(factoryCallTimes[2]).toBeGreaterThanOrEqual(80);
    });
  });

  describe('error isolation', () => {
    it('continues processing after a factory throws', async () => {
      const factories = [
        () => Promise.resolve('first'),
        () => {
          throw new Error('Sync error');
        },
        () => Promise.resolve('third'),
      ];

      const results = await runWithConcurrency(factories, 2);

      expect(results).toHaveLength(3);
      expect(results[0]).toEqual({ status: 'fulfilled', value: 'first' });
      expect(results[1]?.status).toBe('rejected');
      expect((results[1] as PromiseRejectedResult).reason).toBeInstanceOf(Error);
      expect(results[2]).toEqual({ status: 'fulfilled', value: 'third' });
    });

    it('handles mixed sync throws and async rejections', async () => {
      const factories = [
        () => Promise.resolve('a'),
        () => {
          throw new Error('sync');
        },
        () => Promise.reject(new Error('async')),
        () => Promise.resolve('d'),
      ];

      const results = await runWithConcurrency(factories, 10);

      expect(results[0]).toEqual({ status: 'fulfilled', value: 'a' });
      expect(results[1]?.status).toBe('rejected');
      expect(results[2]?.status).toBe('rejected');
      expect(results[3]).toEqual({ status: 'fulfilled', value: 'd' });
    });
  });

  describe('edge cases', () => {
    it('handles single factory', async () => {
      const results = await runWithConcurrency([() => Promise.resolve(42)], 5);
      expect(results).toEqual([{ status: 'fulfilled', value: 42 }]);
    });

    it('handles large number of factories', async () => {
      const count = 100;
      const factories = Array.from({ length: count }, (_, i) => () => Promise.resolve(i));

      const results = await runWithConcurrency(factories, 10);

      expect(results).toHaveLength(count);
      for (let i = 0; i < count; i++) {
        expect(results[i]).toEqual({ status: 'fulfilled', value: i });
      }
    });

    it('maintains result order with varying completion times', async () => {
      // Factory with index 0 completes last, index 2 completes first
      const factories = [
        () =>
          new Promise<string>((resolve) =>
            setTimeout(() => {
              resolve('slow');
            }, 60),
          ),
        () =>
          new Promise<string>((resolve) =>
            setTimeout(() => {
              resolve('medium');
            }, 30),
          ),
        () =>
          new Promise<string>((resolve) =>
            setTimeout(() => {
              resolve('fast');
            }, 10),
          ),
      ];

      const results = await runWithConcurrency(factories, 10);

      // Despite different completion times, results should be in original order
      expect(results[0]).toEqual({ status: 'fulfilled', value: 'slow' });
      expect(results[1]).toEqual({ status: 'fulfilled', value: 'medium' });
      expect(results[2]).toEqual({ status: 'fulfilled', value: 'fast' });
    });
  });
});
