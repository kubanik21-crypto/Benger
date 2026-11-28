# Kontrakt importu planów treningowych — v1 / etap 5B

**Status: zaakceptowany kontrakt; lokalny importer wdrożony na gałęzi testowej w 5B.** Implementacja, granice i instrukcja dla czatu Treningi: [training-plan-import-5b.md](training-plan-import-5b.md). Integracja Google Sheets treningów pozostaje przyszłym etapem. Przykłady nie są indywidualnym planem użytkownika. Audyt: [training-integration-audit.md](training-integration-audit.md). Formalna struktura: [training-plan-import.schema.json](training-plan-import.schema.json). Katalog: [training-exercise-catalog-spec.md](training-exercise-catalog-spec.md).

## 1. Zakres v1 i granice modeli

Jedna publikacja = kompletny snapshot **jednego skończonego bloku** z listą konkretnych dat. Jednostka oznacza zaplanowany trening/Mobility, nie sesję wykonaną. Nie ma statusu completed, rzeczywistych set IDs, ukończonych ciężarów ani timestampów wykonania.

W v1 wybieramy daty, korzystając z istniejących reguł once. To spełnia wariant „data lub reguła harmonogramu”, bez problemu niestabilnego ruleId@date i nieskończonego weekly. Obecny kalendarz Bengera nadal obsługuje ręczne weekly. ChatGPT może rozwinąć powtarzający się szablon do dat w skończonym bloku, nadając każdej jednostce stabilne ID. Wariant importowania reguł zewnętrznych wymaga osobnej capability i jawnych IDs wystąpień, nie zostaje domyślnie włączony w v1.

Kontrakt opisuje także planowane cele, których dziś nie przechowuje dosage. Pełna obsługa wymaga warstwy metadanych i minimum UI w 5B/5C. Przejście JSON Schema **nie oznacza**, że aplikacja 1.0.24 już potrafi przyjąć pakiet. Nie wolno implementować importu przez obcięcie pól do dotychczasowego validateTemplate.

## 2. Pola główne

Wszystkie pola główne są wymagane; nieużywane kolekcje są puste. Struktury zamknięte: dodatkowe nieznane pola są błędem. ID zewnętrzne i namespace: `[A-Za-z0-9][A-Za-z0-9._-]{0,79}`. Wersje: integer 1…1000000.

| Pole | Znaczenie |
|---|---|
| format | Dokładnie `benger.training-plan` |
| schemaVersion | 1 — format, nie wersja bloku |
| namespace | Stała tożsamość wydawcy, np. `example-training`; nie zmieniać co miesiąc |
| packageId | Niepowtarzalna, niezmienna publikacja; ten sam ID wymaga tych samych bajtów |
| createdAt | Data utworzenia pakietu UTC ISO z T i Z, opcjonalnie 1–3 cyfry milisekund |
| label | Etykieta publikacji, do 200 znaków |
| catalogRevision | sha256:… publicznego katalogu użytego przez autora; wskazówka kompatybilności, nie tożsamość ćwiczenia |
| requiredCapabilities | Zawsze training-core-v1 i planned-targets-v1; inne wymagania muszą być obsługiwane przez klienta albo blokują import |
| block | Stabilny opis bloku i jego rewizja |
| exerciseDefinitions | Potrzebne, wersjonowane definicje nowych ćwiczeń wydawcy; pusta lista dla samych builtin |
| sessions | 1…128 zaplanowanych jednostek, każda z konkretną datą |
| extensions | Maks. 10 nazwanych `x-…` pól tekstowych do 500 znaków, wyłącznie nieistotne etykiety/opisy |

Extensions nie mogą ukrywać dawkowania, obciążenia, tożsamości lub poleceń. Zmiana wpływająca na wykonanie wymaga rozpoznawanego pola i capability lub nowego schemaVersion. Tekst jest danymi do bezpiecznego wyświetlenia; nie wolno go wykonywać ani traktować jako instrukcji autoryzacji aplikacji.

Limit pliku: 2 MiB UTF-8, z góry ograniczona głębokość (zalecenie 20) oraz odrzucenie __proto__/constructor/prototype na każdym poziomie. JSON bez NaN, Infinity i duplikatów nazw właściwości; planowany parser ma je wykrywać, nie polegać na cichym last-wins JSON.parse. Weryfikator dokumentacji nie jest implementacją tego bezpiecznego parsera aplikacji.

## 3. Blok

