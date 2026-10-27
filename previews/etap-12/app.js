import {initTraining} from './training-ui.js?v=80440391adf8148377d397099e9cdc89eb24d8fb';
import {initDashboard} from './dashboard-ui.js?v=80440391adf8148377d397099e9cdc89eb24d8fb';
import {initProgress} from './progress-ui.js?v=80440391adf8148377d397099e9cdc89eb24d8fb';
import { validDiaryEntry,copyDiaryEntry } from './diary-entry.js?v=80440391adf8148377d397099e9cdc89eb24d8fb';
import {createRecipeRepository} from './recipe-repository.js?v=80440391adf8148377d397099e9cdc89eb24d8fb';
import {initRecipeDiary} from './recipe-diary-ui.js?v=80440391adf8148377d397099e9cdc89eb24d8fb';
import {storageErrorMessage,initStorageHealth} from './storage-health.js?v=80440391adf8148377d397099e9cdc89eb24d8fb';
import { initNavigation, navigate } from './navigation.js?v=80440391adf8148377d397099e9cdc89eb24d8fb';
import { initRecipes } from './recipe-ui.js?v=80440391adf8148377d397099e9cdc89eb24d8fb';
import { renderDiaryHistory } from './diary-history.js?v=80440391adf8148377d397099e9cdc89eb24d8fb';
import { validPortionSnapshot, copyPortionSnapshot } from './portion-model.js?v=80440391adf8148377d397099e9cdc89eb24d8fb';
import { initPortionSettings } from './portion-settings-ui.js?v=80440391adf8148377d397099e9cdc89eb24d8fb';
import { recoverPendingImport } from './backup.js?v=80440391adf8148377d397099e9cdc89eb24d8fb';
import { initBackupUi } from './backup-ui.js?v=80440391adf8148377d397099e9cdc89eb24d8fb';
import { initPwa } from './pwa.js?v=80440391adf8148377d397099e9cdc89eb24d8fb';
import { calculatePortion, sumNutrition } from './nutrition.js?v=80440391adf8148377d397099e9cdc89eb24d8fb';
import { MEAL_LABELS } from './meal-understanding.js?v=80440391adf8148377d397099e9cdc89eb24d8fb';
import { initVoiceEntry } from './voice-entry.js?v=80440391adf8148377d397099e9cdc89eb24d8fb';
import { createProductRepository } from './product-repository.js?v=80440391adf8148377d397099e9cdc89eb24d8fb';
import { initProductSearch } from './product-search-ui.js?v=80440391adf8148377d397099e9cdc89eb24d8fb';
import { NUTRITION_STORAGE_KEY } from './app-storage.js?v=80440391adf8148377d397099e9cdc89eb24d8fb';

initNavigation();
await recoverPendingImport();
const progressUI=initProgress();
const dashboardUI=initDashboard();
const trainingUI=initTraining();

const $ = id => document.getElementById(id);
const NUTRIENT_LABELS = { kcal: 'Energia', protein: 'Białko', fat: 'Tłuszcz', carbs: 'Węglowodany' };
const nutritionStorageKey = NUTRITION_STORAGE_KEY;
const formatter = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 2 });
const amountFormatter = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 20 });
const dateInput = $('date');
let selectedProduct = null;
const amountInput = $('amount');
const mealSelect = $('nutrition-meal');
const addButton = $('add-nutrition');
let nutritionEntries = [];
let nutritionStorageOK = true;
let voiceEntry;
const diarySideEffects=new Set();
function sideEffect(promise){diarySideEffects.add(promise);void promise.finally(()=>diarySideEffects.delete(promise));}

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
    if (focus) {navigate(['date','nutrition-meal'].includes(error.fieldId)?'dziennik':'produkty');$(error.fieldId).focus();}
  } else {
    $('calculator-message').textContent = error.message;
  }
}

