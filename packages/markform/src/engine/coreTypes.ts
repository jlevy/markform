/**
 * Core types and Zod schemas for Markform.
 *
 * This module defines all TypeScript types and their corresponding Zod schemas
 * for forms, fields, values, validation, patches, and session transcripts.
 */

import { z } from 'zod';

// =============================================================================
// Basic Types
// =============================================================================

/** Form/group/field ID - globally unique within a document */
export type Id = string;

/** Option ID - unique within its containing field */
export type OptionId = string;

/** Qualified option reference - used in doc blocks and external references */
export type QualifiedOptionRef = `${Id}.${OptionId}`;

/** Qualified column reference - used in table field references (e.g., "team.name") */
export type QualifiedColumnRef = `${Id}.${Id}`;

/** Validator reference - simple ID or parameterized object */
export type ValidatorRef = string | { id: string; [key: string]: unknown };

// =============================================================================
// Answer State Types (markform-255)
// =============================================================================

/**
 * Answer state for a field.
 * What action was taken: no answer yet, answered, skipped, or aborted.
 */
export type AnswerState = 'unanswered' | 'answered' | 'skipped' | 'aborted';

/**
 * Field response: combines answer state with optional value.
 * Used in responsesByFieldId for all fields.
 */
export interface FieldResponse {
  state: AnswerState;
  value?: FieldValue; // present only when state === 'answered'
  reason?: string; // present when state === 'skipped' or 'aborted'
}

// =============================================================================
// Note Types (markform-205)
// =============================================================================

/** Unique note ID (implementation uses n1, n2, n3...) */
export type NoteId = string;

/** Note attached to a field, group, or form */
export interface Note {
  id: NoteId;
  ref: Id; // target ID (field, group, or form)
  role: string; // who created (agent, user, ...)
  text: string; // markdown content
}

// =============================================================================
// Checkbox Types
// =============================================================================

/** Multi-checkbox states (checkboxMode="multi", default) - 5 states */
export type MultiCheckboxState = 'todo' | 'done' | 'incomplete' | 'active' | 'na';

/** Simple checkbox states (checkboxMode="simple") - 2 states, GFM-compatible */
export type SimpleCheckboxState = 'todo' | 'done';

/** Explicit checkbox values (checkboxMode="explicit") - requires yes/no answer */
export type ExplicitCheckboxValue = 'unfilled' | 'yes' | 'no';

/** Union type for all checkbox values */
export type CheckboxValue = MultiCheckboxState | ExplicitCheckboxValue;

/** Checkbox mode determines which states are valid */
export type CheckboxMode = 'multi' | 'simple' | 'explicit';

/**
 * Controls how fill handles existing values for target role fields.
 * - 'continue': Skip fields that already have values (default)
 * - 'overwrite': Clear and re-fill all fields for the target role
 */
export type FillMode = 'continue' | 'overwrite';

/**
 * Agent mode for fill operations.
 * - 'mock': Use mock agent (for testing, requires mock source file)
 * - 'live': Use live LLM agent (default, requires model)
 */
export type MockMode = 'mock' | 'live';

/**
 * Controls whether a checkbox field acts as a blocking checkpoint.
 * - 'none': No blocking behavior (default)
 * - 'blocking': Fields after this cannot be filled until checkbox is complete
 */
export type ApprovalMode = 'none' | 'blocking';

// =============================================================================
// Field Kinds
// =============================================================================

/** Field kind discriminant */
export type FieldKind =
  | 'string'
  | 'number'
  | 'string_list'
  | 'checkboxes'
  | 'single_select'
  | 'multi_select'
  | 'url'
  | 'url_list'
  | 'date'
  | 'year'
  | 'table';

// =============================================================================
// Table Field Definitions
// =============================================================================

/** Base column type for table cells - simple types only */
export type ColumnTypeName = 'string' | 'number' | 'url' | 'date' | 'year';

/**
 * Column type specification in attributes.
 * Can be a simple string or an object with required flag.
 */
export type ColumnTypeSpec = ColumnTypeName | { type: ColumnTypeName; required: boolean };

/**
 * Column definition - derived from columnIds, columnLabels, columnTypes attributes.
 * After parsing, columns always have explicit required flag (default: false).
 */
export interface TableColumn {
  id: Id; // from columnIds array
  label: string; // from columnLabels array (defaults to id)
  type: ColumnTypeName; // from columnTypes array (defaults to 'string')
  required: boolean; // from columnTypes object or default false
}

/** Field priority level for issue scoring */
export type FieldPriorityLevel = 'high' | 'medium' | 'low';

/** Base interface for all field kinds */
export interface FieldBase {
  id: Id;
  label: string;
  required: boolean; // explicit: parser defaults to false if not specified
  priority: FieldPriorityLevel; // explicit: parser defaults to 'medium' if not specified
  role: string; // explicit: parser defaults to AGENT_ROLE if not specified
  validate?: ValidatorRef[];
  /** Whether to include this field in report output. Default: true */
  report?: boolean;
  /** Hint text for empty field (text-entry fields only) */
  placeholder?: string;
  /** Example values (text-entry fields only) */
  examples?: string[];
}

// =============================================================================
// Field Kind Categories
// =============================================================================

/** Field kinds that accept text entry (support placeholder/examples) */
export const TEXT_ENTRY_FIELD_KINDS = [
  'string',
  'number',
  'string_list',
  'url',
  'url_list',
] as const;

/** Field kinds that are choosers (do NOT support placeholder/examples) */
export const CHOOSER_FIELD_KINDS = ['single_select', 'multi_select', 'checkboxes'] as const;

/**
 * Check if a field kind accepts text entry (supports placeholder/examples).
 */
export function isTextEntryFieldKind(kind: FieldKind): boolean {
  return (TEXT_ENTRY_FIELD_KINDS as readonly string[]).includes(kind);
}

/** String field - single or multiline text */
export interface StringField extends FieldBase {
  kind: 'string';
  multiline?: boolean;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
}

/** Number field - numeric value with optional constraints */
export interface NumberField extends FieldBase {
  kind: 'number';
  min?: number;
  max?: number;
  integer?: boolean;
}

