# Walidacja Etapu 7 — 2026-10-26

## Wynik lokalny

- Node.js 22: `npm test` — **747/747 PASS**.
- Chromium: `npm run test:browser` — **133/133 PASS**.
- `git diff --check` — PASS.
- Składnia trzech workflow YAML — PASS.
- Corpus: **174** jawne zdania, dodatkowo **288** wygenerowanych kombinacji składni.
- Własności konwersji: **308** kombinacji unit × count × weight, sprawdzające liniowość, izolację produktu, USER override i niezmienność snapshotu.
- Dotychczasowe regresje głosu, katalogu, kamery, PWA, starych danych i backupu pozostają w pełnym zestawie.

OFF i SpeechRecognition są mockowane. Import porcji USDA wykorzystuje rzeczywiste oficjalne archiwa pobrane w GitHub Actions. Nie wykonujemy zewnętrznych requestów w standardowym CI. Testy headless nie zastępują Samsunga.

## 20 scenariuszy akceptacyjnych

W testach jawnie ustalamy konkretny produkt. Rzeczywisty resolver może najpierw wymagać jego wyboru. LOW/wybór jest oczekiwanym sukcesem zabezpieczenia, a nie obietnicą automatycznej masy.

| # | Wypowiedź | Oczekiwany i uzyskany wynik |
|---|---|---|
| 1 | 2 łyżki oliwy | USDA 171413: 27 g |
| 2 | łyżeczka masła | Brak dokładnej miary: podanie wagi |
| 3 | 2 jajka | Wybór rozmiaru; large: 100 g |
| 4 | 3 kromki chleba | USDA 167532: 84 g |
| 5 | 2 plastry sera | Wybór źródłowej grubości plastra |
| 6 | pół opakowania skyra | Konkretne opakowanie 150 g: 75 g |
| 7 | jedno opakowanie jogurtu | Konkretne opakowanie 150 g: 150 g |
| 8 | szklanka mleka | Podstawa ml i ustawienie użytkownika: 250 ml |
| 9 | pół szklanki mleka | To samo ustawienie: 125 ml |
| 10 | garść migdałów | Brak dokładnej definicji: podanie wagi |
| 11 | 1 banan | Wybór rozmiaru |
| 12 | 2 jabłka | Wybór rozmiaru |
| 13 | jedna bułka | Brak jednoznacznej sztuki: podanie wagi / wybór |
| 14 | półtorej łyżki masła orzechowego | USDA 174265: 24 g |
| 15 | jedna miarka odżywki białkowej | Brak konkretnej miarki: podanie wagi |
| 16 | 3 łyżeczki cukru | USDA 169655: 12,6 g |
| 17 | 2 łyżki mleka | Podstawa ml: 30 ml |
| 18 | 2 kromki mojego chleba | Jawna definicja USER 38 g: 76 g |
| 19 | pół opakowania produktu własnego | Konkretne opakowanie 500 g: 250 g |
| 20 | śniadanie: 2 jajka, 2 kromki chleba, łyżeczka masła | Zachowanie wszystkich pozycji; po wyborze large i jawnym 5 g masła: 100 + 56 + 5 g, poprawna suma makro |

Wszystkie **20/20** zachowań są automatycznie sprawdzane. Miary custom w fixtures są kontrolowanymi danymi testów; nie są nowym katalogiem demonstracyjnym.

## Pomiar

Poniżej pojedynczy lokalny pomiar headless Chromium. Nie jest benchmarkiem telefonu. Gzip to suma kompresji poszczególnych plików przy domyślnych ustawieniach Node. Heap obejmuje import modułu, indeks i pierwszy chunk, bez izolacji GC; źródłowe dane porcji nie są wczytywane hurtowo.

```json
{
  "heapUsedBefore": 1244568,
  "heapUsedAfter": 2224956,
  "heapDeltaBytes": 980388,
  "environment": "Local headless Chromium; not a Samsung measurement",
  "productsWithPortions": 9656,
  "portionDefinitions": 17426,
  "portionFiles": 77,
  "portionBytes": 6518724,
  "portionGzipBytes": 432877,
  "precacheBytes": 16088372,
  "coldAppMs": 498.815019,
  "coldLookupMs": 23.900000005960464,
  "warmLookupMs": 0.01999999980131785,
  "definitions": 3,
  "loadedChunks": 1
}
```

