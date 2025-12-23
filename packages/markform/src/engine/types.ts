/**
 * Core types and Zod schemas for Markform.
 *
 * This module defines all TypeScript types and their corresponding Zod schemas
 * for forms, fields, values, validation, patches, and session transcripts.
 */

import { z } from "zod";

// =============================================================================
// Basic Types
// =============================================================================

/** Form/group/field ID - globally unique within a document */
export type Id = string;

/** Option ID - unique within its containing field */
export type OptionId = string;

/** Qualified option reference - used in doc blocks and external references */
export type QualifiedOptionRef = `${Id}.${OptionId}`;

/** Validator reference - simple ID or parameterized object */
export type ValidatorRef = string | { id: string; [key: string]: unknown };

// =============================================================================
// Checkbox Types
// =============================================================================

/** Multi-checkbox states (checkboxMode="multi", default) - 5 states */
export type MultiCheckboxState =
  | "todo"
  | "done"
  | "incomplete"
  | "active"
  | "na";

/** Simple checkbox states (checkboxMode="simple") - 2 states, GFM-compatible */
export type SimpleCheckboxState = "todo" | "done";

/** Explicit checkbox values (checkboxMode="explicit") - requires yes/no answer */
export type ExplicitCheckboxValue = "unfilled" | "yes" | "no";

/** Union type for all checkbox values */
export type CheckboxValue = MultiCheckboxState | ExplicitCheckboxValue;

/** Checkbox mode determines which states are valid */
export type CheckboxMode = "multi" | "simple" | "explicit";

// =============================================================================
// Field Types
// =============================================================================

/** Field kind discriminant */
export type FieldKind =
  | "string"
  | "number"
  | "string_list"
  | "checkboxes"
  | "single_select"
  | "multi_select";

/** Base interface for all field types */
export interface FieldBase {
  id: Id;
  label: string;
  required?: boolean;
  validate?: ValidatorRef[];
}

/** String field - single or multiline text */
export interface StringField extends FieldBase {
  kind: "string";
  multiline?: boolean;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
}

/** Number field - numeric value with optional constraints */
export interface NumberField extends FieldBase {
  kind: "number";
  min?: number;
  max?: number;
  integer?: boolean;
}

/** String list field - array of user-provided strings */
export interface StringListField extends FieldBase {
  kind: "string_list";
  minItems?: number;
  maxItems?: number;
  itemMinLength?: number;
  itemMaxLength?: number;
  uniqueItems?: boolean;
}

/** Option in select/checkbox fields */
export interface Option {
  id: Id;
  label: string;
}

/** Checkboxes field - stateful checklist with configurable modes */
export interface CheckboxesField extends FieldBase {
  kind: "checkboxes";
  checkboxMode?: CheckboxMode;
  minDone?: number;
  options: Option[];
}

/** Single-select field - exactly one option can be selected */
export interface SingleSelectField extends FieldBase {
  kind: "single_select";
  options: Option[];
}

/** Multi-select field - multiple options can be selected */
export interface MultiSelectField extends FieldBase {
  kind: "multi_select";
  options: Option[];
  minSelections?: number;
  maxSelections?: number;
}

/** Union of all field types */
export type Field =
  | StringField
  | NumberField
  | StringListField
  | CheckboxesField
  | SingleSelectField
  | MultiSelectField;

// =============================================================================
// Form Structure Types
// =============================================================================

/** Field group - container for fields (nested groups deferred to future) */
export interface FieldGroup {
  kind: "field_group";
  id: Id;
  title?: string;
  validate?: ValidatorRef[];
  children: Field[];
}

/** Form schema - root container with groups */
export interface FormSchema {
  id: Id;
  title?: string;
  groups: FieldGroup[];
}

// =============================================================================
// Field Value Types
// =============================================================================

/** String field value */
export interface StringValue {
  kind: "string";
  value: string | null;
}

/** Number field value */
export interface NumberValue {
  kind: "number";
  value: number | null;
}

/** String list field value */
export interface StringListValue {
  kind: "string_list";
  items: string[];
}

/** Checkboxes field value */
export interface CheckboxesValue {
  kind: "checkboxes";
  values: Record<OptionId, CheckboxValue>;
}

