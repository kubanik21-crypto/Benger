/** Validate public APK identity and native flags without exposing build credentials. */
function verifyIdentityAndFlags({badging,buildConfig,version,versionCode,env={}}){
 const identity=badging.match(/^package: name='([^']+)' versionCode='(\d+)' versionName='([^']+)'/m);
 if(!identity||identity[1]!=='io.github.kubanik21crypto.benger'||identity[3]!==version||Number(identity[2])!==versionCode||badging.includes('application-debuggable'))throw Error('APK identity or version verification failed.');
 const previous=Number(env.BENGER_PREVIOUS_VERSION_CODE??0);
 if(!Number.isSafeInteger(previous)||previous<0||!Number.isSafeInteger(versionCode)||versionCode<=previous)throw Error('APK versionCode does not allow an update of the previous build.');
 const google=env.BENGER_GOOGLE_AUTH_ENABLED==='true',picker=env.BENGER_RECIPE_PICKER_ENABLED==='true';
 if(google&&!/BENGER_GOOGLE_AUTH_ENABLED\s*=\s*true\s*;/.test(buildConfig))throw Error('Native Google authorization is disabled in the compiled build.');
 if(picker){
  const id=buildConfig.match(/BENGER_PICKER_APP_ID\s*=\s*("[^"\r\n]*")\s*;/),key=buildConfig.match(/BENGER_PICKER_API_KEY\s*=\s*("[^"\r\n]*")\s*;/);
  if(!/BENGER_RECIPE_PICKER_ENABLED\s*=\s*true\s*;/.test(buildConfig)||!id||JSON.parse(id[1])!==env.BENGER_PICKER_APP_ID||!key||JSON.parse(key[1])!==env.BENGER_PICKER_API_KEY)throw Error('Native Picker configuration did not match the requested build.');
 }
 return {googleAuthorizationEnabled:google,recipePickerEnabled:picker,...(picker?{recipePickerAppId:env.BENGER_PICKER_APP_ID,distribution:'manual-test-only',featureBaseCommit:'759df23'}:{})};
}

export function verifyApkBuild(input){
 const signers=[...input.certificates.matchAll(/^Signer #\d+ certificate SHA-256 digest: ([0-9a-f]{64})$/mg)];
 if(signers.length!==1||signers[0][1]!==input.expectedCertificate)throw Error('APK signing certificate differs from the existing application.');
 return verifyIdentityAndFlags(input);
}
export function verifyUnsignedApkBuild(input){return {...verifyIdentityAndFlags(input),signingState:'unsigned-do-not-install'};}
/** Whitelist the public transfer metadata before using the existing private signing key. */
export function validateUnsignedArtifactMetadata(m,expected){
 if(!m||m.signingState!=='unsigned-do-not-install'||m.applicationId!=='io.github.kubanik21crypto.benger'||m.version!=='1.0.21'||!Number.isSafeInteger(m.versionCode)||m.versionCode<=28557699||m.versionCode>2100000000||m.expectedCertificateSha256!==expected||!/^[a-f0-9]{40}$/.test(m.build??'')||!/^[a-f0-9]{64}$/.test(m.sha256??'')||m.googleAuthorizationEnabled!==true||m.recipePickerEnabled!==true||m.recipePickerAppId!=='481332161595'||typeof m.builtAt!=='string'||!Number.isFinite(Date.parse(m.builtAt)))throw Error('The CI artifact metadata does not match the requested update.');
 return {applicationId:m.applicationId,version:m.version,versionCode:m.versionCode,build:m.build,builtAt:new Date(m.builtAt).toISOString(),sha256:m.sha256};
}
