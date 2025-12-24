
> markform-workspace@ markform /Users/levy/wrk/aisw/markform
> node packages/markform/dist/bin.mjs export packages/markform/examples/simple/simple.form.md --format markdown

# Simple Test Form

A minimal form testing all Markform v0.1 field types and features.Used for TDD development and golden session testing.

## Basic Fields

**Name:**
_(empty)_

Enter your full name (2-50 characters).

**Email:**
_(empty)_

**Age:**
_(empty)_

**Score:**
_(empty)_

## List Fields

**Tags:**
_(empty)_

Add 1-5 unique tags (each at least 2 characters).

## Selection Fields

**Priority:**
_(none selected)_

**Categories:**
_(none selected)_

## Checkbox Fields

**Tasks (Multi Mode):**
- [ ] Research
- [ ] Design
- [ ] Implement
- [ ] Test

Track task progress. All must reach done or na state to complete.

**Agreements (Simple Mode):**
- [ ] I have read the guidelines
- [ ] I agree to the terms

**Confirmations (Explicit Mode):**
- [ ] Data has been backed up
- [ ] Stakeholders notified

Answer yes or no for each confirmation. All must be explicitly answered.

## Optional Fields

**Notes:**
_(empty)_

**Optional Number:**
_(empty)_

