import { normalizeBarcode } from './product-model.js?v=0e5b60957276146690f414006c82d34bc81e5d66';
export function normalizeScannedBarcode(raw,format=''){
 if(typeof raw!=='string')return null;
 const code=raw.trim();
 if(format.toLowerCase().replaceAll('-','_')!=='upc_e')return normalizeBarcode(code);
 if(!/^[01]\d{7}$/.test(code))return null;
 const [ns,a,b,c,d,e,f,check]=code;
 const expanded='012'.includes(f)?ns+a+b+f+'0000'+c+d+e: f==='3'?ns+a+b+c+'00000'+d+e:f==='4'?ns+a+b+c+d+'00000'+e:ns+a+b+c+d+e+'0000'+f;
 return normalizeBarcode(expanded+check);
}
