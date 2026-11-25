// Local, read-only projection. No network, persistence writes or live recipe lookups.
import {NUTRITION_STORAGE_KEY} from './app-storage.js';
import {validDiaryEntry} from './diary-entry.js';
import {validDate, validateGoals, goalsOn} from './goals.js';
import {validateSession} from './training-model.js';
import {BODY, validateMeasurement} from './progress.js';

export const SYNC_EXPORT_SCHEMA_VERSION = 1;
const NUTRIENTS = ['kcal', 'protein', 'fat', 'carbs'];
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const numeric = value => value ?? null;
const nutrition = value => Object.fromEntries(NUTRIENTS.map(key => [key, value?.[key] ?? null]));
const fail = message => { throw new TypeError(`Eksport synchronizacji: ${message}`); };
const inRange = (date, range) => (!range.from || date >= range.from) && (!range.to || date <= range.to);
const previousDay = date => new Date(Date.parse(date) - 86400000).toISOString().slice(0, 10);

function rangeOptions({from = null, to = null, exportedAt = new Date().toISOString()} = {}) {
  if (from !== null && !validDate(from) || to !== null && !validDate(to) || from && to && from > to) fail('nieprawidłowy zakres dat.');
  if (from && to && (Date.parse(to) - Date.parse(from)) / 86400000 > 36600) fail('zakres przekracza 36601 dni.');
  if (typeof exportedAt !== 'string' || !Number.isFinite(Date.parse(exportedAt))) fail('nieprawidłowy czas eksportu.');
  return {range: {from, to, inclusive: true, dateBasis: 'record-local-date'}, exportedAt: new Date(exportedAt).toISOString()};
}
function unique(rows, label) {
  if (!Array.isArray(rows)) fail(`brak kolekcji ${label}.`);
  if (new Set(rows.map(row => row?.id)).size !== rows.length) fail(`powtórzone identyfikatory: ${label}.`);
  return rows;
}

function foodEntry(row) {
  if (!validDiaryEntry(row)) fail('nieprawidłowy wpis żywieniowy.');
  // Explicit allowlist: never copy notes, arbitrary metadata or raw ingredient objects.
  return {
    id: row.id, date: row.date, createdAt: row.createdAt, meal: row.meal,
    sourceType: row.kind === 'RECIPE' ? 'recipe' : 'product',
    productId: row.productId ?? null, productName: row.productName ?? null,
    recipeId: row.recipeId ?? null, recipeVersion: row.recipeVersion ?? null,
    recipeName: row.recipeName ?? null,
    variantId: row.mealSnapshot?.variantId ?? null,
    amount: row.amount, unit: row.unit,
    enteredAmount: row.displayPortion?.amount ?? row.amount,
    enteredUnit: row.displayPortion?.unit ?? row.unit,
    portionConversion: row.portionConversion ? {
      source: row.portionConversion.source, confidence: row.portionConversion.confidence,
      estimated: row.estimated ?? row.portionConversion.estimated ?? null,
      normalizedAmount: row.portionConversion.normalizedAmount, normalizedUnit: row.portionConversion.normalizedUnit,
    } : null,
    nutrition: nutrition(row.nutrition),
  };
}
function exportSession(raw, kind) {
  const row = validateSession(raw, kind, 'completed');
  return {
    id: row.id, kind, status: 'completed', name: row.name, date: row.date,
    startedAt: row.startedAt, completedAt: row.completedAt,
    scheduled: row.scheduled ? {ruleId: row.scheduled.ruleId, date: row.scheduled.date} : null,
    exercises: row.items.map((item, index) => ({
      // Model has no item ID; position disambiguates repeated exercises in this snapshot.
      key: JSON.stringify([kind, row.id, index]), position: index,
      exerciseId: item.exercise.id, name: item.exercise.name,
      mode: item.exercise.mode, dumbbells: item.exercise.dumbbells,
      dosage: {
        sets: item.dosage.sets, repsMin: item.dosage.repsMin, repsMax: item.dosage.repsMax,
        durationSeconds: item.dosage.duration, restSeconds: item.dosage.rest, side: item.dosage.side,
      },
      completedSets: kind === 'mobility' ? item.completedSets : null,
      sets: item.sets.map((set, setIndex) => ({
        key: JSON.stringify([kind, row.id, index, set.id]), id: set.id, position: setIndex,
        kind: set.kind, reps: numeric(set.reps), kg: numeric(set.kg), rir: numeric(set.rir),
        loadBasis: item.exercise.mode === 'strength' ? 'per-dumbbell' : item.exercise.mode === 'bodyweight' ? 'additional-load' : null,
        durationSeconds: numeric(set.duration), distanceKm: numeric(set.distance),
        speedKmH: numeric(set.speed), inclinePercent: numeric(set.incline),
      })),
    })),
  };
}
function bodyMeasurement(raw) {
  const row = validateMeasurement(raw);
  return {
    id: row.id, type: row.type, date: row.date, time: row.time,
    // Original local wall time has no offset; do not invent a UTC instant.
    utcOffsetMinutes: null, unit: row.type === 'weight' ? 'kg' : 'cm',
    values: row.type === 'weight' ? {kg: row.values.kg} : Object.fromEntries(Object.keys(BODY).map(key => [key, row.values[key] ?? null])),
  };
}
function summaries(entries, goals, range) {
  const grouped = new Map();
  for (const entry of entries) {
    if (!grouped.has(entry.date)) grouped.set(entry.date, []);
    grouped.get(entry.date).push(entry);
  }
  let dates = [...grouped.keys()].sort(compare);
  if (range.from && range.to) {
    dates = [];
    // Count-based loop also supports the last representable YYYY-MM-DD year.
    const count = Math.round((Date.parse(range.to) - Date.parse(range.from)) / 86400000);
    for (let i = 0; i <= count; i++) dates.push(new Date(Date.parse(range.from) + i * 86400000).toISOString().slice(0, 10));
  }
  return dates.map(date => {
    const rows = grouped.get(date) ?? [];
    const goal = goalsOn(goals, date);
    return {
      id: date, date, hasEntries: rows.length > 0, entryCount: rows.length,
      mealCount: new Set(rows.map(row => row.meal)).size,
      // No entries means missing consumption data, not a zero-calorie day.
      nutrition: Object.fromEntries(NUTRIENTS.map(key => [key, rows.length ? rows.reduce((sum, row) => sum + row.nutrition[key], 0) : null])),
      goalId: goal?.id ?? null, goalNutrition: nutrition(goal?.nutrition),
    };
  });
}

