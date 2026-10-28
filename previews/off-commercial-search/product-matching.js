import {normalizeText} from './normalize-text.js?v=3928bb31182ca57f6ec22debc759e1d19548012b';
import {canonicalWord,FOOD_HEADS,FOOD_FORMS} from './food-language.js?v=3928bb31182ca57f6ec22debc759e1d19548012b';
import {POLISH_FOOD_TERMS} from './product-vocabulary.js?v=3928bb31182ca57f6ec22debc759e1d19548012b';
const synonyms={kartofel:'ziemniaki',mleczko:'mleko'};
const vocabulary=[...new Set([...FOOD_HEADS,...Object.keys(synonyms),...Object.values(FOOD_FORMS),...Object.keys(POLISH_FOOD_TERMS),'sojowy','kokosowy','ciemny','jasny','filet'])];
// Productive endings are checked against known lemmas. Unknown words/brands are retained.
const ending=/(?:kami|kach|kom|kow|owi|ego|emu|ami|ach|owa|owe|owy|ych|iej|ej|ka|ki|ke|ek|ow|em|om|ie|ia|a|e|i|o|u|y)$/;
const stem=word=>word.length>3?word.replace(ending,''):word;
const stems=new Map();for(const word of vocabulary){const keys=[stem(word),stem(word).replace(/e(?=[^aeiouy]+$)/,'')];for(const key of keys)if(key.length>=3){const set=stems.get(key)??new Set();set.add(word);stems.set(key,set);}}
export function editDistance(a,b){if(Math.abs(a.length-b.length)>2)return 3;let prev=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const row=[i];for(let j=1;j<=b.length;j++)row[j]=Math.min(row[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));prev=row;}return prev[b.length];}
function lemma(word){
 const known=canonicalWord(word);if(known!==word)return known;
 if(Object.hasOwn(synonyms,word))return synonyms[word];
 if(vocabulary.includes(word))return word;
 const adjective=word.replace(/owego$/,'owy').replace(/owej$/,'owa');if(vocabulary.includes(adjective))return adjective;
 // Fleeting e (marchew/marchwi) and diminutive k share the same family stem.
 const key=stem(word),matches=stems.get(key)??stems.get(key.replace(/e(?=[^aeiouy]+$)/,''));
 if(matches?.size===1){const match=[...matches][0];return synonyms[match]??match;}
 if(matches){const semantic=[...matches].filter(w=>Object.hasOwn(POLISH_FOOD_TERMS,w));if(semantic.length===1)return semantic[0];}
 if(word.length>=6&&key.length>=5&&key!==word){const close=[...new Set(vocabulary.filter(w=>stem(w).length>=5&&editDistance(key,stem(w))===1).map(w=>synonyms[w]??w))];if(close.length===1)return close[0];}
 if(word.length>=5){const close=vocabulary.filter(w=>w.length>=5&&editDistance(word,w)===1);if(close.length===1)return synonyms[close[0]]??close[0];}
 return word;
}
const lemmaCache=new Map();
function cachedLemma(word){if(lemmaCache.has(word))return lemmaCache.get(word);const result=lemma(word);if(lemmaCache.size>=2048)lemmaCache.delete(lemmaCache.keys().next().value);lemmaCache.set(word,result);return result;}
export function canonicalProductName(value){
 const words=normalizeText(value).split(' ').map(cachedLemma);let text=words.join(' ');
 text=text.replace(/\bfilet(?:y|a|ow)?\s+(?:z\s+)?piers\b/g,'piers').replace(/\bfilet(?:y|a|ow)?\s+(?:z\s+)?kurczak\b/g,'piers z kurczak');
 return text.replace(/(\d+),(\d+)%/g,'$1.$2%').replace(/\s+/g,' ').trim();
}
const words=value=>canonicalProductName(value).match(/[a-z0-9]+(?:[.,]\d+)?%?/g)??[];
const enStem=w=>w.endsWith('ies')?w.slice(0,-3)+'y':w.endsWith('oes')?w.slice(0,-2):w.length>3&&w.endsWith('s')?w.slice(0,-1):w;
export function semanticTokens(value){return words(value).flatMap(w=>(Object.hasOwn(POLISH_FOOD_TERMS,w)?POLISH_FOOD_TERMS[w]:w).match(/[a-z0-9]+(?:[.,]\d+)?%?/g)??[]).map(enStem);}
export function rankProductCandidates(products,query){
 const q=canonicalProductName(query),wanted=semanticTokens(q);if(!wanted.length)return [];
 return products.map(product=>{
  const name=product.source==='usda'?normalizeText(product.name):canonicalProductName(product.name),tokens=new Set(product.source==='usda'?(normalizeText(product.name).match(/[a-z0-9]+(?:[.,]\d+)?%?/g)??[]).map(enStem):semanticTokens(`${product.name} ${product.brand??''}`));
  const matches=wanted.every(w=>tokens.has(w));let score=0;
  if(matches){score=name===q?100:tokens.size===new Set(wanted).size?99:90;score-=Math.max(0,tokens.size-wanted.length)*.3;
   if(product.source==='usda'&&/^(carrots?|bananas?|apples?), raw$/i.test(product.name)&&wanted.length===1)score=98;
  }else if(wanted.length&&wanted.every(w=>[...tokens].some(t=>w.length>=5&&t.length>=5&&editDistance(w,t)===1)))score=75;
  return {product,score,similarity:wanted.filter(w=>tokens.has(w)).length/wanted.length,exact:name===q,canonicalName:q};
 }).sort((a,b)=>b.score-a.score||(a.score>0?a.product.name.localeCompare(b.product.name,'pl')||a.product.id.localeCompare(b.product.id):0));
}
export function obviousProduct(products,query){
 const ranked=rankProductCandidates(products,query).filter(r=>r.score>0);if(!ranked.length)return null;
 const top=ranked[0];if(top.product.brand||top.score<98)return null;
 // Milk and dairy variants remain meaningful choices, even with one generic label.
 if((/^(?:mleko|jogurt|ser)(?: |$)/.test(canonicalProductName(query))||['sos sojowy','sos','olej','kurczak'].includes(canonicalProductName(query)))&&ranked.length>1)return null;
 const peers=ranked.filter(r=>r.score===top.score);
 if(peers.some(r=>r.product.brand))return null;
 if(peers.length===1)return top.product;
 if(peers.every(r=>r.product.source==='usda'&&canonicalProductName(r.product.name)===canonicalProductName(top.product.name)))return top.product;
 return null;
}

export function isKnownProductPhrase(text){const tokens=canonicalProductName(text).split(' ').filter(w=>w!=='z');return tokens.length>0&&tokens.every(w=>vocabulary.includes(w));}
