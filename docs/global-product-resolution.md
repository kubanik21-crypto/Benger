# Globalne rozpoznawanie produktów

## Audyt wejść

| Miejsce | Poprzednia ścieżka / problem | Obecna ścieżka |
|---|---|---|
| Dziennik: śniadanie, obiad, kolacja, przekąska | Jeden formularz `voice-entry`, parser ilości `meal-understanding`, istniejący ProductResolver. To nie były cztery niezależne silniki. | `normalizeProductInput` → wspólne parsowanie pozycji → `resolveMealIntents` → `resolveProductQuery`. Posiłek jest tylko metadanymi. |
| Wyszukiwarka produktów | ProductRepository + `product-model.searchProducts`: dosłowne substringy. Później oddzielna próba starego resolvera. | Repozytorium i resolver korzystają ze wspólnego `canonicalProductName` / `rankProductCandidates`; UI wywołuje publiczne API resolvera. |
| Kalkulator porcji / skaner | Używał już konkretnego Product/ID/barcode, bez własnego matchera nazw. | Bez nowego matchera: tożsamość z katalogu/resolvera, ilości z PortionResolver, makro z calculatePortion. Barcode pozostaje dokładnym lookupem. |
| Gotowanie, tekst i wklejone składniki | RecipeUnderstanding miał dodatkowe odmiany nazw i konwersje ilości; ProductResolver później sprawdzał słowa po polsku również przeciw angielskim nazwom USDA. | RecipeUnderstanding tylko klasyfikuje zdarzenie (składnik/krok/uzysk), normalizacja i gramatyka ilości pochodzą ze wspólnego modułu. RecipeSession używa tego samego resolveMealIntents co dziennik. |
| Ręczne dodawanie i poprawa składnika | Picker korzystał z searchProducts i osobnego wywołania starego API, zawsze żądając kliknięcia produktu. | Publiczne resolveProductQuery; oczywisty produkt zaznaczany automatycznie. Formularz nadal wymaga ilości lub właściwej definicji porcji. |
| Poprawianie produktu w propozycji przepisu | Wyniki searchProducts zawsze jako lista wyboru. | Wspólny resolver wybiera oczywiste dopasowanie; lista pozostaje przy niejednoznaczności. |
| USDA | Oddzielny słownik PL→EN i indeks angielskich tokenów, bez części nazw/odmian. | Słownik semantyczny przeniesiony do wspólnego product-vocabulary; indeks nadal służy wydajnemu pobieraniu kandydatów, nie jest drugim silnikiem decyzji. |
| Backup/import zapisanych danych | Walidacja snapshotów, nie wyszukiwanie nazw. | Nie dopasowuje ponownie historycznych wpisów. Makro i ID pozostają snapshotami. |
| Przepisy jako gotowe dania | RecipeResolver dopasowuje nazwy zapisanych przepisów. | Pozostaje oddzielny od produktów: Recipe nie jest Product. Nazwy przepisów nie są przepuszczane przez fleksję produktów przed szukaniem Recipe. |
| Conversational editor | Został odłożony i usunięty na życzenie użytkownika. | Brak osobnego matchera, backendu lub AI. Przyszły interfejs powinien użyć tego samego publicznego API. |

## API

```js
const resolver = createProductResolver({repository});
const result = await resolver.resolveProductQuery('200 g marchewki', {allowExternal:false});
// query/rawText: oryginał, normalizedQuery/canonicalName: 'marchew'
// parsedAmount: 200, parsedUnit: 'g'
// bestMatch: rzeczywisty Product albo null
// candidates: Product[], confidence: 0–1, status: matched | ambiguous | unmatched
```

Można też importować `resolveProductQuery(query,{repository})` z `product-resolver.js`. Starsze `resolve(intent)` pozostaje kompatybilnym API; jest adapterem tej samej tożsamości produktu, nie kopią matchera. Jego dawne stringowe confidence/reason zachowano dla starych integracji. Publiczne API odczytuje nazwę niezależnie od jednostki; niezgodność g/ml blokuje przeliczenie porcji, nie znalezienie produktu.

## Jedna ścieżka językowa

- `normalize-text.js`: wspólna normalizacja znaków i wielkości liter.
- `product-query.js`: przeniesiona dotychczasowa gramatyka pojedynczej pozycji (ilość/jednostka/issues), wspólna dla posiłków i przepisów. Korzysta z istniejącego silnika liczb polskich i normalizacji mowy. Przelicza kg→g, l→ml, nigdy g↔ml.
- `product-matching.js`: jedna kanonizacja nazw i ranking dla wszystkich wejść. Istniejący leksykon jest wykorzystywany ponownie, produktywne końcówki sprawdzane względem znanych lematów, a mała mapa synonimów definiuje pojedyncze lematy (np. kartofel). Nie dodajemy tabeli wszystkich odmian każdego produktu.
- Fuzzy: jedna edycja dłuższego tokenu, tylko jednoznaczna korekta do znanego leksykonu; dodatkowo ostrożne porównanie tokenów kandydatów. Krótkie niejednoznaczne słowa i nieznane marki nie są dowolnie poprawiane.
- `product-vocabulary.js`: jeden słownik pojęć PL→EN wspólny z lokalnym katalogiem USDA. Nazwy angielskie USDA nie są traktowane jak polskie słowa do odmiany.
- `product-resolver.js`: źródła, jawne aliasy i pamięć użytkownika, zgodność wariantów, decyzja matched/ambiguous/unmatched. Oczywista nazwa bez marki ma pierwszeństwo; różnice mleka, ciemny/jasny sos, mięso/część, procenty i smaki nie są ignorowane. Niepewne podobieństwa to propozycje, nie automatyczny produkt.

