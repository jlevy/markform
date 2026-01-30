# Manual End-to-End Fill Tests

> **Purpose**: Validate live agent form filling with real API keys.
> These tests capture complete FillRecord output for manual review.
>
> **NOT automated** - Run manually before releases to verify end-to-end behavior.

---

## Prerequisites

1. **Build the CLI**:
   ```bash
   pnpm build
   ```

2. **Set up API keys** in `.env` at repository root:
   ```bash
   OPENAI_API_KEY=sk-...
   # Or for Anthropic:
   # ANTHROPIC_API_KEY=sk-ant-...
   ```

3. **Create output directory**:
   ```bash
   mkdir -p /tmp/markform-manual-tests
   ```

---

## Test 1: Simple Form Fill (OpenAI)

Fill the simple form with basic field types using GPT-4o-mini.

### Command

```bash
./dist/bin.mjs fill examples/simple/simple.form.md \
  --model openai/gpt-4o-mini \
  --output /tmp/markform-manual-tests/simple-filled.form.md \
  --record-fill
```

### Expected Output Structure

```
Filling form: .../examples/simple/simple.form.md
Agent: openai/gpt-4o-mini
Turn 1: X issues
Turn 2: X issues
...
Form completed in N turn(s)
⏰ Fill time: X.Xs
Form written to: /tmp/markform-manual-tests/simple-filled.form.md

Fill completed in Xms (N turns)

Tokens:  XXXX input / XXXX output (openai/gpt-4o-mini)
Tools:   N calls (N succeeded)

Progress: X/21 fields filled (XX%)
Session Transcript
...
```

### Verification Checklist

- [ ] Form completes without errors
- [ ] FillRecord summary shows token counts > 0
- [ ] Tool calls show succeeded count
- [ ] Progress shows fields filled
- [ ] Output file exists and is valid Markform
- [ ] Sidecar `.fill.json` file created with `--record-fill`

### Review Commands

```bash
# Check output form is valid
./dist/bin.mjs validate /tmp/markform-manual-tests/simple-filled.form.md

# Check fill status
./dist/bin.mjs status /tmp/markform-manual-tests/simple-filled.form.md

# View FillRecord sidecar
cat /tmp/markform-manual-tests/simple-filled.fill.json | jq .
```

---

## Test 2: Startup Research Form (Web Search)

Fill the startup research form which requires web search capabilities.

### Command

```bash
./dist/bin.mjs research examples/startup-research/startup-research.form.md \
  --model openai/gpt-4o-mini \
  --company "Anthropic" \
  --output /tmp/markform-manual-tests/startup-anthropic.form.md \
  --record-fill
```

### Alternative: Manual Fill with Input

```bash
# If research command not available, use fill with pre-filled company name
./dist/bin.mjs fill examples/startup-research/startup-research.form.md \
  --model openai/gpt-4o-mini \
  --output /tmp/markform-manual-tests/startup-filled.form.md \
  --record-fill
```

### Expected Output Structure

```
Filling form: .../startup-research.form.md
Agent: openai/gpt-4o-mini
Turn 1: X issues
...
Form completed in N turn(s)
⏰ Fill time: X.Xs
Form written to: /tmp/markform-manual-tests/startup-filled.form.md

Fill completed in Xms (N turns)

Tokens:  XXXX input / XXXX output (openai/gpt-4o-mini)
Tools:   N calls (N succeeded)

Progress: X/Y fields filled (XX%)
```

### Verification Checklist

- [ ] Form completes (may be partial due to research complexity)
- [ ] Multiple turns executed (research requires iteration)
- [ ] Token usage reflects complexity
- [ ] Company information fields populated
- [ ] URLs captured (company website, etc.)

---

## Test 3: Quiet Mode Verification

Verify `--quiet` suppresses the FillRecord summary.

### Command

```bash
./dist/bin.mjs fill examples/simple/simple.form.md \
  --model openai/gpt-4o-mini \
  --output /tmp/markform-manual-tests/simple-quiet.form.md \
  --quiet
```

### Expected Output

Should show minimal output with NO FillRecord summary:
- No "Fill completed in..." line
- No "Tokens:" line
- No "Tools:" line
- No "Progress:" line

### Verification

