import { describe, expect, it } from 'vitest';

import { parseForm } from '../../../src/engine/parse.js';
import { fillForm, type TurnProgress } from '../../../src/harness/programmaticFill.js';
import { createMockAgent } from '../../../src/harness/mockAgent.js';

// Simple test form
const SIMPLE_FORM = `---
markform:
  spec: MF/0.1
  roles:
    - user
    - agent
---

{% form id="test_form" title="Test Form" %}

{% group id="basic" title="Basic Fields" %}

{% field kind="string" id="name" label="Name" role="user" required=true %}{% /field %}

{% field kind="number" id="age" label="Age" role="agent" required=true %}{% /field %}

{% field kind="string" id="notes" label="Notes" role="agent" %}{% /field %}

{% /group %}

{% /form %}
`;

// Completed mock form (same schema, all fields filled) - uses code fence format
const COMPLETED_FORM = `---
markform:
  spec: MF/0.1
  roles:
    - user
    - agent
---

{% form id="test_form" title="Test Form" %}

{% group id="basic" title="Basic Fields" %}

{% field kind="string" id="name" label="Name" role="user" required=true %}
\`\`\`value
John Doe
\`\`\`
{% /field %}

{% field kind="number" id="age" label="Age" role="agent" required=true %}
\`\`\`value
30
\`\`\`
{% /field %}

{% field kind="string" id="notes" label="Notes" role="agent" %}
\`\`\`value
Test notes
\`\`\`
{% /field %}

{% /group %}

{% /form %}
`;

