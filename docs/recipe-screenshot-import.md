# Składniki ze screena — Android 1.0.13

W edycji lub szkicu przepisu przycisk „Wczytaj składniki ze screena” otwiera wybór do czterech obrazów PNG/JPEG/WebP (12 MiB każdy). Odczytane nazwy, ilości i jednostki wymagają sprawdzenia. Można poprawić tekst, odznaczyć wiersz albo pozostawić ilość/jednostkę pustą. Import dopisuje składniki do istniejącego szkicu; nie zmienia gotowych przepisów ani historii.

OCR: lokalny Tesseract.js 6.0.1, Tesseract.js-core 6.0.0 LSTM WebAssembly i polski model tessdata_fast 4.1.0. Pobrano z oficjalnych paczek npm i oficjalnego repozytorium modelu. Model dołączamy jako nieskompresowany plik .traineddata: AAPT automatycznie rozpakowuje .gz i zmienia nazwę, dlatego aplikacja jawnie używa gzip:false. Zwykła kompresja APK nadal zmniejsza rozmiar modelu. Build APK sprawdza obecność wszystkich plików OCR w gotowym archiwum. Wersje i SHA256 plików: vendor/ocr/manifest.json. Licencje Apache-2.0 i Leptonica BSD zawarte obok silnika. Biblioteki nie są modyfikowane. Żadnych kont, płatnych API, backendu ani wysyłania zdjęć. Silnik ładuje się dopiero po wybraniu obrazu, kończy pracę po odczycie/anulowaniu. Pliki silnika są dołączane tylko do APK, nie do webowego precache. Polski model rozpoznaje również alfabet łaciński, ale nie wszystkie języki.

Obraz przechodzi przez canvas (maksymalna krawędź 2600 px, limit wejścia 24 megapiksele), a wynik przez wspólny parseProductQuery. Nagłówek „Składniki” i „Sposób przygotowania” pomagają oddzielić listę od interfejsu. Nie zastępuje to kontroli użytkownika: najlepiej wybierać przycięte screeny samej listy, bez zasłaniających elementów. Brak jednostki nie oznacza gramów. Notatki typu „plus łyżka do posmarowania” pozostają opisem, nie dodatkową porcją.

Powiązanie z produktami używa istniejącego resolveProductQuery z allowExternal:false. Niejednoznaczne produkty pozostają UNRESOLVED; ich wybór, skanowanie i porcje są dostępne w zwykłym edytorze. Makro liczy istniejący deterministyczny silnik, jedynie dla potwierdzonego produktu i zgodnej bazowej jednostki g/ml. Nie ma zgadywania masy jajka ani gęstości. Household portions można uzupełnić standardowym pickerem.

Nie powstaje nowy model persistence ani wersja backupu. Zapis całej listy korzysta z saveDraft, sprawdza id/revision i limit 200 składników. Obrazy nie trafiają do backupu. Niepowodzenie rozpoznania lub zapisu pozostawia dotychczasowy szkic. To import składników, nie automatyczne przepisywanie instrukcji przygotowania czy rozpoznawanie etykiet żywieniowych.

## Poprawki 1.0.15 — granice sekcji i podgląd obszaru

Nie dopisujemy już sztucznego nagłówka przed całym screenshotem. Niezależne strony są rozdzielane form-feed, a każda szuka swojego rzeczywistego nagłówka. Klasyfikator nagłówków toleruje polskie znaki i drobne pomyłki OCR. „PRZYGOTOWANIE” bez dwukropka również kończy listę. Adresy, elementy nawigacji, niektóre typowe kontrolki stron i proza instrukcji są pomijane; sam losowy napis bez sygnału żywności/ilości nie staje się automatycznie składnikiem. Brakujące lub nietypowe dane nadal wymagają sprawdzenia; nie jest to model rozumienia dowolnej witryny.

Pierwszy przebieg Tesseract PSM11 pobiera geometrię linii. Znaleziony nagłówek i granica instrukcji pozwalają ponowić odczyt PSM6 na samej liście. Automatyczne zawężenie wymaga również ilości wyglądającej jak składnik; sam nagłówek nie wystarczy. Jeżeli obszar wskazano ręcznie, ponowny odczyt PSM6 dotyczy tego obszaru także bez nagłówka.

Przed OCR jest podgląd obrazu i jawny przycisk odczytu. Ruch palca wyznacza prostokąt; cztery suwaki są alternatywą dostępną z klawiatury/czytnika. „Cały obraz” resetuje zaznaczenie. Każdy z maksymalnie 4 screenów ma własny obszar. Prostokąty są walidowane w zakresie 0–1, minimum 2% szerokości/wysokości. Odczyt nie przechowuje oryginalnych zdjęć ani współrzędnych w przepisie. Brak wyników nie tworzy pustych wpisów. Crop i odczyt można anulować, a błąd zapisu pozostawia poprzedni szkic.

Deskryptory „czubate/płaskie” są oddzielane przed wspólnym parserem ilości, aby np. 3 łyżki nie stały się 1 łyżką. Opis pozostaje w originalText/quantityText; nie daje uprawnienia do standardowej masy płaskiej łyżki. Nie zmieniamy ProductResolver ani silnika makro. Dla nieznanego produktu z jawną ilością i jednostką zachowujemy normalny, nierozwiązany składnik.

## Poprawka 1.0.16 — punktory i separatory

Po wspólnym parseProductQuery usuwamy dekoracyjne znaki wyłącznie z początku/końca wydzielonej nazwy. Dotyczy to m.in. •, *, « oraz myślników/strzałek pozostałych po odłączeniu ilości. Oryginalny odczyt jest zachowany w originalText. Nie zmieniamy parsera ilości, procentów, łączników wewnątrz nazw ani istniejących danych. Nowa nazwa trafia zarówno do pola edycji, jak i wspólnego resolveProductQuery podczas zatwierdzania. Testy obejmują pełną 12-elementową listę ze zgłoszenia, wartości dziesiętne, nieznaną jednostkę i odrzuconą ujemną ilość.
