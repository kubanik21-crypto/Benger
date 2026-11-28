# Etap 5B — lokalny import planów treningowych

Baza architektury: `540344f`, gałąź `feature/local-sync-export`. Implementacja nie łączy treningów z Google Sheets. Istniejące arkusze, OAuth, Picker, import żywienia i schemat RAW DATA pozostają bez zmian.

## Przepływ i przechowywanie

`Plik UTF-8 → ścisły parser → JSON Schema + semantyka → podgląd base/local/remote → pojedyncza transakcja IndexedDB → istniejące szablony i kalendarz once`.

- `training-plan-format.js`: parser do 2 MiB, maks. głębokość 20 i 100000 węzłów, wykrywanie zduplikowanych nazw po dekodowaniu escapów, zakazane klucze, kontrola dat i capabilities, SHA-256 dokładnego tekstu UTF-8 i kanonizacji encji. BOM i niepoprawny UTF-8 są odrzucane, bez normalizowania bajtów.
- `training-plan-schema.js`: kopia formalnego schematu jako moduł offline. Test porównuje ją z dokumentem JSON Schema. Walidator obsługuje słowa kluczowe użyte w tym konkretnym schemacie; nie jest ogólną biblioteką JSON Schema dla dowolnych kontraktów.
- `training-plan-state.js`: projekcje, stabilne ID, wersje, definicje, uzgadnianie i walidacja metadanych. Hashe poszczególnych encji obejmują całą treść. SHA nie jest podpisem autora.
- `training-repository.js`: `prepareImport` i `applyImport`. Podgląd pozostaje w pamięci; zatwierdzenie ponownie porównuje pełną kanoniczną rewizję treningów i metadanych oraz datę. Inna karta, zmiana timera lub inna mutacja wymusza nowy podgląd. Wszystkie zapisy planu są w jednej transakcji tego samego store `meta`.
- `training-plan-ui.js`: import z pliku, podgląd, rozstrzyganie lokalnych konfliktów, karta bloku, cele obok wykonania, katalog publiczny.
- `backup.js`: v10 i odczyt wcześniej obsługiwanych v1–v9.

Nowy klucz `training-plan-import:v1` jest poza prefiksem `training:`. Zawiera archiwalne pakiety, hashe, receipts, mapowania, przyjęte projekcje i cele, lokalne overrides/tombstones, oczekujące zmiany i pochodzenie aktywnych/ukończonych sesji. Nie zawiera tokenów ani ustawień Google. Nie zmienia wersji IndexedDB ani dotychczasowych rzeczywistych rekordów.

ID reguły kalendarza pochodzi z SHA-256 krotki namespace + block.id + session.id. ID szablonu zawiera również wersję jednostki. Własne ćwiczenie wydawcy ma stabilne ID namespace + externalId, a definicje poszczególnych wersji pozostają w archiwum. Ręcznie zmieniona lokalna definicja nie jest nadpisywana.

## Realizacja i aktualizacje

Import nie wywołuje start/set/finish i nie tworzy historii, serii, timera ani completedMobility. Kalendarz i ręczne tworzenie planów pozostają wspólne. Rozpoczęcie importowanego szablonu przypina wybraną wersję ćwiczeń i pełne cele; start przez kalendarz dodatkowo zachowuje istniejące powiązanie wystąpienia. Zakończenie zachowuje pochodzenie w metadanych, a rzeczywiste wyniki w zwykłym snapshotcie.

Pełne cele obejmują fazę, rodzaj serii, kg/hantel lub dodatkowe kg, zakres powtórzeń, RIR/RPE, czas, przerwę, stronę, tempo, technikę, alternatywy, progresję i cardio. W interfejsie najczęstsze cele są widoczne od razu, pozostałe w rozwijanych szczegółach. RPE, tempo, strefa tętna i opis intensywności są celami, nie nowymi polami rzeczywistego wykonania. Nie ma automatycznej progresji ani automatycznej zamiany na alternatywę. Alternatywy są wyświetlane; użytkownik może zmienić przyszły szablon w istniejącym edytorze.

