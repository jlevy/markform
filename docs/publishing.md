# Publishing

This project uses [Changesets](https://github.com/changesets/changesets) for version
management and tag-based releases.

## During Development

Merge PRs to `main` without creating changesets. Changesets are created only at release
time.

## Release Workflow

Follow these steps when ready to publish a new version.

### Step 1: Ensure Main is Clean

```bash
git checkout main
git pull
git status  # Should show clean working tree
```

### Step 2: Review Changes Since Last Release

```bash
# See commits since last tag
git log $(git describe --tags --abbrev=0)..HEAD --oneline

# Determine version bump:
# - patch (0.1.0 → 0.1.1): Bug fixes, docs, internal changes
# - minor (0.1.0 → 0.2.0): New features, non-breaking changes
# - major (0.1.0 → 1.0.0): Breaking changes
```

### Step 3: Create Changeset

#### Option A: Interactive (Human)

```bash
pnpm changeset
```

When prompted: select `markform`, choose bump type, write summary.

#### Option B: Non-Interactive (Agent/Script)

Write a changeset file directly, naming it with the target version:

```bash
cat > .changeset/v0.2.0.md << 'EOF'
---
"markform": minor
---

Add examples CLI command and improve form validation.
EOF
```

Format:
- Filename: `vX.Y.Z.md` matching your target version
- YAML frontmatter with `"package-name": patch|minor|major`
- Description becomes the CHANGELOG entry

Commit the changeset:

```bash
git add .changeset
git commit -m "chore: add changeset for release"
```

### Step 4: Version Packages

```bash
pnpm version-packages
```

This updates `package.json` version and `CHANGELOG.md`. Review the changes:

```bash
git diff
```

Commit and push:

```bash
git add .
git commit -m "chore: release markform vX.Y.Z"
git push
```

### Step 5: Create and Push Tag

```bash
# Use the version from package.json
git tag v0.2.0
git push --tags
```

### Step 6: Verify Release

The GitHub Actions workflow will:

1. Build the package
2. Run publint validation
3. Publish to npm (requires `NPM_TOKEN` secret)

Check the release:

```bash
gh run list --limit 1
```

## Prerequisites

For npm publishing:

- `NPM_TOKEN` secret must be set in GitHub repository settings
- Token needs publish permissions for the `markform` package

## Quick Reference

| Step | Command |
| --- | --- |
| Create changeset | `pnpm changeset` |
| Bump versions | `pnpm version-packages` |
| Tag release | `git tag vX.Y.Z && git push --tags` |
| Check CI | `gh run list --limit 1` |

## Troubleshooting

**Release workflow not running?**
- Ensure tag format is `v*` (e.g., `v0.2.0`)
- Check that tag was pushed: `git ls-remote --tags origin`

**npm publish failing?**
- Verify `NPM_TOKEN` is set in GitHub secrets
- Check token has publish permissions
- Ensure package name isn't taken on npm
