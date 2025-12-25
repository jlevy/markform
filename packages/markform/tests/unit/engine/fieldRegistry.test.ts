/**
 * Tests for the Field Type Registry.
 *
 * These tests verify that:
 * 1. All field kinds are properly registered
 * 2. The registry types are consistent with coreTypes
 * 3. createEmptyValue works for all kinds
 * 4. FIELD_SCHEMAS has entries for all kinds
 */

import { describe, it, expect } from "vitest";
import {
  FIELD_KINDS,
  type FieldKind,
  type FieldTypeMap,
  createEmptyValue,
  FIELD_SCHEMAS,
  getFieldSchemas,
} from "../../../src/engine/fieldRegistry.js";
import {
  FieldKindSchema,
  type FieldValue,
} from "../../../src/engine/coreTypes.js";

describe("fieldRegistry", () => {
  describe("FIELD_KINDS", () => {
    it("should contain all 8 field kinds", () => {
      expect(FIELD_KINDS).toHaveLength(8);
      expect(FIELD_KINDS).toContain("string");
      expect(FIELD_KINDS).toContain("number");
      expect(FIELD_KINDS).toContain("string_list");
      expect(FIELD_KINDS).toContain("checkboxes");
      expect(FIELD_KINDS).toContain("single_select");
      expect(FIELD_KINDS).toContain("multi_select");
      expect(FIELD_KINDS).toContain("url");
      expect(FIELD_KINDS).toContain("url_list");
    });

    it("should match FieldKindSchema from coreTypes", () => {
      const zodKinds = FieldKindSchema.options;
      expect([...FIELD_KINDS].sort()).toEqual([...zodKinds].sort());
    });
  });

  describe("FieldTypeMap", () => {
    it("should have entries for all field kinds (compile-time check)", () => {
      // This is a compile-time check - if FieldTypeMap is missing a kind,
      // TypeScript will error. At runtime, we verify the structure exists.
      const kinds: FieldKind[] = [...FIELD_KINDS];

      // TypeScript ensures FieldTypeMap has all kinds at compile time
      type _Entry = FieldTypeMap[FieldKind];
      type _HasField = _Entry["field"];
      type _HasValue = _Entry["value"];
      type _HasPatch = _Entry["patch"];
      type _HasEmptyValue = _Entry["emptyValue"];

      expect(kinds.length).toBe(8); // If we get here, types are correct
    });
  });

  describe("createEmptyValue", () => {
    it("should create correct empty value for string", () => {
      const value = createEmptyValue("string");
      expect(value).toEqual({ kind: "string", value: null });
    });

    it("should create correct empty value for number", () => {
      const value = createEmptyValue("number");
      expect(value).toEqual({ kind: "number", value: null });
    });

    it("should create correct empty value for string_list", () => {
      const value = createEmptyValue("string_list");
      expect(value).toEqual({ kind: "string_list", items: [] });
    });

    it("should create correct empty value for checkboxes", () => {
      const value = createEmptyValue("checkboxes");
      expect(value).toEqual({ kind: "checkboxes", values: {} });
    });

    it("should create correct empty value for single_select", () => {
      const value = createEmptyValue("single_select");
      expect(value).toEqual({ kind: "single_select", selected: null });
    });

    it("should create correct empty value for multi_select", () => {
      const value = createEmptyValue("multi_select");
      expect(value).toEqual({ kind: "multi_select", selected: [] });
    });

    it("should create correct empty value for url", () => {
      const value = createEmptyValue("url");
      expect(value).toEqual({ kind: "url", value: null });
    });

    it("should create correct empty value for url_list", () => {
      const value = createEmptyValue("url_list");
      expect(value).toEqual({ kind: "url_list", items: [] });
    });

    it("should handle all field kinds", () => {
      for (const kind of FIELD_KINDS) {
        const value = createEmptyValue(kind);
        expect(value).toBeDefined();
        expect(value.kind).toBe(kind);
      }
    });

    it("should return values that match FieldValue type", () => {
      for (const kind of FIELD_KINDS) {
        const value: FieldValue = createEmptyValue(kind);
        expect(value.kind).toBe(kind);
      }
    });
  });

  describe("FIELD_SCHEMAS", () => {
    it("should have entries for all field kinds", () => {
      for (const kind of FIELD_KINDS) {
        expect(FIELD_SCHEMAS[kind]).toBeDefined();
        expect(FIELD_SCHEMAS[kind].field).toBeDefined();
        expect(FIELD_SCHEMAS[kind].value).toBeDefined();
        expect(FIELD_SCHEMAS[kind].patch).toBeDefined();
      }
    });

    it("should have valid Zod schemas for each kind", () => {
      for (const kind of FIELD_KINDS) {
        const schemas = FIELD_SCHEMAS[kind];

        // Test that value schemas can parse empty values
        const emptyValue = createEmptyValue(kind);
        const valueResult = schemas.value.safeParse(emptyValue);
        expect(valueResult.success).toBe(true);
      }
    });
  });

  describe("getFieldSchemas", () => {
    it("should return correct schemas for each kind", () => {
      for (const kind of FIELD_KINDS) {
        const schemas = getFieldSchemas(kind);
        expect(schemas).toBe(FIELD_SCHEMAS[kind]);
      }
    });
  });

  describe("exhaustiveness", () => {
    it("should handle all kinds in a switch statement", () => {
      // This test verifies the exhaustiveness pattern works at runtime
      function getKindDescription(kind: FieldKind): string {
        switch (kind) {
          case "string":
            return "text";
          case "number":
            return "numeric";
          case "string_list":
            return "list of text";
          case "checkboxes":
            return "checkboxes";
          case "single_select":
            return "dropdown";
          case "multi_select":
            return "multi-select";
          case "url":
            return "URL";
          case "url_list":
            return "list of URLs";
          default: {
            // Exhaustiveness check
            const _exhaustive: never = kind;
            throw new Error(`Unknown kind: ${String(_exhaustive)}`);
          }
        }
      }

      for (const kind of FIELD_KINDS) {
        expect(typeof getKindDescription(kind)).toBe("string");
      }
    });
  });
});

