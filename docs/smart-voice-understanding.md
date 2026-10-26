# Etap 5 — Smart Voice Understanding

## Wdrożony przepływ

`SpeechRecognition → rawTranscript → normalizeTranscript → tokenizeFood / segmentFoodText → understandMeal → resolveMealIntents → ProductResolver → edytowalna propozycja → jawne zatwierdzenie → snapshot dziennika`.

Głos i wpisany tekst korzystają z tego samego przepływu w `voice-entry.js`. `rawTranscript` zachowuje oryginał, a `normalizedTranscript` jest osobną reprezentacją. Nie poprawiamy transkrypcji przez usuwanie powtórzonych słów/liczb. Konfiguracja SpeechRecognition pozostaje `continuous=false`, `interimResults=true`; adapter i jego mechanizm segmentów z Etapu 4 pozostają bez zmian. Rozpoznawanie mowy może wymagać sieci i usługi dostawcy przeglądarki.

## Normalizacja i liczby

`transcript-normalizer.js`, `polish-numbers.js`, `food-language.js` i `food-query.js` oddzielają pisownię od tożsamości produktu. Znane odmiany rzeczowników są kanonizowane w zapytaniu; nieznane słowa i marki pozostają. Normalizacja obniża wielkość liter i usuwa polskie znaki, więc oryginalną pisownię sprawdzamy w `rawTranscript`.

| Raw | Normalized |
| --- | --- |
| mleko Łaciate dwa procent 250 mili | mleko laciate 2% 250 ml |
| tysiąc dwieście gram ryżu | 1200 g ryzu |
| półtora grama oliwy | 1.5 g oliwy |
| mleko trzy przecinek dwa procent 250 ml | mleko 3.2% 250 ml |

Obsługujemy 0–2000, `tysiąc dwieście`, `dwa tysiące`, `pół`, `półtora`, `jeden i pół`, ułamki dziesiętne oraz `przecinek` z kolejnymi cyframi. Liczby słowne zamieniane są w kontekście jednostki lub procentu, a nie dowolnie w nazwie marki. `Zero` w nazwie nie staje się porcją 0. Niepoprawne ilości pozostają problemem do poprawy.

`mili`/`mil` zamieniamy na ml tylko obok jawnej ilości i rozpoznanej nazwy płynu. Kontekst nie przechodzi przez nazwę kolejnego produktu. Nie zakładamy, że g = ml. Sztuki/kromki/łyżki pozostają jednostkami domowymi (`piece`, `slice`, `tablespoon`, `teaspoon`) i wymagają podania g/ml przed obliczeniem porcji. Nie znamy masy jajka ani gęstości oliwy.

## Tokeny i segmentacja

`food-tokenizer.js` produkuje `{text, normalized, type, start, end}`. Typy: NUMBER, PERCENT, UNIT, PRODUCT (znana rodzina), CONNECTOR, APPROXIMATION, WORD. **Indeksy odnoszą się do znormalizowanego tekstu**, nie do oryginalnego nagrania ani tekstu surowego; po zmianie liczby słownej długości nie są takie same. Segmenty pokazujemy jako tekst, bez udawania dokładnych pozycji w raw.

Dla `mleko 2% 250 ml`: PRODUCT(mleko), PERCENT(2%), NUMBER(250), UNIT(ml). Procent nie jest kotwicą ilości.

`food-segmentation.js` rozdziela spójniki, średniki i przecinki niebędące separatorem dziesiętnym. Gdy brak interpunkcji, korzysta z jawnych ilości+jednostek i rozpoznanych rodzin nazw. Wspiera szyk amount-first, product-first i ich mieszanki:

`80 g płatków 250 ml mleka banan 120 g` → `80 g płatków` | `250 ml mleka` | `banan 120 g`.

Nieznane wieloznaczne konstrukcje nie są zgadywane: zachowujemy fragment i prosimy o poprawę. Specjalnie obsługiwany znacznik nieznanej części „coś tam dziwnego” zachowuje własny niepełny wiersz zamiast psuć trzy sąsiednie produkty. To ograniczony parser regułowy, a nie ogólne rozumienie polszczyzny. Jedna analiza: najwyżej 2000 znaków i 20 pozycji.

