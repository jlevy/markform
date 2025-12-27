import { describe, expect, it } from "vitest";

import { parseForm } from "../../src/engine/parse.js";
import {
  coerceInputContext,
  coerceToFieldPatch,
  findFieldById,
} from "../../src/engine/valueCoercion.js";

// Test form with various field types
const TEST_FORM_MD = `---
markform:
  spec: MF/0.1
  roles:
    - user
    - agent
---

{% form id="test_form" title="Test Form" %}

{% field-group id="basic" title="Basic Fields" %}

{% string-field id="name" label="Name" role="user" required=true %}{% /string-field %}

{% number-field id="age" label="Age" role="user" required=true %}{% /number-field %}

{% string-list id="tags" label="Tags" role="user" %}{% /string-list %}

{% /field-group %}

{% field-group id="selection" title="Selection Fields" %}

{% single-select id="priority" label="Priority" role="user" %}
- [ ] Low {% #low %}
- [ ] Medium {% #medium %}
- [ ] High {% #high %}
{% /single-select %}

{% multi-select id="categories" label="Categories" role="user" %}
- [ ] Frontend {% #frontend %}
- [ ] Backend {% #backend %}
- [ ] Database {% #database %}
{% /multi-select %}

{% /field-group %}

{% field-group id="checkboxes" title="Checkbox Fields" %}

{% checkboxes id="tasks_multi" label="Tasks (Multi)" role="user" checkboxMode="multi" %}
- [ ] Research {% #research %}
- [ ] Design {% #design %}
{% /checkboxes %}

{% checkboxes id="tasks_simple" label="Tasks (Simple)" role="user" checkboxMode="simple" %}
- [ ] Read {% #read %}
- [ ] Agree {% #agree %}
{% /checkboxes %}

{% checkboxes id="confirmations" label="Confirmations" role="user" checkboxMode="explicit" %}
- [ ] Backed up {% #backup %}
- [ ] Notified {% #notify %}
{% /checkboxes %}

{% /field-group %}

{% /form %}
`;

