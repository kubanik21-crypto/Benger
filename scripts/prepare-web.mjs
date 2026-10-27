// Produces a reviewable static release artifact; never deploys it.
import {execFileSync} from 'node:child_process';
import {preparePreview} from './prepare-preview.mjs';
if(process.argv.length!==3)throw new Error('Użycie: npm run build:web -- KATALOG_WYJŚCIOWY');
const revision=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
await preparePreview(process.argv[2],revision,{preview:false});
console.log(`Statyczny Benger: ${process.argv[2]} · ${revision}. Nie opublikowano.`);
