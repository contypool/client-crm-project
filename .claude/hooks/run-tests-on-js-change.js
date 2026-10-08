// Claude Code PostToolUse hook: runs `node --test` after a .js file in the project is edited.
// Reads the hook JSON from stdin, never writes files.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const TEST_TIMEOUT_MS = 90_000;
const MAX_OUTPUT_CHARS = 8000;

export function shouldRunTests(filePath, projectDir) {
  if (typeof filePath !== 'string' || filePath.trim() === '') return false;
  if (typeof projectDir !== 'string' || projectDir.trim() === '') return false;
  if (path.extname(filePath).toLowerCase() !== '.js') return false;

  const relative = path.relative(path.resolve(projectDir), path.resolve(projectDir, filePath));
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function tail(text, limit) {
  return text.length > limit ? `…\n${text.slice(-limit)}` : text;
}

function summary(output) {
  const pick = (name) => output.match(new RegExp(`^ℹ ${name} (\\d+)`, 'm'))?.[1] ?? '?';
  return `tests ${pick('tests')}, pass ${pick('pass')}, fail ${pick('fail')}`;
}

function main() {
  let input;
  try {
    // Windows PowerShell pipes may prepend a BOM.
    input = JSON.parse(readFileSync(0, 'utf8').replace(/^﻿/, ''));
  } catch {
    return 0;
  }

  const projectDir = process.env.CLAUDE_PROJECT_DIR || path.resolve(import.meta.dirname, '..', '..');
  const filePath = input?.tool_input?.file_path;
  if (!shouldRunTests(filePath, projectDir)) return 0;

  const shownPath = path.relative(projectDir, path.resolve(projectDir, filePath)).split(path.sep).join('/');
  const result = spawnSync(process.execPath, ['--test'], {
    cwd: projectDir,
    encoding: 'utf8',
    timeout: TEST_TIMEOUT_MS,
    windowsHide: true,
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;

  if (result.error?.code === 'ETIMEDOUT') {
    process.stderr.write(`node --test timed out after ${TEST_TIMEOUT_MS / 1000}s after editing ${shownPath}\n${tail(output, MAX_OUTPUT_CHARS)}`);
    return 2;
  }
  if (result.error || result.status !== 0) {
    const reason = result.error ? result.error.message : `exit code ${result.status}`;
    process.stderr.write(`node --test failed (${reason}) after editing ${shownPath}\n${tail(output, MAX_OUTPUT_CHARS)}`);
    return 2;
  }

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: `node --test passed after editing ${shownPath}: ${summary(output)}`,
    },
  }));
  return 0;
}

if (import.meta.main) {
  process.exitCode = main();
}
