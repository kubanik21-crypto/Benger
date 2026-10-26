// Product-specific definitions. Amount describes the source serving, never a global weight.
export const HOUSEHOLD_UNITS = Object.freeze({piece:'sztuka',slice:'kromka',slab:'plaster',tablespoon:'łyżka',teaspoon:'łyżeczka',cup:'szklanka',mug:'kubek',package:'opakowanie',serving:'porcja',handful:'garść',scoop:'miarka'});
export const PORTION_SOURCES = ['USER','USDA','OFF','STANDARD_VOLUME','PACKAGE','NONE'];
export function isPortionDefinition(value) {
 return value && typeof value==='object' && typeof value.id==='string' && value.id.length>0 && value.id.length<=240
 && typeof value.productId==='string' && value.productId.length>0 && value.productId.length<=240
 && Object.hasOwn(HOUSEHOLD_UNITS,value.unit) && ['g','ml'].includes(value.normalizedUnit)
 && ['USER','USDA','OFF','PACKAGE'].includes(value.source)
 && [value.amount,value.normalizedAmount].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>0&&n<=100000)
 && typeof value.description==='string' && value.description.length<=240
 && (value.evidence===undefined || value.evidence && typeof value.evidence==='object' && !Array.isArray(value.evidence) && Object.entries(value.evidence).every(([key,v])=>['fdcId','amount','measureUnit','portionDescription','modifier','gramWeight'].includes(key)&&typeof v==='string'&&v.length<=240));
}
export function copyPortionDefinition(value) {
 if(!isPortionDefinition(value))throw new TypeError('Nieprawidłowa definicja porcji.');
 return {...(value.evidence?{evidence:{...value.evidence}}:{}),...Object.fromEntries(['id','productId','unit','amount','normalizedAmount','normalizedUnit','source','description'].map(key=>[key,value[key]]))};
}
export function validPortionSnapshot(row) {
 if(!row||typeof row!=='object')return false;
 if(row.displayPortion===undefined&&row.portionConversion===undefined)return true;
 const display=row.displayPortion,c=row.portionConversion;
 return display&&c&&Object.hasOwn(HOUSEHOLD_UNITS,display.unit)&&Number.isFinite(display.amount)&&display.amount>0&&display.amount<=100000
 &&typeof display.label==='string'&&display.label.length<=120&&c.inputAmount===display.amount&&c.inputUnit===display.unit
 &&c.normalizedAmount===row.amount&&c.normalizedUnit===row.unit&&PORTION_SOURCES.includes(c.source)&&c.source!=='NONE'&&c.confidence==='HIGH'
 &&(c.source==='STANDARD_VOLUME' ? row.unit==='ml' && ['teaspoon','tablespoon','cup','mug'].includes(c.inputUnit) : isPortionDefinition(c.definition) && c.definition.source===c.source && Math.abs(c.normalizedAmount-c.inputAmount*c.definition.normalizedAmount/c.definition.amount)<=Math.max(1e-9,c.normalizedAmount*1e-12))
 &&typeof c.description==='string'&&c.description.length<=240
 &&(c.definition===null||c.definition===undefined||isPortionDefinition(c.definition)&&c.definition.productId===row.productId&&(c.definition.unit===c.inputUnit||c.inputUnit==='slab'&&c.definition.unit==='slice')&&c.definition.normalizedUnit===row.unit);
}
export function copyPortionSnapshot(row){
 if(!validPortionSnapshot(row))throw new TypeError('Nieprawidłowy snapshot porcji.');
 if(!row.displayPortion)return {};
 const {inputAmount,inputUnit,normalizedAmount,normalizedUnit,source,confidence,description,definition}=row.portionConversion;
 return {displayPortion:{amount:row.displayPortion.amount,unit:row.displayPortion.unit,label:row.displayPortion.label},portionConversion:{inputAmount,inputUnit,normalizedAmount,normalizedUnit,source,confidence,description,definition:definition?copyPortionDefinition(definition):null}};
}
const plurals={piece:['sztuki','sztuk'],slice:['kromki','kromek'],slab:['plastry','plastrów'],tablespoon:['łyżki','łyżek'],teaspoon:['łyżeczki','łyżeczek'],cup:['szklanki','szklanek'],mug:['kubki','kubków'],package:['opakowania','opakowań'],serving:['porcje','porcji'],handful:['garście','garści'],scoop:['miarki','miarek']};
export function householdUnitLabel(unit,amount=1){if(!Object.hasOwn(HOUSEHOLD_UNITS,unit))return unit??'';if(amount===1)return HOUSEHOLD_UNITS[unit];const forms=plurals[unit];return Number.isInteger(amount)?forms[amount%10>=2&&amount%10<=4&&!(amount%100>=12&&amount%100<=14)?0:1]:unit==='handful'?'garści':forms[0];}
export function humanPortionDescription(text){return text.replace(/undetermined\s*·\s*/g,'').replace(/\b(?:tablespoons?|tbsp)\b/gi,'łyżka').replace(/\b(?:teaspoons?|tsp)\b/gi,'łyżeczka').replace(/\bpieces?\b/gi,'sztuka').replace(/\bslices?\b/gi,'kromka / plaster').replace(/\bcups?\b/gi,'szklanka (miara USDA)').replace(/\bextra small\b/gi,'bardzo małe').replace(/\bextra large\b/gi,'bardzo duże').replace(/\bsmall\b/gi,'małe').replace(/\bmedium\b/gi,'średnie').replace(/\blarge\b/gi,'duże');}
