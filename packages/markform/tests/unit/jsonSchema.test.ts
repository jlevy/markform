import { describe, expect, it } from 'vitest';

import type { Field, ParsedForm } from '../../src/engine/coreTypes.js';
import { parseForm } from '../../src/engine/parse.js';
import { fieldToJsonSchema, formToJsonSchema } from '../../src/engine/jsonSchema.js';

/** Helper to get a field from a parsed form by group and field index. */
function getField(form: ParsedForm, groupIndex: number, fieldIndex: number): Field {
  const group = form.schema.groups[groupIndex];
  if (!group) throw new Error(`Group ${groupIndex} not found`);
  const field = group.children[fieldIndex];
  if (!field) throw new Error(`Field ${fieldIndex} not found in group ${groupIndex}`);
  return field;
}

// Test form with all field kinds
const TEST_FORM_MD = `---
markform:
  spec: MF/0.1
  title: Test Form
  roles:
    - user
    - agent
  role_instructions:
    user: Fill in user fields
    agent: Fill in agent fields
---

{% form id="test_form" title="Test Form" %}

{% description ref="test_form" %}
A comprehensive test form for JSON Schema export.
{% /description %}

{% group id="text_fields" title="Text Fields" %}

{% field kind="string" id="name" label="Name" role="user" required=true minLength=2 maxLength=50 placeholder="Enter name" examples=["John", "Jane"] %}{% /field %}

{% description ref="name" %}
Enter your full name.
{% /description %}

{% field kind="string" id="email" label="Email" role="user" required=true pattern="^[^@]+@[^@]+\\\\.[^@]+$" %}{% /field %}

{% field kind="number" id="age" label="Age" role="user" required=true min=0 max=150 integer=true %}{% /field %}

{% field kind="number" id="score" label="Score" role="agent" min=0.0 max=100.0 priority="high" %}{% /field %}

{% /group %}

{% group id="list_fields" title="List Fields" %}

{% field kind="string_list" id="tags" label="Tags" role="user" minItems=1 maxItems=5 itemMinLength=2 itemMaxLength=20 uniqueItems=true %}{% /field %}

{% field kind="url_list" id="links" label="Links" role="agent" minItems=0 maxItems=10 uniqueItems=true %}{% /field %}

{% /group %}

{% group id="select_fields" title="Selection Fields" %}

{% field kind="single_select" id="priority" label="Priority" role="user" required=true %}
- [ ] Low {% #low %}
- [ ] Medium {% #medium %}
- [ ] High {% #high %}
{% /field %}

{% field kind="multi_select" id="categories" label="Categories" role="user" minSelections=1 maxSelections=3 %}
- [ ] Frontend {% #frontend %}
- [ ] Backend {% #backend %}
- [ ] Database {% #database %}
{% /field %}

{% /group %}

{% group id="checkbox_fields" title="Checkbox Fields" %}

{% field kind="checkboxes" id="tasks_multi" label="Tasks (Multi)" role="agent" checkboxMode="multi" %}
- [ ] Research {% #research %}
- [ ] Design {% #design %}
{% /field %}

{% field kind="checkboxes" id="agreements" label="Agreements (Simple)" role="user" checkboxMode="simple" required=true %}
- [ ] Read terms {% #read %}
- [ ] Agree {% #agree %}
{% /field %}

{% field kind="checkboxes" id="confirmations" label="Confirmations (Explicit)" role="user" checkboxMode="explicit" approvalMode="blocking" %}
- [ ] Backed up {% #backup %}
- [ ] Notified {% #notify %}
{% /field %}

{% /group %}

{% group id="url_date_fields" title="URL and Date Fields" %}

{% field kind="url" id="website" label="Website" role="user" required=true placeholder="https://example.com" %}{% /field %}

{% field kind="date" id="start_date" label="Start Date" role="user" min="2020-01-01" max="2030-12-31" %}{% /field %}

{% field kind="year" id="founded_year" label="Founded Year" role="user" min=1900 max=2030 %}{% /field %}

{% /group %}

{% group id="table_fields" title="Table Fields" %}

{% field kind="table" id="team" label="Team Members" role="user" minRows=1 maxRows=10 columnIds=["name", "role", "start"] columnTypes=[{type: "string", required: true}, "string", "date"] %}
| Name | Role | Start |
|------|------|-------|
{% /field %}

{% description ref="team" %}
Add team members with required name, optional role and start date.
{% /description %}

{% /group %}

{% /form %}
`;