`{id,version,name,from,to,timeZone,weekCount,goal,description,progression,deloadWeeks}`.

Daty YYYY-MM-DD są datami cywilnymi, obie granice włącznie. Maksymalnie 112 dni i 16 tygodni kalendarzowych ISO dotkniętych zakresem. weekCount liczymy od poniedziałku tygodnia zawierającego from do poniedziałku tygodnia zawierającego to. Przykładowy cały grudzień 2026 to **5** tygodni, nie sztucznie 4. deloadWeeks: unikalne numery 1…weekCount, bez automatycznego mnożenia lub zmniejszania serii. Źródło publikuje już konkretne docelowe sets.

Cel i progresja mogą być null. description do 2000 znaków. timeZone wskazuje strefę autora (przykłady Europe/Warsaw); daty nie podlegają konwersji przez timestamp UTC. Jeżeli strefa urządzenia jest inna, pokazać ostrzeżenie i wymagać uzgodnienia czasu przypomnień; nie zmieniać historii ani dat wykonania. IANA timeZone musi przejść walidację semantyczną (sam regex schematu nie wystarczy).

## 4. Jednostka i elementy

Jednostka:

| Pole | Znaczenie |
|---|---|
| id, version | Stabilna jednostka w bloku, rewizja jej treści; ID niezależne od daty |
| name | Nazwa do 160 znaków |
| date, time | Konkretna data w bloku; time HH:mm lub null |
| kind | workout lub mobility, jak w istniejącym modelu |
| purpose | strength, cardio, mobility, rehabilitation lub warmup; opis celu, nie trzeci typ sesji |
| goal | Opcjonalny opis celu lub null |
| estimatedDurationSeconds | Szacowany czas dodatni lub null; nie rzeczywisty czas sesji |
| instructions | Instrukcje do 2000 znaków |
| items | Uporządkowana lista 1…100 elementów |

ID jednostek unikalne w bloku. ID elementów unikalne **w jednostce**. Powtórzenie tego samego ćwiczenia w dwóch różnych elementach jest dozwolone, np. rozgrzewka i serie robocze. Kolejność listy jest znacząca; nie sortować jej po nazwie. Element ma `{id,exercise,phase,setKind,prescription}`.

- phase: warmup/main/cooldown.
- setKind: warmup/work dla workout; null dla mobility, które ma licznik completedSets, a nie rzeczywiste serie work/warmup.
- Jedno prescription oznacza jednorodną grupę sets. Inne obciążenie, zakres lub rodzaj serii oznacza osobny element z innym ID. Nie tworzymy tablicy wykonanych serii podczas importu.
- Mobility nie może zostać ukryte w workout, bo obecny walidator tego nie obsługuje. Rozgrzewkę Mobility można opublikować jako oddzielną jednostkę kind=mobility, purpose=warmup przed jednostką workout. Cardio w workout, np. bieżnia, jest już wspierane.

### Prescription

Wymagane są jawne pola (null oznacza nieokreślone):

| Pole | Jednostka / znaczenie |
|---|---|
| sets | Integer 1…100, planowana liczba; nie wykonanie |
| repsMin, repsMax | Integer 1…1000 lub null; min <= max gdy oba podane |
| durationSeconds | 1…86400 lub null |
| restSeconds | Integer 0…3600 lub null; **0 = jawnie bez przerwy**, null = nie określono |
| side | left, right, both; both nie podwaja automatycznie objętości |
| targetRir | 0…10 lub null; cel, nie zapis rzeczywistego RIR |
| targetRpe | 1…10 lub null; nie przeliczać na RIR |
| load | null lub `{value,unit,basis}`; tylko kg; 0 jest jawnie zerowym obciążeniem |
| tempo | null lub cztery fazy np. 3-1-X-0; sekundy, X = intencja dynamicznego ruchu; informacja planistyczna |
| technique | Wskazówki do 2000 znaków |
| alternatives | Maks. 5 jawnych referencji ćwiczeń; wybór użytkownika, nie automatyczna zamiana |
| progression | Opis lub null; brak automatycznego dokładania ciężaru |
| cardio | null lub jawny zestaw celów cardio |

