# Feature Validation: Role System Implementation

## Purpose

This is a validation spec for the role system implementation in Markform. It validates
multi-stage form workflows with role-based field ownership and blocking checkpoints.

**Feature Plan:** [plan-2025-12-23-role-system.md](plan-2025-12-23-role-system.md)

**Implementation Plan:** N/A (embedded in feature plan)

## Stage 4: Validation Stage

## Automated Validation (Testing Performed)

### Unit Testing

The following unit tests cover the role system implementation:

1. **Type definitions** (`src/engine/types.ts`)
   - Role type (`"user" | "agent"`) is correctly defined
   - ApprovalMode type (`"none" | "blocking"`) is correctly defined
   - FillMode type (`"continue" | "overwrite"`) is correctly defined

2. **Parser tests** (`tests/unit/engine/parse.test.ts`)
   - Parses `role` attribute on all field types
   - Parses `approvalMode` attribute on checkboxes
   - Defaults role to "agent" when not specified
   - Defaults approvalMode to "none" when not specified

3. **Inspector tests** (`tests/unit/engine/inspect.test.ts`)
   - Role filtering with `targetRoles` option
   - Blocking checkpoint detection for approvalMode="blocking"
   - `blockedBy` field set on issues blocked by unfilled checkpoints

4. **Serializer tests** (`tests/unit/engine/serialize.test.ts`)
   - Outputs `role` attribute only when not default ("agent")
   - Outputs `approvalMode` attribute only when not default ("none")
   - Round-trip parsing and serialization preserves all attributes

5. **Harness tests** (`tests/integration/harness/`)
   - Session-based testing with role-aware forms
   - Golden file testing validates serialization output

### Integration and End-to-End Testing

1. **Golden file tests** (`examples/simple/simple.session.yaml`)
   - Tests complete form filling workflow with role attributes
   - Validates SHA256 hash of serialized output
   - All 248 tests pass including harness integration tests

2. **Example forms updated with roles**
   - `simple.form.md`: name and email fields marked as `role="user"`
   - `company-quarterly-analysis.form.md`: key identification fields marked as `role="user"`

## Manual Testing Needed

The following manual validation steps confirm the implementation works as expected:

### 1. CLI Inspect Command with Role Filtering

Test the `--roles` flag on the inspect command:

```bash
# Navigate to markform package
cd packages/markform

# Inspect form with all roles (default)
pnpm markform inspect examples/simple/simple.form.md

# Filter to show only agent-role issues
pnpm markform inspect examples/simple/simple.form.md --roles agent

# Filter to show only user-role issues
pnpm markform inspect examples/simple/simple.form.md --roles user

# Show all roles explicitly
pnpm markform inspect examples/simple/simple.form.md --roles '*'
```

**Expected behavior:**
- Default shows all issues
- `--roles agent` filters to show only agent-targeted fields
- `--roles user` filters to show only user-targeted fields (name, email)
- Role badges `[user]` appear next to user-role fields in output
- JSON output includes `role` field in the groups/children structure

### 2. CLI Fill Command with Role Filtering

Test the `--roles` and `--mode` flags on the fill command:

```bash
# Fill only agent-targeted fields (default)
pnpm markform fill examples/simple/simple.form.md --verbose

# Fill only user-targeted fields
pnpm markform fill examples/simple/simple.form.md --roles user --verbose
```

**Expected behavior:**
- Default fill targets only agent-role fields
- `--roles user` targets only user-role fields
- `--mode continue` (default) skips already-filled fields
- `--mode overwrite` re-fills fields even if already have values

### 3. Serialization Output Verification

Verify that role and approvalMode attributes serialize correctly:

```bash
# Parse and re-serialize a form, check role attributes appear
pnpm markform inspect examples/simple/simple.form.md --format json | jq '.groups[].children[] | {id, role}'
```

**Expected behavior:**
- Fields with `role="user"` show `"role": "user"` in JSON
- Fields with default role show `"role": "agent"` in JSON
- When serialized back to markdown, `role="user"` appears on user fields
- `role="agent"` does NOT appear (it's the default, omitted for brevity)

### 4. Form Content Inspection

Review the example forms to confirm role attributes are correct:

```bash
# Check simple.form.md for role attributes
grep -n 'role=' examples/simple/simple.form.md

# Expected output shows name and email have role="user"
```

**Expected lines:**
- Line with `string-field id="name"` includes `role="user"`
- Line with `string-field id="email"` includes `role="user"`

### 5. Blocking Checkpoint Behavior (Future Feature)

Note: The `approvalMode="blocking"` feature is defined in types but not yet fully
implemented with UI blocking behavior. The current implementation:

- Parses and serializes `approvalMode` attribute
- Inspector can detect blocking checkpoints
- `blockedBy` field is set on issues when applicable

Full blocking checkpoint validation will be added when the feature is completed.

## User Review Checklist

- [ ] CLI inspect command shows role badges correctly
- [ ] CLI inspect `--roles` filtering works as expected
- [ ] CLI fill `--roles` filtering targets correct fields
- [ ] JSON output includes role information
- [ ] Example forms have appropriate role assignments
- [ ] All automated tests pass (248 tests)
