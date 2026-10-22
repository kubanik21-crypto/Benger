import { PRODUCTS, calculatePortion } from './nutrition.js';

const $=id=>document.getElementById(id);

const productSelect = $('product');
const amountInput = $('amount');
const portionPreview = $('portion-preview');
const calculatorMessage = $('calculator-message');
const portionFields = {
  kcal: $('portion-kcal'),
  protein: $('portion-protein'),
  fat: $('portion-fat'),
  carbs: $('portion-carbs'),
};
const portionFormatter = new Intl.NumberFormat('pl-PL', {
  maximumFractionDigits: 2,
});
const MEAL_LABELS = {
  breakfast: 'Śniadanie',
  lunch: 'Obiad',
  dinner: 'Kolacja',
  snack: 'Przekąska',
};
const nutritionStorageKey = 'benger.nutrition.v1';
const nutritionMealSelect = $('nutrition-meal');
const nutritionStorageMessage = $('nutrition-storage-message');
const addNutritionButton = $('add-nutrition');
let nutritionEntries = [];
let nutritionStorageOK = true;

for (const product of PRODUCTS) {
  const option = document.createElement('option');
  option.value = product.id;
  option.textContent = product.name;
  productSelect.append(option);
}

for (const [code, label] of Object.entries(MEAL_LABELS)) {
  const option = document.createElement('option');
  option.value = code;
  option.textContent = label;
  nutritionMealSelect.append(option);
}

function readPortionInput() {
  const product = PRODUCTS.find(item => item.id === productSelect.value);
  if (!product) {
    throw new Error('Wybierz produkt.');
  }

  const rawAmount = amountInput.value.trim();
  if (rawAmount === '') {
    throw new Error('Podaj ilość, aby zobaczyć wartości porcji.');
  }
  if (!/^-?\d+(?:[.,]\d+)?$/.test(rawAmount)) {
    throw new Error('Wpisz liczbę, np. 50 lub 50,5.');
  }

  const amount = Number(rawAmount.replace(',', '.'));
  return { product, amount, nutrition: calculatePortion(product, amount) };
}

function updatePortionPreview() {
  portionPreview.hidden = true;
  for (const field of Object.values(portionFields)) {
    field.textContent = '';
  }
  $('amount-unit').textContent = PRODUCTS.find(item => item.id === productSelect.value)?.unit ?? '';
  amountInput.setAttribute('aria-invalid', 'false');

  try {
    const { nutrition } = readPortionInput();
    for (const [nutrient, field] of Object.entries(portionFields)) {
      field.textContent = portionFormatter.format(nutrition[nutrient]);
    }
    calculatorMessage.textContent = '';
    portionPreview.hidden = false;
  } catch (error) {
    calculatorMessage.textContent = error.message;
    amountInput.setAttribute('aria-invalid', amountInput.value.trim() === '' ? 'false' : 'true');
  }
}

function isValidDiaryDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isValidNutritionEntry(entry) {
  return entry !== null && typeof entry === 'object'
    && typeof entry.id === 'string' && entry.id.trim() !== ''
    && isValidDiaryDate(entry.date)
    && typeof entry.createdAt === 'string' && Number.isFinite(Date.parse(entry.createdAt))
    && typeof entry.meal === 'string' && Object.hasOwn(MEAL_LABELS, entry.meal)
    && typeof entry.productId === 'string' && entry.productId.trim() !== ''
    && typeof entry.productName === 'string' && entry.productName.trim() !== ''
    && Number.isFinite(entry.amount) && entry.amount > 0
    && ['g', 'ml'].includes(entry.unit)
    && entry.nutrition !== null && typeof entry.nutrition === 'object'
    && Object.keys(portionFields).every(nutrient =>
      Number.isFinite(entry.nutrition[nutrient]) && entry.nutrition[nutrient] >= 0);
}

