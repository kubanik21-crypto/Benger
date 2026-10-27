# Trening i Mobility — Etap 12

## Zakres i prywatność

`#/trening` ma pięć sekcji: Trening, Mobility, Plany, Historia, Ćwiczenia. Dolna nawigacja nadal ma pięć pozycji; Produkty są w Więcej i zachowują `#/produkty` oraz istniejące skróty dodawania jedzenia.

Wszystko poza rozpoznawaniem mowy działa lokalnie/offline. Nie dodano backendu, zależności npm, telemetryki ani płatnych usług. Dane treningowe nie trafiają do OFF. Nie szacujemy spalonych kcal i nie zwiększamy celów żywieniowych.

Biblioteka zawiera wyłącznie ćwiczenia z masą ciała, hantlami, ławką, drążkiem, poręczami, TRX i bieżnią. Step-up wymaga podwyższenia rzeczywiście przeznaczonego do wchodzenia; notatka ostrzega, że nie każda ławka jest odpowiednia. Nie ma sztang, maszyn ani wyciągów.

Mobility jest ogólną biblioteką ruchową i dziennikiem, nie terapią diagnozy. Przy problemach kręgosłupa własny plan rehabilitacji powinien być zgodny z zaleceniami lekarza/fizjoterapeuty. Subiektywne samopoczucie, sztywność i dyskomfort 0–10 są przechowywane i wyświetlane bez interpretacji klinicznej.

## Model i IndexedDB

Istniejąca baza `PRODUCT_DB_NAME`, store `meta`, przechowuje niezależne rekordy prefiksu `training:`. Nie powstaje kopia dziennika jedzenia ani bazy Progres. Nie trzeba podnosić wersji IndexedDB ani blokować starych połączeń przy upgrade.

Logiczne kolekcje:

- `exercises`: własne ćwiczenia (`custom:uuid`); biblioteka startowa jest statyczna (`builtin:*`).
- `workoutTemplates`: plany z uporządkowanymi ćwiczeniami, seriami, zakresem powtórzeń, przerwą i notatką.
- `mobilityRoutines`: uporządkowane rutyny, także z własnych ćwiczeń fizjoterapeuty.
- `activeWorkout`, `activeMobility`: po jednej aktywnej sesji danego rodzaju.
- `completedWorkouts`, `completedMobility`: niezależne snapshoty zakończonych sesji.
- `timer`: jeden współdzielony timer przypisany do konkretnej aktywnej sesji.

Każdy rekord ma własny klucz. Modyfikacja odczytuje rekordy prefiksu w transakcji readwrite, waliduje nowy stan i zapisuje tylko zmienione rekordy. Przeniesienie aktywnej sesji do historii i usunięcie jej timera jest atomowe. Dwie karty dodające serie nie nadpisują starym stanem wcześniejszych serii. Błąd quota przerywa zapis — nie przechodzimy po cichu na pamięć ulotną.

Sesja zawiera ID, datę lokalną, czas rozpoczęcia ISO, rodzaj, stan, nazwę, aktualny indeks ćwiczenia i listę elementów. Każdy element ma pełny snapshot ćwiczenia/dawkowania, zapisane serie lub liczbę zaliczonych serii Mobility. Ukończona sesja ma również czas zakończenia oraz opcjonalne własne oceny przed/po.

## Hantle, serie i wyniki

Wpisujemy **ciężar jednego hantla**. Ćwiczenie deklaruje `dumbbells: 1 | 2`; masa własnego ciała ma 0. Objętość siłowa = ciężar jednego hantla × liczba hantli × powtórzenia. Dwa hantle po 32 kg × 10 = 640 kg × powt. Nie wymagamy wpisywania 64 kg.

Bodyweight: objętość obejmuje wyłącznie jawnie wpisany dodatkowy ciężar, nigdy masę użytkownika. Nie podwajamy automatycznie stron ćwiczenia jednostronnego. Rozgrzewki pozostają w historii, ale nie w objętości roboczej. Wykres i rekordy nie łączą ćwiczeń siłowych z czasowymi/cardio. Nie ma trybu assisted ani szacowania 1RM.

