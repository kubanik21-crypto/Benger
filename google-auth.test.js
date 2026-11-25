import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createGoogleAuth,cleanGoogleAuthStatus,GOOGLE_DRIVE_FILE_SCOPE,GOOGLE_AUTH_MESSAGES} from './google-auth.js';
import {initGoogleAuthUi} from './google-auth-ui.js';
const valid=(status='authorized',extra={})=>({status,configured:true,connected:status==='authorized',account:status==='authorized'?'user@example.test':null,revocationPending:false,sessionExpiresAt:status==='authorized'?123456789:0,scope:GOOGLE_DRIVE_FILE_SCOPE,...extra});
test('native projection has no token/auth-code fields and never retains arbitrary SDK payload',()=>{
 const result=cleanGoogleAuthStatus(valid('authorized',{accessToken:'SYNTHETIC_SECRET',refreshToken:'SYNTHETIC_REFRESH',serverAuthCode:'SYNTHETIC_CODE',sdk:{data:'SYNTHETIC_PRIVATE'}}));
 assert.equal(result.account,'user@example.test');assert.equal(result.connected,true);assert.doesNotMatch(JSON.stringify(result),/SYNTHETIC_|Token|sdk|authCode/);assert.ok(Object.isFrozen(result));
});
test('invalid/overbroad scope and malformed authorized identity fail closed',()=>{
 for(const value of [null,{},valid('authorized',{scope:'https://www.googleapis.com/auth/drive'}),valid('authorized',{account:null}),valid('authorized',{configured:false}),valid('authorized',{connected:false}),valid('expired',{connected:true})]){
  const result=cleanGoogleAuthStatus(value);assert.equal(result.status,'unavailable');assert.equal(result.connected,false);
 }
});
test('PWA never invokes native bridge or creates Google authorization controls',async()=>{
 const fail=()=>assert.fail('no web Google/native request');const auth=createGoogleAuth({native:false,bridge:{getStatus:fail,connect:fail,disconnect:fail}});
 for(const method of ['status','connect','disconnect'])assert.equal((await auth[method]()).status,'unavailable');
 assert.equal(initGoogleAuthUi({native:false,auth,container:null}),null);
});
test('status is passive and actions use only three credential-free native commands',async()=>{
 const calls=[];const auth=createGoogleAuth({native:true,bridge:Object.fromEntries(['getStatus','connect','disconnect'].map(method=>[method,async(...args)=>{assert.equal(args.length,0);calls.push(method);return valid(method==='connect'?'authorized':'disconnected');}]))});
 await auth.status();assert.deepEqual(calls,['getStatus']);await auth.connect();await auth.disconnect();assert.deepEqual(calls,['getStatus','connect','disconnect']);
});
test('native exceptions cannot leak tokens or SDK details into JS result/message',async()=>{
 const auth=createGoogleAuth({native:true,bridge:{getStatus:async()=>{throw new Error('SYNTHETIC_SECRET');}}});const result=await auth.status();assert.equal(result.status,'unavailable');assert.doesNotMatch(JSON.stringify(result),/SYNTHETIC_/);
});
for(const status of ['cancelled','permission-denied','expired','offline','account-mismatch','services-unavailable','configuration-required','revoke-pending'])test('status handled: '+status,()=>{
 const state=cleanGoogleAuthStatus(valid(status,{revocationPending:status==='revoke-pending'}));assert.equal(state.status,status);assert.equal(typeof GOOGLE_AUTH_MESSAGES[status],'string');assert.equal(state.connected,false);
});
test('native SDK is pinned, uses AuthorizationClient + drive.file only, no backend credentials or token bridge methods',async()=>{
 const plugin=await readFile('android/app/src/main/java/io/github/kubanik21crypto/benger/BengerGoogleAuthPlugin.java','utf8');
 assert.deepEqual([...plugin.matchAll(/@PluginMethod public void (\w+)/g)].map(m=>m[1]),['getStatus','connect','disconnect']);
 assert.match(plugin,/Identity\.getAuthorizationClient/);assert.match(plugin,/setOptOutIncludingGrantedScopes\(true\)/);assert.match(plugin,/setAccount\(selected\)/);
 assert.doesNotMatch(plugin,/requestOfflineAccess|getServerAuthCode|GoogleSignIn\.getClient|Log\.|printStackTrace|SharedPreferences|HttpURLConnection|spreadsheets|drive\.google/);
 const gradle=await readFile('android/app/build.gradle','utf8');assert.match(gradle,/play-services-auth:22\.0\.0/);assert.match(gradle,/BENGER_GOOGLE_AUTH_ENABLED/);assert.match(gradle,/\?: "false"/);
 const session=await readFile('android/app/src/main/java/io/github/kubanik21crypto/benger/GoogleAuthSession.java','utf8');assert.match(session,/private String accessToken/);assert.doesNotMatch(session,/public.*[Tt]oken|SharedPreferences|System\.out|Log\./);
});
