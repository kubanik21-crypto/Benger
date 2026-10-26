import http from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = await realpath(fileURLToPath(new URL('.', import.meta.url)));
const contentTypes = new Map([
  ['.html', 'text/html'],
  ['.js', 'text/javascript'],
  ['.css', 'text/css'],
  ['.json', 'application/json'],
  ['.png', 'image/png'],
  ['.txt', 'text/plain'],
  ['.webmanifest', 'application/manifest+json'],
]);

function publicFile(url) {
  // Sprawdzamy surową ścieżkę przed normalizacją URL, która mogłaby ukryć „../”.
  let pathname;
  try { pathname = decodeURIComponent(url.split('?')[0]); } catch { return null; }
  if (pathname === '/') pathname = '/index.html';
  if (!pathname.startsWith('/') || pathname.includes('\\') || pathname.includes('\0')) return null;
  const segments = pathname.slice(1).split('/');
  if (segments.some(segment => !segment || segment.startsWith('.'))) return null;
  const name = segments.at(-1).toLowerCase();
  if (name === 'server.js' || name === 'package.json' || name.endsWith('lock.json') || name.endsWith('.test.js')) return null;
  const type = contentTypes.get(extname(name));
  if (extname(name) === '.txt' && !pathname.startsWith('/vendor/zxing/LICENSE-')) return null;
  if (extname(name) === '.json' && !/^\/data\/usda\/(?:index|metadata|chunk-\d{4})\.json$/.test(pathname)) return null;
  const path = resolve(root, ...segments);
  const fromRoot = relative(root, path);
  if (!type || fromRoot === '..' || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) return null;
  return { path, type };
}

function notFound(response) {
  response.writeHead(404);
  response.end();
}

http.createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end();
    return;
  }
  const file = publicFile(request.url ?? '');
  if (!file) { notFound(response); return; }
  try {
    // Nie podążamy za dowiązaniami: mogłyby wskazać poza projekt lub na plik prywatny.
    const actualPath = await realpath(file.path);
    if (actualPath !== file.path || !(await stat(actualPath)).isFile()) { notFound(response); return; }
    const data = await readFile(actualPath);
    response.writeHead(200, {
      'Content-Type': `${file.type}; charset=utf-8`,
      'Content-Length': data.length,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-cache',
    });
    response.end(request.method === 'HEAD' ? undefined : data);
  } catch (error) {
    if (['ENOENT', 'ENOTDIR', 'EISDIR', 'EACCES', 'ELOOP'].includes(error.code)) { notFound(response); return; }
    response.writeHead(500);
    response.end('Błąd odczytu');
  }
}).listen(Number(process.env.PORT || 3000), '0.0.0.0');
