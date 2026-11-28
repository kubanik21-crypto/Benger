# 4D.4 — Smart Sync

Synchronizacja nadal korzysta z istniejącego natywnego transportu, prywatnego arkusza, powiązania konta/profilu, sprawdzania bieżącej wersji i atomowego batchUpdate. Nie zmieniono OAuth, schematu RAW DATA ani Google Cloud. Automatyzacja respektuje zapisane włączenie/wyłączenie; nie zostaje samoczynnie włączona.

## Trwały zamiar użytkownika

`sync-intents.js` zapisuje w localStorage ograniczony dziennik operacji **przed** zapisem żywienia, ukończonego treningu, Mobility lub pomiaru. Operacja ma ID, tożsamość istniejącego powiązania, projekcję poprzedniej/następnej wartości oraz fazę prepared/committed. Nie zawiera zdjęć, ciśnienia, notatek ani tokenów. Zapis nieudany anuluje przygotowaną operację. Pozostawione prepared po awarii nie jest zgadywane ani promowane do świadomego usunięcia. Przywrócenie backupu ustawia trwałe wstrzymanie wymagające ręcznej weryfikacji.

`sync-intent-proof.js` porównuje cały łańcuch zmian z odczytanym arkuszem i aktualnym snapshotem. Zgoda na automatyczne usunięcie dotyczy wyłącznie dokładnych poprzednich wierszy konkretnego rekordu. Trening obejmuje sesję, ćwiczenia i wszystkie serie. Przeniesienie daty zachowuje ID. Domyślne zabezpieczenia uzgadniania pozostają dla każdej niewyjaśnionej utraty danych; nie używamy ogólnej zgody na kasowanie.

Natywna `GoogleSheetsWire` niezależnie sprawdza SHA-256 każdego usuwanego wiersza, jego grupę, zakres dat i zużycie dowodu dokładnie raz. Brak, zmiana lub dodatkowy dowód blokuje zapis. Kodowanie hasha jest jawnie typowane i zgodne Java/JS, także dla Unicode i małych liczb. Dotychczasowy ośmiopolowy journal jest nadal obsługiwany; nowe pole authorizedDeletes jest opcjonalne i ściśle walidowane.

Potwierdzenie lokalnej kolejki następuje dopiero po odczycie i weryfikacji wyniku Google oraz zatwierdzeniu baseline. Utrata odpowiedzi pozostawia operację do odzyskania; nie oznacza automatycznego powtórzenia POST. Nowe operacje powstałe równolegle nie są usuwane z kolejki.

## Interfejs

Jedna podstawowa akcja „Synchronizuj teraz”, status i istniejący przełącznik automatyzacji. Dokładny podgląd zakresu i diagnostyka są zwinięte. Podgląd użytkowy opisuje nazwę, datę, porcję i zmianę wartości; identyfikatory pozostają w szczegółach technicznych. Akcja zatwierdzająca wyjątkowe zmiany przygotowuje nowy plan z dokładnymi digestami; nie omija twardych blokad ani natywnego potwierdzenia.

## Granice bezpieczeństwa

- Zmiany z nieznanego powiązania, innego profilu/urządzenia, prepared, niezgodnego arkusza lub cofniętego źródła bez pełnego dowodu wymagają ręcznego uzgodnienia.
- Jedna masowa operacja usuwania oraz ponad 10 grup usunięć w automatycznej paczce wymagają ręcznego przeglądu. Dowody mają limity liczby i wielkości.
- Rejestr ma limit 2000 operacji/4 MiB. Błąd przygotowania rejestru nie może prowadzić do nieudokumentowanego automatycznego kasowania.
- Kolejka jest lokalna i nie jest kopiowana jako prawda o operacjach innego urządzenia. Backup i jego format nie są rozszerzane o tę kolejkę. Przywrócenie kopii wymaga ponownej świadomej weryfikacji.
- Dziennik localStorage i transakcja IndexedDB nie stanowią wspólnej transakcji systemowej: dlatego niepewna faza prepared blokuje automatyzację. Nie obiecujemy niewykonalnej atomowości między magazynami.
- Brak WorkManagera: obsługa podczas używania aplikacji/powrotu, bez działania po zamknięciu procesu. Grupowanie zmian w UI ok. 1,5 s, bez aktywnego ciągłego odpytywania Google.

Testy korzystają wyłącznie z syntetycznych danych i symulowanego transportu. Nie wykonano zapisów do rzeczywistych arkuszy użytkownika.
