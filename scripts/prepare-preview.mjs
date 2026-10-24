import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PUBLIC_ASSETS } from './public-assets.mjs';

export async function preparePreview(destination, revision) {
  if (!/^[a-f0-9]{40}$/.test(revision)) throw new Error('Podaj pełny SHA commita preview.');
  const root = fileURLToPath(new URL('../', import.meta.url));
  const output = resolve(destination);
  if (output === root || root.startsWith(output + '/')) throw new Error('Katalog docelowy nie może obejmować repozytorium.');
  for (const file of PUBLIC_ASSETS) {
    const target = resolve(output, file);
    await mkdir(dirname(target), { recursive: true });
    if (file.endsWith('.html')) {
      let html = await readFile(resolve(root, file), 'utf8');
      html = html.replace('<head>', `<head>\n  <meta name="benger-storage-namespace" content="preview-etap-3">\n  <meta name="benger-build" content="${revision}">`);
      const banner = `<aside style="padding:16px;background:#174d3c;color:white;font:14px/1.6 system-ui">Podgląd Etapu 3 · ${revision.slice(0, 7)} · Oddzielne dane lokalne. <a style="color:white" href="./off-diagnostics.html">Sprawdź połączenie OFF</a> · <a style="color:white" href="../../">Wersja główna</a></aside>`;
      html = html.replace('<body>', `<body>\n${banner}`);
      await writeFile(target, html);
    } else await copyFile(resolve(root, file), target);
  }
  await writeFile(resolve(output, '.nojekyll'), '');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 4) throw new Error('Użycie: node scripts/prepare-preview.mjs KATALOG SHA');
  await preparePreview(process.argv[2], process.argv[3]);
}
