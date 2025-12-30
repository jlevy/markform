import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';

import type { Field, ParsedForm } from '../../src/engine/coreTypes.js';
import { parseForm } from '../../src/engine/parse.js';
import { fieldToJsonSchema, formToJsonSchema } from '../../src/engine/jsonSchema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXAMPLES_DIR = join(__dirname, '../../examples');

/**
 * Load the simple test form from the examples directory.
 * This is the canonical test form that covers all field types.
 */
function loadSimpleForm(): ParsedForm {
  const formPath = join(EXAMPLES_DIR, 'simple/simple.form.md');
  const formContent = readFileSync(formPath, 'utf-8');
  return parseForm(formContent);
}

/**
 * Load the expected JSON Schema snapshot for the simple form.
 */
function loadSimpleSchemaSnapshot(): Record<string, unknown> {
  const schemaPath = join(EXAMPLES_DIR, 'simple/simple.schema.json');
  const schemaContent = readFileSync(schemaPath, 'utf-8');
  return JSON.parse(schemaContent) as Record<string, unknown>;
}

/** Helper to get a field from a parsed form by field ID. */
function getFieldById(form: ParsedForm, fieldId: string): Field {
  for (const group of form.schema.groups) {
    for (const field of group.children) {
      if (field.id === fieldId) {
        return field;
      }
    }
  }
  throw new Error(`Field ${fieldId} not found`);
}

/** Helper to get a field's group ID. */
function getFieldGroupId(form: ParsedForm, fieldId: string): string | undefined {
  for (const group of form.schema.groups) {
    for (const field of group.children) {
      if (field.id === fieldId) {
        return group.implicit ? undefined : group.id;
      }
    }
  }
  return undefined;
}

/**
 * Create an Ajv instance configured for JSON Schema validation.
 * Uses 'log' strict mode to allow x-markform extensions while still catching errors.
 * Validates schema structure can be compiled (not against meta-schema URL).
 */
function createAjvValidator(): Ajv {
  const ajv = new Ajv({
    // Use 'log' to warn on unknown keywords (x-markform) but not fail
    strict: 'log',
    allErrors: true,
    validateFormats: true,
    // Don't try to fetch/validate against $schema URL, just validate structure
    validateSchema: false,
  });
  addFormats(ajv);
  return ajv;
}

