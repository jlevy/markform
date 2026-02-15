import { execSync } from 'node:child_process';
import { defineConfig } from 'tsdown';

import pkg from './package.json' with { type: 'json' };

/**
 * Get version from git tags with format: X.Y.Z-dev.N.hash
 *
 * - On tag: "1.2.3"
 * - After tag: "1.2.4-dev.12.a1b2c3d" (bumped patch + commits + hash)
 * - Dirty: "1.2.4-dev.12.a1b2c3d-dirty"
 *
 * Falls back to package.json version if not in a git repo.
 */
function getGitVersion(): string {
  try {
    const git = (args: string) =>
      execSync(`git ${args}`, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

    // Get the most recent tag and parse it
    const tag = git('describe --tags --abbrev=0');
    const tagVersion = tag.replace(/^v/, '');
    const [major, minor, patch] = tagVersion.split('.').map(Number);

    // Get commits since tag
    const commitsSinceTag = parseInt(git(`rev-list ${tag}..HEAD --count`), 10);

    // Get short hash
    const hash = git('rev-parse --short=7 HEAD');

    // Check for dirty working directory
    let dirty = false;
    try {
      git('diff --quiet');
      git('diff --cached --quiet');
    } catch {
      dirty = true;
    }

    if (commitsSinceTag === 0 && !dirty) {
      // Exactly on a tag with clean working directory
      return tagVersion;
    }

    // Dev version: bump patch, add commits and hash
    const bumpedPatch = (patch ?? 0) + 1;
    const suffix = dirty ? `${hash}-dirty` : hash;
    return `${major}.${minor}.${bumpedPatch}-dev.${commitsSinceTag}.${suffix}`;
  } catch {
    // Not a git repo or no tags - fall back to package.json
    return pkg.version;
  }
}

const version = getGitVersion();

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'src/cli/cli.ts',
    bin: 'src/cli/bin.ts',
    'ai-sdk': 'src/integrations/vercelAiSdkTools.ts',
    render: 'src/render/index.ts',
  },
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  sourcemap: true,
  dts: true,
  clean: true,
  // tsdown 0.20+ treats inlined dependencies as errors by default; suppress with false
  inlineOnly: false,
  banner: ({ fileName }) => (fileName.includes('bin') ? '#!/usr/bin/env node\n' : ''),
  define: {
    __MARKFORM_VERSION__: JSON.stringify(version),
  },
});
