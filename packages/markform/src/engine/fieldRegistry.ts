/**
 * Field Type Registry - Single source of truth for field type relationships.
 *
 * This module defines the relationships between FieldKind, Field, FieldValue,
 * and Patch types in a type-safe way. Adding a new field type requires:
 *
 * - Add the kind to FIELD_KINDS tuple below
 * - Add entry to FieldTypeMap interface
 * - Define the Field interface (extends FieldBase)
 * - Define the Value interface
 * - Define the SetPatch interface
 * - Add Zod schemas in the schemas section
 *
 * TypeScript will error if any of these are missing or inconsistent.
 */

import type { z } from 'zod';

// =============================================================================
// Field kinds (tuple for type inference)
// =============================================================================

/**
 * All field kinds as a const tuple - the single source of truth.
 * Adding a new kind here will cause TypeScript errors until all
 * corresponding types and handlers are added.
 */
export const FIELD_KINDS = [
  'string',
  'number',
  'string_list',
  'checkboxes',
  'single_select',
  'multi_select',
  'url',
  'url_list',
  'date',
  'year',
] as const;

/** Field kind discriminant - derived from the tuple */
export type FieldKind = (typeof FIELD_KINDS)[number];

// =============================================================================
// Type map - links kind to Field, Value, and Patch
// =============================================================================

import type {
  StringField,
  NumberField,
  StringListField,
  CheckboxesField,
  SingleSelectField,
  MultiSelectField,
  UrlField,
  UrlListField,
  DateField,
  YearField,
  StringValue,
  NumberValue,
  StringListValue,
  CheckboxesValue,
  SingleSelectValue,
  MultiSelectValue,
  UrlValue,
  UrlListValue,
  DateValue,
  YearValue,
  SetStringPatch,
  SetNumberPatch,
  SetStringListPatch,
  SetCheckboxesPatch,
  SetSingleSelectPatch,
  SetMultiSelectPatch,
  SetUrlPatch,
  SetUrlListPatch,
  SetDatePatch,
  SetYearPatch,
} from './coreTypes.js';

/**
 * Type map linking each field kind to its corresponding types.
 * TypeScript will error if any kind is missing from this map.
 */
export interface FieldTypeMap {
  string: {
    field: StringField;
    value: StringValue;
    patch: SetStringPatch;
    emptyValue: { kind: 'string'; value: null };
  };
  number: {
    field: NumberField;
    value: NumberValue;
    patch: SetNumberPatch;
    emptyValue: { kind: 'number'; value: null };
  };
  string_list: {
    field: StringListField;
    value: StringListValue;
    patch: SetStringListPatch;
    emptyValue: { kind: 'string_list'; items: [] };
  };
  checkboxes: {
    field: CheckboxesField;
    value: CheckboxesValue;
    patch: SetCheckboxesPatch;
    emptyValue: { kind: 'checkboxes'; values: Record<string, never> };
  };
  single_select: {
    field: SingleSelectField;
    value: SingleSelectValue;
    patch: SetSingleSelectPatch;
    emptyValue: { kind: 'single_select'; selected: null };
  };
  multi_select: {
    field: MultiSelectField;
    value: MultiSelectValue;
    patch: SetMultiSelectPatch;
    emptyValue: { kind: 'multi_select'; selected: [] };
  };
  url: {
    field: UrlField;
    value: UrlValue;
    patch: SetUrlPatch;
    emptyValue: { kind: 'url'; value: null };
  };
  url_list: {
    field: UrlListField;
    value: UrlListValue;
    patch: SetUrlListPatch;
    emptyValue: { kind: 'url_list'; items: [] };
  };
  date: {
    field: DateField;
    value: DateValue;
    patch: SetDatePatch;
    emptyValue: { kind: 'date'; value: null };
  };
  year: {
    field: YearField;
    value: YearValue;
    patch: SetYearPatch;
    emptyValue: { kind: 'year'; value: null };
  };
}

// =============================================================================
// Compile-time assertions - error if FieldTypeMap is incomplete
// =============================================================================

/**
 * Asserts that T has all keys from K.
 * Used to ensure FieldTypeMap covers all FieldKind values.
 */
type AssertAllKeys<K extends string, T extends Record<K, unknown>> = T;

/** Compile-time check: FieldTypeMap must have entry for every FieldKind */
type _AssertMapComplete = AssertAllKeys<FieldKind, FieldTypeMap>;

/** Compile-time check: FieldTypeMap keys must exactly match FieldKind */
type _AssertMapExact = keyof FieldTypeMap extends FieldKind
  ? FieldKind extends keyof FieldTypeMap
    ? true
    : never
  : never;

// If either assertion fails, you'll get a type error here:
const _typeCheck: _AssertMapComplete = {} as FieldTypeMap;
const _exactCheck: _AssertMapExact = true;

// =============================================================================
// Derived union types - automatically include all registered types
// =============================================================================

