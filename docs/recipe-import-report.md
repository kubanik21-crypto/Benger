# Raport etapu 4A — niezależny import przepisów

## Stan wyjściowy i analiza

Branch `feature/local-sync-export`, baza `2bf7a1e`, Android 1.0.16. Zachowano
wcześniejsze etapy eksportu, OAuth i automatyzacji Google Sheets; ich plików nie
przebudowano. Nie wdrożono produkcji i nie przygotowano ani nie opublikowano APK.

Aplikacja jest modułowym frontendem JavaScript z lokalną persistence; Android
uruchamia go w Capacitor/WebView, PWA korzysta z app shell/Service Workera.
Biblioteka Recipe jest w istniejącej IndexedDB (magazyn `recipes`), szkice w
`recipeDrafts`, wcześniejsze wersje w `recipeHistory`; produkty własne i warianty
są w `meta`. Dziennik żywieniowy ma osobne snapshoty w lokalnym zapisie. Pomiary
mają oddzielny magazyn progresu. Import nie zapisuje do tych źródeł historii.

`validateRecipe`, `normalizeCustomProduct`, `calculatePortion`,
`calculateRecipeNutrition`, walidacja i aplikowanie wariantów pozostają wspólnymi
modelami. Recipe Base → Variant z overrides i przypiętą wersją → Meal Snapshot
pozostaje dotychczasowym przepływem. Warianty nie zawierają stałego makro.

Istniejący import seedowy `RecipeRepository.importRecipes` tylko dodaje/pomija
rekordy; nie zapewnia wspólnej transakcji aktualizacji, produktów i wariantów.
Nowy importer używa istniejącego `ProductStorage.transact` na recipes/history/meta,
aby wykonać całą paczkę atomowo. Nie tworzy równoległej biblioteki, nowej bazy ani
magazynu. Edycja i używanie importowanych przepisów odbywa się zwykłymi ekranami.

## Zaimplementowane

- Import JSON v1 jednego lub 1–50 przepisów, z limitem 2 MiB i walidacją struktury,
  jednostek, identyfikatorów, wielkości liczb, głębokości i złożoności.
- Przepisy → Importuj przepisy: lokalny wybór pliku, podgląd i selekcja, błędy,
  ostrzeżenia, kompletne/niekompletne makro, duplikaty, świadome aktualizacje,
  warianty i atomowy zapis. Anulowanie podglądu niczego nie zapisuje.
- Stabilny UUID wyprowadzony z namespace/externalId; stabilne ID składników.
  Osobny numer wersji źródła, kontrola treści, lokalnych edycji i współbieżności.
- Aktualizacja bazy tworzy zwykłą wersję historyczną; nie zmienia starych posiłków.
  Przy przekroczeniu limitu historii nie usuwa jej automatycznie.
- Warianty UPDATE_AMOUNT/REMOVE wykorzystują istniejący model overrides.
  Warianty poprzedniej wersji i ich baza pozostają zachowane.
- Produkt jest wiązany po jawnym ID z lokalnego katalogu. Sama podobna nazwa
  nie wystarcza; istniejący resolveProductQuery dostarcza jedynie propozycje,
  z allowExternal:false. Nie stworzono nowego wyszukiwania.
- Nowe, poprawnie zadeklarowane per100 tworzą normalny produkt własny, w tej samej
  transakcji. Konflikty nigdy nie nadpisują istniejących produktów; nowy snapshot
  wymaga świadomego wyboru ostrzeganego wiersza.
- Jednostki domowe wymagają jawnej końcowej ilości bazowej. Nie zgadujemy mas,
  gęstości ani konwersji stanu surowy/gotowany. Całe makro liczy silnik Bengera.
  Deklaracje total/perServing są tylko asercjami, a unknown nie jest zerem.
- Opcjonalne `Recipe.importInfo` przechowuje zewnętrzną tożsamość/wersję/hash.
  Składnik zachowuje massState i źródło deklaracji. Pozostałe pola modelu bez zmian.
- Standardowy backup v8 zachowuje importowane dane, produkty, warianty i metadata;
  stare backupy nadal przechodzą walidację. Bez modyfikacji kodu/formatu backupu.

## Dokumentacja i pliki użytkownika

[Samowystarczalna specyfikacja dla czatu Dieta](recipe-import-spec.md) zawiera
pełny formalny schemat, jednostki, hierarchię danych odżywczych, wersjonowanie,
wszystkie przykłady i instrukcję generowania pliku bez dostępu do kodu.

Osobne pliki:

- [JSON Schema](recipe-import.schema.json)
- [Jeden przepis](examples/recipe-import/single.json)
- [Siedem przepisów](examples/recipe-import/seven.json)
- [Aktualizacja](examples/recipe-import/update.json)
- [Wariant](examples/recipe-import/variants.json)

Przykłady są jawnie szablonami z nieznanym makro, nie gotowym zweryfikowanym
jadłospisem. Liczb syntetycznych użyto wyłącznie do testów/ilustracji struktury,
nie przypisano ich prawdziwej żywności.

## Ograniczenia

- File picker i instalacja fizycznego Androida wymagają testu urządzenia po
  osobnej akceptacji testowego APK. Automatyczne testy Chromium nie zastępują go.
- Nie ma połączenia importera z Google Sheets, jadłospisów/dat/posiłków planu ani
  zapisu spożycia. Nie dodano nowych zakresów OAuth ani WorkManagera.
