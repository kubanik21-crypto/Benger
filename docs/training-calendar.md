# Etap 14 — kalendarz treningów

Baza: `origin/main` = `19f82ee1a7152d76ababfd820d7685887ccb43cc`, post-merge Tests sprawdzone przed rozpoczęciem. Moduł nie dodaje szóstego elementu bottom nav, zewnętrznego kalendarza, powiadomień, API ani nowego silnika treningu.

## Dane i przechowywanie

`training-calendar.js` jest czystym modelem dat/reguł. Harmonogram `{rules, exceptions}` jest opcjonalną częścią istniejącego training state, zapisaną jako `training:schedule` w tym samym magazynie meta IndexedDB. Brak rekordu oznacza wirtualny pusty harmonogram; nie przepisujemy starych sesji ani nie migrujemy bazy.

Reguła ma stabilne ID, kind workout/mobility, opcjonalne templateId, title snapshot, startDate, time lub null, recurrence once/weekly, weekdays (Pn=0…Nd=6), opcjonalne until, notatkę i createdAt/updatedAt. Maksymalnie 500 reguł i 5000 wyjątków. Wyjątek to `{ruleId,date,type:'skip'}`; musi dotyczyć faktycznego wystąpienia istniejącej reguły. Nazwy/notatki i wszystkie wartości są walidowane. Brak szablonu nie unieważnia reguły.

Nie zapisujemy occurrence. Miesiąc, wybrany dzień i tydzień generują je na żądanie, z ograniczeniem zakresu do 366 dni i 20 000 wyników. Plan nie jest historią wykonania. Po usunięciu reguły/szablonu historia nadal jest samowystarczalna.

## Daty i edycja

Dzień jest civil date YYYY-MM-DD. Walidacja kalendarzowa i arytmetyka opierają się na częściach liczbowych oraz UTC getters/setters, nigdy na lokalnym parsowaniu daty YYYY-MM-DD ani na przesunięciu strefowym. Timestampy createdAt/updatedAt opisują czas zapisu, a nie dzień kalendarza. Testy obejmują lata przestępne, granice miesięcy/lat i DST, uruchomione w UTC, Europe/Warsaw, America/Los_Angeles i Pacific/Auckland.

Zmiana cykliczna od dnia D zamyka starą regułę D−1 i tworzy nową z nowym ID od D. Stara reguła i wyjątki sprzed D pozostają. Jeśli zmiana dotyczy samego początku, zastępuje przyszłą regułę. Jednorazowy plan można też przenieść na inny dzień. Pominięcie pojedynczego dnia dodaje wyjątek, bez dotykania następnego tygodnia. Usunięcie od D nie usuwa ukończonych ani aktywnych sesji.

## Start i historia

`repository.start(kind, templateId, before, scheduled)` pozostaje jedynym silnikiem startu. W jednej istniejącej transakcji:

1. sprawdza brak aktywnej sesji tego rodzaju;
2. weryfikuje occurrence i faktyczny lokalny dzisiejszy dzień;
3. odrzuca przyszłe/przeszłe, pominięte, niezgodne rodzajowo i już wykonane occurrence;
4. tworzy normalny snapshot aktualnej wersji szablonu, lub pustą aktywność, gdy szablon usunięto;
5. zapisuje opcjonalne `{ruleId,date}` w `scheduled`.

Reference przechodzi do completed snapshot i backupu. Nie musi wskazywać istniejącej dziś reguły. Data reference musi zgadzać się z datą rozpoczęcia sesji. Nie dopasowujemy historii do nazw ani templateId. Starsze sesje bez reference nadal są widoczne jako wykonane, bez zgadywania powiązań. Szybkie dwukrotne kliknięcie nie tworzy dwóch aktywnych sesji — chronią je UI i transakcja.

Timer, serie, Mobility bez rutyny, głos oraz historyczne szczegóły są używane bez drugiej implementacji. Kliknięcie wykonania w kalendarzu otwiera istniejące szczegóły Historii.