## Intencje i pewność

Intencja zawiera `id`, `raw`/`source` (znormalizowany fragment), `query`, `amount`, `unit`, `meal`, `issues`, `amountApproximate`, `structureConfidence`, `metadata`. Oryginalna całość jest w `analysis.rawTranscript`; pole `raw` intencji nie jest kopią fragmentu oryginalnej pisowni.

- HIGH: jasna struktura, np. `80 gram płatków`, także jednoznaczna liczba sztuk (bez automatycznego ważenia).
- MEDIUM: przybliżenie lub brak jednostki, np. `płatki chyba z osiemdziesiąt` → 80, null, wymagane uzupełnienie jednostki.
- LOW: brak ilości, błędna liczba, niejednoznaczne przypisanie lub brak nazwy.

To oddzielna pewność od `resolution.confidence`. HIGH struktury nie dowodzi tożsamości produktu ani możliwości obliczenia makro. Przybliżenie pokazujemy jako „ok.”. Niepełny wiersz pozostaje edytowalny, nie kasuje sąsiadów; zapis całego posiłku wymaga uzupełnienia wszystkich pozycji.

## Resolver i pamięć

Kolejność: jawny alias → dokładny kod kreskowy (jeśli wpisany) → dokładna pamięć potwierdzeń → podobne potwierdzone frazy → ulubione → ostatnie → cache/lokalne → opcjonalny OFF. Kod kreskowy jest deterministyczną ścieżką, nie zgadywaniem po nazwie. Ulubione mają pierwszeństwo w kolejności kandydatów; kilka zgodnych produktów nadal wymaga wyboru.

Pamięć dokładna osiąga HIGH po co najmniej 2 wyborach i dominacji ≥75%, tylko gdy produkt pasuje do aktualnego zapytania i wariantu. Jednorazowy wybór daje MEDIUM. Podobne frazy wymagają wspólnych tokenów ≥2/3, co najmniej 2 potwierdzeń i jednego zgodnego produktu: najwyżej MEDIUM. Marka i nieznane słowa nie są usuwane, więc konkurencyjna marka nie uzyskuje automatycznie HIGH.

`product-variants.js` pilnuje jawnych procentów, znanych smaków i Zero także w aliasach/pamięci. Mleko 2% nie przechodzi jako 3,2%, skyr waniliowy jako naturalny ani cola Zero jako zwykła. Nieodpowiedni produkt można obejrzeć jako alternatywę, ale wymaga jawnego wyboru; nie ma samoczynnej zamiany wariantu.

`resolveMealIntents()` dopuszcza maksymalnie **jedno automatyczne wyszukiwanie zewnętrzne na analizę**. Dalsze wyszukiwania wymagają działania użytkownika w konkretnym wierszu; limity repozytorium nadal obowiązują. Nie robimy requestu dla każdego fragmentu.

## Jawne aliasy bez migracji danych

Repozytorium udostępnia `createAlias(phrase, productId)`, `resolveAlias(phrase)`, `listAliases()`, `removeAlias(phrase)`. Alias powstaje tylko po jawnym zapisie w Voice Test Lab, wskazuje istniejący produkt, długość znormalizowanej frazy 3–114. Zwykły wybór zapisuje odrębną pamięć dopasowań, nie alias.

Wykorzystujemy istniejące IndexedDB v2: binding w `meta` (`alias:<fraza>`) i pin produktu w `selections` (`alias <fraza>`). Nie podnosimy wersji DB. Pin jest wyłączony z limitu 200 zwykłych fraz i chroni produkt przy czyszczeniu cache. Usunięcie aliasu usuwa także pin. Stare odmienione klucze pamięci są odczytywane i agregowane według nowej kanonizacji; nie resetujemy danych z Etapu 4.

## Lab, historia i prywatność

`voice-test-lab.html` ma 50 scenariuszy (pierwsze 20 odpowiada liście akceptacyjnej), nagrywanie lub tekst, expected/actual, tokeny, segmenty, intencje, resolution/confidence, SHA i werdykt PASS/REVIEW/FAIL. PASS oznacza zgodność **struktury** z wybranym scenariuszem, nie potwierdza realnego produktu OFF. Lab używa lokalnego resolvera bez automatycznych requestów OFF. REVIEW oznacza potrzebę oceny/uzupełnienia; FAIL — wyjątek wykonania. Własny tekst należy porównać z odpowiednim scenariuszem.