- W v1 warianty pliku obsługują UPDATE_AMOUNT/REMOVE. Pozostałe zmiany są dostępne
  po imporcie w zwykłym edytorze. UPDATE_AMOUNT wymaga rozwiązanego składnika.
- Tagi, źródło przepisu i czas przygotowania zapisano w istniejących notatkach;
  nie zbudowano nowego systemu filtrów/tagów/czasów. Jednostki domowe zachowuje opis,
  a do obliczeń trafia ilość bazowa. Nie powstają globalne definicje jednostek.
- Nie weryfikujemy zdalnie prawdziwości podanego źródła ani zawartości etykiety.
  Dane per100 muszą być faktycznie znane autorowi pliku; samo wpisanie source nie
  poświadcza faktów. Niepełne dane nie dają fikcyjnej kompletnej sumy.
- Ręcznie utworzone wcześniej przepisy nie mają zewnętrznej tożsamości. Nie
  przejmujemy ich po podobnej nazwie. Identyfikator źródła musi pozostać stabilny.
- Zerwanie procesu/wyczerpanie miejsca są zabezpieczone transakcją IndexedDB;
  testuje się kontrolowany abort, nie fizyczny force-stop na telefonie.

## Test odbiorczy (po zaakceptowaniu APK)

1. Zachowaj pełny backup. Instaluj zgodnie podpisany APK jako aktualizację,
   bez odinstalowywania i czyszczenia danych. Sprawdź istniejącą historię.
2. Otwórz Przepisy → Importuj przepisy i wybierz single.json. Zobacz braki,
   zaznacz świadomie szablon, zatwierdź. Przepis powinien pojawić się w bibliotece.
3. Importuj ten sam plik: jeden identyczny rekord, bez kolejnego przepisu.
4. Importuj update.json: aktualizacja domyślnie odznaczona. Zaznacz ją, zapisz,
   sprawdź nową wersję bazy i zachowanie starej w historii.
5. Użyj seven.json: podejrzyj 7 wierszy, wybierz część, zatwierdź. Wybrane tylko
   w bibliotece, bez wpisów w dzienniku. Przetestuj anulowanie nowego podglądu.
6. Uzupełnij produkty w szablonie. Dodaj normalną porcję do dziennika, potem
   zaktualizuj bazę — stare makro i składniki posiłku powinny pozostać bez zmian.
7. Sprawdź warianty, edycję gramatury i „Dostosuj tę porcję”.
8. W trybie samolotowym importuj nową testową namespace. Operacja nadal działa.
9. Wykonaj zwykły backup i restore na danych testowych; sprawdź ponowny import
   bez duplikatów oraz zachowanie importInfo/wariantów.
10. Sprawdź status Google Sheets. Import biblioteki nie ma tworzyć spożycia ani
    wysyłać nowych danych żywieniowych. Nie testuj destrukcyjnie prawdziwej historii
    i nie zapisuj prób do produkcyjnego arkusza.

## Rekomendowany kolejny etap

Najpierw odbiór importu pliku na fizycznym Androidzie. Następnie osobny adapter
**odczytu** arkusza planowania do tego samego JSON v1. Ten sam prepare/preview/commit
zachowa walidację, identyfikację i atomowość; nie trzeba tworzyć drugiego importera.

Oddziel arkusz planowania przepisów od RAW DATA eksportu. Nie zapisuj planu do
dziennika rzeczywistego spożycia. Należy osobno uzgodnić dostęp do istniejącego
arkusza w ograniczonym drive.file (np. świadomy wybór/udostępnienie aplikacji),
bez automatycznego rozszerzania OAuth. Daty i jadłospis to kolejne, wersjonowane
rozszerzenie formatu, poza zakresem 4A.

## Wyniki weryfikacji

- Node — pełny zestaw: **1786/1786**, 0 błędów.
- Chromium — pełny zestaw: **383/383**, 0 błędów; ponowne końcowe testy importera: **3/3**.
- Android JUnit: **33/33**; `testDebugUnitTest` i `lintDebug`: sukces.
- Formalny JSON Schema Draft 2020-12: poprawny; **4/4 pliki przykładów** poprawne.
- `git diff --check`: czysty.
- Testy importera korzystają wyłącznie z danych syntetycznych. Rzeczywistego
  Android file pickera, instalacji APK i force-stop nie testowano na urządzeniu.
- Pełna regresja zawiera istniejące testy OAuth, mappera, uzgadniania, natywnego
  protokołu i automatyzacji Google Sheets. Nie wykonuje zapisów do prawdziwego arkusza.

## Zmienione pliki

- `docs/examples/recipe-import/seven.json`
- `docs/examples/recipe-import/single.json`
- `docs/examples/recipe-import/update.json`
- `docs/examples/recipe-import/variants.json`
- `docs/recipe-import-report.md`
- `docs/recipe-import-spec.md`
- `docs/recipe-import.schema.json`
- `fixtures/recipe-import.mjs`
- `package.json`
- `recipe-file-import-ui.js`
- `recipe-file-import.browser.test.js`
- `recipe-file-import.js`
- `recipe-file-import.test.js`
- `recipe-import-format.js`
- `recipe-model.js`
- `recipe-ui.js`
- `scripts/public-assets.mjs`
- `style.css`
- `sw-assets.js`
