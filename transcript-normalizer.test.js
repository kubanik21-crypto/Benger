import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTranscript } from './transcript-normalizer.js';
for (const [raw, expected] of [
  ['mleko dwa procent', 'mleko 2%'],
  ['mleko 2 procent', 'mleko 2%'],
  ['mleko 3,2 procent', 'mleko 3.2%'],
  ['jogurt 0 procent', 'jogurt 0%'],
  ['dwieście pięćdziesiąt mililitrów mleka', '250 ml mleka'],
  ['80 gramów płatków', '80 g platkow'],
  ['250 mili mleka', '250 ml mleka'],
  ['mleko Łaciate 2% 250 mili', 'mleko laciate 2% 250 ml'],
  ['250 mili produktu', '250 mili produktu'],
  ['mili ludzie', 'mili ludzie'],
  ['cola zero 200 ml', 'cola zero 200 ml'],
  ['250 ml mleka i 250 ml kefiru', '250 ml mleka i 250 ml kefiru'],
  ['100 gram ryżu 100 gram kurczaka', '100 g ryzu 100 g kurczaka'],
  ['skyr waniliowy Pilos 150 gram', 'skyr waniliowy pilos 150 g'],
]) test(`Normalizacja transkrypcji: ${raw}`, () => {
  assert.deepEqual(normalizeTranscript(raw), { rawTranscript: raw, normalizedTranscript: expected });
});
test('normalizacja zachowuje brak ilości i odrzuca wejście ponad limit', () => {
  assert.equal(normalizeTranscript('zjadłem banana').normalizedTranscript, 'zjadlem banana');
  assert.throws(() => normalizeTranscript(null), TypeError);
  assert.throws(() => normalizeTranscript('a'.repeat(2001)), RangeError);
});
