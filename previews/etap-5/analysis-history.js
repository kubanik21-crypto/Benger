import { STORAGE_NAMESPACE } from './app-storage.js?v=9f5774d7c3515887439c933b2257ad75b148f590';
const key=`benger.${STORAGE_NAMESPACE || 'local'}.analyses.v1`;
export function readAnalysisHistory(){try{const value=JSON.parse(localStorage.getItem(key)??'[]');return Array.isArray(value)?value.filter(row=>row && typeof row.rawTranscript==='string' && typeof row.normalizedTranscript==='string').slice(-20):[];}catch{return [];}}
export function recordAnalysis(understood,unresolved){try{const row={timestamp:new Date().toISOString(),buildSha:document.querySelector('meta[name=benger-build]')?.content??'local',rawTranscript:understood.rawTranscript,normalizedTranscript:understood.normalizedTranscript,intentCount:understood.intents.length,unresolvedCount:unresolved};localStorage.setItem(key,JSON.stringify([...readAnalysisHistory(),row].slice(-20)));}catch{/* Diagnostyka nie może blokować dziennika. */}}
export function clearAnalysisHistory(){localStorage.removeItem(key);}
