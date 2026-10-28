import { tokenizeFood } from './food-tokenizer.js?v=7ccd9af2bbcc74b2cab4be6ca70b27205bc6ab7e';
// Ilości są kotwicami. Rozpoznane początki rodzin nazw pozwalają rozdzielić mieszany szyk.
// Nieznana nazwa z wieloma ilościami pozostaje jednym niepewnym fragmentem.
export function segmentFoodText(text){
 text=text.replace(/\bcos tam dziwnego\b/g,';cos tam dziwnego;');
 const groups=text.split(/(?<!\d),|,(?!\d)|;|\b(?:i|oraz|plus|do tego|na koniec)\b/).map(x=>x.trim()).filter(Boolean);
 const output=[];
 for(const group of groups){
  const tokens=tokenizeFood(group), heads=tokens.map((token,index)=>token.type==='PRODUCT'?index:-1).filter(i=>i>=0);
  const quantities=tokens.flatMap((token,index)=>token.type==='NUMBER' && tokens[index+1]?.type==='UNIT'?[index]:[]);
  if(heads.length<2 || !quantities.length){output.push(group);continue;}
  const assignments=new Map(),unused=new Set(quantities);
  // Sufix ilości tuż po nazwie ma pierwszeństwo tylko przed kolejnym rozpoznanym produktem.
  for(let h=0;h<heads.length;h++){
   const head=heads[h],end=heads[h+1]??tokens.length;
   const after=quantities.filter(q=>q>head && q<end);
   const before=quantities.filter(q=>q<head && q>(heads[h-1]??-1) && unused.has(q));
   let chosen;
   if(h===0 && before.length)chosen=before.at(-1);
   else if(after.length)chosen=after[0];
   else if(before.length)chosen=before.at(-1);
   if(chosen!==undefined && unused.has(chosen)){assignments.set(head,chosen);unused.delete(chosen);}
  }
  if(assignments.size!==heads.length || unused.size){
   // Łańcuch amount-first: każda ilość poprzedza jedną nazwę i nie ma sufixu ostatniej.
   if(quantities.length===heads.length && quantities.every((q,i)=>q<heads[i] && (i===0 || q>heads[i-1]))){
    quantities.forEach((q,i)=>output.push(group.slice(tokens[q].start,i+1<quantities.length?tokens[quantities[i+1]].start:group.length).trim()));
   }else output.push(group);
   continue;
  }
  const spans=heads.map(head=>({head,quantity:assignments.get(head),start:Math.min(tokens[head].start,tokens[assignments.get(head)].start)}));
  // Kotwice muszą być monotoniczne i dawać jedną porcję każdej nazwie.
  if(spans.some((span,i)=>i && span.start<=spans[i-1].start)){output.push(group);continue;}
  spans.forEach((span,i)=>output.push(group.slice(i?span.start:0,spans[i+1]?.start??group.length).trim()));
 }
 return output;
}
