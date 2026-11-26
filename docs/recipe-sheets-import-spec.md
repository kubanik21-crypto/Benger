# Benger — publikowanie przepisów z Google Sheets, protokół v1

Specyfikacja dla czatu Dieta. Dane przepisu nadal podlegają [JSON v1](recipe-import-spec.md); ten dokument opisuje wyłącznie transport i publikację. Benger nie zapisuje niczego do źródła.

## Źródło i przeznaczenie

Źródłem jest istniejący arkusz `1bDRXeGN8oYQS-U7bRgA_9FAPTcAqdvdUAFBwmbv1gzw`, wyłącznie zakładka **BENGER_IMPORT**. To osobny przepływ od eksportu do Benger – RAW DATA. Nie zmieniaj innych zakładek jadłospisu, zakupów ani danych rzeczywistego spożycia. Nie umieszczaj tu tokenów, kluczy ani pełnych backupów.

Utworzenie zakładki i publikację wykonuje użytkownik/czat Dieta po uzgodnieniu. Implementacja etapu 4B nie tworzy ani nie modyfikuje rzeczywistych arkuszy.

## Kolumny A:N

Pierwszy wiersz zawiera dokładnie poniższe nagłówki w tej kolejności. Typ liczbowy oznacza rzeczywistą liczbę w Sheets, nie tekst. Daty są tekstem ISO; puste komórki pozostają puste. Formuły i wartości logiczne są odrzucane.

| Kolumna | Nagłówek | MANIFEST | CHUNK |
|---|---|---|---|
| A | schema_version | liczba 1 | liczba 1 |
| B | package_id | ID publikacji | ten sam ID |
| C | record_type | tekst MANIFEST | tekst CHUNK |
| D | status | DRAFT albo READY | puste |
| E | published_at | UTC ISO, np. 2026-11-26T00:00:00.000Z | puste |
| F | week_from | YYYY-MM-DD | puste |
| G | week_to | YYYY-MM-DD | puste |
| H | namespace | namespace JSON v1 | puste |
| I | label | identyczne label JSON, 1–200 znaków | puste |
| J | recipe_count | liczba przepisów 1–50 | puste |
| K | chunk_count | liczba fragmentów 1–210 | puste |
| L | chunk_index | puste | numer 1…chunk_count |
| M | payload_json | puste | dokładny fragment JSON jako tekst |
| N | content_sha256 | małe litery SHA-256 albo puste | puste |

Jedna publikacja to dokładnie jeden MANIFEST i zadeklarowana liczba CHUNK. Kolejność wierszy nie ma znaczenia, fragmenty łączymy według chunk_index. ID pakietu i namespace: `[A-Za-z0-9][A-Za-z0-9._-]{0,99}`. Tydzień: 1–7 kolejnych dni, obie granice włącznie. To metadane planu, a nie polecenie przypisania przepisów do dziennika.

## JSON, kompletność i hash

Payload to cały niezmieniony obiekt `benger.recipe-package`, schemaVersion 1. Każdy fragment ma najwyżej **20 000 jednostek UTF-16** (bez dzielenia pary surogatów). Limit jest niższy od limitu komórki Sheets. Limit całego JSON: 2 MiB UTF-8. Zakładka: do 3000 wierszy z nagłówkiem, 20 publikacji, 256 fragmentów READY oraz 4 MiB połączonych payloadów READY. Archiwizuj stare publikacje poza zakładką importu po uzgodnieniu; usunięcie publikacji nie usuwa lokalnych przepisów.

SHA-256 licz z **dokładnych bajtów UTF-8 połączonych fragmentów**, bez separatorów, BOM ani dodawania końcowego znaku nowej linii. Nie ma kanonizacji JSON. Wynik: 64 małe znaki hex. Po obliczeniu nie zmieniaj spacji, kolejności pól ani końców linii. Przykład JavaScript: `await recipePayloadHash(raw)` z recipe-sheets-contract.js. Hash jest opcjonalny dla ręcznego podglądu, ale **obowiązkowy dla automatycznego importu**. Jest kontrolą spójności, nie podpisem autora.

Importer sprawdza zgodność namespace, label i liczby przepisów z manifestem, wszystkie indeksy fragmentów, brak powtórzeń i JSON v1. Błędny przepis blokuje tę publikację; wcześniej zaimportowana starsza wersja obecna w archiwalnej publikacji jest pomijana. Pakiet DRAFT jest ignorowany. Natywny czytnik najpierw pobiera metadane, dopiero potem komórki payloadów należących do READY. Powtórny odczyt metadanych wykrywa zmianę źródła podczas pobierania.

## Bezpieczna publikacja przez czat Dieta

