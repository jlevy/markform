# Plan Spec: Role System for Multi-Stage Form Workflows

## Purpose

This plan adds a role-based field assignment system to Markform, enabling multi-stage
form workflows where different roles (user, agent, reviewer, etc.)
fill different fields.

**Related Docs:**

- [Architecture Design](../../architecture/current/arch-markform-design.md.md)

- [Fill Command Spec](valid-2025-12-23-fill-command-live-agent.md)

- [Examples CLI Command](plan-2025-12-23-examples-cli-command.md) - Example forms to
  update

## Background

Many form workflows require multiple parties to contribute:

1. **Simple case:** Fill all fields at once (single role)

2. **Two-stage:** User provides context (company name), agent completes analysis

3. **Complex workflow:** User -> agent -> user review -> agent -> reviewer signoff

Currently, Markform treats all fields uniformly.
The `fill` command fills all empty fields regardless of who should provide the data.
This makes multi-stage workflows awkward to implement.

### Use Cases

- **Political Figure Form:** User enters the person’s name, agent researches and fills
  biographical details

- **Company Quarterly Report:** User enters company identifier and fiscal period, agent
  completes financial analysis

- **Compliance Review:** User fills form, agent validates, reviewer gives final signoff

## Summary of Task

1. Add form-level `roles` list in frontmatter (default: `["user", "agent"]`)

2. Add per-role `role_instructions` in frontmatter

3. Add `role` attribute to fields (default: `"agent"`)

4. Add `FillMode` type: `"continue"` (skip filled) or `"overwrite"` (re-fill all)

5. Add `approvalMode` attribute for checkpoint/gate checkboxes

6. Update CLI commands to support `--roles` and `--mode` flags

7. Update example forms to use roles appropriately

## Backward Compatibility

**BACKWARD COMPATIBILITY REQUIREMENTS:**

- **Code types, methods, and function signatures**: DO NOT MAINTAIN - new feature, no
  existing code to preserve

- **Library APIs**: DO NOT MAINTAIN - additive changes only, no breaking changes

- **Server APIs**: N/A

- **File formats**: SUPPORT BOTH - forms without `roles` in frontmatter use defaults;
  forms without `role` on fields default to `"agent"`

- **Database schemas**: N/A

All changes are additive:

- Forms without `roles` in frontmatter default to `["user", "agent"]`

- Fields without `role` attribute default to `"agent"`

- Existing `fill` command behavior unchanged (fills agent role by default)

- No breaking changes to existing forms or CLI usage

* * *

## Stage 1: Planning Stage

### Feature Requirements

**Must Have:**

- Form-level `roles` list in frontmatter

- Per-role `role_instructions` in frontmatter

- Field-level `role` attribute (string, defaults to `"agent"`)

- `FillMode` type: `"continue"` | `"overwrite"`

- `approvalMode` attribute on checkboxes: `"none"` (default) | `"blocking"`

- `--roles` flag on `fill` command (comma-separated, or `*` for all)

- `--mode` flag on `fill` command

- `--interactive` defaults to `user` role

- Constants in `settings.ts`: `USER_ROLE`, `AGENT_ROLE`, `DEFAULT_ROLES`

- `inspect` shows blocked field annotations ("Blocked by: fieldId")

- `--roles` flag on `inspect` command (filters issues by role)

- `--dry-run` flag on `fill` command (show what would be filled/blocked)

**Nice to Have:**

- Role completion tracking in `form_progress`

- `--explain` flag to print why each field is (not) selected

- `markform inspect --list-roles` to see available roles in form

**Out of Scope (Future):**

- Array roles per field (e.g., `role=["user", "agent"]` for either)

- Role-based validation (different validators per role)

- Role-based permissions (access control)

- `approvalMode` on field groups (for group-level approvals with notes)

- Signature fields (for formal sign-off workflows)

### CLI Interface

```bash
# Default: fill agent role fields, mode=continue
markform fill form.md

# Interactive: fill user role fields, mode=continue
markform fill form.md --interactive

# Explicit role selection
markform fill form.md --roles=user
markform fill form.md --roles=agent
markform fill form.md --roles=reviewer

# Multiple roles (comma-separated)
markform fill form.md --roles=user,agent

# All roles (shows warning in non-interactive mode)
markform fill form.md --roles=*

# Overwrite mode (re-fill from scratch)
markform fill form.md --roles=agent --mode=overwrite

# Combine interactive with custom role
markform fill form.md --interactive --roles=reviewer

# Dry run: show what would be filled without making changes
markform fill form.md --dry-run
```