Basis: per-dumbbell = masa jednego hantla, additional-load = dodatkowe obciążenie masy ciała, total-load = łączny ciężar (rezerwacja dla późniejszej capability). Nie mnożyć kilogramów dwóch hantli podczas importu do pola jednego hantla. Bieżący profil wykonania: strength 0…40 kg/hantel; bodyweight dodatkowe 0…200 kg; time/cardio/mobility bez osobnego zapisu kg. Wyższy ciężar, sztanga, maszyna lub obciążony carry nie mogą być „naprawione” clampem lub udawaniem hantli.

Schema dopuszcza większy zakres wartości i sprzęt przyszłych capabilities, aby opisać rozszerzenia. To **nie upoważnia** MVP do ich wykonania. Pakiet z nieobsługiwanym pomiarem jest blokowany z jasną przyczyną. Dla sztang i maszyn potrzebny jest uzgodniony etap modelu, objętości, UI i RAW DATA (`external-load-v1` jako proponowana przyszła capability).

Cardio: distanceKm 0…500, speedKmH 0…50, paceSecondsPerKm 1…86400, inclinePercent -20…50, intensity tekst lub null, heartRateZone 1…5 lub null. Nie podawać jednocześnie prędkości i tempa bez uzgodnionej reguły priorytetu — v1 blokuje tę niejednoznaczność. Nie wyliczać brakującego dystansu z czasu/prędkości ani tętna ze strefy. Obecna realizacja zapisuje czas, dystans, speed/incline; HR i pace są celami planistycznymi do wyświetlenia, bez wymyślonej historii.

Przy projekcji restSeconds=null nie wolno niejawnie wywołać dosage() z pominiętą przerwą i przedstawić 60 s jako plan autora. Zachować null w metadanych. W 5B brak przerwy wyłącza automatyczny timer odpoczynku w projekcji wykonawczej, a UI jawnie pokazuje nieokreślony cel. Użytkownik może ustawić lokalną preferencję przerwy w dotychczasowym formularzu sesji; nie zmienia to źródłowego null. Podobnie ewentualna podpowiedź poprzedniego kg w formularzu jest preferencją wykonania, nie brakującym celem źródła.

## 5. Ćwiczenia i wersje definicji

Referencja builtin: `{builtinId,expectedMode,expectedDumbbells}`; referencja wydawcy: `{externalId,version,expectedMode,expectedDumbbells}`. Prefiks builtin i źródłowy externalId nie są wymienne. Zgodność sprawdzamy po ID i sygnaturze pomiaru, nie po podobnej nazwie.

exerciseDefinitions zawiera `{id,version,names:{pl,en},category,mode,dumbbells,equipment,technique}`. EN może być null. Wszystkie referencje zewnętrzne wymagają dokładnej definicji w pakiecie. Dozwolone są różne wersje tego samego id; para **(id,version)** jest unikalna. Pełny snapshot musi zawierać także starszą definicję, jeżeli nadal odwołuje się do niej chroniona jednostka. Nie polegamy na tym, że urządzenie „na pewno ma” poprzedni pakiet.

Lokalne ID ćwiczenia jest stabilne dla namespace+externalId, aby nie dzielić analizy postępu po każdej korekcie nazwy. Wersjonowane definicje są archiwizowane w metadanych. Start importowanej jednostki musi użyć **przypiętej, rozstrzygniętej definicji**, a nie przypadkowo najnowszej pozycji katalogu odczytanej przez dzisiejsze repository.start. To konieczna, wąska adaptacja punktu startu w 5B; bez niej nie ma pełnej gwarancji pinowania wersji. Rzeczywisty snapshot po starcie dalej jest samowystarczalny.

Zmiana mode, liczby hantli lub basis pomiaru wymaga nowego externalId, a nie tylko version++. Własne istniejące ćwiczenie użytkownika nie staje się własnością wydawcy po ręcznym dopasowaniu; nie nadpisywać jego nazwy/instrukcji bez rozstrzygnięcia.

## 6. Walidacja warstwowa i integralność

1. Sprawdzić limit bajtów i parser JSON; nie dotykać bazy.
2. Zweryfikować schemaVersion, wszystkie właściwości i formaty wg JSON Schema.
3. Zweryfikować wymagane capabilities; nieznana wymagana capability blokuje cały pakiet.
4. Daty/strefa, kolejność granic, liczba tygodni, deload, wszystkie daty jednostek w bloku; unikalne IDs oraz pary wersji.
5. Rozwiązać wszystkie exercise refs i alternatives; sprawdzić rodzaj sesji, setKind, sprzęt, limity miar, zgodność mode/dumbbells/basis, rep range i cardio. Brak ćwiczenia wstrzymuje pakiet, nie usuwa tylko tego elementu.
6. Sprawdzić wersje i niezmienność zaakceptowanych tożsamości, limity całej bazy oraz konflikty lokalne/aktywne/historii.
7. Przygotować niezmienny preview z bazową rewizją i hashem. Ponownie sprawdzić bazę i binding przed atomowym zatwierdzeniem.

