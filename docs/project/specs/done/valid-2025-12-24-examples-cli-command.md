# Feature Validation: Examples CLI Command

## Purpose

This is a validation spec for the `markform examples` CLI command and the political
research example form.
It covers post-testing validation that must be performed by the user to confirm the
feature implementation and testing is adequate.

**Feature Plan:**
[plan-2025-12-23-examples-cli-command.md](plan-2025-12-23-examples-cli-command.md)

**Additional Spec:**
[plan-2025-12-23-political-research-example.md](plan-2025-12-23-political-research-example.md)

## Stage 4: Validation Stage

## Validation Planning

This implementation adds:

1. The `markform examples` command with interactive menu for scaffolding example forms

2. A new political-research example form for researching political figures

3. A mock Lincoln form demonstrating a filled political research form

## Automated Validation (Testing Performed)

### Unit Testing

17 new unit tests added in `tests/unit/cli/examples.test.ts`:

- Example registry has all required fields (id, title, description, filename, path)

- Each example has unique IDs

- Registry includes simple, political-research, and earnings-analysis examples

- `getExampleIds()` returns array of all example IDs

- `getExampleById()` returns example for valid ID, undefined for invalid

- `loadExampleContent()` loads content for each example type

- `loadExampleContent()` throws for unknown example

- Each example parses as valid form with correct schema ID

- Political-research example has name field with user role

- All examples contain roles in frontmatter content

### Integration and End-to-End Testing

- Build passes with all 310 tests passing

- ESLint and TypeScript typecheck pass

- Pre-commit hooks (typecheck, lint, test) all pass

- Pre-push hooks (test) pass

### Manual Testing Needed

#### 1. Verify `--list` Flag

Run and verify output formatting:

```bash
markform examples --list
```

**Expected output:**

- Lists 3 examples: simple, political-research, earnings-analysis

- Each has title, description, and default filename

- Formatting is clean with proper indentation

#### 2. Verify `--name` Flag with Valid Example

```bash
cd /tmp
markform examples --name simple
# Press Enter to accept default filename
```

**Expected behavior:**

- Prompts for filename with “simple.form.md” as default

- Creates the file in current directory

- Shows success message and suggested next commands

#### 3. Verify `--name` Flag with Invalid Example

```bash
markform examples --name nonexistent
```

**Expected behavior:**

- Shows error message “Unknown example: nonexistent”

- Lists available examples

- Exits with non-zero status

#### 4. Verify Interactive Chooser (Primary UX)

This is the main user experience - running `markform examples` without arguments shows
an interactive chooser:

```bash
cd /tmp
markform examples
```

**Expected behavior:**

- Shows intro banner “markform examples”

- Presents interactive selection menu with 3 examples

- Each option shows title and description hint

- Arrow keys navigate, Enter selects

- After selection, prompts for filename with editable default

- Creates file and shows success message with suggested next commands

#### 5. Verify Political Research Form Structure

```bash
markform inspect packages/markform/examples/political-research/political-research.form.md
```

**Expected output:**

- Form ID: political_research

- 7 field groups: Basic Information, Political Affiliation, Personal Life, Office 1-3,
  Sources

- 33 fields total

- 7 required fields

- Name field shows `[user]` role

#### 6. Verify Mock Lincoln Form

```bash
markform inspect packages/markform/examples/political-research/political-research.mock.lincoln.form.md
```

**Expected output:**

- Form State: ✓ complete

- All required fields filled

- Shows Lincoln biographical data

- Only optional empty fields are for Office 3 predecessor/successor/running_mate

#### 7. Verify Package Includes Examples

```bash
cd packages/markform
npm pack --dry-run 2>&1 | grep examples
```

**Expected output:**

- Should list files under `examples/` directory including:

  - `examples/political-research/political-research.form.md`

  - `examples/political-research/political-research.mock.lincoln.form.md`

## User Review Checklist

- [ ] `markform examples` shows interactive chooser menu

- [ ] `markform examples --list` displays correctly

- [ ] `markform examples --name simple` creates file correctly

- [ ] Invalid example name shows appropriate error

- [ ] Political research form structure looks correct

- [ ] Mock Lincoln form is complete with accurate data

- [ ] Examples are included in npm package
