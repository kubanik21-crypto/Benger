# Etap 3E — opcjonalna automatyzacja na Androidzie

## Punkt wyjścia i zakres

Branch `feature/local-sync-export`, bazowy commit `8ae9a69`. Ręczna integracja,
OAuth i rzeczywisty arkusz są według zgłoszenia użytkownika sprawdzone na telefonie.
Ten etap nie tworzy kolejnego arkusza, nie zmienia schematów backupu, źródłowych
magazynów ani podpisu/pakietu Androida. PWA nie ma nowych aktywnych kontrolek Google.
Nie publikujemy APK, nie scalamy main ani nie wdrażamy produkcji.

## Architektura

- `sheets-auto.js`: niezależny harmonogram i trwałe metadane kolejki, retry,
  powiadomienia UI oraz obserwacja zdarzeń aplikacji. Domyślnie wyłączony.
- `google-sheets.js`: istniejący mapper/reconciller, nowa metoda `automatic`,
  wspólny mutex wszystkich instancji koordynatora dla ręcznych/automatycznych
  operacji, kodowane i bezpieczne komunikaty błędów.
- `google-sheets-ui.js`: przełącznik, status, ostatni sukces, oczekujące
  sprawdzenie danych i przycisk „Synchronizuj teraz”. Ręczny podgląd pozostaje.
- `BengerGoogleSheetsPlugin`: natywna zgoda na automatyzację dla danego konta,
  profilu i arkusza; nieinteraktywny zapis korzysta z tej samej zamkniętej ścieżki
  transportu co dotychczasowy zapis ręczny. Nie omija weryfikacji.
- `GoogleSheetsWire.automaticSafe`: niezależna natywna kontrola braku usunięć
  oraz objęcia wszystkich przekazywanych rekordów zakresem historii.

Włączenie jest świadomą zgodą na wysyłanie zwykłych aktualizacji bez pytania przy
każdym zapisie. Najpierw wymagany jest istniejący arkusz z potwierdzonym baseline,
zgodność pełnego odczytu z baseline i prywatność pliku. Włączenie nie tworzy pliku.
Stan jest powiązany z hashem konta, profilem, urządzeniem i ID arkusza. Zmiana konta
wymaga właściwego powiązania i nie przenosi danych automatycznie na inne konto.

## Wykrywanie i trwała kolejka

Obserwujemy `benger:diary`, `benger:training`, `benger:progress`, `benger:goals` i
zmiany storage. Po lokalnym zapisie ustawiany jest trwały znacznik dirty i rosnąca
rewizja; debounce około 60 s grupuje kolejne zmiany. Przy aktywnym WebView co minutę
sprawdzamy źródła również na wypadek zapisu bez zdarzenia. Uruchomienie/powrót do
aplikacji i odzyskanie sieci sprawdzają kolejkę. Brak eventu przed zabiciem procesu
nie gubi danych: następny start ponownie odczytuje pełny snapshot.

Oddzielny klucz `${NUTRITION_STORAGE_KEY}.sheets-auto.v1` przechowuje wyłącznie:
wersję metadanych, opt-in, powiązanie, dirty/rewizję, fingerprint ostatnio
uzgodnionego źródła, maks. 64 wcześniejsze fingerprinty, debounce/retry,
znacznik pauzy, status i czas sukcesu. Nie zawiera treści posiłków, notatek,
zdjęć ani tokenów. Nie jest dodany do backupu. PWA nie tworzy tego klucza.
Błąd odczytu/zapisu kolejki blokuje automatyczne wysyłanie zamiast udawać trwałość.

To kolejka **uzgodnienia najnowszego snapshotu**, nie dziennik każdej czynności.
Nie odtwarzamy po kolei starej edycji i późniejszego jej cofnięcia. Kolejne zmiany
w czasie wysyłania zachowują dirty i są uzgadniane w następnym przebiegu.
Pełny payload nie jest duplikowany w localStorage. Natywny istniejący journal
operacji zapisuje identyfikator i hashe przed POST oraz potwierdzenie po odczycie.

## Zakres i bezpieczeństwo

Zakres obejmuje wszystkie daty pełnego lokalnego źródła i potwierdzonego inventory;
nie trzeba wybierać go ręcznie. Dodanie starszego rekordu rozszerza zakres.
Obejmuje to żywienie, ukończone treningi/Mobility, pomiary oraz całą historię celów.
Nie przeliczamy makro historycznych posiłków z aktualnych przepisów.

