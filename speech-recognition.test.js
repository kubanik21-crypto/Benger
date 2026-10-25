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
  const results = (...values) => ({ results: values.map(([transcript, isFinal]) => Object.assign([{ transcript }], { isFinal })) });
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
  const recognition = instances[0]; assert.equal(recognition.lang, 'pl-PL'); assert.equal(recognition.interimResults, true);
  recognition.onresult(results(['50 g płatków', false]));
  assert.deepEqual(transcripts.at(-1), { final: '', interim: '50 g płatków' }); assert.deepEqual(completed, []);
  recognition.onresult(results(['50 g płatków', true], ['i mleko', false]));
  assert.deepEqual(transcripts.at(-1), { final: '50 g płatków', interim: 'i mleko' });
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