describe('jsonSchema', () => {
  describe('formToJsonSchema - snapshot comparison', () => {
    it('matches the golden schema snapshot for simple.form.md', () => {
      const form = loadSimpleForm();
      const result = formToJsonSchema(form);
      const expectedSchema = loadSimpleSchemaSnapshot();

      // Full schema comparison - this is the primary golden test
      expect(result.schema).toEqual(expectedSchema);
    });
  });

  describe('formToJsonSchema - Ajv meta-validation', () => {
    it('generates a schema that Ajv can compile (valid JSON Schema)', () => {
      const form = loadSimpleForm();
      const result = formToJsonSchema(form);
      const ajv = createAjvValidator();

      // This will throw if the schema is invalid JSON Schema
      const validate = ajv.compile(result.schema);
      expect(validate).toBeDefined();
      expect(typeof validate).toBe('function');
    });

    it('generates valid JSON Schema for all draft versions', () => {
      const form = loadSimpleForm();
      const drafts = ['2020-12', '2019-09', 'draft-07'] as const;

      for (const draft of drafts) {
        const result = formToJsonSchema(form, { draft });
        const ajv = createAjvValidator();

        // Ajv should be able to compile the schema without errors
        expect(() => ajv.compile(result.schema)).not.toThrow();
      }
    });

    it('generates valid JSON Schema in pure mode (no extensions)', () => {
      const form = loadSimpleForm();
      const result = formToJsonSchema(form, { includeExtensions: false });
      const ajv = createAjvValidator();

      // Pure mode schema should be strictly valid JSON Schema
      const validate = ajv.compile(result.schema);
      expect(validate).toBeDefined();
    });
  });

  describe('formToJsonSchema', () => {
    it('generates valid JSON Schema with $schema and $id', () => {
      const form = loadSimpleForm();
      const result = formToJsonSchema(form);

      expect(result.schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
      expect(result.schema.$id).toBe('simple_test');
      expect(result.schema.type).toBe('object');
    });

    it('includes form title and description', () => {
      const form = loadSimpleForm();
      const result = formToJsonSchema(form);

      expect(result.schema.title).toBe('Simple Test Form');
      expect(result.schema.description).toContain('fully interactive form');
    });

    it('generates required array from required fields', () => {
      const form = loadSimpleForm();
      const result = formToJsonSchema(form);

      expect(result.schema.required).toContain('name');
      expect(result.schema.required).toContain('email');
      expect(result.schema.required).toContain('age');
      expect(result.schema.required).toContain('priority');
      expect(result.schema.required).toContain('website');
      expect(result.schema.required).toContain('tasks_simple');
      // Optional fields should not be in required
      expect(result.schema.required).not.toContain('score');
      expect(result.schema.required).not.toContain('notes');
    });

    it('includes x-markform extension at schema level', () => {
      const form = loadSimpleForm();
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
      const form = loadSimpleForm();
      const result = formToJsonSchema(form, { includeExtensions: false });

      expect(result.schema['x-markform']).toBeUndefined();
      // Also check field level
      const nameSchema = result.schema.properties?.name;
      expect(nameSchema?.['x-markform']).toBeUndefined();
    });

    it('uses correct $schema URL for different drafts', () => {
      const form = loadSimpleForm();

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
      const form = loadSimpleForm();
      const nameField = getFieldById(form, 'name');
      const schema = fieldToJsonSchema(nameField, form.docs);

      expect(schema.type).toBe('string');
      expect(schema.title).toBe('Name');
      expect(schema.minLength).toBe(2);
      expect(schema.maxLength).toBe(50);
    });

    it('includes pattern for regex validation', () => {
      const form = loadSimpleForm();
      const emailField = getFieldById(form, 'email');
      const schema = fieldToJsonSchema(emailField, form.docs);

      expect(schema.type).toBe('string');
      expect(schema.pattern).toBe('^[^@]+@[^@]+\\.[^@]+$');
    });

    it('includes x-markform with role, placeholder, examples', () => {
      const form = loadSimpleForm();
      const nameField = getFieldById(form, 'name');
      const groupId = getFieldGroupId(form, 'name');
      const schema = fieldToJsonSchema(nameField, form.docs, {}, groupId);

      expect(schema['x-markform']?.role).toBe('user');
      expect(schema['x-markform']?.group).toBe('basic_fields');
      expect(schema['x-markform']?.placeholder).toBe('Enter your name');
      expect(schema['x-markform']?.examples).toEqual(['John Smith', 'Jane Doe']);
    });
  });

  describe('fieldToJsonSchema - number field', () => {
    it('generates integer schema for integer=true', () => {
      const form = loadSimpleForm();
      const ageField = getFieldById(form, 'age');
      const schema = fieldToJsonSchema(ageField, form.docs);

      expect(schema.type).toBe('integer');
      expect(schema.title).toBe('Age');
      expect(schema.minimum).toBe(0);
      expect(schema.maximum).toBe(150);
    });

    it('generates number schema for floating point', () => {
      const form = loadSimpleForm();
      const scoreField = getFieldById(form, 'score');
      const schema = fieldToJsonSchema(scoreField, form.docs);

      expect(schema.type).toBe('number');
      expect(schema.minimum).toBe(0);
      expect(schema.maximum).toBe(100);
    });
  });

  describe('fieldToJsonSchema - string_list field', () => {
    it('generates array schema with string items', () => {
      const form = loadSimpleForm();
      const tagsField = getFieldById(form, 'tags');
      const schema = fieldToJsonSchema(tagsField, form.docs);

      expect(schema.type).toBe('array');
      expect(schema.items?.type).toBe('string');
      expect(schema.title).toBe('Tags');
      expect(schema.minItems).toBe(1);
      expect(schema.maxItems).toBe(5);
      expect(schema.uniqueItems).toBe(true);
    });

    it('includes item constraints in items schema', () => {
      const form = loadSimpleForm();
      const tagsField = getFieldById(form, 'tags');
      const schema = fieldToJsonSchema(tagsField, form.docs);

      expect(schema.items?.minLength).toBe(2);
    });
  });

  describe('fieldToJsonSchema - url and url_list fields', () => {
    it('generates uri format for url field', () => {
      const form = loadSimpleForm();
      const websiteField = getFieldById(form, 'website');
      const schema = fieldToJsonSchema(websiteField, form.docs);

      expect(schema.type).toBe('string');
      expect(schema.format).toBe('uri');
      expect(schema.title).toBe('Website');
    });

    it('generates array with uri format for url_list', () => {
      const form = loadSimpleForm();
      const referencesField = getFieldById(form, 'references');
      const schema = fieldToJsonSchema(referencesField, form.docs);

      expect(schema.type).toBe('array');
      expect(schema.items?.type).toBe('string');
      expect(schema.items?.format).toBe('uri');
    });
  });

  describe('fieldToJsonSchema - date and year fields', () => {
    it('generates date format for date field', () => {
      const form = loadSimpleForm();
      const dateField = getFieldById(form, 'event_date');
      const schema = fieldToJsonSchema(dateField, form.docs);

      expect(schema.type).toBe('string');
      expect(schema.format).toBe('date');
      expect(schema.title).toBe('Event Date');
    });

    it('includes formatMinimum/formatMaximum in schema for date constraints', () => {
      const form = loadSimpleForm();
      const dateField = getFieldById(form, 'event_date');
      const schema = fieldToJsonSchema(dateField, form.docs);

      // Standard JSON Schema 2019-09/2020-12 keywords for format validation
      expect(schema.formatMinimum).toBe('2020-01-01');
      expect(schema.formatMaximum).toBe('2030-12-31');
    });

    it('includes minDate/maxDate in x-markform for backward compatibility', () => {
      const form = loadSimpleForm();
      const dateField = getFieldById(form, 'event_date');
      const schema = fieldToJsonSchema(dateField, form.docs);

      const ext = schema['x-markform'] as { minDate?: string; maxDate?: string };
      expect(ext.minDate).toBe('2020-01-01');
      expect(ext.maxDate).toBe('2030-12-31');
    });

    it('generates integer for year field with min/max', () => {
      const form = loadSimpleForm();
      const yearField = getFieldById(form, 'founded_year');
      const schema = fieldToJsonSchema(yearField, form.docs);

      expect(schema.type).toBe('integer');
      expect(schema.minimum).toBe(1900);
      expect(schema.maximum).toBe(2030);
    });
  });

  describe('fieldToJsonSchema - single_select field', () => {
    it('generates enum with option IDs', () => {
      const form = loadSimpleForm();
      const priorityField = getFieldById(form, 'priority');
      const schema = fieldToJsonSchema(priorityField, form.docs);

      expect(schema.type).toBe('string');
      expect(schema.enum).toEqual(['low', 'medium', 'high']);
      expect(schema.title).toBe('Priority');
    });
  });

  describe('fieldToJsonSchema - multi_select field', () => {
    it('generates array with enum items', () => {
      const form = loadSimpleForm();
      const categoriesField = getFieldById(form, 'categories');
      const schema = fieldToJsonSchema(categoriesField, form.docs);

      expect(schema.type).toBe('array');
      expect(schema.items?.type).toBe('string');
      expect(schema.items?.enum).toEqual(['frontend', 'backend', 'database', 'devops']);
      expect(schema.minItems).toBe(1);
      expect(schema.maxItems).toBe(3);
    });
  });

  describe('fieldToJsonSchema - checkboxes field', () => {
    it('generates object schema for multi mode checkboxes', () => {
      const form = loadSimpleForm();
      const tasksField = getFieldById(form, 'tasks_multi');
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
      const form = loadSimpleForm();
      const agreementsField = getFieldById(form, 'tasks_simple');
      const schema = fieldToJsonSchema(agreementsField, form.docs);

      expect(schema.properties?.read_guidelines?.enum).toEqual(['todo', 'done']);
      expect(schema.properties?.agree_terms?.enum).toEqual(['todo', 'done']);
    });

    it('generates correct enum for explicit mode checkboxes', () => {
      const form = loadSimpleForm();
      const confirmField = getFieldById(form, 'confirmations');
      const schema = fieldToJsonSchema(confirmField, form.docs);

      expect(schema.properties?.backed_up?.enum).toEqual(['unfilled', 'yes', 'no']);
      expect(schema.properties?.notified?.enum).toEqual(['unfilled', 'yes', 'no']);
    });

    it('includes checkboxMode in x-markform', () => {
      const form = loadSimpleForm();
      const confirmField = getFieldById(form, 'confirmations');
      const schema = fieldToJsonSchema(confirmField, form.docs);

      expect(schema['x-markform']?.checkboxMode).toBe('explicit');
    });

    it('includes minDone in x-markform for checkbox fields with minDone constraint', () => {
      // Note: This test uses an inline form because simple.form.md doesn't have a minDone example
      const formWithMinDone = `---
markform:
  spec: MF/0.1
---

{% form id="test" %}
{% field kind="checkboxes" id="tasks" label="Tasks" checkboxMode="simple" minDone=2 %}
- [ ] Task A {% #a %}
- [ ] Task B {% #b %}
- [ ] Task C {% #c %}
{% /field %}
{% /form %}
`;
      const form = parseForm(formWithMinDone);
      const tasksField = getFieldById(form, 'tasks');
      const schema = fieldToJsonSchema(tasksField, form.docs);

      expect(schema['x-markform']?.checkboxMode).toBe('simple');
      expect(schema['x-markform']?.minDone).toBe(2);
    });
  });

  describe('fieldToJsonSchema - table field', () => {
    it('generates array of objects for table', () => {
      const form = loadSimpleForm();
      const tableField = getFieldById(form, 'team_members');
      const schema = fieldToJsonSchema(tableField, form.docs);

      expect(schema.type).toBe('array');
      expect(schema.items?.type).toBe('object');
      expect(schema.title).toBe('Team Members');
      expect(schema.minItems).toBe(0);
      expect(schema.maxItems).toBe(5);
    });

    it('generates correct column schemas', () => {
      const form = loadSimpleForm();
      const tableField = getFieldById(form, 'team_members');
      const schema = fieldToJsonSchema(tableField, form.docs);

      const rowSchema = schema.items;
      expect(rowSchema?.properties?.name?.type).toBe('string');
      expect(rowSchema?.properties?.role?.type).toBe('string');
      expect(rowSchema?.properties?.start_date?.type).toBe('string');
      expect(rowSchema?.properties?.start_date?.format).toBe('date');
    });

    it('includes required columns in row schema', () => {
      const form = loadSimpleForm();
      const tableField = getFieldById(form, 'team_members');
      const schema = fieldToJsonSchema(tableField, form.docs);

      expect(schema.items?.required).toEqual(['name']);
    });
  });

  describe('group handling', () => {
    it('includes group ID in field x-markform for non-implicit groups', () => {
      const form = loadSimpleForm();
      const result = formToJsonSchema(form);

      expect(result.schema.properties?.name?.['x-markform']?.group).toBe('basic_fields');
      expect(result.schema.properties?.tags?.['x-markform']?.group).toBe('list_fields');
    });

    it('lists groups in schema-level x-markform', () => {
      const form = loadSimpleForm();
      const result = formToJsonSchema(form);

      const groups = result.schema['x-markform']?.groups;
      expect(groups).toBeDefined();
      expect(groups?.some((g) => g.id === 'basic_fields' && g.title === 'Basic Fields')).toBe(true);
      expect(
        groups?.some((g) => g.id === 'selection_fields' && g.title === 'Selection Fields'),
      ).toBe(true);
    });
  });
});
