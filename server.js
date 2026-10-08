// Minimal static file server for local development.
// Browsers block ES modules opened directly from disk (file://), so the page is served over http.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT) || 3000;

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

// Returns the requested path relative to the served folder, or null for a malformed URL.
function requestedPath(requestUrl) {
  try {
    const { pathname } = new URL(requestUrl, `http://${HOST}`);
    return pathname === '/' ? 'index.html' : decodeURIComponent(pathname).slice(1);
  } catch {
    return null;
  }
}

async function handleRequest(root, request, response) {
  const relativePath = requestedPath(request.url);
  if (relativePath === null) {
    response.writeHead(400).end('Bad request');
    return;
  }

  const filePath = normalize(join(root, relativePath));
  const contentType = CONTENT_TYPES[extname(filePath)];

  // root ends with a path separator, so this also rejects "../" escapes.
  if (!filePath.startsWith(root) || !contentType) {
    response.writeHead(404).end('Not found');
    return;
  }

  try {
    const body = await readFile(filePath);
    response.writeHead(200, { 'Content-Type': contentType }).end(body);
  } catch {
    response.writeHead(404).end('Not found');
  }
}

// An unexpected error answers 500 instead of stopping the server.
// `rootDir` is the folder to serve (the project folder by default; tests pass a temporary one).
export function createAppServer(rootDir = ROOT) {
  const root = rootDir.endsWith(sep) ? rootDir : rootDir + sep;
  return createServer((request, response) => {
    handleRequest(root, request, response).catch(() => {
      if (!response.headersSent) {
        response.writeHead(500);
      }
      response.end('Internal server error');
    });
  });
}

// Start only when run as `node server.js`, not when imported by tests.
// import.meta.main appeared in Node 24.2; the argv check covers earlier 24.x.
const isEntryPoint = import.meta.main ?? process.argv[1] === fileURLToPath(import.meta.url);

if (isEntryPoint) {
  createAppServer().listen(PORT, HOST, () => {
    console.log(`Мини-CRM: http://${HOST}:${PORT}`);
  });
}
