# BUG-02 — Phone Link: analiza danych 1.0.24 i diagnostyka v2

Status: **OTWARTY, nie blokuje dalszego rozwoju**. Baza 483d7da / APK 1.0.24. Obecna zmiana rozszerza diagnostykę, bez zadeklarowania naprawy Phone Link i bez nowego APK. Bez zmiany DPI, skali czcionek, OAuth, danych użytkownika, importu/eksportu, backupów lub Smart Sync. Nie scalono z main ani nie wdrożono produkcji.

## Wyniki z urządzenia

| Pomiar | Telefon | Phone Link |
|---|---:|---:|
| WebView width px | 1440 | 1080 |
| DPR / density | 3,5 | 2,625 |
| densityDpi | 560 | 420 |
| szerokość CSS: WebView / density | 411,43 | 411,43 |
| innerWidth | 411 | 411 |
| WebView height / density | 806,57 | 891,43 |
| innerHeight | 806 | 891 |
| fontScale / textZoom | 1,15 / 115 | 1,15 / 115 |
| displayId | 0 | 11 |
| visualViewport.scale | 1 | 1 |

Przekazane pomiary są zgodne z poprawną zmianą gęstości i rozmiaru WebView na dodatkowym wyświetlaczu. Nie uzasadniają korekty globalnego DPI, tekstu ani wymuszonej szerokości CSS. Równa szerokość CSS na obu ekranach jest oczekiwana. Różna wysokość również odpowiada rozmiarom natywnym po przeliczeniu.

Jednak raport był wykonywany w Zaawansowanych, gdzie Dziennik jest ukryty. Zerowe wymiary jego elementów oraz pusta lista overflow nie rozstrzygają o jego aktywnym layoucie. Pomiary View i DOM nie sprawdzają też bezpośrednio bufora kompozytora Chromium ani obrazu przekazywanego przez Phone Link do Windows.

Stosunek poprzedniej i nowej gęstości oraz szerokości w pikselach wynosi 4/3. Nieaktualna skala lub przycinanie w ścieżce renderowania/przekazywania obrazu jest jedną z hipotez, ale sam ten stosunek jej nie dowodzi. Nie stosujemy obejścia skalowaniem ani zmiany akceleracji bez reprodukcji.

## Przegląd implementacji Androida

- Capacitor 8.6.0 tworzy WebView przez layout aktywności `capacitor_bridge_layout_main.xml`: CoordinatorLayout i CapacitorWebView mają rozmiar match/fill_parent. Bridge otrzymuje tę instancję przez activity.findViewById. Brak własnego tworzenia WebView z ApplicationContext lub createDisplayContext w kodzie Bengera.
- BridgeActivity.onConfigurationChanged wywołuje super i przekazuje konfigurację do Bridge oraz pluginów. MainActivity nie omija tego mechanizmu. Manifest już obejmuje density, screenSize, smallestScreenSize, screenLayout i orientation.
- Nie stwierdzono w kodzie Bengera ręcznego buforowania DisplayMetrics do obliczania szerokości WebView, ustawiania DPI, textZoom, initialScale ani wymuszania rozmiaru powierzchni.
- Nie używamy ukrytego callbacku Activity.onMovedToDisplay ani refleksji do prywatnych API. Rejestrujemy zaobserwowane zmiany `web.getDisplay().getDisplayId()` przy resume, zmianie konfiguracji i żądaniu raportu. To próbki; licznik nie oznacza kompletnej historii wszystkich przełączeń.
- Nie dodano requestLayout/invalidate, reload, recreate, zmiany warstwy renderowania ani resetowania zoomu. Bez dowodu takie kroki mogłyby maskować przyczynę lub zakłócić formularze, aktywny trening i trwającą autoryzację.

## Diagnostyka v2 w kodzie

Raport ma odrębną wersję diagnostyczną schemaVersion=2. Format backupu i eksportów synchronizacji pozostaje bez zmian.

