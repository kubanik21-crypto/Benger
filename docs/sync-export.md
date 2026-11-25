# Lokalny eksport do przyszłej synchronizacji — etap 1

Moduł `sync-export.js` przygotowuje obiekt JSON zgodny ze schematem eksportu **1**.
Nie jest backupem i nie zmienia backup schema v8. Nie zapisuje danych, nie wykonuje
żądań sieciowych, nie ma OAuth, kluczy, integracji Sheets, ChatGPT ani Garmin.
Nie dodaje przycisku w interfejsie ani automatycznej synchronizacji.

## API

```js
import {buildSyncExport, readLocalSyncExport} from './sync-export.js';

// Czysta funkcja: wszystkie kolekcje muszą być podane, także puste.
const payload = buildSyncExport({
  diary,                       // aktualna tablica wpisów dziennika
  goals,                       // istniejąca historia celów
  training,                    // completedWorkouts i completedMobility
  measurements,                // rekordy pomiarów, bez konieczności odczytu zdjęć
}, {from: '2026-11-01', to: '2026-11-30'});

// Adapter do JUŻ ISTNIEJĄCYCH instancji magazynów aplikacji:
const samePayload = await readLocalSyncExport({
  local: localStorage,
  goalsStore,                   // .read()
  trainingRepository,           // .snapshot()
  progressStore,                // .measurements(), NIE .snapshot() ze zdjęciami
}, {from: '2026-11-01', to: '2026-11-30'});

const json = JSON.stringify(payload);
```

Przekazane magazyny należą do wywołującego; moduł nie otwiera baz, nie tworzy
repozytoriów, nie zamyka ich i nie zmienia namespace. Kolejny etap może podłączyć
adapter do istniejących instancji UI. Opcjonalny `exportedAt` pozwala odtwarzać
deterministyczne testy; domyślnie ustawiany jest czas przygotowania eksportu.

## Kontrakt

- `app: "Benger"`, `schemaVersion: 1`, `mode: "snapshot"`, `exportedAt` w UTC.
- `range.from/to`: dzień lokalny `YYYY-MM-DD` albo `null`; granice włączne.
  Filtrowanie według daty rekordu, nie dnia wyliczonego z UTC rozpoczęcia sesji.
  Odwrócone/nieprawidłowe daty są błędem. Pełny zakres ma limit 36601 dni.
- `dailyNutrition`: ID = data, sumy kcal/B/T/W z zapisanych wpisów, liczba wpisów
  i rodzajów posiłków, cel obowiązujący tego dnia. Dwa podane końce zakresu
  generują także dni bez wpisów: `hasEntries: false`, sumy `null`. Przy zakresie
  otwartym eksport obejmuje tylko dni z wpisami. Zero pozostaje zerem i nie oznacza
  braku danych. Dzień z wpisami nie jest deklaracją kompletnego dziennika dnia.
- `foodEntries`: oryginalne ID, data, czas utworzenia, posiłek, ilość/jednostka,
  ID/nazwa produktu lub przepisu, wersja przepisu i opcjonalne ID wariantu.
  `enteredAmount/enteredUnit` zachowują także miarę domową (np. 2 sztuki), a
  `amount/unit` jej zapisany przelicznik bazowy (np. 14 g). `portionConversion`
  zachowuje źródło/pewność i ewentualne oznaczenie szacowania, bez opisów użytkownika.
  Makro oznacza całe zapisane spożycie, nie wartości na 100 g. Nigdy nie odczytuje
  aktualnych przepisów/produktów, nie przelicza historii ani g↔ml.
- `nutritionGoals`: okresy przecinające zakres, w tym cel rozpoczęty wcześniej.
  `effectiveTo` jest ostatnim dniem przed kolejnym okresem albo `null`. Koniec
  wyliczany z pełnej historii, nie tylko eksportowanej części. Pusty cel żywieniowy
  zachowany jako reset: wszystkie wartości `null`. Cele masy i obwodów pominięte.