/** String list field - array of user-provided strings */
export interface StringListField extends FieldBase {
  kind: 'string_list';
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
  kind: 'checkboxes';
  checkboxMode: CheckboxMode; // explicit: parser defaults to 'multi' if not specified
  minDone?: number;
  options: Option[];
  approvalMode: ApprovalMode; // explicit: parser defaults to 'none' if not specified
}

/** Single-select field - exactly one option can be selected */
export interface SingleSelectField extends FieldBase {
  kind: 'single_select';
  options: Option[];
}

/** Multi-select field - multiple options can be selected */
export interface MultiSelectField extends FieldBase {
  kind: 'multi_select';
  options: Option[];
  minSelections?: number;
  maxSelections?: number;
}

/** URL field - single URL value with built-in format validation */
export interface UrlField extends FieldBase {
  kind: 'url';
  // No additional constraints - URL format validation is built-in
}

/** URL list field - multiple URLs (for citations, sources, references) */
export interface UrlListField extends FieldBase {
  kind: 'url_list';
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
}

/** Date field - ISO 8601 date (YYYY-MM-DD) with optional min/max constraints */
export interface DateField extends FieldBase {
  kind: 'date';
  min?: string; // ISO 8601 date string (YYYY-MM-DD)
  max?: string; // ISO 8601 date string (YYYY-MM-DD)
}

/** Year field - integer year with optional min/max constraints */
export interface YearField extends FieldBase {
  kind: 'year';
  min?: number; // minimum year (inclusive)
  max?: number; // maximum year (inclusive)
}

/**
 * Table field - structured tabular data with typed columns.
 * Inherits all FieldBase properties including `report?: boolean`.
 */
export interface TableField extends FieldBase {
  kind: 'table';
  columns: TableColumn[]; // column definitions in order
  minRows?: number;
  maxRows?: number;
}

/** Union of all field kinds */
export type Field =
  | StringField
  | NumberField
  | StringListField
  | CheckboxesField
  | SingleSelectField
  | MultiSelectField
  | UrlField
  | UrlListField
  | DateField
  | YearField
  | TableField;

// =============================================================================
// Form Structure Types
// =============================================================================

/**
 * Field group: container for fields (nested groups deferred to future).
 */
export interface FieldGroup {
  id: Id;
  title?: string;
  validate?: ValidatorRef[];
  children: Field[];
  /** Whether to include this group in report output. Default: true */
  report?: boolean;
  /**
   * True if this group was implicitly created for fields placed directly
   * under the form (not wrapped in an explicit group).
   * Implicit groups are serialized without group wrapper tags.
   */
  implicit?: boolean;
}

/** Form schema - root container with groups */
export interface FormSchema {
  id: Id;
  title?: string;
  description?: string;
  groups: FieldGroup[];
}

// =============================================================================
// Field Value Types
// =============================================================================

/** String field value */
export interface StringValue {
  kind: 'string';
  value: string | null;
}

/** Number field value */
export interface NumberValue {
  kind: 'number';
  value: number | null;
}

/** String list field value */
export interface StringListValue {
  kind: 'string_list';
  items: string[];
}

/** Checkboxes field value */
export interface CheckboxesValue {
  kind: 'checkboxes';
  values: Record<OptionId, CheckboxValue>;
}

/** Single-select field value */
export interface SingleSelectValue {
  kind: 'single_select';
  selected: OptionId | null;
}

/** Multi-select field value */
export interface MultiSelectValue {
  kind: 'multi_select';
  selected: OptionId[];
}

/** URL field value */
export interface UrlValue {
  kind: 'url';
  value: string | null; // null if empty, validated URL string otherwise
}

/** URL list field value */
export interface UrlListValue {
  kind: 'url_list';
  items: string[]; // Array of URL strings
}

/** Date field value */
export interface DateValue {
  kind: 'date';
  value: string | null; // ISO 8601 date string (YYYY-MM-DD) or null
}

/** Year field value */
export interface YearValue {
  kind: 'year';
  value: number | null; // integer year or null
}

/**
 * Cell value - scalar value only (never null).
 * Empty/skipped cells use %SKIP% sentinel, not null.
 */
export type CellValue = string | number;

/**
 * Cell response - matches FieldResponse pattern.
 * Used in internal representation (ParsedForm).
 */
export interface CellResponse {
  state: 'answered' | 'skipped' | 'aborted'; // cells cannot be 'unanswered'
  value?: CellValue; // present when state === 'answered'
  reason?: string; // present when state === 'skipped' or 'aborted'
}

/** Table row response - each cell has a response (internal representation) */
export type TableRowResponse = Record<Id, CellResponse>;

/** Table field value (internal representation) */
export interface TableValue {
  kind: 'table';
  rows: TableRowResponse[];
}

/** Union of all field value types */
export type FieldValue =
  | StringValue
  | NumberValue
  | StringListValue
  | CheckboxesValue
  | SingleSelectValue
  | MultiSelectValue
  | UrlValue
  | UrlListValue
  | DateValue
  | YearValue
  | TableValue;

// =============================================================================
// Documentation Block
// =============================================================================

/** Documentation tag type - determines the semantic purpose of the block */
export type DocumentationTag = 'description' | 'instructions' | 'documentation';

/** Documentation block attached to form elements */
export interface DocumentationBlock {
  /** The semantic tag type: description, instructions, or documentation */
  tag: DocumentationTag;
  /** Reference to form/group/field ID or qualified option ref (fieldId.optionId) */
  ref: string;
  bodyMarkdown: string;
  /**
   * Whether to include this block in report output.
   * Default: false for 'instructions' tag, true for others.
   */
  report?: boolean;
}

// =============================================================================
// Form Metadata (from frontmatter)
// =============================================================================

/**
 * Optional harness configuration from frontmatter.
 * Forms can specify default harness settings for fill operations.
 */
export interface FrontmatterHarnessConfig {
  maxTurns?: number;
  maxPatchesPerTurn?: number;
  maxIssuesPerTurn?: number;
}

