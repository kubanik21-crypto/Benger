# Etap 9 — przepis jako zjedzony posiłek i hardening

## Architektura

Recipe nadal nie jest Product. RecipeRepository przechowuje przepisy, a istniejący ProductRepository nadal obsługuje OFF/USDA/custom/cache. RecipeResolver jest małym lokalnym modułem dopasowania nazw; nie przepisuje ProductResolver i nie wykonuje fetch. Wspólny orchestrator w meal-resolution sprawdza Recipe, następnie używa dotychczasowego ProductResolver dla pozycji produktowych. Gotowanie i rozpoznawanie składników przepisu pozostają produktowe — nie tworzymy przypadkowo zagnieżdżonych przepisów.

MealProposalItem ma opcjonalne kind=RECIPE; stare pozycje są produktami. Wiersz przepisu ma resolution.recipe, alternatywy i snapshot porcji. Wiersz produktu zachowuje dotychczasowy kontrakt. Dwa osobne renderery kart korzystają ze wspólnego formularza ilości/posiłku i sumowania makro. Mixed meal zachowuje jeden budżet automatycznego OFF dla produktów, zero requestów dla przepisów. Nie tworzymy Recipe w stores produktów ani nie pobieramy przepisu użytkownika z internetu.

## Dopasowanie i preferencje

1. Jawny alias przepisu → HIGH.
2. Dokładna jednoznaczna nazwa → HIGH.
3. Jawne „mój/moja/moje/mojego/mojej” dopuszcza jednoznaczny odpowiednik bez tego przedrostka → HIGH.
4. Konserwatywne dopasowanie tokenów → MEDIUM i wybór użytkownika.
5. Kilka kandydatów → LOW i wybór; brak kandydata pozostaje unresolved.

Polskie formy typowych nazw, np. rosołu/bigosu/carbonary, mają ograniczone deterministyczne mapowanie. Nie stosujemy swobodnego fuzzy ani automatycznego aliasowania. „Curry” nie wybiera „Moje curry” spośród innych curry. Ostatnie/ulubione sortują kandydatów, lecz nie podnoszą niejednoznaczności do HIGH. Jawny dawny alias produktu z „mój” nadal działa. Przy niedostępnej pamięci przepisów znany lokalny produkt może działać, ale nie wysyłamy prywatnej nierozpoznanej frazy do OFF.

Alias zapisuje się jawnie na szczegółach lub przy wyborze w propozycji; można go usunąć. Preferencje są w istniejącym meta: recipe-alias:<phrase>, recipe-usage:<recipeId>. Usage zawiera favorite i lastUsedAt. Nie wymaga to nowej migracji IndexedDB (nadal v3). Usunięcie przepisu i aktywnych aliasów/usage jest jedną transakcją. Historyczne wersje i dziennik pozostają.

## Porcje i snapshoty

RecipePortionResolver dopuszcza wyłącznie READY z poprawnym kompletnym nutrition. Obsługiwane tryby:

- serving: total × consumedAmount / yield.servings;
- g: total × consumedAmount / yield.finalWeight;
- ml: total × consumedAmount / yield.finalVolume.

Nie ma przeliczenia g↔ml, gęstości, domyślnej wagi porcji ani zastępowania finalWeight masą surowych składników. Ilości muszą być dodatnie, finite i ograniczone. Pół/ćwierć/półtora/półtorej/liczby z przecinkiem wykorzystują istniejący MealUnderstanding/TranscriptNormalizer.

INCOMPLETE można znaleźć, ale nie zapisać jako policzonej porcji. Brak właściwej wydajności również blokuje zapis. Wartości total i B/T/W skalują się bez wewnętrznego zaokrąglania.

Nowy wpis ma kind=RECIPE, sourceType=recipe, recipeId, recipeVersion, recipeName, recipeYieldSnapshot, amount, unit, nutrition oraz wspólne id/date/meal/createdAt. amount/unit oznaczają spożytą ilość. Nie udajemy productId. Produktowe stare wpisy nie są migrowane. Wspólny validator rozróżnia oba warianty i odrzuca mieszaną/malformed tożsamość oraz niefinitywne i nadmierne makro.

Snapshot jest samowystarczalny: edycja v1→v2 i usunięcie przepisu nie zmieniają dawnego wpisu. Nowe dodanie pobiera aktualny przepis, nie recipeHistory. Zmiana wersji podczas otwartego podglądu odświeża wartości i wymaga ponownego potwierdzenia. Usunięcie przed zapisem blokuje nowe dodanie. Duplikat ma niezależne ID/provenance.

## UX

Głos pozostaje główną akcją. „Porcja mojego curry i 200 ml mleka” daje dwa rodzaje pozycji w jednej propozycji. Przed zapisem wszystkie pozycje muszą mieć porcję i posiłek. Cały zestaw jest przygotowany i walidowany przed pojedynczym setItem; błąd lub unresolved oznacza zero zapisanych pozycji. Blokada saving zapobiega podwójnemu tapnięciu.

