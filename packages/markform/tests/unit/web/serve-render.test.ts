/**
 * Tests for serve command HTML rendering.
 *
 * These tests verify that the web UI renders proper interactive HTML form elements
 * for all field types, allowing users to edit and save forms.
 */

import { describe, it, expect } from 'vitest';

import { parseForm } from '../../../src/engine/parse.js';
import { renderFormHtml, escapeHtml } from '../../../src/cli/commands/serve.js';

// Helper to check if HTML contains an element with attributes (unused but kept for future use)
// function hasElement(
//   html: string,
//   tag: string,
//   attrs: Record<string, string | RegExp>
// ): boolean {
//   // Build a regex pattern for the element
//   const attrPatterns = Object.entries(attrs)
//     .map(([key, value]) => {
//       if (value instanceof RegExp) {
//         return `${key}="[^"]*"`;
//       }
//       return `${key}="${value}"`;
//     })
//     .join("[^>]*");
//   const pattern = new RegExp(`<${tag}[^>]*${attrPatterns}[^>]*>`);
//   return pattern.test(html);
// }

// Helper to extract attribute value (unused but kept for future use)
// function getAttrValue(html: string, tag: string, attr: string): string | null {
//   const pattern = new RegExp(`<${tag}[^>]*${attr}="([^"]*)"[^>]*>`);
//   const match = pattern.exec(html);
//   return match ? match[1] : null;
// }

