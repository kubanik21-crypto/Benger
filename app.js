import { PRODUCTS, calculatePortion, sumNutrition } from './nutrition.js';
import { initLegacyNotes } from './legacy.js';
import { parseMealText } from './meal-parser.js';

const $ = id => document.getElementById(id);
const MEAL_LABELS = {
  breakfast: 'Śniadanie',
  lunch: 'Obiad',
  dinner: 'Kolacja',
  snack: 'Przekąska',
};
const NUTRIENT_LABELS = { kcal: 'Energia', protein: 'Białko', fat: 'Tłuszcz', carbs: 'Węglowodany' };
const nutritionStorageKey = 'benger.nutrition.v1';
const formatter = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 2 });
const amountFormatter = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 20 });
const dateInput = $('date');
const productSelect = $('product');
const amountInput = $('amount');
const mealSelect = $('nutrition-meal');
const addButton = $('add-nutrition');
const textInput = $('meal-text');
let nutritionEntries = [];
let nutritionStorageOK = true;
let mealProposal = null;

function populateSelect(select, choices) {
  for (const [value, label] of choices) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    select.append(option);
  }
}

function fieldError(message, fieldId) {
  const error = new Error(message);
  error.fieldId = fieldId;
  return error;
}

function clearFieldError(fieldId) {
  $(fieldId).setAttribute('aria-invalid', 'false');
  $(`${fieldId}-error`).textContent = '';
}

function showError(error, focus = false) {
  if (error.fieldId) {
    $(error.fieldId).setAttribute('aria-invalid', 'true');
    $(`${error.fieldId}-error`).textContent = error.message;
    if (focus) $(error.fieldId).focus();
  } else {
    $('calculator-message').textContent = error.message;
  }
}

function readPortionInput() {
  const product = PRODUCTS.find(item => item.id === productSelect.value);
  if (!product) throw fieldError('Wybierz produkt.', 'product');
  const rawAmount = amountInput.value.trim();
  if (rawAmount === '') throw fieldError('Podaj ilość produktu.', 'amount');
  if (!/^-?\d+(?:[.,]\d+)?$/.test(rawAmount)) {
    throw fieldError('Wpisz liczbę, np. 50 lub 50,5.', 'amount');
  }
  const amount = Number(rawAmount.replace(',', '.'));
  try {
    return { product, amount, nutrition: calculatePortion(product, amount) };
  } catch (error) {
    throw fieldError(error.message, 'amount');
  }
}

function writeNutritionFields(prefix, nutrition) {
  for (const nutrient of Object.keys(NUTRIENT_LABELS)) {
    $(`${prefix}-${nutrient}`).textContent = formatter.format(nutrition[nutrient]);
  }
}

function updatePortionPreview(showEmptyError = false) {
  $('portion-preview').hidden = true;
  for (const nutrient of Object.keys(NUTRIENT_LABELS)) $(`portion-${nutrient}`).textContent = '';
  clearFieldError('product');
  clearFieldError('amount');
  $('calculator-message').textContent = '';
  $('amount-unit').textContent = PRODUCTS.find(item => item.id === productSelect.value)?.unit ?? '';
  try {
    const { nutrition } = readPortionInput();
    writeNutritionFields('portion', nutrition);
    $('portion-preview').hidden = false;
  } catch (error) {
    if (amountInput.value.trim() !== '' || showEmptyError || error.fieldId === 'product') showError(error);
  }
}

function isValidDiaryDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function readDiaryDate() {
  if (!isValidDiaryDate(dateInput.value)) throw fieldError('Wybierz prawidłową datę dziennika.', 'date');
  return dateInput.value;
}

function isValidNutritionEntry(entry) {
  return entry !== null && typeof entry === 'object'
    && typeof entry.id === 'string' && entry.id.trim() !== ''
    && isValidDiaryDate(entry.date)
    && typeof entry.createdAt === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(entry.createdAt)
    && Number.isFinite(Date.parse(entry.createdAt))
    && typeof entry.meal === 'string' && Object.hasOwn(MEAL_LABELS, entry.meal)
    && typeof entry.productId === 'string' && entry.productId.trim() !== ''
    && typeof entry.productName === 'string' && entry.productName.trim() !== ''
    && Number.isFinite(entry.amount) && entry.amount > 0
    && ['g', 'ml'].includes(entry.unit)
    && entry.nutrition !== null && typeof entry.nutrition === 'object'
    && Object.keys(NUTRIENT_LABELS).every(nutrient =>
      Number.isFinite(entry.nutrition[nutrient]) && entry.nutrition[nutrient] >= 0);
}

