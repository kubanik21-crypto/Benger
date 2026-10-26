// Product-specific definitions. Amount describes the source serving, never a global weight.
export const HOUSEHOLD_UNITS = Object.freeze({piece:'szt.',slice:'kromka',slab:'plaster',tablespoon:'łyżka',teaspoon:'łyżeczka',cup:'szklanka',mug:'kubek',package:'opakowanie',serving:'porcja',handful:'garść',scoop:'miarka'});
export const PORTION_SOURCES = ['USER','USDA','OFF','STANDARD_VOLUME','PACKAGE','NONE'];
export function isPortionDefinition(value) {
 return value && typeof value==='object' && typeof value.id==='string' && value.id.length>0 && value.id.length<=240
 && typeof value.productId==='string' && value.productId.length>0 && value.productId.length<=240
 && Object.hasOwn(HOUSEHOLD_UNITS,value.unit) && ['g','ml'].includes(value.normalizedUnit)
 && ['USER','USDA','OFF','PACKAGE'].includes(value.source)
 && [value.amount,value.normalizedAmount].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>0&&n<=100000)
 && typeof value.description==='string' && value.description.length<=240;
}
export function copyPortionDefinition(value) {
 if(!isPortionDefinition(value))throw new TypeError('Nieprawidłowa definicja porcji.');
 return Object.fromEntries(['id','productId','unit','amount','normalizedAmount','normalizedUnit','source','description'].map(key=>[key,value[key]]));
}
