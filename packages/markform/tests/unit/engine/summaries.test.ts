import { describe, expect, it } from "vitest";

import { parseForm } from "../../../src/engine/parse.js";
import {
  computeStructureSummary,
  computeProgressSummary,
  computeFormState,
  isFormComplete,
  computeAllSummaries,
} from "../../../src/engine/summaries.js";
import type { InspectIssue } from "../../../src/engine/coreTypes.js";

describe("engine/summaries", () => {
  describe("computeStructureSummary", () => {
    it("counts groups and fields correctly", () => {
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-field id="name" label="Name" %}{% /string-field %}
{% number-field id="age" label="Age" %}{% /number-field %}
{% /field-group %}

{% field-group id="g2" %}
{% string-field id="email" label="Email" %}{% /string-field %}
{% /field-group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const summary = computeStructureSummary(parsed.schema);

      expect(summary.groupCount).toBe(2);
      expect(summary.fieldCount).toBe(3);
      expect(summary.fieldCountByKind.string).toBe(2);
      expect(summary.fieldCountByKind.number).toBe(1);
    });

    it("builds group and field indices", () => {
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-field id="name" label="Name" %}{% /string-field %}
{% /field-group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const summary = computeStructureSummary(parsed.schema);

      expect(summary.groupsById.g1).toBe("field_group");
      expect(summary.fieldsById.name).toBe("string");
    });

    it("counts options for select fields", () => {
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test" %}

{% field-group id="g1" %}
{% single-select id="rating" label="Rating" %}
- [ ] Low {% #low %}
- [ ] Medium {% #medium %}
- [ ] High {% #high %}
{% /single-select %}
{% /field-group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const summary = computeStructureSummary(parsed.schema);

      expect(summary.optionCount).toBe(3);
      expect(summary.optionsById["rating.low"]).toEqual({
        parentFieldId: "rating",
        parentFieldKind: "single_select",
      });
    });
  });

  describe("computeProgressSummary", () => {
    it("tracks unsubmitted fields as empty", () => {
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-field id="name" label="Name" %}{% /string-field %}
{% /field-group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const progress = computeProgressSummary(parsed.schema, parsed.valuesByFieldId, []);

      expect(progress.fields.name?.state).toBe("empty");
      expect(progress.fields.name?.submitted).toBe(false);
      expect(progress.counts.submittedFields).toBe(0);
    });

    it("tracks submitted fields as complete when valid", () => {
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-field id="name" label="Name" %}
\`\`\`value
John Doe
\`\`\`
{% /string-field %}
{% /field-group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const progress = computeProgressSummary(parsed.schema, parsed.valuesByFieldId, []);

      expect(progress.fields.name?.state).toBe("complete");
      expect(progress.fields.name?.submitted).toBe(true);
      expect(progress.counts.submittedFields).toBe(1);
      expect(progress.counts.completeFields).toBe(1);
    });

    it("tracks fields with issues as invalid", () => {
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-field id="name" label="Name" required=true %}
\`\`\`value
X
\`\`\`
{% /string-field %}
{% /field-group %}

{% /form %}
`;
      const parsed = parseForm(markdown);

      // Simulate a validation issue
      const issues: InspectIssue[] = [
        {
          ref: "name",
          scope: "field",
          reason: "validation_error",
          severity: "required",
          message: "Value too short",
          priority: 1,
        },
      ];

      const progress = computeProgressSummary(parsed.schema, parsed.valuesByFieldId, issues);

      expect(progress.fields.name?.state).toBe("invalid");
      expect(progress.fields.name?.issueCount).toBe(1);
      expect(progress.fields.name?.valid).toBe(false);
      expect(progress.counts.invalidFields).toBe(1);
    });

    it("counts required fields separately", () => {
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-field id="name" label="Name" required=true %}
\`\`\`value
John
\`\`\`
{% /string-field %}
{% string-field id="notes" label="Notes" %}{% /string-field %}
{% /field-group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const progress = computeProgressSummary(parsed.schema, parsed.valuesByFieldId, []);

      expect(progress.counts.requiredFields).toBe(1);
      expect(progress.counts.emptyRequiredFields).toBe(0);
    });

    it("computes checkbox progress for checkboxes fields", () => {
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test" %}

{% field-group id="g1" %}
{% checkboxes id="tasks" label="Tasks" checkboxMode="multi" %}
- [x] Done {% #done %}
- [/] In progress {% #progress %}
- [ ] Todo {% #todo %}
{% /checkboxes %}
{% /field-group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const progress = computeProgressSummary(parsed.schema, parsed.valuesByFieldId, []);

      expect(progress.fields.tasks?.checkboxProgress).toBeDefined();
      expect(progress.fields.tasks?.checkboxProgress?.done).toBe(1);
      expect(progress.fields.tasks?.checkboxProgress?.incomplete).toBe(1);
      expect(progress.fields.tasks?.checkboxProgress?.todo).toBe(1);
    });

    it("tracks checkboxes with incomplete items as incomplete", () => {
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test" %}

{% field-group id="g1" %}
{% checkboxes id="tasks" label="Tasks" checkboxMode="multi" %}
- [x] Done {% #done %}
- [ ] Todo {% #todo %}
{% /checkboxes %}
{% /field-group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const progress = computeProgressSummary(parsed.schema, parsed.valuesByFieldId, []);

      // In multi mode, having a "todo" item means incomplete
      expect(progress.fields.tasks?.state).toBe("incomplete");
    });

    it("tracks explicit checkboxes with unfilled as incomplete", () => {
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test" %}

{% field-group id="g1" %}
{% checkboxes id="confirms" label="Confirms" checkboxMode="explicit" %}
- [y] Answered yes {% #yes %}
- [ ] Not answered {% #unfilled %}
{% /checkboxes %}
{% /field-group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const progress = computeProgressSummary(parsed.schema, parsed.valuesByFieldId, []);

      // In explicit mode, having an "unfilled" item means incomplete
      expect(progress.fields.confirms?.state).toBe("incomplete");
    });
  });

  describe("computeFormState", () => {
    it("returns empty when no fields submitted", () => {
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-field id="name" label="Name" %}{% /string-field %}
{% /field-group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const progress = computeProgressSummary(parsed.schema, parsed.valuesByFieldId, []);
      const state = computeFormState(progress);

      expect(state).toBe("complete"); // No required fields, so complete
    });

    it("returns complete when all requirements met", () => {
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-field id="name" label="Name" required=true %}
\`\`\`value
John
\`\`\`
{% /string-field %}
{% /field-group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const progress = computeProgressSummary(parsed.schema, parsed.valuesByFieldId, []);
      const state = computeFormState(progress);

      expect(state).toBe("complete");
    });

    it("returns invalid when issues present", () => {
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-field id="name" label="Name" required=true %}
\`\`\`value
X
\`\`\`
{% /string-field %}
{% /field-group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const issues: InspectIssue[] = [
        {
          ref: "name",
          scope: "field",
          reason: "validation_error",
          severity: "required",
          message: "Value too short",
          priority: 1,
        },
      ];
      const progress = computeProgressSummary(parsed.schema, parsed.valuesByFieldId, issues);
      const state = computeFormState(progress);

      expect(state).toBe("invalid");
    });

    it("returns incomplete when some required fields empty", () => {
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-field id="name" label="Name" required=true %}
\`\`\`value
John
\`\`\`
{% /string-field %}
{% string-field id="email" label="Email" required=true %}{% /string-field %}
{% /field-group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const progress = computeProgressSummary(parsed.schema, parsed.valuesByFieldId, []);
      const state = computeFormState(progress);

      // Some submitted but not all required complete
      expect(state).toBe("incomplete");
    });
  });

  describe("isFormComplete", () => {
    it("returns true when form is complete", () => {
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-field id="name" label="Name" required=true %}
\`\`\`value
John
\`\`\`
{% /string-field %}
{% /field-group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const progress = computeProgressSummary(parsed.schema, parsed.valuesByFieldId, []);

      expect(isFormComplete(progress)).toBe(true);
    });

    it("returns false when required fields missing", () => {
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-field id="name" label="Name" required=true %}{% /string-field %}
{% /field-group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const progress = computeProgressSummary(parsed.schema, parsed.valuesByFieldId, []);

      expect(isFormComplete(progress)).toBe(false);
    });

    it("returns false when issues present", () => {
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-field id="name" label="Name" %}
\`\`\`value
X
\`\`\`
{% /string-field %}
{% /field-group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const issues: InspectIssue[] = [
        {
          ref: "name",
          scope: "field",
          reason: "validation_error",
          severity: "required",
          message: "Value too short",
          priority: 1,
        },
      ];
      const progress = computeProgressSummary(parsed.schema, parsed.valuesByFieldId, issues);

      expect(isFormComplete(progress)).toBe(false);
    });
  });

  describe("skipped field progress", () => {
    it("tracks skipped fields in progress", () => {
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-field id="name" label="Name" required=true %}
\`\`\`value
John
\`\`\`
{% /string-field %}
{% string-field id="notes" label="Notes" %}{% /string-field %}
{% /field-group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const skips = { notes: { skipped: true, reason: "Not applicable" } };
      const progress = computeProgressSummary(parsed.schema, parsed.valuesByFieldId, [], skips);

      expect(progress.fields.notes?.skipped).toBe(true);
      expect(progress.fields.notes?.skipReason).toBe("Not applicable");
      expect(progress.fields.name?.skipped).toBe(false);
      expect(progress.counts.skippedFields).toBe(1);
      expect(progress.counts.answeredFields).toBe(1);
    });

    it("counts answered and skipped separately", () => {
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-field id="name" label="Name" %}
\`\`\`value
Alice
\`\`\`
{% /string-field %}
{% string-field id="email" label="Email" %}
\`\`\`value
alice@example.com
\`\`\`
{% /string-field %}
{% string-field id="notes" label="Notes" %}{% /string-field %}
{% string-field id="bio" label="Bio" %}{% /string-field %}
{% /field-group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const skips = {
        notes: { skipped: true },
        bio: { skipped: true, reason: "Too long to write" },
      };
      const progress = computeProgressSummary(parsed.schema, parsed.valuesByFieldId, [], skips);

      expect(progress.counts.totalFields).toBe(4);
      expect(progress.counts.answeredFields).toBe(2); // name and email
      expect(progress.counts.skippedFields).toBe(2); // notes and bio
    });

    it("computes all summaries with skips", () => {
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-field id="name" label="Name" required=true %}
\`\`\`value
John
\`\`\`
{% /string-field %}
{% string-field id="notes" label="Notes" %}{% /string-field %}
{% /field-group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const skips = { notes: { skipped: true } };
      const result = computeAllSummaries(parsed.schema, parsed.valuesByFieldId, [], skips);

      expect(result.progressSummary.fields.notes?.skipped).toBe(true);
      expect(result.progressSummary.counts.skippedFields).toBe(1);
      expect(result.formState).toBe("complete");
      expect(result.isComplete).toBe(true);
    });
  });

  describe("computeAllSummaries", () => {
    it("computes all summaries at once", () => {
      const markdown = `---
markform:
  markform_version: "0.1.0"
---

{% form id="test" %}

{% field-group id="g1" %}
{% string-field id="name" label="Name" required=true %}
\`\`\`value
John
\`\`\`
{% /string-field %}
{% number-field id="age" label="Age" %}{% /number-field %}
{% /field-group %}

{% /form %}
`;
      const parsed = parseForm(markdown);
      const result = computeAllSummaries(parsed.schema, parsed.valuesByFieldId, []);

      // Structure summary
      expect(result.structureSummary.fieldCount).toBe(2);
      expect(result.structureSummary.groupCount).toBe(1);

      // Progress summary
      expect(result.progressSummary.counts.totalFields).toBe(2);
      expect(result.progressSummary.counts.submittedFields).toBe(1);

      // Form state
      expect(result.formState).toBe("complete");
      expect(result.isComplete).toBe(true);
    });
  });
});
