import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { parseForm, ParseError } from "../../../src/engine/parse.js";

describe("engine/parse", () => {
  describe("parseForm", () => {
    it("parses a minimal form", () => {
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
      const result = parseForm(markdown);

      expect(result.schema.id).toBe("test_form");
      expect(result.schema.title).toBe("Test Form");
      expect(result.schema.groups).toHaveLength(1);

      const group = result.schema.groups[0];
      expect(group?.id).toBe("group1");
      expect(group?.children).toHaveLength(1);

      const field = group?.children[0];
      expect(field?.kind).toBe("string");
      expect(field?.id).toBe("name");
      expect(field?.label).toBe("Name");
    });

    it("parses string field with value", () => {
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
      const result = parseForm(markdown);
      const value = result.valuesByFieldId.company;

      expect(value).toBeDefined();
      expect(value?.kind).toBe("string");
      if (value?.kind === "string") {
        expect(value.value).toBe("ACME Corp");
      }
    });

    it("parses number field with value", () => {
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
      const result = parseForm(markdown);
      const value = result.valuesByFieldId.revenue;

      expect(value).toBeDefined();
      expect(value?.kind).toBe("number");
      if (value?.kind === "number") {
        expect(value.value).toBe(1234.56);
      }
    });

    it("parses string-list field with values", () => {
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
      const result = parseForm(markdown);
      const value = result.valuesByFieldId.tags;

      expect(value).toBeDefined();
      expect(value?.kind).toBe("string_list");
      if (value?.kind === "string_list") {
        expect(value.items).toEqual(["Tag One", "Tag Two", "Tag Three"]);
      }
    });

    it("parses single-select field with selection", () => {
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
      const result = parseForm(markdown);

      // Check field schema
      const group = result.schema.groups[0];
      const field = group?.children[0];
      expect(field?.kind).toBe("single_select");
      if (field?.kind === "single_select") {
        expect(field.options).toHaveLength(3);
        expect(field.options[0]?.id).toBe("bullish");
        expect(field.options[1]?.id).toBe("neutral");
        expect(field.options[2]?.id).toBe("bearish");
      }

      // Check value
      const value = result.valuesByFieldId.rating;
      expect(value?.kind).toBe("single_select");
      if (value?.kind === "single_select") {
        expect(value.selected).toBe("neutral");
      }
    });

    it("parses multi-select field with selections", () => {
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
      const result = parseForm(markdown);
      const value = result.valuesByFieldId.categories;

      expect(value?.kind).toBe("multi_select");
      if (value?.kind === "multi_select") {
        expect(value.selected).toContain("tech");
        expect(value.selected).toContain("finance");
        expect(value.selected).not.toContain("health");
      }
    });

    it("parses checkboxes field with multi mode", () => {
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
      const result = parseForm(markdown);
      const value = result.valuesByFieldId.tasks;

      expect(value?.kind).toBe("checkboxes");
      if (value?.kind === "checkboxes") {
        expect(value.values.done_task).toBe("done");
        expect(value.values.in_progress).toBe("incomplete");
        expect(value.values.active_task).toBe("active");
        expect(value.values.na_task).toBe("na");
        expect(value.values.todo_task).toBe("todo");
      }
    });

    it("parses checkboxes field with explicit mode", () => {
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
      const result = parseForm(markdown);
      const value = result.valuesByFieldId.confirms;

      expect(value?.kind).toBe("checkboxes");
      if (value?.kind === "checkboxes") {
        expect(value.values.yes_item).toBe("yes");
        expect(value.values.no_item).toBe("no");
        expect(value.values.unfilled_item).toBe("unfilled");
      }
    });

    it("builds idIndex correctly", () => {
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test_form" %}

{% field-group id="group1" %}
{% string-field id="field1" label="Field 1" %}{% /string-field %}
{% single-select id="select1" label="Select 1" %}
- [ ] Option A {% #opt_a %}
- [ ] Option B {% #opt_b %}
{% /single-select %}
{% /field-group %}

{% /form %}
`;
      const result = parseForm(markdown);

      expect(result.idIndex.get("test_form")?.kind).toBe("form");
      expect(result.idIndex.get("group1")?.kind).toBe("group");
      expect(result.idIndex.get("field1")?.kind).toBe("field");
      expect(result.idIndex.get("select1")?.kind).toBe("field");
      expect(result.idIndex.get("select1.opt_a")?.kind).toBe("option");
      expect(result.idIndex.get("select1.opt_b")?.kind).toBe("option");
    });

    it("maintains order in orderIndex", () => {
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-field id="first" label="First" %}{% /string-field %}
{% string-field id="second" label="Second" %}{% /string-field %}
{% string-field id="third" label="Third" %}{% /string-field %}
{% /field-group %}

{% /form %}
`;
      const result = parseForm(markdown);

      expect(result.orderIndex).toEqual(["first", "second", "third"]);
    });

    it("throws on duplicate IDs", () => {
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-field id="name" label="Name 1" %}{% /string-field %}
{% string-field id="name" label="Name 2" %}{% /string-field %}
{% /field-group %}

{% /form %}
`;
      expect(() => parseForm(markdown)).toThrow(ParseError);
    });

    it("throws on duplicate option IDs within field", () => {
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test" %}

{% field-group id="g1" %}
{% single-select id="sel" label="Select" %}
- [ ] Option 1 {% #opt %}
- [ ] Option 2 {% #opt %}
{% /single-select %}
{% /field-group %}

{% /form %}
`;
      expect(() => parseForm(markdown)).toThrow(ParseError);
    });

    it("throws on missing option ID annotation", () => {
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test" %}

{% field-group id="g1" %}
{% single-select id="sel" label="Select" %}
- [ ] Option without ID
{% /single-select %}
{% /field-group %}

{% /form %}
`;
      expect(() => parseForm(markdown)).toThrow(ParseError);
    });

    it("throws on missing label attribute", () => {
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-field id="name" %}{% /string-field %}
{% /field-group %}

{% /form %}
`;
      expect(() => parseForm(markdown)).toThrow(ParseError);
    });

    it("throws when no form tag present", () => {
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

No form here.
`;
      expect(() => parseForm(markdown)).toThrow(ParseError);
    });
  });

  describe("parseForm with simple.form.md", () => {
    it("parses the simple test form", async () => {
      const formPath = join(
        import.meta.dirname,
        "../../../examples/simple/simple.form.md"
      );
      const content = await readFile(formPath, "utf-8");
      const result = parseForm(content);

      // Basic structure checks
      expect(result.schema.id).toBe("simple_test");
      expect(result.schema.title).toBe("Simple Test Form");
      expect(result.schema.groups.length).toBeGreaterThan(0);

      // Check that we got expected fields
      const fieldIds = result.orderIndex;
      expect(fieldIds).toContain("name");
      expect(fieldIds).toContain("email");
      expect(fieldIds).toContain("age");
      expect(fieldIds).toContain("tags");
      expect(fieldIds).toContain("priority");
      expect(fieldIds).toContain("categories");
      expect(fieldIds).toContain("tasks_multi");
      expect(fieldIds).toContain("tasks_simple");
      expect(fieldIds).toContain("confirmations");

      // Check idIndex has form, groups, fields, and options
      expect(result.idIndex.get("simple_test")?.kind).toBe("form");
      expect(result.idIndex.get("basic_fields")?.kind).toBe("group");
      expect(result.idIndex.get("name")?.kind).toBe("field");
      expect(result.idIndex.get("priority.low")?.kind).toBe("option");
    });
  });

  describe("doc block edge cases", () => {
    it("allows multiple doc blocks with same ref but different kinds", () => {
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-field id="name" label="Name" %}{% /string-field %}

{% doc ref="name" kind="description" %}
This is a description.
{% /doc %}

{% doc ref="name" kind="instructions" %}
Enter your full name.
{% /doc %}
{% /field-group %}

{% /form %}
`;
      const result = parseForm(markdown);
      expect(result.docs).toHaveLength(2);
      expect(result.docs[0]?.kind).toBe("description");
      expect(result.docs[1]?.kind).toBe("instructions");
    });

    it("throws on duplicate doc blocks with same ref and same kind", () => {
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-field id="name" label="Name" %}{% /string-field %}

{% doc ref="name" kind="description" %}
First description.
{% /doc %}

{% doc ref="name" kind="description" %}
Second description.
{% /doc %}
{% /field-group %}

{% /form %}
`;
      expect(() => parseForm(markdown)).toThrow(ParseError);
      expect(() => parseForm(markdown)).toThrow(/Duplicate doc block/);
    });

    it("throws on duplicate doc blocks with same ref and no kind (defaulted)", () => {
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-field id="name" label="Name" %}{% /string-field %}

{% doc ref="name" %}
First doc without kind.
{% /doc %}

{% doc ref="name" %}
Second doc without kind.
{% /doc %}
{% /field-group %}

{% /form %}
`;
      expect(() => parseForm(markdown)).toThrow(ParseError);
      expect(() => parseForm(markdown)).toThrow(/Duplicate doc block/);
    });

    it("allows doc block without kind and another with kind for same ref", () => {
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-field id="name" label="Name" %}{% /string-field %}

{% doc ref="name" %}
Doc without kind.
{% /doc %}

{% doc ref="name" kind="instructions" %}
Doc with instructions kind.
{% /doc %}
{% /field-group %}

{% /form %}
`;
      const result = parseForm(markdown);
      expect(result.docs).toHaveLength(2);
      expect(result.docs[0]?.kind).toBeUndefined();
      expect(result.docs[1]?.kind).toBe("instructions");
    });
  });
});
