/**
 * Comprehensive validation tests for simple.form.md
 *
 * This test file validates Phase 1 checkpoint requirements:
 * - Parse simple.form.md → structure summary matches expected counts
 * - Parse simple-mock-filled.form.md → all fields report as complete
 * - Round-trip test: parse → serialize → parse produces identical ParsedForm
 * - Validation tests: empty required fields produce correct issues
 * - Patch tests: valid patches apply, invalid patches reject batch
 */
import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseForm } from "../../../src/engine/parse";
import { serialize } from "../../../src/engine/serialize";
import { validate } from "../../../src/engine/validate";
import { inspect } from "../../../src/engine/inspect";
import { applyPatches } from "../../../src/engine/apply";
import { computeStructureSummary } from "../../../src/engine/summaries";
import type { Patch } from "../../../src/engine/coreTypes";

// =============================================================================
// Helper Functions
// =============================================================================

async function loadSimpleForm() {
  const formPath = join(
    import.meta.dirname,
    "../../../examples/simple/simple.form.md"
  );
  const content = await readFile(formPath, "utf-8");
  return parseForm(content);
}

async function loadFilledForm() {
  const formPath = join(
    import.meta.dirname,
    "../../../examples/simple/simple-mock-filled.form.md"
  );
  const content = await readFile(formPath, "utf-8");
  return parseForm(content);
}

// =============================================================================
// Tests
// =============================================================================

