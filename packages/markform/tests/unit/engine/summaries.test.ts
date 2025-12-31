import { describe, expect, it } from 'vitest';

import { parseForm } from '../../../src/engine/parse.js';
import {
  computeStructureSummary,
  computeProgressSummary,
  computeFormState,
  isFormComplete,
  computeAllSummaries,
} from '../../../src/engine/summaries.js';
import { inspect } from '../../../src/engine/inspect.js';
import type { InspectIssue } from '../../../src/engine/coreTypes.js';

describe('engine/summaries', () => {
  describe('computeStructureSummary', () => {
    it('counts groups and fields correctly', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="name" label="Name" %}{% /field %}
{% field kind="number" id="age" label="Age" %}{% /field %}
{% /group %}

{% group id="g2" %}
{% field kind="string" id="email" label="Email" %}{% /field %}
{% /group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const summary = computeStructureSummary(parsed.schema);

      expect(summary.groupCount).toBe(2);
      expect(summary.fieldCount).toBe(3);
      expect(summary.fieldCountByKind.string).toBe(2);
      expect(summary.fieldCountByKind.number).toBe(1);
    });

    it('builds group and field indices', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="name" label="Name" %}{% /field %}
{% /group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const summary = computeStructureSummary(parsed.schema);

      expect(summary.groupsById.g1).toBe('field_group');
      expect(summary.fieldsById.name).toBe('string');
    });

    it('counts options for select fields', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="single_select" id="rating" label="Rating" %}
- [ ] Low {% #low %}
- [ ] Medium {% #medium %}
- [ ] High {% #high %}
{% /field %}
{% /group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const summary = computeStructureSummary(parsed.schema);

      expect(summary.optionCount).toBe(3);
      expect(summary.optionsById['rating.low']).toEqual({
        parentFieldId: 'rating',
        parentFieldKind: 'single_select',
      });
    });

    it('counts columns for table fields', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" title="G1" %}
{% field kind="table" id="people" label="People" columnIds=["name", "age", "email"] columnLabels=["Name", "Age", "Email"] columnTypes=["string", "number", "url"] %}
| Name | Age | Email |
| --- | --- | --- |
{% /field %}
{% /group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const summary = computeStructureSummary(parsed.schema);

      expect(summary.columnCount).toBe(3);
      expect(summary.columnsById['people.name']).toEqual({
        parentFieldId: 'people',
        columnType: 'string',
      });
      expect(summary.columnsById['people.age']).toEqual({
        parentFieldId: 'people',
        columnType: 'number',
      });
      expect(summary.columnsById['people.email']).toEqual({
        parentFieldId: 'people',
        columnType: 'url',
      });
    });
  });

  describe('computeProgressSummary', () => {
    it('tracks unsubmitted fields as empty', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="name" label="Name" %}{% /field %}
{% /group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const progress = computeProgressSummary(
        parsed.schema,
        parsed.responsesByFieldId,
        parsed.notes,
        [],
      );

      expect(progress.fields.name?.empty).toBe(true);
      expect(progress.fields.name?.valid).toBe(true);
      expect(progress.fields.name?.answerState === 'answered').toBe(false);
      expect(progress.counts.answeredFields).toBe(0);
    });

    it('tracks submitted fields as complete when valid', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="name" label="Name" %}
\`\`\`value
John Doe
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const progress = computeProgressSummary(
        parsed.schema,
        parsed.responsesByFieldId,
        parsed.notes,
        [],
      );

      expect(progress.fields.name?.empty).toBe(false);
      expect(progress.fields.name?.valid).toBe(true);
      expect(progress.fields.name?.answerState === 'answered').toBe(true);
      expect(progress.counts.answeredFields).toBe(1);
      expect(progress.counts.validFields).toBe(1);
      expect(progress.counts.filledFields).toBe(1);
    });

    it('tracks fields with issues as invalid', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="name" label="Name" required=true %}
\`\`\`value
X
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      const parsed = parseForm(markdown);

      // Simulate a validation issue
      const issues: InspectIssue[] = [
        {
          ref: 'name',
          scope: 'field',
          reason: 'validation_error',
          severity: 'required',
          message: 'Value too short',
          priority: 1,
        },
      ];

      const progress = computeProgressSummary(
        parsed.schema,
        parsed.responsesByFieldId,
        parsed.notes,
        issues,
      );

      expect(progress.fields.name?.valid).toBe(false);
      expect(progress.fields.name?.issueCount).toBe(1);
      expect(progress.counts.invalidFields).toBe(1);
    });

    it('counts required fields separately', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="name" label="Name" required=true %}
\`\`\`value
John
\`\`\`
{% /field %}
{% field kind="string" id="notes" label="Notes" %}{% /field %}
{% /group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const progress = computeProgressSummary(
        parsed.schema,
        parsed.responsesByFieldId,
        parsed.notes,
        [],
      );

      expect(progress.counts.requiredFields).toBe(1);
      expect(progress.counts.emptyRequiredFields).toBe(0);
    });

    it('computes checkbox progress for checkboxes fields', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="checkboxes" id="tasks" label="Tasks" checkboxMode="multi" %}
- [x] Done {% #done %}
- [/] In progress {% #progress %}
- [ ] Todo {% #todo %}
{% /field %}
{% /group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const progress = computeProgressSummary(
        parsed.schema,
        parsed.responsesByFieldId,
        parsed.notes,
        [],
      );

      expect(progress.fields.tasks?.checkboxProgress).toBeDefined();
      expect(progress.fields.tasks?.checkboxProgress?.done).toBe(1);
      expect(progress.fields.tasks?.checkboxProgress?.incomplete).toBe(1);
      expect(progress.fields.tasks?.checkboxProgress?.todo).toBe(1);
    });

    it('tracks checkboxes with incomplete items as incomplete', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="checkboxes" id="tasks" label="Tasks" checkboxMode="multi" %}
- [x] Done {% #done %}
- [ ] Todo {% #todo %}
{% /field %}
{% /group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const progress = computeProgressSummary(
        parsed.schema,
        parsed.responsesByFieldId,
        parsed.notes,
        [],
      );

      // In multi mode, having a "todo" item - field is not empty, still valid (no issues)
      expect(progress.fields.tasks?.empty).toBe(false);
      expect(progress.fields.tasks?.valid).toBe(true);
    });

    it('tracks explicit checkboxes with unfilled as incomplete', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="checkboxes" id="confirms" label="Confirms" checkboxMode="explicit" %}
- [y] Answered yes {% #yes %}
- [ ] Not answered {% #unfilled %}
{% /field %}
{% /group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const progress = computeProgressSummary(
        parsed.schema,
        parsed.responsesByFieldId,
        parsed.notes,
        [],
      );

      // In explicit mode, having an "unfilled" item - field is not empty, still valid (no issues)
      expect(progress.fields.confirms?.empty).toBe(false);
      expect(progress.fields.confirms?.valid).toBe(true);
    });
  });

  describe('computeFormState', () => {
    it('returns empty when no fields submitted', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="name" label="Name" %}{% /field %}
{% /group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const progress = computeProgressSummary(
        parsed.schema,
        parsed.responsesByFieldId,
        parsed.notes,
        [],
      );
      const state = computeFormState(progress);

      expect(state).toBe('complete'); // No required fields, so complete
    });

    it('returns complete when all requirements met', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="name" label="Name" required=true %}
\`\`\`value
John
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const progress = computeProgressSummary(
        parsed.schema,
        parsed.responsesByFieldId,
        parsed.notes,
        [],
      );
      const state = computeFormState(progress);

      expect(state).toBe('complete');
    });

    it('returns invalid when issues present', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="name" label="Name" required=true %}
\`\`\`value
X
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const issues: InspectIssue[] = [
        {
          ref: 'name',
          scope: 'field',
          reason: 'validation_error',
          severity: 'required',
          message: 'Value too short',
          priority: 1,
        },
      ];
      const progress = computeProgressSummary(
        parsed.schema,
        parsed.responsesByFieldId,
        parsed.notes,
        issues,
      );
      const state = computeFormState(progress);

      expect(state).toBe('invalid');
    });

    it('returns incomplete when some required fields empty', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="name" label="Name" required=true %}
\`\`\`value
John
\`\`\`
{% /field %}
{% field kind="string" id="email" label="Email" required=true %}{% /field %}
{% /group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const progress = computeProgressSummary(
        parsed.schema,
        parsed.responsesByFieldId,
        parsed.notes,
        [],
      );
      const state = computeFormState(progress);

      // Some submitted but not all required complete
      expect(state).toBe('incomplete');
    });
  });

  describe('isFormComplete', () => {
    it('returns true when form is complete', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="name" label="Name" required=true %}
\`\`\`value
John
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const progress = computeProgressSummary(
        parsed.schema,
        parsed.responsesByFieldId,
        parsed.notes,
        [],
      );

      expect(isFormComplete(progress)).toBe(true);
    });

    it('returns false when required fields missing', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="name" label="Name" required=true %}{% /field %}
{% /group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const progress = computeProgressSummary(
        parsed.schema,
        parsed.responsesByFieldId,
        parsed.notes,
        [],
      );

      expect(isFormComplete(progress)).toBe(false);
    });

    it('returns false when issues present', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="name" label="Name" %}
\`\`\`value
X
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const issues: InspectIssue[] = [
        {
          ref: 'name',
          scope: 'field',
          reason: 'validation_error',
          severity: 'required',
          message: 'Value too short',
          priority: 1,
        },
      ];
      const progress = computeProgressSummary(
        parsed.schema,
        parsed.responsesByFieldId,
        parsed.notes,
        issues,
      );

      expect(isFormComplete(progress)).toBe(false);
    });
  });

  describe('skipped field progress', () => {
    it('tracks skipped fields in progress', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="name" label="Name" required=true %}
\`\`\`value
John
\`\`\`
{% /field %}
{% field kind="string" id="notes" label="Notes" %}{% /field %}
{% /group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      // Set notes field to skipped state
      parsed.responsesByFieldId.notes = { state: 'skipped' };
      const progress = computeProgressSummary(
        parsed.schema,
        parsed.responsesByFieldId,
        parsed.notes,
        [],
      );

      expect(progress.fields.notes?.answerState).toBe('skipped');
      expect(progress.fields.name?.answerState).not.toBe('skipped');
      expect(progress.counts.skippedFields).toBe(1);
      expect(progress.counts.answeredFields).toBe(1);
    });

    it('counts answered and skipped separately', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="name" label="Name" %}
\`\`\`value
Alice
\`\`\`
{% /field %}
{% field kind="string" id="email" label="Email" %}
\`\`\`value
alice@example.com
\`\`\`
{% /field %}
{% field kind="string" id="notes" label="Notes" %}{% /field %}
{% field kind="string" id="bio" label="Bio" %}{% /field %}
{% /group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      // Set notes and bio fields to skipped state
      parsed.responsesByFieldId.notes = { state: 'skipped' };
      parsed.responsesByFieldId.bio = { state: 'skipped' };
      const progress = computeProgressSummary(
        parsed.schema,
        parsed.responsesByFieldId,
        parsed.notes,
        [],
      );

      expect(progress.counts.totalFields).toBe(4);
      expect(progress.counts.answeredFields).toBe(2); // name and email
      expect(progress.counts.skippedFields).toBe(2); // notes and bio
    });

    it('computes all summaries with skips', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="name" label="Name" required=true %}
\`\`\`value
John
\`\`\`
{% /field %}
{% field kind="string" id="notes" label="Notes" %}{% /field %}
{% /group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      // Set notes field to skipped state
      parsed.responsesByFieldId.notes = { state: 'skipped' };
      const result = computeAllSummaries(
        parsed.schema,
        parsed.responsesByFieldId,
        parsed.notes,
        [],
      );

      expect(result.progressSummary.fields.notes?.answerState).toBe('skipped');
      expect(result.progressSummary.counts.skippedFields).toBe(1);
      expect(result.formState).toBe('complete');
      expect(result.isComplete).toBe(true);
    });

    it('requires all fields addressed when skip_field is used', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="name" label="Name" required=true %}
\`\`\`value
John
\`\`\`
{% /field %}
{% field kind="string" id="notes" label="Notes" %}{% /field %}
{% field kind="string" id="bio" label="Bio" %}{% /field %}
{% /group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      // Skip only one optional field, leave another unskipped and empty
      parsed.responsesByFieldId.notes = { state: 'skipped' };
      const result = computeAllSummaries(
        parsed.schema,
        parsed.responsesByFieldId,
        parsed.notes,
        [],
      );

      // With skip_field in use, form is not complete because bio is neither answered nor skipped
      expect(result.isComplete).toBe(false);
      expect(result.progressSummary.counts.answeredFields).toBe(1); // name
      expect(result.progressSummary.counts.skippedFields).toBe(1); // notes
      expect(result.progressSummary.counts.totalFields).toBe(3);
    });

    it('is complete when all fields addressed with skip_field', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="name" label="Name" required=true %}
\`\`\`value
John
\`\`\`
{% /field %}
{% field kind="string" id="notes" label="Notes" %}{% /field %}
{% field kind="string" id="bio" label="Bio" %}{% /field %}
{% /group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      // Skip both optional fields
      parsed.responsesByFieldId.notes = { state: 'skipped' };
      parsed.responsesByFieldId.bio = { state: 'skipped' };
      const result = computeAllSummaries(
        parsed.schema,
        parsed.responsesByFieldId,
        parsed.notes,
        [],
      );

      // All fields addressed: 1 answered + 2 skipped = 3 total
      expect(result.isComplete).toBe(true);
      expect(result.progressSummary.counts.answeredFields).toBe(1);
      expect(result.progressSummary.counts.skippedFields).toBe(2);
    });
  });

  describe('empty vs answerState - orthogonal dimensions (markform-480)', () => {
    it('multi_select answered with no selections: empty=true, answerState=answered', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="multi_select" id="streaming" label="Streaming" %}
- [ ] Netflix {% #netflix %}
- [ ] Hulu {% #hulu %}
- [ ] Disney+ {% #disney %}
{% /field %}
{% /group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      // Simulate agent answering with no selections (empty array)
      parsed.responsesByFieldId.streaming = {
        state: 'answered',
        value: {
          kind: 'multi_select',
          selected: [], // Intentionally empty - "none of the above"
        },
      };
      const progress = computeProgressSummary(
        parsed.schema,
        parsed.responsesByFieldId,
        parsed.notes,
        [],
      );

      // empty=true: field has no substantive value (selected.length === 0)
      // answerState=answered: agent has addressed the field
      // These are orthogonal dimensions per the spec
      expect(progress.fields.streaming?.empty).toBe(true);
      expect(progress.fields.streaming?.answerState).toBe('answered');
      expect(progress.counts.answeredFields).toBe(1);
      expect(progress.counts.emptyFields).toBe(1);
      expect(progress.counts.filledFields).toBe(0);
    });

    it('string_list answered with no items: empty=true, answerState=answered', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string_list" id="tags" label="Tags" %}{% /field %}
{% /group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      // Simulate agent answering with no items (empty array)
      parsed.responsesByFieldId.tags = {
        state: 'answered',
        value: {
          kind: 'string_list',
          items: [], // Intentionally empty
        },
      };
      const progress = computeProgressSummary(
        parsed.schema,
        parsed.responsesByFieldId,
        parsed.notes,
        [],
      );

      // empty=true (no items), but answerState=answered (agent addressed it)
      expect(progress.fields.tags?.empty).toBe(true);
      expect(progress.fields.tags?.answerState).toBe('answered');
    });

    it('table answered with no rows: empty=true, answerState=answered', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="table" id="awards" label="Awards" columnIds=["award", "year"] columnTypes=["string", "number"] %}
| Award | Year |
| --- | --- |
{% /field %}
{% /group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      // Simulate agent answering with no rows (empty table)
      parsed.responsesByFieldId.awards = {
        state: 'answered',
        value: {
          kind: 'table',
          rows: [], // Intentionally empty
        },
      };
      const progress = computeProgressSummary(
        parsed.schema,
        parsed.responsesByFieldId,
        parsed.notes,
        [],
      );

      // empty=true (no rows), but answerState=answered (agent addressed it)
      expect(progress.fields.awards?.empty).toBe(true);
      expect(progress.fields.awards?.answerState).toBe('answered');
    });

    it('unanswered multi_select: empty=true, answerState=unanswered', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="multi_select" id="streaming" label="Streaming" %}
- [ ] Netflix {% #netflix %}
- [ ] Hulu {% #hulu %}
{% /field %}
{% /group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      // No response set - field is unanswered
      const progress = computeProgressSummary(
        parsed.schema,
        parsed.responsesByFieldId,
        parsed.notes,
        [],
      );

      // Both dimensions indicate "not addressed"
      expect(progress.fields.streaming?.empty).toBe(true);
      expect(progress.fields.streaming?.answerState).toBe('unanswered');
      expect(progress.counts.emptyFields).toBe(1);
    });
  });

  describe('computeAllSummaries', () => {
    it('computes all summaries at once', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="name" label="Name" required=true %}
\`\`\`value
John
\`\`\`
{% /field %}
{% field kind="number" id="age" label="Age" %}{% /field %}
{% /group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const result = computeAllSummaries(
        parsed.schema,
        parsed.responsesByFieldId,
        parsed.notes,
        [],
      );

      // Structure summary
      expect(result.structureSummary.fieldCount).toBe(2);
      expect(result.structureSummary.groupCount).toBe(1);

      // Progress summary
      expect(result.progressSummary.counts.totalFields).toBe(2);
      expect(result.progressSummary.counts.answeredFields).toBe(1);

      // Form state (formState is based on required fields, isComplete requires all fields addressed)
      expect(result.formState).toBe('complete');
      // isComplete is false because the optional 'age' field is not addressed (filled or skipped)
      expect(result.isComplete).toBe(false);
    });
  });

  describe('unified response model - progress with responseState (markform-235)', () => {
    it('computes progress counts from response states', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="name" label="Name" required=true %}
\`\`\`value
Alice
\`\`\`
{% /field %}
{% field kind="string" id="bio" label="Bio" state="skipped" %}{% /field %}
{% field kind="number" id="age" label="Age" state="aborted" %}{% /field %}
{% field kind="string" id="notes" label="Notes" %}{% /field %}
{% /group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const progress = computeProgressSummary(
        parsed.schema,
        parsed.responsesByFieldId,
        parsed.notes,
        [],
      );

      expect(progress.counts.totalFields).toBe(4);
      expect(progress.counts.answeredFields).toBe(1); // name (has value)
      expect(progress.counts.skippedFields).toBe(1); // bio (no value)
      expect(progress.counts.abortedFields).toBe(1); // age (no value)
      expect(progress.counts.unansweredFields).toBe(1); // notes (no value)

      // Dimension 1 invariant: AnswerState sums to totalFields
      const answerStateTotal =
        progress.counts.answeredFields +
        progress.counts.skippedFields +
        progress.counts.abortedFields +
        progress.counts.unansweredFields;
      expect(answerStateTotal).toBe(progress.counts.totalFields);

      // Dimension 3 invariant: Value presence sums to totalFields
      expect(progress.counts.filledFields).toBe(1); // name has value
      expect(progress.counts.emptyFields).toBe(3); // bio, age, notes have no value
      expect(progress.counts.filledFields + progress.counts.emptyFields).toBe(
        progress.counts.totalFields,
      );
    });

    it('tracks field response states in progress', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="name" label="Name" %}
\`\`\`value
Alice
\`\`\`
{% /field %}
{% field kind="string" id="bio" label="Bio" state="skipped" %}{% /field %}
{% field kind="number" id="age" label="Age" state="aborted" %}{% /field %}
{% field kind="string" id="notes" label="Notes" %}{% /field %}
{% /group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const progress = computeProgressSummary(
        parsed.schema,
        parsed.responsesByFieldId,
        parsed.notes,
        [],
      );

      expect(progress.fields.name?.answerState).toBe('answered');
      expect(progress.fields.bio?.answerState).toBe('skipped');
      expect(progress.fields.age?.answerState).toBe('aborted');
      expect(progress.fields.notes?.answerState).toBe('unanswered');
    });

    it('counts notes in progress summary', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="name" label="Name" %}{% /field %}
{% field kind="string" id="bio" label="Bio" state="skipped" %}{% /field %}
{% /group %}

{% note id="n1" ref="bio" role="agent" %}
Not available.
{% /note %}

{% note id="n2" ref="name" role="user" %}
General comment.
{% /note %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const progress = computeProgressSummary(
        parsed.schema,
        parsed.responsesByFieldId,
        parsed.notes,
        [],
      );

      expect(progress.counts.totalNotes).toBe(2);
      expect(progress.fields.bio?.hasNotes).toBe(true);
      expect(progress.fields.bio?.noteCount).toBe(1);
      expect(progress.fields.name?.hasNotes).toBe(true);
      expect(progress.fields.name?.noteCount).toBe(1);
    });

    it('tracks aborted required field as not complete', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="name" label="Name" required=true state="aborted" %}{% /field %}
{% /group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      // Use inspect to include validation issues
      const result = inspect(parsed);
      const progress = result.progressSummary;

      expect(progress.counts.requiredFields).toBe(1);
      expect(progress.counts.abortedFields).toBe(1);
      expect(progress.counts.answeredFields).toBe(0);
      // Aborted required fields are invalid (missing required value creates validation issue)
      expect(progress.fields.name?.valid).toBe(false);
      expect(progress.fields.name?.answerState).toBe('aborted');
    });
  });

  describe('unified response model - completion with abortedFields (markform-236)', () => {
    it('isFormComplete returns false when abortedFields > 0', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="name" label="Name" required=true %}
\`\`\`value
Alice
\`\`\`
{% /field %}
{% field kind="number" id="age" label="Age" state="aborted" %}{% /field %}
{% /group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const progress = computeProgressSummary(
        parsed.schema,
        parsed.responsesByFieldId,
        parsed.notes,
        [],
      );

      expect(isFormComplete(progress)).toBe(false);
      expect(progress.counts.abortedFields).toBe(1);
    });

    it('computeFormState returns invalid when abortedFields > 0', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="name" label="Name" required=true %}
\`\`\`value
Alice
\`\`\`
{% /field %}
{% field kind="number" id="age" label="Age" state="aborted" %}{% /field %}
{% /group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const progress = computeProgressSummary(
        parsed.schema,
        parsed.responsesByFieldId,
        parsed.notes,
        [],
      );
      const state = computeFormState(progress);

      expect(state).toBe('invalid');
    });

    it('isFormComplete returns true when all fields answered or skipped (no aborted)', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="name" label="Name" required=true %}
\`\`\`value
Alice
\`\`\`
{% /field %}
{% field kind="string" id="bio" label="Bio" state="skipped" %}{% /field %}
{% field kind="string" id="notes" label="Notes" state="skipped" %}{% /field %}
{% /group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const progress = computeProgressSummary(
        parsed.schema,
        parsed.responsesByFieldId,
        parsed.notes,
        [],
      );

      expect(isFormComplete(progress)).toBe(true);
      expect(progress.counts.abortedFields).toBe(0);
      expect(progress.counts.answeredFields).toBe(1);
      expect(progress.counts.skippedFields).toBe(2);
    });

    it('form with aborted required field blocks completion', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="name" label="Name" required=true state="aborted" %}{% /field %}
{% /group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const result = computeAllSummaries(
        parsed.schema,
        parsed.responsesByFieldId,
        parsed.notes,
        [],
      );

      expect(result.isComplete).toBe(false);
      expect(result.formState).toBe('invalid');
      expect(result.progressSummary.counts.abortedFields).toBe(1);
    });

    it('form is incomplete when some fields are empty (not answered/skipped)', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="name" label="Name" required=true %}
\`\`\`value
Alice
\`\`\`
{% /field %}
{% field kind="string" id="bio" label="Bio" %}{% /field %}
{% /group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const result = computeAllSummaries(
        parsed.schema,
        parsed.responsesByFieldId,
        parsed.notes,
        [],
      );

      expect(result.isComplete).toBe(false);
      expect(result.formState).toBe('complete'); // Required fields are complete
      expect(result.progressSummary.counts.emptyFields).toBe(1);
      expect(result.progressSummary.counts.abortedFields).toBe(0);
    });

    it('form is complete when all required fields answered and all optional fields addressed', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="name" label="Name" required=true %}
\`\`\`value
Alice
\`\`\`
{% /field %}
{% field kind="string" id="bio" label="Bio" state="skipped" %}{% /field %}
{% field kind="string" id="notes" label="Notes" %}
\`\`\`value
Some notes
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const result = computeAllSummaries(
        parsed.schema,
        parsed.responsesByFieldId,
        parsed.notes,
        [],
      );

      expect(result.isComplete).toBe(true);
      expect(result.formState).toBe('complete');
      expect(result.progressSummary.counts.abortedFields).toBe(0);
      // bio is skipped (no value), so emptyFields = 1
      expect(result.progressSummary.counts.emptyFields).toBe(1);
      expect(result.progressSummary.counts.filledFields).toBe(2); // name, notes
    });
  });
});
