import {NUTRITION_STORAGE_KEY} from './app-storage.js';
const KEY=NUTRITION_STORAGE_KEY+'.creation-times.v1';
const valid=v=>typeof v==='string'&&Number.isFinite(Date.parse(v));
function read(local){const raw=local?.getItem(KEY);if(!raw)return{};const value=JSON.parse(raw);if(!value||Array.isArray(value)||Object.keys(value).length>20000||Object.values(value).some(v=>!valid(v)))throw Error('Nie można odczytać dat utworzenia wpisów.');return value;}
export function diaryCreatedAt(id,fallback,local=globalThis.localStorage){try{const values=read(local);return Object.hasOwn(values,id)?values[id]:fallback;}catch{return fallback;}}
// Capture only entries that already exist, before a later edit/delete can remove them.
export function rememberDiaryOrigins(entries,local=globalThis.localStorage){if(!local)return;const values=read(local);let changed=false;for(const e of entries)if(valid(e.createdAt)&&values[e.id]!==e.createdAt){Object.defineProperty(values,e.id,{value:e.createdAt,enumerable:true,writable:true,configurable:true});changed=true;}if(Object.keys(values).length>20000)throw Error('Limit historii dat wpisów.');if(changed)local.setItem(KEY,JSON.stringify(values));}
