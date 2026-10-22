import http from 'node:http';
import { readFile } from 'node:fs/promises';

const files = new Map([
  ['/', 'index.html'],
  ['/app.js', 'app.js'],
  ['/nutrition.js', 'nutrition.js'],
  ['/legacy.js', 'legacy.js'],
  ['/style.css', 'style.css'],
  ['/manifest.webmanifest', 'manifest.webmanifest'],
]);

http.createServer(async (request, response) => {
  const file = files.get(new URL(request.url, 'http://localhost').pathname);
  if (!file) { response.writeHead(404); response.end(); return; }
  try {
    const data = await readFile(new URL(file, import.meta.url));
    const type = file.endsWith('.js') ? 'text/javascript'
      : file.endsWith('.css') ? 'text/css'
        : file.endsWith('.webmanifest') ? 'application/manifest+json' : 'text/html';
    response.setHeader('Content-Type', `${type}; charset=utf-8`);
    response.end(data);
  } catch {
    response.writeHead(500);
    response.end('Błąd odczytu');
  }
}).listen(Number(process.env.PORT || 3000), '0.0.0.0');