Serie mają własne ID, kg/reps/RIR i rodzaj rozgrzewkowa/robocza albo czas/dystans. Edycja zachowuje ID, kopiowanie tworzy nowe. Limity: hantel 0–40 kg, reps 1–1000 (całkowite), RIR 0–10, czas do 24 h; wejście nie przyjmuje NaN/Infinity ani fragmentów nieprawidłowych liczb. Cardio zapisuje czas w sekundach, UI bieżni przyjmuje minuty; dystans w km, prędkość i nachylenie opcjonalne. Nie liczymy kcal.

Zapisana historia korzysta wyłącznie ze snapshotów. Zmiana nazwy/instrukcji ćwiczenia lub usunięcie planu/ćwiczenia nie zmienia dawnego wykonania. Dla użytego własnego ćwiczenia nie można zmienić typu pomiaru ani liczby hantli pod tym samym ID — należy utworzyć nowe ćwiczenie.

## Własne plany / Mobility

Można utworzyć puste zestawy A/B, Push/Pull/Legs, Upper/Lower, Full Body lub dowolny plan. Nie narzucamy obciążeń ani automatycznej progresji. Plany i rutyny można edytować, kopiować, porządkować i usuwać. Usunięcie ćwiczenia używanego przez zapisany plan wymaga wcześniejszego usunięcia odwołania w planie; sesje historyczne nie wymagają żywego rekordu ćwiczenia.

Dawkowanie obejmuje serie, zakres reps, czas, stronę lewa/prawa/obie, odpoczynek, opis częstotliwości i wielowierszową notatkę fizjoterapeuty. Własne instrukcje nie są interpretowane ani automatycznie „poprawiane”. W rutynie pokazujemy jeden element, zaliczenie serii i duże Dalej/Wstecz; przejście nie zalicza ćwiczenia automatycznie. Historia zawiera liczbę faktycznie zaliczonych serii, również gdy sesję zakończono częściowo.

## Trwałość, timer i głos

Każda zatwierdzona akcja jest zapisana przed komunikatem powodzenia. Aktywna sesja przetrwa zmianę route, reload i zamknięcie PWA. Niezatwierdzone pola serii nie są autosave. Przy ponownym otwarciu wybieramy rodzaj ostatniej aktywnej sesji. Edytory planów przechowują roboczy stan podczas nawigacji w otwartej aplikacji, ale wymagają jawnego zapisu przed zamknięciem.

Timer przechowuje właściciela, przeznaczenie, długość i `endsAt`. Odliczanie to różnica względem bieżącego zegara, nie liczba ticków. Uśpienie karty nie resetuje timera. Ukończenie/porzucenie sesji usuwa tylko jej timer. Jeden timer może zastąpić poprzedni na żądanie użytkownika. Nie obiecujemy alarmów, dźwięków ani notyfikacji przy zamkniętej/uśpionej aplikacji; zmiana zegara systemowego wpływa na odliczanie.

Głos używa istniejącego adaptera SpeechRecognition, push-to-talk, bez zmian algorytmu transkrypcji. Parser rozpoznaje krótki opis jednej serii, np. „wyciskanie hantli 32 kilo 10”, „32 kilo 9”, „podciąganie 8”, „plank 60 sekund”, „bieżnia 30 minut 4 kilometry”. Wynik wypełnia formularz; **użytkownik zatwierdza serię**. Nie zapisujemy dźwięku. Parser jest deterministyczny i ograniczony — przy niejednoznaczności lub braku danych pozostaje formularz ręczny. Speech może wymagać sieci dostawcy przeglądarki.

## Backup i aktualizacja

Backup **v5**, `data.training`, obejmuje wszystkie kolekcje, aktywne sesje i timer. Nadal importujemy wersje 1–4. Brak pola treningu w starym backupie zachowuje obecne treningi, także w replace. Jawny pusty stan treningu w backupie v5 może je zastąpić po potwierdzeniu importu.

