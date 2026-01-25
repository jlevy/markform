/**
 * Golden Session Tests
 *
 * Uses direct file comparison for byte-for-byte matching.
 * Any diff = test failure, ensuring all changes are visible in reviews.
 *
 * Workflow:
 * - `pnpm test:golden` - Regenerate + compare, fail on any diff
 * - `pnpm test:golden:regen` - Update golden files after intentional changes
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';
import YAML from 'yaml';

import { parseForm } from '../../src/engine/parse.js';
import { serializeReport } from '../../src/engine/serialize.js';
import { formToJsonSchema } from '../../src/engine/jsonSchema.js';
import { injectCheckboxIds, injectHeaderIds } from '../../src/engine/injectIds.js';
import { toStructuredValues, toNotesArray } from '../../src/cli/lib/exportHelpers.js';
import { findSessionFiles, normalizeSession, regenerateSession } from './helpers.js';

// =============================================================================
// Configuration
// =============================================================================

const EXAMPLES_DIR = join(__dirname, '../../examples');

// =============================================================================
// Golden Session Tests (Direct Comparison)
// =============================================================================

describe('Golden Session Tests', () => {
  const sessionFiles = findSessionFiles(EXAMPLES_DIR);

  if (sessionFiles.length === 0) {
    it.skip('no session files found', () => {
      // Skip if no session files exist yet
    });
  } else {
    for (const sessionPath of sessionFiles) {
      const relativePath = sessionPath.replace(EXAMPLES_DIR + '/', '');

      it(`matches golden: ${relativePath}`, async () => {
        // Regenerate session from form + mock
        const actual = await regenerateSession(sessionPath);

        // Load golden file
        const expected = readFileSync(sessionPath, 'utf-8');

        // Direct comparison - any diff fails
        // Only normalize token counts (truly unstable fields)
        expect(normalizeSession(actual)).toBe(normalizeSession(expected));
      });
    }
  }
});

// =============================================================================
// Complex Form Parse Tests
// =============================================================================

describe('Complex Form Parse Tests', () => {
  it('parses movie-deep-research-mock-filled form with all field types', () => {
    const formPath = join(EXAMPLES_DIR, 'movie-research/movie-deep-research-mock-filled.form.md');

    if (!existsSync(formPath)) {
      console.log('Skipping: movie-deep-research-mock-filled.form.md not found');
      return;
    }

    const formContent = readFileSync(formPath, 'utf-8');
    const form = parseForm(formContent);

    // Verify form structure
    expect(form.schema.id).toBe('movie_research_deep');
    expect(form.schema.title).toBe('Movie Deep Research');

    // Count fields
    const fieldCount = Object.keys(form.responsesByFieldId).length;
    expect(fieldCount).toBe(42);

    // Verify most fields are answered (only official_site_url is intentionally empty)
    const answered = Object.values(form.responsesByFieldId).filter(
      (r) => r.state === 'answered',
    ).length;
    expect(answered).toBeGreaterThanOrEqual(40);

    // Verify specific field types parsed correctly
    // String field (value is { kind: 'string', value: '...' })
    const movie = form.responsesByFieldId.movie;
    expect(movie?.state).toBe('answered');
    const movieValue = movie?.value as { kind: string; value: string };
    expect(movieValue.kind).toBe('string');
    expect(movieValue.value).toBe('The Shawshank Redemption');

    // Number field (value is { kind: 'number', value: ... })
    const year = form.responsesByFieldId.year;
    expect(year?.state).toBe('answered');
    const yearValue = year?.value as { kind: string; value: number };
    expect(yearValue.kind).toBe('number');
    expect(yearValue.value).toBe(1994);

    // URL field (value is { kind: 'url', value: '...' })
    const imdbUrl = form.responsesByFieldId.imdb_url;
    expect(imdbUrl?.state).toBe('answered');
    const imdbValue = imdbUrl?.value as { kind: string; value: string };
    expect(imdbValue.kind).toBe('url');
    expect(imdbValue.value).toContain('imdb.com');

    // String list field (value is { kind: 'string_list', items: [...] })
    const directors = form.responsesByFieldId.directors;
    expect(directors?.state).toBe('answered');
    const directorsValue = directors?.value as { kind: string; items: string[] };
    expect(directorsValue.kind).toBe('string_list');
    expect(Array.isArray(directorsValue.items)).toBe(true);
    expect(directorsValue.items).toContain('Frank Darabont');

    // Table field - ratings (value is { kind: 'table', rows: [...] })
    const ratings = form.responsesByFieldId.ratings_table;
    expect(ratings?.state).toBe('answered');
    const ratingsValue = ratings?.value as { kind: string; rows: Record<string, unknown>[] };
    expect(ratingsValue.kind).toBe('table');
    expect(ratingsValue.rows.length).toBeGreaterThanOrEqual(4);
    expect(ratingsValue.rows[0]).toHaveProperty('source');
    expect(ratingsValue.rows[0]).toHaveProperty('score');

    // Table field - cast
    const cast = form.responsesByFieldId.lead_cast;
    expect(cast?.state).toBe('answered');
    const castValue = cast?.value as { kind: string; rows: Record<string, unknown>[] };
    expect(castValue.kind).toBe('table');
    expect(castValue.rows.length).toBeGreaterThanOrEqual(3);
    expect(castValue.rows[0]).toHaveProperty('actor_name');
    expect(castValue.rows[0]).toHaveProperty('character_name');

    // Single select field (value is { kind: 'single_select', selected: '...' })
    const mpaaRating = form.responsesByFieldId.mpaa_rating;
    expect(mpaaRating?.state).toBe('answered');
    const mpaaValue = mpaaRating?.value as { kind: string; selected: string };
    expect(mpaaValue.kind).toBe('single_select');
    expect(mpaaValue.selected).toBe('r');

    // Multi select field (value is { kind: 'multi_select', selected: [...] })
    const genres = form.responsesByFieldId.genres;
    expect(genres?.state).toBe('answered');
    const genresValue = genres?.value as { kind: string; selected: string[] };
    expect(genresValue.kind).toBe('multi_select');
    expect(Array.isArray(genresValue.selected)).toBe(true);
    expect(genresValue.selected).toContain('drama');

    // Checkboxes field (value is { kind: 'checkboxes', values: {...} })
    const availability = form.responsesByFieldId.availability_flags;
    expect(availability?.state).toBe('answered');
    const availValue = availability?.value as { kind: string; values: Record<string, string> };
    expect(availValue.kind).toBe('checkboxes');
    expect(typeof availValue.values).toBe('object');
  });

  it('generates valid JSON schema for complex form', () => {
    const formPath = join(EXAMPLES_DIR, 'movie-research/movie-deep-research-mock-filled.form.md');

    if (!existsSync(formPath)) {
      console.log('Skipping: movie-deep-research-mock-filled.form.md not found');
      return;
    }

    const formContent = readFileSync(formPath, 'utf-8');
    const form = parseForm(formContent);
    const result = formToJsonSchema(form);

    // Verify schema structure
    expect(result.schema.$schema).toBeDefined();
    expect(result.schema.type).toBe('object');
    expect(result.schema.properties).toBeDefined();

    // Check required fields are marked
    expect(result.schema.required).toContain('movie');
    expect(result.schema.required).toContain('full_title');
    expect(result.schema.required).toContain('year');
    expect(result.schema.required).toContain('imdb_url');
    expect(result.schema.required).toContain('directors');
  });
});

// =============================================================================
// Export Files Golden Tests
// =============================================================================

/** Export configuration for a filled form */
interface ExportConfig {
  formPath: string; // Path to the filled form file
  reportPath: string; // Expected report file
  yamlPath: string; // Expected yaml file
  schemaPath: string; // Expected schema file
}

