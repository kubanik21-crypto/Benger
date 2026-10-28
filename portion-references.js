import { normalizeText } from './product-model.js?v=7ccd9af2bbcc74b2cab4be6ca70b27205bc6ab7e';
import { isPortionDefinition, copyPortionDefinition } from './portion-model.js?v=7ccd9af2bbcc74b2cab4be6ca70b27205bc6ab7e';
// IDs identify actual imported USDA records. All weights are read from their source definitions.
export const REFERENCE_FAMILIES=Object.freeze({
 'olive-oil':{productId:'usda:171413',label:'oliwa z oliwek'},
 'vegetable-oil':{productId:'usda:2345737',label:'olej roślinny (NFS)'},
 'canola-oil':{productId:'usda:172336',label:'olej rzepakowy'},
 butter:{productId:'usda:173430',label:'masło'},
 'peanut-butter':{productId:'usda:174266',label:'masło z orzechów ziemnych, gładkie'},
 honey:{productId:'usda:169640',label:'miód'},
 'granulated-sugar':{productId:'usda:169655',label:'cukier kryształ'},
 mayonnaise:{productId:'usda:171009',label:'majonez klasyczny'},
 ketchup:{productId:'usda:168556',label:'ketchup'},
});
// Whole-name matching after removing only explicitly supplied brand tokens. Unknown variants fail closed.
export function referenceFamily(product){
 if(!product||product.unit!=='g'||typeof product.name!=='string'||product.name.length>240)return null;
 const words=text=>normalizeText(text).replace(/[^a-z0-9%]+/g,' ').trim().split(/\s+/);
 const original=words(product.name).join(' ');
 if(/\b(?:kokosowy|coconut|lniany|flax|light|lite|reduced|diet|weganski|weganska|vegan|sos|sauce|spread|blend|mieszanka|domowy|homemade|zupa|soup|puder|powdered|sztuczny|cocoa|kakao|crunchy|chunky|chrupiace|trzcinowy|brown|demerara|muscovado|cane)\b/.test(original))return null;
 const brand=new Set(words(product.brand??''));
 const semantic=new Set('oliwa oliwek olive canola rapeseed rzepakowy roslinny vegetable olej oil maslo orzechowe peanut butter honey miod cukier granulated sugar white mayonnaise majonez ketchup catsup'.split(' '));
 const name=words(product.name).filter(w=>!brand.has(w)||semantic.has(w)).join(' ');
 const rules=[
 ['olive-oil',/^(?:oliwa(?: z oliwek)?|olive oil)(?: extra virgin| virgin| extra vergine| z pierwszego tloczenia| tloczona na zimno)?$/],
 ['canola-oil',/^(?:olej rzepakowy|canola oil|rapeseed oil)(?: rafinowany| tloczony na zimno| refined)?$/],
 ['vegetable-oil',/^(?:olej(?: roslinny)?|vegetable oil)$/],
 ['peanut-butter',/^(?:maslo orzechowe(?: z orzechow ziemnych)?|peanut butter)(?: (?:100%|gladkie|kremowe|smooth|creamy))*$/],
 ['butter',/^(?:maslo|butter)(?: (?:82%|83%|extra|ekstra|solone|niesolone|salted|unsalted|bez soli))*$/],
 ['honey',/^(?:miod|honey)(?: wielokwiatowy| lipowy| gryczany| akacjowy| naturalny| flower)?$/],
 ['granulated-sugar',/^(?:cukier(?: bialy| krysztal)?|granulated sugar|white sugar)$/],
 ['mayonnaise',/^(?:majonez(?: klasyczny)?|mayonnaise(?: regular| classic)?)$/],
 ['ketchup',/^(?:ketchup(?: lagodny| klasyczny)?|catsup)$/],
 ];
 return rules.find(([,pattern])=>pattern.test(name))?.[0]??null;
}
export async function loadPortionReference(product,provider){
 const family=referenceFamily(product);if(!family)return null;
 const referenceProductId=REFERENCE_FAMILIES[family].productId;
 const definitions=(await provider.getPortions(referenceProductId)).filter(d=>isPortionDefinition(d)&&d.productId===referenceProductId&&d.source==='USDA'&&d.normalizedUnit==='g'&&['tablespoon','teaspoon'].includes(d.unit)).map(copyPortionDefinition);
 return {family,referenceProductId,referenceSource:'USDA',definitions};
}
export function referenceMatches(product,reference,unit){
 const family=referenceFamily(product);
 if(!family||family!==reference?.family||!Array.isArray(reference.definitions)||REFERENCE_FAMILIES[family].productId!==reference.referenceProductId||reference.referenceSource!=='USDA'||!['tablespoon','teaspoon'].includes(unit))return [];
 return reference.definitions.filter(d=>isPortionDefinition(d)&&d.productId===reference.referenceProductId&&d.source==='USDA'&&d.unit===unit&&d.normalizedUnit===product.unit);
}
