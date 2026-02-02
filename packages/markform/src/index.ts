/**
 * Markform - Agent-friendly, human-readable, editable forms.
 *
 * This is the main library entry point that exports the core engine,
 * types, and utilities for working with .form.md files.
 */

// Build-time injected by tsdown (see tsdown.config.ts)
declare const __MARKFORM_VERSION__: string;

/** Markform version (injected at build time). */
export const VERSION: string =
  typeof __MARKFORM_VERSION__ !== 'undefined' ? __MARKFORM_VERSION__ : 'development';

// =============================================================================
// Type Exports
// =============================================================================

export type {
  // Basic types
  Id,
  OptionId,
  QualifiedOptionRef,
  QualifiedColumnRef,
  ValidatorRef,
  // Checkbox types
  MultiCheckboxState,
  SimpleCheckboxState,
  ExplicitCheckboxValue,
  CheckboxValue,
  CheckboxMode,
  // Field kinds
  FieldKind,
  FieldBase,
  StringField,
  NumberField,
  StringListField,
  Option,
  CheckboxesField,
  SingleSelectField,
  MultiSelectField,
  UrlField,
  UrlListField,
  DateField,
  YearField,
  // Table field definitions
  ColumnTypeName,
  TableColumn,
  TableField,
  CellResponse,
  TableRowResponse,
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
  UrlValue,
  UrlListValue,
  DateValue,
  YearValue,
  TableValue,
  FieldValue,
  // Documentation
  DocumentationTag,
  DocumentationBlock,
  // Answer state and field response
  AnswerState,
  FieldResponse,
  // Parsed form
  NodeType,
  IdIndexEntry,
  ParsedForm,
  // Validation
  Severity,
  SourcePosition,
  SourceRange,
  ValidationIssue,
  // Inspect
  IssueReason,
  IssueScope,
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
  PatchRejection,
  // Patches
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
  TableRowPatch,
  SetTablePatch,
  ClearFieldPatch,
  Patch,
  // Harness
  StepResult,
  HarnessConfig,
  SessionTurn,
  SessionTurnStats,
  SessionFinal,
  SessionTranscript,
  // Wire format (for session logging)
  WireFormat,
  WireRequestFormat,
  WireResponseFormat,
  WireResponseStep,
  WireToolCall,
  WireToolResult,
  // Frontmatter
  MarkformFrontmatter,
  FrontmatterHarnessConfig,
  // Run mode
  RunMode,
  // Validators
  ValidatorContext,
  ValidatorFn,
  ValidatorRegistry,
} from './engine/coreTypes.js';

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
  UrlFieldSchema,
  UrlListFieldSchema,
  DateFieldSchema,
  YearFieldSchema,
  // Table field schemas
  ColumnTypeNameSchema,
  TableColumnSchema,
  TableFieldSchema,
  CellResponseSchema,
  TableRowResponseSchema,
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
  UrlValueSchema,
  UrlListValueSchema,
  DateValueSchema,
  YearValueSchema,
  TableValueSchema,
  FieldValueSchema,
  // Documentation schemas
  DocumentationTagSchema,
  DocumentationBlockSchema,
  // Validation schemas
  SeveritySchema,
  SourcePositionSchema,
  SourceRangeSchema,
  ValidationIssueSchema,
  // Inspect schemas
  IssueReasonSchema,
  IssueScopeSchema,
  InspectIssueSchema,
  // Answer state and field response schemas
  AnswerStateSchema,
  FieldResponseSchema,
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
  SetUrlPatchSchema,
  SetUrlListPatchSchema,
  SetDatePatchSchema,
  SetYearPatchSchema,
  TableRowPatchSchema,
  SetTablePatchSchema,
  ClearFieldPatchSchema,
  PatchSchema,
  // Harness schemas
  StepResultSchema,
  HarnessConfigSchema,
  SessionTurnSchema,
  SessionFinalSchema,
  SessionTranscriptSchema,
  // Wire format schemas
  WireFormatSchema,
  WireRequestFormatSchema,
  WireResponseFormatSchema,
  WireResponseStepSchema,
  WireToolCallSchema,
  WireToolResultSchema,
  // Frontmatter schemas
  MarkformFrontmatterSchema,
  MarkformSectionInputSchema,
  // Run mode schema
  RunModeSchema,
} from './engine/coreTypes.js';

// =============================================================================
// Engine Exports
// =============================================================================

export { parseForm } from './engine/parse.js';
export { serializeForm, serializeReport } from './engine/serialize.js';
export type { SerializeOptions } from './engine/serialize.js';
export {
  computeStructureSummary,
  computeProgressSummary,
  computeFormState,
  isFormComplete,
  computeAllSummaries,
} from './engine/summaries.js';
export type { ComputedSummaries } from './engine/summaries.js';
export { validate } from './engine/validate.js';
export type { ValidateOptions, ValidateResult } from './engine/validate.js';
export { inspect } from './engine/inspect.js';
export type { InspectOptions } from './engine/inspect.js';
export { parseSession, serializeSession } from './engine/session.js';
export { applyPatches } from './engine/apply.js';

