# Etap 3C — ręczna synchronizacja Android → Google Sheets

Dalszy etap: [opcjonalna automatyzacja Android (3E)](google-sheets-auto.md).

## Zakres

Gałąź `feature/local-sync-export`. Integracja korzysta z eksportu snapshot v1,
mappera i uzgadniania z etapu 3A. PWA zachowuje lokalny eksport i symulację planu;
nie otrzymuje OAuth ani rzeczywistego transportu. Nie ma synchronizacji w tle,
zmian biznesowych danych lokalnych, formatu backupu, backendu ani integracji Garmin.

Konfiguracja Google Cloud pozostaje jak w [instrukcji OAuth](google-oauth-android.md):
Drive API i Sheets API, klient Android dla istniejącego applicationId i certyfikatu,
użytkownik testowy oraz wyłącznie `https://www.googleapis.com/auth/drive.file`.
Nie potrzeba nowych zakresów, sekretu klienta, API key ani konta usługowego.
Przycisk działa w Androidzie z `BENGER_GOOGLE_AUTH_ENABLED=true`.

## Używanie i bezpieczny test na telefonie

1. Zapisz zwykły pełny backup Bengera w bezpiecznym miejscu.
2. Zainstaluj zgodnie podpisany testowy APK jako **aktualizację** obecnej aplikacji.
   Nie odinstalowuj jej, nie czyść danych. Przy konflikcie podpisu przerwij.
3. Sprawdź istniejący dziennik, pomiary i treningi.
4. W **Więcej → Ustawienia → Synchronizacja danych** połącz swoje konto Google.
5. Wybierz **Utwórz lub odzyskaj prywatny arkusz**. Powstaje jeden prywatny
   `Benger – RAW DATA` z ośmioma zakładkami i nagłówkami, bez danych zdrowotnych.
   Link pozwala sprawdzić właściciela, prywatność i puste zakładki.
6. Ustaw daty w istniejącym formularzu eksportu. Przygotuj podgląd synchronizacji.
   Sprawdź liczbę nowych/zmienionych/usuwanych rekordów, rozwijane szczegóły
   starych i nowych wartości oraz ewentualny wpływ poza zakresem.
7. Usunięcia i wpływ poza zakresem wymagają osobnych potwierdzeń i ponownego
   przygotowania planu. Potwierdzenia dotyczą konkretnego zestawu zmian.
8. Dopiero **Wyślij zatwierdzony plan do Google** oraz **Wyślij** w natywnym
   oknie Androida rozpoczynają zapis danych. Anulowanie nie zapisuje ich w Google.
9. Poczekaj na komunikat potwierdzonej synchronizacji, otwórz arkusz, porównaj
   sumy i liczby rekordów z lokalnym eksportem. Ponów podgląd: powinien pokazać brak
   zmian. Zmodyfikuj jeden rekord lokalny, sprawdź podgląd aktualizacji.
10. Przetestuj brak internetu i anulowanie potwierdzenia: dane lokalne pozostają
    dostępne. Przy niepotwierdzonym zapisie użyj **Sprawdź arkusz i wynik zapisu**.
    Aplikacja nie ponawia zapisu automatycznie.

## Zakładki i kontrakt

Kolumny są generowane dla Androida z jednego źródła `SHEET_COLUMNS` w
`sheets-mapper.js`; nie ma niezależnej kopii schematu w Javie. Wersja arkusza: 1.
Wszystkie rekordy posiadają stabilny klucz z przestrzenią profilu i źródłowym ID,
jednostki pozostają jawne. Puste komórki oznaczają brak danych, a zero jest liczbą.
Makro pochodzi z historycznych wpisów, nie aktualnych przepisów.

| Zakładka | Zawartość |
| --- | --- |
| Dziennik żywieniowy | Dzienne sumy i obowiązujący cel |
| Posiłki | Pojedyncze historyczne wpisy żywieniowe |
| Treningi | Ukończone sesje |
| Serie | Ćwiczenia, serie, ciężary, powtórzenia, RIR i rodzaj serii |
| Mobility | Ukończone sesje i ćwiczenia |
| Pomiary | Masa ciała i obwody |
| Cele | Pełna historia celów |
| Synchronizacja | Operacja, zakres, wersje schematu, status i liczby rekordów |

Zdjęcia, ciśnienie, prywatne notatki, sekrety i dane uwierzytelniające nie trafiają
do arkusza. To uporządkowany zbiór analityczny, a nie pełny backup aplikacji.

## Architektura i zabezpieczenia

- JS: `google-sheets.js` dekoduje ścisły model Google, korzysta ze wspólnego
  mappera/reconcillera i przygotowuje potwierdzany plan; `google-sheets-ui.js`
  prezentuje liczniki, szczegóły, potwierdzenia i status.
