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

for (const product of PRODUCTS) {
  const option = document.createElement('option');
  option.value = product.id;
  option.textContent = product.name;
  productSelect.append(option);
}

function updatePortionPreview() {
  const product = PRODUCTS.find(item => item.id === productSelect.value);
  $('amount-unit').textContent = product.unit;
  portionPreview.hidden = true;
  for (const field of Object.values(portionFields)) {
    field.textContent = '';
  }
  amountInput.setAttribute('aria-invalid', 'false');

  const rawAmount = amountInput.value.trim();
  if (rawAmount === '') {
    calculatorMessage.textContent = 'Podaj ilość, aby zobaczyć wartości porcji.';
    return;
  }
  if (!/^-?\d+(?:[.,]\d+)?$/.test(rawAmount)) {
    calculatorMessage.textContent = 'Wpisz liczbę, np. 50 lub 50,5.';
    amountInput.setAttribute('aria-invalid', 'true');
    return;
  }

  try {
    const amount = Number(rawAmount.replace(',', '.'));
    const portion = calculatePortion(product, amount);
    for (const [nutrient, field] of Object.entries(portionFields)) {
      field.textContent = portionFormatter.format(portion[nutrient]);
    }
    calculatorMessage.textContent = '';
    portionPreview.hidden = false;
  } catch (error) {
    calculatorMessage.textContent = error.message;
    amountInput.setAttribute('aria-invalid', 'true');
  }
}

productSelect.addEventListener('change', updatePortionPreview);
amountInput.addEventListener('input', updatePortionPreview);
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
