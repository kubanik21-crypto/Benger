import { HOUSEHOLD_UNITS, householdUnitLabel, humanPortionDescription } from './portion-model.js?v=3237a7e4b07e427a84a0c5ceb0b38ee3e5cee08f';
import { itemPortionResolution } from './meal-resolution.js?v=3237a7e4b07e427a84a0c5ceb0b38ee3e5cee08f';
import { productSourceLabel } from './product-model.js?v=3237a7e4b07e427a84a0c5ceb0b38ee3e5cee08f';
const number = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 2 });
import { MEAL_LABELS } from './meal-understanding.js?v=3237a7e4b07e427a84a0c5ceb0b38ee3e5cee08f';

export function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}
export function readProposalFields(card) {
  const raw = card.querySelector('[data-amount]').value.trim();
  const amount = /^\d+(?:[.,]\d+)?$/.test(raw) ? Number(raw.replace(',', '.')) : null;
  return { amount: Number.isFinite(amount) && amount > 0 ? amount : null,
    unit: card.querySelector('[data-unit]').value || null, meal: card.querySelector('[data-meal]').value };
}
export function updateProposalCard(card, item, message = '') {
  const product = item.resolution.product;
  const conversion=itemPortionResolution(item);
  const approximation = card.querySelector('[data-approximation]');
  if (approximation) approximation.textContent = `ok. ${item.intent.amount ?? '…'} ${householdUnitLabel(item.intent.unit,item.intent.amount)} — ilość przybliżona.`;
  card.querySelector('h4').textContent = product?.name ?? (item.intent.query || 'Produkt bez nazwy');
  card.querySelector('[data-provenance]').textContent = product
    ? [product.brand, productSourceLabel(product)].filter(Boolean).join(' · ') : '';
  for (const option of card.querySelector('[data-unit]').options) option.disabled = Boolean(option.value && product && ['g','ml'].includes(option.value) && option.value !== product.unit);
  const ready = Boolean(item.portion && Object.hasOwn(MEAL_LABELS, item.intent.meal));
  card.dataset.ready = String(ready);
  const status = card.querySelector('[data-status]');
  status.textContent = message || (ready ? '✓ Rozpoznano — sprawdź przed dodaniem.'
    : !product ? item.resolution.alternatives.length ? '? Sprawdź — wybierz właściwy produkt.' : '! Nie znaleziono — wyszukaj produkt.'
      : !Object.hasOwn(MEAL_LABELS, item.intent.meal) ? '! Wybierz posiłek.'
        : !item.intent.amount ? '! Podaj ilość. Nie zgadujemy porcji.' : `! ${conversion.description}`);
  card.querySelector('[data-values]').textContent = item.portion
    ? `${number.format(item.portion.nutrition.kcal)} kcal · Białko: ${number.format(item.portion.nutrition.protein)} g · Tłuszcz: ${number.format(item.portion.nutrition.fat)} g · Węglowodany: ${number.format(item.portion.nutrition.carbs)} g` : 'Wartości pojawią się po uzupełnieniu produktu i porcji.';
  const detail=card.querySelector('[data-portion-detail]');
  if(detail){const c=itemPortionResolution(item);detail.textContent=item.portion?.displayPortion?`${item.portion.displayPortion.label} · ${c.estimated?'ok. ':''}${number.format(item.portion.amount)} ${product.unit} · ${c.estimated?'typowa wartość':c.source+': '+humanPortionDescription(c.description)}`:Object.hasOwn(HOUSEHOLD_UNITS,item.intent.unit)?c.description:'';}
  const controls=card.querySelector('[data-portion-controls]');
  if(controls&&card.portionHandlers)renderPortionControls(controls,item,card.portionHandlers);
  const amount = card.querySelector('[data-amount]');
  amount.setAttribute('aria-invalid', String(!item.intent.amount));
}
export function renderProposalChoices(card, products, onChoose) {
  const choices = card.querySelector('[data-choices]'); choices.replaceChildren();
  for (const product of products.slice(0, 5)) {
    const button = node('button', 'proposal-choice button-secondary');
    button.type = 'button'; button.dataset.choiceId = product.id;
    button.append(node('strong', '', product.name), node('span', 'field-help', `${product.brand ?? 'Bez marki'} · ${number.format(product.per100.kcal)} kcal / 100 ${product.unit}`));
    button.setAttribute('aria-label', `Wybierz ${product.name}${product.brand ? `, ${product.brand}` : ''}`);
    button.addEventListener('click', () => onChoose(product.id));
    choices.append(button);
  }
}
export function createProposalCard(item, { onInput, onQuery, onSearch, onChoose, onPortion }) {
  const card = node('article', 'food-entry proposal-card'); card.dataset.itemId = item.id;
  const title = node('h4', '', item.resolution.product?.name ?? (item.intent.query || 'Produkt bez nazwy'));
  card.append(title);
  const provenance = node('p', 'field-help'); provenance.dataset.provenance = ''; card.append(provenance);
  if (item.intent.amountApproximate) {
    const approximation = node('p', 'field-help'); approximation.dataset.approximation = ''; card.append(approximation);
  }
  const status = node('p', 'proposal-row-status'); status.dataset.status = ''; status.id = `${item.id}-status`; status.setAttribute('role', 'status');
  const fields = node('div', 'proposal-fields');
  for (const [key, label] of [['amount', 'Ilość'], ['unit', 'Jednostka'], ['meal', 'Posiłek']]) {
    const box = node('div'); const id = `${item.id}-${key}`;
    const caption = node('label', '', label); caption.htmlFor = id;
    const input = node(key === 'amount' ? 'input' : 'select'); input.id = id; input.dataset[key] = '';
    input.setAttribute('aria-describedby', status.id);
    if (key === 'amount') { input.type = 'text'; input.inputMode = 'decimal'; input.autocomplete = 'off'; input.maxLength = 32; input.value = item.intent.amount ?? ''; }
    else {
      const options = key === 'meal' ? MEAL_LABELS : { '': 'Wybierz', g: 'g', ml: 'ml', ...HOUSEHOLD_UNITS };
      for (const [value, label] of Object.entries(options)) {
        const option = node('option', '', label); option.value = value;
        if (key === 'unit' && value && item.resolution.product && ['g','ml'].includes(value) && value !== item.resolution.product.unit) option.disabled = true;
        input.append(option);
      }
      input.value = item.intent[key] ?? (key === 'unit' && !item.intent.amount ? item.resolution.product?.unit ?? '' : '');
    }
    input.addEventListener(key === 'amount' ? 'input' : 'change', () => onInput(readProposalFields(card)));
    box.append(caption, input); fields.append(box);
  }
  const values = node('p', 'entry-nutrition'); values.dataset.values = '';
  const edit = node('details', 'proposal-product-edit');
  edit.open = !item.resolution.product;
  edit.append(node('summary', '', 'Zmień lub wyszukaj produkt'));
  const searchLabel = node('label', '', 'Nazwa produktu / marka'); searchLabel.htmlFor = `${item.id}-query`;
  const query = node('input'); query.id = searchLabel.htmlFor; query.type = 'search'; query.maxLength = 120; query.value = item.intent.query; query.dataset.query = '';
  query.addEventListener('input', () => onQuery(query.value));
  const search = node('button', 'button-secondary', 'Szukaj produktu'); search.type = 'button'; search.dataset.search = '';
  search.addEventListener('click', () => onSearch(query.value));
  query.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); onSearch(query.value); } });
  const choices = node('div', 'proposal-choices'); choices.dataset.choices = '';
  edit.append(searchLabel, query, search, choices);
  const detail=node('p','field-help');detail.dataset.portionDetail='';detail.setAttribute('aria-live','polite');
  const controls=node('div','portion-controls');controls.dataset.portionControls='';card.portionHandlers={onPortion};
  card.append(status, fields, detail, controls, values, edit);
  renderProposalChoices(card, item.resolution.alternatives, onChoose);
  updateProposalCard(card, item);
  return card;
}