### CLI Safety Rules

**User-role protection in non-interactive mode:**

- By default, non-interactive `fill` only targets `agent` role fields

- To fill `user` role fields non-interactively, must explicitly specify `--roles=user`
  or `--roles=*`

- `--roles=*` in non-interactive mode shows a warning: “Warning: Filling all roles
  including user-designated fields”

**Interactive mode defaults:**

- `--interactive` defaults to `user` role (can be overridden with `--roles`)

- Error if `--interactive` combined with roles that require non-interactive input
  (future consideration)

**Overwrite safety:**

- `--mode=overwrite` only clears fields whose `role` is in the target roles set

- Overwrite never clears fields outside the target role set (prevents accidental data
  loss)

- If a blocking checkpoint’s role is not in target roles, overwrite will not clear it
  (preserves approval gates)

- Use `--force-overwrite-blocking` to explicitly allow clearing blocking checkpoints
  (dangerous, shows warning)

### Property Naming Conventions

**YAML frontmatter** uses `snake_case` for property names (standard YAML convention).

**TypeScript interfaces** use `camelCase` for property names (standard TS convention).

**Markdoc attributes** use `camelCase` (Markdoc convention).

The parser transforms YAML → TypeScript automatically:

| YAML (frontmatter) | TypeScript |
| --- | --- |
| `spec` | `specVersion` |
| `role_instructions` | `roleInstructions` |

The serializer transforms TypeScript → YAML when writing forms.

Zod schemas include transforms to normalize property names during parsing.

### Frontmatter Schema

```yaml
---
markform:
  spec: MF/0.1
  roles:
    - user
    - agent
    - reviewer  # optional custom role
  role_instructions:
    user: "Enter the company name and ticker symbol you want analyzed."
    agent: "Research financials and complete the analysis fields."
    reviewer: "Review the completed form and check the approval box."
---
```

### Role Validation Rules

**Normalization:**

- Roles are normalized on parse: trimmed, lowercased

- Role names must match pattern `[a-z][a-z0-9_-]*` (start with letter, alphanumeric with
  underscores/hyphens)

- Invalid role names produce a parse error

**Reserved identifiers:**

- `*` is reserved for CLI role selection wildcard; rejected as a role name in forms

- Empty string is not a valid role name

**Zod schema refinements:**

- `roles` array must have at least one element

- `roles` array must contain unique values

- `roleInstructions` keys should be subset of `roles` (warning for extra keys)

- Missing `roleInstructions` for a role uses `DEFAULT_ROLE_INSTRUCTIONS` fallback

**Field role validation:**

- Warn if field has `role` not in form’s `roles` list

- Suggest closest known role in `inspect` output

### Field Syntax

```md
{% string-field id="company_name" label="Company" role="user" required=true %}{% /string-field %}
{% string-field id="ticker" label="Ticker" role="user" required=true %}{% /string-field %}
{% string-field id="analysis" label="Analysis" required=true %}{% /string-field %}

<!-- role="agent" is implicit (default) -->
```

### Approval Gates (approvalMode)

The `approvalMode` attribute creates checkpoints that block subsequent fields from being
filled until the checkpoint is complete.
This enables multi-stage approval workflows.

**Attribute:** `approvalMode` (camelCase per Markdoc attribute convention)

- `"none"` (default) - No blocking behavior

- `"blocking"` - Fields after this checkpoint cannot be filled until checkbox is
  complete

**Rules:**

- Only valid on `checkboxes` fields (parse error on other field types)

- Only meaningful when `required=true` (warning if not required)

- “Blocking” means fields *later in document order* cannot be filled

- Checkbox must reach completion state (per its `checkboxMode`) to unblock

**Example: Three-stage approval workflow**