`restSeconds:null` pozostaje nieokreśloną przerwą w metadanych. Projekcja wykonawcza wyłącza automatyczny timer (wewnętrzne 0), a UI jawnie pokazuje „Nie określono”. Rzeczywistą preferencję przerwy można ustawić dotychczasowym formularzem. To nie zamienia źródłowego null na jawne zero; `restSeconds:0` nadal oznacza konkretny cel „bez przerwy”. Brak ciężaru lub RIR nie staje się zerem.

Aktualizacje przyszłych jednostek wymagają wyższych wersji. Lokalna edycja, usunięcie lub pominięcie w kalendarzu są zachowywane; zastosowanie źródła wymaga wyboru dla konkretnej jednostki. Rozpoczęte, ukończone i historyczne jednostki są chronione nawet po takim wyborze. Otrzymana wersja bloku i zastosowane wersje jednostek są osobne. Nieprzyjęte zmiany pozostają pending; nie deklarujemy pełnego zastosowania całego bloku. Brak jednostki w nowym kompletnym bloku może wycofać przyszły plan, ale nie wykonanie. Pusty blok jest błędem, nie anulowaniem całości.

Import emituje zdarzenie `benger:training-plans`, a nie zdarzenie rzeczywistej mutacji RAW DATA. Zakończenie rzeczywistego treningu nadal korzysta z dotychczasowej kolejki Smart Sync. Zwykły odczyt `snapshot()` dla RAW DATA nie odczytuje ani nie hashuje archiwów importu. Nie dodano timerów synchronizacji ani wywołań Google API.

## Backup i ograniczenia

- Po utworzeniu metadanych planów eksport ma wersję v10. Bez nich pozostaje dotychczasowe v8/v9. **Benger 1.0.24 nie obsługuje backupu v10.**
- Replace v10 odtwarza metadane i snapshoty. Merge łączy niezależne bloki i archiwa zgodnych wersji, zachowuje aktualny lokalny kalendarz dla istniejących ID, a nieprzyjęte wersje oznacza jako pending. Ponowny import odpowiedniego JSON uzgadnia te różnice. Sprzeczna treść tej samej wersji przerywa restore, zamiast zgadywania.
- Restore starszego formatu zachowuje dotychczasowe archiwum importów w kwarantannie: nie stosuje go do przywróconej bazy i nie usuwa historii. Ponowny import tego samego odłączonego bloku jest zablokowany; nowy blok o innym ID można dodać. Automatyczne ponowne wiązanie starych mapowań pozostaje poza 5B.
- Obowiązuje istniejący rollback journal backupu. Restore utrzymuje dotychczasowe wstrzymanie automatyzacji do weryfikacji; zwykła aktualizacja APK nie wykonuje restore.
- Limity całej bazy nadal obowiązują: 500 własnych ćwiczeń, 300 szablonów każdego rodzaju, 500 reguł, 5000 wyjątków, limity historii i elementów. Import nie przycina danych, tylko blokuje przekroczenie limitu. Archiwum: 24 bloki, 64 rewizje/blok, 512 mapowań jednostek/blok, 1000 definicji i receipts, 10000 pochodzeń sesji, do 16 MiB metadanych. Brak automatycznego kasowania historii w celu zwolnienia limitu.
- Bez sztang/maszyn i `total-load`. Maks. 40 kg/hantel, 200 kg dodatkowych dla masy ciała, zgodnie z obecnym wykonaniem. Katalog eksportowany z UI zawiera wyłącznie 60 publicznych builtinów. Eksport prywatnych ćwiczeń nie został dodany.
- Bez natywnego selektora chmury, WorkManagera, nowych uprawnień i płatnych usług. Plik wybiera istniejąca przeglądarka/WebView. Test fizyczny Androida i Phone Link wymagają urządzenia.