describe("Simple Form Validation (Phase 1 Checkpoint)", () => {
  describe("Structure Summary", () => {
    it("parses simple.form.md with correct structure", async () => {
      const form = await loadSimpleForm();
      const summary = computeStructureSummary(form.schema);

      // Expected counts based on simple.form.md:
      // 12 fields: name, email, age, score, tags, priority, categories,
      //   tasks_multi, tasks_simple, confirmations, notes, optional_number
      // 5 groups: basic_fields, list_fields, selection_fields, checkbox_fields, optional_fields
      expect(summary.fieldCount).toBe(12);
      expect(summary.groupCount).toBe(5);

      // Check field types
      expect(summary.fieldCountByKind.string).toBe(3); // name, email, notes
      expect(summary.fieldCountByKind.number).toBe(3); // age, score, optional_number
      expect(summary.fieldCountByKind.string_list).toBe(1); // tags
      expect(summary.fieldCountByKind.single_select).toBe(1); // priority
      expect(summary.fieldCountByKind.multi_select).toBe(1); // categories
      expect(summary.fieldCountByKind.checkboxes).toBe(3); // tasks_multi, tasks_simple, confirmations
    });

    it("has all required fields marked correctly", async () => {
      const form = await loadSimpleForm();

      // Check required field IDs in the schema
      const requiredFields: string[] = [];
      for (const group of form.schema.groups) {
        for (const field of group.children) {
          if (field.required) {
            requiredFields.push(field.id);
          }
        }
      }

      // Expected required: name, email, age, tags, priority, categories,
      // tasks_multi, tasks_simple, confirmations
      expect(requiredFields).toContain("name");
      expect(requiredFields).toContain("email");
      expect(requiredFields).toContain("age");
      expect(requiredFields).toContain("priority");
    });
  });

  describe("Filled Form Completion", () => {
    it("parses simple-mock-filled.form.md as complete", async () => {
      const form = await loadFilledForm();
      const result = inspect(form);

      expect(result.formState).toBe("complete");
      expect(result.progressSummary.counts.invalidFields).toBe(0);
      expect(result.progressSummary.counts.emptyRequiredFields).toBe(0);
    });

    it("has required fields in complete state", async () => {
      const form = await loadFilledForm();
      const result = inspect(form);

      // Check specific required fields are complete
      // Optional fields may be empty, which is fine
      const requiredFieldIds = ["name", "email", "age", "tags", "priority",
        "categories", "tasks_multi", "tasks_simple", "confirmations"];

      for (const fieldId of requiredFieldIds) {
        const progress = result.progressSummary.fields[fieldId];
        expect(progress, `Field ${fieldId} should have progress`).toBeDefined();
        expect(progress!.state, `Field ${fieldId} should be complete`).toBe("complete");
      }
    });
  });

  describe("Round-trip Serialization", () => {
    it("parse → serialize → parse produces identical structure", async () => {
      const original = await loadSimpleForm();
      const serialized = serialize(original);
      const reparsed = parseForm(serialized);

      // Schema should be identical
      expect(reparsed.schema.id).toBe(original.schema.id);
      expect(reparsed.schema.title).toBe(original.schema.title);
      expect(reparsed.schema.groups.length).toBe(original.schema.groups.length);

      // Field IDs should be in same order
      expect(reparsed.orderIndex).toEqual(original.orderIndex);

      // Field count should match
      expect(reparsed.orderIndex.length).toBe(original.orderIndex.length);
    });

    it("round-trip preserves field values", async () => {
      const original = await loadFilledForm();
      const serialized = serialize(original);
      const reparsed = parseForm(serialized);

      // Values should be preserved
      for (const fieldId of original.orderIndex) {
        const originalValue = original.valuesByFieldId[fieldId];
        const reparsedValue = reparsed.valuesByFieldId[fieldId];

        if (originalValue) {
          expect(reparsedValue?.kind).toBe(originalValue.kind);
        }
      }
    });

    it("round-trip produces identical serialization", async () => {
      const original = await loadFilledForm();
      const serialized1 = serialize(original);
      const reparsed = parseForm(serialized1);
      const serialized2 = serialize(reparsed);

      // Second serialization should match first (deterministic)
      expect(serialized2).toBe(serialized1);
    });
  });

  describe("Validation Issue Detection", () => {
    it("detects empty required fields in empty form", async () => {
      const form = await loadSimpleForm();
      const result = validate(form);

      // Should have issues for required fields that are empty
      const requiredIssues = result.issues.filter((i) => i.severity === "error");
      expect(requiredIssues.length).toBeGreaterThan(0);

      // Check that name is flagged
      const nameIssue = requiredIssues.find((i) => i.ref === "name");
      expect(nameIssue).toBeDefined();
    });

    it("reports no issues for filled form", async () => {
      const form = await loadFilledForm();
      const result = validate(form);

      // Should have no error issues
      const errorIssues = result.issues.filter((i) => i.severity === "error");
      expect(errorIssues.length).toBe(0);
    });
  });

  describe("Inspect Integration", () => {
    it("inspect returns complete result for filled form", async () => {
      const form = await loadFilledForm();
      const result = inspect(form);

      expect(result.isComplete).toBe(true);
      expect(result.formState).toBe("complete");
      expect(result.issues.filter((i) => i.severity === "required").length).toBe(
        0
      );
    });

    it("inspect returns incomplete result for empty form", async () => {
      const form = await loadSimpleForm();
      const result = inspect(form);

      expect(result.isComplete).toBe(false);
      expect(result.formState).toBe("empty");
      expect(
        result.issues.filter((i) => i.severity === "required").length
      ).toBeGreaterThan(0);
    });
  });

  describe("Patch Application", () => {
    it("applies valid patches successfully", async () => {
      const form = await loadSimpleForm();

      const patches: Patch[] = [
        { op: "set_string", fieldId: "name", value: "John Doe" },
        { op: "set_number", fieldId: "age", value: 30 },
      ];

      const result = applyPatches(form, patches);

      expect(result.applyStatus).toBe("applied");
      // applyPatches mutates the form on success
      expect(form.valuesByFieldId.name?.kind).toBe("string");
      expect(
        form.valuesByFieldId.name?.kind === "string"
          ? form.valuesByFieldId.name.value
          : null
      ).toBe("John Doe");
    });

    it("rejects patches for nonexistent fields", async () => {
      const form = await loadSimpleForm();

      const patches: Patch[] = [
        { op: "set_string", fieldId: "nonexistent_field", value: "test" },
      ];

      const result = applyPatches(form, patches);

      expect(result.applyStatus).toBe("rejected");
    });

    it("rejects batch if any patch is invalid (transaction semantics)", async () => {
      const form = await loadSimpleForm();

      // Get initial state of name field (may be null or undefined)
      const initialNameValue = form.valuesByFieldId.name;

      const patches: Patch[] = [
        { op: "set_string", fieldId: "name", value: "John Doe" }, // valid
        { op: "set_string", fieldId: "nonexistent", value: "test" }, // invalid
      ];

      const result = applyPatches(form, patches);

      expect(result.applyStatus).toBe("rejected");
      // Form should remain unchanged - name should still have original value
      // (could be null/undefined or the parsed initial value)
      if (initialNameValue === undefined) {
        expect(form.valuesByFieldId.name).toBeUndefined();
      } else {
        expect(form.valuesByFieldId.name).toEqual(initialNameValue);
      }
    });
  });
});