Merge zachowuje obecny rekord przy konflikcie ID. Ukończona sesja wygrywa z dawną aktywną kopią tego samego ID, aby nie wskrzeszać treningu. Obecna aktywna sesja wygrywa z inną importowaną aktywną; osierocony timer jest pomijany. Replace odtwarza dokładny stan backupu. Historia pozostaje snapshotem. Całość walidujemy przed zapisem; istniejący journal/rollback obejmuje rekordy treningu wraz z pozostałą bazą, localStorage i Progres. Na czas importu należy zamknąć inne karty Bengera.

Limity: 500 własnych ćwiczeń, 300 planów i 300 rutyn, po 5000 sesji każdego rodzaju, 100 ćwiczeń w planie/sesji i 200 serii w elemencie. Backup zachowuje istniejący limit 64 MiB. Dane lokalne wymagają regularnych kopii. Nie ma synchronizacji urządzeń.

Nowe moduły są w precache PWA. Preview ma namespace `preview-etap-12` i scope `/Benger/previews/etap-12/`; nie kontroluje produkcji. Test upgrade uruchamia prawdziwe pliki Etapu 11 przypięte do `85f01a999c1149e4bacb7b7aec2825f93c5fee21`, zapisuje cele, zdjęcie, pomiar, przepisy/wersje/szkice/porcje/aliasy i wpisy Product/Recipe, następnie aktualizuje SW dopiero po kliknięciu i porównuje pełny backup.

## Samsung acceptance

1. Otwórz preview i sprawdź SHA; dolny pasek ma 5 pozycji, Produkty są w Więcej.
2. Utwórz plan A/B, dodaj ćwiczenia, zmień kolejność i skopiuj plan.
3. Rozpocznij plan: zapisz hantle 32 kg × 10, RIR, rozgrzewkę; skopiuj/edytuj/usuń serię.
4. Uruchom timer; zmień ekran, odśwież i zamknij/otwórz PWA — sesja i timer pozostają.
5. Podyktuj „32 kilo 9”, sprawdź formularz, zatwierdź; zapisz także podciąganie, plank i bieżnię.
6. Dodaj własne ćwiczenie od fizjoterapeuty, stronę, częstotliwość i dokładną notatkę; utwórz rutynę.
7. Wykonaj Mobility: timer ćwiczenia/przerwy, zalicz serie, użyj Dalej/Wstecz i wpisz własne oceny przed/po.
8. Sprawdź historię/progres i małe podsumowanie na Dashboardzie; cele kcal nie rosną od treningu.
9. Po gotowości PWA przełącz telefon offline i wykonaj manualny trening/Mobility.
10. Zrób backup z aktywną sesją i przywróć na preview; sprawdź stare dane, zdjęcia i cele.

## Dogrywka UX — cykl treningu

Główny flow to: ćwiczenie → seria → automatyczny odpoczynek → kolejna seria → następne ćwiczenie. Trening bez planu otwiera od razu wybór pierwszego ćwiczenia. Biblioteka jest lokalna, wybór przełącza od razu do wykonania; widoczny „Dzisiejszy trening” pozwala wrócić do poprzednich ćwiczeń.

„Trening w toku” to niezależny, rosnący czas całego treningu od `startedAt`. Dla siłowych/bodyweight nie ma wyboru celu timera ani timera wykonania. Nowa seria i jej odpoczynek zapisują się w **jednej transakcji**, również przy szybkim powtarzaniu. Edycja starej serii nie uruchamia nowej przerwy. Po zapisie pozostaje formularz kolejnej serii z ciężarem/reps/RIR poprzedniej, nowym ID i domyślnym rodzajem robocza; fokus przechodzi do wyniku kolejnej serii.

Dla nowego ćwiczenia bez definicji odpoczynku domyślnie używamy 90 s. Definicja planu/własnego ćwiczenia ma pierwszeństwo. W treningu bez planu pamiętamy ostatni jawnie ustawiony czas przez istniejący snapshot ukończonego wykonania tego ćwiczenia — bez nowej kolekcji lub wersji backupu. Ustawienie 0 wyłącza automatyczną przerwę. Historyczne wartości i aktywne treningi sprzed poprawki pozostają nienaruszone.

