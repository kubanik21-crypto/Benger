import {copyDiaryEntry, validDiaryEntry} from './diary-entry.js';
import {scaleRecipeIngredient} from './recipe-model.js';
import {scaleNutrition} from './nutrition.js';

export function parseDiaryAmount(raw) {
  const text=String(raw??'').trim();
  if(!/^\d+(?:[.,]\d+)?$/.test(text))throw new Error('Wpisz ilość, np. 100 lub 50,5.');
  const amount=Number(text.replace(',','.'));
  if(!Number.isFinite(amount)||amount<=0||amount>1e7)throw new Error('Podaj ilość większą od zera, nie większą niż 10 000 000.');
  return amount;
}

export function resizeDiaryEntry(entry, amount) {
  const next=copyDiaryEntry(entry);
  if(!Number.isFinite(amount)||amount<=0||amount>1e7)throw new Error('Podaj poprawną dodatnią ilość.');
  if(amount===entry.amount)return next;
  next.nutrition=scaleNutrition(entry.nutrition,amount/entry.amount);
  next.amount=amount;if(next.mealSnapshot){next.mealSnapshot.ingredients=next.mealSnapshot.ingredients.map(i=>scaleRecipeIngredient(i,amount/entry.amount));if(next.mealSnapshot.consumedServings!==null)next.mealSnapshot.consumedServings*=amount/entry.amount;}
  // An explicitly entered mass/volume replaces the old household estimate.
  // Keeping its previous spoon/piece count would contradict the new amount.
  delete next.displayPortion;
  delete next.portionConversion;
  delete next.estimated;
  if(!validDiaryEntry(next))throw new Error('Wartości są zbyt duże. Wpisz mniejszą ilość.');
  return next;
}
