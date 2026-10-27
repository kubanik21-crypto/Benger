import { writePwaAssets } from './build-pwa-assets.mjs';
import { copyFile, mkdir, readFile, readdir, realpath, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {syncAppVersion} from './sync-app-version.mjs';
import { PUBLIC_ASSETS, PRODUCTION_ASSETS } from './public-assets.mjs';

export async function safeAssetSource(root, file) {
  const source = resolve(root, file);
  const fromRoot = relative(root, source);
  if (isAbsolute(fromRoot) || fromRoot === '..' || fromRoot.startsWith(`..${sep}`)
      || await realpath(source) !== source || !(await stat(source)).isFile()) {
    throw new Error('Asset musi być zwykłym plikiem wewnątrz projektu, bez dowiązań.');
  }
  return source;
}

export async function preparePreview(destination, revision, {preview=true}={}) {
  if (!/^[a-f0-9]{40}$/.test(revision)) throw new Error('Podaj pełny SHA commita preview.');
  const root = fileURLToPath(new URL('../', import.meta.url));
  const output = resolve(destination);
  if (output === root || root.startsWith(output + '/')) throw new Error('Katalog docelowy nie może obejmować repozytorium.');
  if(!preview){const existing=await readdir(output).catch(error=>{if(error.code==='ENOENT')return [];throw error;});if(existing.length)throw new Error('Użyj pustego katalogu dla czystego artefaktu produkcyjnego.');}
  const version=await syncAppVersion(root),assets=preview?PUBLIC_ASSETS:PRODUCTION_ASSETS;
  for (const file of assets) {
    const source = await safeAssetSource(root, file);
    const target = resolve(output, file);
    await mkdir(dirname(target), { recursive: true });
    if (file.endsWith('.html')) {
      let html = await readFile(source, 'utf8');
      html = html.replace('<head>', `<head>\n  ${preview?'<meta name="benger-storage-namespace" content="preview-etap-14">':''}\n  <meta name="benger-build" content="${revision}">`);
      const banner = `<aside style="padding:8px 16px;background:var(--brand,#174d3c);color:var(--brand-contrast,white);font:12px/1.6 system-ui">Podgląd Etapu 14 · Oddzielne dane lokalne. <details><summary>Narzędzia diagnostyczne</summary><a style="color:inherit" href="./off-diagnostics.html">Sprawdź połączenie OFF</a> · <a style="color:inherit" href="./speech-diagnostics.html">Speech diagnostics</a> · <a style="color:inherit" href="./voice-test-lab.html">Voice Test Lab</a> · <a style="color:inherit" href="./barcode-test-lab.html">Barcode Test Lab</a> · <a style="color:inherit" href="./catalog-diagnostics.html">Catalog Diagnostics</a> · <a style="color:inherit" href="./pwa-diagnostics.html">PWA Diagnostics</a> · <a style="color:inherit" href="./portion-diagnostics.html">Portion Diagnostics</a> · <a style="color:inherit" href="./portion-test-lab.html">Portion Test Lab</a> · <a style="color:inherit" href="./recipe-diary-test-lab.html">Recipe Diary Test Lab</a> · <a style="color:inherit" href="./recipe-diagnostics.html">Recipe Diagnostics</a></details><a style="color:inherit" href="../../">Wersja główna</a></aside>`;
      if(preview)html = html.replace('<body>', `<body>\n${banner}`);
      html = html.replace(/((?:src|href)="\.\/[^"?]+\.(?:js|css|webmanifest))"/g, `$1?v=${revision}"`);
      await writeFile(target, html);
    } else if (!preview && file==='app-storage.js') {
      await writeFile(target,"// Stable production storage, unchanged from previous releases.\nexport const STORAGE_NAMESPACE='';\nexport const NUTRITION_STORAGE_KEY='benger.nutrition.v1';\nexport const PRODUCT_DB_NAME='BengerDB';\n");
    } else if (file.endsWith('.js') && !file.startsWith('vendor/')) {
      // Cały graf ES modules ma ten sam SHA; świeży index nie miesza się ze starym cache Pages.
      const javascript = (await readFile(source, 'utf8')).replace(/(\bfrom\s+['"])(\.\.?\/[^'"]+\.js)(['"])/g, `$1$2?v=${revision}$3`);
      await writeFile(target, javascript);
    } else await copyFile(source, target);
  }
  if(!preview)await writeFile(resolve(output,'release-metadata.json'),JSON.stringify({app:'Benger',version,build:revision,url:'https://kubanik21-crypto.github.io/Benger/',artifactVersion:1},null,2)+'\n');
  await writePwaAssets(output,{assets:preview?assets:[...assets,'release-metadata.json']});
  await writeFile(resolve(output, '.nojekyll'), '');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 4) throw new Error('Użycie: node scripts/prepare-preview.mjs KATALOG SHA');
  await preparePreview(process.argv[2], process.argv[3]);
}