`+30 s` wydłuża bieżącą przerwę, „Pomiń” ją kończy, „Uruchom ponownie” restartuje odliczanie jej długości. Tymczasowe wydłużenie nie zmienia bazowej przerwy następnej serii; bazę zmieniamy jawnie w ustawieniu odpoczynku ćwiczenia. Przełączenie na inne ćwiczenie usuwa poprzednie odliczanie tego treningu, nie zmieniając całkowitego czasu. Zmiana route lub reload nie resetuje odliczania.

Ćwiczenie czasowe ma planowany czas i przycisk „Start … s”, a wykonanie wymaga jawnego zapisu. Sam upływ czasu nie zapisuje serii. Bieżnia ma formularz czasu/dystansu i „Zapisz cardio”, bez automatycznej przerwy. Mobility pokazuje numer ćwiczenia, własne dawkowanie i kontekstowy „Start … s”, jeśli czas istnieje. „Gotowe” zalicza jedną serię, a po ostatniej przechodzi do następnego ćwiczenia; nie oznacza automatycznie całej rutyny jako wykonanej. Odpoczynek Mobility występuje wyłącznie z zapisanej definicji.

„Zakończ trening” otwiera podsumowanie czasu, wykonanych ćwiczeń, serii roboczych/rozgrzewkowych, cardio i objętości. Dopiero „Zapisz i zakończ” zapisuje snapshot w historii. Można wrócić do treningu bez zapisu końcowego. Dane, backup v5 i migracja pozostają w dotychczasowym modelu.

Nowe ćwiczenia własne Mobility i nowe elementy Mobility bez własnej definicji mają przerwę 0: aplikacja nie dopisuje odpoczynku do planu fizjoterapeuty. Zapisane wcześniej przerwy pozostają bez zmian.

Zmiany kontrolek odpoczynku nie kasują wpisywanych pól kolejnej serii. Ten roboczy formularz jest zachowywany w otwartej aplikacji, ale nie staje się zapisaną serią ani częścią backupu przed zatwierdzeniem.

## Mobility bez rutyny — domknięcie flow

Po ostatniej serii ćwiczenia w swobodnym Mobility otwieramy „Wybierz następne ćwiczenie”. Nie próbujemy przejść poza koniec listy. Można dodawać kolejne ćwiczenia, wracać przez „Dzisiejsze Mobility”, anulować picker i otworzyć go ponownie lub zakończyć Mobility także z pickera. Sam picker nie zatrzymuje ani nie blokuje odpoczynku.

Gotowa rutyna przechodzi po ostatniej serii do kolejnej zapisanej pozycji bez pickera. Ostatnia pozycja ma „Gotowe — zakończ rutynę” i prowadzi do zakończenia Mobility. Przy wielu seriach zaliczamy tylko jedną na kliknięcie; dopiero ostatnia kończy ćwiczenie.

Zaliczenie usuwa dotychczasowy timer tego Mobility. Zdefiniowana przerwa uruchamia `rest`; przy przerwie 0 nie zostaje timer wykonywania ćwiczenia. Przerwa może liczyć również podczas wyboru/dodawania kolejnego ćwiczenia. Timer innego aktywnego treningu nie jest usuwany przy braku przerwy Mobility.

Nowe Mobility mają małą opcjonalną informację `routineBased` o sposobie startu. Pozwala to zachować tryb po reloadzie, imporcie i usunięciu źródłowej rutyny, nawet gdy nazywała się po prostu „Mobility”. Nie zmieniamy struktury ćwiczeń, serii, pomiarów ani wersji backupu v5. Walidator przyjmuje stare zapisy bez tego pola i nie dopisuje go do istniejących danych. Dla dawnych zapisów pochodzenie odtwarzamy z nazwy i zgodności pełnej definicji rutyny; nie przepisujemy historii. Brak jednoznacznej definicji dla dawnego domyślnego „Mobility” pozostawia swobodny wybór następnego ćwiczenia i ręczne zakończenie.

Oddzielny test Samsung regresji obejmuje: jedno Open book → Gotowe → picker → Cat-cow → trzecie ćwiczenie → powrót do pierwszego → reload offline → historia. Dodatkowo testujemy 3 serie, timery z przerwą 0 i 15 s, zachowanie odliczania po wybraniu kolejnego ćwiczenia oraz rutynę usuniętą już po rozpoczęciu wykonania.