/** Export configurations to test */
const EXPORT_CONFIGS: ExportConfig[] = [
  {
    formPath: 'simple/simple-mock-filled.form.md',
    reportPath: 'simple/simple-mock-filled.report.md',
    yamlPath: 'simple/simple-mock-filled.yml',
    schemaPath: 'simple/simple-mock-filled.schema.json',
  },
  {
    formPath: 'simple/simple-skipped-filled.form.md',
    reportPath: 'simple/simple-skipped-filled.report.md',
    yamlPath: 'simple/simple-skipped-filled.yml',
    schemaPath: 'simple/simple-skipped-filled.schema.json',
  },
  {
    formPath: 'rejection-test/rejection-test-mock-filled.form.md',
    reportPath: 'rejection-test/rejection-test-mock-filled.report.md',
    yamlPath: 'rejection-test/rejection-test-mock-filled.yml',
    schemaPath: 'rejection-test/rejection-test-mock-filled.schema.json',
  },
];

describe('Export Files Golden Tests', () => {
  for (const config of EXPORT_CONFIGS) {
    describe(config.formPath, () => {
      it('generates matching report markdown', () => {
        const formFullPath = join(EXAMPLES_DIR, config.formPath);
        const reportFullPath = join(EXAMPLES_DIR, config.reportPath);

        if (!existsSync(formFullPath) || !existsSync(reportFullPath)) {
          console.log(`Skipping: ${config.reportPath} (files not found)`);
          return;
        }

        const formContent = readFileSync(formFullPath, 'utf-8');
        const form = parseForm(formContent);
        const actualReport = serializeReport(form);

        const expectedReport = readFileSync(reportFullPath, 'utf-8');

        expect(actualReport).toBe(expectedReport);
      });

      it('generates matching yaml values', () => {
        const formFullPath = join(EXAMPLES_DIR, config.formPath);
        const yamlFullPath = join(EXAMPLES_DIR, config.yamlPath);

        if (!existsSync(formFullPath) || !existsSync(yamlFullPath)) {
          console.log(`Skipping: ${config.yamlPath} (files not found)`);
          return;
        }

        const formContent = readFileSync(formFullPath, 'utf-8');
        const form = parseForm(formContent);

        const values = toStructuredValues(form);
        const notes = toNotesArray(form);
        const exportData = {
          values,
          ...(notes.length > 0 && { notes }),
        };
        const actualYaml = YAML.stringify(exportData);

        const expectedYaml = readFileSync(yamlFullPath, 'utf-8');

        expect(actualYaml).toBe(expectedYaml);
      });

      it('generates matching json schema', () => {
        const formFullPath = join(EXAMPLES_DIR, config.formPath);
        const schemaFullPath = join(EXAMPLES_DIR, config.schemaPath);

        if (!existsSync(formFullPath) || !existsSync(schemaFullPath)) {
          console.log(`Skipping: ${config.schemaPath} (files not found)`);
          return;
        }

        const formContent = readFileSync(formFullPath, 'utf-8');
        const form = parseForm(formContent);
        const result = formToJsonSchema(form);

        const expectedSchemaStr = readFileSync(schemaFullPath, 'utf-8');
        const expectedSchema = JSON.parse(expectedSchemaStr) as unknown;

        // Compare parsed objects to avoid JSON formatting differences
        expect(result.schema).toEqual(expectedSchema);
      });
    });
  }
});

