// Oddzielny notatnik pierwszego prototypu. Nie odczytuje ani nie zapisuje produktów.
export function initLegacyNotes({ dateInput, createEntryId }) {
  const $ = id => document.getElementById(id);
  const key = 'benger.meals.v1';
  let entries = [];
  let storageOK = true;
  try {
    const raw = localStorage.getItem(key);
    const saved = raw === null ? [] : JSON.parse(raw);
    if (!Array.isArray(saved) || !saved.every(entry => entry !== null
        && typeof entry.text === 'string' && typeof entry.date === 'string'
        && typeof entry.id === 'string' && typeof entry.meal === 'string')) {
      throw new Error('Nieprawidłowe notatki.');
    }
    entries = saved;
  } catch {
    storageOK = false;
    $('save').disabled = true;
    $('export').disabled = true;
    $('status').textContent = 'Nie można odczytać notatek. Zapis i eksport są zablokowane, aby chronić dane.';
  }

  function render() {
    const box = $('entries');
    box.replaceChildren();
    if (!storageOK) return;
    const selected = entries.filter(entry => entry.date === dateInput.value);
    if (selected.length === 0) box.textContent = 'Brak notatek w wybranym dniu.';
    for (const entry of selected) {
      const article = document.createElement('article');
      article.className = 'legacy-note';
      const meal = document.createElement('small');
      meal.textContent = entry.meal;
      const text = document.createElement('p');
      text.textContent = entry.text;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'button-secondary';
      remove.textContent = 'Usuń notatkę';
      remove.onclick = () => {
        if (confirm('Usunąć tę notatkę?')) persist(entries.filter(item => item.id !== entry.id));
      };
      article.append(meal, text, remove);
      box.append(article);
    }
  }

  function persist(next) {
    if (!storageOK) return false;
    try {
      localStorage.setItem(key, JSON.stringify(next));
      entries = next;
      render();
      return true;
    } catch {
      $('status').textContent = 'Nie udało się zapisać notatki. Sprawdź pamięć przeglądarki.';
      return false;
    }
  }

  dateInput.addEventListener('change', render);
  $('save').onclick = () => {
    const text = $('words').value.trim();
    if (!text) { $('status').textContent = 'Najpierw wpisz lub podyktuj notatkę.'; return; }
    if (!dateInput.value) { $('status').textContent = 'Wybierz datę dziennika.'; dateInput.focus(); return; }
    try {
      if (persist([...entries, { id: createEntryId(), date: dateInput.value, meal: $('meal').value, text }])) {
        $('words').value = '';
        $('status').textContent = 'Notatka zapisana.';
      }
    } catch (error) { $('status').textContent = error.message; }
  };
  $('export').onclick = () => {
    if (!storageOK) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'benger-notatki.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Speech || !window.isSecureContext) {
    $('mic').disabled = true;
    $('hint').textContent = 'Dyktowanie jest niedostępne. Użyj klawiatury albo jej mikrofonu.';
  } else {
    try {
      const recognition = new Speech();
      recognition.lang = 'pl-PL';
      recognition.interimResults = true;
      let listening = false;
      let base = '';
      recognition.onstart = () => {
        listening = true;
        $('mic').textContent = 'Zatrzymaj dyktowanie';
        $('mic').setAttribute('aria-label', 'Zatrzymaj dyktowanie');
        $('status').textContent = 'Słucham…';
      };
      recognition.onresult = event => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) transcript += event.results[i][0].transcript + ' ';
        $('words').value = `${base} ${transcript}`.trim();
      };
      recognition.onend = () => {
        listening = false;
        $('mic').textContent = 'Dyktuj notatkę';
        $('mic').setAttribute('aria-label', 'Rozpocznij dyktowanie');
        if ($('status').textContent === 'Słucham…') $('status').textContent = 'Sprawdź notatkę przed zapisaniem.';
      };
      recognition.onerror = event => {
        $('status').textContent = event.error === 'not-allowed'
          ? 'Zezwól na dostęp do mikrofonu albo wpisz notatkę.'
          : 'Dyktowanie przerwane. Możesz wpisać notatkę.';
      };
      $('mic').onclick = () => {
        if (listening) { recognition.stop(); return; }
        base = $('words').value;
        try { recognition.start(); }
        catch { $('status').textContent = 'Poczekaj na zakończenie dyktowania.'; }
      };
    } catch {
      $('mic').disabled = true;
      $('hint').textContent = 'Nie można uruchomić dyktowania. Możesz wpisać notatkę.';
    }
  }
  render();
}