function readPortionInput() {
  const product = selectedProduct;
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
  $('amount-unit').textContent = selectedProduct?.unit ?? '';
  try {
    const { nutrition } = readPortionInput();
    writeNutritionFields('portion', nutrition);
    $('portion-preview').hidden = false;
  } catch (error) {
    if (amountInput.value.trim() !== '' || showEmptyError) showError(error);
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

const isValidNutritionEntry=validDiaryEntry;

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
  } catch (failure) {
    renderNutritionEntries();
    $('nutrition-storage-message').textContent = storageErrorMessage(failure);
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
  name.textContent = (entry.recipeName??entry.productName);
  const amount = document.createElement('p');
  amount.className = 'entry-amount';
  amount.textContent = `${entry.displayPortion?.label ? entry.displayPortion.label+' · ' : ''}${entry.portionConversion?.estimated?'ok. ':''}${amountFormatter.format(entry.amount)} ${entry.unit==='serving'?'porcji':entry.unit}${entry.portionConversion?.estimated?' · typowa wartość':''}`;
  const values = document.createElement('p');
  values.className = 'entry-nutrition';
  values.textContent = `${formatter.format(entry.nutrition.kcal)} kcal · Białko: ${formatter.format(entry.nutrition.protein)} g · Tłuszcz: ${formatter.format(entry.nutrition.fat)} g · Węglowodany: ${formatter.format(entry.nutrition.carbs)} g`;
  article.append(name, amount, values);
  if (entry.kind==='RECIPE'||entry.brand || entry.source) {
    const provenance = document.createElement('p');
    provenance.className = 'entry-source';
    provenance.textContent = entry.kind==='RECIPE'?`Twój przepis · v${entry.recipeVersion}`:[entry.brand, entry.source === 'openfoodfacts' ? 'Open Food Facts' : entry.source === 'benger' ? 'Archiwalny produkt' : entry.source].filter(Boolean).join(' · ');
    article.append(provenance);
  }
  return article;
}

function createNutritionArticle(entry) {
  const article = createPortionArticle(entry);
  article.dataset.entryId = entry.id;
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'button-secondary remove-entry';
  remove.textContent = 'Usuń';
  remove.setAttribute('aria-label', `Usuń ${(entry.recipeName??entry.productName)}, ${amountFormatter.format(entry.amount)} ${entry.unit}, ${MEAL_LABELS[entry.meal]}`);
  remove.addEventListener('click', () => removeNutritionEntry(entry.id));
  article.append(remove);
  return article;
}

function renderNutritionEntries() {
  window.dispatchEvent(new Event('benger:diary'));
  renderDiaryHistory(nutritionStorageOK?nutritionEntries:[],date=>{dateInput.value=date;dateInput.dispatchEvent(new Event('change'));navigate('dziennik');});
  if($('manual-date'))$('manual-date').textContent=`Dzień zapisu: ${dateInput.value}`;
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
  if (!portions.length || portions.some(portion => !Object.hasOwn(MEAL_LABELS, portion.meal ?? meal))) throw fieldError('Wybierz posiłek.', 'nutrition-meal');
  const createdAt = new Date().toISOString();
  // Cały zestaw przygotowujemy przed zapisem. Jeden błąd oznacza brak zapisu.
  const entries = portions.map(portion=>{if(portion.kind==='RECIPE')return copyDiaryEntry({...portion,sourceType:'recipe',id:createEntryId(),date,createdAt,meal:portion.meal??meal});const { product, amount, nutrition, meal: rowMeal, displayPortion, portionConversion }=portion;return ({
    id: createEntryId(), date, createdAt, meal: rowMeal ?? meal,
    productId: product.id, productName: product.name, brand: product.brand, source: product.source,
    sourceId: product.sourceId, barcode: product.barcode, amount, unit: product.unit,
    nutrition: { ...nutrition },
    ...copyPortionSnapshot({displayPortion,portionConversion,productId:product.id,amount,unit:product.unit}),
  });});
  if (!entries.every(isValidNutritionEntry) || new Set(entries.map(entry => entry.id)).size !== entries.length) throw new Error('Nie można przygotować poprawnych wpisów. Żadna pozycja nie została zapisana.');
  const saved = updateNutritionEntries(current => {
    if (entries.some(entry => current.some(previous => previous.id === entry.id))) throw new Error('Identyfikator wpisu już istnieje. Spróbuj ponownie.');
    return [...current, ...entries];
  });
  // Awaria cache nie cofa poprawnego zapisu dziennika ani nie powoduje ponownego dodania.
  if (saved) sideEffect(productSearch.recordUsed(portions.filter(p=>p.kind!=='RECIPE').map(portion => portion.product)).catch(() => {
    $('catalog-storage-message').textContent = 'Wpis zapisany. Nie udało się zaktualizować ostatnich produktów.';
  }));
  const recipeIds=portions.filter(p=>p.kind==='RECIPE').map(p=>p.recipeId);
  if(saved&&recipeIds.length)sideEffect(recipeRepository.recordUsed(recipeIds).catch(()=>{$('diary-message').textContent='Wpis zapisany. Nie udało się zaktualizować ostatnich przepisów.';}));
  return saved;
}

function addNutritionEntry(event) {
  event.preventDefault();
  if (!nutritionStorageOK) return;
  $('calculator-message').textContent = '';
  clearFieldError('date');
  $('manual-meal').value=mealSelect.value;
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
  voiceEntry?.setStorageAvailable(nutritionStorageOK);
}

function removeNutritionEntry(id) {
  const entry = nutritionEntries.find(item => item.id === id);
  if (updateNutritionEntries(current => current.filter(item => item.id !== id))) {
    $('diary-message').textContent = `Usunięto: ${entry?.recipeName ?? entry?.productName ?? 'produkt'}.`;
    const nextButton = $('nutrition-entries').querySelector('button');
    (nextButton ?? $('nutrition-title')).focus();
  }
}

const now = new Date();
dateInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
populateSelect(mealSelect, Object.entries(MEAL_LABELS));
populateSelect($('manual-meal'),Object.entries(MEAL_LABELS));
$('manual-meal').onchange=()=>{mealSelect.value=$('manual-meal').value;mealSelect.dispatchEvent(new Event('change'));};
$('recipe-add-selected').onclick=async()=>{try{const portion=readPortionInput();await recipesUI.addSelected(portion);$('recipe-selected-status').textContent='Dodano składnik do szkicu.';}catch(error){$('recipe-selected-status').textContent=error.message;}};
$('scan-shortcut').onclick=()=>$('scan-barcode').click();
window.addEventListener('benger:route',event=>{if(event.detail.route!=='produkty'&&$('scanner-dialog').open)$('cancel-scanner').click();});
const productRepository = createProductRepository();
const recipeRepository=createRecipeRepository();
const recipeDiary=initRecipeDiary({recipes:recipeRepository,readDate:readDiaryDate,getMeal:()=>mealSelect.value,onSave:(portions,date)=>appendNutritionPortions(portions,null,date)});
const recipesUI=initRecipes({repository:productRepository,recipes:recipeRepository,onAddToDiary:recipeDiary.open});
initStorageHealth();
initPortionSettings(productRepository);
const productSearch = initProductSearch({ repository: productRepository, onSelect(product) {
  selectedProduct = product;
  updatePortionPreview();
} });
voiceEntry = initVoiceEntry({ repository: productRepository, readDate: readDiaryDate, getMeal: () => mealSelect.value,
  onSave: (portions, date) => appendNutritionPortions(portions, null, date), onDateError: error => showError(error, true),recipes:recipeRepository });
amountInput.addEventListener('input', () => updatePortionPreview());
mealSelect.addEventListener('change', () => {
  $('manual-meal').value=mealSelect.value;
  clearFieldError('nutrition-meal');
  voiceEntry.invalidateContext();
});
$('nutrition-form').addEventListener('submit', addNutritionEntry);
dateInput.addEventListener('change', () => {
  voiceEntry.invalidateContext();
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
void productSearch.seedRecent(nutritionEntries).catch(() => {});

void initPwa();

initBackupUi({beforeRead:async()=>{await trainingUI.flush();await dashboardUI.flush();await progressUI.flush();await recipesUI.flush();await voiceEntry.flush();await Promise.all([...diarySideEffects]);}});
