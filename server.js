// Minimal static file server for local development.
// Browsers block ES modules opened directly from disk (file://), so the page is served over http.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT) || 3000;

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

const server = createServer(async (request, response) => {
  const { pathname } = new URL(request.url, `http://${HOST}`);
  const relativePath = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).slice(1);
  const filePath = normalize(join(ROOT, relativePath));
  const contentType = CONTENT_TYPES[extname(filePath)];

  // ROOT ends with a path separator, so this also rejects "../" escapes.
  if (!filePath.startsWith(ROOT) || !contentType) {
    response.writeHead(404).end('Not found');
    return;
  }

  try {
    const body = await readFile(filePath);
    response.writeHead(200, { 'Content-Type': contentType }).end(body);
  } catch {
    response.writeHead(404).end('Not found');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Мини-CRM: http://${HOST}:${PORT}`);
});
