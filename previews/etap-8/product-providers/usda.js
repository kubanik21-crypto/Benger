import { canonicalWord } from '../food-language.js?v=3237a7e4b07e427a84a0c5ceb0b38ee3e5cee08f';
import { copyProduct, isProduct, normalizeText } from '../product-model.js?v=3237a7e4b07e427a84a0c5ceb0b38ee3e5cee08f';

export const POLISH_FOOD_TERMS = {
 ryz:'rice',makaron:'pasta',kurczak:'chicken',piers:'breast',wolowina:'beef',wieprzowina:'pork',indyk:'turkey',
 banan:'banana',jablko:'apple',ziemniaki:'potato',ziemniak:'potato',marchew:'carrot',jajko:'egg',jajka:'egg',mleko:'milk',maslo:'butter',oliwa:'olive oil',
 platki:'oats',owsiane:'',pieczywo:'bread',chleb:'bread',bulka:'roll',warzywa:'vegetable',owoce:'fruit',ryba:'fish',losos:'salmon',tunczyk:'tuna',dorsz:'cod',
 ser:'cheese',twarog:'cottage cheese',jogurt:'yogurt',kefir:'kefir',kasza:'',gryczana:'buckwheat',jaglana:'millet',fasola:'beans',soczewica:'lentils',ciecierzyca:'chickpeas',
 pomidor:'tomato',ogorek:'cucumber',salata:'lettuce',szpinak:'spinach',brokuly:'broccoli',kalafior:'cauliflower',cebula:'onion',czosnek:'garlic',papryka:'pepper',
 truskawki:'strawberry',maliny:'raspberry',borowki:'blueberry',gruszka:'pear',pomarancza:'orange',cytryna:'lemon',winogrona:'grape',arbuz:'watermelon',
 orzechy:'nuts',migdal:'almond',migdaly:'almond',wloskie:'walnuts',pestki:'seeds',slonecznik:'sunflower',slonecznika:'sunflower',dynia:'pumpkin',awokado:'avocado',
 cukier:'sugar',sol:'salt',miod:'honey',kakao:'cocoa',czekolada:'chocolate',kawa:'coffee',herbata:'tea',woda:'water',sok:'juice',olej:'oil',rzepakowy:'canola',
 zolty:'cheddar',naturalny:'plain',udko:'thigh',udka:'thigh',schab:'pork loin',cukinia:'zucchini',brokul:'broccoli',burak:'beet',buraki:'beet',seler:'celery',pietruszka:'parsley',por:'leek',groszek:'peas',kukurydza:'corn',rzodkiewka:'radish',baklazan:'eggplant',pieczarki:'mushrooms',ogorki:'cucumber',
 brzoskwinia:'peach',morela:'apricot',sliwka:'plum',wisnie:'cherry',ananas:'pineapple',mango:'mango',kiwi:'kiwi',grejpfrut:'grapefruit',daktyle:'dates',rodzynki:'raisins',kapusta:'cabbage',brukselka:'brussels sprouts',szparagi:'asparagus',maka:'flour',pszenna:'wheat',zytnia:'rye',jeczmien:'barley',komosa:'quinoa',ryzowa:'',sledz:'herring',makrela:'mackerel',pstrag:'trout',krewetki:'shrimp',smietana:'cream',mozzarella:'mozzarella',tofu:'tofu',soja:'soy',laskowe:'hazelnuts',orzeszki:'',ziemne:'peanuts',sezam:'sesame',siemie:'flaxseed',lniane:'',jablkowy:'apple',dyni:'pumpkin',
 gotowany:'cooked',gotowane:'cooked',gotowana:'cooked',surowy:'raw',surowe:'raw',surowa:'raw',suchy:'dry',suche:'dry',smazony:'fried',pieczony:'roasted',z:'',bez:'without',skory:'skin',
};
const terms=text=>normalizeText(text).match(/[a-z0-9]+/g)??[];
const stem=word=>word.endsWith('ies')?word.slice(0,-3)+'y':word.endsWith('oes')?word.slice(0,-2):word.length>3&&word.endsWith('s')?word.slice(0,-1):word;
export const genericQueryTokens=query=>[...new Set(terms(query).map(canonicalWord).flatMap(word=>terms(Object.hasOwn(POLISH_FOOD_TERMS,word)?POLISH_FOOD_TERMS[word]:word)).map(stem))];
export function normalizeUsdaProduct(food){
 if(!food || !Number.isSafeInteger(food.fdcId) || food.fdcId<=0 || typeof food.description!=='string' || !food.description.trim())return null;
 const values=new Map();
 for(const row of food.foodNutrients??[]){
  const rawId=Number(row.nutrient?.id??row.nutrientId),id=({203:1003,204:1004,205:1005,208:1008})[rawId]??rawId,raw=row.amount??row.value;
  const declaredUnit=row.nutrient?.unitName;
  if(declaredUnit && !([1008,2047,2048].includes(id)?['kcal']:['g']).includes(normalizeText(declaredUnit)))continue;
  if(raw===null || raw===undefined || raw==='')continue;
  const value=Number(raw);if(Number.isFinite(value) && value>=0)values.set(id,value);
 }
 const per100={kcal:values.get(1008)??values.get(2048)??values.get(2047),protein:values.get(1003),fat:values.get(1004),carbs:values.get(1005)};
 const product={id:`usda:${food.fdcId}`,source:'usda',sourceId:String(food.fdcId),barcode:null,name:food.description.trim().slice(0,240),brand:null,unit:'g',basis:'declared',estimated:false,nutritionCompleteness:'COMPLETE',per100,imageUrl:null,quantity:null,updatedAt:null,
  description:food.description.trim().slice(0,240),category:typeof food.foodCategory==='string'?food.foodCategory.slice(0,240):typeof food.foodCategory?.description==='string'?food.foodCategory.description.slice(0,240):'Unknown',dataType:typeof food.dataType==='string'?food.dataType.slice(0,240):'Unknown'};
 return isProduct(product)?product:null;
}
export function buildCatalog(input){
 const products=[...new Map(input.filter(isProduct).map(p=>[p.id,p])).values()].sort((a,b)=>a.sourceId.localeCompare(b.sourceId));
 const files={},tokens=Object.create(null),prefixes=Object.create(null),byId=Object.create(null),heads=Object.create(null),rank=Object.create(null),size=128;
 for(let i=0;i<products.length;i+=size){const name=`chunk-${String(i/size).padStart(4,'0')}.json`,chunk=products.slice(i,i+size);files[name]=chunk;
  for(const p of chunk){byId[p.id]=name;heads[p.id]=stem(terms(p.name)[0]??'');rank[p.id]=p.name.length - (p.name.includes(',')&&terms(p.name.split(',')[0]).length===1?50:0) + (/\b(?:with|pudding|sandwich|salad|babyfood|soup|dessert|human|infant|fried)\b/i.test(p.name)?150:0) + (/\b(?:milk|cake|paper|noodle|flour|bran|spread|snack|bar)\b/i.test(p.name)?45:0) - (/\b(?:raw|uncooked)\b/i.test(p.name)?20:0);
   for(const token of new Set(terms(p.name).map(stem))){(tokens[token]??=[]).push(p.id);}
  }
 }
 for(const [token,ids]of Object.entries(tokens)){ids.sort((a,b)=>rank[a]-rank[b]);const prefix=token.slice(0,3);(prefixes[prefix]??=[]).push(token);}
 files['index.json']={version:1,tokens,prefixes,byId,heads,rank};
 return {files,metadata:{count:products.length,chunks:Math.ceil(products.length/size),bytes:Object.values(files).reduce((n,v)=>n+Buffer.byteLength(JSON.stringify(v)),0)}};
}

