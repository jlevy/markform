/**
 * CLI version helper that computes git version in development mode.
 *
 * When running via tsx (development), __MARKFORM_VERSION__ is not injected,
 * so VERSION from index.ts returns 'development'. This module computes the
 * actual git version dynamically for consistent version display.
 */

import { execSync } from 'node:child_process';
import { VERSION } from '../../index.js';

/**
 * Get version from git tags with format: X.Y.Z-dev.N.hash
 * Only called when running in development mode (via tsx).
 */
function getGitVersion(): string {
  try {
    const git = (args: string) =>
      execSync(`git ${args}`, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

    const tag = git('describe --tags --abbrev=0');
    const tagVersion = tag.replace(/^v/, '');
    const [major, minor, patch] = tagVersion.split('.').map(Number);
    const commitsSinceTag = parseInt(git(`rev-list ${tag}..HEAD --count`), 10);
    const hash = git('rev-parse --short=7 HEAD');

    let dirty = false;
    try {
      git('diff --quiet');
      git('diff --cached --quiet');
    } catch {
      dirty = true;
    }

    if (commitsSinceTag === 0 && !dirty) {
      return tagVersion;
    }

    const bumpedPatch = (patch ?? 0) + 1;
    const suffix = dirty ? `${hash}-dirty` : hash;
    return `${major}.${minor}.${bumpedPatch}-dev.${commitsSinceTag}.${suffix}`;
  } catch {
    return 'development';
  }
}

/**
 * CLI version - uses build-time VERSION if available, otherwise computes from git.
 */
export const CLI_VERSION: string = VERSION === 'development' ? getGitVersion() : VERSION;
