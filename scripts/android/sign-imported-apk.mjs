// Offline signing of the CI artifact with the existing identity. Does not read or request the Picker API key.
import {execFileSync,spawnSync} from 'node:child_process';import {readFile,mkdir,writeFile,mkdtemp,rm,stat} from 'node:fs/promises';import {resolve,join} from 'node:path';import {tmpdir} from 'node:os';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';import {verifyApkBuild,verifyUnsignedApkBuild,validateUnsignedArtifactMetadata} from './verify-apk-build.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));const [privateDir,apkArg,metadataArg,outArg]=process.argv.slice(2);
if(!privateDir||!apkArg||!metadataArg||!outArg||process.argv.length!==6)throw Error('Usage: node scripts/android/sign-imported-apk.mjs PRIVATE_SIGNING_DIR UNSIGNED_APK METADATA_JSON OUTPUT_DIR');
const dir=resolve(privateDir),apk=resolve(apkArg),out=resolve(outArg),m=JSON.parse(await readFile(resolve(metadataArg),'utf8')),expected=(await readFile(resolve(root,'android/signing-certificate.sha256'),'utf8')).trim(),config=JSON.parse(await readFile(resolve(dir,'signing.json'),'utf8'));
if(config.applicationId!=='io.github.kubanik21crypto.benger'||config.alias!=='benger'||config.certificateSha256!==expected)throw Error('Existing signing identity is incompatible.');
validateUnsignedArtifactMetadata(m,expected);
if(createHash('sha256').update(await readFile(apk)).digest('hex')!==m.sha256)throw Error('The unsigned APK hash does not match its metadata.');
execFileSync('git',['merge-base','--is-ancestor','759df23',m.build],{cwd:root,stdio:'pipe'});
if(JSON.parse(execFileSync('git',['show',m.build+':package.json'],{cwd:root,encoding:'utf8'})).version!==m.version)throw Error('Source version does not match the artifact.');
const tools=resolve(process.env.ANDROID_HOME,'build-tools/36.0.0'),badging=execFileSync(resolve(tools,'aapt'),['dump','badging',apk],{encoding:'utf8'});
verifyUnsignedApkBuild({badging,version:m.version,versionCode:m.versionCode,buildConfig:'',env:{BENGER_PREVIOUS_VERSION_CODE:'28551134'}});
const originalSignature=spawnSync(resolve(tools,'apksigner'),['verify',apk],{encoding:'utf8'});if(originalSignature.error||originalSignature.status!==1)throw Error('Expected an unsigned input APK.');
const cert=execFileSync('keytool',['-exportcert','-alias','benger','-keystore',resolve(dir,'benger.p12'),'-storepass:file',resolve(dir,'password.txt')],{stdio:['ignore','pipe','pipe']});if(createHash('sha256').update(cert).digest('hex')!==expected)throw Error('Existing signing certificate mismatch.');
await mkdir(out,{recursive:true});const filename=`Benger-1.0.20-${m.build.slice(0,7)}.apk`,signed=resolve(out,filename);if(await stat(signed).catch(()=>null))throw Error('Refusing to overwrite an existing signed APK.');
const temp=await mkdtemp(join(tmpdir(),'benger-apk-align-'));let complete=false;
try{
 const aligned=resolve(temp,'aligned.apk');execFileSync(resolve(tools,'zipalign'),['-P','16','-f','4',apk,aligned],{stdio:'pipe'});
 // PKCS12 key uses the store password; passing its file twice consumes a missing second line.
 execFileSync(resolve(tools,'apksigner'),['sign','--ks',resolve(dir,'benger.p12'),'--ks-key-alias','benger','--ks-pass','file:'+resolve(dir,'password.txt'),'--v4-signing-enabled','false','--out',signed,aligned],{stdio:'pipe'});
 const certificates=execFileSync(resolve(tools,'apksigner'),['verify','--verbose','--print-certs',signed],{encoding:'utf8'}),signedBadging=execFileSync(resolve(tools,'aapt'),['dump','badging',signed],{encoding:'utf8'});
 verifyApkBuild({badging:signedBadging,certificates,buildConfig:'',version:m.version,versionCode:m.versionCode,expectedCertificate:expected,env:{BENGER_PREVIOUS_VERSION_CODE:'28551134'}});
 execFileSync(resolve(tools,'zipalign'),['-c','-P','16','4',signed],{stdio:'pipe'});
 const bytes=await readFile(signed),result={app:'Benger',applicationId:config.applicationId,version:m.version,versionCode:m.versionCode,build:m.build,builtAt:new Date(m.builtAt).toISOString(),filename,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),unsignedSha256:m.sha256,certificateSha256:expected,signingState:'signed',signedAt:new Date().toISOString(),googleAuthorizationEnabled:true,recipePickerEnabled:true,recipePickerAppId:'481332161595',distribution:'manual-test-only',featureBaseCommit:'759df23'};
 await writeFile(resolve(out,'metadata.json'),JSON.stringify(result,null,2)+'\n');complete=true;console.log(JSON.stringify(result,null,2));
}finally{await rm(temp,{recursive:true,force:true});if(!complete)await rm(signed,{force:true});}
