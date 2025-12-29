# Plan Spec: JSON Schema Export

## Purpose

Add the ability to export a Markform form’s structure as standard JSON Schema, enabling
downstream tools to validate form data, generate types, and integrate with other
systems.

## Background

Markform forms are defined in `.form.md` files with a custom Markdoc-based syntax.
While the `export` command currently outputs form data as JSON/YAML, there’s no way to
export the form *structure* as a standard schema format that other tools can consume.

JSON Schema (https://json-schema.org/) is the industry standard for describing JSON data
structures. Supporting JSON Schema export would enable:

- **Validation**: Other systems can validate form data against the schema

- **Code generation**: Generate TypeScript types, API clients, etc.

- **Documentation**: Schema becomes self-documenting with descriptions

- **LLM tooling**: Use as function calling schemas in other contexts

- **Interoperability**: Standard format understood by many tools

### Related Documentation

- `SPEC.md` — Core Markform specification (references `zod-to-json-schema`)

- `packages/markform/src/engine/coreTypes.ts` — Field type definitions and Zod schemas

- `packages/markform/src/cli/commands/export.ts` — Current export implementation

## Summary of Task

Implement a new `markform schema` CLI command and corresponding engine API to export a
form’s structure as JSON Schema.
The output should:

1. Map all Markform field types to their JSON Schema equivalents

2. Include field descriptions from documentation blocks (`title` and `description`)

3. Preserve Markform-specific metadata via `x-` extension properties (camelCase)

4. Support both pure JSON Schema and extended output modes

## Backward Compatibility

**BACKWARD COMPATIBILITY REQUIREMENTS:**

- **Code types, methods, and function signatures**: DO NOT MAINTAIN — This is a new
  feature with no existing API to preserve.

- **Library APIs**: N/A — New public API being added.

- **Server APIs**: N/A — No server component.

- **File formats**: N/A — Output is new JSON Schema format, no existing format to
  maintain.

- **Database schemas**: N/A — No database component.

## Stage 1: Planning Stage

### Feature Requirements

**Core Requirements:**

1. New `markform schema <file>` CLI command

2. Engine API function `formToJsonSchema(form, options)` usable by libraries

3. Map all 11 field types to JSON Schema equivalents

4. Include `title` (from field label) and `description` (from doc blocks)

5. Mark required fields in JSON Schema `required` array

6. Output valid JSON Schema (draft 2020-12 by default)

**Extension Property (single `x-markform` object):**

All Markform-specific metadata is consolidated under a single `x-markform` extension
property. JSON Schema extensions support any JSON value, so we use a structured object
rather than many flat `x-markform*` properties.

**Form-level `x-markform` object:**

| Property | Type | Description |
| --- | --- | --- |
| `spec` | string | Markform spec version (e.g., "MF/0.1") |
| `roles` | string[] | Available roles for field assignment |
| `roleInstructions` | object | Instructions keyed by role name |
| `groups` | array | Group definitions with id and title |

**Field-level `x-markform` object:**

| Property | Type | Description |
| --- | --- | --- |
| `role` | string | Target actor for this field |
| `priority` | string | "high", "medium", or "low" |
| `group` | string | Parent group ID |
| `checkboxMode` | string | "multi", "simple", or "explicit" (checkboxes only) |
| `approvalMode` | string | "none" or "blocking" (checkboxes only) |
| `placeholder` | string | Hint text (text-entry fields only) |
| `examples` | string[] | Example values (text-entry fields only) |

**Benefits of single object vs many properties:**

1. **Single namespace**: One `x-markform` instead of 10+ `x-markform*` keys

2. **Structured data**: Nested objects, arrays, any JSON type

3. **Easier to ignore**: Tools skip one key to get pure JSON Schema

4. **Better tooling**: TypeScript can type the whole object

**Note:** Field ID is NOT included since it’s already the property key in the schema.

**TypeScript Types (for implementation):**

```typescript
/** Form-level Markform extension data */
interface MarkformSchemaExtension {
  spec: string;
  roles?: string[];
  roleInstructions?: Record<string, string>;
  groups?: Array<{ id: string; title: string }>;
}

/** Field-level Markform extension data */
interface MarkformFieldExtension {
  role?: string;
  priority?: 'high' | 'medium' | 'low';
  group?: string;
  checkboxMode?: 'multi' | 'simple' | 'explicit';
  approvalMode?: 'none' | 'blocking';
  placeholder?: string;
  examples?: string[];
}
```

**Native JSON Schema Mapping:**

| Markform Concept | JSON Schema Property |
| --- | --- |
| Field label | `title` |
| Description doc block | `description` |
| Required flag | `required` array (at object level) |
| Field constraints | Native JSON Schema keywords |

**CLI Options:**

```
markform schema <file>                    # Default: include x-markform objects
markform schema <file> --pure             # Pure JSON Schema (no x-markform)
markform schema <file> --draft <version>  # Specify draft (2020-12, 2019-09, draft-07)
markform schema <file> --format json      # JSON output (default)
markform schema <file> --format yaml      # YAML output
```

**Out of Scope (Not Implementing):**

- [ ] Value validation against schema (use existing validate command)

- [ ] Schema-to-form conversion (reverse direction)

- [ ] JSON Schema $ref support for shared definitions

- [ ] Custom vocabulary registration

### Field Type Mapping

| Markform Kind | JSON Schema | Constraints |
| --- | --- | --- |
| `string` | `{ "type": "string" }` | `minLength`, `maxLength`, `pattern` |
| `number` | `{ "type": "number" }` or `{ "type": "integer" }` | `minimum`, `maximum` |
| `date` | `{ "type": "string", "format": "date" }` | `x-markformMin`, `x-markformMax` |
| `year` | `{ "type": "integer" }` | `minimum`, `maximum` |
| `url` | `{ "type": "string", "format": "uri" }` | — |
| `string_list` | `{ "type": "array", "items": { "type": "string" } }` | `minItems`, `maxItems`, `uniqueItems` |
| `url_list` | `{ "type": "array", "items": { "type": "string", "format": "uri" } }` | `minItems`, `maxItems`, `uniqueItems` |
| `single_select` | `{ "type": "string", "enum": [...] }` | Option IDs as enum |
| `multi_select` | `{ "type": "array", "items": { "enum": [...] } }` | `minItems`, `maxItems` |
| `checkboxes` | `{ "type": "object", "properties": {...} }` | Each option as property with enum states |
| `table` | `{ "type": "array", "items": { "type": "object", ... } }` | `minItems`, `maxItems`, column schemas |

### Acceptance Criteria

1. `markform schema <file>` outputs valid JSON Schema

2. Schema validates successfully with standard JSON Schema validators

3. All 11 field types correctly mapped

4. Documentation blocks appear as `description` properties

5. Field labels appear as `title` properties

6. Required fields listed in `required` array

7. `--pure` flag removes all `x-markform*` properties

8. Engine API `formToJsonSchema()` works independently of CLI

9. Unit tests cover all field type mappings

10. Golden test with example form verifies output stability

## Stage 2: Architecture Stage

### File Structure

```
packages/markform/src/
  engine/
    jsonSchema.ts              # NEW: Core conversion logic
  cli/
    commands/
      schema.ts                # NEW: CLI command
  index.ts                     # MODIFY: Export jsonSchema functions
```

### Dependencies

Add to `package.json`:

```json
{
  "dependencies": {
    "zod-to-json-schema": "^3.24.0"
  },
  "devDependencies": {
    "ajv": "^8.17.0",
    "ajv-formats": "^3.0.0"
  }
}
```

**zod-to-json-schema**: While we won’t use it directly for form→schema conversion (we’re
converting from `ParsedForm`, not Zod schemas), having it available is useful for:

- Reference implementation of type mappings

- Future use for patch input schemas in MCP tool definitions

**ajv + ajv-formats**: Standard JSON Schema validator for testing:

- Meta-validation (confirm our output is valid JSON Schema)

- Golden tests (validate form values against generated schemas)

### API Design

#### Engine Layer: `engine/jsonSchema.ts`

```ts
import type { JSONSchema7 } from 'json-schema';

/** Options for JSON Schema generation */
export interface JsonSchemaOptions {
  /** Include x-markform* extension properties (default: true) */
  includeExtensions?: boolean;
  /** Include group structure in x-markformGroups (default: true) */
  includeGroups?: boolean;
  /** JSON Schema draft version (default: '2020-12') */
  draft?: '2020-12' | '2019-09' | 'draft-07';
}

/** Result from JSON Schema generation */
export interface JsonSchemaResult {
  /** The generated JSON Schema */
  schema: JSONSchema7;
}

/**
 * Convert a parsed form to JSON Schema.
 * 
 * Main API for JSON Schema generation. Use from libraries or CLI.
 */
export function formToJsonSchema(
  form: ParsedForm,
  options?: JsonSchemaOptions
): JsonSchemaResult;

/**
 * Convert a single field to its JSON Schema representation.
 * 
 * Useful for partial schema generation or testing.
 */
export function fieldToJsonSchema(
  field: Field,
  docs: DocumentationBlock[],
  options?: JsonSchemaOptions
): JSONSchema7;
```

#### CLI Layer: `cli/commands/schema.ts`

Follows existing command patterns (see `inspect.ts`, `export.ts`):

```ts
export function registerSchemaCommand(program: Command): void {
  program
    .command('schema <file>')
    .description('Export form structure as JSON Schema')
    .option('--pure', 'Exclude x-markform* extension properties')
    .option('--draft <version>', 'JSON Schema draft version', '2020-12')
    .action(async (file, options, cmd) => {
      // Parse form, call formToJsonSchema, output result
    });
}
```

### Example Output

For a simple form:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "movie_research_basic",
  "title": "Movie Research (Basic)",
  "description": "Standard research form for gathering ratings...",
  "type": "object",
  "x-markform": {
    "spec": "MF/0.1",
    "roles": ["user", "agent"],
    "roleInstructions": {
      "user": "Enter the movie title...",
      "agent": "Research and fill in all fields..."
    },
    "groups": [
      { "id": "movie_input", "title": "Movie Identification" },
      { "id": "sources", "title": "Sources" }
    ]
  },
  "properties": {
    "movie": {
      "type": "string",
      "title": "Movie",
      "description": "Enter the movie title (add any details to help identify...)",
      "minLength": 1,
      "maxLength": 300,
      "x-markform": {
        "role": "user",
        "priority": "medium",
        "group": "movie_input"
      }
    },
    "year": {
      "type": "integer",
      "title": "Release Year",
      "minimum": 1888,
      "maximum": 2030,
      "x-markform": {
        "role": "agent",
        "priority": "medium",
        "group": "basic_details"
      }
    },
    "directors": {
      "type": "array",
      "title": "Director(s)",
      "description": "One director per line...",
      "items": { "type": "string" },
      "x-markform": {
        "role": "agent",
        "group": "basic_details"
      }
    },
    "mpaa_rating": {
      "type": "string",
      "title": "MPAA Rating",
      "enum": ["g", "pg", "pg_13", "r", "nc_17", "nr"],
      "x-markform": {
        "role": "agent",
        "group": "basic_details"
      }
    }
  },
  "required": ["movie", "full_title", "imdb_url", "year", "directors"]
}
```

### Reusable Components

From codebase exploration:

- `engine/coreTypes.ts` — All field type definitions and Zod schemas

- `engine/parse.ts` — `parseForm()` for loading forms

- `cli/lib/shared.ts` — `formatOutput()`, `getCommandContext()`, `readFile()`

- `cli/lib/formatting.ts` — Output formatting utilities

- Existing command patterns in `cli/commands/inspect.ts`, `cli/commands/export.ts`

## Stage 3: Refine Architecture

### Reuse Opportunities Found

1. **Output formatting**: Use existing `formatOutput()` from `cli/lib/shared.ts`

2. **Command context**: Use `getCommandContext()` for format/verbose handling

3. **Form loading**: Use `parseForm()` directly

4. **Export patterns**: Follow `export.ts` structure for JSON/YAML output

### Simplified Architecture

No changes needed from Stage 2 — the architecture is already minimal:

- One new engine file (`jsonSchema.ts`)

- One new CLI command file (`schema.ts`)

- Minor updates to `index.ts` exports

### Implementation Phases

**Phase 1: Core Engine Implementation**

- [ ] Create `engine/jsonSchema.ts` with types and core conversion

- [ ] Implement `fieldToJsonSchema()` for all 11 field types

- [ ] Implement `formToJsonSchema()` wrapping field conversions

- [ ] Add description lookup from doc blocks

- [ ] Add unit tests for each field type mapping

**Phase 2: CLI Command**

- [ ] Create `cli/commands/schema.ts`

- [ ] Register command in `cli/cli.ts`

- [ ] Support `--pure` and `--draft` options

- [ ] Support JSON/YAML output via global `--format`

**Phase 3: Golden Tests & Integration**

- [ ] Add dev dependencies: `ajv`, `ajv-formats`

- [ ] Create `tests/golden/schemaRunner.ts` with test utilities

- [ ] Create `tests/golden/schemaGolden.test.ts`

- [ ] Generate initial snapshots: `simple.schema.json`,
  `movie-research-basic.schema.json`

- [ ] Create `scripts/regen-schema-snapshots.ts` for regeneration

- [ ] Export `formToJsonSchema` from `index.ts`

**Phase 4: Documentation**

- [ ] Update DOCS.md with schema command documentation

- [ ] Add example output to README

## Stage 4: Validation Stage

### Test Plan

**1. Unit tests** (`tests/unit/jsonSchema.test.ts`):

- Each field type → JSON Schema mapping

- Required vs optional field handling

- Constraint mapping (min/max/pattern)

- Description extraction from doc blocks

- `--pure` mode strips extensions

**2. Schema Golden Tests** (`tests/golden/schemaGolden.test.ts`):

Schema golden tests follow a different pattern from session golden tests because schemas
are static (deterministic from form structure, no turns involved):

```
examples/
  simple/
    simple.form.md
    simple.schema.json           # Expected schema snapshot
  movie-research/
    movie-research-basic.form.md
    movie-research-basic.schema.json
