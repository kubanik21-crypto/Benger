import{execFileSync}from'node:child_process';import{readFile,readdir,lstat,realpath,cp,rm,mkdtemp,mkdir,appendFile}from'node:fs/promises';import{tmpdir}from'node:os';import{resolve,join,relative,sep}from'node:path';import{fileURLToPath}from'node:url';import{PRODUCTION_ASSETS}from'./public-assets.mjs';
export const PREVIEW_PREFIX='previews/off-commercial-search';
export const PREVIEW_BRANCH='fix/off-commercial-search';
export const PREVIEW_URL='https://kubanik21-crypto.github.io/Benger/'+PREVIEW_PREFIX+'/';
const git=(root,args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
async function files(dir,prefix=''){const names=[];for(const f of await readdir(join(dir,prefix),{withFileTypes:true})){const path=join(prefix,f.name);if(f.isSymbolicLink())throw new Error('Dowiązanie w artefakcie.');if(f.isDirectory())names.push(...await files(dir,path));else if(f.isFile())names.push(path.split(sep).join('/'));else throw new Error('Nieprawidłowy asset.');}return names;}
export async function validateProductPreview(artifact,sha){
 if(!/^[a-f0-9]{40}$/.test(sha))throw new Error('Nieprawidłowy SHA.');
 const names=(await files(artifact)).sort(),expected=[...PRODUCTION_ASSETS,'.nojekyll','preview-build.json'].sort();if(JSON.stringify(names)!==JSON.stringify(expected))throw new Error('Niekompletny lub zanieczyszczony artefakt.');
 const meta=JSON.parse(await readFile(join(artifact,'preview-build.json'),'utf8')),html=await readFile(join(artifact,'index.html'),'utf8'),manifest=JSON.parse(await readFile(join(artifact,'manifest.webmanifest'),'utf8'));
 if(meta.sha!==sha||meta.branch!==PREVIEW_BRANCH||meta.namespace!=='preview-off-commercial-search'||meta.url!==PREVIEW_URL||!html.includes(`name="benger-build" content="${sha}"`)||!html.includes('content="preview-off-commercial-search"')||manifest.scope!=='./'||manifest.start_url!=='./'||manifest.id!=='./'||manifest.short_name!=='Benger Test')throw new Error('Nieprawidłowa izolacja lub SHA preview.');
 if(!(await readFile(join(artifact,'product-resolver.js'),'utf8')).includes('export async function resolveProductQuery'))throw new Error('Brak globalnego resolvera.');
 if(!(await readFile(join(artifact,'product-repository.js'),'utf8')).includes('!options.refreshExternal')||!(await readFile(join(artifact,'product-search-ui.js'),'utf8')).includes('search-by-name'))throw new Error('Brak poprawek OFF/barcode.');
 const sw=await readFile(join(artifact,'sw-assets.js'),'utf8');for(const f of expected.filter(f=>!['sw-assets.js','.nojekyll'].includes(f)))if(!sw.includes(JSON.stringify(f)))throw new Error('Niekompletny cache preview: '+f);
 return meta;
}
export async function replacePreviewOnly(site,artifact,sha){
 site=await realpath(site);artifact=await realpath(artifact);if(!(await lstat(join(site,'.git'))).isFile()||site===artifact||!relative(site,artifact).startsWith('..'+sep))throw new Error('Wymagany oddzielny detached worktree.');
 await validateProductPreview(artifact,sha);
 for(const path of ['previews',PREVIEW_PREFIX]){const entry=await lstat(join(site,path)).catch(e=>{if(e.code==='ENOENT')return null;throw e;});if(entry&&(entry.isSymbolicLink()||!entry.isDirectory()))throw new Error('Niebezpieczna ścieżka preview.');}
 await mkdir(join(site,'previews'),{recursive:true});await rm(join(site,PREVIEW_PREFIX),{recursive:true,force:true});await cp(artifact,join(site,PREVIEW_PREFIX),{recursive:true});
 git(site,['add','--',PREVIEW_PREFIX]);const changed=git(site,['diff','--cached','--name-only']).split('\n').filter(Boolean);if(changed.some(p=>!p.startsWith(PREVIEW_PREFIX+'/')))throw new Error('Publikacja próbowała zmienić pliki poza preview.');return changed.length>0;
}
export async function publishProductPreview({root,artifact,sha,push=false}){
 if(push&&(process.env.GITHUB_ACTIONS!=='true'||!['push','workflow_dispatch'].includes(process.env.GITHUB_EVENT_NAME)||process.env.GITHUB_REF!=='refs/heads/'+PREVIEW_BRANCH||process.env.GITHUB_REPOSITORY!=='kubanik21-crypto/Benger'))throw new Error('Push preview jest dozwolony wyłącznie w workflow własnej gałęzi testowej.');
 if(git(root,['rev-parse','HEAD'])!==sha)throw new Error('Checkout nie odpowiada SHA.');
 const latest=()=>git(root,['ls-remote','origin','refs/heads/'+PREVIEW_BRANCH]).split(/\s/)[0];if(push&&latest()!==sha)return {skipped:true};
 git(root,['fetch','origin','refs/heads/gh-pages:refs/remotes/origin/gh-pages']);const temp=await mkdtemp(join(tmpdir(),'benger-product-preview-')),site=join(temp,'site');let attached=false;
 try{git(root,['worktree','add','--detach',site,'origin/gh-pages']);attached=true;const changed=await replacePreviewOnly(site,artifact,sha);if(changed)git(site,['-c','user.name=github-actions[bot]','-c','user.email=41898282+github-actions[bot]@users.noreply.github.com','commit','-m','Publish isolated product preview '+sha.slice(0,7)]);if(push&&latest()!==sha)return {skipped:true};if(push&&changed)git(site,['push','origin','HEAD:refs/heads/gh-pages']);return {published:push&&changed,changed,url:PREVIEW_URL,pagesCommit:git(site,['rev-parse','HEAD'])};}
 finally{if(attached)git(root,['worktree','remove','--force',site]);await rm(temp,{recursive:true,force:true});}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.length!==4||!['--push','--dry-run'].includes(process.argv[2]))throw new Error('Użycie: --push|--dry-run ARTEFAKT');
 const root=fileURLToPath(new URL('../',import.meta.url)),sha=git(root,['rev-parse','HEAD']),result=await publishProductPreview({root,artifact:resolve(process.argv[3]),sha,push:process.argv[2]==='--push'});
 if(process.env.GITHUB_OUTPUT)await appendFile(process.env.GITHUB_OUTPUT,'changed='+Boolean(result.published)+'\nskipped='+Boolean(result.skipped)+'\n');console.log(JSON.stringify(result));
}