Fingerprint niezmienionego źródła pozwala ominąć żądania do Google; lokalny odczyt
pełnych danych nadal następuje. Wyjątkiem jest oczekujący journal, który wymaga
sprawdzenia wyniku. Zmiana lokalna podczas przygotowania planu ponawia odczyt później.

Zachowane są blokady schematu, prywatności, właściciela, profilu/urządzenia,
baseline, kompletności sesji, masowego ubytku ponad 25%, usunięć, wpływu poza
zakresem i niejednoznacznego zapisu. Automat nigdy nie podaje digestów potwierdzeń.
Native dodatkowo nie akceptuje usunięcia nawet pojedynczego klucza ani zmiany
arkusza względem ostatniego natywnie potwierdzonego zestawu wartości.

Przed POST jest ponowny odczyt Google; hash i podpis struktury muszą odpowiadać
planowi. Zachowujemy istniejący pojedynczy atomowy `spreadsheets.batchUpdate`:
przepisuje zarządzane tabele **warunkowo**, z pełnym uzgodnionym stanem i ochroną
rekordów spoza zakresu. Nie jest to bezwarunkowy reset arkusza ani nowy resolver.
To minimalna adaptacja istniejącego transportu, bez nieatomowego dzielenia zapisu.
Arkusz RAW nie jest przeznaczony do ręcznych edycji ani równoległych writerów.

Retry: 1, 2, 4… do 30 minut. Poll nie omija backoffu. Brak sieci czeka na sieć;
wygaśnięcie zgody czeka na jawne połączenie. Przy niejasnym wyniku do trzech
kontrolowanych ponowień **odczytu statusu**; nigdy ślepego POST. Potem pauza.
Konflikty i wymagane potwierdzenia nie są automatycznie zatwierdzane.
Wyłączenie usuwa timery, ale nie usuwa danych/kolejki/arkusza. Już wysłanego
żądania HTTP nie można cofnąć. Natywny trwały wyłącznik jest ustawiany również
offline i bez aktywnego tokena; nie wymaga dostępu do Google ani czekania na mutex
operacji odczytu/zapisu.

## Backup i możliwość cofnięcia historii

Capture listener na istniejącym przycisku `backup-import` zapisuje trwałą pauzę
**przed** uruchomieniem importera, niezależnie od wyniku importu. Nie zmieniamy
jego walidacji, transakcji, formatów ani rollbacku. Nawet nieudany import może więc
wymagać ponownej weryfikacji — konserwatywny wybór bezpieczeństwa.
Po restarcie pauza pozostaje. Nie znika po samym przełączeniu opt-in.
Dodatkowo rozpoznajemy powrót do jednego z 64 wcześniej uzgodnionych fingerprintów,
a wspólny reconciller nadal blokuje znikanie danych i duże ubytki inventory.

Zwolnienie pauzy wymaga udanej synchronizacji ręcznej albo bezbłędnego ręcznego
podglądu „brak zmian”, z zakresem obejmującym **cały** inventory źródła i baseline.
Nie wystarczy podgląd pojedynczego dnia pomijający resztę historii.

Ograniczenie: model źródeł nie ma globalnego monotonicznego revision logu ani
wersji każdej edycji. Nie można bez dodatkowej zmiany modelu wykryć każdej ręcznej
podmiany bazy/programowego importu poza interfejsem, jeśli zmienia wartości przy
tych samych ID i nie odpowiada zapamiętanemu fingerprintowi. Nie deklarujemy
nieistniejącej pełnej ochrony przed takim przypadkiem. Import przez zwykły UI
jest trwale wstrzymywany; nie korzystać z programowych podmian podczas automatyzacji.

## Android w tle — wariant etapowy

**Zaimplementowano foreground-first**. Gdy dokument jest ukryty, nie zaczynamy
nowej synchronizacji. Już rozpoczęta może się zakończyć. Timery WebView nie
zapewniają pracy po zamknięciu procesu, restarcie telefonu ani przy optymalizacji
baterii. Nie prosimy o wyłączenie optymalizacji i nie dodajemy foreground service.

WorkManager nie ma dostępu do działającego mappera JS ani IndexedDB WebView jako
bezpiecznej warstwy źródłowej. Token aktualnego mechanizmu znika razem z procesem.
Samo dodanie Workera nie daje poprawnej synchronizacji po zamknięciu aplikacji.