Szczegóły przepisu mają „Dodaj do dziennika”: dialog z dniem, posiłkiem, ilością, podglądem i dostępnymi jednostkami. Domyślnie 1 porcja, jeśli istnieje servings; w innym przypadku jednostka g lub ml bez wymyślonej ilości. Anuluj/Escape nie zapisują. W Produktach jest zwinięta wyszukiwarka zapisanych przepisów; ulubione i ostatnie są wyżej. To lokalny wybór, nie nowa sekcja katalogu internetowego.

Dziennik i historia dni sumują wspólne nutrition. Nazwa i „Twój przepis · vN” pochodzą ze snapshotu, bez odczytu live Recipe przy renderze.

## Backup i trwałość

SchemaVersion pozostaje 2: dodano opcjonalne recipeAliases/recipeUsage, a warianty wpisów są jawnie walidowane. Obsługiwany jest import v1/v2 bez nowych pól. Merge zachowuje istniejące dane; replace wymaga świadomego potwierdzenia. Stare aplikacje nie muszą obsługiwać nowych backupów — zgodność jest w kierunku importowania starych kopii przez nową aplikację.

Eksport/import UI czeka na autosave, uczenie wyborów i zapisy recent. Wykryty w regresji wyścig uczenia z eksportem został usunięty. Journal/rollback nadal obejmuje IndexedDB i localStorage. Usunięty przepis nie jest wymagany do importu dawnego wpisu dziennika.

QuotaExceededError ma czytelny komunikat, bez udawania sukcesu: dziennik pozostaje bez częściowego zapisu, szkic zachowuje poprzedni trwały stan i edycję w pamięci, custom nie zamyka formularza, import odrzuca zmianę/wykonuje rollback. Opcjonalne navigator.storage.estimate pokazuje orientacyjną zajętość; „Chroń dane lokalne” wywołuje persist dopiero po kliknięciu. Nie zastępuje to backupu.

## Routing, PWA, bezpieczeństwo

navigate nie emituje syntetycznego hashchange. Renderuje zmianę od razu, a natywny hashchange jest deduplikowany po aktualnym route. Przejście, focus i benger:route występują raz. Back/forward i zmiana hash linkiem używają tego samego renderera; aktualny route jest bezpiecznym no-op.

Service worker pozostaje w dotychczasowym modelu: wersjonowany kompletny app shell, aktualizacja tylko po działaniu użytkownika i czyszczenie wyłącznie własnych cache. Nowe pliki są w public-assets/sw-assets. Preview ma scope /Benger/previews/etap-9/ i namespace preview-etap-9. Root i Etap 8 nie są nadpisywane. Dane Etapu 8 używają tego samego modelu i DBv3; nie są usuwane przy wymianie shell.

Nazwy, aliasy, etykiety, dane OFF/custom/import są niezaufane; renderowanie używa textContent/value, bez dynamicznego innerHTML. Nadal działają limity JSON i ochrona prototype pollution. Nie dodano zależności, źródła danych ani sekretu. Atrybucje USDA, OFF/ODbL i lokalne notices ZXing pozostają. Infrastruktura pozostaje bezpłatna w obecnym modelu GitHub Pages; brak backendu, telemetrii, AI i uploadu przepisów. SpeechRecognition pozostaje usługą przeglądarki i może wymagać sieci.

## Ograniczenia

localStorage nadal ma zaakceptowany race condition przy dokładnie równoczesnym zapisie dwóch kart. Import wymaga zamknięcia innych kart. Nie ma kont/synchronizacji urządzeń. Nieznana odmiana nazwy wymaga jawnego aliasu lub wyboru; brak makro/wydajności wymaga edycji przepisu. Brak automatycznego logowania INCOMPLETE. Nie obiecujemy offline SpeechRecognition. Pomiary headless nie zastępują Samsunga. Zachowano limity 1000 przepisów/100 szkiców/2000 wersji i 10 MiB backupu.

## Samsung — real-device acceptance

1. Zrób backup, zaktualizuj produkcyjną PWA po przyszłym wydaniu (teraz testuj oddzielny preview).
2. Sprawdź dotychczasowy dziennik, produkty, aliasy i porcje.
3. Sprawdź listę przepisów, historię wersji i szkice.
4. Powiedz „1 porcja mojego curry”, sprawdź wartości i zatwierdź.
5. Powiedz „porcja mojego curry i 200 ml mleka”; sprawdź jeden zapis całego posiłku.
6. Dodaj przepis przyciskiem w szczegółach; zmień dzień/posiłek/jednostkę.
7. Edytuj przepis i zapisz nową wersję.
8. Sprawdź, że dawny wpis dziennika zachował stare makro i wersję.
9. Po gotowości offline wyłącz sieć, odśwież i dodaj lokalny przepis.
10. Wyeksportuj backup i sprawdź odtworzenie na osobnym preview po potwierdzeniu.

Nie opublikowano zmian w produkcyjnym main. Nie utworzono PR i nie wykonano merge.
