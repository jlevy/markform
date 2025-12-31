/**
 * Regenerate SHA256 hashes in session files.
 * Run after serialization format changes.
 *
 * This script preserves the original YAML structure (snake_case keys)
 * and only updates the markdown_sha256 values.
 */
/* eslint-disable no-console */

import { createHash } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { parseForm, serialize, applyPatches, parseSession } from '../dist/index.mjs';

const sha256 = (str) => createHash('sha256').update(str).digest('hex');

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgDir = join(__dirname, '..');

const sessions = [
  'examples/simple/simple.session.yaml',
  'examples/simple/simple-with-skips.session.yaml',
  'examples/rejection-test/rejection-test.session.yaml',
];

for (const sessionRelPath of sessions) {
  const sessionPath = join(pkgDir, sessionRelPath);

  try {
    let sessionYaml = readFileSync(sessionPath, 'utf-8');
    const session = parseSession(sessionYaml);

    // Load template form
    const baseDir = dirname(sessionPath);
    const formPath = join(baseDir, session.form.path);
    const formContent = readFileSync(formPath, 'utf-8');
    let form = parseForm(formContent);

    let changed = false;

    // Replay each turn and update hashes
    for (const turn of session.turns) {
      // Apply patches
      applyPatches(form, turn.apply.patches);
      const markdown = serialize(form);
      const newHash = sha256(markdown);
      const oldHash = turn.after.markdownSha256;

      if (newHash !== oldHash) {
        console.log(sessionRelPath + ' turn ' + turn.turn + ':');
        console.log('  OLD: ' + oldHash);
        console.log('  NEW: ' + newHash);

        // Replace the hash in the original YAML string to preserve formatting
        sessionYaml = sessionYaml.replace(
          new RegExp('markdown_sha256:\\s*' + oldHash),
          'markdown_sha256: ' + newHash,
        );
        changed = true;
      }
    }

    if (changed) {
      writeFileSync(sessionPath, sessionYaml);
      console.log('Updated: ' + sessionRelPath);
    } else {
      console.log('No changes: ' + sessionRelPath);
    }
  } catch (err) {
    console.error('Error processing ' + sessionRelPath + ': ' + err.message);
  }
}

console.log('Done.');
