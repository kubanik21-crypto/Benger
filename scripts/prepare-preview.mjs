import{validateOffSearchEndpoint}from'../product-providers/off-search-bridge.js';
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

export async function preparePreview(destination, revision, {preview=true,namespace='preview-etap-14',publicOnly=false}={}) {
  if(!['preview-etap-14','preview-off-commercial-search'].includes(namespace))throw new Error('Nieznany namespace preview.');
  if (!/^[a-f0-9]{40}$/.test(revision)) throw new Error('Podaj pełny SHA commita preview.');
  const root = fileURLToPath(new URL('../', import.meta.url));
  const output = resolve(destination);
  if (output === root || root.startsWith(output + '/')) throw new Error('Katalog docelowy nie może obejmować repozytorium.');
  if(!preview||publicOnly){const existing=await readdir(output).catch(error=>{if(error.code==='ENOENT')return [];throw error;});if(existing.length)throw new Error('Użyj pustego katalogu dla czystego artefaktu produkcyjnego.');}
  const bridge=preview&&namespace==='preview-off-commercial-search'&&process.env.BENGER_OFF_SEARCH_PREVIEW_URL?validateOffSearchEndpoint(process.env.BENGER_OFF_SEARCH_PREVIEW_URL):null;
  const version=await syncAppVersion(root),assets=preview&&!publicOnly?PUBLIC_ASSETS:PRODUCTION_ASSETS;
  for (const file of assets) {
    const source = await safeAssetSource(root, file);
    const target = resolve(output, file);
    await mkdir(dirname(target), { recursive: true });
    if (file.endsWith('.html')) {
      let html = await readFile(source, 'utf8');
      html = html.replace('<head>', `<head>\n  ${preview?`<meta name="benger-storage-namespace" content="${namespace}">`:''}\n  <meta name="benger-build" content="${revision}">`);
      if(bridge)html=html.replace('<head>',`<head>\n<meta name=\"benger-off-search-endpoint\" content=\"${bridge}\">`);
      const legacyBanner = `<aside style="padding:8px 16px;background:var(--brand,#174d3c);color:var(--brand-contrast,white);font:12px/1.6 system-ui">Podgląd Etapu 14 · Oddzielne dane lokalne. <details><summary>Narzędzia diagnostyczne</summary><a style="color:inherit" href="./off-diagnostics.html">Sprawdź połączenie OFF</a> · <a style="color:inherit" href="./speech-diagnostics.html">Speech diagnostics</a> · <a style="color:inherit" href="./voice-test-lab.html">Voice Test Lab</a> · <a style="color:inherit" href="./barcode-test-lab.html">Barcode Test Lab</a> · <a style="color:inherit" href="./catalog-diagnostics.html">Catalog Diagnostics</a> · <a style="color:inherit" href="./pwa-diagnostics.html">PWA Diagnostics</a> · <a style="color:inherit" href="./portion-diagnostics.html">Portion Diagnostics</a> · <a style="color:inherit" href="./portion-test-lab.html">Portion Test Lab</a> · <a style="color:inherit" href="./recipe-diary-test-lab.html">Recipe Diary Test Lab</a> · <a style="color:inherit" href="./recipe-diagnostics.html">Recipe Diagnostics</a></details><a style="color:inherit" href="../../">Wersja główna</a></aside>`;
      const banner=namespace==='preview-etap-14'?legacyBanner:`<aside style="padding:10px 16px;background:var(--brand);color:var(--brand-contrast)" aria-label="Wersja testowa">Preview · Globalne produkty + OFF · ${version} · build ${revision.slice(0,7)} · Osobne dane testowe</aside>`;
      if(preview)html = html.replace('<body>', `<body>\n${banner}`);
      html = html.replace(/((?:src|href)="\.\/[^"?]+\.(?:js|css|webmanifest))"/g, `$1?v=${revision}"`);
      await writeFile(target, html);
    } else if(preview&&namespace==='preview-off-commercial-search'&&file==='manifest.webmanifest'){
      const manifest=JSON.parse(await readFile(source,'utf8'));manifest.name='Benger Test · Produkty';manifest.short_name='Benger Test';await writeFile(target,JSON.stringify(manifest,null,2)+'\n');
    } else if (!preview && file==='app-storage.js') {
      await writeFile(target,"// Stable production storage, unchanged from previous releases.\nexport const STORAGE_NAMESPACE='';\nexport const NUTRITION_STORAGE_KEY='benger.nutrition.v1';\nexport const PRODUCT_DB_NAME='BengerDB';\n");
    } else if (file.endsWith('.js') && !file.startsWith('vendor/')) {
      // Cały graf ES modules ma ten sam SHA; świeży index nie miesza się ze starym cache Pages.
      const javascript = (await readFile(source, 'utf8')).replace(/(\bfrom\s+['"])(\.\.?\/[^'"]+\.js)(['"])/g, `$1$2?v=${revision}$3`);
      await writeFile(target, javascript);
    } else await copyFile(source, target);
  }
  if(!preview)await writeFile(resolve(output,'release-metadata.json'),JSON.stringify({app:'Benger',version,build:revision,url:'https://kubanik21-crypto.github.io/Benger/',artifactVersion:1},null,2)+'\n');
  const extra=preview&&namespace==='preview-off-commercial-search'?['preview-build.json']:preview?[]:['release-metadata.json'];
  if(extra.includes('preview-build.json'))await writeFile(resolve(output,'preview-build.json'),JSON.stringify({version,sha:revision,branch:'fix/off-commercial-search',namespace,url:'https://kubanik21-crypto.github.io/Benger/previews/off-commercial-search/'}));
  await writePwaAssets(output,{assets:[...assets,...extra]});
  await writeFile(resolve(output, '.nojekyll'), '');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 4) throw new Error('Użycie: node scripts/prepare-preview.mjs KATALOG SHA');
  await preparePreview(process.argv[2], process.argv[3]);
}
