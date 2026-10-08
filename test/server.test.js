import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createAppServer } from '../server.js';

let server;
let port;

before(async () => {
  server = createAppServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = server.address().port;
});

after(() => new Promise((resolve) => server.close(resolve)));

// node:http sends the path exactly as given (fetch would normalize "..").
function get(path, serverPort = port) {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port: serverPort, path }, (response) => {
      response.resume();
      response.on('end', () => resolve({ status: response.statusCode, type: response.headers['content-type'] }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('serves the page at /', async () => {
  assert.deepEqual(await get('/'), { status: 200, type: 'text/html; charset=utf-8' });
});

test('serves styles and scripts with the right content type', async () => {
  assert.deepEqual(await get('/styles.css'), { status: 200, type: 'text/css; charset=utf-8' });
  assert.deepEqual(await get('/src/app.js'), { status: 200, type: 'text/javascript; charset=utf-8' });
});

test('answers 404 for a missing file', async () => {
  assert.equal((await get('/missing.js')).status, 404);
});

test('answers 404 for a file type that is not served', async () => {
  assert.equal((await get('/package.json')).status, 404);
  assert.equal((await get('/.git/config')).status, 404);
});

test('plain ".." cannot leave the project: the URL is resolved against the root first', async () => {
  assert.equal((await get('/../../index.html')).status, 200);
});

test('encoded ".." cannot reach an existing file outside the served folder', async () => {
  // temp/site is served; temp/outside.js exists right next to it.
  const temp = await mkdtemp(join(tmpdir(), 'client-crm-'));
  const site = join(temp, 'site');
  await mkdir(site);
  await writeFile(join(site, 'index.html'), '<!doctype html>');
  await writeFile(join(temp, 'outside.js'), 'secret');

  const sandbox = createAppServer(site);
  await new Promise((resolve) => sandbox.listen(0, '127.0.0.1', resolve));
  const sandboxPort = sandbox.address().port;
  try {
    assert.equal((await get('/', sandboxPort)).status, 200);
    assert.equal((await get('/%2e%2e%2foutside.js', sandboxPort)).status, 404);
    assert.equal((await get('/%2e%2e%5coutside.js', sandboxPort)).status, 404);
    assert.equal((await get('/sub/%2e%2e%2f%2e%2e%2foutside.js', sandboxPort)).status, 404);
  } finally {
    await new Promise((resolve) => sandbox.close(resolve));
    await rm(temp, { recursive: true, force: true });
  }
});

test('answers 400 for a malformed URL and keeps working', async () => {
  assert.equal((await get('/%E0%A4%A')).status, 400);
  assert.equal((await get('/%')).status, 400);
  assert.equal((await get('/')).status, 200);
});
