import { execFileSync } from 'node:child_process';
import { appendFile, lstat, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { preparePreview } from './prepare-preview.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const git = (args, cwd = root) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
if (process.argv.length !== 3 || process.argv[2] !== '--push') throw new Error('Publikacja wymaga jawnego: node scripts/publish-preview.mjs --push');
const workflowCheckout = process.env.GITHUB_ACTIONS === 'true' && process.env.GITHUB_REF === 'refs/heads/etap-7-household-portions';
if (git(['branch', '--show-current']) !== 'etap-7-household-portions' && !workflowCheckout) throw new Error('Publikuj wyłącznie z gałęzi Etapu 7.');
if (git(['status', '--porcelain'])) throw new Error('Najpierw zapisz zmiany w commicie. Preview musi odpowiadać konkretnemu SHA.');
const revision = git(['rev-parse', 'HEAD']);
if (workflowCheckout && revision !== process.env.GITHUB_SHA) throw new Error('Checkout preview nie odpowiada SHA zdarzenia workflow.');
git(['fetch', 'origin', 'refs/heads/gh-pages:refs/remotes/origin/gh-pages']);
const container = await mkdtemp(join(tmpdir(), 'benger-pages-preview-'));
const site = join(container, 'site');
const prefix = 'previews/etap-7';
let attached = false;
try {
  // Bez tworzenia gałęzi i bez przełączania roboczego checkoutu Etapu 7.
  git(['worktree', 'add', '--detach', site, 'origin/gh-pages']); attached = true;
  const parent = await lstat(join(site, 'previews')).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
  if (parent?.isSymbolicLink()) throw new Error('Katalog preview nie może być dowiązaniem.');
  await rm(join(site, prefix), { recursive: true, force: true });
  await preparePreview(join(site, prefix), revision);
  git(['add', '--', prefix], site);
  const changed = git(['diff', '--cached', '--name-only', '-z'], site).split('\0').filter(Boolean);
  if (changed.some(file => !file.startsWith(prefix + '/'))) throw new Error('Odmowa zmiany produkcyjnych plików Pages.');
  if (changed.length) {
    git(['commit', '-m', `Update Stage 7 preview from ${revision.slice(0, 7)}`], site);
    git(['push', 'origin', 'HEAD:refs/heads/gh-pages'], site); // Bez force; równoległa zmiana wymaga ponowienia.
  }
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `changed=${changed.length > 0}\n`);
  console.log(`Preview source: ${revision}`);
  console.log(`Pages snapshot: ${git(['rev-parse', 'HEAD'], site)}`);
  console.log('Preview URL: https://kubanik21-crypto.github.io/Benger/previews/etap-7/');
} finally {
  if (attached) git(['worktree', 'remove', '--force', site]);
  await rm(container, { recursive: true, force: true });
}
