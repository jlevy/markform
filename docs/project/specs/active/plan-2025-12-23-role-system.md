# Plan Spec: Role System for Multi-Stage Form Workflows

## Purpose

This plan adds a role-based field assignment system to Markform, enabling multi-stage
form workflows where different roles (user, agent, reviewer, etc.)
fill different fields.

**Related Docs:**

- [Architecture Design](../../architecture/current/arch-markform-initial-design.md)

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

5. Add `approval_mode` attribute for checkpoint/gate checkboxes

6. Update CLI commands to support `--roles` and `--mode` flags

7. Update example forms to use roles appropriately

## Backward Compatibility

**Fully backward compatible.** All changes are additive:

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

**Nice to Have:**

- Role-filtered `inspect` output (show issues only for target roles)

- Role completion tracking in `form_progress`

- `--roles` flag on `inspect` command

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

# All roles
markform fill form.md --roles=*

# Overwrite mode (re-fill from scratch)
markform fill form.md --roles=agent --mode=overwrite

# Combine interactive with custom role
markform fill form.md --interactive --roles=reviewer
```

### Frontmatter Schema

```yaml
---
markform:
  markform_version: "0.1.0"
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

4. User completes `user_approval` checkbox (role="user", approval_mode="blocking")

5. Agent fills `final_notes` (role="agent")

6. **BLOCKED:** Form cannot complete until `reviewer_approval` is complete

7. Reviewer completes `reviewer_approval` (role="reviewer", approval_mode="blocking")

8. Form is complete

### Acceptance Criteria

1. Fields without `role` default to `"agent"`

2. `fill` command filters fields by target role(s)

3. `--interactive` mode defaults to `user` role

4. `--roles=*` fills all fields regardless of role

5. `--mode=continue` (default) skips fields with existing values

6. `--mode=overwrite` clears and re-fills target role fields

7. `approvalMode="blocking"` prevents filling fields after incomplete checkpoint

8. `approvalMode` on non-checkbox field produces parse error

9. Example forms updated to use `role="user"` for context fields

10. `role_instructions` are passed to the agent during fill

* * *

## Stage 2: Architecture Stage

### Constants (settings.ts)

```typescript
// packages/markform/src/settings.ts

/** Default role for fields without explicit role attribute */
export const AGENT_ROLE = 'agent';

/** Role for human-filled fields in interactive mode */
export const USER_ROLE = 'user';

/** Default roles list for forms without explicit roles */
export const DEFAULT_ROLES = [USER_ROLE, AGENT_ROLE] as const;

/** Default instructions per role (used when form doesn't specify) */
export const DEFAULT_ROLE_INSTRUCTIONS: Record<string, string> = {
  [USER_ROLE]: 'Fill in the fields you have direct knowledge of.',
  [AGENT_ROLE]: 'Complete the remaining fields based on the provided context.',
};
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
 * Extended CheckboxesField with approval_mode attribute.
 */
interface CheckboxesField extends FieldBase {
  kind: 'checkboxes';
  checkboxMode: CheckboxMode;
  minDone?: number;
  options: Option[];
  approvalMode: ApprovalMode;                   // defaults to 'none'
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

- [ ] Update `--interactive` to default to `USER_ROLE`

- [ ] Implement `getFieldsForRole()` helper

- [ ] Implement `findBlockingCheckpoint()` helper

- [ ] Implement `getFieldsToFill()` helper with blocking logic

- [ ] Pass `role_instructions` to agent prompt

- [ ] Update fill logic to use filtered field list

- [ ] Display message when fields are blocked by incomplete checkpoint

### Phase 4: Update Example Forms

**Goal:** Update bundled examples to use roles appropriately.

- [ ] Update `political-figure.form.md`: add `role="user"` to person name field

- [ ] Update `company-quarterly-analysis.form.md`: add `role="user"` to company info
  fields

- [ ] Update `simple.form.md`: add `role="user"` to a few demo fields

- [ ] Add `roles` and `role_instructions` to frontmatter of each example

- [ ] Test each example with two-stage workflow (user then agent)

### Phase 5: Tests

**Goal:** Unit and integration tests for role system and approval gates.

- [ ] Test default role assignment (`AGENT_ROLE`)

- [ ] Test role parsing from field attributes

- [ ] Test `roles` and `role_instructions` parsing from frontmatter

- [ ] Test `getFieldsForRole()` with various role filters

- [ ] Test `getFieldsToFill()` with `continue` and `overwrite` modes

- [ ] Test fill command with `--roles` flag

- [ ] Test fill command with `--interactive` defaults to user role

- [ ] Test role validation warnings

- [ ] Test `approvalMode` parsing on checkbox fields

- [ ] Test parse error when `approvalMode` used on non-checkbox field

- [ ] Test `findBlockingCheckpoint()` returns correct index

- [ ] Test fields after blocking checkpoint are excluded from fill

- [ ] Test completing checkpoint unblocks subsequent fields

- [ ] Test multiple blocking checkpoints in sequence

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

### Manual Tests

- [ ] Two-stage workflow: `fill --interactive` then `fill`

- [ ] Verify user role fields are skipped in default fill

- [ ] Verify `--roles=*` fills all fields

- [ ] Verify `--mode=overwrite` re-fills existing values

- [ ] Test custom role (e.g., `reviewer`)

- [ ] Test blocking checkpoint prevents filling subsequent fields

- [ ] Test completing checkpoint allows subsequent fill

### Definition of Done

1. `role` attribute works on all field types

2. `roles` and `role_instructions` work in frontmatter

3. `fill --roles=X` filters correctly

4. `fill --interactive` defaults to user role

5. `approvalMode="blocking"` prevents filling fields after incomplete checkpoint

6. Example forms demonstrate two-stage workflow

7. Tests pass

8. Documentation updated

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

3. **company-quarterly-analysis.form.md** - Add `role="user"` to company_name, ticker,
   fiscal_period

Each form should also get frontmatter with `roles` and `role_instructions` to show the
recommended pattern.

### Two-Stage Workflow Example

```bash
# Stage 1: User fills context fields (saves to company-quarterly-v1.form.md)
markform fill company-quarterly.form.md --interactive

# Stage 2: Agent completes analysis (saves to company-quarterly-v2.form.md)
markform fill company-quarterly-v1.form.md
```

* * *

## Revision History

- 2025-12-23: Added `approvalMode` for blocking checkpoint gates

- 2025-12-23: Initial plan created based on design discussion