function loadNutritionEntries() {
  try {
    const raw = localStorage.getItem(nutritionStorageKey);
    const saved = raw === null ? [] : JSON.parse(raw);
    if (!Array.isArray(saved) || !saved.every(isValidNutritionEntry)
        || new Set(saved.map(entry => entry.id)).size !== saved.length) {
      throw new Error('Nieprawidłowy format wpisów żywieniowych.');
    }
    nutritionEntries = saved;
    nutritionStorageOK = true;
    addNutritionButton.disabled = false;
    nutritionStorageMessage.textContent = '';
    return true;
  } catch {
    nutritionStorageOK = false;
    addNutritionButton.disabled = true;
    nutritionStorageMessage.textContent = 'Nie udało się odczytać wpisów żywieniowych. Zapis jest zablokowany, aby nie nadpisać danych. Notatki tekstowe są przechowywane oddzielnie.';
    return false;
  }
}

function persistNutritionEntries(entry) {
  if (!loadNutritionEntries()) {
    renderNutritionEntries();
    return false;
  }
  const next = [...nutritionEntries, entry];
  try {
    localStorage.setItem(nutritionStorageKey, JSON.stringify(next));
  } catch {
    nutritionStorageMessage.textContent = 'Nie udało się zapisać produktu. Sprawdź dostęp do pamięci przeglądarki i wolne miejsce. Możesz ponowić zapis.';
    return false;
  }
  nutritionEntries = next;
  nutritionStorageMessage.textContent = '';
  renderNutritionEntries();
  return true;
}

function renderNutritionEntries() {
  const box = $('nutrition-entries');
  box.replaceChildren();
  if (!nutritionStorageOK) return;

  const selectedEntries = nutritionEntries.filter(entry => entry.date === $('date').value);
  if (selectedEntries.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'Brak produktów w wybranym dniu.';
    box.append(empty);
  }
  for (const entry of selectedEntries) {
    const article = document.createElement('article');
    article.className = 'entry';
    const meal = document.createElement('small');
    meal.textContent = MEAL_LABELS[entry.meal];
    const product = document.createElement('p');
    product.textContent = `${entry.productName} · ${portionFormatter.format(entry.amount)} ${entry.unit}`;
    const values = document.createElement('p');
    values.textContent = `${portionFormatter.format(entry.nutrition.kcal)} kcal · Białko: ${portionFormatter.format(entry.nutrition.protein)} g · Tłuszcz: ${portionFormatter.format(entry.nutrition.fat)} g · Węglowodany: ${portionFormatter.format(entry.nutrition.carbs)} g`;
    article.append(meal, product, values);
    box.append(article);
  }
}

function createEntryId() {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }
  if (typeof cryptoApi?.getRandomValues !== 'function') {
    throw new Error('Ta przeglądarka nie obsługuje bezpiecznego tworzenia identyfikatorów. Spróbuj w aktualnej przeglądarce.');
  }

  const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
  // Ustawienie wersji 4 i wariantu UUID, tak jak w randomUUID().
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function addNutritionEntry() {
  if (!nutritionStorageOK) return;
  try {
    const { product, amount, nutrition } = readPortionInput();
    const date = $('date').value;
    const meal = nutritionMealSelect.value;
    if (!isValidDiaryDate(date)) throw new Error('Wybierz datę dziennika.');
    if (!Object.hasOwn(MEAL_LABELS, meal)) throw new Error('Wybierz posiłek.');

    const entry = {
      id: createEntryId(),
      date,
      createdAt: new Date().toISOString(),
      meal,
      productId: product.id,
      productName: product.name,
      amount,
      unit: product.unit,
      nutrition,
    };
    if (persistNutritionEntries(entry)) {
      amountInput.value = '';
      updatePortionPreview();
      calculatorMessage.textContent = 'Dodano produkt do dziennika.';
    }
  } catch (error) {
    updatePortionPreview();
    calculatorMessage.textContent = error.message;
  }
}

