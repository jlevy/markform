/**
 * Tests for interactive prompts module.
 *
 * Since @clack/prompts requires TTY input, we mock it to test the logic.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

import type {
  Field,
  StringField,
  NumberField,
  StringListField,
  SingleSelectField,
  MultiSelectField,
  CheckboxesField,
  UrlField,
  UrlListField,
  ParsedForm,
  InspectIssue,
} from "../../../src/engine/coreTypes.js";

// Mock @clack/prompts
vi.mock("@clack/prompts", () => ({
  text: vi.fn(),
  select: vi.fn(),
  multiselect: vi.fn(),
  confirm: vi.fn(),
  note: vi.fn(),
  intro: vi.fn(),
  outro: vi.fn(),
  cancel: vi.fn(),
  isCancel: vi.fn().mockReturnValue(false),
}));

// Mock picocolors (just pass through)
vi.mock("picocolors", () => ({
  default: {
    red: (s: string) => s,
    dim: (s: string) => s,
    bold: (s: string) => s,
    green: (s: string) => s,
    yellow: (s: string) => s,
    bgCyan: (s: string) => s,
    black: (s: string) => s,
  },
}));

// Import after mocking
import * as p from "@clack/prompts";
import {
  promptForField,
  runInteractiveFill,
  showInteractiveIntro,
  showInteractiveOutro,
} from "../../../src/cli/lib/interactivePrompts.js";

// Helper to create minimal form for testing
function createTestForm(fields: Field[]): ParsedForm {
  return {
    schema: {
      id: "test_form",
      title: "Test Form",
      groups: [
        {
          id: "test_group",
          title: "Test Group",
          children: fields,
        },
      ],
    },
    responsesByFieldId: {},
    notes: [],
    docs: [],
    orderIndex: fields.map((f) => f.id),
    idIndex: new Map(),
  };
}

// Helper to create field prompt context
function createContext(field: Field, index = 1, total = 1) {
  return {
    field,
    currentValue: undefined,
    description: undefined as string | undefined,
    index,
    total,
  };
}

describe("interactivePrompts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("promptForField", () => {
    describe("string field", () => {
      const stringField: StringField = {
        kind: "string",
        id: "name",
        label: "Name",
        required: true,
        priority: "medium",
        role: "user",
      };

      it("returns set_string patch for string field", async () => {
        vi.mocked(p.text).mockResolvedValue("Alice");

        const patch = await promptForField(createContext(stringField));

        expect(patch).toEqual({
          op: "set_string",
          fieldId: "name",
          value: "Alice",
        });
      });

      it("returns null for optional field with empty input", async () => {
        const optionalField: StringField = { ...stringField, required: false };
        vi.mocked(p.text).mockResolvedValue("");

        const patch = await promptForField(createContext(optionalField));

        expect(patch).toBeNull();
      });

      it("returns null on cancel", async () => {
        vi.mocked(p.text).mockResolvedValue(Symbol.for("cancel"));
        vi.mocked(p.isCancel).mockReturnValue(true);

        const patch = await promptForField(createContext(stringField));

        expect(patch).toBeNull();
      });
    });

    describe("number field", () => {
      const numberField: NumberField = {
        kind: "number",
        id: "age",
        label: "Age",
        required: true,
        priority: "medium",
        role: "user",
        min: 0,
        max: 150,
      };

      it("returns set_number patch for number field", async () => {
        vi.mocked(p.text).mockResolvedValue("25");
        vi.mocked(p.isCancel).mockReturnValue(false);

        const patch = await promptForField(createContext(numberField));

        expect(patch).toEqual({
          op: "set_number",
          fieldId: "age",
          value: 25,
        });
      });

      it("returns null for optional field with empty input", async () => {
        const optionalField: NumberField = { ...numberField, required: false };
        vi.mocked(p.text).mockResolvedValue("");
        vi.mocked(p.isCancel).mockReturnValue(false);

        const patch = await promptForField(createContext(optionalField));

        expect(patch).toBeNull();
      });
    });

    describe("string_list field", () => {
      const stringListField: StringListField = {
        kind: "string_list",
        id: "tags",
        label: "Tags",
        required: true,
        priority: "medium",
        role: "user",
      };

      it("returns set_string_list patch with items", async () => {
        vi.mocked(p.text).mockResolvedValue("tag1\ntag2\ntag3");
        vi.mocked(p.isCancel).mockReturnValue(false);

        const patch = await promptForField(createContext(stringListField));

        expect(patch).toEqual({
          op: "set_string_list",
          fieldId: "tags",
          items: ["tag1", "tag2", "tag3"],
        });
      });

      it("filters empty lines from items", async () => {
        vi.mocked(p.text).mockResolvedValue("tag1\n\ntag2\n  \ntag3");
        vi.mocked(p.isCancel).mockReturnValue(false);

        const patch = await promptForField(createContext(stringListField));

        expect(patch).toEqual({
          op: "set_string_list",
          fieldId: "tags",
          items: ["tag1", "tag2", "tag3"],
        });
      });

      it("returns null for optional field with empty input", async () => {
        const optionalField: StringListField = {
          ...stringListField,
          required: false,
        };
        vi.mocked(p.text).mockResolvedValue("");
        vi.mocked(p.isCancel).mockReturnValue(false);

        const patch = await promptForField(createContext(optionalField));

        expect(patch).toBeNull();
      });
    });

    describe("single_select field", () => {
      const singleSelectField: SingleSelectField = {
        kind: "single_select",
        id: "color",
        label: "Color",
        required: true,
        priority: "medium",
        role: "user",
        options: [
          { id: "red", label: "Red" },
          { id: "blue", label: "Blue" },
          { id: "green", label: "Green" },
        ],
      };

      it("returns set_single_select patch", async () => {
        vi.mocked(p.select).mockResolvedValue("blue");
        vi.mocked(p.isCancel).mockReturnValue(false);

        const patch = await promptForField(createContext(singleSelectField));

        expect(patch).toEqual({
          op: "set_single_select",
          fieldId: "color",
          selected: "blue",
        });
      });
    });

    describe("multi_select field", () => {
      const multiSelectField: MultiSelectField = {
        kind: "multi_select",
        id: "colors",
        label: "Colors",
        required: true,
        priority: "medium",
        role: "user",
        options: [
          { id: "red", label: "Red" },
          { id: "blue", label: "Blue" },
          { id: "green", label: "Green" },
        ],
      };

      it("returns set_multi_select patch with selected items", async () => {
        vi.mocked(p.multiselect).mockResolvedValue(["red", "green"]);
        vi.mocked(p.isCancel).mockReturnValue(false);

        const patch = await promptForField(createContext(multiSelectField));

        expect(patch).toEqual({
          op: "set_multi_select",
          fieldId: "colors",
          selected: ["red", "green"],
        });
      });
    });

    describe("checkboxes field", () => {
      describe("simple mode", () => {
        const simpleCheckboxes: CheckboxesField = {
          kind: "checkboxes",
          id: "tasks",
          label: "Tasks",
          required: false,
          priority: "medium",
          role: "user",
          checkboxMode: "simple",
          approvalMode: "none",
          options: [
            { id: "task1", label: "Task 1" },
            { id: "task2", label: "Task 2" },
            { id: "task3", label: "Task 3" },
          ],
        };

        it("returns set_checkboxes patch with done/todo values", async () => {
          vi.mocked(p.multiselect).mockResolvedValue(["task1", "task3"]);
          vi.mocked(p.isCancel).mockReturnValue(false);

          const patch = await promptForField(createContext(simpleCheckboxes));

          expect(patch).toEqual({
            op: "set_checkboxes",
            fieldId: "tasks",
            values: {
              task1: "done",
              task2: "todo",
              task3: "done",
            },
          });
        });
      });

      describe("explicit mode", () => {
        const explicitCheckboxes: CheckboxesField = {
          kind: "checkboxes",
          id: "confirmations",
          label: "Confirmations",
          required: true,
          priority: "medium",
          role: "user",
          checkboxMode: "explicit",
          approvalMode: "none",
          options: [
            { id: "agree", label: "I agree" },
            { id: "confirm", label: "I confirm" },
          ],
        };

        it("returns set_checkboxes patch with yes/no values", async () => {
          vi.mocked(p.select)
            .mockResolvedValueOnce("yes")
            .mockResolvedValueOnce("no");
          vi.mocked(p.isCancel).mockReturnValue(false);

          const patch = await promptForField(createContext(explicitCheckboxes));

          expect(patch).toEqual({
            op: "set_checkboxes",
            fieldId: "confirmations",
            values: {
              agree: "yes",
              confirm: "no",
            },
          });
        });
      });

      describe("multi mode", () => {
        const multiCheckboxes: CheckboxesField = {
          kind: "checkboxes",
          id: "checklist",
          label: "Checklist",
          required: false,
          priority: "medium",
          role: "user",
          checkboxMode: "multi",
          approvalMode: "none",
          options: [
            { id: "item1", label: "Item 1" },
            { id: "item2", label: "Item 2" },
          ],
        };

        it("returns set_checkboxes patch with 5-state values", async () => {
          vi.mocked(p.select)
            .mockResolvedValueOnce("fill") // First call: skip/fill choice
            .mockResolvedValueOnce("done") // Second call: item1 state
            .mockResolvedValueOnce("active"); // Third call: item2 state
          vi.mocked(p.isCancel).mockReturnValue(false);

          const patch = await promptForField(createContext(multiCheckboxes));

          expect(patch).toEqual({
            op: "set_checkboxes",
            fieldId: "checklist",
            values: {
              item1: "done",
              item2: "active",
            },
          });
        });
      });
    });

    describe("url field", () => {
      const urlField: UrlField = {
        kind: "url",
        id: "website",
        label: "Website",
        required: true,
        priority: "medium",
        role: "user",
      };

      it("returns set_url patch for url field", async () => {
        vi.mocked(p.text).mockResolvedValue("https://example.com");
        vi.mocked(p.isCancel).mockReturnValue(false);

        const patch = await promptForField(createContext(urlField));

        expect(patch).toEqual({
          op: "set_url",
          fieldId: "website",
          value: "https://example.com",
        });
      });

      it("returns null for optional url field with empty input", async () => {
        const optionalField: UrlField = { ...urlField, required: false };
        vi.mocked(p.text).mockResolvedValue("");
        vi.mocked(p.isCancel).mockReturnValue(false);

        const patch = await promptForField(createContext(optionalField));

        expect(patch).toBeNull();
      });
    });

    describe("url_list field", () => {
      const urlListField: UrlListField = {
        kind: "url_list",
        id: "references",
        label: "References",
        required: true,
        priority: "medium",
        role: "user",
      };

      it("returns set_url_list patch with items", async () => {
        vi.mocked(p.text).mockResolvedValue("https://example1.com\nhttps://example2.com");
        vi.mocked(p.isCancel).mockReturnValue(false);

        const patch = await promptForField(createContext(urlListField));

        expect(patch).toEqual({
          op: "set_url_list",
          fieldId: "references",
          items: ["https://example1.com", "https://example2.com"],
        });
      });

      it("filters empty lines from URL list", async () => {
        vi.mocked(p.text).mockResolvedValue("https://example1.com\n\nhttps://example2.com\n  ");
        vi.mocked(p.isCancel).mockReturnValue(false);

        const patch = await promptForField(createContext(urlListField));

        expect(patch).toEqual({
          op: "set_url_list",
          fieldId: "references",
          items: ["https://example1.com", "https://example2.com"],
        });
      });

      it("returns null for optional url_list field with empty input", async () => {
        const optionalField: UrlListField = { ...urlListField, required: false };
        vi.mocked(p.text).mockResolvedValue("");
        vi.mocked(p.isCancel).mockReturnValue(false);

        const patch = await promptForField(createContext(optionalField));

        expect(patch).toBeNull();
      });
    });

    it("shows field description when available", async () => {
      const field: StringField = {
        kind: "string",
        id: "name",
        label: "Name",
        required: false,
        priority: "medium",
        role: "user",
      };
      vi.mocked(p.text).mockResolvedValue("");
      vi.mocked(p.isCancel).mockReturnValue(false);

      const ctx = createContext(field);
      ctx.description = "Enter your full name";
      await promptForField(ctx);

      expect(p.note).toHaveBeenCalledWith("Enter your full name", "Instructions");
    });
  });

  describe("runInteractiveFill", () => {
    it("filters to field-level issues only", async () => {
      const field: StringField = {
        kind: "string",
        id: "name",
        label: "Name",
        required: true,
        priority: "medium",
        role: "user",
      };
      const form = createTestForm([field]);
      const issues: InspectIssue[] = [
        {
          ref: "name",
          scope: "field",
          reason: "required_missing",
          message: "Required",
          severity: "required",
          priority: 1,
        },
        {
          ref: "test_group",
          scope: "group",
          reason: "validation_error",
          message: "Group error",
          severity: "recommended",
          priority: 2,
        },
      ];

      vi.mocked(p.text).mockResolvedValue("Alice");
      vi.mocked(p.isCancel).mockReturnValue(false);

      const result = await runInteractiveFill(form, issues);

      // Should only process the field issue, not the group issue
      expect(p.text).toHaveBeenCalledTimes(1);
      expect(result.patches).toHaveLength(1);
    });

    it("deduplicates issues by field ID", async () => {
      const field: StringField = {
        kind: "string",
        id: "name",
        label: "Name",
        required: true,
        priority: "medium",
        role: "user",
      };
      const form = createTestForm([field]);
      const issues: InspectIssue[] = [
        {
          ref: "name",
          scope: "field",
          reason: "required_missing",
          message: "Required",
          severity: "required",
          priority: 1,
        },
        {
          ref: "name",
          scope: "field",
          reason: "validation_error",
          message: "Invalid",
          severity: "required",
          priority: 2,
        },
      ];

      vi.mocked(p.text).mockResolvedValue("Alice");
      vi.mocked(p.isCancel).mockReturnValue(false);

      const result = await runInteractiveFill(form, issues);

      // Should only prompt once despite two issues for same field
      expect(p.text).toHaveBeenCalledTimes(1);
      expect(result.patches).toHaveLength(1);
    });

    it("returns empty patches when no field issues", async () => {
      const form = createTestForm([]);
      const issues: InspectIssue[] = [];

      const result = await runInteractiveFill(form, issues);

      expect(result.patches).toEqual([]);
      expect(result.cancelled).toBe(false);
      expect(p.note).toHaveBeenCalledWith(
        "No fields to fill for the selected role.",
        "Info"
      );
    });

    it("collects patches from multiple fields", async () => {
      const field1: StringField = {
        kind: "string",
        id: "name",
        label: "Name",
        required: true,
        priority: "medium",
        role: "user",
      };
      const field2: NumberField = {
        kind: "number",
        id: "age",
        label: "Age",
        required: true,
        priority: "medium",
        role: "user",
      };
      const form = createTestForm([field1, field2]);
      const issues: InspectIssue[] = [
        {
          ref: "name",
          scope: "field",
          reason: "required_missing",
          message: "Required",
          severity: "required",
          priority: 1,
        },
        {
          ref: "age",
          scope: "field",
          reason: "required_missing",
          message: "Required",
          severity: "required",
          priority: 2,
        },
      ];

      vi.mocked(p.text).mockResolvedValueOnce("Alice").mockResolvedValueOnce("30");
      vi.mocked(p.isCancel).mockReturnValue(false);

      const result = await runInteractiveFill(form, issues);

      expect(result.patches).toHaveLength(2);
      expect(result.patches[0]).toEqual({
        op: "set_string",
        fieldId: "name",
        value: "Alice",
      });
      expect(result.patches[1]).toEqual({
        op: "set_number",
        fieldId: "age",
        value: 30,
      });
    });
  });

  describe("showInteractiveIntro", () => {
    it("shows intro with form info", () => {
      showInteractiveIntro("My Form", "user", 5);

      expect(p.intro).toHaveBeenCalled();
      expect(p.note).toHaveBeenCalled();
    });
  });

  describe("showInteractiveOutro", () => {
    it("shows cancel message when cancelled", () => {
      showInteractiveOutro(0, true);

      expect(p.cancel).toHaveBeenCalledWith("Interactive fill cancelled.");
    });

    it("shows no changes message when patch count is 0", () => {
      showInteractiveOutro(0, false);

      expect(p.outro).toHaveBeenCalledWith("No changes made.");
    });

    it("shows success message with patch count", () => {
      showInteractiveOutro(3, false);

      expect(p.outro).toHaveBeenCalledWith("✓ 3 field(s) updated.");
    });
  });

  describe("skip_field support", () => {
    describe("optional string field", () => {
      const optionalStringField: StringField = {
        kind: "string",
        id: "notes",
        label: "Notes",
        required: false,
        priority: "medium",
        role: "user",
      };

      it("shows skip option for optional field and returns skip_field patch when selected", async () => {
        // User selects "skip" option
        vi.mocked(p.select).mockResolvedValue("skip");
        vi.mocked(p.isCancel).mockReturnValue(false);

        const patch = await promptForField(createContext(optionalStringField));

        expect(p.select).toHaveBeenCalled();
        expect(patch).toEqual({
          op: "skip_field",
          fieldId: "notes",
          role: "user",
          reason: "User skipped in console",
        });
      });

      it("prompts for value when fill option is selected", async () => {
        // User selects "fill" then enters a value
        vi.mocked(p.select).mockResolvedValue("fill");
        vi.mocked(p.text).mockResolvedValue("My notes");
        vi.mocked(p.isCancel).mockReturnValue(false);

        const patch = await promptForField(createContext(optionalStringField));

        expect(p.select).toHaveBeenCalled();
        expect(p.text).toHaveBeenCalled();
        expect(patch).toEqual({
          op: "set_string",
          fieldId: "notes",
          value: "My notes",
        });
      });
    });

    describe("optional number field", () => {
      const optionalNumberField: NumberField = {
        kind: "number",
        id: "score",
        label: "Score",
        required: false,
        priority: "medium",
        role: "user",
      };

      it("shows skip option and returns skip_field patch when selected", async () => {
        vi.mocked(p.select).mockResolvedValue("skip");
        vi.mocked(p.isCancel).mockReturnValue(false);

        const patch = await promptForField(createContext(optionalNumberField));

        expect(patch).toEqual({
          op: "skip_field",
          fieldId: "score",
          role: "user",
          reason: "User skipped in console",
        });
      });
    });

    describe("optional string_list field", () => {
      const optionalStringListField: StringListField = {
        kind: "string_list",
        id: "tags",
        label: "Tags",
        required: false,
        priority: "medium",
        role: "user",
      };

      it("shows skip option and returns skip_field patch when selected", async () => {
        vi.mocked(p.select).mockResolvedValue("skip");
        vi.mocked(p.isCancel).mockReturnValue(false);

        const patch = await promptForField(createContext(optionalStringListField));

        expect(patch).toEqual({
          op: "skip_field",
          fieldId: "tags",
          role: "user",
          reason: "User skipped in console",
        });
      });
    });

    describe("optional single_select field", () => {
      const optionalSingleSelect: SingleSelectField = {
        kind: "single_select",
        id: "priority",
        label: "Priority",
        required: false,
        priority: "medium",
        role: "user",
        options: [
          { id: "low", label: "Low" },
          { id: "high", label: "High" },
        ],
      };

      it("shows skip option and returns skip_field patch when selected", async () => {
        vi.mocked(p.select).mockResolvedValue("skip");
        vi.mocked(p.isCancel).mockReturnValue(false);

        const patch = await promptForField(createContext(optionalSingleSelect));

        expect(patch).toEqual({
          op: "skip_field",
          fieldId: "priority",
          role: "user",
          reason: "User skipped in console",
        });
      });
    });

    describe("optional multi_select field", () => {
      const optionalMultiSelect: MultiSelectField = {
        kind: "multi_select",
        id: "categories",
        label: "Categories",
        required: false,
        priority: "medium",
        role: "user",
        options: [
          { id: "a", label: "A" },
          { id: "b", label: "B" },
        ],
      };

      it("shows skip option and returns skip_field patch when selected", async () => {
        vi.mocked(p.select).mockResolvedValue("skip");
        vi.mocked(p.isCancel).mockReturnValue(false);

        const patch = await promptForField(createContext(optionalMultiSelect));

        expect(patch).toEqual({
          op: "skip_field",
          fieldId: "categories",
          role: "user",
          reason: "User skipped in console",
        });
      });
    });

    describe("optional checkboxes field", () => {
      const optionalCheckboxes: CheckboxesField = {
        kind: "checkboxes",
        id: "tasks",
        label: "Tasks",
        required: false,
        priority: "medium",
        role: "user",
        checkboxMode: "simple",
        approvalMode: "none",
        options: [
          { id: "task1", label: "Task 1" },
        ],
      };

      it("shows skip option and returns skip_field patch when selected", async () => {
        vi.mocked(p.select).mockResolvedValue("skip");
        vi.mocked(p.isCancel).mockReturnValue(false);

        const patch = await promptForField(createContext(optionalCheckboxes));

        expect(patch).toEqual({
          op: "skip_field",
          fieldId: "tasks",
          role: "user",
          reason: "User skipped in console",
        });
      });
    });

    describe("optional url field", () => {
      const optionalUrlField: UrlField = {
        kind: "url",
        id: "website",
        label: "Website",
        required: false,
        priority: "medium",
        role: "user",
      };

      it("shows skip option and returns skip_field patch when selected", async () => {
        vi.mocked(p.select).mockResolvedValue("skip");
        vi.mocked(p.isCancel).mockReturnValue(false);

        const patch = await promptForField(createContext(optionalUrlField));

        expect(patch).toEqual({
          op: "skip_field",
          fieldId: "website",
          role: "user",
          reason: "User skipped in console",
        });
      });
    });

    describe("optional url_list field", () => {
      const optionalUrlListField: UrlListField = {
        kind: "url_list",
        id: "references",
        label: "References",
        required: false,
        priority: "medium",
        role: "user",
      };

      it("shows skip option and returns skip_field patch when selected", async () => {
        vi.mocked(p.select).mockResolvedValue("skip");
        vi.mocked(p.isCancel).mockReturnValue(false);

        const patch = await promptForField(createContext(optionalUrlListField));

        expect(patch).toEqual({
          op: "skip_field",
          fieldId: "references",
          role: "user",
          reason: "User skipped in console",
        });
      });
    });

    describe("required fields", () => {
      const requiredStringField: StringField = {
        kind: "string",
        id: "name",
        label: "Name",
        required: true,
        priority: "medium",
        role: "user",
      };

      it("does not show skip option for required fields", async () => {
        vi.mocked(p.text).mockResolvedValue("Alice");
        vi.mocked(p.isCancel).mockReturnValue(false);

        await promptForField(createContext(requiredStringField));

        // Should go straight to text prompt, not select for skip/fill
        expect(p.text).toHaveBeenCalled();
        // select should not be called for required fields
        expect(p.select).not.toHaveBeenCalled();
      });
    });
  });

  describe("field type coverage", () => {
    // This test ensures ALL field types defined in FieldKind are handled by promptForField.
    // If a new field type is added to coreTypes.ts but not to interactivePrompts.ts,
    // this test will fail.

    // All field type definitions
    const allFieldTypes: Field[] = [
      {
        kind: "string",
        id: "f_string",
        label: "String",
        required: true,
        priority: "medium",
        role: "user",
      },
      {
        kind: "number",
        id: "f_number",
        label: "Number",
        required: true,
        priority: "medium",
        role: "user",
      },
      {
        kind: "string_list",
        id: "f_string_list",
        label: "String List",
        required: true,
        priority: "medium",
        role: "user",
      },
      {
        kind: "single_select",
        id: "f_single_select",
        label: "Single Select",
        required: true,
        priority: "medium",
        role: "user",
        options: [{ id: "a", label: "A" }],
      },
      {
        kind: "multi_select",
        id: "f_multi_select",
        label: "Multi Select",
        required: true,
        priority: "medium",
        role: "user",
        options: [{ id: "a", label: "A" }],
      },
      {
        kind: "checkboxes",
        id: "f_checkboxes",
        label: "Checkboxes",
        required: true,
        priority: "medium",
        role: "user",
        checkboxMode: "simple",
        approvalMode: "none",
        options: [{ id: "a", label: "A" }],
      },
      {
        kind: "url",
        id: "f_url",
        label: "URL",
        required: true,
        priority: "medium",
        role: "user",
      },
      {
        kind: "url_list",
        id: "f_url_list",
        label: "URL List",
        required: true,
        priority: "medium",
        role: "user",
      },
    ];

    it("handles all FieldKind types without returning null unexpectedly", async () => {
      // Set up mocks to return valid values for all field types
      vi.mocked(p.text).mockResolvedValue("test value");
      vi.mocked(p.select).mockResolvedValue("a");
      vi.mocked(p.multiselect).mockResolvedValue(["a"]);
      vi.mocked(p.isCancel).mockReturnValue(false);

      for (const field of allFieldTypes) {
        const patch = await promptForField(createContext(field));

        // Every field type should return a valid patch, not null
        // (null means unknown field type in default case)
        expect(patch).not.toBeNull();
        expect(patch).toHaveProperty("op");
        expect(patch).toHaveProperty("fieldId", field.id);
      }
    });

    it("returns correct patch operations for each field type", async () => {
      vi.mocked(p.text).mockResolvedValue("test");
      vi.mocked(p.select).mockResolvedValue("a");
      vi.mocked(p.multiselect).mockResolvedValue(["a"]);
      vi.mocked(p.isCancel).mockReturnValue(false);

      const expectedOps: Record<string, string> = {
        string: "set_string",
        number: "set_number",
        string_list: "set_string_list",
        single_select: "set_single_select",
        multi_select: "set_multi_select",
        checkboxes: "set_checkboxes",
        url: "set_url",
        url_list: "set_url_list",
      };

      for (const field of allFieldTypes) {
        vi.clearAllMocks();
        vi.mocked(p.text).mockResolvedValue("test");
        vi.mocked(p.select).mockResolvedValue("a");
        vi.mocked(p.multiselect).mockResolvedValue(["a"]);
        vi.mocked(p.isCancel).mockReturnValue(false);

        const patch = await promptForField(createContext(field));

        expect(patch).not.toBeNull();
        expect(patch!.op).toBe(expectedOps[field.kind]);
      }
    });
  });
});