/** Pure projection of current source snapshots. Throws rather than silently exporting corrupt data. */
export function buildSyncExport(source, options = {}) {
  const {range, exportedAt} = rangeOptions(options);
  if (!source || typeof source !== 'object') fail('brak danych źródłowych.');
  const goals = validateGoals(unique(source.goals, 'goals'));
  const foodEntries = unique(source.diary, 'diary').map(foodEntry)
    .filter(row => inRange(row.date, range)).sort((a, b) => compare(a.date, b.date) || compare(a.createdAt, b.createdAt) || compare(a.id, b.id));
  if (!source.training) fail('brak danych treningowych.');
  const sessions = (key, kind) => unique(source.training[key], key).map(row => exportSession(row, kind))
    .filter(row => inRange(row.date, range)).sort((a, b) => compare(a.date, b.date) || compare(a.completedAt, b.completedAt) || compare(a.id, b.id));
  const measurements = unique(source.measurements, 'measurements')
    .filter(row => row?.type !== 'pressure') // Exclude pressure before validation/projection; never export pulse.
    .map(row => {
      if (!['weight', 'body'].includes(row?.type)) fail('nieznany typ pomiaru.');
      return bodyMeasurement(row);
    }).filter(row => inRange(row.date, range))
    .sort((a, b) => compare(a.date, b.date) || compare(a.time, b.time) || compare(a.id, b.id));
  const goalHistory = goals.map((row, index) => ({
    id: row.id, effectiveFrom: row.effectiveFrom,
    effectiveTo: goals[index + 1] ? previousDay(goals[index + 1].effectiveFrom) : null,
    nutrition: nutrition(row.nutrition),
  })).filter(row => (!range.to || row.effectiveFrom <= range.to) && (!range.from || row.effectiveTo === null || row.effectiveTo >= range.from));
  return {
    app: 'Benger', schemaVersion: SYNC_EXPORT_SCHEMA_VERSION, exportedAt,
    mode: 'snapshot', range,
    semantics: {
      missingValue: null, nutritionBasis: 'consumed-entry-snapshot',
      nutritionUnits: {kcal: 'kcal', protein: 'g', fat: 'g', carbs: 'g'},
      dailyCoverage: range.from && range.to ? 'all-days-in-range' : 'days-with-food-entries',
      deletions: 'absent-from-current-snapshot-not-tombstones',
    },
    dailyNutrition: summaries(foodEntries, goals, range), foodEntries, nutritionGoals: goalHistory,
    completedWorkouts: sessions('completedWorkouts', 'workout'),
    completedMobility: sessions('completedMobility', 'mobility'), measurements,
  };
}

/** Read only through existing repository APIs supplied by the caller; never opens/writes storage itself. */
export async function readLocalSyncExport({local, goalsStore, trainingRepository, progressStore}, options = {}) {
  rangeOptions(options); // Fail before touching any source when options are invalid.
  if (typeof local?.getItem !== 'function' || typeof goalsStore?.read !== 'function' ||
      typeof trainingRepository?.snapshot !== 'function' || typeof progressStore?.measurements !== 'function') fail('wymagane są wszystkie źródła danych.');
  const rawDiary = local.getItem(NUTRITION_STORAGE_KEY);
  // Only an absent key is an empty diary. Malformed/empty JSON must not masquerade as deletion.
  const diary = rawDiary === null ? [] : JSON.parse(rawDiary);
  const [goals, training, measurements] = await Promise.all([
    goalsStore.read(), trainingRepository.snapshot(), progressStore.measurements(),
  ]);
  return buildSyncExport({diary, goals, training, measurements}, options);
}