## Instrukcja dla czatu Treningi

1. Odczytaj `training-plan-import-spec.md`, schemat i aktualny publiczny katalog. Korzystaj z dokładnych builtinId oraz sygnatur, bez podobieństwa nazw.
2. Wygeneruj plik JSON UTF-8: `format=benger.training-plan`, schemaVersion 1, wymagane dwie capabilities. Jedna publikacja obejmuje cały skończony blok z konkretnymi datami i strefą `Europe/Warsaw`.
3. Zachowuj namespace, block.id, session.id i item.id. Zmienione jednostki i definicje otrzymują wyższą wersję; nowa publikacja otrzymuje nowy packageId oraz wyższą wersję bloku. Zmiana daty nie zmienia session.id.
4. Podaj wszystkie wymagane pola. Nieznane wartości oznaczaj null, nie zerem. Rozgrzewkę i serie robocze zapisuj jako osobne elementy z odpowiednim setKind. Nie dodawaj rzeczywistych wyników.
5. Nowe ćwiczenie ma jawny externalId i definicję konkretnej wersji w pakiecie. Nie zmieniaj sygnatury pomiarowej pod tym samym ID. Nie używaj sztang, maszyn ani obciążeń przekraczających profil wykonania.
6. Aktualizacja tygodnia to nadal pełny snapshot całego bloku: pozostałe jednostki pozostają z poprzednimi ID i wersjami. Nie publikuj wyłącznie czterech zmienionych jednostek.
7. Dla autora: `node --test training-plan.test.js` sprawdza runtime oraz przykłady; `python3 docs/examples/training-plans/validate-examples.py` sprawdza dokumentację. Pliki syntetyczne służą odbiorowi, nie są zaleceniem treningowym dla użytkownika.
8. Przekaż gotowy plik do pobrania. W 5B użytkownik wybiera go w **Więcej → Plany treningowe → Importuj plan z JSON**, ogląda podgląd i zatwierdza. Nie publikuj jeszcze treningów do Google Sheets.

## Bezpieczny odbiór na telefonie

1. Przed aktualizacją zapisz dotychczasowy pełny backup. Zainstaluj podpisany testowy APK jako aktualizację; nie odinstalowuj aplikacji. Sprawdź zachowanie Google, istniejących treningów i historii.
2. Do testu użyj osobnego syntetycznego bloku z `docs/examples/training-plans/`. Import miesięczny dodaje 16 planów: 12 treningów i 4 Mobility, ale zero wykonań. W razie dat historycznych podgląd pokaże ochronę; nie zmieniaj daty telefonu.
3. Przed akceptacją sprawdź kalendarz i liczbę historycznych sesji; sam podgląd nie może ich zmienić. Anuluj, otwórz plik ponownie i zatwierdź.
4. Powtórz identyczny plik: brak duplikatów. Następnie plik v2: tylko cztery jednostki tygodnia wymagają aktualizacji. Lokalnie zmieniony plan ma zostać zachowany lub jawnie uzgodniony.
5. Rozpocznij syntetyczny szablon ręcznie bez kończenia treningu. Cele są widoczne, ale lista rzeczywistych serii jest pusta. Zapisz rzeczywistą serię wyłącznie jeżeli świadomie testujesz wykonanie; w przeciwnym razie porzuć sesję, aby nie dopisać fikcyjnej historii.
6. W trybie samolotowym sprawdź odczyt planu i podgląd importu. Dla restore/merge v10 użyj oddzielnego środowiska testowego; nie nadpisuj prywatnej bazy tylko w celu odbioru.
7. Nie trzeba ręcznie powtarzać wszystkich starych funkcji. Odbiór fizyczny obejmuje instalację bez utraty danych, wybór pliku, cele, kalendarz i zachowanie offline. BUG-02 Phone Link jest osobnym otwartym zagadnieniem.
