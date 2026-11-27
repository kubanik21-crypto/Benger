# Import tygodniowego jadłospisu v1 — instrukcja dla czatu Dieta

## Rozdzielenie danych

BENGER_IMPORT pozostaje bez zmian i publikuje przepisy. Nowa, niezależna zakładka **BENGER_MEAL_PLAN** w tym samym prywatnym arkuszu publikuje pełny plan. Obie używają identycznego mechanizmu fragmentów i natywnego odczytu, ale osobnych parserów, ustawień i rejestrów. Plan nie jest spożyciem i nie trafia do RAW DATA. Nie publikuj w nim rzeczywistych treningów, pomiarów ani pełnego backupu.

Źródło: `1bDRXeGN8oYQS-U7bRgA_9FAPTcAqdvdUAFBwmbv1gzw`. Uprawnienie istniejącego powiązania drive.file wystarcza do nowej zakładki w tym samym pliku. Nie twórz arkusza ani nie zmieniaj udostępniania. Zakładkę przygotuje właściciel/czat Dieta dopiero po otrzymaniu tej specyfikacji.

## JSON

Formalny schemat: [meal-plan-import.schema.json](meal-plan-import.schema.json). Pełny siedmiodniowy przykład 28 posiłków: [week.json](../examples/meal-plan/week.json); wymagany syntetyczny przepis: [recipes.json](../examples/meal-plan/recipes.json). Przykłady służą testom, nie są zaleceniem żywieniowym.

| Pole | Znaczenie |
|---|---|
| format / schemaVersion | `benger.meal-plan` / `1` |
| namespace / id | Stabilna tożsamość planu; nie zmieniaj przy korekcie dnia |
| version | Rosnąca liczba całkowita, 1–1000000 |
| label | Nazwa 1–200 znaków, bez samych spacji |
| from / to | Lokalne daty YYYY-MM-DD, dokładnie 7 kolejnych dni włącznie |
| meals | 7–56 pozycji, co najmniej jedna na każdy dzień |
| meals[].id | Stabilny ID pozycji przez wszystkie wersje danego planu |
| date / meal / order | Data; breakfast/lunch/dinner/snack; kolejność 0–55 unikalna w dniu |
| recipe.namespace / id / version | Tożsamość **zewnętrzna** przepisu i externalVersion, nie lokalny UUID lub lokalny version Bengera |
| recipe.variant | Opcjonalny ID wariantu z przepisu w tej samej wersji, albo null |
| amount / unit | Dodatnia ilość do 10000000; serving, g, ml |
| notes | Opcjonalny tekst do 1000 znaków, widoczny wyłącznie w planie/backupie |

ID/namespace: litera/cyfra na początku, następnie litery ASCII, cyfry, kropki, podkreślenia i myślniki; do 100 znaków. Nazwy `constructor`, `prototype` i `__proto__` są zarezerwowane i niedozwolone. Nieznane pola są odrzucane. Nie używaj `servings` zamiast `serving`. Jednostka g lub ml wymaga odpowiednio finalWeight/finalVolume wskazanego przepisu; brak przelicznika blokuje plan. Nie zgaduj gęstości, gramatur ani makro. Wariant musi istnieć dla wskazanej wersji bazowej i pozostać w stanie importu (createdAt = updatedAt). Edycja przez repozytorium zmienia updatedAt i blokuje użycie wariantu jako niezmienionego źródła.

Walidacja semantyczna poza JSON Schema sprawdza poprawność kalendarza, siedmiodniowy zakres, pokrycie dni, unikalność ID i kolejności oraz dostępność konkretnych wersji przepisów. Lokalnie zmieniona baza nie zastępuje oryginalnej wersji źródłowej. Benger korzysta z niezmienionej wersji źródła z biblioteki/historii, a jeśli jej nie ma, zatrzymuje import.

## Zakładka A:N

Wiersz 1 zawiera dokładnie, w tej kolejności:

```text
schema_version | publication_id | record_type | status | published_at | week_from | week_to | plan_id | label | meal_count | chunk_count | chunk_index | payload_json | content_sha256
```

Wiersz MANIFEST: A=liczba 1, B=unikalny publication_id, C=MANIFEST, D=DRAFT lub READY, E=czas UTC ISO z milisekundami (`2026-11-27T10:00:00.000Z`), F/G=daty planu, H=plan.id, I=label, J=liczba posiłków, K=liczba fragmentów, L/M=puste, N=obowiązkowy mały hex SHA-256 dokładnego UTF-8 JSON.

Wiersz CHUNK: A=liczba 1, B=ten sam publication_id, C=CHUNK, D:K=puste, L=liczba indeksu 1..chunk_count, M=fragment tekstu JSON, N=puste. Nie używaj formuł ani wartości logicznych. Daty i JSON zapisuj jako tekst; liczby wersji/count/index jako liczby. Komórki poza N nie należą do kontraktu.

Fragment zawiera 1–20000 jednostek UTF-16 (JavaScript `string.length`, Android `String.length`). Nie dziel pary surogatów. Łącz w kolejności indeksów bez separatora i bez zmiany spacji. Limit JSON planu 2 MiB UTF-8, 4 MiB wszystkich READY, 256 fragmentów READY, 20 publikacji i 3000 wierszy wraz z nagłówkiem. SHA-256 jest wymagany dla każdego planu READY, także przy imporcie ręcznym.

Generator referencyjny: `publishMealPlanRows(plan,{publicationId,publishedAt,status})` z meal-plan-contract.js. Wynik to macierz komórek, nie obiekt do wklejenia w pojedynczą komórkę. Gotowe macierze: [ready-rows.json](../examples/meal-plan/ready-rows.json), [draft-rows.json](../examples/meal-plan/draft-rows.json), [day-update-rows.json](../examples/meal-plan/day-update-rows.json).