describe('fillForm', () => {
  describe('basic functionality (with MockAgent)', () => {
    it('fills form with minimal options', async () => {
      const completedForm = parseForm(COMPLETED_FORM);
      const mockAgent = createMockAgent(completedForm);

      const result = await fillForm({
        form: SIMPLE_FORM,
        model: 'mock/model', // ignored when _testAgent provided
        enableWebSearch: false,
        captureWireFormat: false,
        inputContext: { name: 'John Doe' }, // Pre-fill user field
        targetRoles: ['user', 'agent'], // Target both roles
        _testAgent: mockAgent,
      });

      expect(result.status.ok).toBe(true);
      expect(result.turns).toBeGreaterThan(0);
      expect(result.totalPatches).toBeGreaterThan(0);
    });

    it('returns status.ok: true when form completes', async () => {
      const completedForm = parseForm(COMPLETED_FORM);
      const mockAgent = createMockAgent(completedForm);

      const result = await fillForm({
        form: SIMPLE_FORM,
        model: 'mock/model',
        enableWebSearch: false,
        captureWireFormat: false,
        inputContext: { name: 'John Doe' },
        targetRoles: ['user', 'agent'],
        _testAgent: mockAgent,
      });

      expect(result.status.ok).toBe(true);
    });

    it('returns correct values map keyed by field ID', async () => {
      const completedForm = parseForm(COMPLETED_FORM);
      const mockAgent = createMockAgent(completedForm);

      const result = await fillForm({
        form: SIMPLE_FORM,
        model: 'mock/model',
        enableWebSearch: false,
        captureWireFormat: false,
        inputContext: { name: 'John Doe' },
        targetRoles: ['user', 'agent'],
        _testAgent: mockAgent,
      });

      expect(result.values).toBeDefined();
      expect(result.values.name).toBeDefined();
      expect(result.values.age).toBeDefined();
    });

    it('returns serialized markdown', async () => {
      const completedForm = parseForm(COMPLETED_FORM);
      const mockAgent = createMockAgent(completedForm);

      const result = await fillForm({
        form: SIMPLE_FORM,
        model: 'mock/model',
        enableWebSearch: false,
        captureWireFormat: false,
        inputContext: { name: 'John Doe' },
        _testAgent: mockAgent,
      });

      expect(result.markdown).toBeDefined();
      expect(result.markdown).toContain('{% form');
      expect(result.markdown).toContain('test_form');
    });

    it('returns turns count', async () => {
      const completedForm = parseForm(COMPLETED_FORM);
      const mockAgent = createMockAgent(completedForm);

      const result = await fillForm({
        form: SIMPLE_FORM,
        model: 'mock/model',
        enableWebSearch: false,
        captureWireFormat: false,
        inputContext: { name: 'John Doe' },
        _testAgent: mockAgent,
      });

      expect(typeof result.turns).toBe('number');
      expect(result.turns).toBeGreaterThanOrEqual(0);
    });
  });

  describe('input context', () => {
    it('pre-fills fields from inputContext before agent runs', async () => {
      const completedForm = parseForm(COMPLETED_FORM);
      const mockAgent = createMockAgent(completedForm);

      const result = await fillForm({
        form: SIMPLE_FORM,
        model: 'mock/model',
        enableWebSearch: false,
        captureWireFormat: false,
        inputContext: { name: 'Pre-filled Name' },
        targetRoles: ['user', 'agent'],
        _testAgent: mockAgent,
      });

      expect(result.status.ok).toBe(true);
      expect(result.values.name).toEqual({ kind: 'string', value: 'Pre-filled Name' });
    });

    it('fails fast with error on invalid field ID', async () => {
      const completedForm = parseForm(COMPLETED_FORM);
      const mockAgent = createMockAgent(completedForm);

      const result = await fillForm({
        form: SIMPLE_FORM,
        model: 'mock/model',
        enableWebSearch: false,
        captureWireFormat: false,
        inputContext: { nonexistent: 'value' },
        _testAgent: mockAgent,
      });

      expect(result.status.ok).toBe(false);
      if (!result.status.ok) {
        expect(result.status.reason).toBe('error');
        expect(result.status.message).toContain('not found');
      }
    });

    it('fails fast on incompatible type', async () => {
      const completedForm = parseForm(COMPLETED_FORM);
      const mockAgent = createMockAgent(completedForm);

      const result = await fillForm({
        form: SIMPLE_FORM,
        model: 'mock/model',
        enableWebSearch: false,
        captureWireFormat: false,
        inputContext: { name: { complex: 'object' } },
        _testAgent: mockAgent,
      });

      expect(result.status.ok).toBe(false);
      if (!result.status.ok) {
        expect(result.status.reason).toBe('error');
        expect(result.status.message).toContain('Cannot coerce');
      }
    });

    it('includes inputContextWarnings for coerced values', async () => {
      const completedForm = parseForm(COMPLETED_FORM);
      const mockAgent = createMockAgent(completedForm);

      const result = await fillForm({
        form: SIMPLE_FORM,
        model: 'mock/model',
        enableWebSearch: false,
        captureWireFormat: false,
        inputContext: {
          name: 123, // number will be coerced to string with warning
        },
        targetRoles: ['user', 'agent'],
        _testAgent: mockAgent,
      });

      expect(result.status.ok).toBe(true);
      expect(result.inputContextWarnings).toBeDefined();
      expect(result.inputContextWarnings?.length).toBeGreaterThan(0);
      expect(result.inputContextWarnings?.[0]).toContain('Coerced');
    });
  });

  describe('progress callback', () => {
    it('callbacks.onTurnStart called before each turn', async () => {
      const completedForm = parseForm(COMPLETED_FORM);
      const mockAgent = createMockAgent(completedForm);

      const turnStarts: { turnNumber: number; issuesCount: number }[] = [];

      await fillForm({
        form: SIMPLE_FORM,
        model: 'mock/model',
        enableWebSearch: false,
        captureWireFormat: false,
        inputContext: { name: 'John' },
        _testAgent: mockAgent,
        callbacks: {
          onTurnStart: (turn) => {
            turnStarts.push({ ...turn });
          },
        },
      });

      expect(turnStarts.length).toBeGreaterThan(0);
      expect(turnStarts[0]?.turnNumber).toBe(1);
      expect(typeof turnStarts[0]?.issuesCount).toBe('number');
    });

    it('callbacks.onTurnComplete called after each turn', async () => {
      const completedForm = parseForm(COMPLETED_FORM);
      const mockAgent = createMockAgent(completedForm);

      const progressUpdates: TurnProgress[] = [];

      await fillForm({
        form: SIMPLE_FORM,
        model: 'mock/model',
        enableWebSearch: false,
        captureWireFormat: false,
        inputContext: { name: 'John' },
        _testAgent: mockAgent,
        callbacks: {
          onTurnComplete: (progress) => {
            progressUpdates.push({ ...progress });
          },
        },
      });

      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[0]?.turnNumber).toBe(1);
    });

    it('TurnProgress contains correct values', async () => {
      const completedForm = parseForm(COMPLETED_FORM);
      const mockAgent = createMockAgent(completedForm);

      let lastProgress: TurnProgress | undefined;

      await fillForm({
        form: SIMPLE_FORM,
        model: 'mock/model',
        enableWebSearch: false,
        captureWireFormat: false,
        inputContext: { name: 'John' },
        _testAgent: mockAgent,
        callbacks: {
          onTurnComplete: (progress) => {
            lastProgress = progress;
          },
        },
      });

      expect(lastProgress).toBeDefined();
      expect(typeof lastProgress?.turnNumber).toBe('number');
      expect(typeof lastProgress?.issuesShown).toBe('number');
      expect(typeof lastProgress?.patchesApplied).toBe('number');
      expect(typeof lastProgress?.requiredIssuesRemaining).toBe('number');
      expect(typeof lastProgress?.isComplete).toBe('boolean');
    });

    it("callback errors don't abort fill", async () => {
      const completedForm = parseForm(COMPLETED_FORM);
      const mockAgent = createMockAgent(completedForm);

      const result = await fillForm({
        form: SIMPLE_FORM,
        model: 'mock/model',
        enableWebSearch: false,
        captureWireFormat: false,
        inputContext: { name: 'John' },
        targetRoles: ['user', 'agent'],
        _testAgent: mockAgent,
        callbacks: {
          onTurnComplete: () => {
            throw new Error('Callback error');
          },
        },
      });

      // Should still complete despite callback error
      expect(result.status.ok).toBe(true);
    });

    it('onTurnStart and onTurnComplete both called in order', async () => {
      const completedForm = parseForm(COMPLETED_FORM);
      const mockAgent = createMockAgent(completedForm);

      const events: string[] = [];

      await fillForm({
        form: SIMPLE_FORM,
        model: 'mock/model',
        enableWebSearch: false,
        captureWireFormat: false,
        inputContext: { name: 'John' },
        _testAgent: mockAgent,
        callbacks: {
          onTurnStart: ({ turnNumber }) => {
            events.push(`start:${turnNumber}`);
          },
          onTurnComplete: ({ turnNumber }) => {
            events.push(`complete:${turnNumber}`);
          },
        },
      });

      // Verify order: start before complete for each turn
      expect(events.length).toBeGreaterThanOrEqual(2);
      expect(events[0]).toBe('start:1');
      expect(events[1]).toBe('complete:1');
    });

    it('works with partial callbacks (only onTurnStart)', async () => {
      const completedForm = parseForm(COMPLETED_FORM);
      const mockAgent = createMockAgent(completedForm);

      const turnStarts: number[] = [];

      const result = await fillForm({
        form: SIMPLE_FORM,
        model: 'mock/model',
        enableWebSearch: false,
        captureWireFormat: false,
        inputContext: { name: 'John' },
        _testAgent: mockAgent,
        callbacks: {
          onTurnStart: ({ turnNumber }) => {
            turnStarts.push(turnNumber);
          },
          // onTurnComplete not provided
        },
      });

      expect(result.status.ok).toBe(true);
      expect(turnStarts.length).toBeGreaterThan(0);
    });

    it('works with no callbacks (undefined)', async () => {
      const completedForm = parseForm(COMPLETED_FORM);
      const mockAgent = createMockAgent(completedForm);

      const result = await fillForm({
        form: SIMPLE_FORM,
        model: 'mock/model',
        enableWebSearch: false,
        captureWireFormat: false,
        inputContext: { name: 'John' },
        _testAgent: mockAgent,
        // No callbacks option at all
      });

      expect(result.status.ok).toBe(true);
    });
  });

  describe('cancellation', () => {
    it('signal.abort() returns partial result with reason cancelled', async () => {
      const completedForm = parseForm(COMPLETED_FORM);
      const mockAgent = createMockAgent(completedForm);

      const controller = new AbortController();
      controller.abort(); // Abort immediately

      const result = await fillForm({
        form: SIMPLE_FORM,
        model: 'mock/model',
        enableWebSearch: false,
        captureWireFormat: false,
        inputContext: { name: 'John' },
        _testAgent: mockAgent,
        signal: controller.signal,
      });

      expect(result.status.ok).toBe(false);
      if (!result.status.ok) {
        expect(result.status.reason).toBe('cancelled');
      }
    });

    it('partial values and markdown are returned on cancellation', async () => {
      const completedForm = parseForm(COMPLETED_FORM);
      const mockAgent = createMockAgent(completedForm);

      const controller = new AbortController();
      controller.abort();

      const result = await fillForm({
        form: SIMPLE_FORM,
        model: 'mock/model',
        enableWebSearch: false,
        captureWireFormat: false,
        inputContext: { name: 'Pre-filled' },
        _testAgent: mockAgent,
        signal: controller.signal,
      });

      // Should have the pre-filled value
      expect(result.values).toBeDefined();
      expect(result.markdown).toBeDefined();
    });

    it('cancellation during agent call prevents patches from being applied', async () => {
      const controller = new AbortController();
      let fillFormToolCalled = false;

      // Create a mock agent that aborts during fillFormTool
      const cancellingAgent = {
        fillFormTool() {
          fillFormToolCalled = true;
          // Simulate abort happening during the LLM call
          controller.abort();
          return Promise.resolve({
            patches: [{ op: 'set_number' as const, fieldId: 'age', value: 42 }],
          });
        },
      };

      const result = await fillForm({
        form: SIMPLE_FORM,
        model: 'mock/model',
        enableWebSearch: false,
        captureWireFormat: false,
        inputContext: { name: 'John' },
        _testAgent: cancellingAgent,
        signal: controller.signal,
      });

      // Agent was called
      expect(fillFormToolCalled).toBe(true);

      // But result should be cancelled, not successful
      expect(result.status.ok).toBe(false);
      if (!result.status.ok) {
        expect(result.status.reason).toBe('cancelled');
      }

      // The patch should NOT have been applied - age remains unfilled (null)
      const ageValue = result.values.age;
      if (ageValue?.kind === 'number') {
        expect(ageValue.value).toBeNull();
      }
    });
  });

  describe('max turns', () => {
    it('returns status.ok: false with reason max_turns when limit reached', async () => {
      // Create a mock agent that never completes
      const emptyMockAgent = {
        fillFormTool() {
          return Promise.resolve({ patches: [] }); // Never generates patches
        },
      };

      const result = await fillForm({
        form: SIMPLE_FORM,
        model: 'mock/model',
        enableWebSearch: false,
        captureWireFormat: false,
        maxTurnsTotal: 2,
        _testAgent: emptyMockAgent,
      });

      expect(result.status.ok).toBe(false);
      if (!result.status.ok) {
        expect(result.status.reason).toBe('max_turns');
        expect(result.status.message).toContain('2');
      }
    });

    it('remainingIssues populated when not complete', async () => {
      const emptyMockAgent = {
        fillFormTool() {
          return Promise.resolve({ patches: [] });
        },
      };

      const result = await fillForm({
        form: SIMPLE_FORM,
        model: 'mock/model',
        enableWebSearch: false,
        captureWireFormat: false,
        maxTurnsTotal: 1,
        _testAgent: emptyMockAgent,
      });

      expect(result.status.ok).toBe(false);
      expect(result.remainingIssues).toBeDefined();
      expect(result.remainingIssues?.length).toBeGreaterThan(0);
    });
  });

  describe('form parse error', () => {
    it('returns appropriate error for invalid form', async () => {
      const result = await fillForm({
        form: 'not a valid form',
        model: 'mock/model',
        enableWebSearch: false,
        captureWireFormat: false,
      });

      expect(result.status.ok).toBe(false);
      if (!result.status.ok) {
        expect(result.status.reason).toBe('error');
        expect(result.status.message).toContain('Form parse error');
      }
    });
  });

  describe('model resolution error', () => {
    it('returns appropriate error for invalid model', async () => {
      const result = await fillForm({
        form: SIMPLE_FORM,
        model: 'invalid/model',
        enableWebSearch: false,
        captureWireFormat: false,
      });

      expect(result.status.ok).toBe(false);
      if (!result.status.ok) {
        expect(result.status.reason).toBe('error');
        expect(result.status.message).toContain('Model resolution error');
      }
    });
  });

  describe('fill modes', () => {
    it('fillMode: continue skips already-filled fields', async () => {
      // Start with a form that has name pre-filled (using code fence format)
      const formWithName = SIMPLE_FORM.replace(
        '{% field kind="string" id="name" label="Name" role="user" required=true %}{% /field %}',
        `{% field kind="string" id="name" label="Name" role="user" required=true %}
\`\`\`value
Original Name
\`\`\`
{% /field %}`,
      );

      const completedForm = parseForm(COMPLETED_FORM);
      const mockAgent = createMockAgent(completedForm);

      const result = await fillForm({
        form: formWithName,
        model: 'mock/model',
        enableWebSearch: false,
        captureWireFormat: false,
        fillMode: 'continue',
        targetRoles: ['user', 'agent'],
        _testAgent: mockAgent,
      });

      expect(result.status.ok).toBe(true);
      // Name should still be "Original Name", not replaced by mock
      expect(result.values.name).toEqual({ kind: 'string', value: 'Original Name' });
    });
  });

  describe('resumable fills', () => {
    it('stops after maxTurnsThisCall and returns batch_limit', async () => {
      const completedForm = parseForm(COMPLETED_FORM);
      const mockAgent = createMockAgent(completedForm);

      // Use maxIssuesPerTurn: 1 to force one field per turn, ensuring we need multiple turns
      const result = await fillForm({
        form: SIMPLE_FORM,
        model: 'mock/model',
        enableWebSearch: false,
        captureWireFormat: false,
        inputContext: { name: 'John Doe' },
        targetRoles: ['user', 'agent'],
        maxTurnsThisCall: 1,
        maxIssuesPerTurn: 1, // Force one field per turn
        _testAgent: mockAgent,
      });

      expect(result.status.ok).toBe(false);
      if (!result.status.ok) {
        expect(result.status.reason).toBe('batch_limit');
        expect(result.status.message).toContain('1');
      }
      expect(result.turns).toBe(1);
      // Should have partial progress - markdown should be parseable
      expect(result.markdown).toContain('{% form');
    });

    it('resumes from checkpoint and completes', async () => {
      const completedForm = parseForm(COMPLETED_FORM);
      const mockAgent = createMockAgent(completedForm);

      // First call - checkpoint after 1 turn
      // Use maxIssuesPerTurn: 1 to force one field per turn
      const r1 = await fillForm({
        form: SIMPLE_FORM,
        model: 'mock/model',
        enableWebSearch: false,
        captureWireFormat: false,
        inputContext: { name: 'John Doe' },
        targetRoles: ['user', 'agent'],
        maxTurnsThisCall: 1,
        maxIssuesPerTurn: 1, // Force one field per turn
        _testAgent: mockAgent,
      });

      expect(r1.status.ok).toBe(false);
      if (!r1.status.ok) {
        expect(r1.status.reason).toBe('batch_limit');
      }

      // Resume using r1.markdown as checkpoint
      const r2 = await fillForm({
        form: r1.markdown,
        model: 'mock/model',
        enableWebSearch: false,
        captureWireFormat: false,
        targetRoles: ['user', 'agent'],
        startingTurnNumber: r1.turns,
        _testAgent: mockAgent,
      });

      expect(r2.status.ok).toBe(true);
      // Total turns should include the starting turn number
      expect(r2.turns).toBeGreaterThan(r1.turns);
      // Values should be complete
      expect(r2.values.name).toBeDefined();
      expect(r2.values.age).toBeDefined();
    });

    it('returns ok immediately when form already complete', async () => {
      const completedForm = parseForm(COMPLETED_FORM);
      const mockAgent = createMockAgent(completedForm);

      // Use a completed form as input
      const result = await fillForm({
        form: COMPLETED_FORM,
        model: 'mock/model',
        enableWebSearch: false,
        captureWireFormat: false,
        targetRoles: ['user', 'agent'],
        maxTurnsThisCall: 5,
        _testAgent: mockAgent,
      });

      expect(result.status.ok).toBe(true);
      // No turns should be executed since form is already complete
      expect(result.turns).toBe(0);
    });

    it('startingTurnNumber adjusts callback turn numbers', async () => {
      const completedForm = parseForm(COMPLETED_FORM);
      const mockAgent = createMockAgent(completedForm);

      const turnNumbers: number[] = [];

      await fillForm({
        form: SIMPLE_FORM,
        model: 'mock/model',
        enableWebSearch: false,
        captureWireFormat: false,
        inputContext: { name: 'John Doe' },
        targetRoles: ['user', 'agent'],
        startingTurnNumber: 10, // Simulating resume from turn 10
        _testAgent: mockAgent,
        callbacks: {
          onTurnStart: ({ turnNumber }) => {
            turnNumbers.push(turnNumber);
          },
        },
      });

      // Turn numbers should start from 11 (startingTurnNumber + 1)
      expect(turnNumbers[0]).toBe(11);
    });
  });
});
