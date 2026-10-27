import { referenceMatches } from './portion-references.js?v=d0bfb762d335dbab773d2675feb24d1ee1075ec5';
import { HOUSEHOLD_UNITS, householdUnitLabel, samePortionUnit, isPortionDefinition, copyPortionDefinition } from './portion-model.js?v=d0bfb762d335dbab773d2675feb24d1ee1075ec5';
// Pure conversion only. Product identity and nutrition calculation belong to other layers.
export function resolvePortion({product,amount,unit,definitions=[],settings={},definitionId=null,reference=null}={}) {
 const base={inputAmount:amount,inputUnit:unit,normalizedAmount:null,normalizedUnit:product?.unit??null,source:'NONE',confidence:'LOW',status:'UNRESOLVED',estimated:false,description:'Uzupełnij porcję dla tego produktu.',alternatives:[]};
 if(!product)return base;
 if(!Number.isFinite(amount)||amount<=0||amount>100000)return {...base,description:'Podaj dodatnią ilość do 100 000.'};
 const resolved=(factor,source,description,definition=null)=>{
  const normalizedAmount=amount*factor;
  if(!Number.isFinite(normalizedAmount)||normalizedAmount<=0||normalizedAmount>1e7)return base;
  return {...base,normalizedAmount,source,confidence:'HIGH',status:'EXACT',estimated:false,description,definition:definition?copyPortionDefinition(definition):null};
 };
 if(unit===product.unit)return resolved(1,'NONE',`${amount} ${unit}`);
 if(!Object.hasOwn(HOUSEHOLD_UNITS,unit))return {...base,description:'Nie przeliczamy gęstości g ↔ ml.'};
 let matches=definitions.filter(d=>isPortionDefinition(d)&&d.productId===product.id&&samePortionUnit(d.unit,unit)&&d.normalizedUnit===product.unit);
 const user=matches.filter(d=>d.source==='USER');if(user.length)matches=user;
 if(definitionId){const chosen=matches.find(d=>d.id===definitionId);if(chosen)return resolved(chosen.normalizedAmount/chosen.amount,chosen.source,chosen.description,chosen);}
 if(matches.length===1)return resolved(matches[0].normalizedAmount/matches[0].amount,matches[0].source,matches[0].description,matches[0]);
 if(matches.length>1)return {...base,alternatives:matches.map(copyPortionDefinition),description:'Wybierz rozmiar / definicję porcji dla tego produktu.'};
 if(product.unit==='ml'){
  const volume={teaspoon:5,tablespoon:15,cup:settings.cupMl,mug:settings.mugMl}[unit];
  if(typeof volume==='number'&&Number.isFinite(volume)&&volume>0&&volume<=2000)return resolved(volume,'STANDARD_VOLUME',`${HOUSEHOLD_UNITS[unit]}: ${volume} ml${['cup','mug'].includes(unit)?' (Twoje ustawienie)':''}`);
 }
 const candidates=referenceMatches(product,reference,unit);
 // Ambiguous source serving sizes never become a silent reference selection.
 if(candidates.length===1){const definition=candidates[0],value=resolved(definition.normalizedAmount/definition.amount,'REFERENCE',`Typowa porcja: ${reference.family}`);
  if(value.confidence==='LOW')return base;
  return {...value,status:'TYPICAL',confidence:'MEDIUM',estimated:true,referenceFamily:reference.family,referenceProductId:reference.referenceProductId,referenceSource:reference.referenceSource,referencePortionId:definition.id,referenceDefinition:copyPortionDefinition(definition)};
 }
 return base;
}
export function portionLabel(conversion) {
 if(!conversion||!Object.hasOwn(HOUSEHOLD_UNITS,conversion.inputUnit))return null;
 return `${new Intl.NumberFormat('pl-PL',{maximumFractionDigits:3}).format(conversion.inputAmount)} ${householdUnitLabel(conversion.inputUnit,conversion.inputAmount)}`;
}
