// Raport zawiera tylko logi testów, bez konfiguracji środowiska i danych uwierzytelniających.
import { appendFile, readFile } from 'node:fs/promises';
import { basename } from 'node:path';
const escapeHtml = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const annotation = text => text.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
let summary = '## Wyniki testów Bengera\n';
for (const file of process.argv.slice(2)) {
  let log;
  try { log = await readFile(file, 'utf8'); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
  const lines = log.replace(/\x1b\[[0-9;]*m/g, '').split('\n');
  const failed = lines.flatMap((line, index) => /^\s*(?:not ok\b|✖)/.test(line) ? [index] : []).slice(0, 10);
  const excerpts = failed.map(index => lines.slice(index, index + 42).join('\n'));
  for (const excerpt of excerpts.slice(0, 5)) console.log(`::error title=Test failure::${annotation(excerpt.slice(0, 3500))}`);
  const content = [...excerpts, lines.slice(-16).join('\n')].join('\n\n');
  summary += `\n### ${basename(file)}\n\n<pre>${escapeHtml(content.slice(0, 40000))}</pre>\n`;
}
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
