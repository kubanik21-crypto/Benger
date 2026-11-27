import {readFile,realpath,stat} from 'node:fs/promises';
import {isAbsolute,relative,sep} from 'node:path';

/** Build-only validation. Never returns credentials to application JS or error messages. */
export async function recipePickerBuildEnvironment(input,{repositoryRoot}={}) {
 const env={...input};
 if(env.BENGER_RECIPE_PICKER_ENABLED!=='true')return env;
 if(env.BENGER_GOOGLE_AUTH_ENABLED!=='true')throw Error('Picker requires the existing Google authorization to be enabled.');
 const picker=env.BENGER_PICKER_APP_ID,oauth=env.BENGER_GOOGLE_OAUTH_PROJECT_NUMBER;
 if(!/^[0-9]{5,30}$/.test(picker??'')||!/^[0-9]{5,30}$/.test(oauth??''))throw Error('Confirm the existing Android OAuth project number and Picker App ID before building.');
 if(picker!==oauth)throw Error('Picker and the existing Android OAuth client belong to different projects. Keep OAuth unchanged; configure Picker in that same project.');
 if(env.BENGER_PICKER_API_KEY_FILE){
  if(env.BENGER_PICKER_API_KEY)throw Error('Provide the Picker key through one source only: environment or private file.');
  const path=await realpath(env.BENGER_PICKER_API_KEY_FILE),root=await realpath(repositoryRoot),rel=relative(root,path);
  if(rel!=='..'&&!rel.startsWith('..'+sep)&&!isAbsolute(rel))throw Error('Picker key file must be outside the source repository.');
  const info=await stat(path);
  if(!info.isFile()||info.size>256||(info.mode&0o077)!==0)throw Error('Picker key file must be a small private file with permissions 600.');
  env.BENGER_PICKER_API_KEY=(await readFile(path,'utf8')).trim();
 }
 if(!/^AIza[0-9A-Za-z_-]{20,100}$/.test(env.BENGER_PICKER_API_KEY??''))throw Error('A valid restricted Picker key is required. Set it privately; do not put it in command arguments or source files.');
 return env;
}
