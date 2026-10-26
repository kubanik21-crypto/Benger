import { sourcePortions } from './source-portions.js?v=64778a5c9c057837fd27e8fa5e0d770c00b894b1';
import { isPortionDefinition, copyPortionDefinition } from '../portion-model.js?v=64778a5c9c057837fd27e8fa5e0d770c00b894b1';
import { createProductStorage } from '../product-cache.js?v=64778a5c9c057837fd27e8fa5e0d770c00b894b1';
import { copyProduct, isProduct, normalizeBarcode, barcodeKey, searchProducts } from '../product-model.js?v=64778a5c9c057837fd27e8fa5e0d770c00b894b1';
let counter=0;
export function normalizeCustomProduct(input, previous=null){
 const name=typeof input.name==='string'?input.name.trim():'';
 if(!name || name.length>240)throw new TypeError('Podaj nazwę produktu (maks. 240 znaków).');
 const brand=typeof input.brand==='string'?input.brand.trim():'';
 if(brand.length>240)throw new TypeError('Marka może mieć najwyżej 240 znaków.');
 const barcode=input.barcode?normalizeBarcode(input.barcode):null;
 if(input.barcode&&!barcode)throw new TypeError('Niepoprawny kod EAN / UPC.');
 const volume=input.unit==='ml',kcalLimit=volume?2500:1000,macroLimit=volume?250:100;
 const per100={};
 for(const key of ['kcal','protein','fat','carbs']){const raw=input.per100?.[key];if(typeof raw!=='number'||!Number.isFinite(raw)||raw<0||raw>(key==='kcal'?kcalLimit:macroLimit))throw new TypeError(`Wpisz kcal 0–${kcalLimit} i makro 0–${macroLimit} na 100 ${input.unit}.`);per100[key]=raw;}
 if(per100.protein+per100.fat+per100.carbs>(volume?300:101))throw new TypeError('Suma makro jest zbyt duża dla wybranej podstawy. Sprawdź etykietę.');
 const sourceId=previous?.sourceId??(globalThis.crypto?.randomUUID?.()??`${Date.now().toString(36)}-${++counter}-${Math.random().toString(36).slice(2)}`);
 const product={id:`custom:${sourceId}`,source:'custom',sourceId,name,brand:brand||null,barcode,unit:input.unit,basis:'declared',estimated:false,nutritionCompleteness:'COMPLETE',per100,imageUrl:null,quantity:Object.hasOwn(input,'quantity')?input.quantity:previous?.quantity??null,updatedAt:new Date().toISOString()};
 if(input.packageAmount!==undefined && input.packageAmount!==null && input.packageAmount!=='') {
  if(typeof input.packageAmount!=='number'||!Number.isFinite(input.packageAmount)||input.packageAmount<=0||input.packageAmount>100000)throw new TypeError('Podaj dodatnią wielkość opakowania do 100 000.');
  product.quantity=`${input.packageAmount} ${product.unit}`;
 }
 const supplied=input.portions??previous?.portions??[];
 if(!Array.isArray(supplied)||supplied.length>30)throw new TypeError('Najwyżej 30 definicji porcji.');
 product.portions=supplied.map(d=>{const value={...d,productId:product.id,source:'USER'};if(!isPortionDefinition(value)||value.normalizedUnit!==product.unit)throw new TypeError('Nieprawidłowa porcja produktu.');return copyPortionDefinition(value);});
 if(product.quantity)product.portions=[...product.portions.filter(d=>d.unit!=='package'),...sourcePortions({quantity:product.quantity},product)];
 if(!isProduct(product))throw new TypeError('Wybierz jednostkę g albo ml.');return product;
}
export function createCustomProvider({storage=createProductStorage()}={}){
 const list=async()=>(await storage.read('meta')).filter(row=>row?.key===`custom:${row.product?.sourceId}`&&row.product?.source==='custom'&&isProduct(row.product)).map(row=>copyProduct(row.product));
 return {list,async getById(id){const row=await storage.read('meta',id);return row?.product?.source==='custom'&&isProduct(row.product)?copyProduct(row.product):null;},
  async save(input,id=null){const previous=id?await this.getById(id):null;if(id&&!previous)throw new TypeError('Produkt nie istnieje.');const product=normalizeCustomProduct(input,previous);
   if(product.barcode&&(await list()).some(p=>p.id!==product.id&&barcodeKey(p.barcode)===barcodeKey(product.barcode)))throw new TypeError('Ten kod należy już do Twojego produktu.');
   await storage.mutate('meta',product.id,()=>({product}));return copyProduct(product);},
  async remove(id){if(!id.startsWith('custom:'))throw new TypeError('Możesz usunąć tylko własny produkt.');await storage.mutate('meta',id,()=>null);},
  async search(query){return searchProducts(await list(),query);},close:storage.close,
 };
}
