import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpeechRecognitionAdapter, speechRecognitionConstructor } from './speech-recognition.js';

function setup(options = {}) {
  const states = [], transcripts = [], completed = [], instances = [], timers = new Map();
  let timerId = 0;
  class Recognition {
    constructor() { instances.push(this); }
    start() { this.started = true; this.onstart?.(); }
    stop() { this.stopped = true; }
    abort() { this.aborted = true; this.onend?.(); }
  }
  const adapter = createSpeechRecognitionAdapter({ Recognition, onState: value => states.push(value.state),
    onTranscript: value => transcripts.push(value), onComplete: text => completed.push(text),
    setTimer: (callback, delay) => { timers.set(++timerId, { callback, delay }); return timerId; },
    clearTimer: id => timers.delete(id), ...options });
  const results = (...values) => ({ resultIndex: 0, results: values.map(([transcript, isFinal]) => Object.assign([{ transcript }], { isFinal })) });
  return { adapter, states, transcripts, completed, instances, timers, results };
}

test('Speech: wykrywa standard, webkit i brak obsługi oraz kontekst HTTP', () => {
  const api = function () {};
  assert.equal(speechRecognitionConstructor({ SpeechRecognition: api }), api);
  assert.equal(speechRecognitionConstructor({ webkitSpeechRecognition: api }), api);
  assert.equal(speechRecognitionConstructor({}), null);
  assert.equal(speechRecognitionConstructor({ SpeechRecognition: api, isSecureContext: false }), null);
  const { adapter, states } = setup({ Recognition: null });
  assert.equal(adapter.supported, false); assert.equal(adapter.start(), false); assert.deepEqual(states, ['unsupported']);
});
test('Speech: pl-PL, interim, blokada drugiego startu i final dopiero po end', () => {
  const { adapter, instances, transcripts, completed, results, timers } = setup();
  assert.equal(adapter.start(), true); assert.equal(adapter.start(), false);
  const recognition = instances[0]; assert.equal(recognition.continuous, false); assert.equal(recognition.lang, 'pl-PL'); assert.equal(recognition.interimResults, true);
  recognition.onresult(results(['50 g płatków', false]));
  assert.deepEqual(transcripts.at(-1), { text: '50 g płatków', final: '', interim: '50 g płatków' }); assert.deepEqual(completed, []);
  recognition.onresult(results(['50 g płatków', true], ['i mleko', false]));
  assert.deepEqual(transcripts.at(-1), { text: '50 g płatków i mleko', final: '50 g płatków', interim: 'i mleko' });
  recognition.onresult(results(['50 g płatków', true], ['i mleko 200 ml', true]));
  assert.deepEqual(completed, []);
  recognition.onend(); assert.deepEqual(completed, ['50 g płatków i mleko 200 ml']);
  assert.equal(adapter.getState(), 'completed'); assert.equal(timers.size, 0);
  assert.equal(recognition.onresult, null); assert.equal(recognition.onend, null);
});
test('Speech: stop kończy słuchanie, czeka na final i ma deadline przetwarzania', () => {
  const { adapter, instances, timers, results, completed } = setup({ language: 'en-GB' });
  adapter.start(); const recognition = instances[0]; assert.equal(recognition.lang, 'en-GB');
  assert.equal(adapter.stop(), true); assert.equal(recognition.stopped, true); assert.equal(adapter.getState(), 'processing');
  assert.equal(adapter.stop(), false); assert.equal([...timers.values()][0].delay, 10000);
  recognition.onresult(results(['banan 120 g', true])); recognition.onend();
  assert.deepEqual(completed, ['banan 120 g']); assert.equal(adapter.stop(), false);
});
test('Speech: abort i dispose usuwają handlery, timery i ignorują spóźnione wyniki', () => {
  const { adapter, instances, completed, results, timers } = setup();
  adapter.start(); const recognition = instances[0]; const late = recognition.onresult;
  adapter.abort(); late(results(['nie zapisuj', true]));
  assert.equal(recognition.aborted, true); assert.equal(adapter.getState(), 'cancelled'); assert.equal(timers.size, 0);
  assert.equal(recognition.onerror, null); assert.deepEqual(completed, []);
  assert.equal(adapter.start(), true); assert.equal(instances.length, 2);
  adapter.dispose(); assert.equal(adapter.start(), false); assert.equal(instances[1].onend, null);
});
for (const [error, state] of [['not-allowed', 'permission-denied'], ['service-not-allowed', 'permission-denied'], ['audio-capture', 'permission-denied'], ['no-speech', 'no-speech'], ['network', 'service-error'], ['language-not-supported', 'service-error'], ['aborted', 'cancelled']]) {
  test(`Speech: ${error} → ${state}, bez callbacku sukcesu`, () => {
    const { adapter, instances, completed, timers } = setup(); adapter.start(); const recognition = instances[0];
    const end = recognition.onend; recognition.onerror({ error }); end();
    assert.equal(adapter.getState(), state); assert.deepEqual(completed, []); assert.equal(timers.size, 0);
  });
}
test('Speech: sam interim i pusty end nie uruchamiają analizy', () => {
  const { adapter, instances, results, completed } = setup(); adapter.start();
  instances[0].onresult(results(['niedokończone', false])); instances[0].onend();
  assert.equal(adapter.getState(), 'no-speech'); assert.deepEqual(completed, []);
});
test('Speech: timeout i start rzucający wyjątek są obsłużone, bez sleep w teście', () => {
  const { adapter, timers, instances, completed } = setup(); adapter.start();
  [...timers.values()][0].callback(); assert.equal(adapter.getState(), 'timeout'); assert.equal(instances[0].aborted, true);
  assert.deepEqual(completed, []);
  const denied = setup({ Recognition: class { start() { throw new DOMException('denied', 'NotAllowedError'); } } });
  assert.equal(denied.adapter.start(), false); assert.equal(denied.adapter.getState(), 'permission-denied');
  const service = setup({ Recognition: class { constructor() { throw new Error('service unavailable'); } } });
  assert.equal(service.adapter.start(), false); assert.equal(service.adapter.getState(), 'service-error');
});
test('Speech: ogranicza rozmiar transkrypcji bez budowania historii nagrań', () => {
  const { adapter, instances, results, completed } = setup(); adapter.start();
  instances[0].onresult(results(['a'.repeat(2001), true]));
  assert.equal(adapter.getState(), 'service-error'); assert.deepEqual(completed, []);
});