- Java: `BengerGoogleSheetsPlugin` obsługuje jedynie zamknięty zestaw operacji
  Drive/Sheets przez HTTPS, bez arbitralnych URL czy nagłówków z JavaScript.
  `GoogleSheetsWire` sprawdza typy, nagłówki, profil i zamknięty protokół batch.
- Token jest wyłącznie w natywnej pamięci sesji. Nie trafia do bridge, preferencji,
  logów, eksportu ani backupu. HTTP 401 unieważnia lokalny i SDK cache tokena;
  kolejne połączenie wymaga działania użytkownika.
- Prywatne preferencje natywne przechowują identyfikatory instalacji, powiązanie
  konta z arkuszem, potwierdzoną bazę porównania i dziennik oczekującej operacji.
  Ten dziennik zawiera hashe, ID, daty i typy, nie pełną treść posiłków czy pomiarów.
  Nie zmieniamy formatu backupu; istniejąca konfiguracja Androida wyłącza backup OS.
- Przed odczytem/zapisem sprawdzamy właściciela, MIME, nazwę, appProperties
  profilu/urządzenia i pełną listę uprawnień: wyłącznie właściciel. Udostępniony
  plik jest blokowany; aplikacja sama nie zmienia uprawnień.
- Utworzenie pliku jest poprzedzone wyszukaniem własnego oznaczonego arkusza.
  Dziennik próby powstaje przed POST. Po niepewnej odpowiedzi nie tworzymy
  kolejnego pliku w ciemno; odzyskujemy plik po appProperties.
- Inicjalizacja może zmienić wyłącznie pusty, świeżo utworzony plik. Nie
  wykorzystujemy ręcznie istniejącego arkusza ani historii obcej instalacji.
- Plan sprawdza pełny lokalny snapshot, baseline, stabilne ID i zakres. Zmiana
  daty i całej sesji jest uzgadniana jako całość. Historia celów jest kompletna;
  jej wpływ poza zakresem wymaga potwierdzenia. Niepełne źródło, obca instalacja,
  rozbieżna baza i duży podejrzany ubytek blokują operację zgodnie z etapem 3A.
- Po podglądzie ponownie sprawdzamy źródło, konto i arkusz; Java wykonuje jeszcze
  ostatni odczyt przed POST. Zapis to pojedynczy atomowy `spreadsheets.batchUpdate`
  obejmujący wszystkie osiem tabel. Native akceptuje tylko resize/updateCells,
  wartości typowane bez formuł; nie ma dowolnych poleceń batch.
- Przed POST trwale zapisujemy identyfikator operacji i oczekiwany digest.
  Po POST niezależny odczyt musi potwierdzić docelowy hash JS oraz pełną macierz
  wartości natywnie. Dopiero wtedy aktualizujemy lokalny baseline.
- Utrata odpowiedzi po udanym zapisie pozwala potwierdzić go odczytem bez
  ponownego POST. Niepewny lub częściowy wynik blokuje kolejne zapisy.

## Ograniczenia

- Google Sheets nie udostępnia tu compare-and-swap. Między ostatnim odczytem a
  zapisem istnieje małe okno wyścigu. RAW DATA wymaga jednego piszącego urządzenia;
  nie edytuj tych zakładek ręcznie podczas synchronizacji. Widoki/wykresy twórz
  w osobnych zakładkach. Tabele RAW są przepisywane, z zachowaniem rekordów spoza
  zakresu wynikającym z reconcillera. Formatowanie i formuły w RAW nie są wspierane.
- Zmiana instalacji/utrata prywatnych preferencji blokuje przejęcie starej historii.
  Migracja właściciela profilu/urządzenia nie jest jeszcze zaimplementowana.
- Niepewna próba, której wynik stale pozostaje stary lub niezgodny, może wymagać
  ręcznej diagnostyki. Nie ma przycisku omijającego blokadę i ryzykującego duplikaty.
- Maksymalny body zapisu 1,8 MB, dziennik metadanych 512 KiB, odczyt 16 MiB.
  Duże dane wymagają przyszłego dopracowania transportu; nie dzielimy jednego
  zatwierdzonego planu na nieatomowe zapisy.
- Google Cloud może wymagać ponownego połączenia lub zgody w trybie testowym.
  Benger nie synchronizuje automatycznie po odzyskaniu sieci.
- Node/Chromium używają syntetycznych danych i symulowanego transportu. JUnit
  testuje rzeczywistą Javę protokołu; Gradle kompiluje przeciw prawdziwemu SDK.
  Nie są to rzeczywiste zapisy do konta Google. Test end-to-end na Samsungu
  z prywatnym arkuszem pozostaje testem użytkownika po instalacji APK.
