# Etap 3A — lokalny plan Benger → Google Sheets

Stan: mapper, uzgadnianie i szkic atomowego żądania. **Bez OAuth, Google API,
żadnego transportu, wykonania żądania, synchronizacji w tle ani zmian backupu.**
Priorytetem przyszłego klienta jest Android; logika nie zależy od platformy.
Arkusz docelowy: prywatny **Benger – RAW DATA**. Schemat arkusza: **1**;
obsługiwany schemat eksportu: **1**, bez zmian w samym eksporterze.

## Moduły i API

- `sheets-mapper.js`: ścisła walidacja pełnego eksportu, kanoniczne klucze,
  schematy kolumn i mapowanie na osiem tabel.
- `sheets-reconcile.js`: czysty planner, ochrona zakresu/właściciela/baseline,
  potwierdzenia, batchUpdate i weryfikacja zaobserwowanego wyniku.
- `sheets-plan-ui.js`: lokalna symulacja w Ustawieniach → Synchronizacja danych →
  „Google Sheets — lokalny podgląd planu”. Żadnego trwałego duplikowania bazy.

```js
// Wywołujący kończy oczekujące zapisy i czyta CAŁĄ lokalną bazę istniejącym adapterem.
const fullExport = await readLocalSyncExport(existingStores, {});
const plan = await prepareSheetsPlan({
  fullExport, current, baseline, profileId, deviceId,
  range: {from: '2026-11-01', to: '2026-11-30'},
  initialize: false,
});
// Najpierw pokaż changes, outsideChanges i blockers użytkownikowi.
// Po świadomym potwierdzeniu ponownie przygotuj plan ze ŚWIEŻYM fullExport:
const confirmed = await prepareSheetsPlan({
  fullExport, current, baseline, profileId, deviceId, range,
  confirmDeletionDigest: plan.deletionDigest,
  confirmImpactDigest: plan.impactDigest,
});
const prepared = await prepareSheetsBatchUpdate(confirmed, current);
// prepared.body to szkic spreadsheets.batchUpdate; tutaj NIE ma wywołania API.
// Przyszły transport musi ponownie odczytać stan i sprawdzić expectedBaseHash
// bezpośrednio przed wysłaniem; samo zapisanie body nie daje gwarancji aktualności.
// Po zapisie/timeout odczyt całego wyniku, następnie:
const nextBaseline = await acknowledgeSheetsPlan(confirmed, observedState);
```

`emptySheetsState(spreadsheetId)` służy lokalnym testom pierwszej inicjalizacji.
Wymaga jawnego `initialize: true` i braku danych danego profilu. Używa demonstracyjnych
sheetId 9100–9107. Przyszły adapter musi pobrać prawdziwe ID istniejących zakładek
oraz wybrać wolne ID dla tworzonych tabel na podstawie całych metadanych skoroszytu.
Nie wolno traktować nazwy arkusza jako identyfikatora ani dowodu uprawnień.

## Schemat zakładek

Każdy wiersz zaczyna się od `key`, `profileId`, `recordId`, `date`.
Dokładna, zamrożona lista kolumn jest w `SHEET_COLUMNS`.

| Zakładka | Wiersz / najważniejsze pola |
|---|---|
| Dziennik żywieniowy | Dzień; hasEntries, entryCount, mealCount, kcal/protein/fat/carbs, goalId i goal_* |
| Posiłki | Wpis; oryginalne ID, data utworzenia, rodzaj posiłku, pochodzenie produktu/przepisu, wersja i wariant, amount/unit oraz enteredAmount/enteredUnit, źródło/pewność konwersji, zapisane kcal/B/T/W |
| Treningi | Ukończona sesja; nazwa, startedAt/completedAt, powiązanie z kalendarzem, exerciseCount/setCount |
| Serie | rowType exercise lub set; ID/pozycja ćwiczenia, oryginalny setId, rodzaj work/warmup, kg, reps, RIR, loadBasis, hantle, strona, sekundy, km, km/h, nachylenie %, zalecenia |
| Mobility | rowType session lub exercise; ID sesji/ćwiczenia, kolejność, plannedSets/completedSets, strona, powtórzenia/czas/odpoczynek, powiązanie z kalendarzem |
| Pomiary | Masa kg i obwody cm; ID, data, godzina, utcOffsetMinutes=null, typ i osobne kolumny obwodów |
| Cele | Pełna historia okresów żywieniowych; effectiveFrom/effectiveTo i kcal/B/T/W, także reset celów |
| Synchronizacja | Jeden ostatni status profilu; writerDeviceId, wersje schematów, operationId, status, exportedAt, zakres i liczby rekordów |

W „Serie” osobny wiersz ćwiczenia zachowuje także ćwiczenia bez zapisanej serii.
Licznik `Synchronizacja.sets` zlicza wyłącznie rowType=set, nie wiersze ćwiczeń.
Mobility zachowuje liczbę wykonań, bez wymyślania indywidualnych serii.