// Obiekt listy nie jest tablicą: tak jak natywne SpeechRecognitionResultList ma length i indeksy.
function cumulativeEvent(resultIndex, values) {
  const entries = values.map(([transcript, isFinal]) => Object.assign({ 0: { transcript }, length: 1 }, { isFinal }));
  return { resultIndex, results: Object.assign({ length: entries.length }, entries) };
}
function session() {
  const state = setup(); state.adapter.start();
  return { ...state, emit: (index, values) => state.instances[0].onresult(cumulativeEvent(index, values)) };
}

test('Speech: Samsung — 250 interim → 250 ml final + mleka interim → dwa final', () => {
  const { emit, transcripts, completed, instances } = session();
  emit(0, [['250', false]]);
  assert.deepEqual(transcripts.at(-1), { text: '250', final: '', interim: '250' });
  emit(0, [['250 ml', true], ['mleka', false]]);
  assert.deepEqual(transcripts.at(-1), { text: '250 ml mleka', final: '250 ml', interim: 'mleka' });
  emit(1, [['250 ml', true], ['mleka', true]]);
  assert.deepEqual(transcripts.at(-1), { text: '250 ml mleka', final: '250 ml mleka', interim: '' });
  assert.deepEqual(completed, []);
  instances[0].onend(); assert.deepEqual(completed, ['250 ml mleka']);
});

test('Speech: zmienia tylko ostatni interim przy resultIndex > 0, zachowuje kolejność wielu final', () => {
  const { emit, transcripts, instances, completed } = session();
  emit(0, [['250 ml', true], ['mleka', true], ['i', false]]);
  emit(2, [['250 ml', true], ['mleka', true], ['i banan', false]]);
  emit(2, [['250 ml', true], ['mleka', true], ['i banan 120 gram', true]]);
  assert.deepEqual(transcripts.map(item => item.text), ['250 ml mleka i', '250 ml mleka i banan', '250 ml mleka i banan 120 gram']);
  instances[0].onend(); assert.deepEqual(completed, ['250 ml mleka i banan 120 gram']);
});

test('Speech: powtórzony event i dłuższa wypowiedź nie dodają ponownie starego final', () => {
  const { emit, transcripts, instances, completed } = session();
  const chunks = ['Na śniadanie', '80 gram płatków owsianych', 'i 250 ml mleka 2%', 'oraz banan 120 gram', 'i skyr Pilos 150 gram'];
  const values = [];
  for (const [index, chunk] of chunks.entries()) {
    values.push([chunk, false]); emit(index, values);
    values[index] = [chunk, true]; emit(index, values); emit(index, values);
    assert.equal(transcripts.at(-1).text, chunks.slice(0, index + 1).join(' '));
  }
  instances[0].onend(); assert.deepEqual(completed, [chunks.join(' ')]);
});

test('Speech: nie usuwa prawdziwego powtórzenia 250 ml mleka i 250 ml kefiru', () => {
  const { emit, transcripts, instances, completed } = session();
  emit(0, [['250 ml mleka', true], ['i 250', false]]);
  emit(1, [['250 ml mleka', true], ['i 250 ml kefiru', true]]);
  assert.equal(transcripts.at(-1).text, '250 ml mleka i 250 ml kefiru');
  instances[0].onend(); assert.deepEqual(completed, ['250 ml mleka i 250 ml kefiru']);
});

