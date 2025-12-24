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
  ParsedForm,
  InspectIssue,
} from "../../../src/engine/types.js";

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
          kind: "field_group",
          id: "test_group",
          title: "Test Group",
          children: fields,
        },
      ],
    },
    valuesByFieldId: {},
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
            .mockResolvedValueOnce("done")
            .mockResolvedValueOnce("active");
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
      showInteractiveOutro(0, "", true);

      expect(p.cancel).toHaveBeenCalledWith("Interactive fill cancelled.");
    });

    it("shows no changes message when patch count is 0", () => {
      showInteractiveOutro(0, "", false);

      expect(p.outro).toHaveBeenCalledWith("No changes made.");
    });

    it("shows success message with patch count", () => {
      showInteractiveOutro(3, "/path/to/form.form.md", false);

      expect(p.outro).toHaveBeenCalledWith(
        "✓ 3 field(s) updated. Saved to /path/to/form.form.md"
      );
    });
  });
});