describe('serve HTML rendering', () => {
  describe('escapeHtml', () => {
    it('should escape HTML special characters', () => {
      expect(escapeHtml("<script>alert('xss')</script>")).toBe(
        '&lt;script&gt;alert(&#039;xss&#039;)&lt;/script&gt;',
      );
      expect(escapeHtml('a & b "quoted"')).toBe('a &amp; b &quot;quoted&quot;');
    });
  });

  describe('string field rendering', () => {
    const formContent = `---
markform:
  spec: MF/0.1
---
{% form id="test" %}
{% field-group id="group1" title="Group 1" %}
{% string-field id="name" label="Name" required=true %}{% /string-field %}
{% /field-group %}
{% /form %}`;

    it('should render string field as text input', () => {
      const form = parseForm(formContent);
      const html = renderFormHtml(form);

      // Should have an input element
      expect(html).toContain('<input');
      expect(html).toContain('type="text"');
      expect(html).toContain('name="name"');
      expect(html).toContain('id="field-name"');
    });

    it('should mark required fields', () => {
      const form = parseForm(formContent);
      const html = renderFormHtml(form);

      expect(html).toContain('required');
    });
  });

  describe('number field rendering', () => {
    const formContent = `---
markform:
  spec: MF/0.1
---
{% form id="test" %}
{% field-group id="group1" title="Group 1" %}
{% number-field id="age" label="Age" required=true min=0 max=150 integer=true %}{% /number-field %}
{% /field-group %}
{% /form %}`;

    it('should render number field as number input', () => {
      const form = parseForm(formContent);
      const html = renderFormHtml(form);

      expect(html).toContain('<input');
      expect(html).toContain('type="number"');
      expect(html).toContain('name="age"');
    });

    it('should include min/max constraints', () => {
      const form = parseForm(formContent);
      const html = renderFormHtml(form);

      expect(html).toContain('min="0"');
      expect(html).toContain('max="150"');
    });

    it('should use step=1 for integer fields', () => {
      const form = parseForm(formContent);
      const html = renderFormHtml(form);

      expect(html).toContain('step="1"');
    });
  });

  describe('string_list field rendering', () => {
    const formContent = `---
markform:
  spec: MF/0.1
---
{% form id="test" %}
{% field-group id="group1" title="Group 1" %}
{% string-list id="tags" label="Tags" required=true %}{% /string-list %}
{% /field-group %}
{% /form %}`;

    it('should render string_list as textarea', () => {
      const form = parseForm(formContent);
      const html = renderFormHtml(form);

      expect(html).toContain('<textarea');
      expect(html).toContain('name="tags"');
    });

    it('should include placeholder explaining format', () => {
      const form = parseForm(formContent);
      const html = renderFormHtml(form);

      expect(html).toMatch(/placeholder="[^"]*one.*line/i);
    });
  });

  describe('single_select field rendering', () => {
    const formContent = `---
markform:
  spec: MF/0.1
---
{% form id="test" %}
{% field-group id="group1" title="Group 1" %}
{% single-select id="priority" label="Priority" required=true %}
- [ ] Low {% #low %}
- [ ] Medium {% #medium %}
- [ ] High {% #high %}
{% /single-select %}
{% /field-group %}
{% /form %}`;

    it('should render single_select as select element', () => {
      const form = parseForm(formContent);
      const html = renderFormHtml(form);

      expect(html).toContain('<select');
      expect(html).toContain('name="priority"');
    });

    it('should include all options', () => {
      const form = parseForm(formContent);
      const html = renderFormHtml(form);

      expect(html).toContain('<option');
      expect(html).toContain('value="low"');
      expect(html).toContain('value="medium"');
      expect(html).toContain('value="high"');
      expect(html).toContain('>Low</option>');
      expect(html).toContain('>Medium</option>');
      expect(html).toContain('>High</option>');
    });

    it('should include empty option for unselected state', () => {
      const form = parseForm(formContent);
      const html = renderFormHtml(form);

      // First option should be empty/placeholder
      expect(html).toMatch(/<option[^>]*value=""[^>]*>/);
    });
  });

  describe('multi_select field rendering', () => {
    const formContent = `---
markform:
  spec: MF/0.1
---
{% form id="test" %}
{% field-group id="group1" title="Group 1" %}
{% multi-select id="categories" label="Categories" required=true %}
- [ ] Frontend {% #frontend %}
- [ ] Backend {% #backend %}
- [ ] Database {% #database %}
{% /multi-select %}
{% /field-group %}
{% /form %}`;

    it('should render multi_select as checkboxes', () => {
      const form = parseForm(formContent);
      const html = renderFormHtml(form);

      expect(html).toContain('<input');
      expect(html).toContain('type="checkbox"');
    });

    it('should include all options as checkboxes', () => {
      const form = parseForm(formContent);
      const html = renderFormHtml(form);

      expect(html).toContain('name="categories"');
      expect(html).toContain('value="frontend"');
      expect(html).toContain('value="backend"');
      expect(html).toContain('value="database"');
    });

    it('should have labels for each checkbox', () => {
      const form = parseForm(formContent);
      const html = renderFormHtml(form);

      expect(html).toContain('>Frontend</label>');
      expect(html).toContain('>Backend</label>');
      expect(html).toContain('>Database</label>');
    });
  });

  describe('checkboxes field rendering (simple mode)', () => {
    const formContent = `---
markform:
  spec: MF/0.1
---
{% form id="test" %}
{% field-group id="group1" title="Group 1" %}
{% checkboxes id="agreements" label="Agreements" checkboxMode="simple" required=true %}
- [ ] I agree {% #agree %}
- [ ] I confirm {% #confirm %}
{% /checkboxes %}
{% /field-group %}
{% /form %}`;

    it('should render simple checkboxes as HTML checkboxes', () => {
      const form = parseForm(formContent);
      const html = renderFormHtml(form);

      expect(html).toContain('<input');
      expect(html).toContain('type="checkbox"');
      expect(html).toContain('name="agreements"');
    });

    it('should include all options', () => {
      const form = parseForm(formContent);
      const html = renderFormHtml(form);

      expect(html).toContain('value="agree"');
      expect(html).toContain('value="confirm"');
    });
  });

  describe('checkboxes field rendering (multi mode)', () => {
    const formContent = `---
markform:
  spec: MF/0.1
---
{% form id="test" %}
{% field-group id="group1" title="Group 1" %}
{% checkboxes id="tasks" label="Tasks" checkboxMode="multi" required=true %}
- [ ] Research {% #research %}
- [ ] Design {% #design %}
{% /checkboxes %}
{% /field-group %}
{% /form %}`;

    it('should render multi checkboxes as select elements', () => {
      const form = parseForm(formContent);
      const html = renderFormHtml(form);

      // Multi-mode checkboxes have multiple states, so use select
      expect(html).toContain('<select');
      expect(html).toContain('name="tasks.research"');
      expect(html).toContain('name="tasks.design"');
    });

    it('should include all state options', () => {
      const form = parseForm(formContent);
      const html = renderFormHtml(form);

      // Multi mode states: todo, active, done, incomplete, na
      expect(html).toContain('value="todo"');
      expect(html).toContain('value="done"');
      expect(html).toContain('value="active"');
      expect(html).toContain('value="incomplete"');
      expect(html).toContain('value="na"');
    });
  });

  describe('checkboxes field rendering (explicit mode)', () => {
    const formContent = `---
markform:
  spec: MF/0.1
---
{% form id="test" %}
{% field-group id="group1" title="Group 1" %}
{% checkboxes id="confirmations" label="Confirmations" checkboxMode="explicit" required=true %}
- [ ] Backed up {% #backed_up %}
- [ ] Notified {% #notified %}
{% /checkboxes %}
{% /field-group %}
{% /form %}`;

    it('should render explicit checkboxes as select elements', () => {
      const form = parseForm(formContent);
      const html = renderFormHtml(form);

      // Explicit mode has yes/no/unfilled states
      expect(html).toContain('<select');
      expect(html).toContain('name="confirmations.backed_up"');
      expect(html).toContain('name="confirmations.notified"');
    });

    it('should include yes/no/unfilled options', () => {
      const form = parseForm(formContent);
      const html = renderFormHtml(form);

      expect(html).toContain('value="yes"');
      expect(html).toContain('value="no"');
      expect(html).toContain('value="unfilled"');
    });
  });

  describe('form structure', () => {
    const formContent = `---
markform:
  spec: MF/0.1
---
{% form id="test" title="Test Form" %}
{% field-group id="group1" title="Group 1" %}
{% string-field id="name" label="Name" %}{% /string-field %}
{% /field-group %}
{% /form %}`;

    it('should wrap form in a form element with POST method', () => {
      const form = parseForm(formContent);
      const html = renderFormHtml(form);

      expect(html).toContain('<form');
      expect(html).toContain('method="POST"');
      expect(html).toContain('action="/save"');
    });

    it('should include form title', () => {
      const form = parseForm(formContent);
      const html = renderFormHtml(form);

      expect(html).toContain('Test Form');
    });

    it('should include save button of type submit', () => {
      const form = parseForm(formContent);
      const html = renderFormHtml(form);

      expect(html).toContain('type="submit"');
      expect(html).toMatch(/Save/i);
    });
  });

  describe('pre-filled values', () => {
    // Note: String and number values use ```value fence blocks, not inline text
    const formContent = `---
markform:
  spec: MF/0.1
---
{% form id="test" %}
{% field-group id="group1" title="Group 1" %}
{% string-field id="name" label="Name" %}
\`\`\`value
John Doe
\`\`\`
{% /string-field %}
{% number-field id="age" label="Age" %}
\`\`\`value
30
\`\`\`
{% /number-field %}
{% single-select id="priority" label="Priority" %}
- [x] Low {% #low %}
- [ ] Medium {% #medium %}
- [ ] High {% #high %}
{% /single-select %}
{% /field-group %}
{% /form %}`;

    it('should pre-fill string value', () => {
      const form = parseForm(formContent);
      const html = renderFormHtml(form);

      expect(html).toContain('value="John Doe"');
    });

    it('should pre-fill number value', () => {
      const form = parseForm(formContent);
      const html = renderFormHtml(form);

      expect(html).toContain('value="30"');
    });

    it('should pre-select single_select option', () => {
      const form = parseForm(formContent);
      const html = renderFormHtml(form);

      // The selected option should have 'selected' attribute
      expect(html).toMatch(/<option[^>]*value="low"[^>]*selected[^>]*>/);
    });
  });

  describe('url field rendering', () => {
    const formContent = `---
markform:
  spec: MF/0.1
---
{% form id="test" %}
{% field-group id="group1" title="Group 1" %}
{% url-field id="website" label="Website" required=true %}{% /url-field %}
{% /field-group %}
{% /form %}`;

    it('should render url field as url input', () => {
      const form = parseForm(formContent);
      const html = renderFormHtml(form);

      expect(html).toContain('<input');
      expect(html).toContain('type="url"');
      expect(html).toContain('name="website"');
      expect(html).toContain('id="field-website"');
    });

    it('should include placeholder for url format', () => {
      const form = parseForm(formContent);
      const html = renderFormHtml(form);

      expect(html).toContain('placeholder="https://example.com"');
    });

    it('should mark required url fields', () => {
      const form = parseForm(formContent);
      const html = renderFormHtml(form);

      expect(html).toContain('required');
    });

    it('should show type badge as url', () => {
      const form = parseForm(formContent);
      const html = renderFormHtml(form);

      expect(html).toContain('type-badge">url</span>');
    });
  });

  describe('url_list field rendering', () => {
    const formContent = `---
markform:
  spec: MF/0.1
---
{% form id="test" %}
{% field-group id="group1" title="Group 1" %}
{% url-list id="references" label="References" required=true %}{% /url-list %}
{% /field-group %}
{% /form %}`;

    it('should render url_list as textarea', () => {
      const form = parseForm(formContent);
      const html = renderFormHtml(form);

      expect(html).toContain('<textarea');
      expect(html).toContain('name="references"');
    });

    it('should include placeholder explaining format', () => {
      const form = parseForm(formContent);
      const html = renderFormHtml(form);

      expect(html).toMatch(/placeholder="[^"]*URL.*line/i);
    });

    it('should show type badge as url_list', () => {
      const form = parseForm(formContent);
      const html = renderFormHtml(form);

      expect(html).toContain('type-badge">url_list</span>');
    });
  });

  describe('url pre-filled values', () => {
    const formContent = `---
markform:
  spec: MF/0.1
---
{% form id="test" %}
{% field-group id="group1" title="Group 1" %}
{% url-field id="website" label="Website" %}
\`\`\`value
https://example.com
\`\`\`
{% /url-field %}
{% url-list id="references" label="References" %}
\`\`\`value
https://example1.com
https://example2.com
\`\`\`
{% /url-list %}
{% /field-group %}
{% /form %}`;

    it('should pre-fill url value', () => {
      const form = parseForm(formContent);
      const html = renderFormHtml(form);

      expect(html).toContain('value="https://example.com"');
    });

    it('should pre-fill url_list values', () => {
      const form = parseForm(formContent);
      const html = renderFormHtml(form);

      expect(html).toContain('https://example1.com');
      expect(html).toContain('https://example2.com');
    });
  });

  describe('skip_field support', () => {
    describe('optional fields', () => {
      const formContent = `---
markform:
  spec: MF/0.1
---
{% form id="test" %}
{% field-group id="group1" title="Group 1" %}
{% string-field id="notes" label="Notes" required=false %}{% /string-field %}
{% number-field id="score" label="Score" required=false %}{% /number-field %}
{% /field-group %}
{% /form %}`;

      it('should render skip button for optional string field', () => {
        const form = parseForm(formContent);
        const html = renderFormHtml(form);

        // Should have a skip button with data-skip-field attribute
        expect(html).toContain('data-skip-field="notes"');
        expect(html).toMatch(/Skip/i);
      });

      it('should render skip button for optional number field', () => {
        const form = parseForm(formContent);
        const html = renderFormHtml(form);

        expect(html).toContain('data-skip-field="score"');
      });
    });

    describe('required fields', () => {
      const formContent = `---
markform:
  spec: MF/0.1
---
{% form id="test" %}
{% field-group id="group1" title="Group 1" %}
{% string-field id="name" label="Name" required=true %}{% /string-field %}
{% /field-group %}
{% /form %}`;

      it('should not render skip button for required fields', () => {
        const form = parseForm(formContent);
        const html = renderFormHtml(form);

        // Should NOT have a skip button for required fields
        expect(html).not.toContain('data-skip-field="name"');
      });
    });

    describe('skipped state display', () => {
      const formContent = `---
markform:
  spec: MF/0.1
---
{% form id="test" %}
{% field-group id="group1" title="Group 1" %}
{% string-field id="notes" label="Notes" required=false %}{% /string-field %}
{% /field-group %}
{% /form %}`;

      it('should show skipped indicator for previously skipped fields', () => {
        const form = parseForm(formContent);
        // Mark the field as skipped
        form.responsesByFieldId = {
          notes: { state: 'skipped' },
        };
        const html = renderFormHtml(form);

        // Should show a visual indicator that field is skipped
        expect(html).toMatch(/skipped/i);
        expect(html).toContain('disabled');
      });
    });
  });

  describe('field type coverage', () => {
    // This test ensures ALL field types defined in FieldKind are handled by the web renderer.
    // If a new field type is added to coreTypes.ts but not to serve.ts, this test will fail.

    // Form that includes ALL field types
    const allFieldTypesForm = `---
markform:
  spec: MF/0.1
---
{% form id="all_types" %}
{% field-group id="g1" title="All Field Types" %}
{% string-field id="f_string" label="String Field" %}{% /string-field %}
{% number-field id="f_number" label="Number Field" %}{% /number-field %}
{% string-list id="f_string_list" label="String List" %}{% /string-list %}
{% single-select id="f_single_select" label="Single Select" %}
- [ ] Option A {% #a %}
- [ ] Option B {% #b %}
{% /single-select %}
{% multi-select id="f_multi_select" label="Multi Select" %}
- [ ] Option A {% #a %}
- [ ] Option B {% #b %}
{% /multi-select %}
{% checkboxes id="f_checkboxes" label="Checkboxes" checkboxMode="simple" %}
- [ ] Item A {% #a %}
- [ ] Item B {% #b %}
{% /checkboxes %}
{% url-field id="f_url" label="URL Field" %}{% /url-field %}
{% url-list id="f_url_list" label="URL List" %}{% /url-list %}
{% /field-group %}
{% /form %}`;

    it('should not have any unknown field types in output', () => {
      const form = parseForm(allFieldTypesForm);
      const html = renderFormHtml(form);

      // The "(unknown field type)" message indicates a field type wasn't handled
      expect(html).not.toContain('unknown field type');
    });

    it('should show correct type badges for all field types', () => {
      const form = parseForm(allFieldTypesForm);
      const html = renderFormHtml(form);

      // Verify each field type badge is present
      expect(html).toContain('type-badge">string</span>');
      expect(html).toContain('type-badge">number</span>');
      expect(html).toContain('type-badge">string_list</span>');
      expect(html).toContain('type-badge">single_select</span>');
      expect(html).toContain('type-badge">multi_select</span>');
      expect(html).toContain('type-badge">checkboxes</span>');
      expect(html).toContain('type-badge">url</span>');
      expect(html).toContain('type-badge">url_list</span>');
    });

    it('should render appropriate input elements for all field types', () => {
      const form = parseForm(allFieldTypesForm);
      const html = renderFormHtml(form);

      // string -> text input
      expect(html).toContain('type="text"');
      expect(html).toContain('name="f_string"');

      // number -> number input
      expect(html).toContain('type="number"');
      expect(html).toContain('name="f_number"');

      // string_list -> textarea
      expect(html).toContain('name="f_string_list"');
      expect(html).toMatch(/<textarea[^>]*name="f_string_list"/);

      // single_select -> select
      expect(html).toMatch(/<select[^>]*name="f_single_select"/);

      // multi_select -> checkboxes
      expect(html).toContain('name="f_multi_select"');

      // checkboxes -> checkboxes (simple mode)
      expect(html).toContain('name="f_checkboxes"');

      // url -> url input
      expect(html).toContain('type="url"');
      expect(html).toContain('name="f_url"');

      // url_list -> textarea
      expect(html).toMatch(/<textarea[^>]*name="f_url_list"/);
    });
  });
});
