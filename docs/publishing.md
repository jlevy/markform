# Publishing

This project uses [Changesets](https://github.com/changesets/changesets) for version
management and tag-based releases with OIDC trusted publishing to npm.

## One-Time Setup

Before the first release, complete these steps:

### 1. Manual First Publish

The package must exist on npm before OIDC can be configured.
Run from the package directory (important: the root `.npmrc` has pnpm-specific config
that confuses npm):

```bash
cd packages/markform
npm publish --access public
```

This will prompt for web-based authentication in your browser.

### 2. Configure OIDC Trusted Publishing on npm

1. Go to https://www.npmjs.com/package/markform/access

2. Under “Publishing access”, click “Configure Trusted Publishing”

3. Add the GitHub repository: `jlevy/markform`

4. Leave environment blank (allows any workflow) or set to `release`

### 3. Verify Repository is Public

OIDC trusted publishing requires a public GitHub repository.

## During Development

Merge PRs to `main` without creating changesets.
Changesets are created only at release time.

## Release Workflow

Follow these steps to publish a new version.
All commands are non-interactive and can be run by an agent or human.

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
gh run view --log      # Watch progress
```

The GitHub Actions workflow will build and publish to npm using OIDC authentication.

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

## How OIDC Publishing Works

This project uses npm’s trusted publishing via OIDC (OpenID Connect):

- **No tokens to manage**: GitHub Actions presents an OIDC identity to npm

- **No secrets to rotate**: npm issues a one-time credential for each workflow run

- **Provenance attestation**: Published packages include signed build provenance

The release workflow (`.github/workflows/release.yml`) triggers on `v*` tags and
publishes automatically without requiring an `NPM_TOKEN` secret.

## Troubleshooting

**Release workflow not running?**

- Ensure tag format is `v*` (e.g., `v0.2.0`)

- Check tag was pushed: `git ls-remote --tags origin`

**npm publish failing with 401/403?**

- Verify OIDC is configured: https://www.npmjs.com/package/markform/access

- Check repository is listed under “Trusted Publishing”

- Ensure the repository is public

**First publish?**

- OIDC requires the package to already exist on npm

- Do a manual `npm publish --access public` first (see One-Time Setup)

## Alternative: Interactive Mode

For humans who prefer prompts, use `pnpm changeset` instead of writing the file
directly. It will prompt for package selection, bump type, and description.

## Installing from Git (Bleeding Edge)

To use the latest unreleased code directly from GitHub:

```bash
# pnpm
pnpm add "github:jlevy/markform#path:packages/markform"

# npm
npm install "github:jlevy/markform#path:packages/markform"
```

This runs the `prepare` script to build from source.