Dla publikacji SHA-256 liczymy z **dokładnych bajtów UTF-8 po połączeniu fragmentów JSON**. Nie liczymy sumy z już przeformatowanego obiektu i nie osadzamy samoodnoszącego się hasha w treści. Manifest lub sidecar `.sha256` jest poza JSON-em. Hash nie jest podpisem autora.

Dla porównywania treści encji użyć kanonizacji `canonicalImport` (sortowanie kluczy obiektów, zachowanie kolejności tablic) i SHA-256. Digest treści bloku obejmuje block, sessions, exerciseDefinitions, label, requiredCapabilities i extensions. Wyłącza packageId, createdAt oraz pomocniczą catalogRevision. Digest pojedynczej jednostki obejmuje całą jej treść, w tym datę, kolejność i wersję. Same metadane ponownej publikacji nie wymuszają nowej wersji niezmienionych jednostek.

## 7. Wersjonowanie i uzgadnianie

Tożsamość bloku: `(namespace, block.id)`. Tożsamość jednostki: `(namespace, block.id, session.id)` — **bez daty**. Ćwiczenie: builtinId albo `(namespace, externalId)` z osobną wersją definicji. Pozycja planowana: unitKey+item.id. ID rzeczywistych sesji i serii pozostają lokalne, tworzone dopiero przy realizacji.

| Zdarzenie | Zachowanie |
|---|---|
| Nowy blok | Całościowa walidacja i preview, atomowe dodanie tylko planistycznych danych |
| Ten sam packageId i raw SHA | No-op, bez nowego ćwiczenia, planu ani wykonania |
| Ten sam packageId, inny SHA | Konflikt publikacji, blokada |
| Ta sama wersja encji i ta sama treść | No-op; nowy package receipt nie jest nową jednostką |
| Ta sama wersja, inna treść | Odrzucenie; wydawca musi zwiększyć version |
| Starsza wersja | Ignorowanie jako stara/odrzucenie downgrade, nigdy rollback |
| Przesunięcie daty | Zachować session.id, zwiększyć jej version i block.version; przenieść tylko przyszłą nierozpoczętą jednostkę |
| Inne dawkowanie lub ćwiczenie | Te same reguły; zachować item.id, jeśli to ta sama pozycja planu, a zamiana jest jawna |
| Nowa jednostka | Nowy session.id, wersja 1, większa block.version |
| Brak przyszłej jednostki w nowym pełnym bloku | Kandydat wycofania tylko importowanej jednostki tego samego bloku; wymaga kompletnego wiarygodnego snapshotu i braku lokalnego konfliktu |
| Nowy tydzień | Publikować nową wersję całego bloku; nie listę zmian udającą kompletny miesiąc |
| DRAFT, zły hash, brak fragmentu/ref | Zero zmian, zero usunięć i brak fałszywego success receipt |

Wybór rewizji opiera się na integer version i hashu, nie na samym published_at. Lokalne createdAt reguły pozostaje niezmienione, updatedAt opisuje lokalne zastosowanie zmiany i musi być monotoniczne względem createdAt. Nie podstawiać daty publikacji za czas startu lub wykonania sesji.

Wycofanie jednostki to brak planu przyszłego, nie usunięcie jej ukończonej sesji. Brak bloku w odczycie zakładki ani skasowana publikacja nie oznaczają usunięcia całego lokalnego bloku. V1 wymaga przynajmniej jednej jednostki: automatyczne wycofanie ostatniej jednostki/całego bloku wymagałoby odrębnej jawnej operacji anulowania i pozostaje poza MVP. Do tego czasu użytkownik może ręcznie zakończyć plan; pusty snapshot nie zastępuje takiej operacji. Nowy namespace nie przejmuje rekordów poprzedniego wydawcy.

**Chronione:** activeWorkout/activeMobility, ukończone sesje, ich ćwiczenia/serie/kg/reps/RIR/notatki oraz timer. Przeszłe daty planu są archiwalnym opisem źródła, nie przedmiotem automatycznego przepisywania. Zmiany dzisiejszej nierozpoczętej jednostki wymagają preview; auto-aktualizacja dotyczy czysto przyszłych dat. Po aktualizacji nie wolno eksportować nowej wersji planu jako korekty dawnego wykonania.