function renderPortionControls(container,item,{onPortion}) {
 container.replaceChildren();
 const product=item.resolution.product,unit=item.intent.unit;
 if(!product||!Object.hasOwn(HOUSEHOLD_UNITS,unit))return;
 const conversion=itemPortionResolution(item);
 const offer=(definition,title)=>{
  const row=node('div','portion-choice');row.append(node('span','',title));
  for(const [caption,remember]of [['Użyj raz',false],['Zapamiętaj dla tego produktu',true]]){
   const button=node('button','button-secondary',caption);button.type='button';button.addEventListener('click',()=>void onPortion({...definition,source:remember?'USER':definition.source},remember));row.append(button);
  }container.append(row);
 };
 if(conversion.alternatives.length)for(const def of conversion.alternatives)offer(def,`${humanPortionDescription(def.description)} — ${number.format(def.normalizedAmount/def.amount)} ${def.normalizedUnit} / ${HOUSEHOLD_UNITS[unit]}`);
 const custom=node('details');custom.open=!item.portion&&!conversion.alternatives.length;
 custom.append(node('summary','',conversion.estimated?'Ustaw własną porcję':item.portion?'Zmień definicję porcji':'Uzupełnij masę / objętość porcji'));
 const label=node('label','',`Ile ${product.unit==='g'?'waży':'ma ml'} 1 ${HOUSEHOLD_UNITS[unit]} tego produktu? (${product.unit})`);
 const input=node('input');input.id=`${item.id}-portion-weight`;input.type='text';input.inputMode='decimal';input.maxLength=12;input.dataset.portionWeight='';label.htmlFor=input.id;
 const message=node('p','field-help');message.setAttribute('role','status');
 custom.append(label,input,message);
 for(const [caption,remember]of [['Użyj raz',false],['Zapamiętaj dla tego produktu',true]]){
  const button=node('button','button-secondary',caption);button.type='button';button.dataset.portionRemember=String(remember);
  button.addEventListener('click',()=>{const raw=input.value.trim(),value=/^\d+(?:[.,]\d+)?$/.test(raw)?Number(raw.replace(',','.')):NaN;
   if(!Number.isFinite(value)||value<=0||value>100000){message.textContent='Podaj dodatnią wartość do 100 000.';input.setAttribute('aria-invalid','true');input.focus();return;}
   void onPortion({id:`${product.id}:user:${unit}`,productId:product.id,unit,amount:1,normalizedAmount:value,normalizedUnit:product.unit,source:'USER',description:`Twoja definicja: 1 ${HOUSEHOLD_UNITS[unit]} = ${value} ${product.unit}`},remember);
  });custom.append(button);
 }container.append(custom);
}