/**
 * Run mode for the form - determines how 'markform run' executes.
 * - interactive: Launch interactive fill for user-role fields
 * - fill: Prompt for model, run agent fill
 * - research: Prompt for web-search model, run research fill
 */
export type RunMode = 'interactive' | 'fill' | 'research';

/** Form-level metadata from YAML frontmatter, including role configuration */
export interface FormMetadata {
  markformVersion: string;
  roles: string[];
  roleInstructions: Record<string, string>;
  /** Optional harness configuration from frontmatter */
  harnessConfig?: FrontmatterHarnessConfig;
  /** How this form should be executed by 'markform run' */
  runMode?: RunMode;
}

// =============================================================================
// Parsed Form
// =============================================================================

/** Node type for ID index entries - identifies what structural element an ID refers to */
export type NodeType = 'form' | 'group' | 'field' | 'option';

/** ID index entry for fast lookup and validation */
export interface IdIndexEntry {
  nodeType: NodeType; // what this ID refers to
  parentId?: Id;
  fieldId?: Id;
}

/**
 * The syntax style used in a Markform document.
 * - 'comments': HTML comment syntax with f: namespace (`<!-- f:tag -->`) - primary/default
 * - 'tags': Traditional Markdoc Jinja-style syntax (`{% tag %}`)
 */
export type SyntaxStyle = 'comments' | 'tags';

/**
 * Tag types that can appear in Markform documents for position tracking.
 * - 'form': The root form tag
 * - 'group': Field group tags
 * - 'field': Individual field tags (may include value fence)
 * - 'note': Inline note tags (`{% note %}`)
 * - 'documentation': Documentation block tags (instructions, description, etc.)
 */
export type TagType = 'form' | 'group' | 'field' | 'note' | 'documentation';

/**
 * Position of a Markform tag region in the source document.
 * Used for splice-based serialization to preserve content outside tags.
 */
export interface TagRegion {
  /** ID of the element (form, group, field ID, or note ID) */
  tagId: Id;
  /** Type of Markform tag */
  tagType: TagType;
  /** Start position in rawSource (inclusive, byte offset) */
  startOffset: number;
  /** End position in rawSource (exclusive, byte offset) */
  endOffset: number;
  /**
   * For field tags: whether region includes value fence.
   * True if field has a value block between open/close tags.
   */
  includesValue?: boolean;
}

/** Canonical internal representation returned by parseForm() */
export interface ParsedForm {
  schema: FormSchema;
  responsesByFieldId: Record<Id, FieldResponse>; // replaces valuesByFieldId + skipsByFieldId
  notes: Note[]; // agent/user notes
  docs: DocumentationBlock[];
  orderIndex: Id[];
  idIndex: Map<Id, IdIndexEntry>;
  metadata?: FormMetadata; // optional for backward compat with forms without frontmatter
  /** The syntax style detected in the original document (for round-trip serialization) */
  syntaxStyle?: SyntaxStyle;

  // Raw source preservation for content-preserving serialization
  /**
   * Original markdown source (post-frontmatter, post-preprocessing for comment syntax).
   * Used for splice-based serialization to preserve content outside Markform tags.
   */
  rawSource?: string;
  /**
   * Positions of all Markform tags in rawSource.
   * Sorted by startOffset in document order.
   */
  tagRegions?: TagRegion[];
}

// =============================================================================
// Validation Types
// =============================================================================

/** Validation issue severity */
export type Severity = 'error' | 'warning' | 'info';

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
  source: 'builtin' | 'code' | 'llm';
}

// =============================================================================
// Error Types (markform-210)
// =============================================================================

/** Location information for error reporting */
export interface ErrorLocation {
  line?: number;
  column?: number;
  fieldId?: Id;
  noteId?: NoteId;
}

/** Markdown/Markdoc syntax error */
export interface ParseError {
  type: 'parse';
  message: string;
  location?: ErrorLocation;
}

/** Markform model consistency error */
export interface MarkformValidationError {
  type: 'validation';
  message: string;
  location?: ErrorLocation;
}

/** Union of all Markform error types */
export type MarkformError = ParseError | MarkformValidationError;

// =============================================================================
// Inspect Types
// =============================================================================

/** Standard reason codes for inspect issues */
export type IssueReason =
  | 'validation_error'
  | 'required_missing'
  | 'checkbox_incomplete'
  | 'min_items_not_met'
  | 'optional_unanswered';

/** Issue scope - the level at which the issue applies */
export type IssueScope = 'form' | 'group' | 'field' | 'option' | 'column' | 'cell';

/** Inspect issue - unified type for agent/UI consumption */
export interface InspectIssue {
  ref: string;
  scope: IssueScope;
  reason: IssueReason;
  message: string;
  severity: 'required' | 'recommended';
  priority: number;
  blockedBy?: Id; // if field is blocked by an incomplete blocking checkpoint
}

// =============================================================================
// Summary Types
// =============================================================================

/** Structure summary - describes static form schema */
export interface StructureSummary {
  groupCount: number;
  fieldCount: number;
  optionCount: number;
  /** Count of table columns across all table fields */
  columnCount: number;
  fieldCountByKind: Record<FieldKind, number>;
  groupsById: Record<Id, 'field_group'>;
  fieldsById: Record<Id, FieldKind>;
  optionsById: Record<QualifiedOptionRef, { parentFieldId: Id; parentFieldKind: FieldKind }>;
  /** Map of qualified column refs to column metadata */
  columnsById: Record<QualifiedColumnRef, { parentFieldId: Id; columnType: ColumnTypeName }>;
}

/** Progress state for a field or form */
export type ProgressState = 'empty' | 'incomplete' | 'invalid' | 'complete';

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

/**
 * Field progress tracking.
 * Uses orthogonal booleans instead of ProgressState enum.
 */
export interface FieldProgress {
  kind: FieldKind;
  required: boolean;
  answerState: AnswerState;
  hasNotes: boolean;
  noteCount: number;
  /** Whether the field has a value (answered, or has checkbox selections) */
  empty: boolean;
  /** Whether the field passes validation (no issues) */
  valid: boolean;
  issueCount: number;
  checkboxProgress?: CheckboxProgressCounts;
}

