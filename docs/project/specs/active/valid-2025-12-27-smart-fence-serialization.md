# Feature Validation: Smart Fence Serialization

## Purpose

This validation spec documents testing performed for the smart fence serialization
feature, which prevents fence collision when values contain Markdown with fenced code
blocks.

**Feature Plan:** [plan-2025-12-27-smart-fence-serialization.txt](plan-2025-12-27-smart-fence-serialization.txt)

## Stage 4: Validation Stage

## Automated Validation (Testing Performed)

### Unit Testing

All unit tests are in `packages/markform/tests/unit/engine/serialize-fence.test.ts`:

**maxRunAtLineStart() function (9 tests):**
- Returns 0 for no fence chars
- Returns 3 for triple backticks at line start
- Returns 4 for four backticks at line start
- Returns 4 for four tildes at line start
- Returns 0 for fence chars with 4+ space indent (safe inside code blocks)
- Returns correct max for fence chars with 1-3 space indent
- Finds max run across multiple lines
- Correctly handles mixed backticks and tildes
- Correctly counts very long runs (10+ chars)

**pickFence() function (8 tests):**
- Returns backticks length 3 for plain text
- Returns tildes when content has backticks but no tildes
- Returns tildes for content with many backticks
- Prefers backticks on tie
- Detects Markdoc tags and sets processFalse
- Does not set processFalse for non-Markdoc content
- Handles content with both code blocks and Markdoc tags
- Uses tildes when backtick runs are longer

**formatValueFence via serialize (4 tests):**
- Uses triple backticks for plain content
- Uses tildes for content with triple-backtick code block
- Adds process=false for content with Markdoc tags
- Uses tildes when content has many backticks

### Integration and End-to-End Testing

**Round-trip tests (7 tests in serialize-fence.test.ts):**
- Round-trips value containing triple-backtick code block
- Round-trips value containing tilde code block
- Round-trips value containing Markdoc tags
- Round-trips value with both backticks and tildes
- Round-trips pathological case with many fence chars (10+ backticks, 9+ tildes)
- Round-trips empty content correctly
- Round-trips sentinel values (|SKIP|, |ABORT|) with new fence format

**Existing test suites (526 tests):**
- All existing serialize.test.ts tests pass (34 tests)
- All parse.test.ts tests pass (54 tests)
- All other engine tests pass
- Golden tests pass (session transcripts)

### Manual Testing Needed

The automated test suite comprehensively covers the smart fence selection logic. Manual
testing is minimal since this is a serializer-only change with no user-facing CLI or UI
impact.

**Recommended manual validation:**

1. **Review code changes** - Inspect the implementation in
   `packages/markform/src/engine/serialize.ts`:
   - Verify `maxRunAtLineStart()` correctly scans for fence runs
   - Verify `pickFence()` logic selects optimal fence character
   - Verify `formatValueFence()` constructs correct fence syntax

2. **Review SPEC.md update** - Confirm the new "Fence character" row in the canonical
   formatting rules table accurately describes the algorithm

3. **Create a test form** (optional) - Create a form with a multiline string field
   containing a code block, fill it, and verify the serialized output uses the correct
   fence:

   ```bash
   # Create a simple test
   cat > /tmp/test.form.md << 'EOF'
   ---
   markform:
     spec: MF/0.1
   ---

   {% form id="test" %}
   {% field-group id="g1" %}
   {% string-field id="code" label="Code Example" multiline=true %}{% /string-field %}
   {% /field-group %}
   {% /form %}
   EOF

   # Fill it with content containing backtick code blocks
   # Then inspect the output to verify tildes are used for the value fence
   ```

4. **Verify backward compatibility** - The parser already accepts any fence character and
   length, so existing `.form.md` files should continue to work. No migration needed.