/** Single-select field value */
export interface SingleSelectValue {
  kind: "single_select";
  selected: OptionId | null;
}

/** Multi-select field value */
export interface MultiSelectValue {
  kind: "multi_select";
  selected: OptionId[];
}

/** Union of all field value types */
export type FieldValue =
  | StringValue
  | NumberValue
  | StringListValue
  | CheckboxesValue
  | SingleSelectValue
  | MultiSelectValue;

// =============================================================================
// Documentation Block
// =============================================================================

/** Documentation block kind */
export type DocBlockKind = "description" | "instructions" | "notes" | "examples";

/** Documentation block attached to form elements */
export interface DocumentationBlock {
  /** Reference to form/group/field ID or qualified option ref (fieldId.optionId) */
  ref: string;
  kind?: DocBlockKind;
  bodyMarkdown: string;
}

// =============================================================================
// Parsed Form
// =============================================================================

/** ID index entry for fast lookup and validation */
export interface IdIndexEntry {
  kind: "form" | "group" | "field" | "option";
  parentId?: Id;
  fieldId?: Id;
}

/** Canonical internal representation returned by parseForm() */
export interface ParsedForm {
  schema: FormSchema;
  valuesByFieldId: Record<Id, FieldValue>;
  docs: DocumentationBlock[];
  orderIndex: Id[];
  idIndex: Map<Id, IdIndexEntry>;
}

// =============================================================================
// Validation Types
// =============================================================================

/** Validation issue severity */
export type Severity = "error" | "warning" | "info";

/** Source position for error locations */
export interface SourcePosition {
  line: number;
  col: number;
}

/** Source range for error locations */
export interface SourceRange {
  start: SourcePosition;
  end: SourcePosition;
}

/** Validation issue from the validation pipeline */
export interface ValidationIssue {
  severity: Severity;
  message: string;
  code?: string;
  ref?: Id;
  path?: string;
  range?: SourceRange;
  validatorId?: string;
  source: "builtin" | "code" | "llm";
}

// =============================================================================
// Inspect Types
// =============================================================================

/** Standard reason codes for inspect issues */
export type IssueReason =
  | "validation_error"
  | "required_missing"
  | "checkbox_incomplete"
  | "min_items_not_met"
  | "optional_empty";

/** Issue scope - the level at which the issue applies */
export type IssueScope = "form" | "group" | "field" | "option";

/** Inspect issue - unified type for agent/UI consumption */
export interface InspectIssue {
  ref: string;
  scope: IssueScope;
  reason: IssueReason;
  message: string;
  severity: "required" | "recommended";
  priority: number;
}

// =============================================================================
// Summary Types
// =============================================================================

/** Structure summary - describes static form schema */
export interface StructureSummary {
  groupCount: number;
  fieldCount: number;
  optionCount: number;
  fieldCountByKind: Record<FieldKind, number>;
  groupsById: Record<Id, "field_group">;
  fieldsById: Record<Id, FieldKind>;
  optionsById: Record<
    QualifiedOptionRef,
    { parentFieldId: Id; parentFieldKind: FieldKind }
  >;
}

/** Progress state for a field or form */
export type ProgressState = "empty" | "incomplete" | "invalid" | "complete";

/** Checkbox progress counts */
export interface CheckboxProgressCounts {
  total: number;
  // Multi mode
  todo: number;
  done: number;
  incomplete: number;
  active: number;
  na: number;
  // Explicit mode
  unfilled: number;
  yes: number;
  no: number;
}

/** Field progress tracking */
export interface FieldProgress {
  kind: FieldKind;
  required: boolean;
  submitted: boolean;
  state: ProgressState;
  valid: boolean;
  issueCount: number;
  checkboxProgress?: CheckboxProgressCounts;
}

/** Progress counts rollup */
export interface ProgressCounts {
  totalFields: number;
  requiredFields: number;
  submittedFields: number;
  completeFields: number;
  incompleteFields: number;
  invalidFields: number;
  emptyRequiredFields: number;
  emptyOptionalFields: number;
}

/** Progress summary - tracks filling progress */
export interface ProgressSummary {
  counts: ProgressCounts;
  fields: Record<Id, FieldProgress>;
}

