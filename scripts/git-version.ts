#!/usr/bin/env npx tsx
/**
 * Git-based dynamic versioning for npm packages.
 *
 * Generates version strings from git tags following this format:
 * - On a tag: `1.2.3` (just the version)
 * - After a tag: `1.2.4-dev.12.a1b2c3d` (bumped patch + dev.commits.hash)
 *
 * This format:
 * - Is valid semver (works with npm)
 * - Preserves the hash in pre-release (npm strips build metadata +hash)
 * - Sorts correctly: 1.2.3 < 1.2.4-dev.1.abc < 1.2.4-dev.2.def < 1.2.4
 *
 * Usage:
 *   As CLI: npx tsx scripts/git-version.ts
 *   As module: import { getGitVersion } from './scripts/git-version.ts'
 */

import { execSync } from 'node:child_process';

export interface GitVersionInfo {
  /** Full version string (e.g., "1.2.4-dev.12.a1b2c3d" or "1.2.3") */
  version: string;
  /** Base version from tag (e.g., "1.2.3") */
  tagVersion: string;
  /** Number of commits since tag (0 if on tag) */
  commitsSinceTag: number;
  /** Short git hash (7 chars) */
  hash: string;
  /** Whether working directory has uncommitted changes */
  dirty: boolean;
  /** Whether we're exactly on a tag */
  onTag: boolean;
}

/**
 * Execute a git command and return trimmed output.
 */
function git(args: string): string {
  return execSync(`git ${args}`, {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

/**
 * Parse a version tag like "v1.2.3" into [major, minor, patch].
 */
function parseVersion(tag: string): [number, number, number] {
  const version = tag.replace(/^v/, '');
  const [major, minor, patch] = version.split('.').map(Number);
  return [major ?? 0, minor ?? 0, patch ?? 0];
}

/**
 * Bump the patch version.
 */
function bumpPatch(version: string): string {
  const [major, minor, patch] = parseVersion(version);
  return `${major}.${minor}.${patch + 1}`;
}

/**
 * Get version information from git.
 *
 * @param bump - If true, bump patch version for dev builds (recommended).
 *               This ensures dev versions sort before the next release.
 * @returns Version info object
 */
export function getGitVersion(bump = true): GitVersionInfo {
  try {
    // Get the most recent tag
    const tag = git('describe --tags --abbrev=0');
    const tagVersion = tag.replace(/^v/, '');

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

    const onTag = commitsSinceTag === 0;

    let version: string;
    if (onTag && !dirty) {
      // Exactly on a tag with clean working directory
      version = tagVersion;
    } else {
      // Dev version: bump patch (if enabled), add commits and hash
      const baseVersion = bump ? bumpPatch(tagVersion) : tagVersion;
      const suffix = dirty ? `${hash}-dirty` : hash;
      version = `${baseVersion}-dev.${commitsSinceTag}.${suffix}`;
    }

    return {
      version,
      tagVersion,
      commitsSinceTag,
      hash,
      dirty,
      onTag,
    };
  } catch {
    // No tags or not a git repository - fall back to package.json
    try {
      const hash = git('rev-parse --short=7 HEAD');
      return {
        version: `0.0.0-dev.0.${hash}`,
        tagVersion: '0.0.0',
        commitsSinceTag: 0,
        hash,
        dirty: false,
        onTag: false,
      };
    } catch {
      // Not a git repository at all
      return {
        version: '0.0.0-dev',
        tagVersion: '0.0.0',
        commitsSinceTag: 0,
        hash: 'unknown',
        dirty: false,
        onTag: false,
      };
    }
  }
}

// CLI mode: print version info when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const info = getGitVersion();
  console.log(JSON.stringify(info, null, 2));
}
