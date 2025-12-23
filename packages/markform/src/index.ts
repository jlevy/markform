/**
 * Markform - Agent-friendly, human-readable, editable forms.
 *
 * This is the main library entry point that exports the core engine,
 * types, and utilities for working with .form.md files.
 */

/** Markform version. */
export const VERSION = "0.1.0";

// =============================================================================
// Type Exports
// =============================================================================

export type {
  // Basic types
  Id,
  OptionId,
  QualifiedOptionRef,
  ValidatorRef,
  // Checkbox types
  MultiCheckboxState,
  SimpleCheckboxState,
  ExplicitCheckboxValue,
  CheckboxValue,
  CheckboxMode,
  // Field types
  FieldKind,
  FieldBase,
  StringField,
  NumberField,
  StringListField,
  Option,
  CheckboxesField,
  SingleSelectField,
  MultiSelectField,
  Field,
  // Form structure
  FieldGroup,
  FormSchema,
  // Field values
  StringValue,
  NumberValue,
  StringListValue,
  CheckboxesValue,
  SingleSelectValue,
  MultiSelectValue,
  FieldValue,
  // Documentation
  DocBlockKind,
  DocumentationBlock,
  // Parsed form
  IdIndexEntry,
  ParsedForm,
  // Validation
  Severity,
  SourcePosition,
  SourceRange,
  ValidationIssue,
  // Inspect
  IssueReason,
  InspectIssue,
  // Summaries
  StructureSummary,
  ProgressState,
  CheckboxProgressCounts,
  FieldProgress,
  ProgressCounts,
  ProgressSummary,
  // Results
  InspectResult,
  ApplyResult,
  // Patches
  SetStringPatch,
  SetNumberPatch,
  SetStringListPatch,
  SetCheckboxesPatch,
  SetSingleSelectPatch,
  SetMultiSelectPatch,
  ClearFieldPatch,
  Patch,
  // Harness
  StepResult,
  HarnessConfig,
  SessionTurn,
  SessionFinal,
  SessionTranscript,
  // Frontmatter
  MarkformFrontmatter,
  // Validators
  ValidatorContext,
  ValidatorFn,
  ValidatorRegistry,
} from "./engine/types.js";

// =============================================================================
// Schema Exports
// =============================================================================

export {
  // Basic schemas
  IdSchema,
  OptionIdSchema,
  ValidatorRefSchema,
  // Checkbox schemas
  MultiCheckboxStateSchema,
  SimpleCheckboxStateSchema,
  ExplicitCheckboxValueSchema,
  CheckboxValueSchema,
  CheckboxModeSchema,
  // Field schemas
  FieldKindSchema,
  OptionSchema,
  StringFieldSchema,
  NumberFieldSchema,
  StringListFieldSchema,
  CheckboxesFieldSchema,
  SingleSelectFieldSchema,
  MultiSelectFieldSchema,
  FieldSchema,
  // Form schemas
  FieldGroupSchema,
  FormSchemaSchema,
  // Value schemas
  StringValueSchema,
  NumberValueSchema,
  StringListValueSchema,
  CheckboxesValueSchema,
  SingleSelectValueSchema,
  MultiSelectValueSchema,
  FieldValueSchema,
  // Documentation schemas
  DocBlockKindSchema,
  DocumentationBlockSchema,
  // Validation schemas
  SeveritySchema,
  SourcePositionSchema,
  SourceRangeSchema,
  ValidationIssueSchema,
  // Inspect schemas
  IssueReasonSchema,
  InspectIssueSchema,
  // Summary schemas
  ProgressStateSchema,
  CheckboxProgressCountsSchema,
  FieldProgressSchema,
  ProgressCountsSchema,
  ProgressSummarySchema,
  StructureSummarySchema,
  // Result schemas
  InspectResultSchema,
  ApplyResultSchema,
  // Patch schemas
  SetStringPatchSchema,
  SetNumberPatchSchema,
  SetStringListPatchSchema,
  SetCheckboxesPatchSchema,
  SetSingleSelectPatchSchema,
  SetMultiSelectPatchSchema,
  ClearFieldPatchSchema,
  PatchSchema,
  // Harness schemas
  StepResultSchema,
  HarnessConfigSchema,
  SessionTurnSchema,
  SessionFinalSchema,
  SessionTranscriptSchema,
  // Frontmatter schema
  MarkformFrontmatterSchema,
} from "./engine/types.js";

// =============================================================================
// Engine Exports
// =============================================================================

export { parseForm, ParseError } from "./engine/parse.js";
export { serialize } from "./engine/serialize.js";
export type { SerializeOptions } from "./engine/serialize.js";
export {
  computeStructureSummary,
  computeProgressSummary,
  computeFormState,
  isFormComplete,
  computeAllSummaries,
} from "./engine/summaries.js";
export type { ComputedSummaries } from "./engine/summaries.js";
export { validate } from "./engine/validate.js";
export type { ValidateOptions, ValidateResult } from "./engine/validate.js";