## 8. Lokalne zmiany i częściowe zastosowanie rewizji

Uzgadniać **B** = ostatni zaakceptowany stan źródłowy/projekcja, **L** = bieżący lokalny stan z overrides, **R** = nowa rewizja źródła.

- L=B, R zmienione: kandydat aktualizacji przyszłej jednostki.
- R=B, L zmienione: zachować lokalną zmianę, nie „naprawiać” jej ponownym importem.
- L i R zmienione: preview trójstronny; MVP nie scala automatycznie konfliktów dotyczących ćwiczenia, daty, miar lub dawkowania. Bezpieczne rozłączne zmiany też pokazujemy w pierwszej wersji.
- Lokalnie usunięty plan lub pominięcie ma trwały tombstone/override. Obecny Smart Sync journal nie obsługuje intencji usuwania szablonów; trzeba dodać zapis tego zamiaru w tej samej transakcji planistycznej. Nie utożsamiać każdego braku rekordu z intencją użytkownika.
- Jednostka aktywna/wykonana zatrzymuje swoją zaakceptowaną wersję i przypięte cele. Propozycja dotycząca jej zmian jest pominięta jako chroniona lub czeka na uzgodnienie, nigdy nie jest wykonana w historii.

Stan importu musi rozróżniać receivedBlockVersion, appliedVersionPerSession, archivedProtectedVersions i pending. Można atomowo zastosować bezkonfliktowe przyszłe jednostki oraz zapisać listę konfliktów, ale **nie oznaczyć całego bloku jako w pełni zaktualizowanego**, jeśli część pozostaje przy starszej wersji. Receipt odróżnia odczyt/zweryfikowanie od zastosowania. Wszystkie decyzje i wynik stosowania jednego preview zapisują się atomowo; błąd transakcji nie zostawia połowy zmian.

## 9. Google Sheets — projekt na późniejszy etap

Rekomendacja: prywatny, osobny skoroszyt **Benger – Training Plans**, wybierany raz przez istniejący system-browser Google Picker. Zakładka **BENGER_TRAINING_PLANS**. To trzecie, odrębne powiązanie obok RAW DATA i źródła żywieniowego; nie nadpisywać żadnego z nich.

OAuth pozostaje **drive.file**, bez nowego backendu, płatnych usług i sekretów w JS. Samo włączenie API nie daje dostępu do dowolnego istniejącego arkusza: wybrany plik musi być przyznany aplikacji przez Picker. Użyć tego samego projektu OAuth/Picker i natywnego zarządzania tokenami; nie kopiować tokenu do localStorage/backupów. Rozłączenie/zmiana konta zatrzymuje odczyt i nie usuwa lokalnych planów.

Nie można wywołać obecnego RecipeSourceProtocol z dowolnym ID/tabem: ma stały SOURCE_ID, ogranicza TAB do BENGER_IMPORT/BENGER_MEAL_PLAN, a endpoint/Picker i allowlista URL też są przypięte. Wymagany jest typowany adapter źródła treningowego i osobna przestrzeń ustawień, np. training-plan-source-v1. Można wyodrębnić testowany mechanizm odczytu/chunk/hash/lease, pozostawiając dotychczasowe ograniczenia źródła żywieniowego. Nie poluzować globalnie jego walidatora.

### Kolumny A:N

| Kolumna | Nagłówek | MANIFEST | CHUNK |
|---|---|---|---|
| A | schema_version | 1 | 1 |
| B | package_id | packageId JSON | ten sam |
| C | record_type | MANIFEST | CHUNK |
| D | status | DRAFT / READY | puste |
| E | published_at | UTC ISO, nie wcześniej niż createdAt | puste |
| F | block_from | block.from | puste |
| G | block_to | block.to | puste |
| H | namespace | namespace JSON | puste |
| I | label | label JSON | puste |
| J | session_count | sessions.length, 1…128 | puste |
| K | chunk_count | 1…210 | puste |
| L | chunk_index | puste | integer 1…chunk_count |
| M | payload_json | puste | fragment dokładnego tekstu JSON |
| N | content_sha256 | wymagany lowercase SHA-256 | puste |

