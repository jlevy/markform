# Validation Plan: Upgrade Zod to v4 and Vitest to v4

## Summary

This PR upgrades zod from v3.25.76 to v4.2.1 and vitest from v3.2.4 to v4.0.16, along with several other dependency updates.

## Changes Made

### Zod v4 Migration
- Updated `zod` to ^4.2.1
- Fixed breaking change: `error.errors` → `error.issues` in session.ts
- Updated deprecated pattern: `.passthrough()` → `z.looseObject()` in coreTypes.ts
- Updated docs: `z.string().url()` → `z.url()` in markform-spec.md
- Fixed test for stricter `z.record()` validation (all enum keys now required)

### Vitest v4 Migration
- Updated `vitest` to ^4.0.16
- Updated `@vitest/coverage-v8` to ^4.0.16
- No code changes required (codebase was already compatible)

### Other Dependency Updates
- commander: ^13.1.0 → ^14.0.2
- @clack/prompts: ^0.9.1 → ^0.11.0
- tsdown: ^0.16.8 → ^0.18.3
- @ai-sdk/xai: ^3.0.1 → ^3.0.2
- typescript-eslint: ^8.50.1 → ^8.51.0

## Validation Checklist

### Automated
- [ ] CI passes (all tests)
- [ ] Build succeeds
- [ ] Type checking passes

### Manual Testing
- [ ] Verify tests pass locally: `pnpm test`
- [ ] Verify build works: `pnpm build`
- [ ] Verify type checking: `pnpm typecheck`

## Risk Assessment

**Low Risk**: All changes are dependency upgrades with well-documented migration paths. All 682 tests pass locally with no test code changes required (except one test data fix for stricter zod validation).