```md
{% form id="compliance_review" title="Compliance Review" %}

{% field-group id="user_input" title="User Input" %}
{% string-field id="company_name" label="Company" role="user" required=true %}{% /string-field %}
{% /field-group %}

{% field-group id="agent_analysis" title="Agent Analysis" %}
{% string-field id="risk_assessment" label="Risk Assessment" required=true %}{% /string-field %}
{% string-field id="recommendations" label="Recommendations" required=true %}{% /string-field %}
{% /field-group %}

{% field-group id="user_review" title="User Review" %}
{% checkboxes id="user_approval" label="User Approval" role="user" required=true approvalMode="blocking" %}
- [ ] I have reviewed the agent's analysis {% #reviewed %}
- [ ] The risk assessment is accurate {% #accurate %}
{% /checkboxes %}
{% /field-group %}

{% field-group id="final_section" title="Final Recommendations" %}
{% string-field id="final_notes" label="Final Notes" %}{% /string-field %}
{% /field-group %}

{% field-group id="reviewer_signoff" title="Reviewer Sign-off" %}
{% checkboxes id="reviewer_approval" label="Reviewer Approval" role="reviewer" required=true approvalMode="blocking" %}
- [ ] Approved for release {% #approved %}
{% /checkboxes %}
{% /field-group %}

{% /form %}
```

**Workflow:**

1. User fills `company_name` (role="user")

2. Agent fills `risk_assessment`, `recommendations` (role="agent")

3. **BLOCKED:** `final_notes` cannot be filled until `user_approval` is complete

4. User completes `user_approval` checkbox (role="user", approvalMode="blocking")

5. Agent fills `final_notes` (role="agent")

6. **BLOCKED:** Form cannot complete until `reviewer_approval` is complete

7. Reviewer completes `reviewer_approval` (role="reviewer", approvalMode="blocking")

8. Form is complete

### Checkbox Completion Semantics

A checkbox field is “complete” based on its `checkboxMode` and `minDone` settings:

| checkboxMode | Completion Criteria |
| --- | --- |
| `all` | All options are checked |
| `any` | At least one option is checked (or `minDone` if specified) |
| `explicit` | All options are answered (no `[_]` unfilled markers remain) |

**minDone override:** If `minDone` is specified, completion requires `checkedCount >=
minDone` regardless of mode.

**Blocking behavior:** A blocking checkpoint (`approvalMode="blocking"`) uses these
completion semantics to determine when fields after it become unblocked.

**Important:** The blocking checkpoint field itself IS included in the fillable set (so
it can be completed), but fields *after* it in document order are blocked until it
reaches completion.

### Field Clearing Semantics (Overwrite Mode)

When `--mode=overwrite` is used, fields are cleared before re-filling.
Clear behavior per field type:

| Field Type | Clear Value |
| --- | --- |
| `string-field` | Empty string `""` |
| `number-field` | `null` (undefined/missing) |
| `checkboxes` | All options unchecked |
| `single-select` | No selection (`selected: null`) |
| `array` / repeater | Empty array `[]` |
| `richtext` | Empty string `""` |

**Safety:** Overwrite only clears fields whose `role` is in the target roles set.

### Multi-Form Scoping

When a file contains multiple `{% form %}` tags:

- Each form has its own `roles` list and `role_instructions`

- Blocking checkpoints only affect fields within the same form

- No cross-form blocking behavior

- Role filtering applies per-form during fill

### Role Instructions in Agent Prompts

When passing instructions to the agent, the system composes a prompt from multiple
sources. This is implemented in `buildContextPrompt()` in `harness/liveAgent.ts`.

**Composition Order (later augments earlier):**

1. **System defaults** - `DEFAULT_SYSTEM_PROMPT` from `liveAgent.ts` (always present)

2. **Role defaults** - `DEFAULT_ROLE_INSTRUCTIONS[targetRole]` from `settings.ts`

3. **Form-level instructions** - Doc blocks with `kind="instructions"` and `ref`
   matching the form ID

4. **Role-specific instructions** - `role_instructions[targetRole]` from frontmatter

5. **Per-field instructions** - Doc blocks with `kind="instructions"` and `ref` matching
   fields being filled (concatenated in field order)

**CLI Override:**

The `--prompt <file>` flag (markform-146) **completely replaces** the composed
instructions with the file contents.
This allows full customization for specialized use cases.

**Implementation in `buildContextPrompt()`:**

