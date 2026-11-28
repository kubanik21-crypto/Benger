# Benger 1.0.24 — BUG-02 i BUG-03

Baza: feature/local-sync-export, 51c5e01, podpisany APK 1.0.23 / versionCode 28632436. Jedna aktualizacja testowa, bez main i produkcji. Nie zmieniono modeli, importów, eksportów, backupów, OAuth ani powiązań arkuszy. Nie włączamy automatyzacji zamiast użytkownika. Podpis pozostaje dotychczasowy; aktualizacja musi mieć wyższy versionCode.

## BUG-03 — pętla synchronizacji

`finally` w sheets-auto.js bezwarunkowo planowało następne wywołanie po opóźnieniu UI 1500 ms. Każda udana próba ustawiała najpierw syncing, potem current i dwukrotnie zapisywała localStorage, nawet jeśli hash źródła był niezmieniony.

Zmiany:

- schedule wymaga dirty, nie planuje pracy podczas trwającej operacji;
- zwykłe sync z czystą kolejką wraca przed odczytem źródła, hashowaniem, zapisem lub publikacją statusu;
- finally planuje wyłącznie pozostałą brudną rewizję i respektuje jej debounce/backoff;
- zdarzenia rzeczywistych zapisów zachowują debounce 1500 ms. Rewizja powstała podczas wysyłania otrzymuje jeden dalszy przebieg;
- tick 60 s pozostaje jako mechanizm odzyskania **oczekującej** pracy. Przy czystym stanie jest operacją bez odczytów źródła/LS i bez zapisów;
- cold start i rzeczywisty powrót/ponowne połączenie sprawdzają źródło raz, również po pominiętych zdarzeniach w nieaktywnej aplikacji;
- ręczne force nadal umożliwia świadome sprawdzenie czystego źródła;
- powtarzany tick offline nie zapisuje ponownie identycznego statusu offline.

Trwała kolejka, zamiary użytkownika, dowody świadomych usunięć, backoff, blokady konta/profilu/masowej utraty danych i przywrócenia kopii nie zostały osłabione. Przegląd zewnętrznych, cichych zmian arkusza nie jest wykonywany co 1,5 s; stan zdalny nadal jest weryfikowany przed zapisem, przy eksplicytnym sprawdzeniu oraz przy aktywacji aplikacji. Nie dodano WorkManagera.

### Pomiar minuty bezczynności

Test z wirtualnym zegarem, rzeczywistym eksportem i koordynatorem oraz symulowanym Google, po pierwszym udanym uzgodnieniu. Zamrożony baseline z 51c5e01 znajduje się w fixtures/sheets-auto-1.0.23.mjs i nie jest publicznym assetem. 40 terminów debounce oraz jeden tick 60 s.

| Licznik | 1.0.23 | Poprawka |
|---|---:|---:|
| Wywołania koordynatora automatycznego | 41 | 0 |
| Odczyty pełnego źródła | 41 | 0 |
| Obliczenia SHA-256 | 41 | 0 |
| Odczyty localStorage w mierzonym oknie | 0 | 0 |
| Zapisy localStorage | 82 | 0 |
| Google GET / zapis | 0 / 0 | 0 / 0 |

Stary mechanizm już ograniczał Google przez porównanie hasha, więc nie przypisujemy poprawce oszczędności 41 żądań API. Usuwa lokalną pracę oraz miganie statusu. Test Chromium dodatkowo obserwuje rzeczywisty element statusu przez 4,8 s: zero mutacji DOM statusu, zero zapisów metadanych i zero kolejnych prób; po serii zmian jest jedna synchronizacja.

## BUG-02 — wymiary okna i Phone Link

### Diagnostyka przed zmianą

- Meta viewport jest prawidłowe: width=device-width, initial-scale=1. Nie ogranicza powiększenia.
- Capacitor 8.6.0 / WebView >=110, bez własnego resetowania initialScale, textZoom, useWideViewPort lub loadWithOverviewMode. Nie zmieniono tych ustawień ani globalnego skalowania.
- MainActivity używa standardowego BridgeActivity i insets; manifest już obsługuje zmiany screenSize, smallestScreenSize, screenLayout oraz density. Nie stwierdzono dowodu, że reset WebView lub wymuszony reload jest potrzebny. Nie dodajemy ich, aby nie utracić formularzy i kontekstu.
- W Chrome odtworzono przepełnienie przy szerokości 240 CSS px i symulowanym powiększeniu tekstu 200%: clientWidth 240, scrollWidth/innerWidth 274. Długie słowa w summary dodatków dziennika przekraczały szerokość tekstu; fixed nav dodatkowo podążał za rozszerzonym viewportem. W następnych zmianach rozmiaru utrzymywała się różnica visualViewport i layout viewport.
- Jest to reprodukcja wariantu responsywności, **nie potwierdzona reprodukcja Microsoft Phone Link**. Chrome/CDP, powiększenie fontu przez root CSS i DPR nie są rzeczywistym fontScale Androida ani wirtualnym wyświetlaczem Samsunga. Nie twierdzimy, że to jedyna przyczyna zgłoszenia.

