import {execFileSync} from 'node:child_process';
import{resolve}from'node:path';import{fileURLToPath}from'node:url';import{preparePreview}from'./prepare-preview.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),sha=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
if(process.argv.length!==3)throw new Error('Podaj pusty katalog wyjściowy preview.');
await preparePreview(resolve(process.argv[2]),sha,{preview:true,namespace:'preview-off-commercial-search',publicOnly:true});
console.log('Product preview built: '+sha+'. Nie opublikowano.');
