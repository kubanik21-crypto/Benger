const number = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 2 });
import { MEAL_LABELS } from './meal-understanding.js';

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
  card.querySelector('h4').textContent = product?.name ?? (item.intent.query || 'Produkt bez nazwy');
  card.querySelector('[data-provenance]').textContent = product
    ? [product.brand, product.source === 'openfoodfacts' ? 'Open Food Facts' : 'Benger · przykład'].filter(Boolean).join(' · ') : '';
  for (const option of card.querySelector('[data-unit]').options) option.disabled = Boolean(option.value && product && option.value !== product.unit);
  const ready = Boolean(item.portion && Object.hasOwn(MEAL_LABELS, item.intent.meal));
  card.dataset.ready = String(ready);
  const status = card.querySelector('[data-status]');
  status.textContent = message || (ready ? '✓ Rozpoznano — sprawdź przed dodaniem.'
    : !product ? item.resolution.alternatives.length ? '? Sprawdź — wybierz właściwy produkt.' : '! Nie znaleziono — wyszukaj produkt.'
      : !Object.hasOwn(MEAL_LABELS, item.intent.meal) ? '! Wybierz posiłek.'
        : !item.intent.amount ? '! Podaj ilość. Nie zgadujemy porcji.' : '! Sprawdź jednostkę i ilość. Nie przeliczamy gęstości.');
  card.querySelector('[data-values]').textContent = item.portion
    ? `${number.format(item.portion.nutrition.kcal)} kcal · Białko: ${number.format(item.portion.nutrition.protein)} g · Tłuszcz: ${number.format(item.portion.nutrition.fat)} g · Węglowodany: ${number.format(item.portion.nutrition.carbs)} g` : 'Wartości pojawią się po uzupełnieniu produktu i porcji.';
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
export function createProposalCard(item, { onInput, onQuery, onSearch, onChoose }) {
  const card = node('article', 'food-entry proposal-card'); card.dataset.itemId = item.id;
  const title = node('h4', '', item.resolution.product?.name ?? (item.intent.query || 'Produkt bez nazwy'));
  card.append(title);
  const provenance = node('p', 'field-help'); provenance.dataset.provenance = ''; card.append(provenance);
  if (item.intent.amountApproximate) card.append(node('p', 'field-help', `ok. ${item.intent.amount ?? '…'} ${item.intent.unit ?? ''} — ilość przybliżona.`));
  const status = node('p', 'proposal-row-status'); status.dataset.status = ''; status.id = `${item.id}-status`; status.setAttribute('role', 'status');
  const fields = node('div', 'proposal-fields');
  for (const [key, label] of [['amount', 'Ilość'], ['unit', 'Jednostka'], ['meal', 'Posiłek']]) {
    const box = node('div'); const id = `${item.id}-${key}`;
    const caption = node('label', '', label); caption.htmlFor = id;
    const input = node(key === 'amount' ? 'input' : 'select'); input.id = id; input.dataset[key] = '';
    input.setAttribute('aria-describedby', status.id);
    if (key === 'amount') { input.type = 'text'; input.inputMode = 'decimal'; input.autocomplete = 'off'; input.maxLength = 32; input.value = item.intent.amount ?? ''; }
    else {
      const options = key === 'meal' ? MEAL_LABELS : { '': 'Wybierz', g: 'g', ml: 'ml' };
      for (const [value, label] of Object.entries(options)) {
        const option = node('option', '', label); option.value = value;
        if (key === 'unit' && value && item.resolution.product && value !== item.resolution.product.unit) option.disabled = true;
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
  card.append(status, fields, values, edit);
  renderProposalChoices(card, item.resolution.alternatives, onChoose);
  updateProposalCard(card, item);
  return card;
}