`analysis-history.js` przechowuje maks. 20 ostatnich analiz w localStorage `benger.<namespace>.analyses.v1` (`benger.local.analyses.v1` bez preview). Zapis: timestamp, SHA, raw, normalized, liczba intencji i nierozpoznanych pozycji. Nie zapisuje audio i niczego nie wysyła. Historia może zawierać prywatną treść wypowiedzi; można ją usunąć lub pobrać JSON. Błąd diagnostycznego zapisu nie blokuje dziennika. Usunięcie historii nie usuwa wpisów żywieniowych.

Preview Etapu 5 ma własny localStorage i IndexedDB (`preview-etap-5`), nie korzysta z danych wersji głównej ani Etapów 3/4. Builder publikuje wyłącznie `PUBLIC_ASSETS`, dopisuje SHA do modułów i zmienia wyłącznie `previews/etap-5/`. Nie ma nowego backendu, AI, service workera ani sekretów.

## Weryfikacja

```sh
npm test
npm run test:browser
node scripts/benchmark-voice.mjs
git diff --check
```

Korpus zawiera 116 unikalnych jawnych zdań: 66 istniejących + 50 nowych, ponadto 400 generowanych kombinacji produktów, ilości, separatorów i szyku. Testy sprawdzają dane intencji, brak przesuwania ilości, warianty, aliasy i zgodność starej pamięci. Testy browser sprawdzają pięć wymaganych wypowiedzi, pełny mikrofon→edycja→zapis→reload, historię, XSS aliasu, sześć szerokości ekranu i regresje Etapów 1–4. OFF i mikrofon są mockowane w CI; nie udajemy realnego testu Samsungiem.

Benchmark mierzy 1000 analiz językowych po 100 rozgrzewkowych, bez resolvera/IndexedDB/sieci. Pomiar lokalny na Node v22.23.4: 41,80 ms łącznie, średnio 0,042 ms/analizę. Wynik zależy od procesora i Node; skrypt wypisuje wersję i czas. Nie oznacza to czasu transkrypcji lub OFF.

## Akceptacja na prawdziwym telefonie i ograniczenia

Otwórz preview Etapu 5, sprawdź SHA, powiedz „250 ml mleka”, potem pełne śniadanie bez przecinków. Oceń tekst, porcje, wybierz warianty, popraw jeden wiersz i zatwierdź. Odśwież; sprawdź wpisy, ulubione i ostatnie. W labie sprawdź pozostałe scenariusze; diagnostyka speech nadal pokazuje surowe eventy z urządzenia.

Parser ma skończony słownik rodzin i odmian; nie wszystkie zdania bez separatorów są jednoznaczne. Nie ma przeliczania sztuk na g, pojemności na masę ani kaloryczności z samej nazwy. OFF, Chrome Speech i sieć mogą być niedostępne; dane lokalne pozostają dostępne, lecz bez service workera nie gwarantujemy zimnego startu offline. localStorage nadal ma zaakceptowany wyścig dokładnie równoczesnych zapisów. Statystyczna pamięć nie jest modelem AI. Przed PR wymagany jest test akceptacyjny na Samsungu; żaden PR nie jest tworzony automatycznie.

## Końcowy self-review względem main

Naprawiono przechodzenie kontekstu „mili” przez spójnik i przez inny produkt; drugi płyn korzysta z własnego kontekstu. Usunięto powielony słownik fleksji. Dostęp do słownika używa `Object.hasOwn`, więc nazwy `constructor` i `__proto__` pozostają tekstem. Etykieta przybliżenia aktualizuje się po edycji porcji. Testy obejmują stare odmienione klucze pamięci bez migracji, zachowanie pinów aliasów po 205 innych wyborach oraz jawny wybór dwóch konkurencyjnych wariantów mleka. Historia ma limit długości tekstów i 20 rekordów. Dane z API, transkrypcji i aliasów trafiają do DOM przez textContent/createTextNode. Nie zmieniono formatu historycznych snapshotów, wzoru obliczeń ani adaptera mowy.