Ranking bierze pod uwagę dokładną nazwę, kanoniczny zestaw słów/synonimy, dopasowanie semantycznych tokenów PL/EN i ograniczony fuzzy. Stara pamięć wyborów i ulubione pozostają; aliasy zapisane pod dawną formą nadal działają, również z nową ilością w tekście. Nie uczymy nowych aliasów przez samo wnioskowanie.

Nie ma AI-assisted canonicalization, bo w aplikacji nie jest skonfigurowane AI. Wszystkie wartości pochodzą z ProductRepository; normalizacja nie posiada własnego katalogu makro.

## Przyczyny błędów

`marchewka` nie była tą samą frazą co `Marchew` w wyszukiwaniu substringowym. Dotychczasowy słownik miał niektóre formy (np. marchwi), ale nie zapewniał produktywnego rozpoznania marchewka/marchewki. USDA oczekiwało angielskiego `carrot`, a resolver porównywał potem polskie słowa z angielską etykietą.

Dla `sos sojowy` w słowniku zapytań USDA brakowało `sos → sauce` i `sojowy → soy`. Samo OFF nie zapewnia lokalnego znalezienia produktu przy braku sieci. Po poprawce lokalny indeks zwraca rzeczywiste rekordy Soy sauce; ranking preferuje sos, a nie np. sos orzechowy zawierający sos sojowy.

## Porcje i braki

`marchewka` może być matched bez ilości, ale zapis do dziennika wymaga porcji. `2 marchewki` to dwie sztuki, nie arbitralna masa. Łyżka sosu wymaga definicji porcji dla rzeczywistego produktu; nie zgadujemy gęstości. `15 ml` produktu o nutrition per100g może mieć poprawną tożsamość i nierozwiązaną porcję.

Brak produktu w przepisie pozostawia UNRESOLVED i niekompletne makro; szkic można kontynuować. W dzienniku nie zapisujemy nieznanych kalorii. Resolver daje podobne lokalne propozycje bez automatycznego wyboru; karta prowadzi też do katalogu, gdzie istnieje formularz własnego produktu.

## Testy i wdrożenie

`global-product-resolution.test.js`: wymagane formy, ilości cyframi/słownie, wspólne ID/makro w czterech posiłkach i przepisie, rzeczywisty indeks USDA bez sieci, aliasy historyczne, warianty, nieznane produkty i brak zgadywania masy.

`global-product-resolution.browser.test.js`: katalog, cztery rodzaje posiłków z zapisem, niejednoznaczne mleko, nierozwiązywalne porcje, tworzenie przepisu tymi samymi nazwami, ręczny picker z ilością i działanie po reloadzie offline.

Pełna regresja: `npm test`, `npm run test:browser`, `git diff --check`. Mockujemy OFF, nie pytamy produkcyjnego API w CI. Numery confidence są heurystyką dopasowania, nie statystyczną gwarancją. Nie obiecujemy znajomości każdej nazwy ani danych produktu, którego nie ma w źródłach.

Wdrożenia wymaga wyłącznie frontend (nowe moduły są na publicznej liście assetów i w cache SW). Nie ma Workera AI do wdrożenia. Ta gałąź nie jest scalana do main ani publikowana na produkcji.

Pełna regresja oraz osobny smoke test preview weryfikują wyszukiwanie, dziennik i przepisy, także dla formy `100 g mozarelli`. Zmiana jednostki g/ml czyści poprzednią ilość zarówno w propozycji posiłku, jak i w ręcznym formularzu przepisu — rozpoznanie produktu nie daje prawa do przyjęcia tej samej liczby w innej jednostce. Testy historyczne zachowano; oczekiwania starego testu pickera zaktualizowano do automatycznego rozpoznania oczywistej nazwy, a test g/ml nadal wymaga ponownego wpisania ilości.

## Izolowany preview telefonu

Workflow `Product resolution preview` działa wyłącznie po push na `feature/global-product-resolution`. Po pełnych testach buduje publiczny frontend z namespace `preview-global-product-resolution`, osobnym manifestem „Benger Test” i service worker scope `/Benger/previews/global-product-resolution/`.

Adres: https://kubanik21-crypto.github.io/Benger/previews/global-product-resolution/

Publisher może modyfikować wyłącznie ten podkatalog `gh-pages`; zachowuje produkcyjny root oraz inne preview. Publikacja jest serializowana z wydaniami produkcyjnymi, sprawdza aktualny SHA gałęzi i odrzuca artefakt o nieoczekiwanej zawartości. Testy sprawdzają zachowanie plików produkcji, namespace, manifest, pełny cache i odmowę lokalnego `--push`.

Po publikacji CI otwiera rzeczywisty adres Pages w Chromium, potwierdza build SHA, `resolveProductQuery`, sześć zapytań w katalogu/dzienniku/przepisie oraz offline reload. Ten smoke test używa rzeczywistego statycznego katalogu USDA, bez seedowania produktów i bez mockowania resolvera. Wyłącza wyszukiwanie zewnętrzne, więc nie zależy od dostępności OFF.

Wymagane porcje i rzeczywiste warianty produktu nadal wymagają jawnego uzupełnienia/wyboru. Produkcyjny main i Worker AI nie są wdrażane przez ten workflow. Następny normalny deployment main może usunąć preview zgodnie z dotychczasową polityką czyszczenia produkcji.
