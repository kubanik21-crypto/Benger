import { createSpeechRecognitionAdapter, SPEECH_MESSAGES } from './speech-recognition.js?v=604eb6266ad289ce68114ab3dc2993b2908f816f';
import { understandMeal, MEAL_LABELS } from './meal-understanding.js?v=604eb6266ad289ce68114ab3dc2993b2908f816f';
import { createProductResolver } from './product-resolver.js?v=604eb6266ad289ce68114ab3dc2993b2908f816f';
import { resolveMealIntents, editMealItem, updateMealItemPortion, summarizeMealProposal } from './meal-resolution.js?v=604eb6266ad289ce68114ab3dc2993b2908f816f';
import { createProposalCard, updateProposalCard, renderProposalChoices, readProposalFields, node } from './meal-proposal-ui.js?v=604eb6266ad289ce68114ab3dc2993b2908f816f';
import { productErrorMessage } from './product-errors.js?v=604eb6266ad289ce68114ab3dc2993b2908f816f';

const $ = id => document.getElementById(id);
const number = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 2 });
const unresolved = () => ({ product: null, confidence: 'LOW', alternatives: [], reason: 'changed-query', requiresConfirmation: true });

export function initVoiceEntry({ repository, readDate, getMeal, onSave, onDateError }) {
  const resolver = createProductResolver({ repository });
  const text = $('meal-text'), save = $('save-meal-proposal'), form = $('meal-text-form');
  let proposal = null, revision = 0, controller = null, storageAvailable = true, saving = false, summaryValid = false;
  const rowControllers = new Map(), rowVersions = new Map();
  const choiceWrites = new Map();
  let speechBusy = false;
  function error(message) {
    text.setAttribute('aria-invalid', 'true'); $('meal-text-error').textContent = message;
  }
  function clearError() { text.setAttribute('aria-invalid', 'false'); $('meal-text-error').textContent = ''; }
  function buttonState() {
    save.disabled = saving || speechBusy || !storageAvailable || !summaryValid || !proposal || Boolean(proposal.issues.length)
      || proposal.items.length === 0 || proposal.items.some(item => !item.portion || !Object.hasOwn(MEAL_LABELS, item.intent.meal));
  }
  function invalidate(message = '') {
    revision++; controller?.abort(); controller = null;
    for (const request of rowControllers.values()) request.abort();
    rowControllers.clear(); rowVersions.clear(); choiceWrites.clear(); proposal = null; summaryValid = false;
    $('meal-proposal').hidden = true; $('proposal-empty').hidden = false;
    $('meal-proposal-items').replaceChildren(); $('meal-proposal-issues').replaceChildren();
    $('meal-proposal-summary').hidden = true; $('meal-text-status').textContent = message;
    form.dataset.analysisState = 'idle'; $('analyze-meal').disabled = speechBusy;
    buttonState();
  }
  function summary() {
    if (!proposal) return;
    clearError();
    try {
      const totals = summarizeMealProposal(proposal);
      summaryValid = true;
      for (const key of ['kcal', 'protein', 'fat', 'carbs']) $(`proposal-${key}`).textContent = number.format(totals.nutrition[key]);
      $('meal-proposal-summary').hidden = false;
      const meals = [...new Set(proposal.items.map(item => item.intent.meal))];
      const mealLabel = meals.length === 1 ? MEAL_LABELS[meals[0]] ?? 'sprawdź w opisie' : 'Różne posiłki';
      $('meal-proposal-context').textContent = `Dzień: ${proposal.date} · Posiłek: ${mealLabel} · ${totals.resolved} z ${proposal.items.length} produktów rozpoznane`;
      $('proposal-summary-label').textContent = totals.unresolved ? 'SUMA ROZPOZNANYCH PRODUKTÓW' : 'SUMA CAŁEJ PROPOZYCJI';
      if (totals.unresolved || proposal.issues.length) error('Uzupełnij wskazane pozycje przed dodaniem całego posiłku. Pozostałe produkty zostały zachowane.');
      else $('meal-text-status').textContent = `Rozpoznane pozycje: ${totals.resolved}. Sprawdź produkty, ilości i posiłki. Analiza nie zapisuje danych.`;
    } catch { summaryValid = false; $('meal-proposal-summary').hidden = true; error('Wartości są zbyt duże. Zmniejsz ilości.'); buttonState(); return; }
    buttonState();
  }
  const findItem = id => proposal?.items.find(item => item.id === id);
  const findCard = id => [...$('meal-proposal-items').children].find(card => card.dataset.itemId === id);
  function replaceItem(id, item) { proposal = { ...proposal, items: proposal.items.map(row => row.id === id ? item : row) }; }
  function nextRowVersion(id) {
    rowControllers.get(id)?.abort(); rowControllers.delete(id);
    const button = findCard(id)?.querySelector('[data-search]'); if (button) button.disabled = false;
    const next = (rowVersions.get(id) ?? 0) + 1; rowVersions.set(id, next); return next;
  }
  function drawRow(item) {
    return createProposalCard(item, {
      onInput: patch => {
        if (!findItem(item.id)) return;
        nextRowVersion(item.id);
        const changed = updateMealItemPortion(findItem(item.id), patch); replaceItem(item.id, changed);
        updateProposalCard(findCard(item.id), changed); summary();
      },
      onQuery: query => {
        const row = findItem(item.id); if (!row) return;
        nextRowVersion(item.id);
        choiceWrites.delete(item.id);
        const changed = { ...row, intent: { ...row.intent, query }, resolution: unresolved(), portion: null, learned: false };
        replaceItem(item.id, changed); updateProposalCard(findCard(item.id), changed);
        renderProposalChoices(findCard(item.id), [], () => {}); summary();
      },
      onSearch: query => { void searchRow(item.id, query); },
      onChoose: productId => { void chooseRow(item.id, productId); },
    });
  }
  async function chooseRow(id, productId) {
    const current = findItem(id); if (!current) return;
    const version = revision, rowVersion = nextRowVersion(id);
    try {
      const product = await repository.getProductById(productId);
      if (!product) throw new Error('Produkt nie jest już dostępny w pamięci. Wyszukaj go ponownie.');
      const mismatch = current.intent.unit && current.intent.unit !== product.unit;
      const edited = await editMealItem({ items: [current] }, id, { productId, unit: product.unit, ...(mismatch ? { amount: null } : {}) }, { repository });
      if (revision !== version || rowVersions.get(id) !== rowVersion) return;
      const row = { ...edited.items[0], learned: false };
      // Rejestrujemy uczenie przed odblokowaniem zapisu, aby szybki klik nie policzył go dwa razy.
      const choiceWrite = resolver.rememberUserChoice(row.intent.query, productId).then(() => true, () => false);
      choiceWrites.set(id, { productId, query: row.intent.query, promise: choiceWrite });
      replaceItem(id, row);
      findCard(id).replaceWith(drawRow(row));
      if (mismatch) updateProposalCard(findCard(id), row, 'Jednostka produktu jest inna. Podaj ilość ponownie; nie przeliczamy gęstości.');
      summary(); findCard(id).querySelector('[data-amount]').focus();
      const learned = await choiceWrite;
      if (revision === version && rowVersions.get(id) === rowVersion) {
        if (learned) replaceItem(id, { ...findItem(id), learned: true });
        else $('meal-text-status').textContent = 'Produkt wybrany. Nie udało się zapamiętać dopasowania; możesz nadal zapisać posiłek.';
      }
    } catch (failure) { if (revision === version && rowVersions.get(id) === rowVersion && findCard(id)) updateProposalCard(findCard(id), findItem(id), failure.message); }
  }
  async function searchRow(id, query) {
    const current = findItem(id); if (!current || rowControllers.has(id)) return;
    const version = revision, rowVersion = nextRowVersion(id), request = new AbortController(); rowControllers.set(id, request);
    const card = findCard(id), button = card.querySelector('[data-search]'); button.disabled = true;
    const changed = { ...current, intent: { ...current.intent, query }, resolution: unresolved(), portion: null, learned: false };
    replaceItem(id, changed); updateProposalCard(card, changed, 'Szukam produktu…'); summary();
    try {
      const result = await repository.searchProducts(query, { signal: request.signal });
      if (revision !== version || rowVersions.get(id) !== rowVersion) return;
      // Wyniki wyszukania są propozycjami do jawnego wyboru, nie drugim resolverem.
      const row = { ...findItem(id), resolution: { ...unresolved(), alternatives: result.products.slice(0, 5) } };
      replaceItem(id, row);
      renderProposalChoices(card, row.resolution.alternatives, productId => { void chooseRow(id, productId); });
      updateProposalCard(card, row, result.error ? productErrorMessage(result.error) : result.products.length ? '? Wybierz właściwy produkt z wyników.' : '! Brak wyników. Zmień nazwę lub markę.');
      summary();
    } catch (failure) { if (revision === version && findItem(id)) updateProposalCard(card, findItem(id), productErrorMessage(failure)); }
    finally { if (rowControllers.get(id) === request) { button.disabled = false; rowControllers.delete(id); } }
  }
  async function analyze() {
    invalidate(); clearError();
    let date;
    try { date = readDate(); } catch (failure) { onDateError(failure); form.dataset.analysisState = 'error'; return; }
    const source = text.value, defaultMeal = getMeal();
    const understood = understandMeal(source, { defaultMeal });
    if (!understood.intents.length) { error(understood.issues.map(issue => issue.message).join(' ')); form.dataset.analysisState = 'error'; text.focus(); return; }
    const version = revision, request = new AbortController(); controller = request;
    form.dataset.analysisState = 'processing'; $('analyze-meal').disabled = true; $('meal-text-status').textContent = 'Dopasowuję produkty…';
    try {
      const resolved = await resolveMealIntents(understood.intents, { resolver, allowExternal: !understood.issues.length, signal: request.signal });
      if (revision !== version) return;
      proposal = { ...resolved, source, defaultMeal, date, meal: understood.meal, issues: understood.issues };
      $('meal-proposal-items').replaceChildren(...proposal.items.map(drawRow));
      $('meal-proposal-issues').replaceChildren(...proposal.issues.map(issue => node('li', '', issue.message)));
      $('meal-proposal').hidden = false; $('proposal-empty').hidden = true;
      summary(); $('meal-proposal-title').focus(); form.dataset.analysisState = 'complete';
    } catch {
      if (revision === version) { error('Nie udało się zakończyć analizy. Popraw tekst i spróbuj ponownie.'); form.dataset.analysisState = 'error'; }
    } finally { if (revision === version) { controller = null; $('analyze-meal').disabled = speechBusy; buttonState(); } }
  }
  function saveProposal() {
    if (!proposal || save.disabled || saving) return;
    if (proposal.source !== text.value || proposal.date !== readSafeDate() || proposal.defaultMeal !== getMeal()) { invalidate('Dane zmienione. Kliknij „Analizuj ponownie”.'); return; }
    // Autofill lub skrypt może zmienić kontrolkę bez input. Najpierw pokaż nowe wartości do akceptacji.
    let changed = false;
    for (const item of proposal.items) {
      const card = findCard(item.id), fields = readProposalFields(card), query = card.querySelector('[data-query]').value;
      if (query !== item.intent.query) {
        nextRowVersion(item.id); choiceWrites.delete(item.id);
        const row = { ...item, intent: { ...item.intent, query }, resolution: unresolved(), portion: null, learned: false };
        replaceItem(item.id, row); renderProposalChoices(card, [], () => {}); updateProposalCard(card, row); changed = true;
      } else if (Object.entries(fields).some(([key, value]) => value !== item.intent[key])) {
        nextRowVersion(item.id); const row = updateMealItemPortion(item, fields);
        replaceItem(item.id, row); updateProposalCard(card, row); changed = true;
      }
    }
    if (changed) { summary(); error('Dane pozycji zmieniły się. Sprawdź aktualny podgląd przed dodaniem.'); return; }
    const current = proposal, pendingChoices = new Map(choiceWrites);
    saving = true; buttonState(); clearError();
    try {
      const portions = current.items.map(item => ({ ...item.portion, meal: item.intent.meal }));
      if (onSave(portions, current.date)) {
        text.value = ''; $('live-transcript').textContent = '';
        invalidate(`Dodano do dziennika. Liczba pozycji: ${portions.length}. ${current.date}.`);
        const savedRevision = revision;
        text.focus();
        // Zatwierdzenie całej widocznej propozycji jest jawną akceptacją produktu.
        void (async () => {
          try {
            for (const item of current.items.filter(row => !row.learned)) {
              const pending = pendingChoices.get(item.id);
              if (pending?.productId === item.resolution.product.id && pending.query === item.intent.query && await pending.promise) continue;
              await resolver.rememberUserChoice(item.intent.query, item.resolution.product.id);
            }
          }
          catch { if (revision === savedRevision) $('meal-text-status').textContent += ' Wpisy zapisane; nie udało się zapamiętać części dopasowań.'; }
        })();
      }
    } catch (failure) { error(failure.message); }
    finally { saving = false; buttonState(); }
  }
  function readSafeDate() { try { return readDate(); } catch { return null; } }
  function displayTranscript(transcript) {
    text.value = transcript;
    $('live-transcript').textContent = transcript;
  }
  const speech = createSpeechRecognitionAdapter({
    onState({ state, message }) {
      speechBusy = ['listening', 'processing'].includes(state);
      $('speech-status').textContent = message; $('voice-entry').dataset.speechState = state;
      $('voice-microphone').textContent = state === 'listening' ? '■ Zakończ' : state === 'processing' ? 'Przetwarzam…' : '🎙️ Powiedz posiłek';
      $('voice-microphone').setAttribute('aria-label', state === 'listening' ? 'Zakończ rozpoznawanie posiłku' : 'Rozpocznij rozpoznawanie posiłku');
      $('voice-microphone').setAttribute('aria-pressed', String(speechBusy));
      $('voice-microphone').disabled = state === 'processing' || state === 'unsupported';
      $('cancel-speech').hidden = !speechBusy; text.disabled = speechBusy; $('analyze-meal').disabled = speechBusy;
      buttonState();
    },
    onTranscript({ text: transcript }) { displayTranscript(transcript); },
    onComplete(transcript) { displayTranscript(transcript); void analyze(); },
  });
  $('speech-status').textContent = SPEECH_MESSAGES[speech.getState()];
  $('voice-entry').dataset.speechState = speech.getState(); $('voice-microphone').disabled = !speech.supported;
  $('voice-microphone').addEventListener('click', () => {
    if (speech.getState() === 'listening') speech.stop();
    else { invalidate(); clearError(); $('live-transcript').textContent = ''; speech.start(); }
  });
  $('cancel-speech').addEventListener('click', () => speech.abort());
  $('use-text-entry').addEventListener('click', () => text.focus());
  $('use-manual-entry').addEventListener('click', () => { $('product-search').focus(); $('product-catalog').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  form.addEventListener('submit', event => { event.preventDefault(); if (!speechBusy) void analyze(); });
  text.addEventListener('input', () => { invalidate('Tekst zmieniony. Kliknij „Analizuj ponownie”.'); clearError(); });
  save.addEventListener('click', saveProposal);
  window.addEventListener('pagehide', () => { speech.abort(); invalidate(); });
  form.dataset.analysisState = 'idle';
  return { invalidateContext() { invalidate('Dane zmienione. Kliknij „Analizuj ponownie”.'); clearError(); },
    setStorageAvailable(value) { storageAvailable = value; buttonState(); } };
}