### Bezpieczne zmiany

Zawijanie długich słów w dzienniku, minmax(0,1fr) dla bilansu, ograniczenie nav do viewportu i łamanie tekstu linków, elastyczna szerokość pola daty. Brak overflow-x:hidden, zmiany wartości danych, redukcji fontu lub automatycznego resetowania zoomu.

### Diagnostyka na telefonie

Więcej → Zaawansowane → **Diagnostyka ekranu / Łącze do Windows**. Przycisk „Sprawdź wymiary ekranu” niczego nie zapisuje. „Zapisz diagnostykę JSON” otwiera systemowy zapis pliku, korzystając z istniejącego zapisu dokumentów; nie zmienia formatu ani zawartości backupu.

Raport JS: innerWidth, clientWidth, scrollWidth, visualViewport (wymiary, skala, przesunięcia), screen, DPR, geometria ustalonych obszarów i maks. 30 kandydatów przepełnienia. Bez tekstów i wartości pól, nazw przepisów, dynamicznych ID wpisów, daty dziennika, notatek, kont, tokenów i URL. Brak odczytów baz/localStorage i brak automatycznego wysyłania. Brak ciągłego timera lub nasłuchiwania przy zamkniętym panelu.

Natywnie: szerokość rzeczywistego WebView i pomiaru, aktualnego okna, visible frame, density/densityDpi/scaledDensity, fontScale, konfiguracja dp i orientacja, numeryczny displayId, textZoom oraz trzy ustawienia WebView. JS dodatkowo stosuje zamkniętą białą listę pól liczbowych/boolean; wyjątki i inne pola nie trafiają do raportu. Nie udostępniamy WebView debugging.

## Test i odbiór

Automatyczne testy obejmują: pełny koordynator i pomiar idle przed/po, kolejkę offline i restart, ręczne force, zmianę podczas wysyłania, tick awaryjny, stabilność statusu DOM, istniejące testy intencji/usunięć oraz bezpieczeństwo diagnostyki. Responsywność: zmiana rozmiarów tego samego okna 390→240→280→320→430→800→1024→320, DPR 1 i 2,625, font 100/200%, oba motywy. Osobno test świadomego zoomu 150% — diagnostyka go rozpoznaje, nie resetuje.

Uruchamiamy pełne Node, Chromium, Android JUnit, lintRelease i kompilację. Końcowe wyniki i artefakt należą do tego samego commita aktualizacji; szczegóły są dołączane w raporcie wykonania i GitHub Actions. Testy Google są symulowane, a nie zapisami do rzeczywistych arkuszy. Phone Link nie jest dostępny w środowisku.

Krótki odbiór wersji testowej:

1. Zainstaluj wyłącznie APK podpisany dotychczasowym kluczem, jako Aktualizuj. Nie odinstalowuj ani nie czyść danych.
2. Przy wcześniej włączonym Smart Sync wykonaj jedną zmianę i odczekaj minutę: status powinien pozostać stabilny. Automatyczne świadome usunięcia pozostają objęte regresją i wcześniejszym potwierdzeniem użytkownika.
3. Porównaj Dziennik na telefonie oraz w Phone Link. Zmień rozmiar okna. Nie ma potrzeby ponownego konfigurowania arkuszy lub Google.
4. Jeśli ucięcie pozostaje, zapisz osobny JSON na telefonie i w Phone Link (najlepiej także po zmianie rozmiaru). Przekaż raporty; porównamy native width/density z clientWidth i visualViewport.scale. Przy scale >1 sprawdzimy świadome powiększenie; przy rozbieżności natywnego okna i WebView sprawdzimy relayout. Bez tych danych nie wymuszamy ryzykownej zmiany skalowania.

## Zweryfikowane przed kompilacją CI

Node: 1867/1867. Android release JUnit: 64/64. assembleRelease i lintRelease: BUILD SUCCESSFUL, zero błędów lint, 35 ostrzeżeń. Celowane testy obejmujące obie poprawki przeszły; końcowy test responsywności i prywatności diagnostyki: 2/2. Pełny Chromium jest wykonywany również przez workflow tworzący właściwy artefakt. Lokalny APK kontrolny nie zawiera konfiguracji Pickera i nie jest przeznaczony do instalacji.

Nowy moduł viewport-diagnostics.js jest świadomie dopuszczonym, działającym na żądanie raportem geometrii z zamkniętym zakresem danych. Pozostałe strony diagnostyczne i laboratoria deweloperskie nadal nie trafiają do artefaktów produkcyjnych. Nie zmieniono reguł publikowania produkcji.
