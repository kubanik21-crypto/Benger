import { copyFile, mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PUBLIC_ASSETS } from './public-assets.mjs';

export async function safeAssetSource(root, file) {
  const source = resolve(root, file);
  const fromRoot = relative(root, source);
  if (isAbsolute(fromRoot) || fromRoot === '..' || fromRoot.startsWith(`..${sep}`)
      || await realpath(source) !== source || !(await stat(source)).isFile()) {
    throw new Error('Asset musi być zwykłym plikiem wewnątrz projektu, bez dowiązań.');
  }
  return source;
}

export async function preparePreview(destination, revision) {
  if (!/^[a-f0-9]{40}$/.test(revision)) throw new Error('Podaj pełny SHA commita preview.');
  const root = fileURLToPath(new URL('../', import.meta.url));
  const output = resolve(destination);
  if (output === root || root.startsWith(output + '/')) throw new Error('Katalog docelowy nie może obejmować repozytorium.');
  for (const file of PUBLIC_ASSETS) {
    const source = await safeAssetSource(root, file);
    const target = resolve(output, file);
    await mkdir(dirname(target), { recursive: true });
    if (file.endsWith('.html')) {
      let html = await readFile(source, 'utf8');
      html = html.replace('<head>', `<head>\n  <meta name="benger-storage-namespace" content="preview-etap-3">\n  <meta name="benger-build" content="${revision}">`);
      const banner = `<aside style="padding:16px;background:#174d3c;color:white;font:14px/1.6 system-ui">Podgląd Etapu 3 · ${revision.slice(0, 7)} · Oddzielne dane lokalne. <a style="color:white" href="./off-diagnostics.html">Sprawdź połączenie OFF</a> · <a style="color:white" href="../../">Wersja główna</a></aside>`;
      html = html.replace('<body>', `<body>\n${banner}`);
      html = html.replace(/((?:src|href)="\.\/[^"?]+\.(?:js|css|webmanifest))"/g, `$1?v=${revision}"`);
      await writeFile(target, html);
    } else if (file.endsWith('.js')) {
      // Cały graf ES modules ma ten sam SHA; świeży index nie miesza się ze starym cache Pages.
      const javascript = (await readFile(source, 'utf8')).replace(/(\bfrom\s+['"])(\.\.?\/[^'"]+\.js)(['"])/g, `$1$2?v=${revision}$3`);
      await writeFile(target, javascript);
    } else await copyFile(source, target);
  }
  await writeFile(resolve(output, '.nojekyll'), '');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 4) throw new Error('Użycie: node scripts/prepare-preview.mjs KATALOG SHA');
  await preparePreview(process.argv[2], process.argv[3]);
}
