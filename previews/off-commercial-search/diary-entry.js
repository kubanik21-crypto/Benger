import { validPortionSnapshot,copyPortionSnapshot } from './portion-model.js?v=2cd6943878b18f1baff06f924c897fa580672a97';
import { isUuid } from './recipe-model.js?v=2cd6943878b18f1baff06f924c897fa580672a97';
const text=(v,max=240)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
const number=(n,max)=>typeof n==='number'&&Number.isFinite(n)&&n>0&&n<=max;
export function validDiaryEntry(row){
 try{
 if(!row||!text(row.id)||!/^\d{4}-\d{2}-\d{2}$/.test(row.date)||new Date(row.date+'T12:00:00Z').toISOString().slice(0,10)!==row.date||!['breakfast','lunch','dinner','snack'].includes(row.meal)||!text(row.createdAt)||!Number.isFinite(Date.parse(row.createdAt))||!number(row.amount,1e7)||!['kcal','protein','fat','carbs'].every(k=>typeof row.nutrition?.[k]==='number'&&Number.isFinite(row.nutrition[k])&&row.nutrition[k]>=0&&row.nutrition[k]<=1e10))return false;
 if(row.kind==='RECIPE'||row.sourceType==='recipe'){
  const y=row.recipeYieldSnapshot;
  return row.kind==='RECIPE'&&row.sourceType==='recipe'&&isUuid(row.recipeId)&&Number.isSafeInteger(row.recipeVersion)&&row.recipeVersion>0&&row.recipeVersion<=1e6&&text(row.recipeName,200)&&!['productId','productName','portionConversion','displayPortion'].some(k=>Object.hasOwn(row,k))&&['serving','g','ml'].includes(row.unit)&&y&&typeof y==='object'&&!Array.isArray(y)&&Object.keys(y).length>0&&Object.keys(y).every(k=>['servings','finalWeight','finalVolume'].includes(k)&&number(y[k],k==='servings'?10000:1e7))&&number(y[({serving:'servings',g:'finalWeight',ml:'finalVolume'})[row.unit]],1e7);
 }
 return (row.kind===undefined||row.kind==='PRODUCT')&&(row.sourceType===undefined||row.sourceType==='product')&&!Object.keys(row).some(k=>k.startsWith('recipe'))&&validPortionSnapshot(row)&&text(row.productId)&&text(row.productName)&&['g','ml'].includes(row.unit)&&['brand','source','sourceId','barcode'].every(k=>row[k]===undefined||row[k]===null||text(row[k]));
 }catch{return false;}
}
export function copyDiaryEntry(row){if(!validDiaryEntry(row))throw new TypeError('Nieprawidłowy wpis dziennika.');const common={id:row.id,date:row.date,createdAt:row.createdAt,meal:row.meal,amount:row.amount,unit:row.unit,nutrition:{...row.nutrition}};
 return row.kind==='RECIPE'?{...common,kind:'RECIPE',sourceType:'recipe',recipeId:row.recipeId,recipeVersion:row.recipeVersion,recipeName:row.recipeName,recipeYieldSnapshot:{...row.recipeYieldSnapshot}}:{...common,productId:row.productId,productName:row.productName,...copyPortionSnapshot(row),...Object.fromEntries(['brand','source','sourceId','barcode','kind','sourceType'].filter(k=>row[k]!==undefined).map(k=>[k,row[k]]))};
}