/**
 * Progress counts rollup with three orthogonal dimensions.
 */
export interface ProgressCounts {
  totalFields: number;
  requiredFields: number;

  // Dimension 1: AnswerState (mutually exclusive, sum to totalFields)
  unansweredFields: number;
  answeredFields: number;
  skippedFields: number;
  abortedFields: number;

  // Dimension 2: Validity (mutually exclusive, sum to totalFields)
  validFields: number;
  invalidFields: number;

  // Dimension 3: Value presence (mutually exclusive, sum to totalFields)
  emptyFields: number;
  filledFields: number;

  // Derived counts
  emptyRequiredFields: number;
  totalNotes: number;
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

/** Details about a rejected patch */
export interface PatchRejection {
  patchIndex: number;
  message: string;
  /** Field ID if available (for type mismatch errors) */
  fieldId?: string;
  /** Field kind if available (for type mismatch errors) */
  fieldKind?: string;
  /** Column IDs if available (for table fields) */
  columnIds?: string[];
}

/** Coercion type for patch warnings */
export type PatchCoercionType =
  | 'string_to_list'
  | 'url_to_list'
  | 'option_to_array'
  | 'boolean_to_checkbox'
  | 'array_to_checkboxes';

/** Warning for coerced patches */
export interface PatchWarning {
  patchIndex: number;
  fieldId: string;
  message: string;
  coercion: PatchCoercionType;
}

/** Status of patch application */
export type ApplyStatus = 'applied' | 'partial' | 'rejected';

/** Result from apply operation */
export interface ApplyResult {
  applyStatus: ApplyStatus;
  structureSummary: StructureSummary;
  progressSummary: ProgressSummary;
  issues: InspectIssue[];
  isComplete: boolean;
  formState: ProgressState;
  /** Patches that were successfully applied (normalized/coerced) */
  appliedPatches: Patch[];
  /** Empty on success, contains rejection details on failure */
  rejectedPatches: PatchRejection[];
  /** Warnings for patches that were coerced */
  warnings: PatchWarning[];
}

// =============================================================================
// Patch Types
// =============================================================================

/** Set string field value */
export interface SetStringPatch {
  op: 'set_string';
  fieldId: Id;
  value: string | null;
}

/** Set number field value */
export interface SetNumberPatch {
  op: 'set_number';
  fieldId: Id;
  value: number | null;
}

/** Set string list field value */
export interface SetStringListPatch {
  op: 'set_string_list';
  fieldId: Id;
  value: string[];
}

/** Set checkboxes field value (merges with existing) */
export interface SetCheckboxesPatch {
  op: 'set_checkboxes';
  fieldId: Id;
  value: Record<OptionId, CheckboxValue>;
}

/** Set single-select field value */
export interface SetSingleSelectPatch {
  op: 'set_single_select';
  fieldId: Id;
  value: OptionId | null;
}

/** Set multi-select field value */
export interface SetMultiSelectPatch {
  op: 'set_multi_select';
  fieldId: Id;
  value: OptionId[];
}

/** Set URL field value */
export interface SetUrlPatch {
  op: 'set_url';
  fieldId: Id;
  value: string | null;
}

/** Set URL list field value */
export interface SetUrlListPatch {
  op: 'set_url_list';
  fieldId: Id;
  value: string[];
}

/** Set date field value */
export interface SetDatePatch {
  op: 'set_date';
  fieldId: Id;
  value: string | null; // ISO 8601 date string (YYYY-MM-DD) or null
}

/** Set year field value */
export interface SetYearPatch {
  op: 'set_year';
  fieldId: Id;
  value: number | null; // integer year or null
}

/**
 * Table row for patches - simplified format.
 * Values can be:
 * - Actual value (string/number)
 * - null to indicate %SKIP% (serialized as %SKIP% in markdown)
 * - "%SKIP%" or "%ABORT%" sentinel strings with optional reason
 */
export type TableRowPatch = Record<Id, CellValue | null | string>;

/**
 * Set table field patch.
 * Uses simplified format where null values become %SKIP% on serialize.
 */
export interface SetTablePatch {
  op: 'set_table';
  fieldId: Id;
  value: TableRowPatch[];
}

/** Clear field value */
export interface ClearFieldPatch {
  op: 'clear_field';
  fieldId: Id;
}

/** Skip field - explicitly skip an optional field without providing a value */
export interface SkipFieldPatch {
  op: 'skip_field';
  fieldId: Id;
  role: string; // required: who is skipping
  reason?: string; // optional reason for skipping
}

/** Abort field - mark a field as unable to be completed */
export interface AbortFieldPatch {
  op: 'abort_field';
  fieldId: Id;
  role: string;
  reason?: string;
}

/** Add note - attach a note to a form element */
export interface AddNotePatch {
  op: 'add_note';
  ref: Id;
  role: string;
  text: string;
}

/** Remove note - remove a specific note by ID */
export interface RemoveNotePatch {
  op: 'remove_note';
  noteId: NoteId;
}

/** Union of all patch types */
export type Patch =
  | SetStringPatch
  | SetNumberPatch
  | SetStringListPatch
  | SetCheckboxesPatch
  | SetSingleSelectPatch
  | SetMultiSelectPatch
  | SetUrlPatch
  | SetUrlListPatch
  | SetDatePatch
  | SetYearPatch
  | SetTablePatch
  | ClearFieldPatch
  | SkipFieldPatch
  | AbortFieldPatch
  | AddNotePatch
  | RemoveNotePatch;

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
  /** Number of patches actually applied (set by harness.apply, undefined for step-only results) */
  patchesApplied?: number;
  /** Rejection details if patches failed (set by harness.apply, undefined for step-only results) */
  rejectedPatches?: PatchRejection[];
}

// =============================================================================
// Session Transcript Types
// =============================================================================

