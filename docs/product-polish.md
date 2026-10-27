# Etap 13 — jeden produkt

Bazą jest `627411fd4b7e6c425aec9e02a465fddc850d41e5`, po sprawdzeniu zielonego post-merge Tests. Nie zmieniamy domenowych modeli żywienia, porcji, przepisów, pomiarów ani treningów.

## Interfejs

`product-polish-ui.js` składa wspólną ramę z istniejących elementów DOM **przed** inicjalizacją ich kontrolerów. Nie tworzy kopii formularzy ani drugich listenerów domenowych. Dziennik pokazuje datę, kompaktowe kcal/B/T/W, pięć szybkich akcji i wpisy. Tekst/transkrypcja są rozwijane; kliknięcie mikrofonu lub submit analizy ujawnia formularz przed focusem. Progres, aktywność i raporty są w rozwijanej sekcji. Wartości dawnego podsumowania pozostają dla kompatybilności logiki, ale widoczny jest tylko dashboard.

Więcej jest menu prowadzącym do `cele`, `produkty`, `historia`, `dane`, `ustawienia`, `o-aplikacji`. Nowe ekrany używają istniejących formularzy. Bottom nav zachowuje pięć pozycji i wskazuje Więcej również na ekranach podrzędnych. Routing zachowuje pojedyncze logiczne przejście, back/forward i focus headingu. Skróty Progresu otwierają istniejące formularze.

CSS używa semantycznych tokenów: tła, powierzchnie, tekst, obramowania, brand, danger/success/warning/focus, spacing/radius/shadow. Wszystkie formularze, dialogi, nawigacja i SVG wykresów korzystają z tej palety. Reduced motion wyłącza animacje i smooth scroll. Bez fontów z sieci i nowych zależności.

## Ustawienia i backup

`settings.js`: `{version:1, theme:'system'|'light'|'dark', startRoute:'dziennik'|'trening'|'progres'}`. Walidowana wartość w meta IndexedDB pod `app-settings-v1`; ten sam namespace co dane aplikacji. Nie zawiera danych zdrowotnych. Brak/uszkodzona wartość oznacza bezpieczne defaults bez nadpisywania danych. Systemowy motyw reaguje na zmianę systemu. Jawny hash ma pierwszeństwo przed ekranem startowym.

Backup **v6** obejmuje settings. Odczyt v1–v5 pozostaje obsługiwany. Stare kopie nie resetują motywu ani ekranu startowego. Merge zachowuje obecną preferencję, replace przywraca preferencję kopii v6. Settings są częścią tej samej transakcji/journala/rollbacku co pozostałe meta. Nie migrujemy historycznych snapshotów. Wprowadzenie jest device-specific i nie trafia do backupu.

## Pierwsze uruchomienie

Nieblokująca, pomijalna karta, maksymalnie trzy kroki. Brak requestów mikrofonu/aparatu. Completion w lokalnym meta `onboarding-v1`; powtórka z Ustawień. Sam brak flagi nie uruchamia wprowadzenia na starym profilu: sprawdzamy dziennik, produkty/cache/usage, przepisy/szkice/historię, aliasy, porcje, cele, treningi oraz pomiary/zdjęcia. Zaczynamy od lekkiego odczytu metadanych/dziennika, a pełny odczyt jest potrzebny dopiero przy potencjalnie pustym profilu. Przy błędzie odczytu konserwatywnie **nie** pokazujemy wprowadzenia. Settings same w sobie nie oznaczają danych użytkownika.

## PWA i release

Globalne dyskretne Offline oraz banner oczekującej aktualizacji. Kliknięcie Zaktualizuj używa dotychczasowego manualnego ACTIVATE_UPDATE; nic nie wymusza reloadu w trakcie edycji/treningu. Service worker i jego strategia nie są przebudowywane. Preview `/Benger/previews/etap-13/` ma `preview-etap-13` i własny scope. Publikacja dotyka wyłącznie tego katalogu.

O Bengerze pokazuje wersję 0.13.0 i build z meta. `npm run build:web -- /tmp/benger-release` produkuje statyczny artefakt z dokładnym HEAD i bez namespace/banneru preview; **nie publikuje produkcji**. Preview również ma dokładny SHA w meta, ale nie eksponuje go w głównym ekranie.

## Testy i aktualizacja

`tests/fixtures/stage12-upgrade.json.gz` to 84 rzeczywistych publicznych plików tekstowych z przypiętego SHA Etapu 12 (132 960 B gzip), nie odtworzenie starego modelu w nowym kodzie. Niezmienione dane katalogu, ikony i vendor pozostają współdzielone. Browser uruchamia stary shell, tworzy pełny profil przez stare repozytoria, instaluje stary SW, podmienia pliki i uruchamia ręczny update. Pełny backup ze zdjęciem przed/po jest porównywany semantycznie: diary Product+Recipe, custom, history/draft, aliases/usage, cele, masa/ciśnienie/obwody/zdjęcie, USER portion, custom exercise, plan i rutyna, historia i aktywne workout/Mobility, timer. Nowy UI dostaje defaults i nie otwiera onboardingu.

Istniejące testy zachowują zachowania. Zmiany oczekiwań dotyczą wyłącznie: nowego preview namespace, v6 eksportu, formularza celów przeniesionego na Cele, widocznego podsumowania w dashboardzie kontrolowanego rozwijania tekstu przed focusem oraz kompaktowego mikrofonu 56 px (nadal ponad 44 px) po pominięciu osobno testowanego onboardingu. Nie usuwamy przypadków testowych.

## Ograniczenia

Dane nadal są lokalne, bez synchronizacji urządzeń. Web Speech może wymagać sieci. Onboarding jest kartą, nie modalem. Motyw po starcie czeka na krótki lokalny odczyt ustawień; CSS respektuje system także przed nim. Potwierdzenia destrukcyjnych działań pozostają natywnymi dialogami przeglądarki, aby nie ryzykować regresji w dojrzałych flow. Testy headless nie zastępują oceny klawiatury, aparatu i aktualizacji zainstalowanej PWA na Samsungu.