```typescript
function buildContextPrompt(
  issues: InspectIssue[],
  form: ParsedForm,
  maxPatches: number,
  targetRole?: string,
  cliPromptOverride?: string
): string {
  // If CLI override provided, use it exclusively
  if (cliPromptOverride) {
    return formatWithIssues(cliPromptOverride, issues, form);
  }

  // Compose from sources
  const parts: string[] = [];

  // 1. Role defaults (if targetRole specified)
  if (targetRole && DEFAULT_ROLE_INSTRUCTIONS[targetRole]) {
    parts.push(DEFAULT_ROLE_INSTRUCTIONS[targetRole]);
  }

  // 2. Form-level instructions doc blocks
  const formInstructions = form.docs.filter(
    d => d.ref === form.schema.id && d.kind === 'instructions'
  );
  parts.push(...formInstructions.map(d => d.bodyMarkdown));

  // 3. Role-specific instructions from frontmatter
  if (targetRole && form.metadata?.roleInstructions?.[targetRole]) {
    parts.push(form.metadata.roleInstructions[targetRole]);
  }

  // 4. Per-field instructions for fields being filled
  const fieldIds = issues.filter(i => i.scope === 'field').map(i => i.ref);
  for (const fieldId of fieldIds) {
    const fieldInstructions = form.docs.filter(
      d => d.ref === fieldId && d.kind === 'instructions'
    );
    parts.push(...fieldInstructions.map(d => d.bodyMarkdown));
  }

  return formatWithIssues(parts.join('\n\n'), issues, form);
}
```

**Tracked in:** markform-147 (Connect form instructions to live agent prompt
composition)

### AI SDK Tool Integration

The AI SDK tools should support role-aware filling:

- `markform_inspect` returns `targetRoles` and blocked field information

- `markform_apply` accepts optional `targetRoles` parameter to filter patches

- Tools respect blocking checkpoints when determining fillable fields

### Acceptance Criteria

1. Fields without `role` default to `"agent"`

2. `fill` command filters fields by target role(s)

3. `--interactive` mode defaults to `user` role

4. `--roles=*` fills all fields regardless of role (with warning in non-interactive)

5. `--mode=continue` (default) skips fields with existing values

6. `--mode=overwrite` clears and re-fills target role fields only

7. `approvalMode="blocking"` prevents filling fields after incomplete checkpoint

8. `approvalMode` on non-checkbox field produces parse error

9. Example forms updated to use `role="user"` for context fields

10. `role_instructions` are passed to the agent during fill

11. Overwrite never clears fields outside target role set

12. The first incomplete blocking checkpoint itself is fillable (included in unblocked
    set)

13. `inspect` shows “Blocked by: fieldId” annotations on blocked fields

14. Role names are normalized (lowercase, validated pattern)

* * *

## Stage 2: Architecture Stage

### Constants (settings.ts)

```typescript
// packages/markform/src/settings.ts

/** Default role for fields without explicit role attribute */
export const AGENT_ROLE = 'agent' as const;

/** Role for human-filled fields in interactive mode */
export const USER_ROLE = 'user' as const;

/** Default roles list for forms without explicit roles */
export const DEFAULT_ROLES: readonly [typeof USER_ROLE, typeof AGENT_ROLE] = [
  USER_ROLE,
  AGENT_ROLE,
] as const;

/** Default instructions per role (used when form doesn't specify) */
export const DEFAULT_ROLE_INSTRUCTIONS: Record<string, string> = {
  [USER_ROLE]: 'Fill in the fields you have direct knowledge of.',
  [AGENT_ROLE]: 'Complete the remaining fields based on the provided context.',
};

/** Pattern for valid role names */
export const ROLE_NAME_PATTERN = /^[a-z][a-z0-9_-]*$/;

/** Reserved role identifiers (not allowed as role names) */
export const RESERVED_ROLE_NAMES = ['*'] as const;
```

### Helper Functions

```typescript
/**
 * Normalize a role name: trim whitespace, lowercase.
 * Throws if invalid pattern or reserved name.
 */
export function normalizeRole(role: string): string {
  const normalized = role.trim().toLowerCase();
  if (!ROLE_NAME_PATTERN.test(normalized)) {
    throw new Error(`Invalid role name: "${role}" (must match ${ROLE_NAME_PATTERN})`);
  }
  if (RESERVED_ROLE_NAMES.includes(normalized as typeof RESERVED_ROLE_NAMES[number])) {
    throw new Error(`Reserved role name: "${role}"`);
  }
  return normalized;
}

/**
 * Parse --roles CLI flag value into normalized role array.
 * Handles comma-separated values and '*' wildcard.
 */
export function parseRolesFlag(raw: string): string[] {
  if (raw === '*') {
    return ['*'];
  }
  return raw.split(',').map(r => normalizeRole(r));
}
```

