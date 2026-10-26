# Progres — Etap 10

## Interfejs i prywatność

Route `#/progres` jest w dolnej nawigacji (pięć pozycji). Historia pozostaje pod `#/historia`, z linkiem w Więcej. Waga ma szybki formularz; ciśnienie, obwody i zdjęcia są rozwijanymi podsekcjami. SVG pokazuje pomiary i trend; historia tekstowa pozostaje dostępna. Wykres jest ograniczony do najnowszych 1000 punktów na serię; limit jest oznaczony w opisie. Zakresy wagi: 30/90 dni/wszystko. Średnia obejmuje pomiary w siedmiu dniach kalendarzowych kończących się na dacie pomiaru; dashboard nie udaje aktualnego wyniku, jeśli ostatni pomiar jest stary. Porównania 7/30 dni podają datę rzeczywistego pomiaru odniesienia. Obwody są opcjonalne pojedynczo; formularz wymaga przynajmniej jednego.

Pomiary i zdjęcia są lokalne, bez uploadu, synchronizacji, telemetrii i deklaracji szyfrowania. Osoba z dostępem do profilu przeglądarki może mieć dostęp do danych. Ciśnienie i puls są jedynie zapisem/trendem — bez diagnoz, klasyfikacji czy automatycznych porad.

## Magazyn

Osobna IndexedDB `${PRODUCT_DB_NAME}-progress` w wersji 1: measurements, sessions, photos. Nie podnosimy wersji ani nie przebudowujemy dotychczasowego BengerDB. Dotychczasowe produkty, przepisy, historia, szkice, aliasy, porcje i dziennik pozostają w swoich magazynach. Preview używa `BengerDB-preview-etap-10-progress` i oddzielnego dziennika/produktów. Nie ma migracji niszczącej dane.

Measurement: id, type (weight/pressure/body), date, time, note, values i opcjonalnie period. Dane liczbowe pozostają bez zaokrąglania; UI używa Intl.NumberFormat. Limity wejścia są techniczną ochroną przed literówkami, nie oceną medyczną: 1–600 kg, obwody 1–350 cm, ciśnienie skurczowe 30–350, rozkurczowe 20–250, puls 20–300. Dowolna liczba pomiarów jednej daty/pory, limit 20 000 rekordów. Trend jest liczony przesuwanym oknem, nie przez ponowne skanowanie całości dla każdego punktu.

## Fotografie

JPG/PNG do 20 MiB; nagłówek jest sprawdzany przed dekodowaniem, maks. 40 MP i 12 000 px na bok. Canvas ponownie koduje do JPEG (maks. 1600 px, quality .8) i miniatury 240 px (.65), usuwając EXIF/oryginalne metadane. Oryginał nie jest przechowywany. Zdjęcie po kompresji maks. 2 MiB. IndexedDB przechowuje Blob, nigdy base64 w normalnym runtime. Maks. 3000 fotografii; rzeczywisty dostępny limit zależy od quota przeglądarki.

Sesja ma datę, notatkę oraz 1–3 kategorie front/side/back. Usunięcie zdjęcia lub sesji wymaga potwierdzenia; usunięcie ostatniego zdjęcia usuwa pustą sesję. Usuwane są również powiązane Bloby. Object URL są zwalniane przy wymianie widoku, zmianie route i pagehide. Porównanie pokazuje te same kategorie obok siebie; brakujący kadr jest jawnie oznaczony. Nie ma AI ani oceny sylwetki.

## Backup i import

Eksport schemaVersion 3, import 1/2/3. Nowa wersja zapobiega cichej utracie Progresu przy próbie importu do starego klienta. Standardowy backup zawiera pomiary, nie sesje/zdjęcia. Pełny backup jest jawną osobną opcją i zawiera JPEG oraz miniatury zakodowane base64 wyłącznie w pliku JSON. To format transportu, nie magazyn runtime. Zdjęcia w pełnym eksporcie mają limit 35 MiB, cały import 64 MiB; przekroczenie lub błąd przerywa eksport przed pobraniem pliku. Nie dodano bibliotek ZIP ani zależności.