Jeden MANIFEST, dokładnie zadeklarowane unikalne CHUNK, żadnych nieznanych wierszy lub nadmiarowych niepustych kolumn. Maks. 20000 **jednostek UTF-16** na fragment, bez rozcięcia pary surogatów; SHA po UTF-8 całej treści. Nie stosować ogólnego limitu stringValue RAW DATA 5000 do payloadu. Zapas transportu: max 3000 wierszy, 20 publikacji i 256 CHUNK READY, łącznie 4 MiB treści READY; odczyt natywny odpowiednio ograniczony, np. 8 MiB odpowiedzi. Przekroczenie granicy blokuje odczyt, nie obcina rekordów.

Wszystkie sumy i metadane weryfikować ponownie wobec połączonego JSON. Nie przenosić limitu tygodnia 7 dni/50 przepisów z importu żywieniowego. Miesięczny blok jest innym kontraktem. Statusy/liczby to rzeczywiste literały, bez formuł i wartości bool w komórkach publikacji.

### Publikowanie i odczyt

1. ChatGPT przygotowuje pełny JSON, sprawdza katalog, schemat i semantykę. Zmiany wydaje pod nowym packageId i właściwymi wersjami.
2. Publikacja jako DRAFT, wszystkie fragmenty, count i hash. Sprawdzenie odtworzenia tekstu oraz wszystkich wymaganych referencji. **READY ustawiane na końcu.** Nie edytować gotowego pakietu in-place.
3. Aplikacja odczytuje metadane, potrzebne payloady i ponownie metadane; zmiana publikacji podczas odczytu wstrzymuje import. DRAFT nie może powodować wycofań lokalnych danych.
4. Preview → atomowe stosowanie i receipt. UI podaje dodania, aktualizacje, przesunięcia, wycofania i zachowane lokalne/chronione jednostki, bez technicznych ID w głównym widoku.
5. Po ręcznym odbiorze opcjonalna automatyzacja default off: sprawdzanie przy starcie/resume i np. co 30 min podczas aktywnego używania, z backoff. Brak odczytu co 1,5 s i brak WorkManagera. Nowe kompletne bezkonfliktowe przyszłe jednostki mogą być importowane po włączeniu opcji; konflikty nadal wymagają preview.

Nie tworzono jeszcze skoroszytu, zakładki, bindingu ani konfiguracji Google. Benger **nie zapisuje planów do RAW DATA**. Wydawca ChatGPT/Treningi publikuje w źródle dopiero po późniejszym upoważnieniu; niniejszy dokument nie uruchamia żadnych zapisów.

## 10. Pliki i instrukcja dla czatu Treningi

[README przykładów](examples/training-plans/README.md) zawiera kompletne poprawne JSON-y, pełny miesiąc, aktualizację jednego tygodnia, Mobility i pakiety błędne. Nie wklejać pełnego backupu ani prywatnej historii w publikację planu.

Instrukcja dla autora:

1. Pobierz aktualny **publiczny katalog**. Używaj dokładnych builtinId i sygnatury pomiaru. Nie zgaduj ID po angielskiej nazwie.
2. Zachowaj namespace, block.id, session.id oraz item.id podczas aktualizacji. Zmiana daty nie oznacza nowego ID jednostki.
3. Nie udawaj sprzętu i pomiaru, których klient nie obsługuje. Zgłoś brak capability; nowe ruchy publikuj jako wersjonowane definicje dopiero po rozwiązaniu dopasowania.
4. Podawaj konkretne daty, kolejność, liczbę serii, jednostki i znane cele. Nieznane parametry jako null. Nie wpisuj 0 zamiast braku ciężaru lub przerwy.
5. Aktualizując tydzień, wyślij ponownie kompletny blok; zwiększ block.version oraz version wyłącznie zmienionych jednostek/definicji. Nie usuwaj wcześniejszych jednostek z pakietu jako skrótu.
6. Nie publikuj wykonania ani dopisywanych „zrobionych” serii. Benger zapisuje je dopiero po świadomym działaniu użytkownika.
7. Waliduj schemat i semantykę, następnie MANIFEST/CHUNK i SHA-256. Trzymaj publikację w DRAFT do zakończenia. Zmieniony READY wymaga nowego pakietu, nie nadpisania treści pod tym samym ID.
8. Na etapie 5A używaj przykładów wyłącznie do testów dokumentacji; nie publikuj ich w rzeczywistym arkuszu użytkownika.