/** Union of all Field types - derived from the registry */
export type Field = FieldTypeMap[FieldKind]['field'];

/** Union of all FieldValue types - derived from the registry */
export type FieldValue = FieldTypeMap[FieldKind]['value'];

/** Union of all set patch types - derived from the registry */
export type SetValuePatch = FieldTypeMap[FieldKind]['patch'];

// =============================================================================
// Exhaustiveness check helper
// =============================================================================

/**
 * Exhaustiveness check helper for switch statements.
 * If you add a new FieldKind but forget to handle it in a switch,
 * TypeScript will error because the kind won't be assignable to never.
 *
 * Usage:
 * ```ts
 * switch (field.kind) {
 *   case "string": ...
 *   case "number": ...
 *   // ... all cases ...
 *   default:
 *     return assertNever(field.kind);
 * }
 * ```
 */
export function assertNever(x: never, message?: string): never {
  throw new Error(message ?? `Unexpected value: ${JSON.stringify(x)}`);
}

// =============================================================================
// Empty value factory - type-safe way to create empty values
// =============================================================================

/**
 * Create an empty/default value for a field.
 * Exhaustiveness is checked at compile time.
 */
export function createEmptyValue(kind: FieldKind): FieldValue {
  switch (kind) {
    case 'string':
      return { kind: 'string', value: null };
    case 'number':
      return { kind: 'number', value: null };
    case 'string_list':
      return { kind: 'string_list', items: [] };
    case 'checkboxes':
      return { kind: 'checkboxes', values: {} };
    case 'single_select':
      return { kind: 'single_select', selected: null };
    case 'multi_select':
      return { kind: 'multi_select', selected: [] };
    case 'url':
      return { kind: 'url', value: null };
    case 'url_list':
      return { kind: 'url_list', items: [] };
    case 'date':
      return { kind: 'date', value: null };
    case 'year':
      return { kind: 'year', value: null };
    default:
      return assertNever(kind);
  }
}

// =============================================================================
// Zod schema registry - ensures schemas match types
// =============================================================================

import {
  StringFieldSchema,
  NumberFieldSchema,
  StringListFieldSchema,
  CheckboxesFieldSchema,
  SingleSelectFieldSchema,
  MultiSelectFieldSchema,
  UrlFieldSchema,
  UrlListFieldSchema,
  DateFieldSchema,
  YearFieldSchema,
  StringValueSchema,
  NumberValueSchema,
  StringListValueSchema,
  CheckboxesValueSchema,
  SingleSelectValueSchema,
  MultiSelectValueSchema,
  UrlValueSchema,
  UrlListValueSchema,
  DateValueSchema,
  YearValueSchema,
  SetStringPatchSchema,
  SetNumberPatchSchema,
  SetStringListPatchSchema,
  SetCheckboxesPatchSchema,
  SetSingleSelectPatchSchema,
  SetMultiSelectPatchSchema,
  SetUrlPatchSchema,
  SetUrlListPatchSchema,
  SetDatePatchSchema,
  SetYearPatchSchema,
} from './coreTypes.js';

/**
 * Zod schema registry - maps each kind to its schemas.
 * This ensures schemas are defined for every field type.
 */
export const FIELD_SCHEMAS = {
  string: {
    field: StringFieldSchema,
    value: StringValueSchema,
    patch: SetStringPatchSchema,
  },
  number: {
    field: NumberFieldSchema,
    value: NumberValueSchema,
    patch: SetNumberPatchSchema,
  },
  string_list: {
    field: StringListFieldSchema,
    value: StringListValueSchema,
    patch: SetStringListPatchSchema,
  },
  checkboxes: {
    field: CheckboxesFieldSchema,
    value: CheckboxesValueSchema,
    patch: SetCheckboxesPatchSchema,
  },
  single_select: {
    field: SingleSelectFieldSchema,
    value: SingleSelectValueSchema,
    patch: SetSingleSelectPatchSchema,
  },
  multi_select: {
    field: MultiSelectFieldSchema,
    value: MultiSelectValueSchema,
    patch: SetMultiSelectPatchSchema,
  },
  url: {
    field: UrlFieldSchema,
    value: UrlValueSchema,
    patch: SetUrlPatchSchema,
  },
  url_list: {
    field: UrlListFieldSchema,
    value: UrlListValueSchema,
    patch: SetUrlListPatchSchema,
  },
  date: {
    field: DateFieldSchema,
    value: DateValueSchema,
    patch: SetDatePatchSchema,
  },
  year: {
    field: YearFieldSchema,
    value: YearValueSchema,
    patch: SetYearPatchSchema,
  },
} as const satisfies Record<
  FieldKind,
  {
    field: z.ZodType;
    value: z.ZodType;
    patch: z.ZodType;
  }
>;

/** Type-safe schema lookup by kind */
export function getFieldSchemas<K extends FieldKind>(kind: K) {
  return FIELD_SCHEMAS[kind];
}