Import waliduje JSON, daty, liczby, MIME/nagłówki, identyfikatory, referencje sesji i prototype pollution. Dekoduje obrazy do Blob z ograniczeniami rozmiaru i sprawdza rzeczywiste dekodowanie JPEG. Podczas odtwarzania modal blokuje równoległe operacje w tej karcie. Merge zachowuje istniejące rekordy przy tych samych ID. Replace zastępuje pomiary z nowej kopii; lekka kopia nie kasuje istniejących zdjęć. Pełna kopia w trybie replace zastępuje również zdjęcia. Stare kopie bez Progresu pozostawiają istniejący Progres.

Journal importu zawiera również poprzedni stan osobnej bazy Progresu. Wycofanie i odtwarzanie po przerwaniu obejmują obie bazy i localStorage. Import jest operacją pomiędzy bazami z recovery, nie natywną pojedynczą transakcją IndexedDB. W razie quota podczas recovery aplikacja nie potwierdza sukcesu; wymagane może być zwolnienie miejsca. Na czas importu zamknij inne karty. Backup jest blokowany podczas przygotowania/zapisywania zdjęć lub pomiaru.

## Offline i aktualizacja

Nowe moduły należą do public-assets i wersjonowanego app shell. Nie zmieniono zakresu produkcji; preview ma scope `/Benger/previews/etap-10/`. Offline działają formularze, historia, wykresy, obrazy i porównanie. Aktualizacja nie usuwa IndexedDB. Test używa oryginalnego klienta Etapu 9 z 13b2045, zapisuje dane i przechodzi przez rzeczywistą aktualizację SW do nowego shell, porównując dawny backup.

## Test Samsunga — maksymalnie 10 kroków

1. Otwórz Progres z dolnego paska; sprawdź też Historię w Więcej i Android Back.
2. Dodaj wagę z przecinkiem oraz notatką; edytuj i usuń próbny pomiar.
3. Dodaj ciśnienie rano i wieczorem oraz dwa pomiary tej samej pory.
4. Dodaj tylko talię i biodra; sprawdź zmianę obwodu i wybór wykresu.
5. Dodaj sesję ze zdjęciami przód/bok/tył z telefonu.
6. Odśwież i sprawdź pomiary oraz miniatury.
7. Dodaj drugą sesję i porównaj te same kadry.
8. Zmień zakres wykresu wagi: 30/90 dni/wszystko.
9. Po gotowości offline wyłącz sieć, odśwież i sprawdź Progres.
10. Pobierz lekką i pełną kopię; odtwórz pełną na oddzielnym preview i sprawdź zdjęcia.

Ograniczenia: brak własnych typów obwodów, brak HEIC/WebP, lokalne dane bez synchronizacji. Historia początkowo pokazuje 200 rekordów każdego rodzaju, galeria 100 sesji; przyciski pozwalają pokazać kolejne. Backup obejmuje wszystkie. Pomiary/testy headless nie zastępują sprawdzenia aparatu/plików i pamięci na Samsungu. Bez PR i bez merge przed akceptacją.


## Walidacja implementacji

Lokalnie: 1119 testów Node i 183 testy Chromium; dotychczasowe scenariusze dziennika, produktów, przepisów, głosu, skanera, PWA oraz backupu pozostały w zestawach. Nowe E2E obejmują CRUD, kilka pomiarów ciśnienia, częściowe obwody, Blob/JPEG/miniatury, porównanie, quota, lekki i pełny backup, rollback uszkodzonego obrazu, offline i aktualizację rzeczywistego klienta Etapu 9. Układ sprawdzono na 320/360/390/430 px. `git diff --check` bez uwag. Wyniki końcowego Actions oraz SHA podaje raport wykonania. Testy automatyczne korzystają z kontrolowanych danych i nie zastępują Samsunga.
