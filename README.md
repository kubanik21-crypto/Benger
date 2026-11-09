# Benger 1.0.8 — przypomnienia posiłków, treningów i pomiarów

Build 8bb814a81cb67598d435b11acafad4ac41cde2d1, branch feature/daily-reminders.
APK: Benger-1.0.8-8bb814a.apk

## Aktualizacja

Na APK 1.0.6 lub 1.0.7 instaluj jako aktualizację, bez odinstalowania. Zachowano applicationId, podpis, origin oraz bazy danych. Przed aktualizacją zalecany jest świeży pełny backup. Starego 1.0.5 z innym podpisem nie odinstalowywać bez zabezpieczenia danych.

## Ustawienia

Więcej → Ustawienia → Powiadomienia i przypomnienia.

Treningi i Mobility: własny przełącznik, wyprzedzenie i domyślna godzina dla wydarzeń bez godziny. Zachowano dotychczasową konfigurację i kalendarz.

Posiłki i pomiary: rozwiń Posiłki lub Pomiary, włącz wybrane kategorie, ustaw godziny i dni, naciśnij Zapisz posiłki i pomiary. Potwierdź zgodę Androida, jeśli jest potrzebna. Wybierz kategorię testową i naciśnij Test przypomnienia o posiłku / pomiarze.

Powiadomienia są lokalne i działają bez internetu, również po zamknięciu aplikacji. Kliknięcie otwiera dziennik z danym posiłkiem albo odpowiedni formularz Progresu. Nie zapisuje danych automatycznie.

Android może opóźniać lub wyciszać powiadomienia przy oszczędzaniu baterii, blokadzie kanału albo trybie Nie przeszkadzać. Dostępny jest przycisk ustawień powiadomień w telefonie. Po wymuszonym zatrzymaniu aplikacji trzeba ją ponownie uruchomić. Po zmianie strefy czasowej otwórz Bengera.

Ustawienia są objęte backupem v8; starsze backupy pozostają obsługiwane. Zgody systemowe nie są przenoszone przez backup.

Bez zmian produkcyjnego main, strony WWW, Workera AI i usług płatnych. Prywatne klucze oraz dane użytkownika nie są publikowane.

Weryfikacja: 1536 testów Node, 345 Chromium, assembleRelease i lintRelease, apksigner oraz brak uprawnień do dokładnych alarmów.
