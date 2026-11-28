# 4D.1 — audyt wyjściowy (28.11.2026)

Baza: feature/local-sync-export, 04d9892, czyste drzewo. Analiza pięciu głównych zakładek i ustawień. Zrzuty z obecnego kodu, Chrome 390×844, ciemny motyw, pusty syntetyczny profil po pominięciu onboardingu. Brak odczytu prywatnego arkusza lub rzeczywistych danych. Narzędzie: istniejący harness CDP aplikacji. W tym czacie brak osobnego narzędzia pulpitu; użyto rzeczywiście wyrenderowanego Chrome i obejrzano zapisane obrazy. To nie jest pomiar płynności konkretnego telefonu ani pełny audyt WCAG.

| Krok | Stan i dowód | Działanie |
|---|---|---|
| 1. Dziennik | 1424 px wysokości bez wpisów. Powielone „Dzisiaj” i bilans dnia, duża strefa dodawania przed treścią. Plan 4C ma oddzielne karty i odsyła do innego miejsca po edycję. | Jeden widok kategorii; te same elementy zwykłego wpisu dla spożycia; szczegóły zwinięte. |
| 2. Trening | Pusty ekran mieści się w 844 px, działające sześć sekcji, duży przycisk startu. Kod odczytuje repozytorium także przy przejściu do innych zakładek i odświeża pełne drzewo wielokrotnie. | Zachować funkcje i strukturę; ograniczyć odczyty/odświeżenia niewidocznego modułu. Nie implementować importu planów. |
| 3. Przepisy | Pusty widok mieści się w ekranie, ale „Gotuj” konkuruje z „Nowy” i importem. Pakiet październikowy zajmuje miejsce niezależnie od używanego planu. | Zachować bazę, przenieść importy do sekcji Dieta, ograniczyć ciężar rzadkich akcji. |
| 4. Progres | 2214 px, otwarty formularz wagi i długi opis techniczny przed treścią. | Zwinięte informacje prywatności; szybkie akcje nadal dostępne, wykresy bez przebudowy. |
| 5. Więcej | Menu istnieje (873 px), lecz nie prowadzi do integracji bezpośrednio. Synchronizacja, konto, eksport JSON, laboratorium i oba importy są dołączane do Ustawień. | Wyodrębnić Synchronizację, Dietę oraz Zaawansowane; przenosić istniejące DOM/kontrolery, nie kopiować funkcji. |
| 6. Ustawienia | 2087 px już w PWA bez całego panelu natywnego. Nagłówek po karcie wyglądu. Długie instrukcje i niespójna hierarchia. | Nagłówek na początku, osobne adresowalne podstrony i kompaktowy status w hubie. |

Zrzuty: /workspace/exports/4d-before/01-dziennik.png … 06-ustawienia.png; metryki w metrics.json. Zaakceptowane obrazy pokazują bieżące, stabilne widoki. Komunikat o niekompletnym cache w zrzucie Ustawień dotyczy izolowanego serwera testowego; nie stanowi diagnozy produkcyjnego PWA. Kontur fokusu jest efektem nawigacji klawiaturowej, nie błędem.

Ryzyka dostępności: nadmiar treści przed podstawową akcją; rozproszenie kontroli edycji; brak prostego opisu blokady synchronizacji. Kontrast, obsługa czytnika i rzeczywista klawiatura Androida wymagają dodatkowej weryfikacji; nie stwierdzamy pełnej zgodności na podstawie obrazów.

BUG-01: resizeDiaryEntry kopiuje cały wpis i zachowuje createdAt. createPlannedEntry nadaje Date.now przy każdym potwierdzeniu, również po usunięciu wpisu o tym samym deterministycznym UUID. To odtwarzalna przyczyna zmiany czasu po cofnięciu i ponownym potwierdzeniu. Testy obu przypadków zostaną rozdzielone; pierwotny znacznik będzie zachowywany dla powracającego ID.

SMART SYNC: obecnie JS i Android blokują każde usunięcie automatyczne. Nie wolno usuwać tej reguły globalnie. Rozwiązanie: trwały dziennik przygotowanej/zatwierdzonej operacji przy zapisie danych, powiązany z kontem/profilem/urządzeniem i ID rekordu; dowód dokładnych usuwanych wierszy z ich poprzednim SHA-256. Przy niepewnym zapisie, przywróceniu kopii, obcej tożsamości, niezgodności źródła lub dużym usuwaniu nadal podgląd ręczny. Potwierdzenia kolejki dopiero po sprawdzeniu wyniku Google. Nie zmieniamy schematu RAW DATA, OAuth ani magazynów rzeczywistej historii.