// =============================================================================
// Markdown Utilities
// =============================================================================

export { findAllHeadings, findEnclosingHeadings } from './markdown/markdownHeaders.js';
export type { HeadingInfo } from './markdown/markdownHeaders.js';

// =============================================================================
// ID Injection
// =============================================================================

export { findAllCheckboxes, injectCheckboxIds, injectHeaderIds } from './engine/injectIds.js';
export type {
  CheckboxInfo,
  InjectCheckboxIdsOptions,
  InjectHeaderIdsOptions,
  InjectIdsResult,
} from './engine/injectIds.js';

// =============================================================================
// JSON Schema Export
// =============================================================================

export { formToJsonSchema, fieldToJsonSchema } from './engine/jsonSchema.js';
export type {
  JsonSchemaOptions,
  JsonSchemaResult,
  JsonSchemaDraft,
  MarkformSchemaExtension,
  MarkformFieldExtension,
} from './engine/jsonSchema.js';

// =============================================================================
// Table Parsing Exports
// =============================================================================

export { parseMarkdownTable, parseCellValue, parseRawTable } from './engine/table/index.js';
export type { ParseTableResult, ParsedRawTable } from './engine/table/index.js';

// =============================================================================
// Scope Reference Exports
// =============================================================================

export {
  parseScopeRef,
  serializeScopeRef,
  isCellRef,
  isQualifiedRef,
  isFieldRef,
  getFieldId,
} from './engine/scopeRef.js';
export type {
  FieldScopeRef,
  QualifiedScopeRef,
  CellScopeRef,
  ParsedScopeRef,
  ParseScopeRefResult,
} from './engine/scopeRef.js';

// =============================================================================
// Value Coercion Exports
// =============================================================================

export { findFieldById, coerceToFieldPatch, coerceInputContext } from './engine/valueCoercion.js';
export type {
  RawFieldValue,
  InputContext,
  CoercionResult,
  CoerceInputContextResult,
} from './engine/valueCoercion.js';

// =============================================================================
// Harness Exports
// =============================================================================

export { FormHarness, createHarness } from './harness/harness.js';
export { MockAgent, createMockAgent } from './harness/mockAgent.js';
export { fillForm } from './harness/programmaticFill.js';
export { resolveHarnessConfig } from './harness/harnessConfigResolver.js';
export {
  ParallelHarness,
  createParallelHarness,
  scopeIssuesForItem,
} from './harness/parallelHarness.js';
export type {
  ScopedFillRequest,
  ParallelHarnessConfig,
  ParallelStepResult,
  ParallelRunResult,
} from './harness/parallelHarness.js';
export type {
  FillCallbacks,
  FillOptions,
  FillResult,
  FillStatus,
  TurnProgress,
  TurnStats,
  AgentResponse,
} from './harness/harnessTypes.js';

// =============================================================================
// FillRecord Exports
// =============================================================================

export { FillRecordCollector } from './harness/fillRecordCollector.js';
export type { FillRecordCollectorOptions } from './harness/fillRecordCollector.js';
export { formatFillRecordSummary } from './harness/formatFillRecordSummary.js';
export type { FormatFillRecordSummaryOptions } from './harness/formatFillRecordSummary.js';
export type {
  FillRecord,
  FillRecordStatus,
  TimelineEntry,
  ToolCallRecord,
  ToolStats,
  ToolSummary,
  TimingBreakdown,
  TimingBreakdownItem,
  ExecutionMetadata,
} from './harness/fillRecord.js';
export {
  FillRecordSchema,
  FillRecordStatusSchema,
  TimelineEntrySchema,
  ToolCallRecordSchema,
  ToolStatsSchema,
  ToolSummarySchema,
  TimingBreakdownSchema,
  TimingBreakdownItemSchema,
  ExecutionMetadataSchema,
} from './harness/fillRecord.js';

// =============================================================================
// Research Exports
// =============================================================================

export { runResearch } from './research/runResearch.js';
export type { ResearchOptions } from './research/runResearch.js';
export { isResearchForm, validateResearchForm } from './research/researchFormValidation.js';
export type { ResearchResult, ResearchStatus } from './research/researchTypes.js';

// =============================================================================
// Error Exports
// =============================================================================

export {
  // Error classes
  MarkformError,
  MarkformParseError,
  MarkformPatchError,
  MarkformValidationError,
  MarkformLlmError,
  MarkformConfigError,
  MarkformAbortError,
  // Backward compatibility alias (deprecated - use MarkformParseError)
  ParseError,
  // Type guards
  isMarkformError,
  isParseError,
  isPatchError,
  isValidationError,
  isLlmError,
  isConfigError,
  isAbortError,
  isRetryableError,
} from './errors.js';