// =============================================================================
// Inspect/Apply Result Types
// =============================================================================

/** Result from inspect operation */
export interface InspectResult {
  structureSummary: StructureSummary;
  progressSummary: ProgressSummary;
  issues: InspectIssue[];
  isComplete: boolean;
  formState: ProgressState;
}

/** Result from apply operation */
export interface ApplyResult {
  applyStatus: "applied" | "rejected";
  structureSummary: StructureSummary;
  progressSummary: ProgressSummary;
  issues: InspectIssue[];
  isComplete: boolean;
  formState: ProgressState;
}

// =============================================================================
// Patch Types
// =============================================================================

/** Set string field value */
export interface SetStringPatch {
  op: "set_string";
  fieldId: Id;
  value: string | null;
}

/** Set number field value */
export interface SetNumberPatch {
  op: "set_number";
  fieldId: Id;
  value: number | null;
}

/** Set string list field value */
export interface SetStringListPatch {
  op: "set_string_list";
  fieldId: Id;
  items: string[];
}

/** Set checkboxes field value (merges with existing) */
export interface SetCheckboxesPatch {
  op: "set_checkboxes";
  fieldId: Id;
  values: Record<OptionId, CheckboxValue>;
}

/** Set single-select field value */
export interface SetSingleSelectPatch {
  op: "set_single_select";
  fieldId: Id;
  selected: OptionId | null;
}

/** Set multi-select field value */
export interface SetMultiSelectPatch {
  op: "set_multi_select";
  fieldId: Id;
  selected: OptionId[];
}

/** Clear field value */
export interface ClearFieldPatch {
  op: "clear_field";
  fieldId: Id;
}

/** Union of all patch types */
export type Patch =
  | SetStringPatch
  | SetNumberPatch
  | SetStringListPatch
  | SetCheckboxesPatch
  | SetSingleSelectPatch
  | SetMultiSelectPatch
  | ClearFieldPatch;

// =============================================================================
// Harness Types
// =============================================================================

/** Result from harness step */
export interface StepResult {
  structureSummary: StructureSummary;
  progressSummary: ProgressSummary;
  issues: InspectIssue[];
  stepBudget: number;
  isComplete: boolean;
  turnNumber: number;
}

// =============================================================================
// Session Transcript Types
// =============================================================================

/** Harness configuration */
export interface HarnessConfig {
  maxIssues: number;
  maxPatchesPerTurn: number;
  maxTurns: number;
}

/** Session turn - one iteration of the harness loop */
export interface SessionTurn {
  turn: number;
  inspect: {
    issues: InspectIssue[];
  };
  apply: {
    patches: Patch[];
  };
  after: {
    requiredIssueCount: number;
    markdownSha256: string;
  };
}

/** Final session expectations */
export interface SessionFinal {
  expectComplete: boolean;
  expectedCompletedForm: string;
}

/** Session transcript for golden testing */
export interface SessionTranscript {
  sessionVersion: string;
  mode: "mock" | "live";
  form: {
    path: string;
  };
  validators?: {
    code?: string;
  };
  mock?: {
    completedMock: string;
  };
  harness: HarnessConfig;
  turns: SessionTurn[];
  final: SessionFinal;
}

// =============================================================================
// Frontmatter Types
// =============================================================================

/** Markform frontmatter structure */
export interface MarkformFrontmatter {
  markformVersion: string;
  formSummary: StructureSummary;
  formProgress: ProgressSummary;
  formState: ProgressState;
}

// =============================================================================
// Validator Types
// =============================================================================

/** Context passed to validator functions */
export interface ValidatorContext {
  schema: FormSchema;
  values: Record<Id, FieldValue>;
  targetId: Id;
  targetSchema: Field | FieldGroup | FormSchema;
  params: Record<string, unknown>;
}

/** Validator function signature */
export type ValidatorFn = (ctx: ValidatorContext) => ValidationIssue[];

/** Validator registry from sidecar files */
export type ValidatorRegistry = Record<string, ValidatorFn>;

// =============================================================================
// Zod Schemas
// =============================================================================

