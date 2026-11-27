/** Validate public APK identity and native flags without exposing build credentials. */
export function verifyApkBuild({badging,certificates,buildConfig,version,versionCode,expectedCertificate,env={}}){
 const identity=badging.match(/^package: name='([^']+)' versionCode='(\d+)' versionName='([^']+)'/m);
 if(!identity||identity[1]!=='io.github.kubanik21crypto.benger'||identity[3]!==version||Number(identity[2])!==versionCode||badging.includes('application-debuggable'))throw Error('APK identity or version verification failed.');
 const previous=Number(env.BENGER_PREVIOUS_VERSION_CODE??0);
 if(!Number.isSafeInteger(previous)||previous<0||!Number.isSafeInteger(versionCode)||versionCode<=previous)throw Error('APK versionCode does not allow an update of the previous build.');
 const signers=[...certificates.matchAll(/^Signer #\d+ certificate SHA-256 digest: ([0-9a-f]{64})$/mg)];
 if(signers.length!==1||signers[0][1]!==expectedCertificate)throw Error('APK signing certificate differs from the existing application.');
 const google=env.BENGER_GOOGLE_AUTH_ENABLED==='true',picker=env.BENGER_RECIPE_PICKER_ENABLED==='true';
 if(google&&!/BENGER_GOOGLE_AUTH_ENABLED\s*=\s*true\s*;/.test(buildConfig))throw Error('Native Google authorization is disabled in the compiled build.');
 if(picker){
  const id=buildConfig.match(/BENGER_PICKER_APP_ID\s*=\s*("[^"\r\n]*")\s*;/),key=buildConfig.match(/BENGER_PICKER_API_KEY\s*=\s*("[^"\r\n]*")\s*;/);
  if(!/BENGER_RECIPE_PICKER_ENABLED\s*=\s*true\s*;/.test(buildConfig)||!id||JSON.parse(id[1])!==env.BENGER_PICKER_APP_ID||!key||JSON.parse(key[1])!==env.BENGER_PICKER_API_KEY)throw Error('Native Picker configuration did not match the requested build.');
 }
 return {googleAuthorizationEnabled:google,recipePickerEnabled:picker,...(picker?{recipePickerAppId:env.BENGER_PICKER_APP_ID,distribution:'manual-test-only',featureBaseCommit:'759df23'}:{})};
}
