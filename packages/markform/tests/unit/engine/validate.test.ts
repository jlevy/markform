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

{% field-group id="g1" %}
{% field kind="string" id="name" label="Name" required=true %}{% /field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% field kind="string" id="name" label="Name" required=true %}
\`\`\`value
John Doe
\`\`\`
{% /field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% field kind="string" id="name" label="Name" minLength=5 %}
\`\`\`value
abc
\`\`\`
{% /field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% field kind="string" id="name" label="Name" maxLength=5 %}
\`\`\`value
hello world
\`\`\`
{% /field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% field kind="string" id="email" label="Email" pattern="^[^@]+@[^@]+$" %}
\`\`\`value
not-an-email
\`\`\`
{% /field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% field kind="string" id="email" label="Email" pattern="^[^@]+@[^@]+$" %}
\`\`\`value
test@example.com
\`\`\`
{% /field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% field kind="number" id="age" label="Age" required=true %}{% /field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% field kind="number" id="age" label="Age" min=18 %}
\`\`\`value
15
\`\`\`
{% /field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% field kind="number" id="age" label="Age" max=120 %}
\`\`\`value
150
\`\`\`
{% /field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% field kind="number" id="count" label="Count" integer=true %}
\`\`\`value
5.5
\`\`\`
{% /field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% field kind="string_list" id="tags" label="Tags" required=true %}{% /field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% field kind="string_list" id="tags" label="Tags" minItems=3 %}
\`\`\`value
one
two
\`\`\`
{% /field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% field kind="string_list" id="tags" label="Tags" maxItems=2 %}
\`\`\`value
one
two
three
\`\`\`
{% /field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% field kind="string_list" id="tags" label="Tags" uniqueItems=true %}
\`\`\`value
one
two
one
\`\`\`
{% /field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% field kind="single_select" id="priority" label="Priority" required=true %}
- [ ] High {% #high %}
- [ ] Medium {% #medium %}
- [ ] Low {% #low %}
{% /field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% field kind="single_select" id="priority" label="Priority" required=true %}
- [x] High {% #high %}
- [ ] Medium {% #medium %}
- [ ] Low {% #low %}
{% /field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% field kind="multi_select" id="categories" label="Categories" required=true %}
- [ ] Tech {% #tech %}
- [ ] Finance {% #finance %}
{% /field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% field kind="multi_select" id="categories" label="Categories" minSelections=2 %}
- [x] Tech {% #tech %}
- [ ] Finance {% #finance %}
- [ ] Health {% #health %}
{% /field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% field kind="multi_select" id="categories" label="Categories" maxSelections=1 %}
- [x] Tech {% #tech %}
- [x] Finance {% #finance %}
{% /field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% field kind="checkboxes" id="confirms" label="Confirms" checkboxMode="explicit" required=true %}
- [y] First {% #first %}
- [ ] Second {% #second %}
{% /field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% field kind="checkboxes" id="confirms" label="Confirms" checkboxMode="explicit" required=true %}
- [y] First {% #first %}
- [n] Second {% #second %}
{% /field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% field kind="checkboxes" id="tasks" label="Tasks" checkboxMode="multi" minDone=2 %}
- [x] First {% #first %}
- [ ] Second {% #second %}
- [ ] Third {% #third %}
{% /field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% field kind="checkboxes" id="tasks" label="Tasks" checkboxMode="simple" minDone=2 %}
- [x] First {% #first %}
- [ ] Second {% #second %}
- [ ] Third {% #third %}
{% /field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% field kind="checkboxes" id="tasks" label="Tasks" checkboxMode="simple" minDone=2 %}
- [x] First {% #first %}
- [x] Second {% #second %}
- [ ] Third {% #third %}
{% /field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% field kind="checkboxes" id="tasks" label="Tasks" checkboxMode="multi" required=true %}
- [x] Done task {% #done %}
- [/] Incomplete task {% #incomplete %}
{% /field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% field kind="checkboxes" id="tasks" label="Tasks" checkboxMode="multi" required=true %}
- [x] Done task {% #done %}
- [-] NA task {% #na %}
{% /field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% field kind="string" id="name" label="Name" validate="myValidator" %}
\`\`\`value
test
\`\`\`
{% /field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% field kind="string" id="name" label="Name" validate="missingValidator" %}
\`\`\`value
test
\`\`\`
{% /field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% field kind="string" id="name" label="Name" validate="myValidator" %}
\`\`\`value
test
\`\`\`
{% /field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% field kind="url" id="website" label="Website" required=true %}{% /field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% field kind="url" id="website" label="Website" required=true %}
\`\`\`value
https://example.com
\`\`\`
{% /field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% field kind="url" id="website" label="Website" %}
\`\`\`value
not-a-valid-url
\`\`\`
{% /field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% field kind="url" id="website" label="Website" %}
\`\`\`value
ftp://example.com
\`\`\`
{% /field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% field kind="url" id="website" label="Website" %}
\`\`\`value
http://example.com
\`\`\`
{% /field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% field kind="url_list" id="sources" label="Sources" required=true %}{% /field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% field kind="url_list" id="sources" label="Sources" minItems=3 %}
\`\`\`value
https://example.com
https://another.com
\`\`\`
{% /field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% field kind="url_list" id="sources" label="Sources" maxItems=2 %}
\`\`\`value
https://example.com
https://another.com
https://third.com
\`\`\`
{% /field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% field kind="url_list" id="sources" label="Sources" uniqueItems=true %}
\`\`\`value
https://example.com
https://another.com
https://example.com
\`\`\`
{% /field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% field kind="url_list" id="sources" label="Sources" %}
\`\`\`value
https://valid.com
not-a-url
https://also-valid.com
\`\`\`
{% /field %}
{% /field-group %}

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

{% field-group id="g1" %}
{% field kind="url_list" id="sources" label="Sources" %}
\`\`\`value
https://example.com
https://another.com
http://third.com
\`\`\`
{% /field %}
{% /field-group %}

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

{% field-group id="g1" %}
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
{% /field-group %}

{% /form %}
`;
      const form = parseForm(markdown);
      const result = validate(form);

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });
  });
});