/** Harness configuration */
export interface HarnessConfig {
  maxIssuesPerTurn: number;
  maxPatchesPerTurn: number;
  maxTurns: number;
  /** Maximum unique fields to include issues for per turn (undefined = unlimited) */
  maxFieldsPerTurn?: number;
  /** Maximum unique groups to include issues for per turn (undefined = unlimited) */
  maxGroupsPerTurn?: number;
  /** Target roles to fill (default: [AGENT_ROLE], '*' for all) */
  targetRoles?: string[];
  /** Fill mode: 'continue' (skip filled) or 'overwrite' (re-fill) */
  fillMode?: FillMode;
}

/** LLM stats for a turn (from live agent) */
export interface SessionTurnStats {
  /** Input tokens for this turn */
  inputTokens?: number;
  /** Output tokens for this turn */
  outputTokens?: number;
  /** Tool calls made during this turn */
  toolCalls?: { name: string; count: number }[];
}

/** Context prompts sent to LLM (for session logging and debugging) */
export interface SessionTurnContext {
  /** System prompt with instructions */
  systemPrompt: string;
  /** Context prompt with issues and field schema */
  contextPrompt: string;
}

// =============================================================================
// Wire Format Types (for comprehensive session logging)
// =============================================================================

/**
 * Tool call captured from LLM response step.
 * Omits toolCallId for stability (changes each run).
 */
export interface WireToolCall {
  /** Name of the tool that was called */
  toolName: string;
  /** Input passed to the tool */
  input: unknown;
}

/**
 * Tool result captured from LLM response step.
 * Omits toolCallId for stability (changes each run).
 */
export interface WireToolResult {
  /** Name of the tool that returned this result */
  toolName: string;
  /** Result returned by tool.execute() */
  result: unknown;
}

/**
 * A single step in the LLM response.
 * Corresponds to one iteration of the tool-calling loop.
 */
export interface WireResponseStep {
  /** Tool calls made in this step */
  toolCalls: WireToolCall[];
  /** Results returned by tools in this step */
  toolResults: WireToolResult[];
  /** Text output from the model in this step (null if none) */
  text: string | null;
}

/**
 * The request sent to the LLM via Vercel AI SDK generateText().
 */
export interface WireRequestFormat {
  /** System prompt with agent instructions */
  system: string;
  /** Context prompt with form state and issues */
  prompt: string;
  /** Tool definitions with descriptions and schemas */
  tools: Record<
    string,
    {
      /** Tool description shown to LLM */
      description: string;
      /** JSON Schema for tool input */
      inputSchema: unknown;
    }
  >;
}

/**
 * The response received from the LLM via Vercel AI SDK generateText().
 */