// =============================================================================
// Implicit Checkboxes Parsing Tests
// =============================================================================

describe('Implicit Checkboxes Parsing', () => {
  it('parses plan-document.form.md with implicit checkboxes field', () => {
    const formPath = join(EXAMPLES_DIR, 'plan-document/plan-document.form.md');

    if (!existsSync(formPath)) {
      console.log('Skipping: plan-document.form.md not found');
      return;
    }

    const formContent = readFileSync(formPath, 'utf-8');
    const form = parseForm(formContent);

    // Verify form structure
    expect(form.schema.id).toBe('project_plan');
    expect(form.schema.title).toBe('Project Plan');

    // Verify implicit _checkboxes field was created
    expect(form.responsesByFieldId._checkboxes).toBeDefined();

    // Verify field is in implicit group
    expect(form.schema.groups).toHaveLength(1);
    const defaultGroup = form.schema.groups[0];
    expect(defaultGroup?.id).toBe('_default');
    expect(defaultGroup?.implicit).toBe(true);

    // Verify checkboxes field structure
    const checkboxesField = defaultGroup?.children[0];
    expect(checkboxesField?.kind).toBe('checkboxes');
    expect(checkboxesField?.id).toBe('_checkboxes');
    if (checkboxesField?.kind === 'checkboxes') {
      expect(checkboxesField.implicit).toBe(true);
      expect(checkboxesField.checkboxMode).toBe('multi');
      // 14 tasks total: 3 + 3 + 4 + 4
      expect(checkboxesField.options).toHaveLength(14);

      // Verify specific option IDs exist
      const optionIds = checkboxesField.options.map((o) => o.id);
      expect(optionIds).toContain('review_docs');
      expect(optionIds).toContain('arch_doc');
      expect(optionIds).toContain('unit_tests');
      expect(optionIds).toContain('prod_deploy');
    }

    // Verify response values
    const response = form.responsesByFieldId._checkboxes;
    expect(response?.state).toBe('answered');
    if (response?.value?.kind === 'checkboxes') {
      // All should be 'todo' state (unchecked)
      expect(response.value.values.review_docs).toBe('todo');
      expect(response.value.values.prod_deploy).toBe('todo');
    }
  });

  it('parses plan-document-progress.form.md with partial completion', () => {
    const formPath = join(EXAMPLES_DIR, 'plan-document/plan-document-progress.form.md');

    if (!existsSync(formPath)) {
      console.log('Skipping: plan-document-progress.form.md not found');
      return;
    }

    const formContent = readFileSync(formPath, 'utf-8');
    const form = parseForm(formContent);

    expect(form.schema.id).toBe('project_plan');

    // Verify response values include completed items
    const response = form.responsesByFieldId._checkboxes;
    expect(response?.state).toBe('answered');
    if (response?.value?.kind === 'checkboxes') {
      // Phase 1 should be done
      expect(response.value.values.review_docs).toBe('done');
      expect(response.value.values.competitor_analysis).toBe('done');
      // Phase 3/4 should still be todo
      expect(response.value.values.unit_tests).toBe('todo');
      expect(response.value.values.prod_deploy).toBe('todo');
    }
  });

  it('parses plan-document-markdoc.form.md with Markdoc syntax', () => {
    const formPath = join(EXAMPLES_DIR, 'plan-document/plan-document-markdoc.form.md');

    if (!existsSync(formPath)) {
      console.log('Skipping: plan-document-markdoc.form.md not found');
      return;
    }

    const formContent = readFileSync(formPath, 'utf-8');
    const form = parseForm(formContent);

    // Verify form structure (different form ID in markdoc example)
    expect(form.schema.id).toBe('sprint_tasks');
    expect(form.responsesByFieldId._checkboxes).toBeDefined();

    const checkboxesField = form.schema.groups[0]?.children[0];
    if (checkboxesField?.kind === 'checkboxes') {
      expect(checkboxesField.implicit).toBe(true);
      expect(checkboxesField.options.length).toBe(8); // 3 + 3 + 2
    }
  });

  it('exports structured values correctly for plan documents', () => {
    const formPath = join(EXAMPLES_DIR, 'plan-document/plan-document.form.md');

    if (!existsSync(formPath)) {
      console.log('Skipping: plan-document.form.md not found');
      return;
    }

    const formContent = readFileSync(formPath, 'utf-8');
    const form = parseForm(formContent);
    const values = toStructuredValues(form);

    // Verify _checkboxes field is exported with structured format
    expect(values._checkboxes).toBeDefined();
    const checkboxExport = values._checkboxes as { state: string; value: Record<string, string> };
    expect(checkboxExport.state).toBe('answered');
    expect(checkboxExport.value).toBeDefined();

    // Verify checkbox values
    expect(checkboxExport.value.review_docs).toBe('todo');
    expect(checkboxExport.value.prod_deploy).toBe('todo');
  });
});

