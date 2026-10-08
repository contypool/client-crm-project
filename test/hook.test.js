import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { shouldRunTests } from '../.claude/hooks/run-tests-on-js-change.js';

const projectDir = path.resolve('C:/Users/Some User/client crm');
const inside = (...parts) => path.join(projectDir, ...parts);

test('shouldRunTests: .js files inside the project trigger tests', () => {
  assert.equal(shouldRunTests(inside('src', 'app.js'), projectDir), true);
  assert.equal(shouldRunTests(inside('test', 'clients.test.js'), projectDir), true);
  assert.equal(shouldRunTests(inside('server.js'), projectDir), true);
});

test('shouldRunTests: extension check ignores case', () => {
  assert.equal(shouldRunTests(inside('src', 'APP.JS'), projectDir), true);
});

test('shouldRunTests: relative paths are resolved against the project', () => {
  assert.equal(shouldRunTests('src/app.js', projectDir), true);
  assert.equal(shouldRunTests('../other/app.js', projectDir), false);
});

test('shouldRunTests: non-JavaScript files are skipped', () => {
  for (const name of ['README.md', 'CLAUDE.md', 'styles.css', 'package.json', 'index.html', '.gitignore']) {
    assert.equal(shouldRunTests(inside(name), projectDir), false, name);
  }
  assert.equal(shouldRunTests(inside('.claude', 'settings.json'), projectDir), false);
});

test('shouldRunTests: only .js, not .mjs, .cjs or .json', () => {
  assert.equal(shouldRunTests(inside('src', 'a.mjs'), projectDir), false);
  assert.equal(shouldRunTests(inside('src', 'a.cjs'), projectDir), false);
  assert.equal(shouldRunTests(inside('src', 'a.js.json'), projectDir), false);
  assert.equal(shouldRunTests(inside('src', 'js'), projectDir), false);
});

test('shouldRunTests: files outside the project are skipped', () => {
  assert.equal(shouldRunTests(path.resolve('C:/Users/Some User/other/app.js'), projectDir), false);
  assert.equal(shouldRunTests(path.resolve('C:/Users/Some User/client crm2/app.js'), projectDir), false);
});

test('shouldRunTests: missing or empty input is skipped', () => {
  assert.equal(shouldRunTests(undefined, projectDir), false);
  assert.equal(shouldRunTests('', projectDir), false);
  assert.equal(shouldRunTests('   ', projectDir), false);
  assert.equal(shouldRunTests(42, projectDir), false);
  assert.equal(shouldRunTests(inside('src', 'app.js'), ''), false);
  assert.equal(shouldRunTests(inside('src', 'app.js'), undefined), false);
});
