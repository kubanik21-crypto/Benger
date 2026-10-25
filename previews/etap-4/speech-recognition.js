export const SPEECH_MESSAGES = {
  ready: 'Gotowy. Naciśnij i powiedz cały posiłek.',
  listening: 'Słucham… Powiedz cały posiłek, potem naciśnij „Zakończ”.',
  processing: 'Przetwarzam wypowiedź…',
  completed: 'Zakończono. Sprawdź tekst i propozycję posiłku.',
  cancelled: 'Anulowano rozpoznawanie. Możesz spróbować ponownie lub wpisać tekst.',
  'permission-denied': 'Brak dostępu do mikrofonu. Sprawdź uprawnienia przeglądarki lub wpisz posiłek.',
  'no-speech': 'Nie rozpoznano mowy. Spróbuj ponownie lub wpisz posiłek.',
  timeout: 'Upłynął czas rozpoznawania. Spróbuj krótszej wypowiedzi lub wpisz tekst.',
  'service-error': 'Usługa rozpoznawania jest niedostępna. Spróbuj ponownie lub wpisz posiłek.',
  unsupported: 'Rozpoznawanie głosu nie jest dostępne w tej przeglądarce. Możesz wpisać posiłek tekstowo.',
};

export function speechRecognitionConstructor(scope = globalThis) {
  if (scope.isSecureContext === false) return null;
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

// Tylko transkrypcja. Bez MediaRecorder, parsera, pamięci ani requestów produktów.
export function createSpeechRecognitionAdapter({ Recognition = speechRecognitionConstructor(), language = 'pl-PL',
  timeoutMs = 45_000, stopTimeoutMs = 10_000, onState = () => {}, onTranscript = () => {}, onComplete = () => {},
  setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  let state = typeof Recognition === 'function' ? 'ready' : 'unsupported';
  let session = null;
  let disposed = false;
  const emit = value => { state = value; onState({ state, message: SPEECH_MESSAGES[state] }); };
  function cleanup(current) {
    clearTimer(current.timer);
    for (const event of ['start', 'result', 'error', 'end', 'speechend']) current.recognition[`on${event}`] = null;
    if (session === current) session = null;
  }
  function finish(current, next, complete = false) {
    if (session !== current) return;
    cleanup(current);
    emit(next);
    if (complete) onComplete(current.final.trim());
  }
  function abortAs(next) {
    if (!session) return;
    const current = session;
    finish(current, next);
    try { current.recognition.abort(); } catch { /* Koniec sesji może wyprzedzić abort. */ }
  }
  function arm(current, duration) {
    clearTimer(current.timer);
    current.timer = setTimer(() => { if (session === current) abortAs('timeout'); }, duration);
  }
  return {
    supported: typeof Recognition === 'function',
    getState: () => state,
    start() {
      if (disposed || session) return false;
      if (typeof Recognition !== 'function') { emit('unsupported'); return false; }
      let recognition;
      try { recognition = new Recognition(); } catch { emit('service-error'); return false; }
      const current = { recognition, final: '', timer: null };
      session = current;
      recognition.lang = language;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.onstart = () => { if (session === current) emit('listening'); };
      recognition.onresult = event => {
        if (session !== current) return;
        let final = '', interim = '';
        for (const result of Array.from(event.results ?? [])) {
          const text = typeof result[0]?.transcript === 'string' ? result[0].transcript : '';
          if (result.isFinal) final += text + ' '; else interim += text + ' ';
        }
        if ((final + interim).length > 2000) { abortAs('service-error'); return; }
        current.final = final.trim();
        onTranscript({ final: current.final, interim: interim.trim() });
      };
      recognition.onerror = event => {
        if (session !== current) return;
        const next = ['not-allowed', 'service-not-allowed', 'audio-capture'].includes(event.error) ? 'permission-denied'
          : event.error === 'no-speech' ? 'no-speech' : event.error === 'aborted' ? 'cancelled' : 'service-error';
        finish(current, next);
        try { recognition.abort(); } catch { /* Usługa mogła już zakończyć sesję. */ }
      };
      recognition.onend = () => finish(current, current.final ? 'completed' : 'no-speech', Boolean(current.final));
      emit('listening');
      arm(current, timeoutMs);
      try { recognition.start(); return true; }
      catch (error) {
        finish(current, error.name === 'NotAllowedError' ? 'permission-denied' : 'service-error');
        try { recognition.abort?.(); } catch { /* Nie zostawiaj aktywnej usługi po nieudanym starcie. */ }
        return false;
      }
    },
    stop() {
      if (!session || state === 'processing') return false;
      const current = session;
      emit('processing'); arm(current, stopTimeoutMs);
      try { current.recognition.stop(); } catch { finish(current, 'service-error'); }
      return true;
    },
    abort() { abortAs('cancelled'); },
    dispose() { abortAs('cancelled'); disposed = true; },
  };
}
