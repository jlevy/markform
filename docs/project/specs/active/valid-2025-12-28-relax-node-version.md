# Feature Validation: Relax Node.js Version Requirement

## Purpose

This validation spec documents the testing performed to verify that relaxing the Node.js
requirement from v24 to v20 does not break any functionality.

**Feature Plan:** N/A (maintenance/chore task)

**Implementation Plan:** N/A (maintenance/chore task)

## Summary of Changes

Relaxed Node.js minimum version requirement from v24 to v20:

- `package.json`: `engines.node >= 20` (was `>= 24`)
- `tsdown.config.ts`: `target: 'node20'` (was `node24`)
- `tsconfig.base.json`: ES2023 lib/target (was ES2024)
- `.github/workflows/ci.yml`: `node-version: 20` (was `24`)
- Documentation updated in README.md and development.md

## Rationale

**Code Analysis:**
- No Node.js 24-specific features are used in the codebase
- `structuredClone` (used in 1 place) is stable since Node 18
- All other Node APIs used are available in Node 14+

**Dependency Requirements:**
- `ai` (Vercel AI SDK): Node >= 18
- `@ai-sdk/anthropic`: Node >= 18
- `@ai-sdk/openai`: Node >= 18
- `@markdoc/markdoc`: Node >= 14.7

**Node.js LTS Schedule:**
- Node 18: EOL April 2025 (no longer supported)
- Node 20: Maintenance LTS until April 2026
- Node 22: Active LTS

Node 20 was chosen as the minimum because it's the oldest currently-supported LTS
version, maximizing accessibility for users via `npx` and other package managers.

## Automated Validation (Testing Performed)

### Build Validation

- Build succeeds with `target: 'node20'` in tsdown.config.ts
- TypeScript compilation succeeds with `ES2023` lib/target
- publint validates package exports correctly

### Unit Testing

All 566 unit tests pass with Node 20 target configuration:

- `tests/unit/engine/*.test.ts` - Core engine tests (parsing, serialization, validation)
- `tests/unit/cli/*.test.ts` - CLI command tests
- `tests/unit/harness/*.test.ts` - Harness and agent tests
- `tests/unit/integrations/*.test.ts` - AI SDK integration tests
- `tests/unit/web/*.test.ts` - Web UI rendering tests

### Integration and End-to-End Testing

- `tests/integration/programmaticFill.test.ts` - 10 integration tests pass
- `tests/golden/golden.test.ts` - 3 golden session tests pass

### Pre-commit Checks

All pre-commit hooks pass:
- `pnpm lint` - No lint errors
- `pnpm typecheck` - No type errors
- `pnpm build` - Build succeeds
- `pnpm publint` - Package exports valid
- `pnpm test` - All tests pass

## Manual Testing Needed

### CI Validation

- [ ] Verify GitHub Actions CI passes with Node 20 configuration
- [ ] Confirm the CI workflow uses Node 20 as specified

### npm Package Validation (Optional)

If publishing a new version:

- [ ] Verify `npx markform examples` works on a system with Node 20
- [ ] Verify `npx markform examples` works on a system with Node 22
- [ ] Verify the package installs correctly on Node 20+

### Documentation Review

- [ ] Review README.md shows correct Node.js requirement (20+)
- [ ] Review docs/development.md has correct setup instructions
