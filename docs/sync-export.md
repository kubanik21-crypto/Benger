# Lokalny eksport do przyszłej synchronizacji — etap 1

Moduł `sync-export.js` przygotowuje obiekt JSON zgodny ze schematem eksportu **1**.
Nie jest backupem i nie zmienia backup schema v8. Nie zapisuje danych, nie wykonuje
żądań sieciowych, nie ma OAuth, kluczy, integracji Sheets, ChatGPT ani Garmin.
Nie wykonuje automatycznej synchronizacji. Interfejs lokalnego eksportu opisuje etap 2 poniżej.

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

## Etap 2 — Ustawienia → Synchronizacja danych

`sync-export-ui.js` dodaje pojedynczy panel w istniejących Ustawieniach. Domyślny
zakres obejmuje ostatnie 30 dni (według lokalnej daty urządzenia). Użytkownik może
wybrać oba końce i użyć „Pokaż podgląd” albo bezpośrednio „Eksportuj JSON”.

Podgląd pokazuje liczby podsumowań dni, dni z wpisami, wpisów, okresów celów,
ukończonych treningów, Mobility, pozycji ćwiczeń, indywidualnych serii treningowych,
pomiarów masy i obwodów. Suma kcal/B/T/W dotyczy wyłącznie zapisanych wpisów;
nie traktuje dni bez wpisów jako zerowego spożycia. Zero zapisane w danych pozostaje
zerem. Liczba serii Mobility jest zachowana w danych ćwiczenia, nie jest mieszana
z indywidualnymi seriami treningowymi. Brak żywności nie blokuje eksportu treningów
lub pomiarów. Całkowicie pusty zakres także można zapisać.

Eksport zawsze zbiera świeży snapshot, nawet jeśli podgląd powstał wcześniej.
Wspólna z backup UI funkcja `beforeDataRead` oczekuje na już trwające zapisy istniejących
modułów. Nie zmieniono sposobu ich zapisu ani samego formatu/mechanizmu backupu.
Zdarzenia zmian danych i edycja zakresu unieważniają widoczny podgląd.
Przyciski i daty są blokowane na czas operacji; drugi tap nie uruchamia kolejnego zapisu.

Android używa istniejącego `saveNativeBackup` / Android SAF z nazwą
`benger-sync-OD-DO.json` (także chunkowanie i obsługa anulowania). Natywna lista
dozwolonych nazw została rozszerzona tylko o ten wzorzec datowanego eksportu;
dotychczasowe nazwy backupów i mechanizm ich zapisu pozostają bez zmian.
Wymagany jest nowy build APK: sama wymiana plików web w starej aplikacji Android
nie rozszerzy natywnej listy dozwolonych nazw. PWA używa tego
samego wzorca co backup: Blob application/json, link download i zwolnienie URL.
Ograniczenie pliku: 64 MiB. PWA potwierdza przekazanie do pobrania, ponieważ nie może
potwierdzić fizycznego zapisu przez przeglądarkę; użytkownik powinien sprawdzić Pobrane.

Jedyna nowa zapisywana informacja to operacyjny czas ostatniego eksportu w oddzielnym
kluczu localStorage `${NUTRITION_STORAGE_KEY}.sync-export.last.v1` — osobnym także dla
preview namespace. Nie zawiera danych eksportu i nie jest dodawana do backupu.
Czas aktualizowany wyłącznie po wyniku saved=true; podgląd, błąd i anulowanie go nie
zmieniają. Błąd zapisu samego czasu nie jest przedstawiany jako utrata zapisanego pliku.
Komunikat wyjaśnia ograniczenie potwierdzenia pobierania w PWA.

Walidacja, błędy pamięci, puste zakresy i nieprawidłowe dane nie powodują usuwania
lub naprawiania źródeł. Podgląd błędnego wyniku jest ukrywany. Wszystkie komunikaty
są tekstem, status ma aria-live, pola mają etykiety. Style używają istniejących paneli,
przycisków i motywów. Moduł UI jest w app shell dostępnym offline.

### Bezpieczny test na telefonie

1. W obecnym Bengerze zapisz pełny backup przez **Więcej → Dane i backup**.
   Sprawdź, że plik faktycznie znajduje się w wybranym folderze. Nie usuwaj aplikacji
   ani jej danych. Nowy JSON synchronizacji nie zastępuje tego backupu.
2. Ten etap nie publikuje produkcji ani APK. Dopiero przygotowany osobno build testowy
   można testować. Najbezpieczniej użyć oddzielnego urządzenia/profilu testowego
   i kopii backupu. Oddzielne preview nie zobaczy automatycznie danych z APK.
3. Jeśli testujesz aktualizację istniejącego APK na swoim profilu, musi mieć ten sam
   appId, origin i zgodny podpis. Instalacja ma być aktualizacją bez odinstalowywania.
   Jeśli Android wymaga usunięcia starej aplikacji, przerwij — nie usuwaj jej.
4. Otwórz **Więcej → Ustawienia → Synchronizacja danych**. Wybierz jeden znany dzień
   i „Pokaż podgląd”. Porównaj sumy z zapisami dziennika oraz ukończonymi sesjami.
   Cele mogą obejmować okres rozpoczęty przed wskazanym dniem; plany bez wykonania
   nie liczą się jako ukończone treningi.
5. Wyeksportuj JSON do wybranego folderu. Sprawdź nazwę i datę ostatniego eksportu.
   Plik zawiera prywatne dane o żywieniu i aktywności — nie udostępniaj go publicznie.
6. Wybierz pusty okres, następnie powtórz test w trybie samolotowym. Eksport powinien
   działać; brak wpisów oznacza null, nie 0 kcal. Na Androidzie anuluj jeden zapis:
   poprzednia data eksportu powinna zostać zachowana.
7. Wróć do dziennika, historii treningów i Progresu. Wpisy, ciężary, pomiary i zdjęcia
   powinny pozostać bez zmian. Nie importuj JSON synchronizacji jako backupu — to
   inny format, a obecny import backupu go nie obsługuje.

Testy automatyczne używają danych syntetycznych w prawdziwym localStorage/IndexedDB
Chromium oraz symulowanego bridge Androida. Nie potwierdzają działania systemowego
wyboru pliku na konkretnym Samsungu ani aktualności bieżącej bazy na telefonie.
Zrzut ekranu testowego panelu powstaje w `/tmp/benger-sync-export-settings.png`;
nie trafia do repozytorium i nie zawiera rzeczywistych danych użytkownika.

## Etap 3A

Lokalny podgląd mapowania i uzgadniania opisuje [Sheets reconciliation](sheets-reconciliation.md).
To nadal symulacja offline, bez autoryzacji Google i wysyłania żądań.

## Etap 3B

Opcjonalne OAuth Android opisuje [Google OAuth Android](google-oauth-android.md).
Domyślnie wyłączone do konfiguracji Google Cloud; nie uruchamia zapisu do Sheets.
