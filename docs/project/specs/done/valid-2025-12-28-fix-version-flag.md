# Feature Validation: Fix Version Flag

## Purpose

This is a validation spec for the bug fix that corrects the `--version` flag behavior and
removes the `-V` short option.

**Feature Plan:** N/A (bug fix, no plan spec)

**Implementation Plan:** N/A (bug fix, no implementation spec)

## Summary of Changes

1. **VERSION now reads from package.json**: Changed from hardcoded `'0.1.0'` to
   dynamically reading from `package.json` using `createRequire`.

2. **Removed `-V` short option**: Only `--version` is now supported for consistency.

3. **Updated test**: Changed test to verify VERSION matches semver format rather than
   a specific version number.

## Stage 4: Validation Stage

## Automated Validation (Testing Performed)

### Unit Testing

- **`tests/unit/index.test.ts`**: Updated test validates that `VERSION` exports a valid
  semver string matching pattern `^\d+\.\d+\.\d+`

- All 600 tests pass including the updated version test

### Integration and End-to-End Testing

- Pre-commit hooks run lint, typecheck, and test suites
- Pre-push hooks run full test suite
- Built binary tested with `pnpm markform:bin --version` to confirm it shows `0.1.3`

## Manual Testing Needed

The user should verify the following CLI behaviors:

1. **Version flag shows correct version:**
   ```bash
   pnpm markform --version
   # Expected: 0.1.3 (or current package.json version)
   ```

2. **Short flag `-V` is no longer recognized:**
   ```bash
   pnpm markform -V
   # Expected: error: unknown option '-V'
   ```

3. **Help output shows only `--version` (no `-V`):**
   ```bash
   pnpm markform --help
   # Expected: Options section shows "--version" without "-V"
   ```

4. **Built binary works correctly:**
   ```bash
   pnpm markform:bin --version
   # Expected: 0.1.3 (or current package.json version)
   ```
