import {normalizeText} from './normalize-text.js';
import {editDistance} from './product-matching.js';
export const ocrLineKey=text=>normalizeText(text).replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
export function recipeHeading(text){
 const key=ocrLineKey(text),compact=key.replace(/\s/g,''),words=key.split(' '),first=words[0]??'';
 if(compact.length>=8&&compact.length<=10&&editDistance(compact.replace(/1/g,'i'),'skladniki')<=1||first==='ingredients')return 'ingredients';
 if(['przygotowanie','sposobprzygotowania','wykonanie','preparation','method','directions'].includes(compact))return 'preparation';
 if(first.length>=8&&first.length<=10&&editDistance(first.replace(/1/g,'i'),'skladniki')<=1)return 'ingredients';
 if(/^(?:sposob|sposoby) przygotowan/.test(key)||first.length>=9&&editDistance(first,'przygotowanie')<=1||first.length>=8&&editDistance(first,'wykonanie')<=1||/^krok \d/.test(key))return 'preparation';
 return null;
}
export function isRecipePageNoise(text){const key=ocrLineKey(text);return /(?:https?:\/\/|www\.|\.(?:com|pl|org|net)\b|[<>]|\b\d{1,2}:\d{2}\b)/iu.test(text)||/^(?:dodaj notatke|nie wygaszaj|zaloguj|zarejestruj|wyszukaj|szukaj|udostepnij|drukuj|dodaj do|zapisz przepis|zaakceptuj|akceptuje|polityka|reklama|reklamy|cookies|cookie|czytaj|zobacz|przejdz|kup teraz|zawsze uzyc tekstu|ugotuj dzisiaj|dla ciebie|odkrywaj|moje przepisy|moj tydzien|zakupy|wiadomosc)\b/.test(key)||/^\d+ porcj/.test(key)||/\b(?:pln|zl|eur|gb|mhz)\b/.test(key);}
export function normalizeOcrRegion(region={x:0,y:0,width:1,height:1}){
 const {x,y,width,height}=region;if(![x,y,width,height].every(v=>typeof v==='number'&&Number.isFinite(v))||x<0||y<0||width<.02||height<.02||x+width>1.000001||y+height>1.000001)throw new Error('Zaznacz prawidłowy obszar składników.');return {x,y,width,height};
}
export function ingredientImageRegion(lines,width,height){
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return null;
 const valid=lines.filter(l=>l&&typeof l.text==='string'&&l.bbox&&[l.bbox.x0,l.bbox.y0,l.bbox.x1,l.bbox.y1].every(Number.isFinite)&&l.bbox.y0>=0&&l.bbox.y1>l.bbox.y0&&l.bbox.y1<=height+1).sort((a,b)=>a.bbox.y0-b.bbox.y0);
 const heading=valid.find(l=>recipeHeading(l.text)==='ingredients');if(!heading)return null;
 const end=valid.find(l=>l.bbox.y0>heading.bbox.y1&&recipeHeading(l.text)==='preparation');const top=Math.max(0,heading.bbox.y1+2),bottom=end?end.bbox.y0-2:height;
 const inside=valid.filter(l=>l.bbox.y0>=top&&l.bbox.y1<=bottom&&!isRecipePageNoise(l.text));
 // A header without an ingredient-looking quantity is not enough to crop arbitrary web content.
 if(bottom-top<Math.max(24,height*.02)||!inside.some(l=>/\d|[½¼¾]/u.test(l.text)&&/[a-ząćęłńóśźż]/iu.test(l.text)))return null;
 return {x:0,y:top/height,width:1,height:(bottom-top)/height};
}
export function ocrGeometryLines(data){const lines=[];for(const block of data.blocks??[])for(const paragraph of block.paragraphs??[])for(const line of paragraph.lines??[])lines.push(line);return lines;}
