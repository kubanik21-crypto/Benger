import { STORAGE_NAMESPACE } from './app-storage.js?v=97c6d29ab4957fd5a0ad09b319aa2dfffb978607';

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