- `diaryVisible`, `measurementView`, `documentVisibility` i `visible` przy geometrii odróżniają ukryty ekran od mierzonego layoutu. Widoczność DOM nie jest potwierdzeniem poprawnego wyświetlenia obrazu w Windows.
- „Zmierz widoczny Dziennik” w panelu diagnostyki przechodzi normalną nawigacją do Dziennika i pokazuje tymczasowy pasek Sprawdź / Zapisz JSON / Zamknij pomiar. Użytkownik może przewinąć do problematycznej części. Pobranie geometrii nie ukrywa ekranu, nie klonuje go i nie zmienia stylów w celu wykonania pomiaru.
- Pasek nie uruchamia się sam, nie zmienia danych, nie odświeża strony i nie resetuje zoomu. Znika na innych zakładkach. Raport trafia do dotychczasowego panelu oraz opcjonalnie do pliku wybranego przez użytkownika. Pomiar powstaje przed otwarciem systemowego okna zapisu.
- Przed pomiarem czekamy na dwie klatki, z limitem 250 ms. `sampling.paintWait` wskazuje two-frames, timeout lub document-hidden. Brak klatek renderowania nie może zawiesić samej diagnostyki.
- Natywnie dodatkowo odczytujemy bieżącą gęstość kontekstu WebView i aktywności, początkową gęstość aktywności po onCreate, ID wyświetlaczy, liczbę zmian konfiguracji i ostatnią przekazaną densityDpi, zaobserwowane zmiany wyświetlacza, granice root i globalnie widocznej części WebView, scaleX/Y, translationX/Y, hardwareAccelerated i layerType.
- Liczniki są wyłącznie w pamięci danej instancji. Zero zmian może oznaczać świeże uruchomienie od razu na dodatkowym ekranie; nie jest dowodem niewywołania mechanizmów systemu. Gęstość początkowa dotyczy zasobów aktywności, nie prywatnego kontekstu procesu renderera Chromium.
- Nie nazywamy tych rozmiarów „rozmiarem bufora renderera”. To publiczne dane View/Window; rzeczywista powierzchnia GPU/strumień Phone Link nie zostały bezpośrednio zmierzone.

Zachowana jest zamknięta lista danych liczbowych/boolean po stronie JS. Raport nie zawiera nazw przepisów, wpisów, notatek, dynamicznych identyfikatorów, daty wybranego dnia, kont, URL ani tokenów. Bez odczytu lokalnych baz, bez automatycznego wysyłania, bez screenshotów zawierających dane. Nie dodano stałych timerów, globalnego listenera wszystkich wyświetlaczy ani WebView debugging.

## Dalszy odbiór, gdy diagnostyka trafi do kolejnego APK

1. Telefon: Zaawansowane → diagnostyka → Zmierz widoczny Dziennik → Zapisz JSON z tymczasowego paska.
2. Phone Link: ta sama ścieżka, osobny raport przed i po zmianie rozmiaru okna, bez zmiany systemowego DPI/tekstu. Jeśli możliwe, porównać świeże uruchomienie w Phone Link z przeniesieniem już uruchomionej aplikacji.
3. Porównać aktywny layout i widoczność elementów, konteksty densityDpi/displayId, początkową i bieżącą gęstość, konfiguracje oraz natywne granice i transformacje.
4. Jeżeli View/DOM są zgodne i pełne, a obraz w Windows nadal przycięty, pozostawić otwartą hipotezę warstwy renderowania/Phone Link. Bez dodatkowych dowodów nie wymuszać obejścia po stronie skali.

Nie jest wymagane ponowne testowanie wszystkich importów i backupów. BUG-02 pozostaje otwarty niezależnie od wyników testów symulowanych.

## Weryfikacja implementacji

- Pełne Node: 1868/1868.
- Celowane Chromium: 10/10 (diagnostyka, Dziennik, menu i Smart Sync), dodatkowo powtórzony zestaw 3/3 diagnostyki po dodaniu sprawdzianu braku klatek renderowania.
- Android release JUnit: 64/64, assembleRelease i lintRelease: BUILD SUCCESSFUL.
- Potwierdzono aktywny, niezerowy pomiar Dziennika, jawne oznaczenie ukrytego pomiaru, zachowanie dnia, niewysłanego tekstu, localStorage i zoomu, filtrowanie prywatnych pól oraz limit oczekiwania na klatki.
- Nie wykonywano ponownie pełnego zestawu Chromium, testu rzeczywistego Phone Link ani pomiaru prywatnego bufora renderera. Testy są celowane do zmienionej diagnostyki i sąsiadujących funkcji.
- Nie opublikowano nowego APK. Lokalny build kontrolny nie jest wersją do instalacji. Rozszerzenie jest przygotowane do przyszłej aktualizacji; zainstalowany 1.0.24 nadal ma diagnostykę v1.