Rekomendowany kolejny etap: natywny prywatny outbox z zaszyfrowanym, zwalidowanym
snapshotem/planem i rewizją źródeł; Worker z ograniczeniem internetu, unikalną pracą
oraz tymi samymi kontrolami baseline/journal. Ponowna autoryzacja tylko jeśli SDK
potrafi ją zakończyć bez interakcji; wymagany PendingIntent oznacza powrót do UI,
bez okien autoryzacji z tła. Wymaga osobnej analizy bezpieczeństwa, integracji
rewizji źródeł i testów fizycznego Androida/Doze/reboot/force-stop. Nie wdrożono go
w tym etapie, aby nie powielać silnika danych i nie przechowywać tokenów.

## Test odbiorczy i przyszła aktualizacja

Nie opublikowano nowego APK. Przed uzgodnionym buildem trzeba użyć istniejącego
klucza, tego samego applicationId `io.github.kubanik21crypto.benger`, origin i
wyższego versionCode. Nie odinstalowywać aplikacji ani czyścić danych.

1. Zachowaj pełny backup. Zainstaluj dopiero uzgodniony testowy APK jako aktualizację.
2. Sprawdź istniejące dane, połącz właściwe Google. Nie twórz kolejnego arkusza.
3. Włącz automatyzację. Sprawdź pierwszy pełny podgląd/rezultat i liczniki.
4. Dodaj posiłek, po minucie sprawdź jeden nowy klucz. Zmień ilość — nadal jeden klucz.
5. Popraw historyczny wpis; dodaj pomiar, ukończ trening i Mobility. Porównaj arkusz.
6. Bez zmian nie powinno być nowych operacji Google. Dodaj kilka zmian szybko:
   jeden uzgodniony zapis po debounce, bez duplikatów.
7. Offline dodaj wpis, zamknij/otwórz aplikację, odzyskaj sieć, połącz Google,
   jeżeli wymagane. Sprawdź zachowaną kolejkę i końcowy committed.
8. Anuluj/wygaś autoryzację. Nie powinno być spontanicznego okna zgody.
9. Wyłącz automat, dodaj wpis. Nie wysyła się; włącz ponownie, kolejka nie znika.
10. Usunięcia, restore i konflikty testuj **wyłącznie na syntetycznych danych
    i osobnym testowym arkuszu**, nigdy usuwając prawdziwą historię dla testu.
    Sprawdź blokadę, restart i ręczne potwierdzenie całego zakresu.

Testy Node i Chromium wykorzystują syntetyczne dane/atrapy Google; JUnit testuje
rzeczywistą Javę protokołu. Kompilacja/lint nie są testem prawdziwego SDK w telefonie.
Nowa automatyzacja nie została jeszcze zweryfikowana na rzeczywistym urządzeniu.

## Wyniki weryfikacji etapu 3E

- Pełne Node: **1764/1764**.
- Pełne Chromium: **380/380**; dodatkowy końcowy test panelu automatyzacji i ręcznej synchronizacji: **6/6**.
- Android JUnit: **33/33**; `:app:testDebugUnitTest :app:lintDebug` zakończone sukcesem.
- `git diff --check`: bez błędów.
- Rzeczywisty telefon/Google: nowa automatyzacja jeszcze **nieprzetestowana**.
- Nie tworzono arkusza ani nie wykonywano zapisów do prawdziwego Google podczas testów.
- Nie zbudowano/nie opublikowano nowego APK; nie wdrożono produkcji ani nie scalono main.

Nowe testy obejmują rzeczywisty mapper/reconciller i symulowany transport, pełny
zakres historii, brak dodatkowych żądań przy zgodnym fingerprint, edycję w trakcie
ustalania zakresu, wspólny mutex, odzyskanie po utracie odpowiedzi, brak duplikatów,
kompletność sesji/serii, cele i pomiary, trwały dirty/restart, debounce, offline,
auth, retry/backoff, import i pauzę, wyłączenie oraz formaty mobilne 360/430 px.

## Zmienione pliki

- `android/app/src/main/java/io/github/kubanik21crypto/benger/BengerGoogleSheetsPlugin.java`
- `android/app/src/main/java/io/github/kubanik21crypto/benger/GoogleSheetsWire.java`
- `android/app/src/test/java/io/github/kubanik21crypto/benger/GoogleSheetsWireTest.java`
- `docs/google-sheets-android.md`
- `docs/google-sheets-auto.md`
- `google-auth-ui.js`
- `google-auth.js`
- `google-sheets-ui.js`
- `google-sheets.js`
- `package.json`
- `product-polish-ui.js`
- `scripts/public-assets.mjs`
- `sheets-auto-integration.test.js`
- `sheets-auto.browser.test.js`
- `sheets-auto.js`
- `sheets-auto.test.js`
- `sw-assets.js`