// Basic schemas
export const IdSchema = z.string().min(1);
export const OptionIdSchema = z.string().min(1);

export const ValidatorRefSchema = z.union([
  z.string(),
  z.object({ id: z.string() }).passthrough(),
]);

// Checkbox state schemas
export const MultiCheckboxStateSchema = z.enum([
  "todo",
  "done",
  "incomplete",
  "active",
  "na",
]);

export const SimpleCheckboxStateSchema = z.enum(["todo", "done"]);

export const ExplicitCheckboxValueSchema = z.enum(["unfilled", "yes", "no"]);

export const CheckboxValueSchema = z.union([
  MultiCheckboxStateSchema,
  ExplicitCheckboxValueSchema,
]);

export const CheckboxModeSchema = z.enum(["multi", "simple", "explicit"]);

// Field kind schema
export const FieldKindSchema = z.enum([
  "string",
  "number",
  "string_list",
  "checkboxes",
  "single_select",
  "multi_select",
]);

// Option schema
export const OptionSchema = z.object({
  id: IdSchema,
  label: z.string(),
});

// Field base schema (partial, used for extension)
const FieldBaseSchemaPartial = {
  id: IdSchema,
  label: z.string(),
  required: z.boolean().optional(),
  validate: z.array(ValidatorRefSchema).optional(),
};

// Field schemas
export const StringFieldSchema = z.object({
  ...FieldBaseSchemaPartial,
  kind: z.literal("string"),
  multiline: z.boolean().optional(),
  pattern: z.string().optional(),
  minLength: z.number().int().nonnegative().optional(),
  maxLength: z.number().int().nonnegative().optional(),
});

export const NumberFieldSchema = z.object({
  ...FieldBaseSchemaPartial,
  kind: z.literal("number"),
  min: z.number().optional(),
  max: z.number().optional(),
  integer: z.boolean().optional(),
});

export const StringListFieldSchema = z.object({
  ...FieldBaseSchemaPartial,
  kind: z.literal("string_list"),
  minItems: z.number().int().nonnegative().optional(),
  maxItems: z.number().int().nonnegative().optional(),
  itemMinLength: z.number().int().nonnegative().optional(),
  itemMaxLength: z.number().int().nonnegative().optional(),
  uniqueItems: z.boolean().optional(),
});

export const CheckboxesFieldSchema = z.object({
  ...FieldBaseSchemaPartial,
  kind: z.literal("checkboxes"),
  checkboxMode: CheckboxModeSchema.optional(),
  minDone: z.number().int().optional(),
  options: z.array(OptionSchema),
});

export const SingleSelectFieldSchema = z.object({
  ...FieldBaseSchemaPartial,
  kind: z.literal("single_select"),
  options: z.array(OptionSchema),
});

export const MultiSelectFieldSchema = z.object({
  ...FieldBaseSchemaPartial,
  kind: z.literal("multi_select"),
  options: z.array(OptionSchema),
  minSelections: z.number().int().nonnegative().optional(),
  maxSelections: z.number().int().nonnegative().optional(),
});

export const FieldSchema = z.discriminatedUnion("kind", [
  StringFieldSchema,
  NumberFieldSchema,
  StringListFieldSchema,
  CheckboxesFieldSchema,
  SingleSelectFieldSchema,
  MultiSelectFieldSchema,
]);

// Field group schema
export const FieldGroupSchema = z.object({
  kind: z.literal("field_group"),
  id: IdSchema,
  title: z.string().optional(),
  validate: z.array(ValidatorRefSchema).optional(),
  children: z.array(FieldSchema),
});

// Form schema
export const FormSchemaSchema = z.object({
  id: IdSchema,
  title: z.string().optional(),
  groups: z.array(FieldGroupSchema),
});

// Field value schemas
export const StringValueSchema = z.object({
  kind: z.literal("string"),
  value: z.string().nullable(),
});

export const NumberValueSchema = z.object({
  kind: z.literal("number"),
  value: z.number().nullable(),
});

export const StringListValueSchema = z.object({
  kind: z.literal("string_list"),
  items: z.array(z.string()),
});

export const CheckboxesValueSchema = z.object({
  kind: z.literal("checkboxes"),
  values: z.record(OptionIdSchema, CheckboxValueSchema),
});