function loadNutritionEntries() {
  try {
    const raw = localStorage.getItem(nutritionStorageKey);
    const saved = raw === null ? [] : JSON.parse(raw);
    if (!Array.isArray(saved) || !saved.every(isValidNutritionEntry)
        || new Set(saved.map(entry => entry.id)).size !== saved.length) {
      throw new Error('Nieprawidłowy format wpisów.');
    }
    nutritionEntries = saved;
    nutritionStorageOK = true;
    addButton.disabled = false;
    updateProposalButton();
    $('nutrition-storage-message').textContent = '';
    return true;
  } catch {
    nutritionStorageOK = false;
    addButton.disabled = true;
    updateProposalButton();
    $('nutrition-storage-message').textContent = 'Nie można odczytać dziennika. Zapis jest zablokowany, aby chronić dane. Nie zostały usunięte ani nadpisane. Sprawdź ustawienia pamięci przeglądarki. Notatki tekstowe są przechowywane oddzielnie.';
    return false;
  }
}

function updateNutritionEntries(change) {
  // Odczyt aktualnej listy jest potrzebny także przy usuwaniu z nieaktualnej karty.
  // localStorage nie zapewnia transakcji między kartami: równoczesny zapis może się ścigać.
  if (!loadNutritionEntries()) {
    renderNutritionEntries();
    return false;
  }
  const next = change(nutritionEntries);
  try {
    localStorage.setItem(nutritionStorageKey, JSON.stringify(next));
  } catch {
    renderNutritionEntries();
    $('nutrition-storage-message').textContent = 'Nie udało się zapisać zmiany. Sprawdź wolne miejsce i dostęp do pamięci przeglądarki. Możesz spróbować ponownie.';
    return false;
  }
  nutritionEntries = next;
  renderNutritionEntries();
  return true;
}

function renderDaySummary(selectedEntries) {
  $('summary-error').textContent = '';
  try {
    const total = sumNutrition(selectedEntries.map(entry => entry.nutrition));
    writeNutritionFields('total', total);
    $('day-summary').hidden = false;
  } catch {
    $('day-summary').hidden = true;
    $('summary-error').textContent = 'Wartości są zbyt duże, aby obliczyć podsumowanie. Sprawdź ilości i usuń nieprawidłowy wpis.';
  }
}

function createPortionArticle(entry) {
  const article = document.createElement('article');
  article.className = 'food-entry';
  const name = document.createElement('h4');
  name.textContent = entry.productName;
  const amount = document.createElement('p');
  amount.className = 'entry-amount';
  amount.textContent = `${amountFormatter.format(entry.amount)} ${entry.unit}`;
  const values = document.createElement('p');
  values.className = 'entry-nutrition';
  values.textContent = `${formatter.format(entry.nutrition.kcal)} kcal · Białko: ${formatter.format(entry.nutrition.protein)} g · Tłuszcz: ${formatter.format(entry.nutrition.fat)} g · Węglowodany: ${formatter.format(entry.nutrition.carbs)} g`;
  article.append(name, amount, values);
  return article;
}

function createNutritionArticle(entry) {
  const article = createPortionArticle(entry);
  article.dataset.entryId = entry.id;
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'button-secondary remove-entry';
  remove.textContent = 'Usuń';
  remove.setAttribute('aria-label', `Usuń ${entry.productName}, ${amountFormatter.format(entry.amount)} ${entry.unit}, ${MEAL_LABELS[entry.meal]}`);
  remove.addEventListener('click', () => removeNutritionEntry(entry.id));
  article.append(remove);
  return article;
}

function renderNutritionEntries() {
  const box = $('nutrition-entries');
  box.replaceChildren();
  $('day-summary').hidden = true;
  $('summary-error').textContent = '';
  if (!nutritionStorageOK) return;
  if (!isValidDiaryDate(dateInput.value)) {
    box.textContent = 'Wybierz datę, aby zobaczyć dziennik.';
    return;
  }
  const selectedEntries = nutritionEntries.filter(entry => entry.date === dateInput.value);
  renderDaySummary(selectedEntries);
  if (selectedEntries.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'Ten dzień czeka na pierwszy posiłek.';
    box.append(empty);
  }
  for (const [meal, label] of Object.entries(MEAL_LABELS)) {
    const items = selectedEntries.filter(entry => entry.meal === meal);
    if (items.length === 0) continue;
    const group = document.createElement('section');
    group.className = 'meal-group';
    group.dataset.meal = meal;
    const heading = document.createElement('h3');
    heading.textContent = `${label} (${items.length})`;
    group.append(heading, ...items.map(createNutritionArticle));
    box.append(group);
  }
}

