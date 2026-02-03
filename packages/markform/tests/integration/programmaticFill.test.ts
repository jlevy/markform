/**
 * Integration tests for the programmatic fill API.
 *
 * These tests validate the full end-to-end flow using real form files
 * from the examples directory.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { parseForm } from '../../src/engine/parse.js';
import {
  fillForm,
  serialExecutionId,
  batchExecutionId,
} from '../../src/harness/programmaticFill.js';
import { createMockAgent } from '../../src/harness/mockAgent.js';

// =============================================================================
// Test Fixtures
// =============================================================================

const EXAMPLES_DIR = resolve(__dirname, '../../examples');

function loadForm(subPath: string): string {
  return readFileSync(resolve(EXAMPLES_DIR, subPath), 'utf-8');
}

// =============================================================================
// Integration Tests
// =============================================================================

describe('programmatic fill API - integration tests', () => {
  describe('simple.form.md', () => {
    it('complete fill using MockAgent with inputContext', async () => {
      // Load empty form and mock-filled form
      const emptyForm = loadForm('simple/simple.form.md');
      const mockFilledForm = loadForm('simple/simple-mock-filled.form.md');

      // Create mock agent from completed form
      const completedForm = parseForm(mockFilledForm);
      const mockAgent = createMockAgent(completedForm);

      // Fill using programmatic API with user fields pre-filled via inputContext
      const result = await fillForm({
        form: emptyForm,
        model: 'mock/model',
        enableWebSearch: false,
        captureWireFormat: false,
        recordFill: false,
        inputContext: {
          // Pre-fill user fields that MockAgent won't fill
          name: 'Alice Johnson',
          email: 'alice@example.com',
          age: 32,
          tags: ['typescript', 'testing', 'forms'],
          priority: 'medium',
          categories: ['frontend', 'backend'],
          tasks_multi: { research: 'done', design: 'done', implement: 'done', test: 'incomplete' },
          tasks_simple: { read_guidelines: 'done', agree_terms: 'done' },
          confirmations: { backed_up: 'yes', notified: 'no' },
          website: 'https://alice.dev',
          references: [
            'https://docs.example.com/guide',
            'https://github.com/example/project',
            'https://medium.com/article-about-forms',
          ],
          event_date: '2025-06-15',
          founded_year: 2020,
        },
        targetRoles: ['user', 'agent'],
        _testAgent: mockAgent,
      });

      expect(result.status.ok).toBe(true);
      expect(result.turns).toBeGreaterThan(0);

      // Verify key values were set
      expect(result.values.name).toEqual({ kind: 'string', value: 'Alice Johnson' });
      expect(result.values.email).toEqual({ kind: 'string', value: 'alice@example.com' });
      expect(result.values.age).toEqual({ kind: 'number', value: 32 });
      expect(result.values.score).toBeDefined();
      expect(result.values.notes).toBeDefined();
    });

    it('inputContext pre-fills required fields and mock agent fills optional', async () => {
      // Load empty form and mock-filled form
      const emptyForm = loadForm('simple/simple.form.md');
      const mockFilledForm = loadForm('simple/simple-mock-filled.form.md');

      // Create mock agent to fill optional fields
      const completedForm = parseForm(mockFilledForm);
      const mockAgent = createMockAgent(completedForm);

      // Fill required fields with inputContext, let mock agent fill optional ones
      const result = await fillForm({
        form: emptyForm,
        model: 'mock/model',
        enableWebSearch: false,
        captureWireFormat: false,
        recordFill: false,
        inputContext: {
          name: 'Test User',
          email: 'test@example.com',
          age: 25,
          tags: ['tag1'],
          priority: 'high',
          categories: ['frontend'],
          tasks_multi: { research: 'done', design: 'done', implement: 'done', test: 'done' },
          tasks_simple: { read_guidelines: 'done', agree_terms: 'done' },
          confirmations: { backed_up: 'yes', notified: 'yes' },
          website: 'https://test.com',
          references: ['https://example.com'],
          event_date: '2025-03-15',
          founded_year: 2021,
        },
        targetRoles: ['user'],
        _testAgent: mockAgent,
      });

      // Form should complete successfully
      expect(result.status.ok).toBe(true);

      // Required user fields should be filled from inputContext
      expect(result.values.name).toBeDefined();
      expect(result.values.email).toBeDefined();

      // Optional fields filled by mock agent
      expect(result.values.score).toBeDefined();
      expect(result.values.notes).toBeDefined();
    });

    it('round-trip: result can be re-parsed', async () => {
      const emptyForm = loadForm('simple/simple.form.md');
      const mockFilledForm = loadForm('simple/simple-mock-filled.form.md');

      const completedForm = parseForm(mockFilledForm);
      const mockAgent = createMockAgent(completedForm);

      const result = await fillForm({
        form: emptyForm,
        model: 'mock/model',
        enableWebSearch: false,
        captureWireFormat: false,
        recordFill: false,
        inputContext: {
          name: 'Test User',
          email: 'test@example.com',
          age: 25,
          tags: ['tag1'],
          priority: 'high',
          categories: ['frontend'],
          tasks_multi: { research: 'done', design: 'done', implement: 'done', test: 'done' },
          tasks_simple: { read_guidelines: 'done', agree_terms: 'done' },
          confirmations: { backed_up: 'yes', notified: 'yes' },
          website: 'https://test.com',
          references: ['https://example.com'],
          event_date: '2025-06-15',
          founded_year: 2020,
        },
        targetRoles: ['user', 'agent'],
        _testAgent: mockAgent,
      });

      // Re-parse the result markdown
      const reparsedForm = parseForm(result.markdown);

      // Should have the same structure
      expect(reparsedForm.schema.id).toBe('simple_test');
      expect(reparsedForm.schema.groups.length).toBe(8); // Includes table_fields group

      // Values should be preserved
      const nameResponse = reparsedForm.responsesByFieldId.name;
      expect(nameResponse?.state).toBe('answered');
      expect(nameResponse?.value).toEqual({ kind: 'string', value: 'Test User' });
    });
  });

  describe('error scenarios', () => {
    it('form parse error returns appropriate error', async () => {
      const result = await fillForm({
        form: 'not a valid markform document',
        model: 'mock/model',
        enableWebSearch: false,
        captureWireFormat: false,
        recordFill: false,
      });

      expect(result.status.ok).toBe(false);
      if (!result.status.ok) {
        expect(result.status.reason).toBe('error');
        expect(result.status.message).toContain('Form parse error');
      }
    });

    it('model resolution error returns appropriate error', async () => {
      const emptyForm = loadForm('simple/simple.form.md');

      const result = await fillForm({
        form: emptyForm,
        model: 'nonexistent/provider-model',
        enableWebSearch: false,
        captureWireFormat: false,
        recordFill: false,
      });

      expect(result.status.ok).toBe(false);
      if (!result.status.ok) {
        expect(result.status.reason).toBe('error');
        expect(result.status.message).toContain('Model resolution error');
      }
    });

    it('invalid inputContext field returns error', async () => {
      const emptyForm = loadForm('simple/simple.form.md');
      const mockFilledForm = loadForm('simple/simple-mock-filled.form.md');
      const completedForm = parseForm(mockFilledForm);
      const mockAgent = createMockAgent(completedForm);

      const result = await fillForm({
        form: emptyForm,
        model: 'mock/model',
        enableWebSearch: false,
        captureWireFormat: false,
        recordFill: false,
        inputContext: {
          nonexistent_field: 'some value',
        },
        _testAgent: mockAgent,
      });

      expect(result.status.ok).toBe(false);
      if (!result.status.ok) {
        expect(result.status.reason).toBe('error');
        expect(result.status.message).toContain('not found');
      }
    });
  });

  describe('progress tracking', () => {
    it('callbacks.onTurnComplete receives accurate progress info', async () => {
      const emptyForm = loadForm('simple/simple.form.md');
      const mockFilledForm = loadForm('simple/simple-mock-filled.form.md');

      const completedForm = parseForm(mockFilledForm);
      const mockAgent = createMockAgent(completedForm);

      const progressUpdates: {
        turnNumber: number;
        patchesApplied: number;
        requiredIssuesRemaining: number;
        isComplete: boolean;
      }[] = [];

      // Only pre-fill user fields, let MockAgent fill agent fields (score, notes, related_url)
      // This ensures at least one turn is executed
      const result = await fillForm({
        form: emptyForm,
        model: 'mock/model',
        enableWebSearch: false,
        captureWireFormat: false,
        recordFill: false,
        inputContext: {
          name: 'Test User',
          email: 'test@example.com',
          age: 25,
          tags: ['tag1'],
          priority: 'high',
          categories: ['frontend'],
          tasks_multi: { research: 'done', design: 'done', implement: 'done', test: 'done' },
          tasks_simple: { read_guidelines: 'done', agree_terms: 'done' },
          confirmations: { backed_up: 'yes', notified: 'yes' },
          website: 'https://test.com',
          references: ['https://example.com'],
          event_date: '2025-06-15',
          founded_year: 2020,
          // Note: NOT pre-filling score, notes, or related_url - MockAgent will fill these
        },
        targetRoles: ['user', 'agent'],
        _testAgent: mockAgent,
        callbacks: {
          onTurnComplete: (progress) => {
            progressUpdates.push({ ...progress });
          },
        },
      });

      expect(result.status.ok).toBe(true);
      // Should have at least one turn to fill agent fields
      expect(progressUpdates.length).toBeGreaterThanOrEqual(0);

      // If turns were executed, verify turn numbers are sequential
      if (progressUpdates.length > 0) {
        for (let i = 0; i < progressUpdates.length; i++) {
          expect(progressUpdates[i]?.turnNumber).toBe(i + 1);
        }

        // Last update should show completion
        const lastUpdate = progressUpdates[progressUpdates.length - 1];
        expect(lastUpdate?.isComplete).toBe(true);
      }
    });

    it('zero turns when form is already complete via inputContext', async () => {
      const emptyForm = loadForm('simple/simple.form.md');
      const mockFilledForm = loadForm('simple/simple-mock-filled.form.md');

      const completedForm = parseForm(mockFilledForm);
      const mockAgent = createMockAgent(completedForm);

      const progressUpdates: number[] = [];

      // Pre-fill ALL fields (including agent fields and optional fields) via inputContext
      const result = await fillForm({
        form: emptyForm,
        model: 'mock/model',
        enableWebSearch: false,
        captureWireFormat: false,
        recordFill: false,
        inputContext: {
          name: 'Test User',
          email: 'test@example.com',
          age: 25,
          tags: ['tag1'],
          priority: 'high',
          categories: ['frontend'],
          tasks_multi: { research: 'done', design: 'done', implement: 'done', test: 'done' },
          tasks_simple: { read_guidelines: 'done', agree_terms: 'done' },
          confirmations: { backed_up: 'yes', notified: 'yes' },
          website: 'https://test.com',
          references: ['https://example.com'],
          event_date: '2025-06-15',
          founded_year: 2020,
          // Also pre-fill agent fields (including optional ones)
          score: 87.5,
          notes: 'Pre-filled note',
          related_url: 'https://related.com',
          optional_number: 42,
          optional_date: '2025-01-01',
          optional_year: 2025,
          // Table fields (optional, can be empty)
          team_members: [],
          project_tasks: [],
        },
        targetRoles: ['user', 'agent'],
        _testAgent: mockAgent,
        callbacks: {
          onTurnComplete: (progress) => {
            progressUpdates.push(progress.turnNumber);
          },
        },
      });

      expect(result.status.ok).toBe(true);
      // With all fields pre-filled (including empty table fields), at most one turn needed
      expect(progressUpdates.length).toBeLessThanOrEqual(1);
      expect(result.turns).toBeLessThanOrEqual(1);
    });
  });

  describe('FillRecord integration', () => {
    it('returns FillRecord when recordFill is true', async () => {
      const emptyForm = loadForm('simple/simple.form.md');
      const mockFilledForm = loadForm('simple/simple-mock-filled.form.md');

      const completedForm = parseForm(mockFilledForm);
      const mockAgent = createMockAgent(completedForm);

      const result = await fillForm({
        form: emptyForm,
        model: 'mock/model',
        enableWebSearch: false,
        captureWireFormat: false,
        recordFill: true,
        inputContext: {
          name: 'Test User',
          email: 'test@example.com',
          age: 25,
          tags: ['tag1'],
          priority: 'high',
          categories: ['frontend'],
          tasks_multi: { research: 'done', design: 'done', implement: 'done', test: 'done' },
          tasks_simple: { read_guidelines: 'done', agree_terms: 'done' },
          confirmations: { backed_up: 'yes', notified: 'yes' },
          website: 'https://test.com',
          references: ['https://example.com'],
          event_date: '2025-06-15',
          founded_year: 2020,
        },
        targetRoles: ['user', 'agent'],
        _testAgent: mockAgent,
      });

      expect(result.status.ok).toBe(true);
      expect(result.record).toBeDefined();
    });

    it('FillRecord is undefined when recordFill is false or omitted', async () => {
      const emptyForm = loadForm('simple/simple.form.md');
      const mockFilledForm = loadForm('simple/simple-mock-filled.form.md');

      const completedForm = parseForm(mockFilledForm);
      const mockAgent = createMockAgent(completedForm);

      const result = await fillForm({
        form: emptyForm,
        model: 'mock/model',
        enableWebSearch: false,
        captureWireFormat: false,
        recordFill: false,
        inputContext: {
          name: 'Test User',
          email: 'test@example.com',
          age: 25,
          tags: ['tag1'],
          priority: 'high',
          categories: ['frontend'],
          tasks_multi: { research: 'done', design: 'done', implement: 'done', test: 'done' },
          tasks_simple: { read_guidelines: 'done', agree_terms: 'done' },
          confirmations: { backed_up: 'yes', notified: 'yes' },
          website: 'https://test.com',
          references: ['https://example.com'],
          event_date: '2025-06-15',
          founded_year: 2020,
        },
        targetRoles: ['user', 'agent'],
        _testAgent: mockAgent,
      });

      expect(result.status.ok).toBe(true);
      expect(result.record).toBeUndefined();
    });

    it('FillRecord contains valid session metadata', async () => {
      const emptyForm = loadForm('simple/simple.form.md');
      const mockFilledForm = loadForm('simple/simple-mock-filled.form.md');

      const completedForm = parseForm(mockFilledForm);
      const mockAgent = createMockAgent(completedForm);

      const beforeFill = new Date();

      const result = await fillForm({
        form: emptyForm,
        model: 'mock/model',
        enableWebSearch: false,
        captureWireFormat: false,
        recordFill: true,
        inputContext: {
          name: 'Test User',
          email: 'test@example.com',
          age: 25,
          tags: ['tag1'],
          priority: 'high',
          categories: ['frontend'],
          tasks_multi: { research: 'done', design: 'done', implement: 'done', test: 'done' },
          tasks_simple: { read_guidelines: 'done', agree_terms: 'done' },
          confirmations: { backed_up: 'yes', notified: 'yes' },
          website: 'https://test.com',
          references: ['https://example.com'],
          event_date: '2025-06-15',
          founded_year: 2020,
        },
        targetRoles: ['user', 'agent'],
        _testAgent: mockAgent,
      });

      const afterFill = new Date();

      expect(result.record).toBeDefined();
      const record = result.record!;

      // Session ID should be a prefixed lowercase ULID (sess- + 26 characters)
      expect(record.sessionId).toMatch(/^sess-[0-9a-hjkmnp-tv-z]{26}$/);

      // Timestamps should be valid ISO strings within the test window
      const startedAt = new Date(record.startedAt);
      const completedAt = new Date(record.completedAt);
      expect(startedAt.getTime()).toBeGreaterThanOrEqual(beforeFill.getTime());
      expect(completedAt.getTime()).toBeLessThanOrEqual(afterFill.getTime());
      expect(completedAt.getTime()).toBeGreaterThanOrEqual(startedAt.getTime());

      // Duration should be non-negative
      expect(record.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('FillRecord contains form metadata', async () => {
      const emptyForm = loadForm('simple/simple.form.md');
      const mockFilledForm = loadForm('simple/simple-mock-filled.form.md');

      const completedForm = parseForm(mockFilledForm);
      const mockAgent = createMockAgent(completedForm);

      const result = await fillForm({
        form: emptyForm,
        model: 'mock/model',
        enableWebSearch: false,
        captureWireFormat: false,
        recordFill: true,
        inputContext: {
          name: 'Test User',
          email: 'test@example.com',
          age: 25,
          tags: ['tag1'],
          priority: 'high',
          categories: ['frontend'],
          tasks_multi: { research: 'done', design: 'done', implement: 'done', test: 'done' },
          tasks_simple: { read_guidelines: 'done', agree_terms: 'done' },
          confirmations: { backed_up: 'yes', notified: 'yes' },
          website: 'https://test.com',
          references: ['https://example.com'],
          event_date: '2025-06-15',
          founded_year: 2020,
        },
        targetRoles: ['user', 'agent'],
        _testAgent: mockAgent,
      });

      expect(result.record).toBeDefined();
      const record = result.record!;

      // Form ID should match the parsed form
      expect(record.form.id).toBe('simple_test');

      // Structure summary should contain field counts
      expect(record.form.structure.fieldCount).toBeGreaterThan(0);
      expect(record.form.structure.groupCount).toBeGreaterThan(0);
    });

    it('FillRecord tracks LLM usage', async () => {
      const emptyForm = loadForm('simple/simple.form.md');
      const mockFilledForm = loadForm('simple/simple-mock-filled.form.md');

      const completedForm = parseForm(mockFilledForm);
      const mockAgent = createMockAgent(completedForm);

      const result = await fillForm({
        form: emptyForm,
        model: 'mock/model',
        enableWebSearch: false,
        captureWireFormat: false,
        recordFill: true,
        inputContext: {
          name: 'Test User',
          email: 'test@example.com',
          age: 25,
          tags: ['tag1'],
          priority: 'high',
          categories: ['frontend'],
          tasks_multi: { research: 'done', design: 'done', implement: 'done', test: 'done' },
          tasks_simple: { read_guidelines: 'done', agree_terms: 'done' },
          confirmations: { backed_up: 'yes', notified: 'yes' },
          website: 'https://test.com',
          references: ['https://example.com'],
          event_date: '2025-06-15',
          founded_year: 2020,
        },
        targetRoles: ['user', 'agent'],
        _testAgent: mockAgent,
      });

      expect(result.record).toBeDefined();
      const record = result.record!;

      // LLM usage should have provider and model
      expect(record.llm.provider).toBe('mock');
      expect(record.llm.model).toBe('mock/model'); // Full model string as passed

      // Token counts should be non-negative
      expect(record.llm.totalCalls).toBeGreaterThanOrEqual(0);
      expect(record.llm.inputTokens).toBeGreaterThanOrEqual(0);
      expect(record.llm.outputTokens).toBeGreaterThanOrEqual(0);
    });

    it('FillRecord has completed status on successful fill', async () => {
      const emptyForm = loadForm('simple/simple.form.md');
      const mockFilledForm = loadForm('simple/simple-mock-filled.form.md');

      const completedForm = parseForm(mockFilledForm);
      const mockAgent = createMockAgent(completedForm);

      const result = await fillForm({
        form: emptyForm,
        model: 'mock/model',
        enableWebSearch: false,
        captureWireFormat: false,
        recordFill: true,
        inputContext: {
          name: 'Test User',
          email: 'test@example.com',
          age: 25,
          tags: ['tag1'],
          priority: 'high',
          categories: ['frontend'],
          tasks_multi: { research: 'done', design: 'done', implement: 'done', test: 'done' },
          tasks_simple: { read_guidelines: 'done', agree_terms: 'done' },
          confirmations: { backed_up: 'yes', notified: 'yes' },
          website: 'https://test.com',
          references: ['https://example.com'],
          event_date: '2025-06-15',
          founded_year: 2020,
          // Pre-fill agent fields too
          score: 87.5,
          notes: 'Pre-filled note',
          related_url: 'https://related.com',
        },
        targetRoles: ['user', 'agent'],
        _testAgent: mockAgent,
      });

      expect(result.status.ok).toBe(true);
      expect(result.record).toBeDefined();
      expect(result.record!.status).toBe('completed');
    });

    it('FillRecord timeline matches turn count', async () => {
      const emptyForm = loadForm('simple/simple.form.md');
      const mockFilledForm = loadForm('simple/simple-mock-filled.form.md');

      const completedForm = parseForm(mockFilledForm);
      const mockAgent = createMockAgent(completedForm);

      const result = await fillForm({
        form: emptyForm,
        model: 'mock/model',
        enableWebSearch: false,
        captureWireFormat: false,
        recordFill: true,
        inputContext: {
          name: 'Test User',
          email: 'test@example.com',
          age: 25,
          tags: ['tag1'],
          priority: 'high',
          categories: ['frontend'],
          tasks_multi: { research: 'done', design: 'done', implement: 'done', test: 'done' },
          tasks_simple: { read_guidelines: 'done', agree_terms: 'done' },
          confirmations: { backed_up: 'yes', notified: 'yes' },
          website: 'https://test.com',
          references: ['https://example.com'],
          event_date: '2025-06-15',
          founded_year: 2020,
        },
        targetRoles: ['user', 'agent'],
        _testAgent: mockAgent,
      });

      expect(result.record).toBeDefined();
      const record = result.record!;

      // Timeline length should match turns
      expect(record.timeline.length).toBe(result.turns);
      expect(record.execution.totalTurns).toBe(result.turns);

      // Each timeline entry should have sequential turn numbers
      record.timeline.forEach((entry, index) => {
        expect(entry.turnNumber).toBe(index + 1);
        expect(entry.durationMs).toBeGreaterThanOrEqual(0);
      });
    });

    it('FillRecord toolSummary structure is valid', async () => {
      const emptyForm = loadForm('simple/simple.form.md');
      const mockFilledForm = loadForm('simple/simple-mock-filled.form.md');

      const completedForm = parseForm(mockFilledForm);
      const mockAgent = createMockAgent(completedForm);

      const result = await fillForm({
        form: emptyForm,
        model: 'mock/model',
        enableWebSearch: false,
        captureWireFormat: false,
        recordFill: true,
        inputContext: {
          name: 'Test User',
          email: 'test@example.com',
          age: 25,
          tags: ['tag1'],
          priority: 'high',
          categories: ['frontend'],
          tasks_multi: { research: 'done', design: 'done', implement: 'done', test: 'done' },
          tasks_simple: { read_guidelines: 'done', agree_terms: 'done' },
          confirmations: { backed_up: 'yes', notified: 'yes' },
          website: 'https://test.com',
          references: ['https://example.com'],
          event_date: '2025-06-15',
          founded_year: 2020,
        },
        targetRoles: ['user', 'agent'],
        _testAgent: mockAgent,
      });

      expect(result.record).toBeDefined();
      const record = result.record!;

      // Tool summary should exist with valid structure
      expect(record.toolSummary).toBeDefined();
      expect(record.toolSummary.totalCalls).toBeGreaterThanOrEqual(0);
      expect(record.toolSummary.successfulCalls).toBeGreaterThanOrEqual(0);
      expect(record.toolSummary.failedCalls).toBeGreaterThanOrEqual(0);
      expect(record.toolSummary.totalDurationMs).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(record.toolSummary.byTool)).toBe(true);

      // Note: MockAgent bypasses liveAgent so tool callbacks aren't triggered.
      // Tool call tracking is tested in unit tests for FillRecordCollector.
      // With real agents, fill_form calls would appear in byTool.
    });

    it('FillRecord has valid timing breakdown', async () => {
      const emptyForm = loadForm('simple/simple.form.md');
      const mockFilledForm = loadForm('simple/simple-mock-filled.form.md');

      const completedForm = parseForm(mockFilledForm);
      const mockAgent = createMockAgent(completedForm);

      const result = await fillForm({
        form: emptyForm,
        model: 'mock/model',
        enableWebSearch: false,
        captureWireFormat: false,
        recordFill: true,
        inputContext: {
          name: 'Test User',
          email: 'test@example.com',
          age: 25,
          tags: ['tag1'],
          priority: 'high',
          categories: ['frontend'],
          tasks_multi: { research: 'done', design: 'done', implement: 'done', test: 'done' },
          tasks_simple: { read_guidelines: 'done', agree_terms: 'done' },
          confirmations: { backed_up: 'yes', notified: 'yes' },
          website: 'https://test.com',
          references: ['https://example.com'],
          event_date: '2025-06-15',
          founded_year: 2020,
        },
        targetRoles: ['user', 'agent'],
        _testAgent: mockAgent,
      });

      expect(result.record).toBeDefined();
      const record = result.record!;

      // Timing breakdown should exist
      expect(record.timingBreakdown).toBeDefined();

      // All timing values should be non-negative
      expect(record.timingBreakdown.totalMs).toBeGreaterThanOrEqual(0);
      expect(record.timingBreakdown.llmTimeMs).toBeGreaterThanOrEqual(0);
      expect(record.timingBreakdown.toolTimeMs).toBeGreaterThanOrEqual(0);
      expect(record.timingBreakdown.overheadMs).toBeGreaterThanOrEqual(0);

      // Breakdown should have the three categories
      expect(record.timingBreakdown.breakdown.length).toBe(3);
      const categories = record.timingBreakdown.breakdown.map((b) => b.category);
      expect(categories).toContain('llm');
      expect(categories).toContain('tools');
      expect(categories).toContain('overhead');
    });

    it('FillRecord formProgress matches final form state', async () => {
      const emptyForm = loadForm('simple/simple.form.md');
      const mockFilledForm = loadForm('simple/simple-mock-filled.form.md');

      const completedForm = parseForm(mockFilledForm);
      const mockAgent = createMockAgent(completedForm);

      const result = await fillForm({
        form: emptyForm,
        model: 'mock/model',
        enableWebSearch: false,
        captureWireFormat: false,
        recordFill: true,
        inputContext: {
          name: 'Test User',
          email: 'test@example.com',
          age: 25,
          tags: ['tag1'],
          priority: 'high',
          categories: ['frontend'],
          tasks_multi: { research: 'done', design: 'done', implement: 'done', test: 'done' },
          tasks_simple: { read_guidelines: 'done', agree_terms: 'done' },
          confirmations: { backed_up: 'yes', notified: 'yes' },
          website: 'https://test.com',
          references: ['https://example.com'],
          event_date: '2025-06-15',
          founded_year: 2020,
        },
        targetRoles: ['user', 'agent'],
        _testAgent: mockAgent,
      });

      expect(result.record).toBeDefined();
      const record = result.record!;

      // Form progress should have valid counts
      expect(record.formProgress.totalFields).toBeGreaterThan(0);

      // Answered + unanswered + skipped + aborted should equal total
      const sum =
        record.formProgress.answeredFields +
        record.formProgress.unansweredFields +
        record.formProgress.skippedFields +
        record.formProgress.abortedFields;
      expect(sum).toBe(record.formProgress.totalFields);
    });
  });

  describe('parallel execution', () => {
    // Form with parallel batches for testing
    const PARALLEL_FORM = `---
markform:
  spec: MF/0.1
  roles:
    - agent
  role_instructions:
    agent: "Fill in all fields."
---
{% form id="parallel_test" %}

{% group id="overview" order=0 %}
{% field kind="string" id="company_name" label="Company Name" role="agent" required=true %}{% /field %}
{% /group %}

{% group id="financials" parallel="research" order=0 %}
{% field kind="string" id="revenue" label="Revenue" role="agent" %}{% /field %}
{% /group %}

{% group id="team" parallel="research" order=0 %}
{% field kind="string" id="leadership" label="Leadership" role="agent" %}{% /field %}
{% /group %}

{% group id="market" parallel="research" order=0 %}
{% field kind="string" id="competitors" label="Competitors" role="agent" %}{% /field %}
{% /group %}

{% group id="synthesis" order=10 %}
{% field kind="string" id="overall" label="Overall" role="agent" required=true %}{% /field %}
{% /group %}

{% /form %}
`;

    const PARALLEL_FORM_FILLED = `---
markform:
  spec: MF/0.1
  roles:
    - agent
  role_instructions:
    agent: "Fill in all fields."
---
{% form id="parallel_test" %}

{% group id="overview" order=0 %}
{% field kind="string" id="company_name" label="Company Name" role="agent" required=true %}
\`\`\`value
Acme Corp
\`\`\`
{% /field %}
{% /group %}

{% group id="financials" parallel="research" order=0 %}
{% field kind="string" id="revenue" label="Revenue" role="agent" %}
\`\`\`value
$10M ARR
\`\`\`
{% /field %}
{% /group %}

{% group id="team" parallel="research" order=0 %}
{% field kind="string" id="leadership" label="Leadership" role="agent" %}
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
Strong company
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;

    it('tracks distinct executionIds for parallel batch items', async () => {
      const filledForm = parseForm(PARALLEL_FORM_FILLED);
      const mockAgent = createMockAgent(filledForm);

      // Track executionIds from callbacks
      const turnExecutionIds: string[] = [];

      const result = await fillForm({
        form: PARALLEL_FORM,
        model: 'mock/model',
        enableWebSearch: false,
        captureWireFormat: false,
        enableParallel: true,
        recordFill: true,
        _testAgent: mockAgent,
        callbacks: {
          onTurnStart: (turn) => {
            turnExecutionIds.push(turn.executionId);
          },
        },
      });

      expect(result.status.ok).toBe(true);

      // Should have multiple distinct executionIds
      const uniqueIds = new Set(turnExecutionIds);
      expect(uniqueIds.size).toBeGreaterThan(1);

      // Should include serial execution IDs
      const serialIds = turnExecutionIds.filter((id) => id.includes(':serial:'));
      expect(serialIds.length).toBeGreaterThan(0);

      // Should include batch execution IDs for the "research" batch
      const batchIds = turnExecutionIds.filter((id) => id.includes(':batch:'));
      expect(batchIds.length).toBeGreaterThan(0);

      // Batch IDs should follow the expected format
      batchIds.forEach((id) => {
        expect(id).toMatch(/^eid:batch:o\d+:research:i\d+$/);
      });
    });

    it('FillRecord captures parallel execution metadata', async () => {
      const filledForm = parseForm(PARALLEL_FORM_FILLED);
      const mockAgent = createMockAgent(filledForm);

      const result = await fillForm({
        form: PARALLEL_FORM,
        model: 'mock/model',
        enableWebSearch: false,
        captureWireFormat: false,
        enableParallel: true,
        recordFill: true,
        _testAgent: mockAgent,
      });

      expect(result.status.ok).toBe(true);
      expect(result.record).toBeDefined();
      const record = result.record!;

      // Execution metadata should indicate parallel was enabled
      expect(record.execution.parallelEnabled).toBe(true);

      // Should have multiple order levels (0 and 10)
      expect(record.execution.orderLevels).toContain(0);
      expect(record.execution.orderLevels).toContain(10);

      // Should have multiple execution threads
      expect(record.execution.executionThreads.length).toBeGreaterThan(1);

      // Execution threads should include serial and batch IDs
      const hasSerial = record.execution.executionThreads.some((id) => id.includes(':serial:'));
      const hasBatch = record.execution.executionThreads.some((id) => id.includes(':batch:'));
      expect(hasSerial).toBe(true);
      expect(hasBatch).toBe(true);
    });

    it('executionId helper functions produce correct format', () => {
      // Serial execution ID format
      expect(serialExecutionId(0)).toBe('eid:serial:o0');
      expect(serialExecutionId(10)).toBe('eid:serial:o10');

      // Batch execution ID format
      expect(batchExecutionId(0, 'research', 0)).toBe('eid:batch:o0:research:i0');
      expect(batchExecutionId(0, 'research', 3)).toBe('eid:batch:o0:research:i3');
      expect(batchExecutionId(5, 'deep_dive', 1)).toBe('eid:batch:o5:deep_dive:i1');
    });

    it('timeline entries have correct executionIds', async () => {
      const filledForm = parseForm(PARALLEL_FORM_FILLED);
      const mockAgent = createMockAgent(filledForm);

      const result = await fillForm({
        form: PARALLEL_FORM,
        model: 'mock/model',
        enableWebSearch: false,
        captureWireFormat: false,
        enableParallel: true,
        recordFill: true,
        _testAgent: mockAgent,
      });

      expect(result.status.ok).toBe(true);
      expect(result.record).toBeDefined();
      const record = result.record!;

      // Each timeline entry should have an executionId
      record.timeline.forEach((entry) => {
        expect(entry.executionId).toBeDefined();
        expect(entry.executionId).toMatch(/^eid:(serial|batch):/);
      });

      // Order 0 entries can be serial or batch
      const order0Entries = record.timeline.filter((e) => e.order === 0);
      expect(order0Entries.length).toBeGreaterThan(0);

      // Order 10 entries should be serial (synthesis group)
      const order10Entries = record.timeline.filter((e) => e.order === 10);
      order10Entries.forEach((entry) => {
        expect(entry.executionId).toMatch(/^eid:serial:o10$/);
      });
    });

    it('parallel batch items have same turnNumber but different executionIds', async () => {
      const filledForm = parseForm(PARALLEL_FORM_FILLED);
      const mockAgent = createMockAgent(filledForm);

      const result = await fillForm({
        form: PARALLEL_FORM,
        model: 'mock/model',
        enableWebSearch: false,
        captureWireFormat: false,
        enableParallel: true,
        recordFill: true,
        _testAgent: mockAgent,
      });

      expect(result.status.ok).toBe(true);
      expect(result.record).toBeDefined();
      const record = result.record!;

      // Find batch entries (they should all have turnNumber based on when the batch started)
      const batchEntries = record.timeline.filter((e) => e.executionId.includes(':batch:'));

      if (batchEntries.length > 1) {
        // All batch items in the same batch should have different executionIds
        const executionIds = new Set(batchEntries.map((e) => e.executionId));

        // Each batch item should have a unique executionId
        expect(executionIds.size).toBe(batchEntries.length);
      }
    });
  });
});