### Type Definitions

```typescript
/**
 * Controls how fill handles existing values for target role fields.
 * - 'continue': Skip fields that already have values (default)
 * - 'overwrite': Clear and re-fill all fields for the target role
 */
type FillMode = 'continue' | 'overwrite';

/**
 * Controls whether a checkbox field acts as a blocking checkpoint.
 * - 'none': No blocking behavior (default)
 * - 'blocking': Fields after this cannot be filled until checkbox is complete
 */
type ApprovalMode = 'none' | 'blocking';

/**
 * Form-level metadata including role configuration.
 */
interface FormMetadata {
  markformVersion: string;
  roles: string[];                              // e.g., ["user", "agent"]
  roleInstructions: Record<string, string>;     // per-role instructions
}

/**
 * Extended FieldBase with role attribute.
 */
interface FieldBase {
  id: Id;
  label: string;
  required: boolean;
  priority: FieldPriorityLevel;
  role: string;                                 // defaults to AGENT_ROLE
  validate?: ValidatorRef[];
}

/**
 * Extended CheckboxesField with approvalMode attribute.
 */
interface CheckboxesField extends FieldBase {
  kind: 'checkboxes';
  checkboxMode: CheckboxMode;
  minDone?: number;
  options: Option[];
  approvalMode: ApprovalMode;                   // defaults to 'none'
}

/** Warning/error codes for role system validation */
enum RoleValidationCode {
  MF_ROLE_UNKNOWN = 'MF_ROLE_UNKNOWN',           // Field role not in form's roles list
  MF_ROLE_INVALID = 'MF_ROLE_INVALID',           // Role name doesn't match pattern
  MF_ROLE_RESERVED = 'MF_ROLE_RESERVED',         // Role name is reserved (e.g., '*')
  MF_BLOCKING_NONREQUIRED = 'MF_BLOCKING_NONREQUIRED', // approvalMode=blocking but required=false
  MF_APPROVAL_WRONG_TYPE = 'MF_APPROVAL_WRONG_TYPE',   // approvalMode on non-checkbox field
}
```

### Field Filtering Logic

```typescript
function getFieldsForRole(form: ParsedForm, targetRoles: string[]): Field[] {
  const allFields = getAllFields(form.schema);

  if (targetRoles.includes('*')) {
    return allFields;
  }

  return allFields.filter(field => targetRoles.includes(field.role));
}

/**
 * Find the first incomplete blocking checkpoint in document order.
 * Returns the index in orderIndex, or -1 if no blocking checkpoint.
 */
function findBlockingCheckpoint(form: ParsedForm): number {
  for (let i = 0; i < form.orderIndex.length; i++) {
    const fieldId = form.orderIndex[i];
    const field = getFieldById(form, fieldId);

    if (
      field.kind === 'checkboxes' &&
      field.approvalMode === 'blocking' &&
      !isCheckboxComplete(form, fieldId)
    ) {
      return i;
    }
  }
  return -1; // No blocking checkpoint
}

/**
 * Get fields that can be filled, respecting blocking checkpoints.
 */
function getFieldsToFill(
  form: ParsedForm,
  targetRoles: string[],
  mode: FillMode
): Field[] {
  const roleFields = getFieldsForRole(form, targetRoles);

  // Find first incomplete blocking checkpoint
  const blockingIndex = findBlockingCheckpoint(form);

  // Filter by blocking checkpoint (fields after checkpoint are blocked)
  const unblockedFields = blockingIndex === -1
    ? roleFields
    : roleFields.filter(field => {
        const fieldIndex = form.orderIndex.indexOf(field.id);
        return fieldIndex <= blockingIndex; // Allow up to and including the checkpoint
      });

  if (mode === 'overwrite') {
    return unblockedFields;
  }

  // mode === 'continue': skip filled fields
  return unblockedFields.filter(field => !isFieldFilled(form, field.id));
}
```

### Parsing Changes

- `parseForm()` extracts `roles` and `role_instructions` from frontmatter

- Field parser reads `role` attribute, defaults to `AGENT_ROLE`

