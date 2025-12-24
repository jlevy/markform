/**
 * Tests for the Form Harness.
 */

import { describe, expect, it } from "vitest";

import { parseForm } from "../../../src/engine/parse.js";
import {
  createHarness,
  createMockAgent,
  FormHarness,
} from "../../../src/harness/index.js";

// =============================================================================
// Test Fixtures
// =============================================================================

const SIMPLE_FORM = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test_form" %}

{% field-group id="basics" %}

{% string-field id="name" label="Name" required=true %}{% /string-field %}

{% number-field id="age" label="Age" required=true %}{% /number-field %}

{% /field-group %}

{% /form %}
`;

const FILLED_FORM = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test_form" %}

{% field-group id="basics" %}

{% string-field id="name" label="Name" required=true %}
\`\`\`value
John Doe
\`\`\`
{% /string-field %}

{% number-field id="age" label="Age" required=true %}
\`\`\`value
30
\`\`\`
{% /number-field %}

{% /field-group %}

{% /form %}
`;

// =============================================================================
// Harness Tests
// =============================================================================

describe("FormHarness", () => {
  describe("creation", () => {
    it("creates harness with default config", () => {
      const form = parseForm(SIMPLE_FORM);
      const harness = createHarness(form);

      expect(harness).toBeInstanceOf(FormHarness);
      expect(harness.getState()).toBe("init");
      expect(harness.getTurnNumber()).toBe(0);
    });

    it("creates harness with custom config", () => {
      const form = parseForm(SIMPLE_FORM);
      const harness = createHarness(form, {
        maxTurns: 5,
        maxPatchesPerTurn: 3,
      });

      expect(harness).toBeInstanceOf(FormHarness);
    });
  });

  describe("step", () => {
    it("returns step result with issues", () => {
      const form = parseForm(SIMPLE_FORM);
      const harness = createHarness(form);

      const result = harness.step();

      expect(result.turnNumber).toBe(1);
      expect(result.isComplete).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.structureSummary.fieldCount).toBe(2);
    });

    it("transitions to wait state after step", () => {
      const form = parseForm(SIMPLE_FORM);
      const harness = createHarness(form);

      harness.step();

      expect(harness.getState()).toBe("wait");
    });

    it("increments turn number on each step", () => {
      const form = parseForm(SIMPLE_FORM);
      const harness = createHarness(form);

      harness.step();
      expect(harness.getTurnNumber()).toBe(1);

      // Apply empty patches to transition back
      harness.apply([], []);
      harness.step();
      expect(harness.getTurnNumber()).toBe(2);
    });
  });

  describe("apply", () => {
    it("applies valid patches", () => {
      const form = parseForm(SIMPLE_FORM);
      const harness = createHarness(form);

      const stepResult = harness.step();

      const result = harness.apply(
        [
          { op: "set_string", fieldId: "name", value: "Test" },
          { op: "set_number", fieldId: "age", value: 25 },
        ],
        stepResult.issues
      );

      expect(result.isComplete).toBe(true);
    });

    it("throws when not in wait state", () => {
      const form = parseForm(SIMPLE_FORM);
      const harness = createHarness(form);

      expect(() => harness.apply([], [])).toThrow("Cannot apply in state");
    });

    it("throws when too many patches", () => {
      const form = parseForm(SIMPLE_FORM);
      const harness = createHarness(form, { maxPatchesPerTurn: 1 });

      harness.step();

      expect(() =>
        harness.apply(
          [
            { op: "set_string", fieldId: "name", value: "Test" },
            { op: "set_number", fieldId: "age", value: 25 },
          ],
          []
        )
      ).toThrow("Too many patches");
    });

    it("records turns", () => {
      const form = parseForm(SIMPLE_FORM);
      const harness = createHarness(form);

      const stepResult = harness.step();
      harness.apply(
        [{ op: "set_string", fieldId: "name", value: "Test" }],
        stepResult.issues
      );

      const turns = harness.getTurns();
      expect(turns.length).toBe(1);
      expect(turns[0]?.turn).toBe(1);
      expect(turns[0]?.apply.patches.length).toBe(1);
    });
  });

  describe("completion", () => {
    it("detects complete form", () => {
      const form = parseForm(FILLED_FORM);
      const harness = createHarness(form);

      const result = harness.step();

      expect(result.isComplete).toBe(true);
      expect(harness.getState()).toBe("complete");
    });

    it("throws on step after complete", () => {
      const form = parseForm(FILLED_FORM);
      const harness = createHarness(form);

      harness.step(); // Completes

      expect(() => harness.step()).toThrow("Harness is complete");
    });
  });

  describe("max turns", () => {
    it("enforces max turns limit", () => {
      const form = parseForm(SIMPLE_FORM);
      const harness = createHarness(form, { maxTurns: 2 });

      // First turn
      harness.step();
      expect(harness.getTurnNumber()).toBe(1);
      harness.apply([], []);

      // Second turn
      harness.step();
      expect(harness.getTurnNumber()).toBe(2);

      // After second step with maxTurns=2, state should be wait still
      // but after apply, should transition to complete
      harness.apply([], []);
      expect(harness.getState()).toBe("complete");
      expect(harness.hasReachedMaxTurns()).toBe(true);
    });
  });

  describe("getMarkdown", () => {
    it("returns serialized form", () => {
      const form = parseForm(SIMPLE_FORM);
      const harness = createHarness(form);

      const markdown = harness.getMarkdown();

      expect(markdown).toContain("{% form");
      expect(markdown).toContain("{% string");
    });
  });

  describe("getMarkdownHash", () => {
    it("returns consistent hash", () => {
      const form = parseForm(SIMPLE_FORM);
      const harness = createHarness(form);

      const hash1 = harness.getMarkdownHash();
      const hash2 = harness.getMarkdownHash();

      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(64); // SHA256 hex
    });
  });

  describe("issue filtering", () => {
    // Form with 2 groups, 3 fields each (6 required fields total)
    const MULTI_GROUP_FORM = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test_form" %}

{% field-group id="group_a" %}
{% string-field id="field_a1" label="A1" required=true %}{% /string-field %}
{% string-field id="field_a2" label="A2" required=true %}{% /string-field %}
{% string-field id="field_a3" label="A3" required=true %}{% /string-field %}
{% /field-group %}

{% field-group id="group_b" %}
{% string-field id="field_b1" label="B1" required=true %}{% /string-field %}
{% string-field id="field_b2" label="B2" required=true %}{% /string-field %}
{% string-field id="field_b3" label="B3" required=true %}{% /string-field %}
{% /field-group %}

{% /form %}
`;

    it("limits issues by maxFieldsPerTurn", () => {
      const form = parseForm(MULTI_GROUP_FORM);
      const harness = createHarness(form, { maxFieldsPerTurn: 2 });

      const result = harness.step();

      // Should have at most 2 unique fields in the issues
      const fieldIds = new Set(
        result.issues
          .filter((i) => i.scope === "field")
          .map((i) => i.ref)
      );
      expect(fieldIds.size).toBeLessThanOrEqual(2);
    });

    it("limits issues by maxGroupsPerTurn", () => {
      const form = parseForm(MULTI_GROUP_FORM);
      const harness = createHarness(form, { maxGroupsPerTurn: 1 });

      const result = harness.step();

      // Get unique group IDs from the field issues
      const fieldRefs = result.issues
        .filter((i) => i.scope === "field")
        .map((i) => i.ref);

      // Map field refs to their parent groups using the form's idIndex
      const groupIds = new Set<string>();
      for (const ref of fieldRefs) {
        const entry = form.idIndex.get(ref);
        if (entry?.parentId) {
          groupIds.add(entry.parentId);
        }
      }

      // Should only have fields from 1 group
      expect(groupIds.size).toBeLessThanOrEqual(1);
    });

    it("applies both field and group limits together", () => {
      const form = parseForm(MULTI_GROUP_FORM);
      const harness = createHarness(form, {
        maxGroupsPerTurn: 1,
        maxFieldsPerTurn: 2,
      });

      const result = harness.step();

      const fieldRefs = result.issues
        .filter((i) => i.scope === "field")
        .map((i) => i.ref);

      // Should have at most 2 fields from 1 group
      expect(fieldRefs.length).toBeLessThanOrEqual(2);
    });

    it("applies maxIssues after field/group filtering", () => {
      const form = parseForm(MULTI_GROUP_FORM);
      const harness = createHarness(form, {
        maxFieldsPerTurn: 5, // Would allow 5 fields
        maxIssues: 2, // But cap at 2 issues total
      });

      const result = harness.step();

      expect(result.issues.length).toBeLessThanOrEqual(2);
    });
  });
});

// =============================================================================
// Mock Agent Tests
// =============================================================================

describe("MockAgent", () => {
  it("generates patches from completed form", async () => {
    const emptyForm = parseForm(SIMPLE_FORM);
    const filledForm = parseForm(FILLED_FORM);
    const agent = createMockAgent(filledForm);

    // Create fake issues for the empty fields
    const issues = [
      {
        ref: "name",
        scope: "field" as const,
        reason: "required_missing" as const,
        message: "Required field is empty",
        severity: "required" as const,
        priority: 1,
      },
      {
        ref: "age",
        scope: "field" as const,
        reason: "required_missing" as const,
        message: "Required field is empty",
        severity: "required" as const,
        priority: 2,
      },
    ];

    const patches = await agent.generatePatches(issues, emptyForm, 10);

    expect(patches.length).toBe(2);
    expect(patches[0]).toEqual({
      op: "set_string",
      fieldId: "name",
      value: "John Doe",
    });
    expect(patches[1]).toEqual({
      op: "set_number",
      fieldId: "age",
      value: 30,
    });
  });

  it("respects maxPatches limit", async () => {
    const emptyForm = parseForm(SIMPLE_FORM);
    const filledForm = parseForm(FILLED_FORM);
    const agent = createMockAgent(filledForm);

    const issues = [
      {
        ref: "name",
        scope: "field" as const,
        reason: "required_missing" as const,
        message: "Required field is empty",
        severity: "required" as const,
        priority: 1,
      },
      {
        ref: "age",
        scope: "field" as const,
        reason: "required_missing" as const,
        message: "Required field is empty",
        severity: "required" as const,
        priority: 2,
      },
    ];

    const patches = await agent.generatePatches(issues, emptyForm, 1);

    expect(patches.length).toBe(1);
  });

  it("skips non-field issues", async () => {
    const emptyForm = parseForm(SIMPLE_FORM);
    const filledForm = parseForm(FILLED_FORM);
    const agent = createMockAgent(filledForm);

    const issues = [
      {
        ref: "test_form",
        scope: "form" as const,
        reason: "validation_error" as const,
        message: "Form error",
        severity: "required" as const,
        priority: 1,
      },
    ];

    const patches = await agent.generatePatches(issues, emptyForm, 10);

    expect(patches.length).toBe(0);
  });
});

// =============================================================================
// Integration Tests
// =============================================================================

describe("Harness + MockAgent Integration", () => {
  it("fills form to completion using mock agent", async () => {
    const emptyForm = parseForm(SIMPLE_FORM);
    const filledForm = parseForm(FILLED_FORM);

    const harness = createHarness(emptyForm);
    const agent = createMockAgent(filledForm);

    // First step
    let result = harness.step();
    expect(result.isComplete).toBe(false);

    // Generate and apply patches
    const patches = await agent.generatePatches(result.issues, emptyForm, 10);
    result = harness.apply(patches, result.issues);

    expect(result.isComplete).toBe(true);
    expect(harness.getState()).toBe("complete");

    // Verify turns recorded
    const turns = harness.getTurns();
    expect(turns.length).toBe(1);
    expect(turns[0]?.apply.patches.length).toBe(2);
  });
});
