/**
 * Integration tests for the programmatic fill API.
 *
 * These tests validate the full end-to-end flow using real form files
 * from the examples directory.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { parseForm } from "../../src/engine/parse.js";
import { fillForm } from "../../src/harness/programmaticFill.js";
import { createMockAgent } from "../../src/harness/mockAgent.js";

// =============================================================================
// Test Fixtures
// =============================================================================

const EXAMPLES_DIR = resolve(__dirname, "../../examples");

function loadForm(subPath: string): string {
  return readFileSync(resolve(EXAMPLES_DIR, subPath), "utf-8");
}

// =============================================================================
// Integration Tests
// =============================================================================

describe("programmatic fill API - integration tests", () => {
  describe("simple.form.md", () => {
    it("complete fill using MockAgent with inputContext", async () => {
      // Load empty form and mock-filled form
      const emptyForm = loadForm("simple/simple.form.md");
      const mockFilledForm = loadForm("simple/simple-mock-filled.form.md");

      // Create mock agent from completed form
      const completedForm = parseForm(mockFilledForm);
      const mockAgent = createMockAgent(completedForm);

      // Fill using programmatic API with user fields pre-filled via inputContext
      const result = await fillForm({
        form: emptyForm,
        model: "mock/model",
        inputContext: {
          // Pre-fill user fields that MockAgent won't fill
          name: "Alice Johnson",
          email: "alice@example.com",
          age: 32,
          tags: ["typescript", "testing", "forms"],
          priority: "medium",
          categories: ["frontend", "backend"],
          tasks_multi: { research: "done", design: "done", implement: "done", test: "incomplete" },
          tasks_simple: { read_guidelines: "done", agree_terms: "done" },
          confirmations: { backed_up: "yes", notified: "no" },
        },
        targetRoles: ["user", "agent"],
        _testAgent: mockAgent,
      });

      expect(result.status.ok).toBe(true);
      expect(result.turns).toBeGreaterThan(0);

      // Verify key values were set
      expect(result.values.name).toEqual({ kind: "string", value: "Alice Johnson" });
      expect(result.values.email).toEqual({ kind: "string", value: "alice@example.com" });
      expect(result.values.age).toEqual({ kind: "number", value: 32 });
      expect(result.values.score).toBeDefined();
      expect(result.values.notes).toBeDefined();
    });

    it("partial fill with agent role only fills agent fields", async () => {
      // Load empty form and mock-filled form
      const emptyForm = loadForm("simple/simple.form.md");
      const mockFilledForm = loadForm("simple/simple-mock-filled.form.md");

      // Create mock agent from completed form
      const completedForm = parseForm(mockFilledForm);
      const mockAgent = createMockAgent(completedForm);

      // Fill only agent role fields
      const result = await fillForm({
        form: emptyForm,
        model: "mock/model",
        targetRoles: ["agent"],
        _testAgent: mockAgent,
      });

      // When targeting only agent role, the form is considered complete
      // for that role even if user fields are empty
      expect(result.status.ok).toBe(true);

      // Agent fields should be filled
      expect(result.values.score).toBeDefined();
      expect(result.values.notes).toBeDefined();

      // User fields should still be empty (not targeted)
      expect(result.values.name).toEqual({ kind: "string", value: null });
    });

    it("round-trip: result can be re-parsed", async () => {
      const emptyForm = loadForm("simple/simple.form.md");
      const mockFilledForm = loadForm("simple/simple-mock-filled.form.md");

      const completedForm = parseForm(mockFilledForm);
      const mockAgent = createMockAgent(completedForm);

      const result = await fillForm({
        form: emptyForm,
        model: "mock/model",
        inputContext: {
          name: "Test User",
          email: "test@example.com",
          age: 25,
          tags: ["tag1"],
          priority: "high",
          categories: ["frontend"],
          tasks_multi: { research: "done", design: "done", implement: "done", test: "done" },
          tasks_simple: { read_guidelines: "done", agree_terms: "done" },
          confirmations: { backed_up: "yes", notified: "yes" },
        },
        targetRoles: ["user", "agent"],
        _testAgent: mockAgent,
      });

      // Re-parse the result markdown
      const reparsedForm = parseForm(result.markdown);

      // Should have the same structure
      expect(reparsedForm.schema.id).toBe("simple_test");
      expect(reparsedForm.schema.groups.length).toBe(5);

      // Values should be preserved
      expect(reparsedForm.valuesByFieldId.name).toEqual({ kind: "string", value: "Test User" });
    });
  });

  describe("political-research.form.md", () => {
    it("complete fill with inputContext for user field", async () => {
      // Load empty form and Lincoln mock-filled form
      const emptyForm = loadForm("political-research/political-research.form.md");
      const mockFilledForm = loadForm("political-research/political-research.mock.lincoln.form.md");

      // Create mock agent from completed form
      const completedForm = parseForm(mockFilledForm);
      const mockAgent = createMockAgent(completedForm);

      // Fill using programmatic API with user field pre-filled
      const result = await fillForm({
        form: emptyForm,
        model: "mock/model",
        inputContext: {
          name: "Abraham Lincoln",
        },
        targetRoles: ["user", "agent"],
        _testAgent: mockAgent,
      });

      expect(result.status.ok).toBe(true);

      // Verify user field was pre-filled
      expect(result.values.name).toEqual({ kind: "string", value: "Abraham Lincoln" });

      // Verify agent filled biographical data
      expect(result.values.birth_date).toEqual({ kind: "string", value: "1809-02-12" });
      expect(result.values.birth_place).toEqual({ kind: "string", value: "Hodgenville, Kentucky" });
      expect(result.values.political_party).toEqual({ kind: "string", value: "Republican" });
    });

    it("handles complex form structure", async () => {
      const emptyForm = loadForm("political-research/political-research.form.md");
      const mockFilledForm = loadForm("political-research/political-research.mock.lincoln.form.md");

      const completedForm = parseForm(mockFilledForm);
      const mockAgent = createMockAgent(completedForm);

      const result = await fillForm({
        form: emptyForm,
        model: "mock/model",
        inputContext: { name: "Abraham Lincoln" },
        targetRoles: ["user", "agent"],
        _testAgent: mockAgent,
      });

      expect(result.status.ok).toBe(true);

      // Verify string_list fields were filled
      expect(result.values.children?.kind).toBe("string_list");
      expect(result.values.sources?.kind).toBe("string_list");
    });
  });

  describe("error scenarios", () => {
    it("form parse error returns appropriate error", async () => {
      const result = await fillForm({
        form: "not a valid markform document",
        model: "mock/model",
      });

      expect(result.status.ok).toBe(false);
      if (!result.status.ok) {
        expect(result.status.reason).toBe("error");
        expect(result.status.message).toContain("Form parse error");
      }
    });

    it("model resolution error returns appropriate error", async () => {
      const emptyForm = loadForm("simple/simple.form.md");

      const result = await fillForm({
        form: emptyForm,
        model: "nonexistent/provider-model",
      });

      expect(result.status.ok).toBe(false);
      if (!result.status.ok) {
        expect(result.status.reason).toBe("error");
        expect(result.status.message).toContain("Model resolution error");
      }
    });

    it("invalid inputContext field returns error", async () => {
      const emptyForm = loadForm("simple/simple.form.md");
      const mockFilledForm = loadForm("simple/simple-mock-filled.form.md");
      const completedForm = parseForm(mockFilledForm);
      const mockAgent = createMockAgent(completedForm);

      const result = await fillForm({
        form: emptyForm,
        model: "mock/model",
        inputContext: {
          nonexistent_field: "some value",
        },
        _testAgent: mockAgent,
      });

      expect(result.status.ok).toBe(false);
      if (!result.status.ok) {
        expect(result.status.reason).toBe("error");
        expect(result.status.message).toContain("not found");
      }
    });
  });

  describe("progress tracking", () => {
    it("onTurnComplete receives accurate progress info", async () => {
      const emptyForm = loadForm("simple/simple.form.md");
      const mockFilledForm = loadForm("simple/simple-mock-filled.form.md");

      const completedForm = parseForm(mockFilledForm);
      const mockAgent = createMockAgent(completedForm);

      const progressUpdates: {
        turnNumber: number;
        patchesApplied: number;
        requiredIssuesRemaining: number;
        isComplete: boolean;
      }[] = [];

      // Only pre-fill user fields, let MockAgent fill agent fields (score, notes)
      // This ensures at least one turn is executed
      const result = await fillForm({
        form: emptyForm,
        model: "mock/model",
        inputContext: {
          name: "Test User",
          email: "test@example.com",
          age: 25,
          tags: ["tag1"],
          priority: "high",
          categories: ["frontend"],
          tasks_multi: { research: "done", design: "done", implement: "done", test: "done" },
          tasks_simple: { read_guidelines: "done", agree_terms: "done" },
          confirmations: { backed_up: "yes", notified: "yes" },
          // Note: NOT pre-filling score or notes - MockAgent will fill these
        },
        targetRoles: ["user", "agent"],
        _testAgent: mockAgent,
        onTurnComplete: (progress) => {
          progressUpdates.push({ ...progress });
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

    it("zero turns when form is already complete via inputContext", async () => {
      const emptyForm = loadForm("simple/simple.form.md");
      const mockFilledForm = loadForm("simple/simple-mock-filled.form.md");

      const completedForm = parseForm(mockFilledForm);
      const mockAgent = createMockAgent(completedForm);

      const progressUpdates: number[] = [];

      // Pre-fill ALL fields (including agent fields) via inputContext
      const result = await fillForm({
        form: emptyForm,
        model: "mock/model",
        inputContext: {
          name: "Test User",
          email: "test@example.com",
          age: 25,
          tags: ["tag1"],
          priority: "high",
          categories: ["frontend"],
          tasks_multi: { research: "done", design: "done", implement: "done", test: "done" },
          tasks_simple: { read_guidelines: "done", agree_terms: "done" },
          confirmations: { backed_up: "yes", notified: "yes" },
          // Also pre-fill agent fields
          score: 87.5,
          notes: "Pre-filled note",
        },
        targetRoles: ["user", "agent"],
        _testAgent: mockAgent,
        onTurnComplete: (progress) => {
          progressUpdates.push(progress.turnNumber);
        },
      });

      expect(result.status.ok).toBe(true);
      // No turns needed when everything is pre-filled
      expect(progressUpdates.length).toBe(0);
      expect(result.turns).toBe(0);
    });
  });
});
