// Explicit upload of an existing identity to an encrypted Actions secret; never create a key or print payload.
import {readFile} from 'node:fs/promises';import {resolve} from 'node:path';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
try{
 if(process.argv.length!==3)throw Error();const dir=resolve(process.argv[2]),expected=(await readFile(resolve(root,'android/signing-certificate.sha256'),'utf8')).trim(),config=JSON.parse(await readFile(resolve(dir,'signing.json'),'utf8'));
 if(config.applicationId!=='io.github.kubanik21crypto.benger'||config.alias!=='benger'||config.certificateSha256!==expected)throw Error();
 const certificate=execFileSync('keytool',['-exportcert','-alias','benger','-keystore',resolve(dir,'benger.p12'),'-storepass:file',resolve(dir,'password.txt')],{stdio:['ignore','pipe','pipe']});
 if(createHash('sha256').update(certificate).digest('hex')!==expected)throw Error();
 const payload=Buffer.from(JSON.stringify({certificateSha256:expected,keystore:(await readFile(resolve(dir,'benger.p12'))).toString('base64'),password:(await readFile(resolve(dir,'password.txt'),'utf8')).trim()})).toString('base64');
 if(Buffer.byteLength(payload)>48000)throw Error();
 execFileSync('gh',['secret','set','BENGER_ANDROID_SIGNING_BUNDLE','--repo','kubanik21-crypto/Benger'],{input:payload,stdio:['pipe','pipe','pipe']});
 console.log('Existing signing identity saved as an encrypted GitHub Actions secret. No new signing key was generated.');
}catch{console.error('Signing secret was not confirmed. Check GitHub API access and permissions. Private values were not printed.');process.exitCode=1;}
