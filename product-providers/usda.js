import { copyProduct, isProduct, normalizeText } from '../product-model.js';

export const POLISH_FOOD_TERMS = {
 ryz:'rice',makaron:'pasta',kurczak:'chicken',piers:'breast',wolowina:'beef',wieprzowina:'pork',indyk:'turkey',
 banan:'banana',jablko:'apple',ziemniaki:'potato',ziemniak:'potato',marchew:'carrot',jajko:'egg',jajka:'egg',mleko:'milk',maslo:'butter',oliwa:'olive oil',
 platki:'oats',owsiane:'',pieczywo:'bread',chleb:'bread',bulka:'roll',warzywa:'vegetable',owoce:'fruit',ryba:'fish',losos:'salmon',tunczyk:'tuna',dorsz:'cod',
 ser:'cheese',twarog:'cottage cheese',jogurt:'yogurt',kefir:'kefir',kasza:'groats',gryczana:'buckwheat',jaglana:'millet',fasola:'beans',soczewica:'lentils',ciecierzyca:'chickpeas',
 pomidor:'tomato',ogorek:'cucumber',salata:'lettuce',szpinak:'spinach',brokuly:'broccoli',kalafior:'cauliflower',cebula:'onion',czosnek:'garlic',papryka:'pepper',
 truskawki:'strawberry',maliny:'raspberry',borowki:'blueberry',gruszka:'pear',pomarancza:'orange',cytryna:'lemon',winogrona:'grape',arbuz:'watermelon',
 orzechy:'nuts',migdal:'almond',migdaly:'almond',wloskie:'walnuts',pestki:'seeds',slonecznik:'sunflower',dynia:'pumpkin',awokado:'avocado',
 cukier:'sugar',sol:'salt',miod:'honey',kakao:'cocoa',czekolada:'chocolate',kawa:'coffee',herbata:'tea',woda:'water',sok:'juice',olej:'oil',rzepakowy:'canola',
 gotowany:'cooked',gotowane:'cooked',gotowana:'cooked',surowy:'raw',surowe:'raw',surowa:'raw',suchy:'dry',suche:'dry',smazony:'fried',pieczony:'roasted',z:'',bez:'without',skory:'skin',
};
const terms=text=>normalizeText(text).match(/[a-z0-9]+/g)??[];
const stem=word=>word.length>4 && word.endsWith('s')?word.slice(0,-1):word;
export const genericQueryTokens=query=>[...new Set(terms(query).flatMap(word=>terms(Object.hasOwn(POLISH_FOOD_TERMS,word)?POLISH_FOOD_TERMS[word]:word)).map(stem))];
export function normalizeUsdaProduct(food){
 if(!food || !Number.isSafeInteger(food.fdcId) || food.fdcId<=0 || typeof food.description!=='string' || !food.description.trim())return null;
 const values=new Map();
 for(const row of food.foodNutrients??[]){
  const id=Number(row.nutrient?.id??row.nutrientId),raw=row.amount??row.value;
  if(raw===null || raw===undefined || raw==='')continue;
  const value=Number(raw);if(Number.isFinite(value) && value>=0)values.set(id,value);
 }
 const per100={kcal:values.get(1008)??values.get(2048)??values.get(2047),protein:values.get(1003),fat:values.get(1004),carbs:values.get(1005)};
 const product={id:`usda:${food.fdcId}`,source:'usda',sourceId:String(food.fdcId),barcode:null,name:food.description.trim().slice(0,240),brand:null,unit:'g',basis:'declared',estimated:false,per100,imageUrl:null,quantity:null,updatedAt:null,
  description:food.description.trim().slice(0,240),category:typeof food.foodCategory==='string'?food.foodCategory:food.foodCategory?.description??'Unknown',dataType:food.dataType??'Unknown'};
 return isProduct(product)?product:null;
}
export function buildCatalog(input){
 const products=[...new Map(input.filter(isProduct).map(p=>[p.id,p])).values()].sort((a,b)=>a.sourceId.localeCompare(b.sourceId));
 const files={},tokens={},byId={},size=128;
 for(let i=0;i<products.length;i+=size){const name=`chunk-${String(i/size).padStart(4,'0')}.json`,chunk=products.slice(i,i+size);files[name]=chunk;
  for(const p of chunk){byId[p.id]=name;for(const token of new Set(terms(p.name).map(stem))){(tokens[token]??=[]);if(!tokens[token].includes(name))tokens[token].push(name);}}
 }
 files['index.json']={version:1,tokens,byId};
 return {files,metadata:{count:products.length,chunks:Math.ceil(products.length/size),bytes:Object.values(files).reduce((n,v)=>n+Buffer.byteLength(JSON.stringify(v)),0)}};
}

export function createUsdaProvider({base=new URL('../data/usda/',import.meta.url),fetchImpl=(...args)=>fetch(...args)}={}){
 let pendingIndex;const loaded=new Map();
 async function json(file){const response=await fetchImpl(new URL(file,base));if(!response.ok)throw new Error('Katalog USDA chwilowo niedostępny.');return response.json();}
 async function index(){if(!pendingIndex)pendingIndex=json('index.json').catch(error=>{pendingIndex=null;throw error;});return pendingIndex;}
 async function chunk(file){if(!/^chunk-\d{4}\.json$/.test(file))return[];if(loaded.has(file))return loaded.get(file);const data=(await json(file)).filter(p=>isProduct(p)&&p.source==='usda');loaded.set(file,data);if(loaded.size>8)loaded.delete(loaded.keys().next().value);return data;}
 return {
  async getById(id){if(!/^usda:\d+$/.test(id))return null;const idx=await index(),file=idx.byId[id];return file?(await chunk(file)).find(p=>p.id===id)??null:null;},
  async search(query){const words=genericQueryTokens(query);if(!words.length)return[];const idx=await index();
   const groups=words.map(word=>Object.entries(idx.tokens).filter(([token])=>token===word || word.length>=3&&token.startsWith(word)).flatMap(([,files])=>files));
   if(groups.some(group=>!group.length))return[];
   const candidates=[...new Set(groups[0])].filter(file=>groups.every(group=>group.includes(file))).slice(0,6);
   const products=(await Promise.all(candidates.map(chunk))).flat().filter(p=>{const keys=terms(p.name).map(stem);return words.every(word=>keys.some(key=>key===word || word.length>=3&&key.startsWith(word)));});
   return products.sort((a,b)=>a.name.length-b.name.length).slice(0,20).map(copyProduct);
  },
  stats:()=>({loadedChunks:loaded.size}),
 };
}