// =============================================================================
// ID Injection Golden Tests
// =============================================================================

describe('ID Injection Golden Tests', () => {
  describe('injectCheckboxIds', () => {
    it('injects IDs using label-based generator', () => {
      const input = `# Tasks

- [ ] Review documentation
- [ ] Write tests
- [ ] Deploy to production
`;

      const expected = `# Tasks

- [ ] Review documentation {% #review_documentation %}
- [ ] Write tests {% #write_tests %}
- [ ] Deploy to production {% #deploy_to_production %}
`;

      const result = injectCheckboxIds(input, {
        generator: (info) =>
          info.label
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, ''),
      });

      expect(result.markdown).toBe(expected);
      expect(result.injectedCount).toBe(3);
    });

    it('injects IDs using heading-prefixed generator', () => {
      const input = `# Project Plan

## Phase 1
- [ ] Research

## Phase 2
- [ ] Design
`;

      const expected = `# Project Plan

## Phase 1
- [ ] Research {% #phase_1_research %}

## Phase 2
- [ ] Design {% #phase_2_design %}
`;

      const result = injectCheckboxIds(input, {
        generator: (info) => {
          const section =
            info.enclosingHeadings[0]?.title
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '_')
              .replace(/^_+|_+$/g, '') ?? 'default';
          const task = info.label
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');
          return `${section}_${task}`;
        },
      });

      expect(result.markdown).toBe(expected);
      expect(result.injectedCount).toBe(2);
    });

    it('preserves existing IDs and only adds missing ones', () => {
      const input = `- [ ] Task with ID {% #existing_id %}
- [ ] Task without ID
`;

      const expected = `- [ ] Task with ID {% #existing_id %}
- [ ] Task without ID {% #task_1 %}
`;

      const result = injectCheckboxIds(input, {
        generator: (_info, index) => `task_${index + 1}`,
      });

      expect(result.markdown).toBe(expected);
      expect(result.injectedCount).toBe(1);
    });
  });

  describe('injectHeaderIds', () => {
    it('injects IDs into headings using slug generator', () => {
      const input = `# Main Title

## Getting Started

Some content here.

## Advanced Usage

More content.
`;

      const expected = `# Main Title {% #main_title %}

## Getting Started {% #getting_started %}

Some content here.

## Advanced Usage {% #advanced_usage %}

More content.
`;

      const result = injectHeaderIds(input, {
        generator: (info) =>
          info.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, ''),
      });

      expect(result.markdown).toBe(expected);
      expect(result.injectedCount).toBe(3);
    });

    it('filters by heading level', () => {
      const input = `# H1 Title

## H2 Section

### H3 Subsection

Content here.
`;

      const expected = `# H1 Title {% #h1 %}

## H2 Section {% #h2 %}

### H3 Subsection

Content here.
`;

      const result = injectHeaderIds(input, {
        generator: (info) => `h${info.level}`,
        levels: [1, 2],
      });

      expect(result.markdown).toBe(expected);
      expect(result.injectedCount).toBe(2);
    });

    it('preserves existing IDs', () => {
      const input = `# Title With ID {% #existing %}

## New Section
`;

      const expected = `# Title With ID {% #existing %}

## New Section {% #new_section %}
`;

      const result = injectHeaderIds(input, {
        generator: (info) =>
          info.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, ''),
      });

      expect(result.markdown).toBe(expected);
      expect(result.injectedCount).toBe(1);
    });

    it('replaces all IDs when onlyMissing=false', () => {
      const input = `# Old Title {% #old_id %}

## Another {% #another_old %}
`;

      const expected = `# Old Title {% #old_title %}

## Another {% #another %}
`;

      const result = injectHeaderIds(input, {
        generator: (info) =>
          info.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, ''),
        onlyMissing: false,
      });

      expect(result.markdown).toBe(expected);
      expect(result.injectedCount).toBe(2);
    });
  });
});
