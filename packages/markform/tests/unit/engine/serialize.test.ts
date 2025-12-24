import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { parseForm } from "../../../src/engine/parse.js";
import { serialize, serializeRawMarkdown } from "../../../src/engine/serialize.js";

describe("engine/serialize", () => {
  describe("serialize", () => {
    it("serializes a minimal form", () => {
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test_form" title="Test Form" %}

{% field-group id="group1" title="Group 1" %}
{% string-field id="name" label="Name" required=true %}{% /string-field %}
{% /field-group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const output = serialize(parsed);

      // Parse the output to verify it's valid
      const reparsed = parseForm(output);
      expect(reparsed.schema.id).toBe("test_form");
      expect(reparsed.schema.title).toBe("Test Form");
      expect(reparsed.schema.groups).toHaveLength(1);
    });

    it("serializes string field with value", () => {
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test" %}

{% field-group id="g1" title="G1" %}
{% string-field id="company" label="Company" %}
\`\`\`value
ACME Corp
\`\`\`
{% /string-field %}
{% /field-group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const output = serialize(parsed);
      const reparsed = parseForm(output);

      const value = reparsed.valuesByFieldId.company;
      expect(value?.kind).toBe("string");
      if (value?.kind === "string") {
        expect(value.value).toBe("ACME Corp");
      }
    });

    it("serializes number field with value", () => {
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test" %}

{% field-group id="g1" title="G1" %}
{% number-field id="revenue" label="Revenue" %}
\`\`\`value
1234.56
\`\`\`
{% /number-field %}
{% /field-group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const output = serialize(parsed);
      const reparsed = parseForm(output);

      const value = reparsed.valuesByFieldId.revenue;
      expect(value?.kind).toBe("number");
      if (value?.kind === "number") {
        expect(value.value).toBe(1234.56);
      }
    });

    it("serializes string-list field with values", () => {
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test" %}

{% field-group id="g1" title="G1" %}
{% string-list id="tags" label="Tags" %}
\`\`\`value
Tag One
Tag Two
Tag Three
\`\`\`
{% /string-list %}
{% /field-group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const output = serialize(parsed);
      const reparsed = parseForm(output);

      const value = reparsed.valuesByFieldId.tags;
      expect(value?.kind).toBe("string_list");
      if (value?.kind === "string_list") {
        expect(value.items).toEqual(["Tag One", "Tag Two", "Tag Three"]);
      }
    });

    it("serializes single-select field with selection", () => {
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test" %}

{% field-group id="g1" title="G1" %}
{% single-select id="rating" label="Rating" %}
- [ ] Bullish {% #bullish %}
- [x] Neutral {% #neutral %}
- [ ] Bearish {% #bearish %}
{% /single-select %}
{% /field-group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const output = serialize(parsed);
      const reparsed = parseForm(output);

      // Check field schema
      const group = reparsed.schema.groups[0];
      const field = group?.children[0];
      expect(field?.kind).toBe("single_select");
      if (field?.kind === "single_select") {
        expect(field.options).toHaveLength(3);
      }

      // Check value preserved
      const value = reparsed.valuesByFieldId.rating;
      expect(value?.kind).toBe("single_select");
      if (value?.kind === "single_select") {
        expect(value.selected).toBe("neutral");
      }
    });

    it("serializes multi-select field with selections", () => {
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test" %}

{% field-group id="g1" title="G1" %}
{% multi-select id="categories" label="Categories" %}
- [x] Tech {% #tech %}
- [ ] Health {% #health %}
- [x] Finance {% #finance %}
{% /multi-select %}
{% /field-group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const output = serialize(parsed);
      const reparsed = parseForm(output);

      const value = reparsed.valuesByFieldId.categories;
      expect(value?.kind).toBe("multi_select");
      if (value?.kind === "multi_select") {
        expect(value.selected).toContain("tech");
        expect(value.selected).toContain("finance");
        expect(value.selected).not.toContain("health");
      }
    });

    it("serializes checkboxes field with multi mode", () => {
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test" %}

{% field-group id="g1" title="G1" %}
{% checkboxes id="tasks" label="Tasks" checkboxMode="multi" %}
- [x] Done task {% #done_task %}
- [/] In progress {% #in_progress %}
- [*] Active {% #active_task %}
- [-] Not applicable {% #na_task %}
- [ ] Todo {% #todo_task %}
{% /checkboxes %}
{% /field-group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const output = serialize(parsed);
      const reparsed = parseForm(output);

      const value = reparsed.valuesByFieldId.tasks;
      expect(value?.kind).toBe("checkboxes");
      if (value?.kind === "checkboxes") {
        expect(value.values.done_task).toBe("done");
        expect(value.values.in_progress).toBe("incomplete");
        expect(value.values.active_task).toBe("active");
        expect(value.values.na_task).toBe("na");
        expect(value.values.todo_task).toBe("todo");
      }
    });

    it("serializes checkboxes field with explicit mode", () => {
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test" %}

{% field-group id="g1" title="G1" %}
{% checkboxes id="confirms" label="Confirms" checkboxMode="explicit" %}
- [y] Yes answer {% #yes_item %}
- [n] No answer {% #no_item %}
- [ ] Unfilled {% #unfilled_item %}
{% /checkboxes %}
{% /field-group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const output = serialize(parsed);
      const reparsed = parseForm(output);

      const value = reparsed.valuesByFieldId.confirms;
      expect(value?.kind).toBe("checkboxes");
      if (value?.kind === "checkboxes") {
        expect(value.values.yes_item).toBe("yes");
        expect(value.values.no_item).toBe("no");
        expect(value.values.unfilled_item).toBe("unfilled");
      }
    });

    it("preserves field attributes through round-trip", () => {
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test" %}

{% field-group id="g1" title="Group Title" %}
{% string-field id="email" label="Email" required=true minLength=5 maxLength=100 pattern="^[^@]+@[^@]+$" %}{% /string-field %}
{% number-field id="count" label="Count" required=true min=0 max=1000 integer=true %}{% /number-field %}
{% /field-group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const output = serialize(parsed);
      const reparsed = parseForm(output);

      const group = reparsed.schema.groups[0];
      expect(group?.title).toBe("Group Title");

      const emailField = group?.children[0];
      expect(emailField?.kind).toBe("string");
      if (emailField?.kind === "string") {
        expect(emailField.required).toBe(true);
        expect(emailField.minLength).toBe(5);
        expect(emailField.maxLength).toBe(100);
        expect(emailField.pattern).toBe("^[^@]+@[^@]+$");
      }

      const countField = group?.children[1];
      expect(countField?.kind).toBe("number");
      if (countField?.kind === "number") {
        expect(countField.required).toBe(true);
        expect(countField.min).toBe(0);
        expect(countField.max).toBe(1000);
        expect(countField.integer).toBe(true);
      }
    });

    it("outputs deterministic format", () => {
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test" %}

{% field-group id="g1" title="G1" %}
{% string-field id="name" label="Name" %}{% /string-field %}
{% /field-group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const output1 = serialize(parsed);
      const output2 = serialize(parsed);
      expect(output1).toBe(output2);
    });

    it("serializes validate attribute with object arrays correctly", () => {
      // This test ensures we don't regress on the [object Object] bug
      // where validate=[{id: "min_words", min: 50}] was serialized as [[object Object]]
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test" %}

{% field-group id="g1" title="G1" %}
{% string-field id="summary" label="Summary" required=true validate=[{id: "min_words", min: 50}] %}{% /string-field %}
{% string-field id="description" label="Description" validate=[{id: "min_words", min: 25}, {id: "max_words", max: 100}] %}{% /string-field %}
{% /field-group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const output = serialize(parsed);

      // Must not contain [object Object] - this was the bug
      expect(output).not.toContain("[object Object]");

      // Should contain properly serialized validate attributes
      expect(output).toContain('validate=[{id: "min_words", min: 50}]');
      expect(output).toContain('validate=[{id: "min_words", min: 25}, {id: "max_words", max: 100}]');

      // Round-trip: parse the output and verify validate is preserved
      const reparsed = parseForm(output);
      const group = reparsed.schema.groups[0];

      const summaryField = group?.children[0];
      expect(summaryField?.kind).toBe("string");
      if (summaryField?.kind === "string") {
        expect(summaryField.validate).toHaveLength(1);
        expect(summaryField.validate?.[0]).toEqual({ id: "min_words", min: 50 });
      }

      const descField = group?.children[1];
      expect(descField?.kind).toBe("string");
      if (descField?.kind === "string") {
        expect(descField.validate).toHaveLength(2);
        expect(descField.validate?.[0]).toEqual({ id: "min_words", min: 25 });
        expect(descField.validate?.[1]).toEqual({ id: "max_words", max: 100 });
      }
    });

    it("serializes nested objects in attributes", () => {
      // Test that deeply nested objects are also serialized correctly
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test" %}

{% field-group id="g1" title="G1" %}
{% string-field id="item" label="Item" validate=[{id: "custom", config: {threshold: 10, enabled: true}}] %}{% /string-field %}
{% /field-group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const output = serialize(parsed);

      expect(output).not.toContain("[object Object]");
      expect(output).toContain("config: {threshold: 10, enabled: true}");

      // Verify round-trip
      const reparsed = parseForm(output);
      const field = reparsed.schema.groups[0]?.children[0];
      if (field?.kind === "string") {
        expect(field.validate?.[0]).toEqual({
          id: "custom",
          config: { threshold: 10, enabled: true },
        });
      }
    });
  });

  describe("serialize with simple.form.md", () => {
    it("round-trips the simple test form", async () => {
      const formPath = join(
        import.meta.dirname,
        "../../../examples/simple/simple.form.md"
      );
      const content = await readFile(formPath, "utf-8");
      const parsed = parseForm(content);
      const output = serialize(parsed);
      const reparsed = parseForm(output);

      // Compare structure
      expect(reparsed.schema.id).toBe(parsed.schema.id);
      expect(reparsed.schema.title).toBe(parsed.schema.title);
      expect(reparsed.schema.groups.length).toBe(parsed.schema.groups.length);

      // Compare field IDs
      expect(reparsed.orderIndex).toEqual(parsed.orderIndex);

      // Verify key fields exist
      expect(reparsed.orderIndex).toContain("name");
      expect(reparsed.orderIndex).toContain("email");
      expect(reparsed.orderIndex).toContain("age");
      expect(reparsed.orderIndex).toContain("tags");
      expect(reparsed.orderIndex).toContain("priority");
      expect(reparsed.orderIndex).toContain("categories");

      // Check idIndex has correct types
      expect(reparsed.idIndex.get("simple_test")?.kind).toBe("form");
      expect(reparsed.idIndex.get("basic_fields")?.kind).toBe("group");
      expect(reparsed.idIndex.get("name")?.kind).toBe("field");
      expect(reparsed.idIndex.get("priority.low")?.kind).toBe("option");
    });
  });

  describe("serializeRawMarkdown", () => {
    it("outputs plain markdown without markdoc directives for string field", () => {
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test" title="Test Form" %}

{% field-group id="g1" title="Basic Info" %}
{% string-field id="company" label="Company Name" %}
\`\`\`value
ACME Corp
\`\`\`
{% /string-field %}
{% /field-group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const output = serializeRawMarkdown(parsed);

      // Should not contain markdoc directives
      expect(output).not.toContain("{%");
      expect(output).not.toContain("%}");
      expect(output).not.toContain("```value");

      // Should contain the form title and group header
      expect(output).toContain("# Test Form");
      expect(output).toContain("## Basic Info");

      // Should contain field label and value
      expect(output).toContain("**Company Name:**");
      expect(output).toContain("ACME Corp");
    });

    it("outputs plain markdown for number field", () => {
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test" %}

{% field-group id="g1" %}
{% number-field id="revenue" label="Revenue" %}
\`\`\`value
1234567
\`\`\`
{% /number-field %}
{% /field-group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const output = serializeRawMarkdown(parsed);

      expect(output).not.toContain("{%");
      expect(output).toContain("**Revenue:**");
      expect(output).toContain("1234567");
    });

    it("outputs plain markdown for string-list field", () => {
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-list id="tags" label="Tags" %}
\`\`\`value
Technology
Finance
Healthcare
\`\`\`
{% /string-list %}
{% /field-group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const output = serializeRawMarkdown(parsed);

      expect(output).not.toContain("{%");
      expect(output).toContain("**Tags:**");
      expect(output).toContain("Technology");
      expect(output).toContain("Finance");
      expect(output).toContain("Healthcare");
    });

    it("outputs plain markdown for single-select field", () => {
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test" %}

{% field-group id="g1" %}
{% single-select id="rating" label="Rating" %}
- [ ] Bullish {% #bullish %}
- [x] Neutral {% #neutral %}
- [ ] Bearish {% #bearish %}
{% /single-select %}
{% /field-group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const output = serializeRawMarkdown(parsed);

      expect(output).not.toContain("{%");
      expect(output).toContain("**Rating:**");
      expect(output).toContain("Neutral");
    });

    it("outputs plain markdown for multi-select field", () => {
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test" %}

{% field-group id="g1" %}
{% multi-select id="sectors" label="Sectors" %}
- [x] Technology {% #tech %}
- [ ] Finance {% #finance %}
- [x] Healthcare {% #health %}
{% /multi-select %}
{% /field-group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const output = serializeRawMarkdown(parsed);

      expect(output).not.toContain("{%");
      expect(output).toContain("**Sectors:**");
      expect(output).toContain("Technology");
      expect(output).toContain("Healthcare");
    });

    it("outputs plain markdown for checkboxes field", () => {
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test" %}

{% field-group id="g1" %}
{% checkboxes id="tasks" label="Tasks" %}
- [x] Task 1 {% #task1 %}
- [ ] Task 2 {% #task2 %}
- [/] Task 3 {% #task3 %}
{% /checkboxes %}
{% /field-group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const output = serializeRawMarkdown(parsed);

      expect(output).not.toContain("{%");
      expect(output).toContain("**Tasks:**");
      // Should show checkboxes in GFM format
      expect(output).toContain("- [x] Task 1");
      expect(output).toContain("- [ ] Task 2");
      expect(output).toContain("- [/] Task 3");
    });

    it("shows empty placeholder for unfilled fields", () => {
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
      const parsed = parseForm(markdown);
      const output = serializeRawMarkdown(parsed);

      expect(output).not.toContain("{%");
      expect(output).toContain("**Name:**");
      expect(output).toContain("_(empty)_");
    });

    it("includes doc blocks as regular markdown", () => {
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test" title="Test Form" %}

{% instructions ref="test" %}
Please fill out this form carefully.
{% /instructions %}

{% field-group id="g1" title="Group 1" %}
{% string-field id="name" label="Name" %}{% /string-field %}

{% description ref="name" %}
Enter your full legal name.
{% /description %}
{% /field-group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const output = serializeRawMarkdown(parsed);

      expect(output).not.toContain("{%");
      expect(output).toContain("Please fill out this form carefully.");
      expect(output).toContain("Enter your full legal name.");
    });
  });
});
