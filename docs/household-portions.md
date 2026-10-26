# Etap 7 — porcje domowe

## Granice odpowiedzialności

`SpeechRecognition` pozostaje bez zmian. `normalizeTranscript()` i `understandMeal()` rozpoznają ilość, jednostkę i nazwę, ale nie znają mas porcji. `ProductResolver` ustala tożsamość produktu. Dopiero `portion-resolver.js` otrzymuje konkretny produkt, definicje z `repository.portions`, ustawienia naczyń oraz oryginalną ilość. Jego wynik trafia do istniejącego `calculatePortion()`. `sumNutrition()` sumuje podgląd. Analiza nigdy nie zapisuje posiłku automatycznie.

Pipeline:

`głos/tekst → normalizacja → FoodIntent → ProductResolver → PortionResolver → g/ml → nutrition → propozycja → zatwierdzenie → snapshot`

`FoodIntent.amount/unit` nadal oznaczają pierwotną porcję. `item.portion.amount` jest ilością w jednostce produktu. Confidence struktury wypowiedzi, produktu i konwersji są osobne. LOW produktu albo konwersji blokuje zapis. Sam dobry parser nie potwierdza produktu ani masy.

## Kontrakt i pierwszeństwo

Przykład definicji konkretnego produktu:

```json
{
  "id": "usda:171413:portion:88667",
  "productId": "usda:171413",
  "unit": "tablespoon",
  "amount": 1,
  "normalizedAmount": 13.5,
  "normalizedUnit": "g",
  "source": "USDA",
  "description": "undetermined · tablespoon"
}
```

Definicja źródłowa USDA zachowuje też `evidence`: FDC ID, oryginalne amount, nazwę miary, portion description, modifier i gram weight. Brakujące/nieznane miary pozostają diagnostyką, nie konwersją.

1. Jawnie zapamiętana definicja USER dla dokładnego `productId + unit`.
2. Definicje konkretnego produktu: USDA, OFF albo własne definicje produktu custom. Kilka rozmiarów wymaga wyboru; kolejność w pliku nie jest regułą wyboru.
3. STANDARD_VOLUME: łyżeczka 5 ml, łyżka 15 ml, tylko przy nutrition basis `ml`. Szklanka/kubek tylko po ustawieniu swojej pojemności.
4. PACKAGE: masa/objętość całego konkretnego opakowania, w zgodnej jednostce produktu.
5. NONE/LOW: użytkownik wybiera definicję albo podaje g/ml dla jednej porcji.

Źródłowe opakowanie jest normalną definicją typu `package`; nie konkuruje ze sztuką lub kromką. Nie przeliczamy g↔ml ani nie tworzymy globalnych mas łyżki, kromki, jajka, garści czy miarki. Angielskie `slice` może oznaczać kromkę lub plaster tego samego dokładnego produktu; oba polskie określenia korzystają z tej samej źródłowej miary bez przenoszenia jej do innego produktu.

Wynik konwersji zawiera inputAmount/inputUnit, normalizedAmount/normalizedUnit, source, confidence, description i kopię użytej definicji. `normalizedAmount = inputAmount × definition.normalizedAmount / definition.amount`; dzielenie przez źródłowy count jest konieczne np. dla 3 ciastek lub 2 łyżek. Nie zaokrąglamy obliczeń.

## USDA: import i ładowanie

`read-usda-csv.py` odczytuje oficjalne `food_portion.csv` oraz `measure_unit.csv` z tych samych trzech zweryfikowanych archiwów co makro. Nie hardkoduje identyfikatorów miar. Foundation zwykle podaje amount i nazwę miary, SR Legacy często modifier, a FNDDS pozostawia amount puste i podaje je w opisie. Adapter obsługuje jawne liczby, ułamki oraz liczby mieszane w początku tego opisu. Niezrozumiałego opisu nie zgaduje. Dodatnie masy/count, limity, spójność produktu i jawne miary są walidowane; oczywiste duplikaty są usuwane.