Klucze kodują JSON `[profileId, typ, oryginalne ID]`, bez separatorów mogących
powodować kolizje. Dla pozycji/serii używane są istniejące złożone klucze eksportu
z ID sesji, pozycją i ID serii. Reorganizacja pozycji jest zmianą całego snapshotu
sesji, nie identyfikacją tego samego ćwiczenia po nazwie. Zachowane są także
oryginalne exerciseId, setId i kolejność.

`null` jest pustą komórką; 0/false pozostają liczbą/booleanem. Nie zamieniamy
brakującego ciężaru/RIR na zero, nie przeliczamy g↔ml. Kg przy hantlach oznacza
jeden hantel, a przy masie ciała dodatkowy ciężar. Podsumowania sumują zapisane
wartości wpisów, nigdy bieżący przepis lub bieżącą kartę produktu.
Nie eksportuje notatek, zdjęć, ciśnienia, tętna i ustawień uwierzytelniania.
Nazwy pozostają nazwami — nie próbujemy klasyfikować ich prywatności.

## Pełny odczyt i zakres

Planner nie przyjmuje ograniczonego eksportu JSON jako dowodu kompletności bazy.
Wymaga istniejącego eksportu full (`from:null`, `to:null`), wszystkich kolekcji,
znanej semantyki, unikalnych ID i zgodności podsumowań z wpisami/celami.
Waliduje także dawkowanie, serie, jednostki, proweniencję, pomiary i historię celów.
Niekompletny/nieprawidłowy input przerywa całą operację — nie powstaje batch.

Przed pierwszym await kopiuje dane wejściowe. Nie zapisuje ani nie zmienia źródeł.
Eksporter nadal nie ma wspólnej transakcji między bazami: klient musi zakończyć
oczekujące zapisy i odrzucić plan, jeśli dane zmieniły się podczas odczytu.
UI śledzi rewizję zdarzeń zmian i odrzuca taki podgląd.

Żywienie, treningi, Mobility i pomiary są uzgadniane w zakresie włącznie od–do.
Dane spoza zakresu oraz inne profile są zachowane. Jeśli znane ID przeniesiono
przez granicę zakresu, aktualizujemy ten sam rekord na podstawie pełnego odczytu;
nie traktujemy go jako usuniętego. Dzienne sumy obu dotkniętych dat powstają z
uzgodnionych wpisów arkusza, więc nie wciągają niezwiązanych lokalnych zmian
spoza zakresu. Taki wpływ wymaga osobnego potwierdzenia.

Trening i Mobility są grupą: wymiana sesji obejmuje wszystkie jej dzieci,
usunięte serie/pozycje znikają, przeniesione dostają tę samą datę co sesja.
Niekompletne grupy w odczycie arkusza nie mogą stać się baseline.

Cele zawsze uzgadniamy z pełnej historii. Dla dawnych podsumowań poza zakresem
zmieniamy tylko goalId/goal_*, zachowując zapisane kcal, makro i liczniki.
`outsideChanges` wskazuje dotknięte daty; bez potwierdzenia nie ma batchUpdate.

## Bezpieczeństwo i potwierdzenia

`baseline` jest potwierdzonym punktem odniesienia: wersja, spreadsheetId,
profileId, deviceId, hash całego zarządzanego stanu i inwentarz kluczy/daty/typy
poprzedniego pełnego źródła. Nie zawiera kopii posiłków czy notatek.
W tej fazie nie zapisujemy go trwale. Przyszły klient musi przechowywać go lokalnie
w powiązaniu z konkretną instalacją i nie odtwarzać automatycznie na innym urządzeniu.

- Brak baseline dla niepustego profilu blokuje wszystkie zapisy, nawet initialize.
- Inny deviceId, inny arkusz, zmiana po stronie arkusza lub nieznany schemat blokują
  plan. Baseline nie może być samym aktualnym stanem świeżo odczytanym z Google.
- Każde usunięcie wymaga `confirmDeletionDigest` z dokładnego podglądu.
- Zmiany poza zakresem wymagają `confirmImpactDigest`. Oba hashe są związane ze
  stanem bazowym, zawartością pełnego źródła i zakresem. Zmiana danych je unieważnia.
- Brak wcześniej znanych rekordów lokalnych spoza zakresu blokuje operację:
  trzeba poszerzyć zakres albo sprawdzić/odtworzyć bazę.
- Utrata ponad **25%** pierwotnych rekordów (posiłki, sesje, Mobility, pomiary, cele)
  blokuje zapis nawet po zaznaczeniu potwierdzeń. To konserwatywna heurystyka,
  nie automatyczny dowód utraty danych. Celowe duże kasowanie wymaga przyszłego
  osobnego procesu odzyskiwania/zmiany źródła; nie dodano obejścia tej blokady.
- Nie da się udowodnić kompletności poprawnie sformatowanego, świadomie okrojonego
  pliku JSON na podstawie samego snapshotu. Przyszły klient musi używać zaufanego
  pełnego odczytu lokalnego, nie importowanego pliku, i zachować ciągłość instalacji.
  Mała utrata w środku zakresu wymaga oceny dokładnego podglądu usunięć przez użytkownika.