describe('jsonSchema', () => {
  describe('formToJsonSchema', () => {
    it('generates valid JSON Schema with $schema and $id', () => {
      const form = parseForm(TEST_FORM_MD);
      const result = formToJsonSchema(form);

      expect(result.schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
      expect(result.schema.$id).toBe('test_form');
      expect(result.schema.type).toBe('object');
    });

    it('includes form title and description', () => {
      const form = parseForm(TEST_FORM_MD);
      const result = formToJsonSchema(form);

      expect(result.schema.title).toBe('Test Form');
      expect(result.schema.description).toBe('A comprehensive test form for JSON Schema export.');
    });

    it('generates required array from required fields', () => {
      const form = parseForm(TEST_FORM_MD);
      const result = formToJsonSchema(form);

      expect(result.schema.required).toContain('name');
      expect(result.schema.required).toContain('email');
      expect(result.schema.required).toContain('age');
      expect(result.schema.required).toContain('priority');
      expect(result.schema.required).toContain('website');
      expect(result.schema.required).toContain('agreements');
      // Optional fields should not be in required
      expect(result.schema.required).not.toContain('score');
      expect(result.schema.required).not.toContain('tags');
    });

    it('includes x-markform extension at schema level', () => {
      const form = parseForm(TEST_FORM_MD);
      const result = formToJsonSchema(form);

      expect(result.schema['x-markform']).toBeDefined();
      expect(result.schema['x-markform']?.spec).toBe('MF/0.1');
      expect(result.schema['x-markform']?.roles).toEqual(['user', 'agent']);
      // Role instructions are set by the parser with defaults
      expect(result.schema['x-markform']?.roleInstructions).toBeDefined();
      expect(result.schema['x-markform']?.roleInstructions?.user).toBeDefined();
      expect(result.schema['x-markform']?.roleInstructions?.agent).toBeDefined();
      expect(result.schema['x-markform']?.groups).toBeDefined();
    });

    it('excludes x-markform when includeExtensions is false', () => {
      const form = parseForm(TEST_FORM_MD);
      const result = formToJsonSchema(form, { includeExtensions: false });

      expect(result.schema['x-markform']).toBeUndefined();
      // Also check field level
      const nameSchema = result.schema.properties?.name;
      expect(nameSchema?.['x-markform']).toBeUndefined();
    });

    it('uses correct $schema URL for different drafts', () => {
      const form = parseForm(TEST_FORM_MD);

      const result2020 = formToJsonSchema(form, { draft: '2020-12' });
      expect(result2020.schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');

      const result2019 = formToJsonSchema(form, { draft: '2019-09' });
      expect(result2019.schema.$schema).toBe('https://json-schema.org/draft/2019-09/schema');

      const result07 = formToJsonSchema(form, { draft: 'draft-07' });
      expect(result07.schema.$schema).toBe('http://json-schema.org/draft-07/schema#');
    });
  });

  describe('fieldToJsonSchema - string field', () => {
    it('generates string schema with constraints', () => {
      const form = parseForm(TEST_FORM_MD);
      const nameField = getField(form, 0, 0);
      const schema = fieldToJsonSchema(nameField, form.docs);

      expect(schema.type).toBe('string');
      expect(schema.title).toBe('Name');
      expect(schema.description).toBe('Enter your full name.');
      expect(schema.minLength).toBe(2);
      expect(schema.maxLength).toBe(50);
    });

    it('includes pattern for regex validation', () => {
      const form = parseForm(TEST_FORM_MD);
      const emailField = getField(form, 0, 1);
      const schema = fieldToJsonSchema(emailField, form.docs);

      expect(schema.type).toBe('string');
      expect(schema.pattern).toBe('^[^@]+@[^@]+\\.[^@]+$');
    });

    it('includes x-markform with role, placeholder, examples', () => {
      const form = parseForm(TEST_FORM_MD);
      const nameField = getField(form, 0, 0);
      const schema = fieldToJsonSchema(nameField, form.docs, {}, 'text_fields');

      expect(schema['x-markform']?.role).toBe('user');
      expect(schema['x-markform']?.group).toBe('text_fields');
      expect(schema['x-markform']?.placeholder).toBe('Enter name');
      expect(schema['x-markform']?.examples).toEqual(['John', 'Jane']);
    });
  });

  describe('fieldToJsonSchema - number field', () => {
    it('generates integer schema for integer=true', () => {
      const form = parseForm(TEST_FORM_MD);
      const ageField = getField(form, 0, 2);
      const schema = fieldToJsonSchema(ageField, form.docs);

      expect(schema.type).toBe('integer');
      expect(schema.title).toBe('Age');
      expect(schema.minimum).toBe(0);
      expect(schema.maximum).toBe(150);
    });

    it('generates number schema for floating point', () => {
      const form = parseForm(TEST_FORM_MD);
      const scoreField = getField(form, 0, 3);
      const schema = fieldToJsonSchema(scoreField, form.docs);

      expect(schema.type).toBe('number');
      expect(schema.minimum).toBe(0);
      expect(schema.maximum).toBe(100);
    });

    it('includes priority in x-markform for non-medium priority', () => {
      const form = parseForm(TEST_FORM_MD);
      const scoreField = getField(form, 0, 3);
      const schema = fieldToJsonSchema(scoreField, form.docs);

      expect(schema['x-markform']?.priority).toBe('high');
    });
  });

  describe('fieldToJsonSchema - string_list field', () => {
    it('generates array schema with string items', () => {
      const form = parseForm(TEST_FORM_MD);
      const tagsField = getField(form, 1, 0);
      const schema = fieldToJsonSchema(tagsField, form.docs);

      expect(schema.type).toBe('array');
      expect(schema.items?.type).toBe('string');
      expect(schema.title).toBe('Tags');
      expect(schema.minItems).toBe(1);
      expect(schema.maxItems).toBe(5);
      expect(schema.uniqueItems).toBe(true);
    });

    it('includes item constraints in items schema', () => {
      const form = parseForm(TEST_FORM_MD);
      const tagsField = getField(form, 1, 0);
      const schema = fieldToJsonSchema(tagsField, form.docs);

      expect(schema.items?.minLength).toBe(2);
      expect(schema.items?.maxLength).toBe(20);
    });
  });

  describe('fieldToJsonSchema - url and url_list fields', () => {
    it('generates uri format for url field', () => {
      const form = parseForm(TEST_FORM_MD);
      const websiteField = getField(form, 4, 0);
      const schema = fieldToJsonSchema(websiteField, form.docs);

      expect(schema.type).toBe('string');
      expect(schema.format).toBe('uri');
      expect(schema.title).toBe('Website');
    });

    it('generates array with uri format for url_list', () => {
      const form = parseForm(TEST_FORM_MD);
      const linksField = getField(form, 1, 1);
      const schema = fieldToJsonSchema(linksField, form.docs);

      expect(schema.type).toBe('array');
      expect(schema.items?.type).toBe('string');
      expect(schema.items?.format).toBe('uri');
    });
  });

  describe('fieldToJsonSchema - date and year fields', () => {
    it('generates date format for date field', () => {
      const form = parseForm(TEST_FORM_MD);
      const dateField = getField(form, 4, 1);
      const schema = fieldToJsonSchema(dateField, form.docs);

      expect(schema.type).toBe('string');
      expect(schema.format).toBe('date');
      expect(schema.title).toBe('Start Date');
    });

    it('includes minDate/maxDate in x-markform for date field', () => {
      const form = parseForm(TEST_FORM_MD);
      const dateField = getField(form, 4, 1);
      const schema = fieldToJsonSchema(dateField, form.docs);

      const ext = schema['x-markform'] as { minDate?: string; maxDate?: string };
      expect(ext.minDate).toBe('2020-01-01');
      expect(ext.maxDate).toBe('2030-12-31');
    });

    it('generates integer for year field with min/max', () => {
      const form = parseForm(TEST_FORM_MD);
      const yearField = getField(form, 4, 2);
      const schema = fieldToJsonSchema(yearField, form.docs);

      expect(schema.type).toBe('integer');
      expect(schema.minimum).toBe(1900);
      expect(schema.maximum).toBe(2030);
    });
  });

  describe('fieldToJsonSchema - single_select field', () => {
    it('generates enum with option IDs', () => {
      const form = parseForm(TEST_FORM_MD);
      const priorityField = getField(form, 2, 0);
      const schema = fieldToJsonSchema(priorityField, form.docs);

      expect(schema.type).toBe('string');
      expect(schema.enum).toEqual(['low', 'medium', 'high']);
      expect(schema.title).toBe('Priority');
    });
  });

  describe('fieldToJsonSchema - multi_select field', () => {
    it('generates array with enum items', () => {
      const form = parseForm(TEST_FORM_MD);
      const categoriesField = getField(form, 2, 1);
      const schema = fieldToJsonSchema(categoriesField, form.docs);

      expect(schema.type).toBe('array');
      expect(schema.items?.type).toBe('string');
      expect(schema.items?.enum).toEqual(['frontend', 'backend', 'database']);
      expect(schema.minItems).toBe(1);
      expect(schema.maxItems).toBe(3);
    });
  });

  describe('fieldToJsonSchema - checkboxes field', () => {
    it('generates object schema for multi mode checkboxes', () => {
      const form = parseForm(TEST_FORM_MD);
      const tasksField = getField(form, 3, 0);
      const schema = fieldToJsonSchema(tasksField, form.docs);

      expect(schema.type).toBe('object');
      expect(schema.properties?.research).toBeDefined();
      expect(schema.properties?.design).toBeDefined();
      expect(schema.properties?.research?.enum).toEqual([
        'todo',
        'done',
        'incomplete',
        'active',
        'na',
      ]);
    });

    it('generates correct enum for simple mode checkboxes', () => {
      const form = parseForm(TEST_FORM_MD);
      const agreementsField = getField(form, 3, 1);
      const schema = fieldToJsonSchema(agreementsField, form.docs);

      expect(schema.properties?.read?.enum).toEqual(['todo', 'done']);
      expect(schema.properties?.agree?.enum).toEqual(['todo', 'done']);
    });

    it('generates correct enum for explicit mode checkboxes', () => {
      const form = parseForm(TEST_FORM_MD);
      const confirmField = getField(form, 3, 2);
      const schema = fieldToJsonSchema(confirmField, form.docs);

      expect(schema.properties?.backup?.enum).toEqual(['unfilled', 'yes', 'no']);
      expect(schema.properties?.notify?.enum).toEqual(['unfilled', 'yes', 'no']);
    });

    it('includes checkboxMode and approvalMode in x-markform', () => {
      const form = parseForm(TEST_FORM_MD);
      const confirmField = getField(form, 3, 2);
      const schema = fieldToJsonSchema(confirmField, form.docs);

      expect(schema['x-markform']?.checkboxMode).toBe('explicit');
      expect(schema['x-markform']?.approvalMode).toBe('blocking');
    });
  });

  describe('fieldToJsonSchema - table field', () => {
    it('generates array of objects for table', () => {
      const form = parseForm(TEST_FORM_MD);
      const tableField = getField(form, 5, 0);
      const schema = fieldToJsonSchema(tableField, form.docs);

      expect(schema.type).toBe('array');
      expect(schema.items?.type).toBe('object');
      expect(schema.title).toBe('Team Members');
      expect(schema.description).toBe(
        'Add team members with required name, optional role and start date.',
      );
      expect(schema.minItems).toBe(1);
      expect(schema.maxItems).toBe(10);
    });

    it('generates correct column schemas', () => {
      const form = parseForm(TEST_FORM_MD);
      const tableField = getField(form, 5, 0);
      const schema = fieldToJsonSchema(tableField, form.docs);

      const rowSchema = schema.items;
      expect(rowSchema?.properties?.name?.type).toBe('string');
      expect(rowSchema?.properties?.role?.type).toBe('string');
      expect(rowSchema?.properties?.start?.type).toBe('string');
      expect(rowSchema?.properties?.start?.format).toBe('date');
    });

    it('includes required columns in row schema', () => {
      const form = parseForm(TEST_FORM_MD);
      const tableField = getField(form, 5, 0);
      const schema = fieldToJsonSchema(tableField, form.docs);

      expect(schema.items?.required).toEqual(['name']);
    });
  });

  describe('group handling', () => {
    it('includes group ID in field x-markform for non-implicit groups', () => {
      const form = parseForm(TEST_FORM_MD);
      const result = formToJsonSchema(form);

      expect(result.schema.properties?.name?.['x-markform']?.group).toBe('text_fields');
      expect(result.schema.properties?.tags?.['x-markform']?.group).toBe('list_fields');
    });

    it('lists groups in schema-level x-markform', () => {
      const form = parseForm(TEST_FORM_MD);
      const result = formToJsonSchema(form);

      const groups = result.schema['x-markform']?.groups;
      expect(groups).toBeDefined();
      expect(groups?.some((g) => g.id === 'text_fields' && g.title === 'Text Fields')).toBe(true);
      expect(groups?.some((g) => g.id === 'select_fields' && g.title === 'Selection Fields')).toBe(
        true,
      );
    });
  });
});
