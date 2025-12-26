import { describe, expect, it } from "vitest";

import { parseForm } from "../../../src/engine/parse.js";
import { applyPatches } from "../../../src/engine/apply.js";
import type { Patch } from "../../../src/engine/coreTypes.js";

describe("engine/apply", () => {
  describe("set_string patch", () => {
    it("applies set_string to string field", () => {
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-field id="name" label="Name" %}{% /string-field %}
{% /field-group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const patches: Patch[] = [
        { op: "set_string", fieldId: "name", value: "John Doe" },
      ];

      const result = applyPatches(form, patches);

      expect(result.applyStatus).toBe("applied");
      expect(form.responsesByFieldId.name?.value).toEqual({
        kind: "string",
        value: "John Doe",
      });
    });

    it("rejects set_string on non-string field", () => {
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test" %}

{% field-group id="g1" %}
{% number-field id="age" label="Age" %}{% /number-field %}
{% /field-group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const patches: Patch[] = [
        { op: "set_string", fieldId: "age", value: "25" },
      ];

      const result = applyPatches(form, patches);

      expect(result.applyStatus).toBe("rejected");
    });
  });

  describe("set_number patch", () => {
    it("applies set_number to number field", () => {
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test" %}

{% field-group id="g1" %}
{% number-field id="age" label="Age" %}{% /number-field %}
{% /field-group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const patches: Patch[] = [{ op: "set_number", fieldId: "age", value: 25 }];

      const result = applyPatches(form, patches);

      expect(result.applyStatus).toBe("applied");
      expect(form.responsesByFieldId.age?.value).toEqual({
        kind: "number",
        value: 25,
      });
    });
  });

  describe("set_string_list patch", () => {
    it("applies set_string_list to string-list field", () => {
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-list id="tags" label="Tags" %}{% /string-list %}
{% /field-group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const patches: Patch[] = [
        { op: "set_string_list", fieldId: "tags", items: ["a", "b", "c"] },
      ];

      const result = applyPatches(form, patches);

      expect(result.applyStatus).toBe("applied");
      expect(form.responsesByFieldId.tags?.value).toEqual({
        kind: "string_list",
        items: ["a", "b", "c"],
      });
    });
  });

  describe("set_single_select patch", () => {
    it("applies set_single_select to single-select field", () => {
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test" %}

{% field-group id="g1" %}
{% single-select id="priority" label="Priority" %}
- [ ] High {% #high %}
- [ ] Low {% #low %}
{% /single-select %}
{% /field-group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const patches: Patch[] = [
        { op: "set_single_select", fieldId: "priority", selected: "high" },
      ];

      const result = applyPatches(form, patches);

      expect(result.applyStatus).toBe("applied");
      expect(form.responsesByFieldId.priority?.value).toEqual({
        kind: "single_select",
        selected: "high",
      });
    });

    it("rejects invalid option id", () => {
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test" %}

{% field-group id="g1" %}
{% single-select id="priority" label="Priority" %}
- [ ] High {% #high %}
- [ ] Low {% #low %}
{% /single-select %}
{% /field-group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const patches: Patch[] = [
        { op: "set_single_select", fieldId: "priority", selected: "invalid" },
      ];

      const result = applyPatches(form, patches);

      expect(result.applyStatus).toBe("rejected");
    });
  });

  describe("set_multi_select patch", () => {
    it("applies set_multi_select to multi-select field", () => {
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test" %}

{% field-group id="g1" %}
{% multi-select id="categories" label="Categories" %}
- [ ] Tech {% #tech %}
- [ ] Finance {% #finance %}
- [ ] Health {% #health %}
{% /multi-select %}
{% /field-group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const patches: Patch[] = [
        { op: "set_multi_select", fieldId: "categories", selected: ["tech", "health"] },
      ];

      const result = applyPatches(form, patches);

      expect(result.applyStatus).toBe("applied");
      expect(form.responsesByFieldId.categories?.value).toEqual({
        kind: "multi_select",
        selected: ["tech", "health"],
      });
    });
  });

  describe("set_checkboxes patch", () => {
    it("applies set_checkboxes with merge behavior", () => {
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test" %}

{% field-group id="g1" %}
{% checkboxes id="tasks" label="Tasks" checkboxMode="multi" %}
- [x] First {% #first %}
- [ ] Second {% #second %}
- [ ] Third {% #third %}
{% /checkboxes %}
{% /field-group %}

{% /form %}
`;
      const form = parseForm(markdown);
      // Apply patch for second only - should merge with existing
      const patches: Patch[] = [
        {
          op: "set_checkboxes",
          fieldId: "tasks",
          values: { second: "done" },
        },
      ];

      const result = applyPatches(form, patches);

      expect(result.applyStatus).toBe("applied");
      const response = form.responsesByFieldId.tasks;
      const value = response?.value;
      expect(value?.kind).toBe("checkboxes");
      if (value?.kind === "checkboxes") {
        // First should still be done (from original)
        expect(value.values.first).toBe("done");
        // Second should now be done (from patch)
        expect(value.values.second).toBe("done");
      }
    });
  });

  describe("clear_field patch", () => {
    it("clears string field", () => {
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-field id="name" label="Name" %}
\`\`\`value
John
\`\`\`
{% /string-field %}
{% /field-group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const patches: Patch[] = [{ op: "clear_field", fieldId: "name" }];

      const result = applyPatches(form, patches);

      expect(result.applyStatus).toBe("applied");
      expect(form.responsesByFieldId.name?.state).toBe("empty");
    });
  });

  describe("transaction semantics", () => {
    it("rejects all patches if any is invalid", () => {
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-field id="name" label="Name" %}{% /string-field %}
{% number-field id="age" label="Age" %}{% /number-field %}
{% /field-group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const patches: Patch[] = [
        { op: "set_string", fieldId: "name", value: "John" }, // valid
        { op: "set_string", fieldId: "age", value: "25" }, // invalid - wrong type
      ];

      const result = applyPatches(form, patches);

      expect(result.applyStatus).toBe("rejected");
      // Name should NOT be updated due to transaction rollback
      const nameResponse = form.responsesByFieldId.name;
      expect(nameResponse?.state === "empty" || nameResponse === undefined).toBe(true);
    });

    it("rejects if field does not exist", () => {
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-field id="name" label="Name" %}{% /string-field %}
{% /field-group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const patches: Patch[] = [
        { op: "set_string", fieldId: "nonexistent", value: "test" },
      ];

      const result = applyPatches(form, patches);

      expect(result.applyStatus).toBe("rejected");
    });
  });

  describe("skip_field patch", () => {
    it("applies skip_field to optional field", () => {
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-field id="notes" label="Notes" %}{% /string-field %}
{% /field-group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const patches: Patch[] = [
        { op: "skip_field", fieldId: "notes", role: "agent", reason: "Not applicable" },
      ];

      const result = applyPatches(form, patches);

      expect(result.applyStatus).toBe("applied");
      expect(form.responsesByFieldId.notes?.state).toBe("skipped");
      // Check that a note was added with the reason
      const note = form.notes.find(n => n.ref === "notes" && n.state === "skipped");
      expect(note?.text).toContain("Not applicable");
    });

    it("rejects skip_field on required field", () => {
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-field id="name" label="Name" required=true %}{% /string-field %}
{% /field-group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const patches: Patch[] = [
        { op: "skip_field", fieldId: "name", role: "agent", reason: "Can't skip required" },
      ];

      const result = applyPatches(form, patches);

      expect(result.applyStatus).toBe("rejected");
      expect(form.responsesByFieldId.name?.state).not.toBe("skipped");
    });

    it("clears existing value when skipping", () => {
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-field id="notes" label="Notes" %}
\`\`\`value
Some existing value
\`\`\`
{% /string-field %}
{% /field-group %}

{% /form %}
`;
      const form = parseForm(markdown);
      // Verify value exists initially
      expect(form.responsesByFieldId.notes?.state).toBe("answered");

      const patches: Patch[] = [
        { op: "skip_field", fieldId: "notes", role: "agent" },
      ];

      const result = applyPatches(form, patches);

      expect(result.applyStatus).toBe("applied");
      expect(form.responsesByFieldId.notes?.state).toBe("skipped");
      expect(form.responsesByFieldId.notes?.value).toBeUndefined();
    });

    it("un-skips field when setting a value", () => {
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-field id="notes" label="Notes" %}{% /string-field %}
{% /field-group %}

{% /form %}
`;
      const form = parseForm(markdown);

      // First skip the field
      applyPatches(form, [{ op: "skip_field", fieldId: "notes", role: "agent" }]);
      expect(form.responsesByFieldId.notes?.state).toBe("skipped");

      // Then set a value
      const result = applyPatches(form, [
        { op: "set_string", fieldId: "notes", value: "New value" },
      ]);

      expect(result.applyStatus).toBe("applied");
      expect(form.responsesByFieldId.notes?.state).toBe("answered");
      expect(form.responsesByFieldId.notes?.value).toEqual({
        kind: "string",
        value: "New value",
      });
    });
  });

  describe("result summaries", () => {
    it("returns updated summaries after applying patches", () => {
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-field id="name" label="Name" required=true %}{% /string-field %}
{% /field-group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const patches: Patch[] = [
        { op: "set_string", fieldId: "name", value: "John" },
      ];

      const result = applyPatches(form, patches);

      expect(result.applyStatus).toBe("applied");
      expect(result.structureSummary.fieldCount).toBe(1);
      expect(result.progressSummary.counts.answeredFields).toBe(1);
      expect(result.formState).toBe("complete");
      expect(result.isComplete).toBe(true);
    });
  });
});