Build: `node scripts/build-generic-food-catalog.mjs --refresh`. Testy używają fixture i istniejących statycznych danych; nie pobierają USDA z internetu. Refresh działa w osobnym workflow i zachowuje URL oraz SHA256 archiwów. Stare wygenerowane chunki nieobecne w nowym indeksie są usuwane tylko z katalogu builda.

Katalog produktów zachowuje 13 727 rekordów. Porcje są w osobnym `portion-index.json` i plikach `portion-NNNN.json`, bez setek definicji w Product. `getPortions(productId)` wczytuje indeks i potrzebny chunk; LRU zatrzymuje najwyżej 4 chunki. Nie wczytujemy wszystkich definicji do RAM przy starcie. Całość mieści się w istniejącym limicie precache 20 MiB i jest dostępna offline po przygotowaniu PWA. Wersjonowanie SW obejmuje także zmiany danych porcji. Zmiana danych nigdy nie przelicza historycznego dziennika.

## Open Food Facts

Ten sam request product/search pobiera dodatkowo `serving_size`, `serving_quantity`, `serving_quantity_unit`, `product_quantity`, `product_quantity_unit` i `quantity`. Nie odpytujemy OFF dodatkowo dla porcji. Dane strukturalne mają pierwszeństwo. Tekst jest akceptowany wyłącznie w ograniczonych jednoznacznych formatach: np. `1 slice (35 g)`, `2 slices (70 g)`, `150 g`, `6 x 50 g`. Nie rozumiemy dowolnego języka opisowego etykiety.

Multipack `6 x 50 g` definiuje całe opakowanie 300 g. Nie definiuje sztuki jako 300 g, ani nie domyśla się, czy „opakowanie” oznacza pojedynczy pojemniczek. W takim przypadku użytkownik może zdefiniować własną miarę. Gdy baza produktu jest w g, deklaracja w ml nie jest używana bez gęstości. Nie zmieniamy endpointów OFF, identyfikacji aplikacji, limitów ani działającej ścieżki wyszukiwania.

## UX, pamięć i własne produkty

W propozycji ilość i polska jednostka domowa są edytowalne. Podgląd pokazuje np. **2 łyżki · 27 g**, makro i źródło konwersji. Rozmiary jajek/owoców oraz różne warianty kromki są osobnymi wyborami. Przeliczenie jest ogłaszane przez aria-live; pola mają etykiety, przyciski co najmniej 44 px i widoczny focus.

Przy braku danych użytkownik podaje wagę/objętość jednej porcji dla tego produktu i wybiera **Użyj raz** lub **Zapamiętaj dla tego produktu**. Tylko drugi wariant zapisuje definicję. Zwykła korekta g/ml nie uczy aplikacji masy kromki. Zmiana liczby porcji przelicza podgląd, a zmiana produktu wczytuje jego definicje i unieważnia poprzedni wybór. Inne wiersze pozostają zachowane.

`ProductPortionMemory` to rekordy `meta` IndexedDB `portion:<productId>:<unit>`. Jawny zapis zastępuje wcześniejszą pamięć tej miary dla tego produktu. Nie tworzy „podobnych” porcji w innych produktach. Limit: 2000 zapamiętanych definicji. Ustawienia `portion-settings` zawierają wyłącznie opcjonalne cupMl/mugMl, do 2000 ml. Sekcja **Moje porcje i naczynia** pozwala odczytać, edytować i usunąć pamięć. Starsze odmiany osobistych aliasów pozostają odczytywalne bez usuwania rekordów użytkownika.

Własny produkt ma rozwijaną sekcję **Porcje tego produktu**: typ, ilość g/ml na jedną porcję, opcjonalna nazwa oraz wielkość całego opakowania. Masa porcji jest niezależna od makro na 100. Usunięcie/edycja produktu nie zmienia snapshotów.

## Historia, backup, bezpieczeństwo

Dziennik zachowuje dotychczasowe amount/unit/nutrition oraz opcjonalne `displayPortion` i `portionConversion`. Zapis kopiuje dane; wyświetlanie i sumowanie nigdy nie używają aktualnego katalogu do przeliczania historii. Stare wpisy bez metadanych porcji są nadal poprawne. Nie usuwamy historycznych produktów ani danych dawnych notatek.