```

**Test runner** (`tests/golden/schemaRunner.ts`):

1. Load form and generate JSON Schema via `formToJsonSchema()`

2. **Meta-validate**: Use Ajv to confirm output is valid JSON Schema

3. **Snapshot compare**: Compare against `.schema.json` snapshot file

4. Report diff on mismatch for easy debugging

**Regeneration script** (`scripts/regen-schema-snapshots.ts`):

- Regenerate all `.schema.json` files when schema format changes intentionally

- Similar to existing `scripts/regen-golden-sessions.ts`

**3. Schema usability tests**:

- Load a completed form, extract values

- Validate values against the generated schema using Ajv

- This ensures schemas are not just syntactically valid but actually work

### Dev Dependencies to Add

```json
{
  "devDependencies": {
    "ajv": "^8.17.0",
    "ajv-formats": "^3.0.0"
  }
}
```

**Ajv** is the standard JSON Schema validator.
We use it for:

- Meta-validation (is our output valid JSON Schema?)

- Value validation tests (can the schema validate real form data?)

### Schema Test Implementation

```ts
// tests/golden/schemaRunner.ts
export interface SchemaTestResult {
  success: boolean;
  formPath: string;
  snapshotPath: string;
  errors: string[];
  schemaValid: boolean;      // Is it valid JSON Schema?
  snapshotMatch: boolean;    // Does it match the snapshot?
  diff?: string;             // For debugging mismatches
}

export function runSchemaTest(formPath: string): SchemaTestResult;
export function findSchemaTestForms(dir: string): string[];
export function regenerateSchemaSnapshot(formPath: string): void;
```

### Success Criteria

- [ ] All unit tests pass

- [ ] Schema golden tests pass for all example forms with snapshots

- [ ] Generated schemas validate with Ajv (meta-validation)

- [ ] Form values validate against generated schemas (usability test)

- [ ] `markform schema examples/movie-research/movie-research-basic.form.md` works

- [ ] `--pure` output contains no `x-markform` properties

- [ ] Engine API works without CLI (importable from library)

- [ ] Regeneration script works for updating snapshots
