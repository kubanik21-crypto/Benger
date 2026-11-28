# Przykłady treningowe — etap 5A

**Wyłącznie dane syntetyczne.** Nie są jadłospisem, rehabilitacją ani planem treningowym użytkownika. Nie importować ich do prywatnego arkusza i nie używać jako propozycji treningów. Lokalny importer 5B obsługuje te pliki JSON. Integracja ich publikacji z Google Sheets nie jest jeszcze zaimplementowana. Instrukcja: [training-plan-import-5b.md](../../training-plan-import-5b.md).

| Plik | Przeznaczenie i oczekiwany wynik |
|---|---|
| valid-minimal.json | Poprawny kompletny mały blok, jedna jednostka, rozgrzewka/serie robocze oraz ćwiczenie czasowe |
| month-v1.json | Pełny miesiąc 1–31.12.2026, 16 jednostek: 12 workout i 4 Mobility, 5 tygodni kalendarzowych, deload oznaczony w tygodniu 4 |
| month-v2-week-update.json | Pełny snapshot tego samego bloku v2: zmienia tylko 4 jednostki z 7–13.12, ich wersje rosną do 2; pozostałe jednostki i IDs bez zmian |
| mobility.json | Osobna sesja Mobility, strona left, odpoczynek 0 oraz jedna jawna nowa definicja z nazwami PL/EN |
| invalid-schema.json | Ma zostać odrzucony przez schemat: sets=0 i nieznane pole elementu |
| invalid-semantic.json | **Przechodzi schemat strukturalny**, ale ma zostać odrzucony semantycznie: data poza blokiem, powtórzony session.id, nieistniejący builtinId, odwrócony rep range, 50 kg/hantel ponad obecny profil |
| sheets-publication.json | Proponowana tabela BENGER_TRAINING_PLANS jako {tab,grid}, zawiera prawdziwe fragmenty month-v1 oraz SHA-256 ich UTF-8 |
| month-v1.json.sha256 | Suma dokładnych bajtów pliku, nie przeformatowanego obiektu |
| expected-validation.json | Macierz oczekiwanych wyników walidacji |
| validate-examples.py | Offline sprawdzian **dokumentacji**, bez importu do aplikacji i bez komunikacji z Google |

## Odtworzenie sprawdzenia

Wymagane Python 3 i jsonschema obsługujące Draft 2020-12. Format UTC date-time jest sprawdzany jawnie przez bibliotekę standardową Pythona, również gdy opcjonalny checker RFC3339 nie jest zainstalowany. Z katalogu repozytorium:

```sh
python3 docs/examples/training-plans/validate-examples.py
```

Walidator sprawdza meta-schemat, formaty date/date-time, wszystkie zadeklarowane pozytywne/negatywne przykłady, podstawowe referencje i ograniczenia istniejącego profilu, kompletność aktualizacji tygodnia i sumę publikacji. Weryfikuje również, że ucięcie pakietu lub zmiana treści nie przechodzą oryginalnego manifestu.

Nie jest przyszłym walidatorem bezpieczeństwa aplikacji: nie zapewnia wykrywania powtórzonych nazw pól JSON, wszystkich zakazanych kluczy/głębokości, porównania z lokalnymi danymi, konfliktów aktywnych sesji ani negocjacji wszystkich przyszłych capabilities. Nie odczytuje IndexedDB ani localStorage, nie generuje rzeczywistych sesji i niczego nie zapisuje do Google.

Przykłady używają obecnych IDs biblioteki. `load:null` oznacza nieokreślony cel; `restSeconds:0` w Mobility jest jawnie podanym brakiem przerwy. RIR w prescription jest wyłącznie planowanym celem. `sets` nie tworzy rekordów rzeczywistych serii. Pakiet ma zawsze dodatnią liczbę sesji; brak jednej przyszłej jednostki w kompletnej nowej wersji jest kandydatem wycofania, a pusta/ucięta publikacja nie jest poleceniem skasowania całego bloku.

### Wynik wykonania w 5A

5 przykładów strukturalnie poprawnych (jeden celowo semantycznie błędny), 1 strukturalnie niepoprawny; 4 pozytywne semantic checks, 1 negatywny. Miesiąc: 16 jednostek, zmienione w v2 unit-003, unit-004, unit-005, mobility-002. Plik month-v1 ma 37891 bajtów UTF-8 i 2 fragmenty, każdy do 20000 jednostek UTF-16. 0 zapisów aplikacji/Google.