Backup schemaVersion 1 rozszerza opcjonalne `portionMemory` i `portionSettings` oraz snapshot porcji. Starsze backupy mają domyślnie pustą pamięć i ustawienia. Merge zachowuje istniejące definicje, replace zastępuje je po potwierdzeniu. Istniejący trwały journal i rollback obejmują nowe rekordy; błędny import nie pozostawia połowy danych. Walidujemy skończone liczby, jednostki, związanie z produktem, zgodność snapshotu, długości, liczbę rekordów, wielkość pliku i klucze prototype pollution. Źródłowe nazwy/opisy trafiają wyłącznie do textContent, nigdy innerHTML.

Preview ma osobny namespace `preview-etap-7` i scope `/Benger/previews/etap-7/`. Publikacja zmienia tylko ten katalog; wersja główna i preview Etapu 6 pozostają niezależne.

## Diagnostyka i testy

- [Preview](https://kubanik21-crypto.github.io/Benger/previews/etap-7/)
- [Portion Diagnostics](https://kubanik21-crypto.github.io/Benger/previews/etap-7/portion-diagnostics.html): wyszukaj i wybierz konkretny produkt, sprawdź wszystkie definicje, wynik i źródło.
- [Portion Test Lab](https://kubanik21-crypto.github.io/Benger/previews/etap-7/portion-test-lab.html): 20 scenariuszy na rzeczywistym katalogu i Twojej pamięci. LOW przy niepewnym produkcie/porcji jest poprawnym wynikiem; lab niczego nie zapisuje.
- `npm test`: corpus, generatywne własności, 20 acceptance cases z ustalonymi produktami, USDA, OFF, custom, backup i dotychczasowe regresje.
- `npm run test:browser`: pełne formularze, one-shot, pamięć, zmiany, offline, backup i stare funkcje. OFF/SpeechRecognition są mockowane.
- `node scripts/measure-household-portions.mjs /tmp/portions.json`: powtarzalny pomiar lokalnego Chromium, rozmiarów i ładowania. Nie zmienia danych użytkownika ani nie odpytuje OFF.

## Samsung acceptance

1. Powiedz „2 łyżki mleka”; dla wybranego produktu z podstawą ml oczekuj 30 ml, a dla USDA g tylko jawnej źródłowej masy.
2. „2 łyżki oliwy”; wybierz Oil, olive, salad or cooking USDA i oczekuj 27 g.
3. „2 jajka”; wybierz konkretny produkt i rozmiar, np. large 50 g → 100 g. Bez wyboru nie zapisuj.
4. „3 kromki chleba”; wybierz konkretny chleb, sprawdź źródło lub uzupełnij wagę.
5. Zapamiętaj 1 kromka = 38 g dla tego chleba.
6. Powtórz „3 kromki mojego chleba” po utworzeniu aliasu; oczekuj 114 g także po odświeżeniu.
7. „Pół opakowania” produktu z deklaracją 150 g → 75 g.
8. Mieszane śniadanie: jajka, kromki i łyżeczka masła; brak jednej porcji nie może wyczyścić pozostałych wierszy.
9. Po przygotowaniu PWA wyłącz internet, otwórz ponownie i sprawdź pamięć porcji oraz USDA.
10. Sprawdź naturalny głos na Samsungu. Headless Chromium nie potwierdza jakości rzeczywistego mikrofonu.

Ograniczenia: nie wszystkie rekordy USDA mają rozpoznawalne miary; brakujące porcje wymagają użytkownika. Nie interpretujemy dowolnych opisów OFF ani gęstości. Szkło użytkownika w ml nie przelicza produktu z bazą g. Rozmiar źródłowy może wymagać jawnego wyboru; nie zgadujemy na podstawie podobnej nazwy. OFF nadal wymaga sieci dla niezapisanego produktu, SpeechRecognition nie gwarantuje offline. localStorage nadal ma zaakceptowane ograniczenie dokładnie równoczesnego zapisu w dwóch kartach. Nie dodano AI, backendu, kont ani synchronizacji urządzeń.