1. Przygotuj i zwaliduj kompletny JSON v1. Zachowaj namespace, externalId i identyfikatory składników.
2. Użyj nowego package_id, np. `dieta-2026-11-23-r1`. Wprowadź MANIFEST jako DRAFT.
3. Zapisz wszystkie fragmenty jako tekst oraz pozostałe pola z odpowiednimi typami. Przy API używaj RAW lub userEnteredValue.stringValue/numberValue; nie USER_ENTERED. Nie pozwól Sheets zamienić tekstowych dat na liczby dat.
4. Odczytaj zapis, sprawdź indeksy, liczbę fragmentów, JSON, wersje przepisów i SHA-256.
5. Dopiero na końcu zmień **jedną komórkę status manifestu na READY**. Nie publikuj częściowo przygotowanej paczki.
6. READY pozostaje niezmienne, łącznie z datą, tygodniem, etykietą i hashem. Poprawka wymaga nowego package_id. Benger wykrywa zmianę treści pod wcześniej pobranym ID i wstrzymuje tę publikację.

Nie edytuj fragmentów opublikowanej paczki pod statusem READY. Przy nowej wersji przepisu zwiększ recipe.version zgodnie z JSON v1. Sam nowy tydzień nie zmienia tożsamości ani wersji przepisu. Nie zmieniaj namespace ani externalId tylko dlatego, że zmienił się tydzień/gramatura.

## Przykłady i narzędzie offline

Kompletny przykład trzech przepisów: [three-recipes.json](examples/recipe-sheets/three-recipes.json). Są to **szablony**, nie aktualny jadłospis użytkownika. Celowo nie wymyślają odżywczych danych: nutrition i expectedNutrition pozostają null. Wymagają świadomego podglądu, nie kwalifikują się do automatycznego dodania.

Gotowe macierze A:N (z nagłówkiem i wszystkimi fragmentami):

- [ready-three.json](examples/recipe-sheets/ready-three.json): prawidłowa publikacja z hashem, trzy szablony.
- [draft-three.json](examples/recipe-sheets/draft-three.json): wersja robocza, ignorowana.
- [next-week.json](examples/recipe-sheets/next-week.json): kolejny tydzień 30.11–06.12, nowy package_id, te same przepisy i wersje; brak duplikatów.
- [BENGER_IMPORT-template.csv](examples/recipe-sheets/BENGER_IMPORT-template.csv): szablon DRAFT. Po imporcie CSV trzeba zweryfikować typy komórek; macierz JSON jest wzorcem typów.
- invalid-missing-chunk.json, invalid-checksum.json, invalid-schema.json: negatywne przykłady obok powyższych plików; nie publikować.

Pomocnik nie łączy się z Google i zawsze przygotowuje DRAFT:

```sh
python3 docs/examples/recipe-sheets/publish.py recipes.json \
  --package-id dieta-2026-11-23-r1 --from 2026-11-23 --to 2026-11-29 \
  --output publication
```

Powstają rows.json i BENGER_IMPORT.csv. Pomocnik sprawdza podstawową kopertę i dzieli payload, ale nie zastępuje pełnej walidacji schematem/importerem JSON v1. Alternatywa JS: publishRecipeRows(raw, metadata) z recipe-sheets-contract.js; przy roboczej publikacji podaj status DRAFT.

## Braki, aktualizacje i decyzje użytkownika

Brak ilości lub danych odżywczych reprezentuj przez null zgodnie z JSON v1, nigdy przez fikcyjne zero. Jednostki i porcje muszą spełniać specyfikację 4A. Nie zgaduj gęstości ani masy sztuki. Brakujący produkt/nutrition może być rozwiązany później przez istniejący importer i resolver Bengera.

Domyślnie Benger tylko sprawdza i pokazuje oczekujące przepisy. Po świadomym włączeniu automatycznego importu dodaje wyłącznie nowe przepisy bez ostrzeżeń, z kompletną ilością i nutrition, z paczki o potwierdzonym hashu. Aktualizacja istniejącego przepisu, konflikt, nieznane dane lub brak hasha wymagają istniejącego podglądu JSON i decyzji użytkownika. Identyczne wersje są pomijane. Powtórzenie/powrót po przerwaniu porównuje aktualną bibliotekę, a nie tylko rejestr pobrań.

Import nie tworzy posiłków ani wpisów historycznych, nie przelicza historii i nie usuwa przepisów przez ich brak w źródle. Rejestr publikacji jest osobnym lokalnym stanem transportu; format backupu Bengera pozostaje bez zmian.

Uwaga o etykiecie: importer 4A uwzględnia label paczki w skrócie wersji przepisu. Dla identycznych przepisów w kolejnym tygodniu zachowaj label (jak w next-week.json). Zmiana label przy tej samej recipe.version będzie konfliktem treści — zwiększ wersję modyfikowanych przepisów albo zachowaj dotychczasową etykietę biblioteki, a tydzień zapisuj w polach week_from/week_to.