- Validation: warn if field has role not in form’s `roles` list

### CLI Changes

- `fill` command gains `--roles` and `--mode` options

- `--interactive` sets default role to `USER_ROLE` (can be overridden)

- Role instructions passed to agent in fill prompt

* * *

## Stage 3: Implementation Stage

### Phase 1: Core Types and Settings

**Goal:** Add type definitions and constants.

- [ ] Add `FillMode` type to types file

- [ ] Add `ApprovalMode` type to types file

- [ ] Add role-related fields to `FormMetadata` interface

- [ ] Add `role` field to `FieldBase` interface

- [ ] Add `approvalMode` field to `CheckboxesField` interface

- [ ] Create `settings.ts` with `USER_ROLE`, `AGENT_ROLE`, `DEFAULT_ROLES`,
  `DEFAULT_ROLE_INSTRUCTIONS`

- [ ] Add Zod schemas for role configuration and approval mode

### Phase 2: Parser Updates

**Goal:** Parse roles from frontmatter and fields.

- [ ] Update frontmatter parser to extract `roles` and `role_instructions`

- [ ] Apply defaults when `roles` not specified

- [ ] Update field parser to extract `role` attribute

- [ ] Apply `AGENT_ROLE` default when `role` not specified

- [ ] Update checkboxes parser to extract `approvalMode` attribute

- [ ] Apply `"none"` default when `approvalMode` not specified

- [ ] Add parse error if `approvalMode` used on non-checkbox field

- [ ] Add validation warning for roles not in form’s roles list

- [ ] Add validation warning if `approvalMode="blocking"` but `required=false`

- [ ] Update serializer to output `role` attribute (only when non-default)

- [ ] Update serializer to output `approvalMode` attribute (only when non-default)

### Phase 3: Fill Command Updates

**Goal:** Filter fields by role during fill, respecting blocking checkpoints.

- [ ] Add `--roles` option to fill command (comma-separated or `*`)

- [ ] Add `--mode` option to fill command (`continue` | `overwrite`)

- [ ] Add `--dry-run` option to show what would be filled

- [ ] Add `--force-overwrite-blocking` option for dangerous overwrite

- [ ] Update `--interactive` to default to `USER_ROLE`

- [ ] Implement `getFieldsForRole()` helper

- [ ] Implement `findBlockingCheckpoint()` helper

- [ ] Implement `getFieldsToFill()` helper with blocking logic

- [ ] Implement `clearFieldValue()` helper per field type

- [ ] Implement overwrite safety (only clear target role fields)

- [ ] Pass `role_instructions` to agent prompt (with proper composition order)

- [ ] Update fill logic to use filtered field list

- [ ] Display message when fields are blocked by incomplete checkpoint

- [ ] Display warning when `--roles=*` used in non-interactive mode

### Phase 4: Update Example Forms

**Goal:** Update bundled examples to use roles appropriately.

- [ ] Update `political-figure.form.md`: add `role="user"` to person name field

- [ ] Update `earnings-analysis.form.md`: add `role="user"` to company info fields

- [ ] Update `simple.form.md`: add `role="user"` to a few demo fields

- [ ] Add `roles` and `role_instructions` to frontmatter of each example

- [ ] Test each example with two-stage workflow (user then agent)

### Phase 5: Tests

**Goal:** Unit and integration tests for role system and approval gates.

**Core Role Tests:**

- [ ] Test default role assignment (`AGENT_ROLE`)

- [ ] Test role parsing from field attributes

- [ ] Test `roles` and `role_instructions` parsing from frontmatter

- [ ] Test `getFieldsForRole()` with various role filters

- [ ] Test `getFieldsToFill()` with `continue` and `overwrite` modes

- [ ] Test fill command with `--roles` flag

- [ ] Test fill command with `--interactive` defaults to user role

- [ ] Test role validation warnings

**Approval Gate Tests:**

- [ ] Test `approvalMode` parsing on checkbox fields

- [ ] Test parse error when `approvalMode` used on non-checkbox field

- [ ] Test `findBlockingCheckpoint()` returns correct index

- [ ] Test fields after blocking checkpoint are excluded from fill

- [ ] Test completing checkpoint unblocks subsequent fields

- [ ] Test multiple blocking checkpoints in sequence

- [ ] Test blocking checkpoint itself is included in fillable set