export const SingleSelectValueSchema = z.object({
  kind: z.literal("single_select"),
  selected: OptionIdSchema.nullable(),
});

export const MultiSelectValueSchema = z.object({
  kind: z.literal("multi_select"),
  selected: z.array(OptionIdSchema),
});

export const FieldValueSchema = z.discriminatedUnion("kind", [
  StringValueSchema,
  NumberValueSchema,
  StringListValueSchema,
  CheckboxesValueSchema,
  SingleSelectValueSchema,
  MultiSelectValueSchema,
]);

// Documentation block schema
export const DocBlockKindSchema = z.enum([
  "description",
  "instructions",
  "notes",
  "examples",
]);

export const DocumentationBlockSchema = z.object({
  ref: z.string(),
  kind: DocBlockKindSchema.optional(),
  bodyMarkdown: z.string(),
});

// Validation schemas
export const SeveritySchema = z.enum(["error", "warning", "info"]);

export const SourcePositionSchema = z.object({
  line: z.number().int().positive(),
  col: z.number().int().positive(),
});

export const SourceRangeSchema = z.object({
  start: SourcePositionSchema,
  end: SourcePositionSchema,
});

export const ValidationIssueSchema = z.object({
  severity: SeveritySchema,
  message: z.string(),
  code: z.string().optional(),
  ref: IdSchema.optional(),
  path: z.string().optional(),
  range: SourceRangeSchema.optional(),
  validatorId: z.string().optional(),
  source: z.enum(["builtin", "code", "llm"]),
});

// Inspect issue schema
export const IssueReasonSchema = z.enum([
  "validation_error",
  "required_missing",
  "checkbox_incomplete",
  "min_items_not_met",
  "optional_empty",
]);

export const IssueScopeSchema = z.enum([
  "form",
  "group",
  "field",
  "option",
]);

export const InspectIssueSchema = z.object({
  ref: z.union([IdSchema, z.string()]), // Id or QualifiedOptionRef
  scope: IssueScopeSchema,
  reason: IssueReasonSchema,
  message: z.string(),
  severity: z.enum(["required", "recommended"]),
  priority: z.number().int().positive(),
});

// Summary schemas
export const ProgressStateSchema = z.enum([
  "empty",
  "incomplete",
  "invalid",
  "complete",
]);

export const CheckboxProgressCountsSchema = z.object({
  total: z.number().int().nonnegative(),
  // Multi mode
  todo: z.number().int().nonnegative(),
  done: z.number().int().nonnegative(),
  incomplete: z.number().int().nonnegative(),
  active: z.number().int().nonnegative(),
  na: z.number().int().nonnegative(),
  // Explicit mode
  unfilled: z.number().int().nonnegative(),
  yes: z.number().int().nonnegative(),
  no: z.number().int().nonnegative(),
});

export const FieldProgressSchema = z.object({
  kind: FieldKindSchema,
  required: z.boolean(),
  submitted: z.boolean(),
  state: ProgressStateSchema,
  valid: z.boolean(),
  issueCount: z.number().int().nonnegative(),
  checkboxProgress: CheckboxProgressCountsSchema.optional(),
});

export const ProgressCountsSchema = z.object({
  totalFields: z.number().int().nonnegative(),
  requiredFields: z.number().int().nonnegative(),
  submittedFields: z.number().int().nonnegative(),
  completeFields: z.number().int().nonnegative(),
  incompleteFields: z.number().int().nonnegative(),
  invalidFields: z.number().int().nonnegative(),
  emptyRequiredFields: z.number().int().nonnegative(),
  emptyOptionalFields: z.number().int().nonnegative(),
});

export const ProgressSummarySchema = z.object({
  counts: ProgressCountsSchema,
  fields: z.record(IdSchema, FieldProgressSchema),
});

export const StructureSummarySchema = z.object({
  groupCount: z.number().int().nonnegative(),
  fieldCount: z.number().int().nonnegative(),
  optionCount: z.number().int().nonnegative(),
  fieldCountByKind: z.record(FieldKindSchema, z.number().int().nonnegative()),
  groupsById: z.record(IdSchema, z.literal("field_group")),
  fieldsById: z.record(IdSchema, FieldKindSchema),
  optionsById: z.record(
    z.string(),
    z.object({
      parentFieldId: IdSchema,
      parentFieldKind: FieldKindSchema,
    })
  ),
});

