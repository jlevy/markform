# Publishing

This project uses [Changesets](https://github.com/changesets/changesets) for version management and tag-based releases.

## Release Workflow

### 1. Track Changes with Changesets

When making user-facing changes, create a changeset:

```bash
pnpm changeset
```

Follow the prompts to:
- Select which packages changed
- Choose version bump type (patch/minor/major)
- Describe the change

Changeset files (`.changeset/*.md`) are committed with your PR.

### 2. Version Packages

When ready to release, consume changesets and bump versions:

```bash
pnpm version-packages
```

This:
- Consumes all `.changeset/*.md` files
- Updates `package.json` versions
- Updates `CHANGELOG.md`

Commit the version bump:

```bash
git add .
git commit -m "chore: version packages"
```

### 3. Create Release Tag

Push a version tag to trigger the release workflow:

```bash
git tag v0.1.0
git push origin main --tags
```

The tag format must be `v*` (e.g., `v0.1.0`, `v1.0.0-beta.1`).

### 4. Automated Publishing

The GitHub Actions release workflow (`.github/workflows/release.yml`) runs on version tags and:
1. Builds the package
2. Validates with publint
3. Publishes to npm via `changeset publish`

## Prerequisites

For npm publishing to work:
- Set `NPM_TOKEN` secret in GitHub repository settings
- Token must have publish permissions for the package

## Quick Reference

| Command | Description |
| --- | --- |
| `pnpm changeset` | Create a changeset for your changes |
| `pnpm version-packages` | Bump versions and update changelogs |
| `pnpm release` | Build and publish (CI only) |

## Manual Local Publishing (Not Recommended)

For testing or emergencies:

```bash
pnpm build
pnpm publint
npm publish --access public
```

Prefer tag-based releases for traceability.