```bash
# This should return nothing (no summary lines)
./dist/bin.mjs fill examples/simple/simple.form.md \
  --model openai/gpt-4o-mini \
  --output /tmp/markform-manual-tests/simple-quiet2.form.md \
  --quiet 2>&1 | grep -E "^(Fill completed|Tokens:|Tools:|Progress:)"
```

---

## Test 4: FillRecord JSON Sidecar

Verify the `--record-fill` flag creates a complete FillRecord JSON sidecar.

### Command

```bash
./dist/bin.mjs fill examples/simple/simple.form.md \
  --model openai/gpt-4o-mini \
  --output /tmp/markform-manual-tests/simple-record.form.md \
  --record-fill
```

### Verify Sidecar Contents

```bash
# Check sidecar file exists
ls -la /tmp/markform-manual-tests/simple-record.fill.json

# Verify JSON structure
cat /tmp/markform-manual-tests/simple-record.fill.json | jq 'keys'
# Expected: ["completedAt", "durationMs", "events", "finalProgress", "model", ...]

# Check events were captured
cat /tmp/markform-manual-tests/simple-record.fill.json | jq '.events | length'
# Should be > 0

# Check token usage
cat /tmp/markform-manual-tests/simple-record.fill.json | jq '.tokenUsage'
# Should show inputTokens and outputTokens > 0

# Check tool calls
cat /tmp/markform-manual-tests/simple-record.fill.json | jq '.toolCalls'
# Should show count > 0
```

### FillRecord Schema Verification

The sidecar should contain:

```json
{
  "startedAt": "2026-01-30T...",
  "completedAt": "2026-01-30T...",
  "durationMs": 1234,
  "status": "completed",
  "provider": "openai",
  "model": "gpt-4o-mini",
  "tokenUsage": {
    "inputTokens": 1234,
    "outputTokens": 567
  },
  "toolCalls": {
    "count": 5,
    "succeeded": 5,
    "failed": 0
  },
  "turns": 3,
  "finalProgress": {
    "filled": 21,
    "total": 21,
    "percentage": 100
  },
  "events": [...]
}
```

---

## Test 5: Error Handling

Verify graceful handling of API errors.

### Test with Invalid API Key

```bash
OPENAI_API_KEY=invalid-key ./dist/bin.mjs fill examples/simple/simple.form.md \
  --model openai/gpt-4o-mini \
  --output /tmp/markform-manual-tests/simple-error.form.md 2>&1
```

### Expected Behavior

- Should show clear error message about authentication
- Should not crash with unhandled exception
- Exit code should be non-zero

---

## Test 6: Multi-Provider Comparison

Compare fill behavior across different providers (if keys available).

### OpenAI

```bash
./dist/bin.mjs fill examples/simple/simple.form.md \
  --model openai/gpt-4o-mini \
  --output /tmp/markform-manual-tests/simple-openai.form.md \
  --record-fill
```

### Anthropic

```bash
./dist/bin.mjs fill examples/simple/simple.form.md \
  --model anthropic/claude-sonnet-4-5 \
  --output /tmp/markform-manual-tests/simple-anthropic.form.md \
  --record-fill
```

### Compare Results

```bash
# Compare token usage
echo "OpenAI tokens:"
cat /tmp/markform-manual-tests/simple-openai.fill.json | jq '.tokenUsage'

echo "Anthropic tokens:"
cat /tmp/markform-manual-tests/simple-anthropic.fill.json | jq '.tokenUsage'

# Compare turns needed
echo "OpenAI turns:"
cat /tmp/markform-manual-tests/simple-openai.fill.json | jq '.turns'

echo "Anthropic turns:"
cat /tmp/markform-manual-tests/simple-anthropic.fill.json | jq '.turns'
```

---

## Cleanup

```bash
rm -rf /tmp/markform-manual-tests
```

---

## Regression Checklist

Before release, verify:

- [ ] Test 1: Simple form fills completely
- [ ] Test 2: Research form captures company data
- [ ] Test 3: Quiet mode suppresses summary
- [ ] Test 4: FillRecord JSON sidecar is complete
- [ ] Test 5: Errors are handled gracefully
- [ ] Test 6: Multiple providers work (if keys available)

**Compare output to previous release** - Review FillRecord structure for unexpected changes.

---

## Notes

- Tests require valid API keys - not suitable for CI automation
- Token costs apply - use sparingly
- Output may vary between runs due to LLM non-determinism
- Focus on structure verification, not exact output matching