- `completedWorkouts/completedMobility`: wyłącznie zakończone sesje, daty/czasy,
  ID, nazwy i ewentualne powiązanie z kalendarzem. Brak szablonów, aktywnych sesji,
  timerów i subiektywnych ocen. Ćwiczenia i dawkowanie pochodzą ze snapshotu sesji.
- Ćwiczenia zachowują kolejność (pozycje od 0), ID, tryb, liczbę hantli, dawkowanie
  i stronę. Serie: własne ID, kolejność, `work/warmup`, kg, reps, RIR, sekundy,
  kilometry, km/h i nachylenie w procentach; pola nieobecne/nieadekwatne = `null`.
  Kg: `per-dumbbell` albo `additional-load`; brak obciążenia nie jest zgadywany
  jako 0. Mobility przechowuje liczbę wykonanych serii, bez wymyślania serii/ciężarów.
- `measurements`: wyłącznie masa (kg) i obwody (cm), oryginalne ID/data/godzina.
  Niepodane obwody = `null`. Źródło nie przechowuje offsetu, więc
  `utcOffsetMinutes: null`; moduł nie wymyśla strefy czasowej pomiarów.
- `semantics` opisuje jednostki makro, brak danych, pokrycie dzienne i usunięcia.

## Identyfikatory, zmiany i usunięcia

ID źródłowe pozostają niezmienione. Pozycje ćwiczeń nie mają własnych ID w modelu,
więc dodatkowy `key` koduje JSON `[kind, sessionId, position]`, a klucz serii
`[kind, sessionId, position, setId]`. Pozwala to odróżnić powtórzone ćwiczenia i ID
serii użyte w różnych pozycjach. Nie jest to nowy trwały identyfikator ćwiczenia;
przestawienie pozycji zmienia klucze. Przyszła synchronizacja powinna zastępować
snapshot całej sesji albo dodać stabilne ID pozycji w osobnym etapie.

Każde wywołanie odczytuje aktualne dane. Zmieniony rekord ma to samo ID i nowe
wartości. Usunięty rekord znika. Ten etap NIE tworzy tombstone, kolejki, hashy,
rewizji ani listy operacji. Brak rekordu w innym zakresie dat nie dowodzi usunięcia.
Eksport nie stanowi gotowego bezpiecznego protokołu aktualizacji arkusza.

## Prywatność i błędy

Jawne listy dozwolonych pól zamiast kopiowania całych obiektów. Nie eksportuje
zdjęć, sesji zdjęciowych, ciśnienia/tętna, notatek (także physioNote), ocen
samopoczucia, credentials, sekretów, ustawień i dowolnych dodatkowych metadanych.
Nazwy produktów, przepisów, ćwiczeń i sesji są celowo zachowane; użytkownik może
sam umieścić prywatny tekst w nazwie — moduł nie klasyfikuje jego treści.

Korzysta z istniejących walidatorów. Nieprawidłowe wymagane dane, zduplikowane ID,
uszkodzony JSON oraz błędy dostępu do magazynu przerywają cały eksport. Nie zwraca
pozornie kompletnego pustego wyniku po awarii. Ciśnienie jest odrzucane przed
projekcją. Puste kolekcje są poprawne, brak wymaganej kolekcji nie jest poprawny.

Odczyt localStorage i różnych baz nie jest wspólną transakcją. Wywołujący powinien
zakończyć oczekujące zapisy i nie edytować danych podczas zbierania eksportu.
Spójność między równoczesnymi zmianami/kartami wymaga kolejnego etapu.

## Testy

`node --test sync-export.test.js` — syntetyczne modele, dane brakujące i zerowe,
cele historyczne, zakresy, niezmienność historii, zmiany/usunięcia, walidacja,
prywatność, identyfikatory i adapter tylko do odczytu.

`node --test sync-export.browser.test.js` — realne localStorage/IndexedDB w osobnym
profilu Chromium, import modułu dopiero offline z produkcyjnego app shell,
wykluczenie ciśnienia/notatek i niezmienność zapisanych danych.

Oba zestawy włączone do istniejących `npm test` i `npm run test:browser`.