## Publikowanie i wersjonowanie

1. Opublikuj wymagane przepisy w dotychczasowej BENGER_IMPORT; zachowaj stabilne namespace/externalId i zwiększ ich wersje tylko po zmianie.
2. Przygotuj **pełny tydzień**, wskazując dokładne wersje przepisów, ilości i warianty. Zweryfikuj go schematem i parserem referencyjnym.
3. Dla nowej publikacji wybierz nowe publication_id, np. `dieta-2026-11-30-r1`. Dla kolejnego tygodnia wybierz nowe plan.id. Dla korekty obecnego tygodnia zachowaj plan.id, zwiększ version i użyj nowego publication_id.
4. Dodaj manifest DRAFT i wszystkie CHUNK. Nie modyfikuj wcześniej opublikowanego READY. Oblicz SHA z dokładnie połączonych fragmentów i sprawdź count oraz dane manifestu.
5. Dopiero po kompletnym zapisie przełącz DRAFT na READY. Preferuj jedną atomową operację Sheets batchUpdate dla całej publikacji. Benger dodatkowo porównuje metadane przed i po odczycie; niekompletne lub zmieniające się publikacje odrzuca.
6. Nie zmieniaj treści ani metadanych istniejącego publication_id READY, nawet jeśli użytkownik jeszcze nie potwierdził importu. Usuń stare publikacje z arkusza tylko po uzgodnieniu archiwizacji; lokalne plany nie są usuwane z powodu zniknięcia wierszy źródłowych.

Aktualizacja pojedynczego dnia nadal zawiera pełny tydzień. Zmień tylko odpowiednie meals, zachowując ID pozostałych i zwiększając version. Zamiana przepisu w tej samej pozycji zachowuje meals[].id; nie twórz nowego ID w celu ponownego naliczenia spożycia. Identyfikator pozycji nie jest nazwą przepisu. Przykład korekty dnia zawiera version=2 i nowy publication_id.

Inny niezależny plan na nakładające się daty jest blokowany. Zmianę dat tygodnia istniejącego planu należy uzgodnić ręcznie; nie publikuj jej jako nowego planu na zajęte daty. Nie publikujemy przyrostowych „patchy”, aby brak jednego wiersza nie oznaczał przypadkowego usunięcia posiłku.

## Import i konflikty

Benger sprawdza źródło przy starcie/powrocie, zmianie autoryzacji, odzyskaniu sieci i co 30 minut podczas używania. Stosuje opóźnienia ponowień. Brak WorkManagera: po zamknięciu aplikacji nie gwarantuje importu w tle. Autoimport planu jest osobną opcją, domyślnie wyłączoną; nie włącza automatycznie importu przepisów.

Nowy kompletny plan z poprawnym SHA może zapisać się automatycznie. Brak przepisu/wariantu, konflikt wersji lub lokalne zmiany zatrzymują go w oczekujących; najpierw przejrzyj i zaimportuj przepisy, potem ponów sprawdzenie planu. Po automatycznym imporcie przepisów aplikacja próbuje sprawdzić plan ponownie. Po ręcznym imporcie użyj sprawdzenia planu albo wróć do aplikacji. Nie ma wspólnej transakcji zapisu przepisów i planu: bezpieczna kolejność to przepisy najpierw, następnie ponowna walidacja i atomowy zapis całego planu. Przerwanie między krokami pozostawia przepisy, ale nie tworzy częściowego planu ani kalorii.

Aktualizacje wymagają podglądu i potwierdzenia. Ręczne pominięcia i zamiany zostają zachowane. Usunięcie ręcznie zmienionej pozycji jest blokowane do cofnięcia tej lokalnej decyzji. Zmiana/usunięcie zrealizowanej pozycji wymaga dodatkowego potwierdzenia zachowania rzeczywistego spożycia; nigdy nie przenosi ani nie usuwa istniejącego wpisu. Wpis pozostaje również w zwykłym dzienniku na swojej rzeczywistej dacie.

Potwierdzenie spożycia tworzy zwykły snapshot przepisu, ze stałym UUID wyprowadzonym z namespace/plan.id/meal.id. Powtórne kliknięcie nie dodaje kolejnego wpisu. Posiłek można skorygować zwykłą edycją ilości dziennika lub cofnąć potwierdzenie. Dopiero rzeczywisty wpis podlega RAW DATA.

## Backup i offline

Plan przypina lokalną bazę i wariant oraz przechowuje lokalne decyzje w IndexedDB meta, oddzielnie od localStorage dziennika. Zapis całego planu, rejestru publikacji i historii wersji odbywa się w jednej transakcji IndexedDB z kontrolą niezmienionej biblioteki. Do importu nie jest wymagany zapis do Google. Plan, gramatury, przepis i makro są dostępne offline.

Kopia z danymi planistycznymi ma schemaVersion 9 i pole data.mealPlans; bez tych danych eksport pozostaje v8. Stare kopie 1–8 są obsługiwane, nie kasują już zapisanych planów. Odtworzenie v9 wyłącza autoimport i usuwa kolejkę oczekujących publikacji; zapisane plany i lokalne decyzje zostają. Scalanie nie nadpisuje istniejącego planu i odrzuca konflikt nakładających się tygodni/publikacji. Limity retencji: 52 bieżące plany, 104 poprzednie wersje, 1000 potwierdzonych publikacji, 12 × 1024² jednostek UTF-16 serializowanego stanu. Przekroczenie zatrzymuje zapis bez automatycznego kasowania historii.
