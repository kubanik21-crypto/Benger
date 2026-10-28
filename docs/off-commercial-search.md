# Wyszukiwanie produktów handlowych — audyt i poprawka

## Przyczyna

Formularz przekazywał checkbox OFF jako `forceExternal`. Opcja wyłączała preferowanie lokalnego USDA/custom, ale nie wyłączała 15-minutowego cache zapytania. `getSearch()` zwracało świeży wynik, a repozytorium kończyło pracę przed `searchProvider.searchProducts()`. UI pokazywało status `cached` jako „Wyniki z pamięci”. W tym konkretnym przebiegu nie było nowego requestu OFF, błędu CORS ani odpowiedzi odrzuconej przez normalizator. Nie znamy pochodzenia ani kompletności wcześniejszej odpowiedzi zapisanej na telefonie; sam opis użytkownika tego nie rozstrzyga.

Dodatkowo checkbox wyłączony nie był twardym zakazem sieci: przy braku lokalnych USDA/custom stara ścieżka nadal mogła wysyłać request. Repozytorium używało także `parseProductQuery().normalizedQuery` jako tekstu dla OFF, co usuwało polskie znaki i stosowało reguły lokalnego resolvera do nazwy handlowej.

## Nowy przepływ

- Formularz OFF włączony: `forceExternal:true`, `refreshExternal:true`, `allowExternal:true`. Świadomy submit odczytuje lokalne produkty, ale nie kończy na cache zapytania. Używa także fetch `cache:'no-store'`, bez dodawania ręcznych nagłówków Cache-Control/preflight. Wysyła oryginalną frazę (tylko trim/scalenie spacji), łączy wyniki API z lokalnymi, deduplikuje i rankuje maksymalnie 20 pozycji.
- Formularz OFF wyłączony: `allowExternal:false` gwarantuje brak requestu, nawet bez lokalnego dopasowania.
- `forceExternal` bez `refreshExternal` zachowuje dotychczasowy cache dla innych konsumentów repozytorium. Nie zmieniamy budżetu resolvera/voice/recipe.
- Powtórzenie submita za szybko nadal respektuje współdzielony limit 6500 ms, limiter między kartami i HTTP 429. Nie obchodzimy limitów i nie wykonujemy automatycznych serii wariantów query. UI jawnie wyjaśnia ograniczenie; po odczekaniu nowy submit ponownie odpytuje OFF.
- Wynik online, zero wyników API, błąd sieci i liczba odrzuconych rekordów są odróżniane. Niepełnych makro nie wymyślamy. Cache nadal przyspiesza odczyt produktu/barcode i działa jako fallback.

## Marka + nazwa + nazwa ogólna

Zweryfikowano oficjalny kod serwera OFF:

- https://github.com/openfoodfacts/openfoodfacts-server/blob/main/cgi/search.pl — `search_terms` rozbijane na słowa, normalizowane po stronie OFF i wyszukiwane jako `_keywords.$all`.
- https://github.com/openfoodfacts/openfoodfacts-server/blob/main/lib/ProductOpener/Products.pm — `compute_keywords` buduje wspólny indeks z `product_name`, `generic_name`, `brands` oraz kategorii, pochodzenia i etykiet. Indeks obejmuje główny język rekordu.

Nie jest to literalne porównanie frazy wyłącznie z `product_name`. Jedno zapytanie obejmuje pola marki i obu nazw. `Mięsne Specjały mięso mielone wieprzowo wołowe` pozwala łączyć ich słowa w jednym requestcie. Dopisanie/zmiana nazwy tworzy nowe zapytanie; nie ograniczamy go do poprzednio zapamiętanych kiełbasek.

Nadal używamy sprawdzonego `/cgi/search.pl`, v3.6 jako formatu odpowiedzi i tylko `Accept: application/json` dla wyszukiwania. URLSearchParams koduje polskie znaki i spacje. Nie dodajemy custom headerów wywołujących preflight. Product API barcode zachowuje istniejącą konfigurację identyfikacji. Service worker obsługuje tylko własne, jawnie wymienione assety tego samego origin — nigdy requesty do OFF.

## Barcode 28037989

To poprawny kod EAN-8. Lookup nie wykonuje text search. OFF 404/status 0 oznacza jawny komunikat „Nie znaleziono produktu o tym kodzie w Open Food Facts” i przyciski „Wyszukaj po nazwie” / tworzenie własnego produktu z podanym kodem. Istniejący rekord bez prawidłowych makro jest osobnym błędem `nutrition`, a nie fałszywym komunikatem o nieistnieniu produktu.

## Dowody i ograniczenia

Nowe testy repozytorium i Chromium odtwarzają zapamiętaną pojedynczą kiełbaskę, a następnie nową odpowiedź z mięsem mielonym; sprawdzają rzeczywiste requesty fetch, oryginalne polskie frazy, odpowiedzi puste, błędy sieci, wyłączenie OFF oraz EAN-8 i przyciski. Dane OFF są fikcyjnymi fixtures, nie dowodem dostępności konkretnego mięsa w publicznej bazie.

Bezpośredni request produkcyjny do OFF z tego środowiska zakończył się HTTP 000 / blokadą połączenia proxy. Nie potwierdzamy więc, że publiczne OFF aktualnie zawiera kod 28037989 ani żądany produkt. Po wdrożeniu potrzebny jest pomiar z telefonu. Limit pierwszych 20 wyników i braki danych/indeksu OFF nadal obowiązują; precyzyjniejsza nazwa lub kod zawężają wyniki.

Wdrożenia wymaga frontend wraz z nowym cache PWA. Worker AI, OCR, zdjęcia etykiet i produkcyjne dane użytkownika pozostają nietknięte. Poprawka jest na osobnej gałęzi, bez merge/publikacji na main.

## Preview telefonu

Adres testowy: https://kubanik21-crypto.github.io/Benger/previews/off-commercial-search/

Istniejący, ograniczony publisher preview jest skierowany wyłącznie na gałąź `fix/off-commercial-search` i jej podkatalog. Produkcyjny workflow pozostaje bez zmian. Namespace danych `preview-off-commercial-search` oraz scope SW `/Benger/previews/off-commercial-search/` izolują testy od produkcji i starszego preview globalnego resolvera. Gałąź bazuje na scaleniu globalnego resolvera `963d8df` i zawiera `4ec45df`.

Po testach workflow buduje frontend i publikuje tylko ten katalog. Na działającym Pages uruchamia Chromium: sprawdza globalny resolver/dziennik/przepis/offline, następnie rzeczywiste (niemockowane) GET do OFF dla marki, nazwy, kombinacji i sosu. Powtarza tę samą frazę po przerwie budżetu zapytań i porównuje OFF włączone/wyłączone. Zapisuje URL, HTTP, komunikat, wynik kodu EAN-8 oraz błędy sieci w raporcie Actions. Nie traktuje awarii zewnętrznego OFF jako dowodu istnienia/nieistnienia produktu. W razie HTTP 429 respektuje cooldown i pomija dalsze live requesty. Zachowanie „nie znaleziono” i obie akcje formularza są dodatkowo sprawdzane na deterministycznych mockach uruchomionych na tym samym artefakcie preview.