Przywrócenia starszych wartości przy tych samych ID i liczbie rekordów nie da się
rozpoznać jako przywrócenia z obecnego modelu bez rewizji/journalu. Będą widoczne
jako aktualizacje do oceny w podglądzie. Pierwsza rzeczywista synchronizacja nadal
musi wymagać świadomego zatwierdzenia całego planu, nie tylko usunięć.

Hash integralności planu wykrywa przypadkowe zmiany po podglądzie. Nie jest
podpisem kryptograficznym użytkownika ani mechanizmem uwierzytelniania.

## Atomowy szkic i powtórzenia

`prepareSheetsBatchUpdate` zwraca jeden body spreadsheets.batchUpdate:
addSheet dla brakujących tabel, aktualizację rozmiaru zarządzanych siatek i
updateCells z nagłówkami/danymi dla ośmiu zakładek, w tym statusem operacji.
Puste końcowe wiersze starego zakresu są czyszczone. Obce zakładki nie są dotykane.
Zachowane wiersze poza zakresem też są zawarte w docelowym stanie, nie są usuwane.

Tabele RAW są w całości zarządzane przez Bengera; wymagany pełny odczyt wszystkich
niepustych komórek i dokładne nagłówki. Przyszły adapter musi odrzucać nieznane
kolumny/formuły, brak stron odczytu i konflikty nazw/ID zamiast pomijać je jako puste.
Własne analizy powinny być w osobnych zakładkach i wiązać dane po kluczach, nie po
stałych numerach wierszy (wiersze RAW są porządkowane).

Komórki są jawnie numberValue/boolValue/stringValue. Tekst `=IMPORTXML(...)`
pozostaje tekstem, bez formulaValue. Limit lokalny całego żądania: 1,8 MB.
Większa operacja kończy się błędem; nie dzielimy jej na nieatomowe zapisy.

operationId to SHA-256 zakresu, źródła, czasu przechwycenia, urządzenia, arkusza,
stanu bazowego i docelowych danych. Ponowienie tego samego przygotowanego planu
ma ten sam ID; nowe przechwycenie czasu może mieć nowe ID. Klucze danych nadal
uniemożliwiają dopisywanie duplikatów. Po potwierdzeniu identycznych danych plan
jest noop i nie tworzy żądania. Status `committed` jest częścią proponowanego
atomowego zapisu — w lokalnej symulacji NIE oznacza realnego zapisu do Google.

Po timeout przyszły transport musi odczytać wszystkie zarządzane dane:
zgodny targetHash oznacza alreadyApplied; inny stan blokuje ślepe ponowienie.
`acknowledgeSheetsPlan` sprawdza wynik całej operacji przed zwróceniem nowego baseline.
Częściowy wynik nie jest potwierdzeniem. Stary plan po nowszej zmianie nie przejdzie
kontroli baseHash. Kontrola jest klientowa: Sheets nie oferuje tutaj transakcyjnego
compare-and-swap. Nadal wspieramy tylko jednego zapisującego klienta, bez równoległej
synchronizacji z wielu urządzeń. To nie jest blokada serwerowa.

## Lokalny podgląd

1. Wybierz zakres w istniejącym panelu eksportu.
2. Otwórz „Google Sheets — lokalny podgląd planu” i przygotuj plan.
3. Zobacz liczniki, ID i różnice wartości, wpływ poza zakresem i szkic JSON żądania.
4. „Przyjmij jako lokalny punkt porównania” symuluje wyłącznie zaobserwowany wynik
   w pamięci. Nie zmienia bazy, backupu, daty ostatniego eksportu ani arkusza Google.
5. Zmień dane normalnie w Bengerze i ponownie przygotuj plan. Wskaże zmiany.
6. Dla małego usunięcia/zmiany poza zakresem zaznacz właściwe potwierdzenie i ponów
   przygotowanie. Twardych blokad nie można obejść checkboxami.

Profil `local-profile`, urządzenie `local-session` i arkusz `local-simulation`
służą WYŁĄCZNIE temu laboratorium. Przyszła integracja musi otrzymać prawdziwe,
stabilne identyfikatory. Zamknięcie/reload kasuje punkt porównania symulacji.
Istniejący lokalny eksport JSON i zapis plików działają nadal osobno.

## Testy

`sheets-sync.test.js`: walidacja i mapper, powtórzenia, daty, zakresy, usunięcia,
historia celów, całe grupy sesji, inne profile/urządzenia, zmiany podczas hashowania,
limit żądania, dane zerowe/brakujące, snapshot przepisu, tekst przypominający formułę,
symulacja atomowego zastosowania i częściowego błędu, przypadki generowane.

`sheets-sync.browser.test.js`: UI na realnym localStorage/IndexedDB z syntetycznymi
danymi, offline, brak zapisów Google, brak zmian źródła, potwierdzenia, blokada
niepełnej bazy, symulacja punktu odniesienia, reset po reload i mobile 320–430 px.
Testy są częścią pełnych npm test i npm run test:browser. Nie zastępują testu
rzeczywistego API Google i Samsunga w późniejszym etapie.
