import { performance } from 'node:perf_hooks';
import { understandMeal } from '../meal-understanding.js';
import { VOICE_CORPUS } from '../voice-corpus.js';
// Bez sieci, IndexedDB i resolvera: pomiar językowej części pipeline, nie całego UX.
for (let i = 0; i < 100; i++) understandMeal(VOICE_CORPUS[i % VOICE_CORPUS.length][0], { defaultMeal: 'breakfast' });
const start = performance.now();
for (let i = 0; i < 1000; i++) understandMeal(VOICE_CORPUS[i % VOICE_CORPUS.length][0], { defaultMeal: 'breakfast' });
const elapsed = performance.now() - start;
console.log(JSON.stringify({ node: process.version, analyses: 1000, totalMs: +elapsed.toFixed(2), averageMs: +(elapsed / 1000).toFixed(3) }, null, 2));
