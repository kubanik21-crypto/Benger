import {readFile,mkdir,writeFile} from 'node:fs/promises';import {resolve} from 'node:path';
try{
 const raw=process.env.SIGNING_BUNDLE??'';if(!raw||raw.length>48000||!process.argv[2])throw Error();const data=JSON.parse(Buffer.from(raw,'base64').toString('utf8')),expected=(await readFile('android/signing-certificate.sha256','utf8')).trim();
 if(data.certificateSha256!==expected||typeof data.password!=='string'||!data.password||data.password.includes('\n')||typeof data.keystore!=='string'||!/^[A-Za-z0-9+/]+={0,2}$/.test(data.keystore))throw Error();
 const target=resolve(process.argv[2]);await mkdir(target,{mode:0o700});
 await writeFile(resolve(target,'benger.p12'),Buffer.from(data.keystore,'base64'),{mode:0o600,flag:'wx'});
 await writeFile(resolve(target,'password.txt'),data.password+'\n',{mode:0o600,flag:'wx'});
 await writeFile(resolve(target,'signing.json'),JSON.stringify({applicationId:'io.github.kubanik21crypto.benger',alias:'benger',certificateSha256:expected}),{mode:0o600,flag:'wx'});
}catch{console.error('Could not restore the existing signing identity. No private values were printed.');process.exitCode=1;}
