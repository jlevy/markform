# Publishing

This project uses [Changesets](https://github.com/changesets/changesets) for version
management and tag-based releases.

## During Development

Merge PRs to `main` without creating changesets. Changesets are created only at release
time.

## Release Workflow

Follow these steps to publish a new version. All commands are non-interactive and can be
run by an agent or human.

### Step 1: Prepare

```bash
git checkout main
git pull
git status  # Must be clean
```

### Step 2: Determine Version

Review changes since last release:

```bash
git log $(git describe --tags --abbrev=0 2>/dev/null || echo "HEAD~20")..HEAD --oneline
```

Choose version bump:

- `patch` (0.1.0 → 0.1.1): Bug fixes, docs, internal changes
- `minor` (0.1.0 → 0.2.0): New features, non-breaking changes
- `major` (0.1.0 → 1.0.0): Breaking changes

### Step 3: Create Changeset

Write the changeset file with target version as filename:

```bash
cat > .changeset/v0.2.0.md << 'EOF'
---
"markform": minor
---

Summary of changes for the changelog.
EOF
```

Commit:

```bash
git add .changeset
git commit -m "chore: add changeset for v0.2.0"
```

### Step 4: Version Packages

Run changesets to bump version and update CHANGELOG:

```bash
pnpm version-packages
```

Review and commit:

```bash
git diff  # Verify package.json and CHANGELOG.md
git add .
git commit -m "chore: release markform v0.2.0"
git push
```

### Step 5: Tag and Release

```bash
git tag v0.2.0
git push --tags
```

### Step 6: Verify

```bash
gh run list --limit 1  # Check release workflow started
```

The GitHub Actions workflow will build and publish to npm.

## Quick Reference

```bash
# Full release sequence (replace version as needed)
git checkout main && git pull
cat > .changeset/v0.2.0.md << 'EOF'
---
"markform": minor
---
Summary of changes.
EOF
git add .changeset && git commit -m "chore: add changeset for v0.2.0"
pnpm version-packages
git add . && git commit -m "chore: release markform v0.2.0"
git push && git tag v0.2.0 && git push --tags
```

## Prerequisites

For npm publishing:

- `NPM_TOKEN` secret must be set in GitHub repository settings
- Token needs publish permissions for the `markform` package

## Troubleshooting

**Release workflow not running?**

- Ensure tag format is `v*` (e.g., `v0.2.0`)
- Check tag was pushed: `git ls-remote --tags origin`

**npm publish failing?**

- Verify `NPM_TOKEN` is set in GitHub secrets
- Check token has publish permissions

## Alternative: Interactive Mode

For humans who prefer prompts, use `pnpm changeset` instead of writing the file directly.
It will prompt for package selection, bump type, and description.