export function createUsdaProvider({base=new URL('../data/usda/',import.meta.url),fetchImpl=(...args)=>fetch(...args)}={}){
 let pendingIndex;const loaded=new Map();
 async function json(file){const response=await fetchImpl(new URL(file,base));if(!response.ok)throw new Error('Katalog USDA chwilowo niedostępny.');return response.json();}
 async function index(){if(!pendingIndex)pendingIndex=json('index.json').catch(error=>{pendingIndex=null;throw error;});return pendingIndex;}
 async function chunk(file){if(!/^chunk-\d{4}\.json$/.test(file))return[];if(loaded.has(file)){const data=loaded.get(file);loaded.delete(file);loaded.set(file,data);return data;}const data=(await json(file)).filter(p=>isProduct(p)&&p.source==='usda');loaded.set(file,data);if(loaded.size>8)loaded.delete(loaded.keys().next().value);return data;}
 return {
  async getById(id){if(!/^usda:\d+$/.test(id))return null;const idx=await index(),file=idx.byId[id];return file?(await chunk(file)).find(p=>p.id===id)??null:null;},
  async search(query){const words=genericQueryTokens(query);if(!words.length)return[];const idx=await index();
   const groups=words.map(word=>Object.hasOwn(idx.tokens,word)?idx.tokens[word]:(idx.prefixes[word.slice(0,3)]??[]).filter(token=>word.length>=3&&token.startsWith(word)).flatMap(token=>idx.tokens[token]));
   if(groups.some(group=>!group.length))return[];
   const sets=groups.map(group=>new Set(group));
   const score=id=>idx.rank[id]+(words.includes(idx.heads[id])?0:80);
   const ids=[...new Set(groups[0])].filter(id=>sets.every(group=>group.has(id))).sort((a,b)=>score(a)-score(b));
   const candidates=[...new Set(ids.map(id=>idx.byId[id]))].slice(0,6),accepted=new Set(ids);
   const products=(await Promise.all(candidates.map(chunk))).flat().filter(p=>accepted.has(p.id) && !(words.length===1&&words[0]==='water'&&!/^water(?:,|$)/i.test(p.name)));
   return products.sort((a,b)=>score(a.id)-score(b.id)).slice(0,20).map(copyProduct);
  },
  stats:()=>({loadedChunks:loaded.size}),
 };
}