test('Speech: wycofuje ostatni interim, także przy resultIndex równym nowej długości', () => {
  const { emit, transcripts, instances, completed } = session();
  emit(0, [['250 ml mleka', true], ['i banan', false]]);
  emit(1, [['250 ml mleka', true]]);
  assert.deepEqual(transcripts.at(-1), { text: '250 ml mleka', final: '250 ml mleka', interim: '' });
  instances[0].onend(); assert.deepEqual(completed, ['250 ml mleka']);
});

test('Speech: puste segmenty nie zmieniają indeksów ani nie zostawiają podwójnych odstępów', () => {
  const { emit, transcripts, completed, instances } = session();
  emit(0, [['', true], [' 250 ml ', true], ['   ', false], [' mleka ', false]]);
  emit(3, [['', true], [' 250 ml ', true], ['   ', false], [' mleka ', true]]);
  assert.deepEqual(transcripts.at(-1), { text: '250 ml mleka', final: '250 ml mleka', interim: '' });
  instances[0].onend(); assert.deepEqual(completed, ['250 ml mleka']);
});

test('Speech: zachowuje kopię prefiksu mimo nieoczekiwanej mutacji wcześniejszego obiektu w results', () => {
  const { instances, transcripts, completed } = session();
  const event = cumulativeEvent(0, [['250 ml', true], ['mleka', false]]);
  instances[0].onresult(event);
  event.resultIndex = 1;
  event.results[0][0].transcript = '250 250 250 ml'; // Wpis < resultIndex nie jest nowym wynikiem.
  event.results[1].isFinal = true;
  instances[0].onresult(event);
  assert.equal(transcripts.at(-1).text, '250 ml mleka');
  instances[0].onend(); assert.deepEqual(completed, ['250 ml mleka']);
});

test('Speech: jawna korekta wcześniejszego wyniku zastępuje jego indeks, nie dopisuje tekstu', () => {
  const { emit, transcripts, completed, instances } = session();
  emit(0, [['250 ml', true], ['mleka', false]]);
  // Obrona na dostawcę, który koryguje/scala stary segment i deklaruje zmianę od indeksu 0.
  emit(0, [['250 ml mleka', true]]);
  assert.deepEqual(transcripts.at(-1), { text: '250 ml mleka', final: '250 ml mleka', interim: '' });
  instances[0].onend(); assert.deepEqual(completed, ['250 ml mleka']);
});

test('Speech: pierwszy event z resultIndex > 0 odtwarza brakujące wcześniejsze segmenty', () => {
  const { emit, transcripts } = session();
  emit(2, [['Na śniadanie', true], ['80 g płatków', true], ['i mleko', false]]);
  assert.deepEqual(transcripts.at(-1), { text: 'Na śniadanie 80 g płatków i mleko', final: 'Na śniadanie 80 g płatków', interim: 'i mleko' });
});

test('Speech: brak resultIndex w starszym adapterze traktuje event jako pełną migawkę', () => {
  const { emit, instances, transcripts } = session();
  emit(0, [['250', false]]);
  const event = cumulativeEvent(0, [['250 ml mleka', true]]); delete event.resultIndex;
  instances[0].onresult(event); assert.equal(transcripts.at(-1).text, '250 ml mleka');
});

test('Speech: zniknięcie samego interim kończy się no-speech, a nowa sesja nie dziedziczy tekstu', () => {
  const { adapter, emit, instances, completed, transcripts } = session();
  emit(0, [['250', false]]); emit(0, []); instances[0].onend();
  assert.equal(adapter.getState(), 'no-speech'); assert.deepEqual(completed, []);
  adapter.start(); instances[1].onresult(cumulativeEvent(0, [['banan 120 gram', true]])); instances[1].onend();
  assert.equal(transcripts.at(-1).text, 'banan 120 gram'); assert.deepEqual(completed, ['banan 120 gram']);
});

test('Speech diagnostics: trzy konfiguracje i surowy event przed przetworzeniem',()=>{
 for(const [continuous,interimResults] of [[true,true],[false,true],[false,false]]){
  const events=[];const {adapter,instances,results}=setup({continuous,interimResults,onEvent:(type,event)=>events.push({type,index:event?.resultIndex})});
  adapter.start();const r=instances[0];assert.equal(r.continuous,continuous);assert.equal(r.interimResults,interimResults);
  r.onresult(results(['250 ml mleka',true]));r.onend();assert.ok(events.some(e=>e.type==='result'&&e.index===0));assert.equal(r.onaudioend,null);
 }
});
