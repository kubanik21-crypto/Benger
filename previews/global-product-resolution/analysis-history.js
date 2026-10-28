import { STORAGE_NAMESPACE } from './app-storage.js?v=4ec45dff6c12283d10ab94890f11e8bac8c5eb07';

const key = `benger.${STORAGE_NAMESPACE || 'local'}.analyses.v1`;
const limit = 20;

export function readAnalysisHistory() {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(value) ? value.filter(row => row
      && typeof row.rawTranscript === 'string' && row.rawTranscript.length <= 2000
      && typeof row.normalizedTranscript === 'string' && row.normalizedTranscript.length <= 4000).slice(-limit) : [];
  } catch { return []; }
}

export function recordAnalysis(understood, unresolved) {
  try {
    const row = {
      timestamp: new Date().toISOString(),
      buildSha: document.querySelector('meta[name=benger-build]')?.content ?? 'local',
      rawTranscript: understood.rawTranscript,
      normalizedTranscript: understood.normalizedTranscript,
      intentCount: understood.intents.length,
      unresolvedCount: unresolved,
    };
    localStorage.setItem(key, JSON.stringify([...readAnalysisHistory(), row].slice(-limit)));
  } catch { /* Diagnostyka nie może blokować dziennika. */ }
}

export function clearAnalysisHistory() { localStorage.removeItem(key); }