**Checkbox Completion Tests:**

- [ ] Test `checkboxMode='all'` completion (all checked)

- [ ] Test `checkboxMode='any'` completion (at least one checked)

- [ ] Test `checkboxMode='explicit'` completion (no unfilled markers)

- [ ] Test `minDone` override for completion

**Overwrite Safety Tests:**

- [ ] Test overwrite does not clear user-role checkpoints when roles exclude `user`

- [ ] Test overwrite with `roles=*` respects blocking checkpoints

- [ ] Test overwrite does not regress completion state

- [ ] Test `--force-overwrite-blocking` allows clearing blocking checkpoints

**Normalization and Validation Tests:**

- [ ] Test role normalization (case, whitespace trimming)

- [ ] Test reject literal `*` role in frontmatter

- [ ] Test role value constraints: non-empty, unique, lowercase pattern

- [ ] Test warning for unknown role in field vs roles list

**Prompt Composition Tests:**

- [ ] Test correct role_instructions precedence in agent prompt

- [ ] Test base form instructions → role instructions → field instructions order

**Serializer Stability Tests:**

- [ ] Golden snapshot for serialization of role and approvalMode defaults

- [ ] Round-trip preserves non-default values correctly

- [ ] Test role/approvalMode only output when non-default

**Inspect UX Tests:**

- [ ] Test blocked fields list includes “blocked by” annotations

- [ ] Test `--roles` filter works correctly

- [ ] Test shows role scoping in output

* * *

## Stage 4: Validation Stage

### Automated Tests

- [ ] All role-related types have Zod schemas

- [ ] Parser correctly extracts roles from frontmatter

- [ ] Parser correctly extracts role attribute from fields

- [ ] Parser correctly extracts `approvalMode` from checkbox fields

- [ ] Parser rejects `approvalMode` on non-checkbox fields

- [ ] Fill command respects `--roles` flag

- [ ] Fill command respects `--mode` flag

- [ ] Fill command respects blocking checkpoints

- [ ] Example forms parse and validate with role configuration

- [ ] Role normalization works correctly

- [ ] Overwrite safety prevents clearing non-target roles

- [ ] Checkbox completion semantics are correct per mode

### Manual Tests

- [ ] Two-stage workflow: `fill --interactive` then `fill`

- [ ] Verify user role fields are skipped in default fill

- [ ] Verify `--roles=*` fills all fields (with warning)

- [ ] Verify `--mode=overwrite` re-fills existing values (only target roles)

- [ ] Test custom role (e.g., `reviewer`)

- [ ] Test blocking checkpoint prevents filling subsequent fields

- [ ] Test completing checkpoint allows subsequent fill

- [ ] Test `--dry-run` shows correct preview

- [ ] Test `inspect` shows blocked field annotations

### Definition of Done

1. `role` attribute works on all field types

2. `roles` and `role_instructions` work in frontmatter

3. `fill --roles=X` filters correctly

4. `fill --interactive` defaults to user role

5. `approvalMode="blocking"` prevents filling fields after incomplete checkpoint

6. Example forms demonstrate two-stage workflow

7. Overwrite safety prevents accidental data loss

8. Role normalization and validation work correctly

9. `inspect` shows blocked field annotations

10. Tests pass

11. Documentation updated

* * *

## Open Questions

1. **Array roles per field:** Should we support `role=["user", "agent"]` for fields
   fillable by either?

   - **Decision:** Defer to future.
     Single string role is sufficient for v0.1 use cases.

2. **Role validation:** Should we error or warn if field has role not in form’s list?

   - **Decision:** Warn only.
     Allows flexibility while highlighting potential issues.

3. **Role in progress tracking:** Should `form_progress` track per-role completion?

   - **Decision:** Defer to future.
     Current progress tracking is sufficient.

4. **Default when no frontmatter roles:** What if form has no `roles` in frontmatter?

   - **Decision:** Default to `["user", "agent"]`. Most common case.

5. **Blocking checkpoint and the checkpoint field itself:** Should the blocking checkbox
   be fillable, or only fields before it?

   - **Decision:** The blocking checkbox itself IS fillable (included in the unblocked
     set). Only fields *after* the checkpoint are blocked.
     This allows the checkpoint to be completed, which then unblocks subsequent fields.

