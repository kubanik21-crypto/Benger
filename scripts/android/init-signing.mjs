// Explicit one-time operation. Private output MUST stay outside the source repository.
import{mkdir,writeFile,readFile,chmod,stat}from'node:fs/promises';
import{resolve,relative}from'node:path';import{execFileSync}from'node:child_process';import{randomBytes,createHash}from'node:crypto';import{fileURLToPath}from'node:url';
const dir=resolve(process.argv[2]??'');const root=fileURLToPath(new URL('../../',import.meta.url));
if(!process.argv[2]||!relative(root,dir).startsWith('..'))throw new Error('Signing material must be stored outside the repository.');
if(await stat(dir).catch(()=>null))throw new Error('Refusing to replace existing signing material. Keep the same key for updates.');
await mkdir(dir,{recursive:true,mode:0o700});await chmod(dir,0o700);
const password=randomBytes(32).toString('hex');await writeFile(resolve(dir,'password.txt'),password+'\n',{mode:0o600});
execFileSync('keytool',['-genkeypair','-alias','benger','-keyalg','RSA','-keysize','3072','-validity','10000','-storetype','PKCS12','-keystore',resolve(dir,'benger.p12'),'-storepass:file',resolve(dir,'password.txt'),'-keypass:file',resolve(dir,'password.txt'),'-dname','CN=Benger, OU=Android, O=Benger, C=PL'],{stdio:'pipe'});
await chmod(resolve(dir,'benger.p12'),0o600);
execFileSync('keytool',['-exportcert','-alias','benger','-keystore',resolve(dir,'benger.p12'),'-storepass:file',resolve(dir,'password.txt'),'-file',resolve(dir,'certificate.der')],{stdio:'pipe'});
const fingerprint=createHash('sha256').update(await readFile(resolve(dir,'certificate.der'))).digest('hex');
await writeFile(resolve(dir,'signing.json'),JSON.stringify({applicationId:'io.github.kubanik21crypto.benger',alias:'benger',certificateSha256:fingerprint},null,2)+'\n',{mode:0o600});
await writeFile(resolve(dir,'README-PRYWATNE.txt'),'PRYWATNY PODPIS APLIKACJI BENGER\nNie publikuj tego katalogu ani jego zawartości na GitHubie.\nPrzechowaj bezpieczną kopię całego katalogu.\nTen sam benger.p12 i password.txt są potrzebne do kolejnych aktualizacji APK bez odinstalowywania aplikacji.\n',{mode:0o600});
console.log('Private signing material created outside Git. Certificate SHA-256: '+fingerprint);
