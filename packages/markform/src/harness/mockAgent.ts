/**
 * Mock Agent - Deterministic agent for testing harness execution.
 *
 * Uses a pre-filled "completed mock" form to generate patches
 * that fill the form deterministically.
 */

import type {
  CheckboxesValue,
  Field,
  FieldValue,
  Id,
  InspectIssue,
  MultiSelectValue,
  NumberValue,
  Patch,
  ParsedForm,
  SingleSelectValue,
  StringListValue,
  StringValue,
  UrlListValue,
  UrlValue,
} from "../engine/coreTypes.js";
import type { Agent, AgentResponse } from "./harnessTypes.js";

// Re-export Agent type for backwards compatibility
export type { Agent, AgentResponse } from "./harnessTypes.js";

// =============================================================================
// Mock Agent Implementation
// =============================================================================

/**
 * Mock agent that generates patches from a pre-filled form.
 */
export class MockAgent implements Agent {
  private completedValues: Record<Id, FieldValue>;
  private fieldMap: Map<Id, Field>;

  /**
   * Create a mock agent from a completed form.
   *
   * @param completedForm - A fully-filled form to use as source of values
   */
  constructor(completedForm: ParsedForm) {
    this.completedValues = { ...completedForm.valuesByFieldId };

    // Build field map for quick lookup
    this.fieldMap = new Map();
    for (const group of completedForm.schema.groups) {
      for (const field of group.children) {
        this.fieldMap.set(field.id, field);
      }
    }
  }

  /**
   * Generate patches from the completed mock to address issues.
   *
   * Processes issues in priority order, generating patches for
   * fields that have values in the completed mock. For fields with no
   * value (empty optional fields), generates skip_field patches.
   * Returns AgentResponse with patches but no stats (mock doesn't track LLM usage).
   */
  async generatePatches(
    issues: InspectIssue[],
    _form: ParsedForm,
    maxPatches: number
  ): Promise<AgentResponse> {
    const patches: Patch[] = [];
    const addressedFields = new Set<Id>();

    // Process issues in priority order
    for (const issue of issues) {
      if (patches.length >= maxPatches) {
        break;
      }

      // Skip non-field issues
      if (issue.scope !== "field") {
        continue;
      }

      const fieldId = issue.ref;

      // Skip if we've already addressed this field
      if (addressedFields.has(fieldId)) {
        continue;
      }

      // Get field schema
      const field = this.fieldMap.get(fieldId);
      if (!field) {
        continue;
      }

      // Get the completed value for this field
      const completedValue = this.completedValues[fieldId];

      // If no value exists, generate skip_field patch for optional fields
      if (!completedValue || !this.hasValue(completedValue)) {
        if (!field.required) {
          patches.push({
            op: "skip_field",
            fieldId,
            reason: "No value in mock form",
          });
          addressedFields.add(fieldId);
        }
        continue;
      }

      // Generate patch based on field kind
      const patch = this.createPatch(fieldId, field, completedValue);
      if (patch) {
        patches.push(patch);
        addressedFields.add(fieldId);
      }
    }

    // Return AgentResponse (no stats for mock agent)
    return Promise.resolve({ patches });
  }

  /**
   * Check if a field value actually has content (not null/empty).
   */
  private hasValue(value: FieldValue): boolean {
    switch (value.kind) {
      case "string":
        return value.value !== null && value.value !== "";
      case "number":
        return value.value !== null;
      case "string_list":
        return value.items.length > 0;
      case "single_select":
        return value.selected !== null;
      case "multi_select":
        return value.selected.length > 0;
      case "checkboxes":
        return true; // Checkboxes always have some state
      case "url":
        return value.value !== null && value.value !== "";
      case "url_list":
        return value.items.length > 0;
      default:
        return false;
    }
  }

  /**
   * Create a patch for a field based on its kind and completed value.
   */
  private createPatch(
    fieldId: Id,
    field: Field,
    value: FieldValue
  ): Patch | null {
    switch (field.kind) {
      case "string": {
        const v = value as StringValue;
        return {
          op: "set_string",
          fieldId,
          value: v.value,
        };
      }

      case "number": {
        const v = value as NumberValue;
        return {
          op: "set_number",
          fieldId,
          value: v.value,
        };
      }

      case "string_list": {
        const v = value as StringListValue;
        return {
          op: "set_string_list",
          fieldId,
          items: v.items,
        };
      }

      case "single_select": {
        const v = value as SingleSelectValue;
        return {
          op: "set_single_select",
          fieldId,
          selected: v.selected,
        };
      }

      case "multi_select": {
        const v = value as MultiSelectValue;
        return {
          op: "set_multi_select",
          fieldId,
          selected: v.selected,
        };
      }

      case "checkboxes": {
        const v = value as CheckboxesValue;
        return {
          op: "set_checkboxes",
          fieldId,
          values: v.values,
        };
      }

      case "url": {
        const v = value as UrlValue;
        return {
          op: "set_url",
          fieldId,
          value: v.value,
        };
      }

      case "url_list": {
        const v = value as UrlListValue;
        return {
          op: "set_url_list",
          fieldId,
          items: v.items,
        };
      }

      default:
        return null;
    }
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a mock agent from a completed form.
 *
 * @param completedForm - A fully-filled form to use as source of values
 * @returns A new MockAgent instance
 */
export function createMockAgent(completedForm: ParsedForm): MockAgent {
  return new MockAgent(completedForm);
}
