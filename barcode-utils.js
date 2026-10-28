import { normalizeBarcode } from './product-model.js?v=1a774fcfae3d9d68876363dc3bcb24df18edb054';
export function normalizeScannedBarcode(raw,format=''){
 if(typeof raw!=='string')return null;
 const code=raw.trim();
 if(format.toLowerCase().replaceAll('-','_')!=='upc_e')return normalizeBarcode(code);
 if(!/^[01]\d{7}$/.test(code))return null;
 const [ns,a,b,c,d,e,f,check]=code;
 const expanded='012'.includes(f)?ns+a+b+f+'0000'+c+d+e: f==='3'?ns+a+b+c+'00000'+d+e:f==='4'?ns+a+b+c+d+'00000'+e:ns+a+b+c+d+e+'0000'+f;
 return normalizeBarcode(expanded+check);
}