productSelect.addEventListener('change', updatePortionPreview);
amountInput.addEventListener('input', updatePortionPreview);
addNutritionButton.addEventListener('click', addNutritionEntry);
$('date').addEventListener('change', renderNutritionEntries);
window.addEventListener('storage', event => {
  if (event.storageArea === localStorage
      && (event.key === nutritionStorageKey || event.key === null)) {
    loadNutritionEntries();
    renderNutritionEntries();
  }
});
updatePortionPreview();

const key='benger.meals.v1';let entries=[];let storageOK=true;
try{const saved=JSON.parse(localStorage.getItem(key)||'[]');if(!Array.isArray(saved))throw Error();entries=saved.filter(x=>x&&typeof x.text==='string'&&typeof x.date==='string'&&typeof x.id==='string'&&typeof x.meal==='string');}catch{storageOK=false;$('status').textContent='Nie udało się odczytać dziennika';$('hint').textContent='Zapis jest zablokowany, aby chronić wcześniejsze dane. Sprawdź ustawienia pamięci przeglądarki.';$('save').disabled=true;}
const now=new Date();$('date').value=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
function persist(next){try{localStorage.setItem(key,JSON.stringify(next));entries=next;render();return true;}catch{$('status').textContent='Brak miejsca lub dostępu do pamięci';return false;}}
function render(){const box=$('entries');box.replaceChildren();const list=entries.filter(x=>x.date===$('date').value);if(!list.length){const p=document.createElement('p');p.className='empty';p.textContent='Jeszcze pusto. Pierwszy posiłek? Opowiedz o nim ↑';box.append(p);}for(const entry of list){const article=document.createElement('article');article.className='entry';const small=document.createElement('small');small.textContent=entry.meal;const p=document.createElement('p');p.textContent=entry.text;const del=document.createElement('button');del.textContent='Usuń wpis';del.addEventListener('click',()=>{if(confirm('Usunąć ten posiłek?'))persist(entries.filter(x=>x.id!==entry.id));});article.append(small,p,del);box.append(article);}}
$('date').addEventListener('change',render);
$('save').addEventListener('click',()=>{const text=$('words').value.trim();if(!text){$('status').textContent='Najpierw powiedz lub wpisz posiłek';return;}if(!$('date').value){$('status').textContent='Wybierz datę';return;}if(storageOK&&persist([...entries,{id:crypto.randomUUID(),text,date:$('date').value,meal:$('meal').value}])){$('words').value='';$('status').textContent='Posiłek zapisany ✓';}});
$('export').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(entries,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='benger-dziennik.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
const Speech=window.SpeechRecognition||window.webkitSpeechRecognition;let listening=false;
if(Speech&&window.isSecureContext){const recognition=new Speech();recognition.lang='pl-PL';recognition.interimResults=true;let base='';recognition.onstart=()=>{listening=true;$('mic').classList.add('active');$('mic').setAttribute('aria-label','Zatrzymaj dyktowanie');$('status').textContent='Słucham… dotknij, aby zakończyć';};recognition.onresult=e=>{let transcript='';for(let i=0;i<e.results.length;i++)transcript+=e.results[i][0].transcript+' ';$('words').value=(base+' '+transcript).trim();};recognition.onend=()=>{listening=false;$('mic').classList.remove('active');$('mic').setAttribute('aria-label','Rozpocznij dyktowanie');if($('status').textContent.startsWith('Słucham'))$('status').textContent='Sprawdź notatkę i zapisz posiłek';};recognition.onerror=e=>{$('status').textContent=e.error==='not-allowed'?'Zezwól na dostęp do mikrofonu':'Dyktowanie przerwane — możesz wpisać notatkę';};$('mic').onclick=()=>{if(listening){recognition.stop();return;}base=$('words').value;try{recognition.start();}catch{$('status').textContent='Poczekaj na zakończenie dyktowania';}};}else{$('mic').disabled=true;$('status').textContent='Dyktowanie przeglądarki jest niedostępne';$('hint').textContent='Użyj mikrofonu na klawiaturze telefonu albo wpisz notatkę.';}
render();
loadNutritionEntries();
renderNutritionEntries();