// Result schemas
export const InspectResultSchema = z.object({
  structureSummary: StructureSummarySchema,
  progressSummary: ProgressSummarySchema,
  issues: z.array(InspectIssueSchema),
  isComplete: z.boolean(),
  formState: ProgressStateSchema,
});

export const ApplyResultSchema = z.object({
  applyStatus: z.enum(["applied", "rejected"]),
  structureSummary: StructureSummarySchema,
  progressSummary: ProgressSummarySchema,
  issues: z.array(InspectIssueSchema),
  isComplete: z.boolean(),
  formState: ProgressStateSchema,
});

// Patch schemas
export const SetStringPatchSchema = z.object({
  op: z.literal("set_string"),
  fieldId: IdSchema,
  value: z.string().nullable(),
});

export const SetNumberPatchSchema = z.object({
  op: z.literal("set_number"),
  fieldId: IdSchema,
  value: z.number().nullable(),
});

export const SetStringListPatchSchema = z.object({
  op: z.literal("set_string_list"),
  fieldId: IdSchema,
  items: z.array(z.string()),
});

export const SetCheckboxesPatchSchema = z.object({
  op: z.literal("set_checkboxes"),
  fieldId: IdSchema,
  values: z.record(OptionIdSchema, CheckboxValueSchema),
});

export const SetSingleSelectPatchSchema = z.object({
  op: z.literal("set_single_select"),
  fieldId: IdSchema,
  selected: OptionIdSchema.nullable(),
});

export const SetMultiSelectPatchSchema = z.object({
  op: z.literal("set_multi_select"),
  fieldId: IdSchema,
  selected: z.array(OptionIdSchema),
});

export const ClearFieldPatchSchema = z.object({
  op: z.literal("clear_field"),
  fieldId: IdSchema,
});

export const PatchSchema = z.discriminatedUnion("op", [
  SetStringPatchSchema,
  SetNumberPatchSchema,
  SetStringListPatchSchema,
  SetCheckboxesPatchSchema,
  SetSingleSelectPatchSchema,
  SetMultiSelectPatchSchema,
  ClearFieldPatchSchema,
]);

// Harness schemas
export const StepResultSchema = z.object({
  structureSummary: StructureSummarySchema,
  progressSummary: ProgressSummarySchema,
  issues: z.array(InspectIssueSchema),
  stepBudget: z.number().int().nonnegative(),
  isComplete: z.boolean(),
  turnNumber: z.number().int().positive(),
});

// Session transcript schemas
export const HarnessConfigSchema = z.object({
  maxIssues: z.number().int().positive(),
  maxPatchesPerTurn: z.number().int().positive(),
  maxTurns: z.number().int().positive(),
});

export const SessionTurnSchema = z.object({
  turn: z.number().int().positive(),
  inspect: z.object({
    issues: z.array(InspectIssueSchema),
  }),
  apply: z.object({
    patches: z.array(PatchSchema),
  }),
  after: z.object({
    requiredIssueCount: z.number().int().nonnegative(),
    markdownSha256: z.string(),
  }),
});

export const SessionFinalSchema = z.object({
  expectComplete: z.boolean(),
  expectedCompletedForm: z.string(),
});

export const SessionTranscriptSchema = z.object({
  sessionVersion: z.string(),
  mode: z.enum(["mock", "live"]),
  form: z.object({
    path: z.string(),
  }),
  validators: z
    .object({
      code: z.string().optional(),
    })
    .optional(),
  mock: z
    .object({
      completedMock: z.string(),
    })
    .optional(),
  harness: HarnessConfigSchema,
  turns: z.array(SessionTurnSchema),
  final: SessionFinalSchema,
});

// Frontmatter schema
export const MarkformFrontmatterSchema = z.object({
  markformVersion: z.string(),
  formSummary: StructureSummarySchema,
  formProgress: ProgressSummarySchema,
  formState: ProgressStateSchema,
});