describe("values", () => {
  describe("findFieldById", () => {
    it("returns field when found via idIndex", () => {
      const form = parseForm(TEST_FORM_MD);
      const field = findFieldById(form, "name");
      expect(field).toBeDefined();
      expect(field?.id).toBe("name");
      expect(field?.kind).toBe("string");
    });

    it("returns undefined for non-existent field ID", () => {
      const form = parseForm(TEST_FORM_MD);
      const field = findFieldById(form, "nonexistent");
      expect(field).toBeUndefined();
    });

    it("returns undefined for group ID (not a field)", () => {
      const form = parseForm(TEST_FORM_MD);
      const field = findFieldById(form, "basic");
      expect(field).toBeUndefined();
    });

    it("works with fields in different groups", () => {
      const form = parseForm(TEST_FORM_MD);

      const name = findFieldById(form, "name");
      expect(name?.id).toBe("name");

      const priority = findFieldById(form, "priority");
      expect(priority?.id).toBe("priority");

      const tasks = findFieldById(form, "tasks_multi");
      expect(tasks?.id).toBe("tasks_multi");
    });
  });

  describe("coerceToFieldPatch - string field", () => {
    it("accepts string value", () => {
      const form = parseForm(TEST_FORM_MD);
      const result = coerceToFieldPatch(form, "name", "John");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.patch).toEqual({
          op: "set_string",
          fieldId: "name",
          value: "John",
        });
        expect("warning" in result).toBe(false);
      }
    });

    it("coerces number to string with warning", () => {
      const form = parseForm(TEST_FORM_MD);
      const result = coerceToFieldPatch(form, "name", 123);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.patch).toEqual({
          op: "set_string",
          fieldId: "name",
          value: "123",
        });
        expect("warning" in result && result.warning).toContain("Coerced number");
      }
    });

    it("coerces boolean to string with warning", () => {
      const form = parseForm(TEST_FORM_MD);
      const result = coerceToFieldPatch(form, "name", true);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.patch).toEqual({
          op: "set_string",
          fieldId: "name",
          value: "true",
        });
        expect("warning" in result && result.warning).toContain("Coerced boolean");
      }
    });

    it("rejects array for string field", () => {
      const form = parseForm(TEST_FORM_MD);
      const result = coerceToFieldPatch(form, "name", ["a", "b"]);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("Cannot coerce");
      }
    });

    it("rejects object for string field", () => {
      const form = parseForm(TEST_FORM_MD);
      const result = coerceToFieldPatch(form, "name", { key: "value" });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("Cannot coerce");
      }
    });

    it("accepts null (clears field)", () => {
      const form = parseForm(TEST_FORM_MD);
      const result = coerceToFieldPatch(form, "name", null);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.patch).toEqual({
          op: "set_string",
          fieldId: "name",
          value: null,
        });
      }
    });
  });

  describe("coerceToFieldPatch - number field", () => {
    it("accepts number value", () => {
      const form = parseForm(TEST_FORM_MD);
      const result = coerceToFieldPatch(form, "age", 25);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.patch).toEqual({
          op: "set_number",
          fieldId: "age",
          value: 25,
        });
      }
    });

    it("coerces numeric string to number with warning", () => {
      const form = parseForm(TEST_FORM_MD);
      const result = coerceToFieldPatch(form, "age", "42");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.patch).toEqual({
          op: "set_number",
          fieldId: "age",
          value: 42,
        });
        expect("warning" in result && result.warning).toContain("Coerced string");
      }
    });

    it("rejects non-numeric string", () => {
      const form = parseForm(TEST_FORM_MD);
      const result = coerceToFieldPatch(form, "age", "not a number");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("non-numeric string");
      }
    });

    it("rejects array for number field", () => {
      const form = parseForm(TEST_FORM_MD);
      const result = coerceToFieldPatch(form, "age", ["1", "2", "3"]);

      expect(result.ok).toBe(false);
    });

    it("accepts null (clears field)", () => {
      const form = parseForm(TEST_FORM_MD);
      const result = coerceToFieldPatch(form, "age", null);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.patch).toEqual({
          op: "set_number",
          fieldId: "age",
          value: null,
        });
      }
    });
  });

  describe("coerceToFieldPatch - string_list field", () => {
    it("accepts string array", () => {
      const form = parseForm(TEST_FORM_MD);
      const result = coerceToFieldPatch(form, "tags", ["tag1", "tag2"]);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.patch).toEqual({
          op: "set_string_list",
          fieldId: "tags",
          items: ["tag1", "tag2"],
        });
      }
    });

    it("coerces single string to array with warning", () => {
      const form = parseForm(TEST_FORM_MD);
      const result = coerceToFieldPatch(form, "tags", "single");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.patch).toEqual({
          op: "set_string_list",
          fieldId: "tags",
          items: ["single"],
        });
        expect("warning" in result && result.warning).toContain("Coerced single string");
      }
    });

    it("rejects non-array non-string", () => {
      const form = parseForm(TEST_FORM_MD);
      const result = coerceToFieldPatch(form, "tags", 123);

      expect(result.ok).toBe(false);
    });

    it("accepts null (empty array)", () => {
      const form = parseForm(TEST_FORM_MD);
      const result = coerceToFieldPatch(form, "tags", null);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.patch).toEqual({
          op: "set_string_list",
          fieldId: "tags",
          items: [],
        });
      }
    });
  });

  describe("coerceToFieldPatch - single_select field", () => {
    it("accepts valid option ID", () => {
      const form = parseForm(TEST_FORM_MD);
      const result = coerceToFieldPatch(form, "priority", "high");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.patch).toEqual({
          op: "set_single_select",
          fieldId: "priority",
          selected: "high",
        });
      }
    });

    it("rejects invalid option ID", () => {
      const form = parseForm(TEST_FORM_MD);
      const result = coerceToFieldPatch(form, "priority", "invalid");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("Invalid option");
        expect(result.error).toContain("Valid options");
      }
    });

    it("accepts null (clears selection)", () => {
      const form = parseForm(TEST_FORM_MD);
      const result = coerceToFieldPatch(form, "priority", null);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.patch).toEqual({
          op: "set_single_select",
          fieldId: "priority",
          selected: null,
        });
      }
    });

    it("rejects non-string value", () => {
      const form = parseForm(TEST_FORM_MD);
      const result = coerceToFieldPatch(form, "priority", 123);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("requires a string option ID");
      }
    });
  });

  describe("coerceToFieldPatch - multi_select field", () => {
    it("accepts string array of valid options", () => {
      const form = parseForm(TEST_FORM_MD);
      const result = coerceToFieldPatch(form, "categories", ["frontend", "backend"]);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.patch).toEqual({
          op: "set_multi_select",
          fieldId: "categories",
          selected: ["frontend", "backend"],
        });
      }
    });

    it("coerces single string to array with warning", () => {
      const form = parseForm(TEST_FORM_MD);
      const result = coerceToFieldPatch(form, "categories", "frontend");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.patch).toEqual({
          op: "set_multi_select",
          fieldId: "categories",
          selected: ["frontend"],
        });
        expect("warning" in result && result.warning).toContain("Coerced single string");
      }
    });

    it("rejects invalid option IDs", () => {
      const form = parseForm(TEST_FORM_MD);
      const result = coerceToFieldPatch(form, "categories", ["frontend", "invalid"]);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("Invalid option");
      }
    });

    it("accepts null (empty selection)", () => {
      const form = parseForm(TEST_FORM_MD);
      const result = coerceToFieldPatch(form, "categories", null);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.patch).toEqual({
          op: "set_multi_select",
          fieldId: "categories",
          selected: [],
        });
      }
    });
  });

  describe("coerceToFieldPatch - checkboxes field (multi mode)", () => {
    it("accepts valid checkbox values", () => {
      const form = parseForm(TEST_FORM_MD);
      const result = coerceToFieldPatch(form, "tasks_multi", {
        research: "done",
        design: "todo",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.patch).toEqual({
          op: "set_checkboxes",
          fieldId: "tasks_multi",
          values: { research: "done", design: "todo" },
        });
      }
    });

    it("accepts all multi mode values", () => {
      const form = parseForm(TEST_FORM_MD);
      const result = coerceToFieldPatch(form, "tasks_multi", {
        research: "active",
        design: "incomplete",
      });

      expect(result.ok).toBe(true);
    });

    it("rejects invalid option ID", () => {
      const form = parseForm(TEST_FORM_MD);
      const result = coerceToFieldPatch(form, "tasks_multi", {
        invalid: "done",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("Invalid option");
      }
    });

    it("rejects invalid checkbox value for mode", () => {
      const form = parseForm(TEST_FORM_MD);
      // "yes" is not valid for multi mode
      const result = coerceToFieldPatch(form, "tasks_multi", {
        research: "yes",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("Invalid checkbox value");
      }
    });

    it("rejects wrong structure", () => {
      const form = parseForm(TEST_FORM_MD);
      const result = coerceToFieldPatch(form, "tasks_multi", ["done", "todo"]);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("requires a Record");
      }
    });
  });

  describe("coerceToFieldPatch - checkboxes field (simple mode)", () => {
    it("accepts simple mode values", () => {
      const form = parseForm(TEST_FORM_MD);
      const result = coerceToFieldPatch(form, "tasks_simple", {
        read: "done",
        agree: "todo",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.patch).toEqual({
          op: "set_checkboxes",
          fieldId: "tasks_simple",
          values: { read: "done", agree: "todo" },
        });
      }
    });

    it("rejects multi mode values in simple mode", () => {
      const form = parseForm(TEST_FORM_MD);
      const result = coerceToFieldPatch(form, "tasks_simple", {
        read: "active",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("Invalid checkbox value");
        expect(result.error).toContain("simple mode");
      }
    });
  });

  describe("coerceToFieldPatch - checkboxes field (explicit mode)", () => {
    it("accepts explicit mode values", () => {
      const form = parseForm(TEST_FORM_MD);
      const result = coerceToFieldPatch(form, "confirmations", {
        backup: "yes",
        notify: "no",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.patch).toEqual({
          op: "set_checkboxes",
          fieldId: "confirmations",
          values: { backup: "yes", notify: "no" },
        });
      }
    });

    it("rejects done/todo values in explicit mode", () => {
      const form = parseForm(TEST_FORM_MD);
      const result = coerceToFieldPatch(form, "confirmations", {
        backup: "done",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("Invalid checkbox value");
        expect(result.error).toContain("explicit mode");
      }
    });
  });

  describe("coerceToFieldPatch - field not found", () => {
    it("returns error for non-existent field", () => {
      const form = parseForm(TEST_FORM_MD);
      const result = coerceToFieldPatch(form, "nonexistent", "value");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("not found");
      }
    });
  });

  describe("coerceInputContext", () => {
    it("returns patches for valid input context", () => {
      const form = parseForm(TEST_FORM_MD);
      const result = coerceInputContext(form, {
        name: "John",
        age: 25,
        priority: "high",
      });

      expect(result.errors).toHaveLength(0);
      expect(result.patches).toHaveLength(3);
      expect(result.patches).toContainEqual({
        op: "set_string",
        fieldId: "name",
        value: "John",
      });
      expect(result.patches).toContainEqual({
        op: "set_number",
        fieldId: "age",
        value: 25,
      });
      expect(result.patches).toContainEqual({
        op: "set_single_select",
        fieldId: "priority",
        selected: "high",
      });
    });

    it("collects warnings from multiple coercions", () => {
      const form = parseForm(TEST_FORM_MD);
      const result = coerceInputContext(form, {
        name: 123,
        age: "42",
      });

      expect(result.errors).toHaveLength(0);
      expect(result.patches).toHaveLength(2);
      expect(result.warnings).toHaveLength(2);
      expect(result.warnings.some((w) => w.includes("name"))).toBe(true);
      expect(result.warnings.some((w) => w.includes("age"))).toBe(true);
    });

    it("collects errors for missing fields", () => {
      const form = parseForm(TEST_FORM_MD);
      const result = coerceInputContext(form, {
        nonexistent: "value",
        name: "John",
      });

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("not found");
      expect(result.patches).toHaveLength(1);
    });

    it("collects errors for incompatible types", () => {
      const form = parseForm(TEST_FORM_MD);
      const result = coerceInputContext(form, {
        name: { complex: "object" },
        age: 25,
      });

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("Cannot coerce");
      expect(result.patches).toHaveLength(1);
    });

    it("skips null values", () => {
      const form = parseForm(TEST_FORM_MD);
      const result = coerceInputContext(form, {
        name: "John",
        age: null,
      });

      expect(result.errors).toHaveLength(0);
      expect(result.patches).toHaveLength(1);
      expect(result.patches[0]).toEqual({
        op: "set_string",
        fieldId: "name",
        value: "John",
      });
    });

    it("handles empty input context", () => {
      const form = parseForm(TEST_FORM_MD);
      const result = coerceInputContext(form, {});

      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(result.patches).toHaveLength(0);
    });
  });
});