export interface WireResponseFormat {
  /** Steps in the tool-calling loop */
  steps: WireResponseStep[];
  /** Token usage for this call */
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

/**
 * Complete wire format capturing the LLM request and response.
 *
 * This captures the exact data sent to and received from the LLM,
 * enabling comprehensive regression testing and prompt engineering visibility.
 *
 * Used in session logging to provide a "transparent view" of LLM interactions
 * that can be diffed to catch changes in prompts, schemas, or error messages.
 */
export interface WireFormat {
  /** The request sent to the LLM */
  request: WireRequestFormat;
  /** The response received from the LLM */
  response: WireResponseFormat;
}

/** Session turn - one iteration of the harness loop */
export interface SessionTurn {
  turn: number;
  inspect: {
    issues: InspectIssue[];
  };
  /** Context sent to LLM (prompts with field schema info) */
  context?: SessionTurnContext;
  apply: {
    patches: Patch[];
    /** Patches that were rejected (type mismatch, invalid field, etc.) */
    rejectedPatches?: PatchRejection[];
    /** Warnings for patches that were coerced (e.g., string → array) */
    warnings?: PatchWarning[];
  };
  after: {
    requiredIssueCount: number;
    markdownSha256: string;
    answeredFieldCount: number;
    skippedFieldCount: number;
  };
  /** LLM stats (only present for live agent sessions) */
  llm?: SessionTurnStats;
  /**
   * Complete wire format for comprehensive session logging.
   * Captures exact LLM request/response for regression testing.
   * Optional - only populated when wire format capture is enabled.
   */
  wire?: WireFormat;
}

/** Final session expectations */
export interface SessionFinal {
  expectComplete: boolean;
  expectedCompletedForm: string;
}

/** Session transcript for golden testing */
export interface SessionTranscript {
  sessionVersion: string;
  mode: MockMode;
  form: {
    path: string;
  };
  validators?: {
    code?: string;
  };
  mock?: {
    completedMock: string;
  };
  live?: {
    modelId: string;
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
export const NoteIdSchema = z.string().min(1);

export const ValidatorRefSchema = z.union([z.string(), z.looseObject({ id: z.string() })]);

// Answer state schema (markform-255)
export const AnswerStateSchema = z.enum(['unanswered', 'answered', 'skipped', 'aborted']);

// Checkbox state schemas
export const MultiCheckboxStateSchema = z.enum(['todo', 'done', 'incomplete', 'active', 'na']);

export const SimpleCheckboxStateSchema = z.enum(['todo', 'done']);

export const ExplicitCheckboxValueSchema = z.enum(['unfilled', 'yes', 'no']);

export const CheckboxValueSchema = z.union([MultiCheckboxStateSchema, ExplicitCheckboxValueSchema]);

export const CheckboxModeSchema = z.enum(['multi', 'simple', 'explicit']);

export const FillModeSchema = z.enum(['continue', 'overwrite']);

export const MockModeSchema = z.enum(['mock', 'live']);

export const ApprovalModeSchema = z.enum(['none', 'blocking']);

// Field kind schema
export const FieldKindSchema = z.enum([
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
  'table',
]);

// =============================================================================
// Table Type Zod Schemas
// =============================================================================

/** Base column type name schema */
export const ColumnTypeNameSchema = z.enum(['string', 'number', 'url', 'date', 'year']);

/**
 * Column type specification schema (for parsing attributes).
 * Either a simple type name or an object with type and required.
 */
export const ColumnTypeSpecSchema = z.union([
  ColumnTypeNameSchema,
  z.object({
    type: ColumnTypeNameSchema,
    required: z.boolean(),
  }),
]);

/**
 * Table column schema (normalized form after parsing).
 * Always has explicit required flag.
 */
export const TableColumnSchema = z.object({
  id: IdSchema,
  label: z.string(),
  type: ColumnTypeNameSchema,
  required: z.boolean(),
});

/** Cell value schema (never null - use sentinels for skipped) */
export const CellValueSchema = z.union([z.string(), z.number()]);

/** Cell response schema */
export const CellResponseSchema = z.object({
  state: z.enum(['answered', 'skipped', 'aborted']),
  value: CellValueSchema.optional(),
  reason: z.string().optional(),
});

/** Table row response schema */
export const TableRowResponseSchema = z.record(IdSchema, CellResponseSchema);

/** Table value schema */
export const TableValueSchema = z.object({
  kind: z.literal('table'),
  rows: z.array(TableRowResponseSchema),
});

/** Table row patch schema (simplified for patches) */
export const TableRowPatchSchema = z.record(
  IdSchema,
  z.union([CellValueSchema, z.null(), z.string()]), // null or sentinel string
);

export const FieldPriorityLevelSchema = z.enum(['high', 'medium', 'low']);

// Option schema
export const OptionSchema = z.object({
  id: IdSchema,
  label: z.string(),
});

// Field base schema (partial, used for extension)
// NOTE: required, priority, and role are explicit (not optional) - parser assigns defaults
const FieldBaseSchemaPartial = {
  id: IdSchema,
  label: z.string(),
  required: z.boolean(),
  priority: FieldPriorityLevelSchema,
  role: z.string(),
  validate: z.array(ValidatorRefSchema).optional(),
  report: z.boolean().optional(),
  placeholder: z.string().optional(),
  examples: z.array(z.string()).optional(),
};

// Field schemas
export const StringFieldSchema = z.object({
  ...FieldBaseSchemaPartial,
  kind: z.literal('string'),
  multiline: z.boolean().optional(),
  pattern: z.string().optional(),
  minLength: z.number().int().nonnegative().optional(),
  maxLength: z.number().int().nonnegative().optional(),
});

export const NumberFieldSchema = z.object({
  ...FieldBaseSchemaPartial,
  kind: z.literal('number'),
  min: z.number().optional(),
  max: z.number().optional(),
  integer: z.boolean().optional(),
});

export const StringListFieldSchema = z.object({
  ...FieldBaseSchemaPartial,
  kind: z.literal('string_list'),
  minItems: z.number().int().nonnegative().optional(),
  maxItems: z.number().int().nonnegative().optional(),
  itemMinLength: z.number().int().nonnegative().optional(),
  itemMaxLength: z.number().int().nonnegative().optional(),
  uniqueItems: z.boolean().optional(),
});

export const CheckboxesFieldSchema = z.object({
  ...FieldBaseSchemaPartial,
  kind: z.literal('checkboxes'),
  checkboxMode: CheckboxModeSchema, // explicit: parser defaults to 'multi'
  minDone: z.number().int().optional(),
  options: z.array(OptionSchema),
  approvalMode: ApprovalModeSchema, // explicit: parser defaults to 'none'
});

export const SingleSelectFieldSchema = z.object({
  ...FieldBaseSchemaPartial,
  kind: z.literal('single_select'),
  options: z.array(OptionSchema),
});

export const MultiSelectFieldSchema = z.object({
  ...FieldBaseSchemaPartial,
  kind: z.literal('multi_select'),
  options: z.array(OptionSchema),
  minSelections: z.number().int().nonnegative().optional(),
  maxSelections: z.number().int().nonnegative().optional(),
});

export const UrlFieldSchema = z.object({
  ...FieldBaseSchemaPartial,
  kind: z.literal('url'),
});

export const UrlListFieldSchema = z.object({
  ...FieldBaseSchemaPartial,
  kind: z.literal('url_list'),
  minItems: z.number().int().nonnegative().optional(),
  maxItems: z.number().int().nonnegative().optional(),
  uniqueItems: z.boolean().optional(),
});

export const DateFieldSchema = z.object({
  ...FieldBaseSchemaPartial,
  kind: z.literal('date'),
  min: z.string().optional(), // ISO 8601 date string (YYYY-MM-DD)
  max: z.string().optional(), // ISO 8601 date string (YYYY-MM-DD)
});

export const YearFieldSchema = z.object({
  ...FieldBaseSchemaPartial,
  kind: z.literal('year'),
  min: z.number().int().optional(), // minimum year
  max: z.number().int().optional(), // maximum year
});

/** Table field schema (extends FieldBase pattern) */
export const TableFieldSchema = z.object({
  ...FieldBaseSchemaPartial,
  kind: z.literal('table'),
  columns: z.array(TableColumnSchema),
  minRows: z.number().int().nonnegative().optional(),
  maxRows: z.number().int().positive().optional(),
});

export const FieldSchema = z.discriminatedUnion('kind', [
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
  TableFieldSchema,
]);

// Field group schema (no 'kind' property - reserved for Field/FieldValue types)
export const FieldGroupSchema = z.object({
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
  kind: z.literal('string'),
  value: z.string().nullable(),
});

export const NumberValueSchema = z.object({
  kind: z.literal('number'),
  value: z.number().nullable(),
});

export const StringListValueSchema = z.object({
  kind: z.literal('string_list'),
  items: z.array(z.string()),
});

export const CheckboxesValueSchema = z.object({
  kind: z.literal('checkboxes'),
  values: z.record(OptionIdSchema, CheckboxValueSchema),
});

export const SingleSelectValueSchema = z.object({
  kind: z.literal('single_select'),
  selected: OptionIdSchema.nullable(),
});

export const MultiSelectValueSchema = z.object({
  kind: z.literal('multi_select'),
  selected: z.array(OptionIdSchema),
});

export const UrlValueSchema = z.object({
  kind: z.literal('url'),
  value: z.string().nullable(),
});

export const UrlListValueSchema = z.object({
  kind: z.literal('url_list'),
  items: z.array(z.string()),
});

export const DateValueSchema = z.object({
  kind: z.literal('date'),
  value: z.string().nullable(), // ISO 8601 date string (YYYY-MM-DD) or null
});

export const YearValueSchema = z.object({
  kind: z.literal('year'),
  value: z.number().int().nullable(), // integer year or null
});

export const FieldValueSchema = z.discriminatedUnion('kind', [
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
]);

// FieldResponse schema (markform-255)
export const FieldResponseSchema = z.object({
  state: AnswerStateSchema,
  value: FieldValueSchema.optional(),
  reason: z.string().optional(),
});

// Note schema (markform-205)
export const NoteSchema = z.object({
  id: NoteIdSchema,
  ref: IdSchema,
  role: z.string(),
  text: z.string(),
});

// Documentation block schema
export const DocumentationTagSchema = z.enum(['description', 'instructions', 'documentation']);

export const DocumentationBlockSchema = z.object({
  tag: DocumentationTagSchema,
  ref: z.string(),
  bodyMarkdown: z.string(),
});

// Frontmatter harness config schema
export const FrontmatterHarnessConfigSchema = z.object({
  maxTurns: z.number().int().positive().optional(),
  maxPatchesPerTurn: z.number().int().positive().optional(),
  maxIssuesPerTurn: z.number().int().positive().optional(),
});

// Run mode schema
export const RunModeSchema = z.enum(['interactive', 'fill', 'research']);

// Form metadata schema
export const FormMetadataSchema = z.object({
  markformVersion: z.string(),
  roles: z.array(z.string()).min(1),
  roleInstructions: z.record(z.string(), z.string()),
  harnessConfig: FrontmatterHarnessConfigSchema.optional(),
  runMode: RunModeSchema.optional(),
});

// Validation schemas
export const SeveritySchema = z.enum(['error', 'warning', 'info']);

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
  source: z.enum(['builtin', 'code', 'llm']),
});

// Error location schema (markform-210)
export const ErrorLocationSchema = z.object({
  line: z.number().int().positive().optional(),
  column: z.number().int().positive().optional(),
  fieldId: IdSchema.optional(),
  noteId: NoteIdSchema.optional(),
});

// Error type schemas (markform-210)
export const ParseErrorSchema = z.object({
  type: z.literal('parse'),
  message: z.string(),
  location: ErrorLocationSchema.optional(),
});

export const MarkformValidationErrorSchema = z.object({
  type: z.literal('validation'),
  message: z.string(),
  location: ErrorLocationSchema.optional(),
});

export const MarkformErrorSchema = z.discriminatedUnion('type', [
  ParseErrorSchema,
  MarkformValidationErrorSchema,
]);

// Inspect issue schema
export const IssueReasonSchema = z.enum([
  'validation_error',
  'required_missing',
  'checkbox_incomplete',
  'min_items_not_met',
  'optional_unanswered',
]);

export const IssueScopeSchema = z.enum(['form', 'group', 'field', 'option', 'column', 'cell']);

export const InspectIssueSchema = z.object({
  ref: z.union([IdSchema, z.string()]), // Id or QualifiedOptionRef
  scope: IssueScopeSchema,
  reason: IssueReasonSchema,
  message: z.string(),
  severity: z.enum(['required', 'recommended']),
  priority: z.number().int().positive(),
  blockedBy: IdSchema.optional(),
});

// Summary schemas
export const ProgressStateSchema = z.enum(['empty', 'incomplete', 'invalid', 'complete']);

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
  answerState: AnswerStateSchema,
  hasNotes: z.boolean(),
  noteCount: z.number().int().nonnegative(),
  empty: z.boolean(),
  valid: z.boolean(),
  issueCount: z.number().int().nonnegative(),
  checkboxProgress: CheckboxProgressCountsSchema.optional(),
});