6. **inspect command with blocking:** Should `inspect` show which fields are blocked?

   - **Decision:** Yes, as a separate section or annotation on blocked field issues.
     This helps users understand why certain fields cannot be filled yet.

* * *

## Notes

### Example Forms to Update

The following example forms need to be updated to demonstrate the role system:

1. **simple.form.md** - Add `role="user"` to 1-2 fields to demonstrate concept

2. **political-figure.form.md** - Add `role="user"` to person name field

3. **earnings-analysis.form.md** - Add `role="user"` to company_name, ticker,
   fiscal_period

Each form should also get frontmatter with `roles` and `role_instructions` to show the
recommended pattern.

### Two-Stage Workflow Example

```bash
# Stage 1: User fills context fields interactively
markform fill earnings-analysis.form.md --interactive -o earnings-analysis-v1.form.md

# Stage 2: Agent completes analysis (default: agent role only)
markform fill earnings-analysis-v1.form.md -o earnings-analysis-filled.form.md

# Preview what would be filled without making changes
markform fill earnings-analysis.form.md --dry-run
```

* * *

## Implementation Status (2025-12-24)

### Completed

- **markform-149.1**: Phase 1 - Added FillMode, ApprovalMode types, role constants to
  settings.ts

- **markform-149.2**: Phase 2 - Parser extracts role from field attributes, approvalMode
  from checkboxes

- **markform-149.3**: Phase 3 - Inspect module filters by targetRoles, detects blocking
  checkpoints

- **markform-149.4**: Phase 4 - Fill command has --roles and --mode flags, harness
  passes targetRoles

- **markform-149.5**: Phase 5 - Serializer outputs role and approvalMode when
  non-default

- **markform-149.6**: Phase 6 - Inspect CLI shows role badges, --roles flag, blockedBy
  annotations

- **markform-149.7**: Phase 7 - Example forms updated with roles frontmatter and
  role="user" fields

### Remaining Work (Future Phases)

- **markform-146**: Add --prompt flag to fill command for custom agent instructions

- **markform-147**: Connect form instructions to live agent prompt composition

### Known Limitations and Future Work

1. **Frontmatter roles parsing not implemented**: The parser does not yet extract
   `roles` and `role_instructions` from YAML frontmatter.
   Fields use roles, but form-level role lists are not parsed.
   Workaround: Pass targetRoles explicitly via --roles flag.

2. **Interactive mode not updated**: The --interactive flag does not yet default to
   USER_ROLE as specified.
   This was deferred as --interactive is not fully implemented.

3. **Overwrite mode not implemented**: The FillMode type and harness config accept
   fillMode, but the actual field clearing logic is not implemented.
   Current behavior is always “continue”.

4. **Role validation warnings not implemented**: Parser does not warn if field role is
   not in form’s roles list.

5. **Role instructions not passed to agent**: The liveAgent does not yet receive
   role_instructions from frontmatter.
   Tracked in markform-147.

6. **approvalMode on non-checkbox field**: Parser does not produce an error if
   approvalMode is used on non-checkbox fields.
   Should be added as validation.

* * *

## Revision History

- 2025-12-23: Expanded “Role Instructions in Agent Prompts” section with detailed
  `buildContextPrompt()` implementation, CLI override behavior, and reference to
  markform-146/147

- 2025-12-23: Major spec review and improvements:

  - Added overwrite mode safety semantics (ROLE-001)

  - Defined checkbox completion semantics for blocking gates (ROLE-002)

  - Documented YAML→TypeScript property naming conventions (ROLE-003)

  - Fixed inconsistent attribute naming (`approval_mode` → `approvalMode`) (ROLE-004)

  - Added CLI safety rules for user-role fields (ROLE-005)

  - Added role normalization and validation rules (ROLE-006)

  - Defined field clearing semantics per field type (ROLE-007)

  - Promoted inspect enhancements to Must Have (ROLE-008)

  - Added role instructions merging and AI SDK integration (ROLE-009)

  - Added multi-form scoping clarification (ROLE-010)

  - Added backward compatibility template per workspace rules (ROLE-011)

  - Added constants typing, helper functions, warning codes (ROLE-012)

  - Added comprehensive test plan items (ROLE-013)

- 2025-12-23: Added `approvalMode` for blocking checkpoint gates

- 2025-12-23: Initial plan created based on design discussion