## UI i Dashboard

`training-calendar-ui.js` generuje miesięczną siatkę, agendę dnia, formularz oraz kompaktowy tydzień. Dni są buttonami z pełną polską etykietą, aria-pressed i aria-current=date. Dzisiaj ma tekst i podkreślenie, wybór obramowanie; znaczniki T/M/✓ nie polegają wyłącznie na kolorze. Maksymalnie trzy znaczniki + liczba pozostałych, pełna lista poniżej. Wpisy z godziną sortują się przed tymi bez godziny. Calendar respektuje wspólne tokeny light/dark/system.

Deep link `#/trening/kalendarz` przeżywa reload i obsługuje back/forward bez podwójnego logical route event. Wybrany dzień/miesiąc są stanem widoku; po pełnym reloadzie kalendarz otwiera bieżący miesiąc/dzień. Pozostałe zakładki pozostają wewnątrz `#/trening`.

Dashboard pokazuje maksymalnie trzy najważniejsze plany na **faktyczne dzisiaj**, nawet jeśli data dziennika jest inna, z jednoznaczną datą w nagłówku. Wykonane są oznaczane z reference, aktywne można wznowić. Pozostałe plany są pod linkiem do kalendarza. Brak harmonogramu zachowuje dotychczasowy dashboard. Nie przypisujemy ćwiczeń do przeszłego/future dnia przez wybór dnia w kalendarzu.

## Backup i bezpieczeństwo

Backup **v7** dodaje `data.trainingSchedule`; nie dubluje reguł w `data.training`. W sesjach pozostaje opcjonalne scheduled. Import v1–v6 zna starszy format, więc merge i replace zachowują obecny kalendarz. Import v7 merge łączy ID/wyjątki bez duplikatów (istniejący rekord wygrywa konflikt), replace odtwarza harmonogram, także pusty. Harmonogram uczestniczy w istniejącym journal/rollbacku razem z resztą danych. Walidacja importu i limity zdjęć pozostają bez zmian.

Wszystkie zapisy repozytorium czytają aktualne meta wewnątrz transakcji. Quota error nie udaje sukcesu. Usuwanie/pominięcie wymaga potwierdzenia. UI używa textContent, nie innerHTML. Nowe funkcje nie żądają uprawnień do powiadomień ani nie wysyłają kalendarza do sieci.

## Upgrade i testy

`tests/fixtures/stage13-upgrade.json.gz` zawiera 86 rzeczywistych publicznych plików tekstowych z wymaganego SHA main. Test uruchamia stary shell i stary SW, tworzy przez stare repozytoria pełny profil ze zdjęciem, dark settings, planami/rutynami, historią i dwiema aktywnymi sesjami/timerem, a następnie wykonuje ręczny upgrade. Pełny backup sprzed aktualizacji jest porównywany pole po polu z nowym. Harmonogram dostaje pusty default; theme i onboarding zachowują się poprawnie.

Testy jednostkowe pokrywają recurrence, daty, skips, split, przenoszenie once, konflikty, bounds, legacy state, v1–v7 backup i rollback. Browser pokrywa tydzień, miesiące, skip, start/finish, provenance, Dashboard, history, back/forward, offline, mobile 320/360/390/430, missing template fallback, future denial i quota.

## Preview i ograniczenia

`/Benger/previews/etap-14/`, namespace preview-etap-14, scope wyłącznie tego katalogu. Produkcja i starsze preview nie są nadpisywane. Harmonogram jest lokalny, bez synchronizacji, alarmów i powiadomień. Powtarzanie obejmuje tylko raz lub wybrane dni tygodnia. Nie istnieje osobny RRULE/calendar backend ani głosowe interpretowanie poleceń planowania. Instalacja i kamera/voice pozostają funkcjami wcześniejszych etapów.