export const ProgressCountsSchema = z.object({
  totalFields: z.number().int().nonnegative(),
  requiredFields: z.number().int().nonnegative(),
  // Dimension 1: AnswerState (mutually exclusive, sum to totalFields)
  unansweredFields: z.number().int().nonnegative(),
  answeredFields: z.number().int().nonnegative(),
  skippedFields: z.number().int().nonnegative(),
  abortedFields: z.number().int().nonnegative(),
  // Dimension 2: Validity (mutually exclusive, sum to totalFields)
  validFields: z.number().int().nonnegative(),
  invalidFields: z.number().int().nonnegative(),
  // Dimension 3: Value presence (mutually exclusive, sum to totalFields)
  emptyFields: z.number().int().nonnegative(),
  filledFields: z.number().int().nonnegative(),
  // Derived counts
  emptyRequiredFields: z.number().int().nonnegative(),
  totalNotes: z.number().int().nonnegative(),
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
  groupsById: z.record(IdSchema, z.literal('field_group')),
  fieldsById: z.record(IdSchema, FieldKindSchema),
  optionsById: z.record(
    z.string(),
    z.object({
      parentFieldId: IdSchema,
      parentFieldKind: FieldKindSchema,
    }),
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

// Patch rejection schema
export const PatchRejectionSchema = z.object({
  patchIndex: z.number().int().nonnegative(),
  message: z.string(),
  fieldId: z.string().optional(),
  fieldKind: z.string().optional(),
  columnIds: z.array(z.string()).optional(),
});

// Patch warning schemas
export const PatchCoercionTypeSchema = z.enum([
  'string_to_list',
  'url_to_list',
  'option_to_array',
  'boolean_to_checkbox',
  'array_to_checkboxes',
]);

export const PatchWarningSchema = z.object({
  patchIndex: z.number().int().nonnegative(),
  fieldId: z.string(),
  message: z.string(),
  coercion: PatchCoercionTypeSchema,
});

export const ApplyStatusSchema = z.enum(['applied', 'partial', 'rejected']);

export const ApplyResultSchema = z.object({
  applyStatus: ApplyStatusSchema,
  structureSummary: StructureSummarySchema,
  progressSummary: ProgressSummarySchema,
  issues: z.array(InspectIssueSchema),
  isComplete: z.boolean(),
  formState: ProgressStateSchema,
  appliedPatches: z.array(z.lazy(() => PatchSchema)),
  rejectedPatches: z.array(PatchRejectionSchema),
  warnings: z.array(PatchWarningSchema),
});

// Patch schemas
export const SetStringPatchSchema = z.object({
  op: z.literal('set_string'),
  fieldId: IdSchema,
  value: z.string().nullable(),
});

export const SetNumberPatchSchema = z.object({
  op: z.literal('set_number'),
  fieldId: IdSchema,
  value: z.number().nullable(),
});

export const SetStringListPatchSchema = z.object({
  op: z.literal('set_string_list'),
  fieldId: IdSchema,
  value: z.array(z.string()),
});

export const SetCheckboxesPatchSchema = z.object({
  op: z.literal('set_checkboxes'),
  fieldId: IdSchema,
  value: z.record(OptionIdSchema, CheckboxValueSchema),
});

export const SetSingleSelectPatchSchema = z.object({
  op: z.literal('set_single_select'),
  fieldId: IdSchema,
  value: OptionIdSchema.nullable(),
});

export const SetMultiSelectPatchSchema = z.object({
  op: z.literal('set_multi_select'),
  fieldId: IdSchema,
  value: z.array(OptionIdSchema),
});

export const SetUrlPatchSchema = z.object({
  op: z.literal('set_url'),
  fieldId: IdSchema,
  value: z.string().nullable(),
});

export const SetUrlListPatchSchema = z.object({
  op: z.literal('set_url_list'),
  fieldId: IdSchema,
  value: z.array(z.string()),
});

export const SetDatePatchSchema = z.object({
  op: z.literal('set_date'),
  fieldId: IdSchema,
  value: z.string().nullable(), // ISO 8601 date string (YYYY-MM-DD) or null
});

export const SetYearPatchSchema = z.object({
  op: z.literal('set_year'),
  fieldId: IdSchema,
  value: z.number().int().nullable(), // integer year or null
});

/** Set table patch schema */
export const SetTablePatchSchema = z.object({
  op: z.literal('set_table'),
  fieldId: IdSchema,
  value: z.array(TableRowPatchSchema),
});

export const ClearFieldPatchSchema = z.object({
  op: z.literal('clear_field'),
  fieldId: IdSchema,
});

export const SkipFieldPatchSchema = z.object({
  op: z.literal('skip_field'),
  fieldId: IdSchema,
  role: z.string(),
  reason: z.string().optional(),
});

export const AbortFieldPatchSchema = z.object({
  op: z.literal('abort_field'),
  fieldId: IdSchema,
  role: z.string(),
  reason: z.string().optional(),
});

export const AddNotePatchSchema = z.object({
  op: z.literal('add_note'),
  ref: IdSchema,
  role: z.string(),
  text: z.string(),
});

export const RemoveNotePatchSchema = z.object({
  op: z.literal('remove_note'),
  noteId: NoteIdSchema,
});

export const PatchSchema = z.discriminatedUnion('op', [
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
  SetTablePatchSchema,
  ClearFieldPatchSchema,
  SkipFieldPatchSchema,
  AbortFieldPatchSchema,
  AddNotePatchSchema,
  RemoveNotePatchSchema,
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
  maxIssuesPerTurn: z.number().int().positive(),
  maxPatchesPerTurn: z.number().int().positive(),
  maxTurns: z.number().int().positive(),
  maxFieldsPerTurn: z.number().int().positive().optional(),
  maxGroupsPerTurn: z.number().int().positive().optional(),
  targetRoles: z.array(z.string()).optional(),
  fillMode: FillModeSchema.optional(),
});

export const SessionTurnStatsSchema = z.object({
  inputTokens: z.number().int().nonnegative().optional(),
  outputTokens: z.number().int().nonnegative().optional(),
  toolCalls: z
    .array(
      z.object({
        name: z.string(),
        count: z.number().int().positive(),
      }),
    )
    .optional(),
});

export const SessionTurnContextSchema = z.object({
  systemPrompt: z.string(),
  contextPrompt: z.string(),
});

// Wire format Zod schemas for session logging
export const WireToolCallSchema = z.object({
  toolName: z.string(),
  input: z.unknown(),
});

export const WireToolResultSchema = z.object({
  toolName: z.string(),
  result: z.unknown(),
});

export const WireResponseStepSchema = z.object({
  toolCalls: z.array(WireToolCallSchema),
  toolResults: z.array(WireToolResultSchema),
  text: z.string().nullable(),
});

export const WireRequestFormatSchema = z.object({
  system: z.string(),
  prompt: z.string(),
  tools: z.record(
    z.string(),
    z.object({
      description: z.string(),
      inputSchema: z.unknown(),
    }),
  ),
});

export const WireResponseFormatSchema = z.object({
  steps: z.array(WireResponseStepSchema),
  usage: z.object({
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
  }),
});

export const WireFormatSchema = z.object({
  request: WireRequestFormatSchema,
  response: WireResponseFormatSchema,
});

export const SessionTurnSchema = z.object({
  turn: z.number().int().positive(),
  inspect: z.object({
    issues: z.array(InspectIssueSchema),
  }),
  context: SessionTurnContextSchema.optional(),
  apply: z.object({
    patches: z.array(PatchSchema),
    rejectedPatches: z.array(PatchRejectionSchema).optional(),
    warnings: z.array(PatchWarningSchema).optional(),
  }),
  after: z.object({
    requiredIssueCount: z.number().int().nonnegative(),
    markdownSha256: z.string(),
    answeredFieldCount: z.number().int().nonnegative(),
    skippedFieldCount: z.number().int().nonnegative(),
  }),
  llm: SessionTurnStatsSchema.optional(),
  wire: WireFormatSchema.optional(),
});

export const SessionFinalSchema = z.object({
  expectComplete: z.boolean(),
  expectedCompletedForm: z.string(),
});

export const SessionTranscriptSchema = z.object({
  sessionVersion: z.string(),
  mode: MockModeSchema,
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
  live: z
    .object({
      modelId: z.string(),
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