Źródła: 310 produktów Foundation, 5624 FNDDS i 7793 SR Legacy, razem 13 727 produktów. Porcje: 9656 produktów, 17 426 definicji, 76 chunków i osobny indeks. Precache pozostaje poniżej limitu 20 MiB. LRU porcji zatrzymuje najwyżej 4 chunki.

## Self-review

Sprawdzono pełny diff względem main. Naprawiono: puste amount i ułamki FNDDS; niezrozumiane jawne miary USDA; deduplikację; brak dzielenia przez źródłowy count; konflikt strukturalnej wielkości sztuki z tekstowym multipackiem; USER override przy custom i slice/plaster; niezgodną jednostkę starej pamięci po edycji produktu; odmiany aliasów z zachowaniem starszych kluczy; nieaktualny wynik po zmianie produktu/ilości; integralność snapshotu i backupu; wyścig odświeżania listy porcji; callback zapisu po unieważnieniu propozycji; blokadę zapisu starego produktu podczas ładowania nowego. Cache revision 3 odświeża metadane OFF bez usuwania starych produktów offline.

Nie zmieniono `nutrition.js` ani `speech-recognition.js`. Nie dodano globalnych mas, gęstości, backendu ani AI. Dane dawnych notatek i wpisów nie są usuwane. Import nadal używa journal/rollback. Produkcyjne Pages i starsze preview nie są publikowane przez workflow Etapu 7.

## Publikacja i urządzenie

Aktualne uruchomienia: [Actions gałęzi Etapu 7](https://github.com/kubanik21-crypto/Benger/actions?query=branch%3Aetap-7-household-portions).

[Preview](https://kubanik21-crypto.github.io/Benger/previews/etap-7/) · [Portion Test Lab](https://kubanik21-crypto.github.io/Benger/previews/etap-7/portion-test-lab.html) · [Portion Diagnostics](https://kubanik21-crypto.github.io/Benger/previews/etap-7/portion-diagnostics.html).

Checklista Samsunga i ograniczenia są w [household-portions.md](household-portions.md). Gałąź jest przeznaczona do real-device acceptance, bez tworzenia PR i bez merge.

## Dogrywka: porcje referencyjne

Zestaw A–G sprawdza:

| Przypadek | Wynik |
|---|---|
| A — mleko w ml, 2 łyżki | 30 ml, STANDARD_VOLUME/HIGH, bez estimate |
| B — markowa oliwa w g, bez porcji | ok. 27 g, REFERENCE/MEDIUM, USDA 171413 |
| C — markowe masło orzechowe | ok. 32 g, REFERENCE/MEDIUM, USDA 174266; zachowane makro produktu |
| D — jawna USER 20 g/łyżkę | 40 g, USER/HIGH, wygrywa z reference i exact source |
| E — domowy sos w g | UNRESOLVED/LOW |
| F — olej rzepakowy | ok. 28 g, USDA 172336; nigdy olive-oil |
| G — zmiana oliwa → miód | poprzednia konwersja unieważniona; po załadowaniu honey: ok. 42 g |

Dziewięć rodzin obejmuje 11 rzeczywistych miar źródłowych (łyżki/łyżeczki). Porównawczy test automatyczny sprawdza **11 × exact USDA/HIGH** dla konkretnych rekordów i **11 × REFERENCE/MEDIUM** dla odpowiadających im produktów bez własnych definicji. To liczby kontrolowanych przypadków, nie telemetria użycia.

Nowe flow Chromium obejmuje również rzeczywisty frontend z mockiem OFF, zachowanie makro OFF, „ok.” i „typowa wartość”, brak automatycznego USER, jawny override, zmianę produktu, historię, backup/import oraz reload offline. Self-review obejmuje zakazane warianty i jednostki, próbę ukrycia typu oleju lub wariantu w marce, niepoprawne provenance, NaN/Infinity, pierwszeństwo exact i niezmienność zapisanych szacunków. Brakującej łyżeczki nie wyprowadzamy z łyżki.

Pełny zestaw po dogrywce: **790/790 Node**, **140/140 Chromium**, `git diff --check` bez błędów. Wszystkie poprzednie testy pozostają uruchamiane. `nutrition.js` i `speech-recognition.js` nadal nie zostały zmienione. Źródła, konkretne rekordy i wartości są opisane w `household-portions.md`.
