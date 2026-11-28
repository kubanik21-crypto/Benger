# Katalog ćwiczeń dla ChatGPT — propozycja etapu 5A

Gotowy publiczny snapshot: [training-exercise-catalog.json](training-exercise-catalog.json). Zawiera **60** builtinów z training-library.js w bazie 5b51a0b. To dane statyczne kodu; nie odczytano prywatnej bazy użytkownika. Nie zawiera notatek, historii, ciężarów użytkownika, rutyn fizjoterapeuty ani 22 własnych definicji z presetu listopadowego.

## Format

| Pole | Znaczenie |
|---|---|
| schemaVersion | 1 — format katalogu |
| catalogId | benger-public-builtins |
| revision | sha256:… kanonicznej tablicy exercises |
| sourceCommit | Baza kodu użyta do utworzenia snapshotu |
| scope | static-builtins-only |
| exercises[].id | Dokładny builtin:* z kodu |
| names.pl | Obecna etykieta polskiego interfejsu; część nazw już jest angielska |
| names.en | null do czasu osobnego, zrecenzowanego uzupełnienia; nie jest automatycznie odgadniętym tłumaczeniem |
| aliases | Początkowo puste; przyszłe, jawnie sprawdzone warianty nazw |
| category | Kategoria z obecnego katalogu |
| mode | strength / bodyweight / time / cardio / mobility |
| dumbbells | 0, 1 albo 2; to cecha semantyki pomiaru |
| equipment | Klucze istniejącego EQUIPMENT |

Tablica jest uporządkowana po id. Revision liczymy SHA-256 z UTF-8 wyniku istniejącej canonicalImport(exercises), z sortowaniem kluczy obiektów i zachowaniem kolejności tablic. Etykiety i aliasy służą wyszukiwaniu, nie zastępują ID. Zmiana niepowiązanego wpisu w katalogu może zmienić revision; importer sprawdza użyte IDs i sygnatury, nie odrzuca automatycznie poprawnego planu tylko z powodu innej rewizji całej biblioteki.

## Rozwiązywanie tożsamości

1. **ID + typ pomiaru:** builtinId istnieje, a expectedMode/expectedDumbbells odpowiadają bibliotece — dopasowanie jednoznaczne. Brak ID lub sprzeczna sygnatura blokują, zamiast szukać podobnej nazwy.
2. **Wydawca:** namespace+externalId+version rozwiązywane przez zachowane mapowanie oraz dokładną definicję pakietu. Ten sam ID i wersja z inną definicją to konflikt. Zmiana mode/liczby hantli/basis wymaga nowego externalId.
3. **Starszy plan bez ID / propozycja nowej definicji:** dokładna nazwa PL/EN albo zrecenzowany alias może wskazać kandydata po normalizacji. Wynik musi zgadzać się z mode, sprzętem, jednostronnością i basis. Nie dopisujemy automatycznie nowego builtinId do poprawnego kontraktu, jeżeli autor nie rozwiązał referencji.
4. **Niejednoznaczność:** lista kandydatów i jawny wybór w preview. Nie wybierać pierwszego ani najwyżej ocenionego podobieństwa. Alternatywa treningowa jest innym ruchem, nie aliasem.
5. **Rzeczywiście nowy ruch:** pełna wersjonowana definicja, brak konfliktu semantyki i świadome utworzenie lokalnego custom:* dopiero w atomowym apply. Mapowanie zapamiętane, kolejne importy nie tworzą nowych ćwiczeń. Nie podmieniać istniejącego własnego ćwiczenia użytkownika bez uzgodnienia.

Normalizacja wyszukiwawcza: Unicode NFKC, trim, łączenie białych znaków i normalizacja wielkości liter. Nie usuwać określeń kąta, chwytu, sprzętu, podparcia, strony ani liczby hantli. Fuzzy match może co najwyżej pokazać sugestię; nigdy nie jest zgodą na zapis.

Przykłady celowych rozróżnień z obecnego kodu:

- builtin:db-row — jeden hantel; builtin:db-rows — dwa hantle. Nie są aliasami.
- builtin:bridge — bodyweight; builtin:mob-mob-bridge — Mobility/kontrola ruchu. Inne rejestrowanie wykonania.
- builtin:mob-side-plank — Mobility; custom:nov2026-core-side-plank — pozycja czasowa presetu. Podobna nazwa nie uprawnia do scalenia miar i historii.
- supported shoulder press z presetu nie musi być zamienny z builtin:shoulder-press; podparcie jest istotnym wariantem.

W v1 kontrakt świadomie wymaga ID, więc dopasowanie nazw jest narzędziem przygotowania/preview definicji i aliasów, a nie cichym fallbackiem pomijającym brak ID.

## Bezpieczny eksport dla autora planu

Na etapie 5A dostępny jest statyczny JSON powyżej. Przyszła najprostsza funkcja Bengera: „Eksportuj katalog ćwiczeń” jako JSON, tylko builtin, bez OAuth i bez odczytu sesji. Autor dołącza plik do czatu Treningi. Nie ma potrzeby udostępniania RAW DATA ani pełnego backupu, aby zidentyfikować ćwiczenia.

Opcja „uwzględnij moje ćwiczenia” wymaga oddzielnej świadomej zgody. Tylko whitelist ID/nazwa/tryb/sprzęt/basis, bez note, defaults.physioNote, historii i ocen. Same nazwy własnych ćwiczeń mogą zawierać informacje prywatne, więc nie są domyślnie publikowane.

Opcjonalnie użytkownik/czat może później opublikować publiczny katalog jako tabelę EXERCISE_CATALOG w prywatnym Benger – Training Plans: exercise_id, name_pl, name_en, aliases_json, category, mode, dumbbells, equipment_json, catalog_revision. Nie robimy tego teraz. MVP aplikacji pozostaje czytelnikiem źródła planów; nie dodajemy automatycznego zapisu katalogu do arkusza ani żadnego nowego uprawnienia. Przygotowanie takiej tabeli przez autora jest niezależne od arkusza RAW DATA.

Nie wystarczy stabilny ID, jeśli producent zmieni jego znaczenie. Właściciel katalogu musi zachować semantykę measurement signature; archiwum planu i snapshot wykonania przechowują wersję rozstrzygniętej definicji. Wspólne porównanie wyników między wersjami jest poprawne tylko przy niezmienionej semantyce ruchu i obciążenia.
