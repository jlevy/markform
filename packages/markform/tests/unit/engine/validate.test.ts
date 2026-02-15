import { describe, expect, it } from 'vitest';

import { parseForm } from '../../../src/engine/parse.js';
import { validate } from '../../../src/engine/validate.js';
import type { ValidatorRegistry } from '../../../src/engine/coreTypes.js';

describe('engine/validate', () => {
  describe('string field validation', () => {
    it('validates required string field', () => {
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
      const form = parseForm(markdown);
      const result = validate(form);

      expect(result.isValid).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]?.severity).toBe('error');
      expect(result.issues[0]?.ref).toBe('name');
      expect(result.issues[0]?.message).toContain('empty');
    });

    it('passes when required string field has value', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="name" label="Name" required=true %}
\`\`\`value
John Doe
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const result = validate(form);

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('validates minLength constraint', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="name" label="Name" minLength=5 %}
\`\`\`value
abc
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const result = validate(form);

      expect(result.isValid).toBe(false);
      expect(result.issues[0]?.message).toContain('at least 5 characters');
    });

    it('validates maxLength constraint', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="name" label="Name" maxLength=5 %}
\`\`\`value
hello world
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const result = validate(form);

      expect(result.isValid).toBe(false);
      expect(result.issues[0]?.message).toContain('at most 5 characters');
    });

    it('validates pattern constraint', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="email" label="Email" pattern="^[^@]+@[^@]+$" %}
\`\`\`value
not-an-email
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const result = validate(form);

      expect(result.isValid).toBe(false);
      expect(result.issues[0]?.message).toContain('pattern');
    });

    it('passes when pattern matches', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="email" label="Email" pattern="^[^@]+@[^@]+$" %}
\`\`\`value
test@example.com
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const result = validate(form);

      expect(result.isValid).toBe(true);
    });
  });

  describe('number field validation', () => {
    it('validates required number field', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="number" id="age" label="Age" required=true %}{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const result = validate(form);

      expect(result.isValid).toBe(false);
      expect(result.issues[0]?.ref).toBe('age');
    });

    it('validates min constraint', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="number" id="age" label="Age" min=18 %}
\`\`\`value
15
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const result = validate(form);

      expect(result.isValid).toBe(false);
      expect(result.issues[0]?.message).toContain('at least 18');
    });

    it('validates max constraint', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="number" id="age" label="Age" max=120 %}
\`\`\`value
150
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const result = validate(form);

      expect(result.isValid).toBe(false);
      expect(result.issues[0]?.message).toContain('at most 120');
    });

    it('validates integer constraint', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="number" id="count" label="Count" integer=true %}
\`\`\`value
5.5
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const result = validate(form);

      expect(result.isValid).toBe(false);
      expect(result.issues[0]?.message).toContain('integer');
    });
  });

  describe('string-list field validation', () => {
    it('validates required string-list field', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string_list" id="tags" label="Tags" required=true %}{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const result = validate(form);

      expect(result.isValid).toBe(false);
      expect(result.issues[0]?.ref).toBe('tags');
    });

    it('validates minItems constraint', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string_list" id="tags" label="Tags" minItems=3 %}
\`\`\`value
one
two
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const result = validate(form);

      expect(result.isValid).toBe(false);
      expect(result.issues[0]?.message).toContain('at least 3 items');
    });

    it('validates maxItems constraint', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string_list" id="tags" label="Tags" maxItems=2 %}
\`\`\`value
one
two
three
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const result = validate(form);

      expect(result.isValid).toBe(false);
      expect(result.issues[0]?.message).toContain('at most 2 items');
    });

    it('validates uniqueItems constraint', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string_list" id="tags" label="Tags" uniqueItems=true %}
\`\`\`value
one
two
one
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const result = validate(form);

      expect(result.isValid).toBe(false);
      expect(result.issues[0]?.message).toContain('Duplicate');
    });
  });

  describe('single-select field validation', () => {
    it('validates required single-select field', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="single_select" id="priority" label="Priority" required=true %}
- [ ] High {% #high %}
- [ ] Medium {% #medium %}
- [ ] Low {% #low %}
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const result = validate(form);

      expect(result.isValid).toBe(false);
      expect(result.issues[0]?.ref).toBe('priority');
    });

    it('passes when single-select has selection', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="single_select" id="priority" label="Priority" required=true %}
- [x] High {% #high %}
- [ ] Medium {% #medium %}
- [ ] Low {% #low %}
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const result = validate(form);

      expect(result.isValid).toBe(true);
    });
  });

  describe('multi-select field validation', () => {
    it('validates required multi-select field', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="multi_select" id="categories" label="Categories" required=true %}
- [ ] Tech {% #tech %}
- [ ] Finance {% #finance %}
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const result = validate(form);

      expect(result.isValid).toBe(false);
    });

    it('validates minSelections constraint', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="multi_select" id="categories" label="Categories" minSelections=2 %}
- [x] Tech {% #tech %}
- [ ] Finance {% #finance %}
- [ ] Health {% #health %}
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const result = validate(form);

      expect(result.isValid).toBe(false);
      expect(result.issues[0]?.message).toContain('at least 2 selections');
    });

    it('validates maxSelections constraint', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="multi_select" id="categories" label="Categories" maxSelections=1 %}
- [x] Tech {% #tech %}
- [x] Finance {% #finance %}
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const result = validate(form);

      expect(result.isValid).toBe(false);
      expect(result.issues[0]?.message).toContain('at most 1 selections');
    });
  });

  describe('checkboxes field validation', () => {
    it('validates required checkboxes in explicit mode', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="checkboxes" id="confirms" label="Confirms" checkboxMode="explicit" required=true %}
- [y] First {% #first %}
- [ ] Second {% #second %}
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const result = validate(form);

      expect(result.isValid).toBe(false);
      expect(result.issues[0]?.message).toContain('unfilled');
    });

    it('passes when all checkboxes answered in explicit mode', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="checkboxes" id="confirms" label="Confirms" checkboxMode="explicit" required=true %}
- [y] First {% #first %}
- [n] Second {% #second %}
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const result = validate(form);

      expect(result.isValid).toBe(true);
    });

    it('validates minDone constraint', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="checkboxes" id="tasks" label="Tasks" checkboxMode="multi" minDone=2 %}
- [x] First {% #first %}
- [ ] Second {% #second %}
- [ ] Third {% #third %}
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const result = validate(form);

      expect(result.isValid).toBe(false);
      expect(result.issues[0]?.message).toContain('at least 2 items done');
    });

    it('validates minDone constraint in simple mode', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="checkboxes" id="tasks" label="Tasks" checkboxMode="simple" minDone=2 %}
- [x] First {% #first %}
- [ ] Second {% #second %}
- [ ] Third {% #third %}
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const result = validate(form);

      expect(result.isValid).toBe(false);
      expect(result.issues[0]?.message).toContain('at least 2 items done');
    });

    it('passes minDone when threshold met in simple mode', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="checkboxes" id="tasks" label="Tasks" checkboxMode="simple" minDone=2 %}
- [x] First {% #first %}
- [x] Second {% #second %}
- [ ] Third {% #third %}
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const result = validate(form);

      expect(result.isValid).toBe(true);
    });

    it('validates required multi-mode checkboxes fail when incomplete items exist', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="checkboxes" id="tasks" label="Tasks" checkboxMode="multi" required=true %}
- [x] Done task {% #done %}
- [/] Incomplete task {% #incomplete %}
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const result = validate(form);

      expect(result.isValid).toBe(false);
      expect(result.issues[0]?.message).toContain('completed');
    });

    it('passes when all required multi-mode checkboxes are done or na', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="checkboxes" id="tasks" label="Tasks" checkboxMode="multi" required=true %}
- [x] Done task {% #done %}
- [-] NA task {% #na %}
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const result = validate(form);

      expect(result.isValid).toBe(true);
    });
  });

  describe('code validators', () => {
    it('runs code validators from registry', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="name" label="Name" validate="myValidator" %}
\`\`\`value
test
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const registry: ValidatorRegistry = {
        myValidator: () => [
          {
            severity: 'error',
            message: 'Custom validation failed',
            ref: 'name',
            source: 'code',
          },
        ],
      };

      const result = validate(form, { validatorRegistry: registry });

      expect(result.isValid).toBe(false);
      expect(result.issues.some((i) => i.message === 'Custom validation failed')).toBe(true);
    });

    it('reports missing validators', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="name" label="Name" validate="missingValidator" %}
\`\`\`value
test
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const result = validate(form, { validatorRegistry: {} });

      expect(result.isValid).toBe(true); // Missing validator is "recommended" not "required"
      expect(result.issues.some((i) => i.message.includes('not found'))).toBe(true);
    });

    it('skips code validators when option set', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="string" id="name" label="Name" validate="myValidator" %}
\`\`\`value
test
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const registry: ValidatorRegistry = {
        myValidator: () => [
          {
            severity: 'error',
            message: 'Custom validation failed',
            ref: 'name',
            source: 'code',
          },
        ],
      };

      const result = validate(form, {
        validatorRegistry: registry,
        skipCodeValidators: true,
      });

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });
  });

  describe('url field validation', () => {
    it('validates required url field', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="url" id="website" label="Website" required=true %}{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const result = validate(form);

      expect(result.isValid).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]?.severity).toBe('error');
      expect(result.issues[0]?.ref).toBe('website');
      expect(result.issues[0]?.message).toContain('empty');
    });

    it('passes when required url field has valid URL', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="url" id="website" label="Website" required=true %}
\`\`\`value
https://example.com
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const result = validate(form);

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('rejects invalid URL format', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="url" id="website" label="Website" %}
\`\`\`value
not-a-valid-url
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const result = validate(form);

      expect(result.isValid).toBe(false);
      expect(result.issues[0]?.message).toContain('not a valid URL');
    });

    it('rejects non-http(s) URLs', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="url" id="website" label="Website" %}
\`\`\`value
ftp://example.com
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const result = validate(form);

      expect(result.isValid).toBe(false);
      expect(result.issues[0]?.message).toContain('not a valid URL');
    });

    it('accepts http URLs', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="url" id="website" label="Website" %}
\`\`\`value
http://example.com
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const result = validate(form);

      expect(result.isValid).toBe(true);
    });
  });

  describe('url-list field validation', () => {
    it('validates required url-list field', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="url_list" id="sources" label="Sources" required=true %}{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const result = validate(form);

      expect(result.isValid).toBe(false);
      expect(result.issues[0]?.ref).toBe('sources');
    });

    it('validates minItems constraint', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="url_list" id="sources" label="Sources" minItems=3 %}
\`\`\`value
https://example.com
https://another.com
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const result = validate(form);

      expect(result.isValid).toBe(false);
      expect(result.issues[0]?.message).toContain('at least 3 items');
    });

    it('validates maxItems constraint', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="url_list" id="sources" label="Sources" maxItems=2 %}
\`\`\`value
https://example.com
https://another.com
https://third.com
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const result = validate(form);

      expect(result.isValid).toBe(false);
      expect(result.issues[0]?.message).toContain('at most 2 items');
    });

    it('validates uniqueItems constraint', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="url_list" id="sources" label="Sources" uniqueItems=true %}
\`\`\`value
https://example.com
https://another.com
https://example.com
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const result = validate(form);

      expect(result.isValid).toBe(false);
      expect(result.issues[0]?.message).toContain('Duplicate URL');
    });

    it('validates each URL in the list', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="url_list" id="sources" label="Sources" %}
\`\`\`value
https://valid.com
not-a-url
https://also-valid.com
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const result = validate(form);

      expect(result.isValid).toBe(false);
      expect(result.issues[0]?.message).toContain('Item 2');
      expect(result.issues[0]?.message).toContain('not a valid URL');
    });

    it('passes with valid URL list', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="url_list" id="sources" label="Sources" %}
\`\`\`value
https://example.com
https://another.com
http://third.com
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const result = validate(form);

      expect(result.isValid).toBe(true);
    });
  });

  describe('complete form validation', () => {
    it('validates a form with multiple field kinds', () => {
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
{% field kind="number" id="age" label="Age" required=true min=0 max=150 %}
\`\`\`value
25
\`\`\`
{% /field %}
{% field kind="single_select" id="priority" label="Priority" required=true %}
- [x] High {% #high %}
- [ ] Low {% #low %}
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const result = validate(form);

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });
  });

  describe('date field validation', () => {
    it('validates required date field', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="date" id="birthday" label="Birthday" required=true %}{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const result = validate(form);

      expect(result.isValid).toBe(false);
      expect(result.issues[0]?.ref).toBe('birthday');
      expect(result.issues[0]?.message).toContain('empty');
    });

    it('passes when required date field has valid value', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="date" id="birthday" label="Birthday" required=true %}
\`\`\`value
1990-05-15
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const result = validate(form);

      expect(result.isValid).toBe(true);
    });

    it('rejects invalid date format', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="date" id="birthday" label="Birthday" %}
\`\`\`value
15/05/1990
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const result = validate(form);

      expect(result.isValid).toBe(false);
      expect(result.issues[0]?.message).toContain('not a valid date');
    });

    it('rejects invalid date like Feb 30', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="date" id="date" label="Date" %}
\`\`\`value
2024-02-30
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const result = validate(form);

      expect(result.isValid).toBe(false);
      expect(result.issues[0]?.message).toContain('not a valid date');
    });

    it('validates min date constraint', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="date" id="start" label="Start Date" min="2024-01-01" %}
\`\`\`value
2023-12-31
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const result = validate(form);

      expect(result.isValid).toBe(false);
      expect(result.issues[0]?.message).toContain('on or after 2024-01-01');
    });

    it('validates max date constraint', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="date" id="end" label="End Date" max="2024-12-31" %}
\`\`\`value
2025-01-01
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const result = validate(form);

      expect(result.isValid).toBe(false);
      expect(result.issues[0]?.message).toContain('on or before 2024-12-31');
    });

    it('passes when date is within min/max range', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="date" id="date" label="Date" min="2024-01-01" max="2024-12-31" %}
\`\`\`value
2024-06-15
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const result = validate(form);

      expect(result.isValid).toBe(true);
    });
  });

  describe('year field validation', () => {
    it('validates required year field', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="year" id="grad_year" label="Graduation Year" required=true %}{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const result = validate(form);

      expect(result.isValid).toBe(false);
      expect(result.issues[0]?.ref).toBe('grad_year');
    });

    it('validates min year constraint', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="year" id="year" label="Year" min=2000 %}
\`\`\`value
1999
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const result = validate(form);

      expect(result.isValid).toBe(false);
      expect(result.issues[0]?.message).toContain('at least 2000');
    });

    it('validates max year constraint', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="year" id="year" label="Year" max=2030 %}
\`\`\`value
2031
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const result = validate(form);

      expect(result.isValid).toBe(false);
      expect(result.issues[0]?.message).toContain('at most 2030');
    });

    it('passes when year is within min/max range', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="year" id="year" label="Year" min=2000 max=2030 %}
\`\`\`value
2020
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const result = validate(form);

      expect(result.isValid).toBe(true);
    });
  });

  describe('table field validation', () => {
    it('validates required table field', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="table" id="contacts" label="Contacts" columnIds=["name", "email"] required=true %}
| Name | Email |
|------|-------|
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const result = validate(form);

      expect(result.isValid).toBe(false);
      expect(result.issues[0]?.ref).toBe('contacts');
      // Required table with no rows shows "is empty" message
      expect(result.issues[0]?.message).toContain('empty');
    });

    it('validates minRows constraint', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="table" id="contacts" label="Contacts" columnIds=["name", "email"] minRows=2 %}
| Name | Email |
|------|-------|
| John | john@test.com |
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const result = validate(form);

      expect(result.isValid).toBe(false);
      // Message uses "(s)" for plural
      expect(result.issues[0]?.message).toContain('at least 2 row');
    });

    it('validates maxRows constraint', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="table" id="contacts" label="Contacts" columnIds=["name", "email"] maxRows=1 %}
| Name | Email |
|------|-------|
| John | john@test.com |
| Jane | jane@test.com |
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const result = validate(form);

      expect(result.isValid).toBe(false);
      // Message uses "(s)" for plural
      expect(result.issues[0]?.message).toContain('at most 1 row');
    });

    it('passes validation for valid table data', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="table" id="contacts" label="Contacts" columnIds=["name", "email"] %}
| Name | Email |
|------|-------|
| John | john@test.com |
| Jane | jane@test.com |
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const result = validate(form);

      expect(result.isValid).toBe(true);
    });

    it('validates URL columns with bare URLs', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="table" id="sources" label="Sources" columnIds=["name", "url"] columnTypes=["string", "url"] %}
| name | url |
|------|-----|
| Example | https://example.com |
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const result = validate(form);

      expect(result.isValid).toBe(true);
    });

    it('validates URL columns with markdown link format', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="table" id="sources" label="Sources" columnIds=["name", "url"] columnTypes=["string", "url"] %}
| name | url |
|------|-----|
| SEC Filing | [sec.gov/Archives/edg…](https://www.sec.gov/Archives/edgar/data/1326801) |
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const result = validate(form);

      // Should pass - the URL is extracted from the markdown link
      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('rejects invalid URLs in URL columns', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" %}
{% field kind="table" id="sources" label="Sources" columnIds=["name", "url"] columnTypes=["string", "url"] %}
| name | url |
|------|-----|
| Invalid | not-a-valid-url |
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const result = validate(form);

      expect(result.isValid).toBe(false);
      expect(result.issues[0]?.message).toContain('must be a valid URL');
    });
  });

  describe('group validators', () => {
    it('runs group-level validators from registry', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" validate="groupCheck" %}
{% field kind="number" id="min" label="Min" %}
\`\`\`value
10
\`\`\`
{% /field %}
{% field kind="number" id="max" label="Max" %}
\`\`\`value
5
\`\`\`
{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const registry: ValidatorRegistry = {
        groupCheck: (ctx) => {
          const min = ctx.values.min as { kind: 'number'; value: number } | undefined;
          const max = ctx.values.max as { kind: 'number'; value: number } | undefined;
          if (min && max && min.value > max.value) {
            return [
              {
                severity: 'error',
                message: 'Min must be less than max',
                ref: ctx.targetId,
                source: 'code',
              },
            ];
          }
          return [];
        },
      };

      const result = validate(form, { validatorRegistry: registry });

      expect(result.isValid).toBe(false);
      expect(result.issues.some((i) => i.message === 'Min must be less than max')).toBe(true);
    });

    it('reports missing group validators', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" validate="missingGroupValidator" %}
{% field kind="string" id="name" label="Name" %}{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const result = validate(form, { validatorRegistry: {} });

      expect(result.issues.some((i) => i.message.includes('not found'))).toBe(true);
      expect(result.issues.some((i) => i.message.includes('missingGroupValidator'))).toBe(true);
    });

    it('handles validator that throws error', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" validate="throwingValidator" %}
{% field kind="string" id="name" label="Name" %}{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const registry: ValidatorRegistry = {
        throwingValidator: () => {
          throw new Error('Validator crashed');
        },
      };

      const result = validate(form, { validatorRegistry: registry });

      expect(result.issues.some((i) => i.message.includes('threw an error'))).toBe(true);
      expect(result.issues.some((i) => i.message.includes('Validator crashed'))).toBe(true);
    });

    it('supports multiple validators on a group', () => {
      const markdown = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}

{% group id="g1" validate=["validator1", "validator2"] %}
{% field kind="string" id="name" label="Name" %}{% /field %}
{% /group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const registry: ValidatorRegistry = {
        validator1: () => [
          { severity: 'warning', message: 'From validator1', ref: 'g1', source: 'code' },
        ],
        validator2: () => [
          { severity: 'warning', message: 'From validator2', ref: 'g1', source: 'code' },
        ],
      };

      const result = validate(form, { validatorRegistry: registry });

      expect(result.issues.some((i) => i.message === 'From validator1')).toBe(true);
      expect(result.issues.some((i) => i.message === 'From validator2')).toBe(true);
    });
  });
});