function createEntryId() {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID();
  if (typeof cryptoApi?.getRandomValues !== 'function') {
    throw new Error('Ta przeglądarka nie obsługuje bezpiecznego tworzenia identyfikatorów. Spróbuj w aktualnej przeglądarce.');
  }
  const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function appendNutritionPortions(portions, meal, date) {
  if (!isValidDiaryDate(date)) throw fieldError('Wybierz prawidłową datę dziennika.', 'date');
  if (!Object.hasOwn(MEAL_LABELS, meal)) throw fieldError('Wybierz posiłek.', 'nutrition-meal');
  const createdAt = new Date().toISOString();
  // Cały zestaw przygotowujemy przed zapisem. Jeden błąd oznacza brak zapisu.
  const entries = portions.map(({ product, amount, nutrition }) => ({
    id: createEntryId(), date, createdAt, meal,
    productId: product.id, productName: product.name, amount, unit: product.unit,
    nutrition: { ...nutrition },
  }));
  return updateNutritionEntries(current => [...current, ...entries]);
}

function addNutritionEntry(event) {
  event.preventDefault();
  if (!nutritionStorageOK) return;
  $('calculator-message').textContent = '';
  clearFieldError('date');
  clearFieldError('nutrition-meal');
  try {
    const date = readDiaryDate();
    const meal = mealSelect.value;
    if (!Object.hasOwn(MEAL_LABELS, meal)) throw fieldError('Wybierz posiłek.', 'nutrition-meal');
    const { product, amount, nutrition } = readPortionInput();
    if (appendNutritionPortions([{ product, amount, nutrition }], meal, date)) {
      amountInput.value = '';
      updatePortionPreview();
      $('calculator-message').textContent = `Dodano: ${product.name}, ${amountFormatter.format(amount)} ${product.unit} — ${MEAL_LABELS[meal]}.`;
      amountInput.focus();
    }
  } catch (error) {
    updatePortionPreview(true);
    showError(error, true);
  }
}

function updateProposalButton() {
  $('save-meal-proposal').disabled = mealProposal === null || !nutritionStorageOK;
}

function resetMealProposal(message = '') {
  mealProposal = null;
  $('meal-proposal').hidden = true;
  $('meal-proposal-items').replaceChildren();
  $('meal-proposal-issues').replaceChildren();
  $('meal-proposal-summary').hidden = true;
  $('meal-text-status').textContent = message;
  updateProposalButton();
}

function invalidateMealProposal() {
  const hadProposal = !$('meal-proposal').hidden;
  resetMealProposal(hadProposal ? 'Dane zmienione. Kliknij „Analizuj posiłek” ponownie.' : '');
  clearFieldError('meal-text');
}

function createProblemArticle(source) {
  const article = document.createElement('article');
  article.className = 'proposal-problem';
  const heading = document.createElement('h4');
  heading.textContent = 'Wymaga poprawienia';
  const text = document.createElement('p');
  text.textContent = source;
  article.append(heading, text);
  return article;
}

function analyzeMealText(event) {
  event.preventDefault();
  resetMealProposal();
  clearFieldError('meal-text');
  clearFieldError('date');
  let date;
  try { date = readDiaryDate(); } catch (error) { showError(error, true); return; }
  const result = parseMealText(textInput.value, { defaultMeal: mealSelect.value });
  if (result.items.length === 0) {
    showError(fieldError(result.issues.map(issue => issue.message).join(' '), 'meal-text'), true);
    return;
  }
  const issues = [...result.issues];
  const portions = [];
  for (const [itemIndex, item] of result.items.entries()) {
    if (item.status === 'recognized') {
      const product = PRODUCTS.find(candidate => candidate.id === item.productId);
      try {
        const nutrition = calculatePortion(product, item.amount);
        // Kopiujemy metadane i wartości widoczne przy akceptacji, bez przeliczania przy zapisie.
        portions.push({ product: { id: product.id, name: product.name, unit: product.unit }, amount: item.amount, nutrition });
        $('meal-proposal-items').append(createPortionArticle({ productName: product.name, amount: item.amount, unit: product.unit, nutrition }));
        continue;
      } catch {
        issues.push({ itemIndex, message: 'Nie można obliczyć porcji. Sprawdź, czy ilość nie jest zbyt duża.' });
      }
    }
    $('meal-proposal-items').append(createProblemArticle(item.source));
  }
  if (issues.length === 0) {
    try {
      writeNutritionFields('proposal', sumNutrition(portions.map(portion => portion.nutrition)));
      $('meal-proposal-summary').hidden = false;
      mealProposal = { source: textInput.value, defaultMeal: mealSelect.value, date, meal: result.meal, portions };
    } catch {
      issues.push({ message: 'Suma propozycji jest zbyt duża. Zmniejsz ilości i ponów analizę.' });
    }
  }
  for (const issue of issues) {
    const li = document.createElement('li');
    li.textContent = `${issue.itemIndex === undefined ? '' : `Pozycja ${issue.itemIndex + 1}: `}${issue.message}`;
    $('meal-proposal-issues').append(li);
  }
  if (issues.length) {
    showError(fieldError('Nie można zapisać całej propozycji. Popraw wskazane problemy w tekście i ponów analizę.', 'meal-text'));
  } else {
    $('meal-text-status').textContent = `Rozpoznane pozycje: ${portions.length}. Sprawdź je przed zapisaniem. Analiza nie zapisuje danych.`;
  }
  $('meal-proposal-context').textContent = `Dzień: ${date} · Posiłek: ${MEAL_LABELS[result.meal] ?? 'wymaga doprecyzowania'}`;
  $('meal-proposal').hidden = false;
  updateProposalButton();
  $('meal-proposal-title').focus();
}

function saveMealProposal() {
  if (!mealProposal || !nutritionStorageOK) return;
  const proposal = mealProposal;
  // Chronimy przed zapisem starego podglądu także wtedy, gdy zmiana nie wysłała zdarzenia input/change.
  if (proposal.source !== textInput.value || proposal.date !== dateInput.value || proposal.defaultMeal !== mealSelect.value) {
    invalidateMealProposal();
    return;
  }
  clearFieldError('meal-text');
  try {
    if (appendNutritionPortions(proposal.portions, proposal.meal, proposal.date)) {
      textInput.value = '';
      resetMealProposal(`Dodano do dziennika. Liczba pozycji: ${proposal.portions.length}. ${MEAL_LABELS[proposal.meal]}, ${proposal.date}.`);
      textInput.focus();
    }
  } catch (error) {
    showError(error.fieldId ? error : fieldError(error.message, 'meal-text'), true);
  }
}

function removeNutritionEntry(id) {
  const entry = nutritionEntries.find(item => item.id === id);
  if (updateNutritionEntries(current => current.filter(item => item.id !== id))) {
    $('diary-message').textContent = `Usunięto: ${entry?.productName ?? 'produkt'}.`;
    const nextButton = $('nutrition-entries').querySelector('button');
    (nextButton ?? $('nutrition-title')).focus();
  }
}

const now = new Date();
dateInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
populateSelect(productSelect, PRODUCTS.map(product => [product.id, product.name]));
populateSelect(mealSelect, Object.entries(MEAL_LABELS));
productSelect.addEventListener('change', () => updatePortionPreview());
amountInput.addEventListener('input', () => updatePortionPreview());
mealSelect.addEventListener('change', () => {
  clearFieldError('nutrition-meal');
  invalidateMealProposal();
});
$('nutrition-form').addEventListener('submit', addNutritionEntry);
$('meal-text-form').addEventListener('submit', analyzeMealText);
textInput.addEventListener('input', invalidateMealProposal);
$('save-meal-proposal').addEventListener('click', saveMealProposal);
dateInput.addEventListener('change', () => {
  invalidateMealProposal();
  clearFieldError('date');
  $('diary-message').textContent = '';
  if (!isValidDiaryDate(dateInput.value)) showError(fieldError('Wybierz prawidłową datę dziennika.', 'date'));
  renderNutritionEntries();
});
window.addEventListener('storage', event => {
  if (event.storageArea === localStorage && (event.key === nutritionStorageKey || event.key === null)) {
    loadNutritionEntries();
    renderNutritionEntries();
  }
});
updatePortionPreview();
loadNutritionEntries();
renderNutritionEntries();
initLegacyNotes({ dateInput, createEntryId });
