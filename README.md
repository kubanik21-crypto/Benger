# Benger — Etap 1

Prosty lokalny dziennik żywieniowy w HTML, CSS i JavaScript, udostępniany przez mały serwer Node.js. Bez logowania, zewnętrznych API, AI i dodatkowych bibliotek.

## Uruchomienie

Wymaga Node.js 22 lub nowszego. Nie trzeba uruchamiać `npm install`.

```sh
npm start
```

Uruchamiaj z katalogu projektu. Domyślny port to 3000; zmienna `PORT` pozwala go zmienić. Nie skonfigurowano publicznego hostingu. Na telefonie używaj bezpiecznego połączenia HTTPS. Manifest pozwala przeglądarce korzystać z nazwy i kolorów aplikacji przy dodawaniu do ekranu głównego; nie ma service workera ani gwarancji uruchomienia offline.

## Dziennik produktów

1. Wybierz dzień nad formularzem — dotyczy on dodawania, listy i podsumowania.
2. Wybierz posiłek i produkt z lokalnego katalogu.
3. Wpisz ilość w jednostce produktu: g albo ml. Działa kropka i polski przecinek, np. `50,5`.
4. Sprawdź kcal, białko, tłuszcz i węglowodany w podglądzie.
5. Dodaj pozycję do dziennika. Ilość zostanie wyczyszczona, a komunikat potwierdzi zapis.
6. Wpisy są podzielone na posiłki. Przycisk „Usuń” usuwa wyłącznie wskazany wpis i aktualizuje sumę dnia.

Wartości produktów w `nutrition.js` są **przykładowe, edukacyjne**. Nie opisują konkretnych marek i nie są podstawą zaleceń dietetycznych. Nie przeliczamy mililitrów na gramy. Obliczenia wykonują wyłącznie `calculatePortion()` i `sumNutrition()`. Dane są zaokrąglane dopiero na ekranie.

## Pamięć i model danych

Nowy dziennik używa klucza `benger.nutrition.v1` w localStorage. Każdy wpis zawiera:

- `id`: UUID wpisu; natywne `crypto.randomUUID()` lub UUID v4 z `crypto.getRandomValues()`;
- `date`: wybrany dzień posiłku, `YYYY-MM-DD`;
- `createdAt`: moment utworzenia w ISO 8601, UTC;
- `meal`: `breakfast`, `lunch`, `dinner` albo `snack`;
- `productId`, `productName`, `amount`, `unit`;
- `nutrition`: kopia niezaokrąglonych wartości porcji (`kcal`, `protein`, `fat`, `carbs`).

Historyczne wpisy korzystają z zapisanej kopii, więc aktualizacja katalogu nie zmienia historii. Przed dodawaniem i usuwaniem aplikacja ponownie odczytuje aktualną listę. Zdarzenie `storage` odświeża pozostałe karty. Nadal istnieje zaakceptowane ograniczenie: odczyt i zapis nie tworzą transakcji, więc dokładnie równoczesne zmiany w kartach mogą się nadpisać.

Uszkodzone dane blokują zapis i nie są zastępowane pustą listą. Nieudany zapis pozostawia formularz i dane bez pozornego sukcesu. Gdy przeglądarka blokuje pamięć, dziennik może być niedostępny. Dane pozostają tylko w tej przeglądarce i pod tym adresem strony; wyczyszczenie pamięci je usuwa. Nie ma synchronizacji między urządzeniami, importu ani eksportu wpisów żywieniowych.

## Notatnik eksperymentalny

Zwijana sekcja zachowuje stary notatnik i jego klucz `benger.meals.v1`. Nowy dziennik nie przepisuje ani nie usuwa tych danych. Kod notatnika jest w `legacy.js`; można pisać, usuwać i eksportować notatki. Eksport obejmuje **wyłącznie notatki tekstowe**, nie produkty.

Dyktowanie nie jest połączone z dziennikiem produktów. Wymaga obsługi Web Speech API, bezpiecznego połączenia i zgody na mikrofon. Może wysyłać dźwięk do dostawcy przeglądarki. Automatyczne testy symulują jego zdarzenia; rzeczywisty mikrofon telefonu wymaga osobnego sprawdzenia.

## Testy

Obliczenia, bez dodatkowych bibliotek:

```sh
node --test nutrition.test.js
```

To samo polecenie jest dostępne jako `npm test`.

Testy interfejsu wymagają zainstalowanego Chromium i także nie wymagają pakietów npm:

```sh
npm run test:browser
```

Domyślnie uruchamiany jest program `chromium`. Zmienna `CHROMIUM_PATH` może wskazać inną ścieżkę. Test korzysta z lokalnego serwera na wolnym porcie oraz tymczasowego profilu przeglądarki. Nie używa danych użytkownika; po zakończeniu zatrzymuje swoje procesy i usuwa profil. Chromium jest uruchamiane z `--no-sandbox` na potrzeby izolowanego środowiska testowego.

Opcjonalny zrzut ekranu po dodaniu czterech posiłków:

```sh
BENGER_SCREENSHOT_PATH=/tmp/benger.png npm run test:browser
```

Testy sprawdzają porcje, walidację i fokus, posiłki i dwa dni, sumowanie, usuwanie, odświeżenie, dwie karty, awarie pamięci, UUID zastępcze, historyczne wartości, kontrast, szerokości 320/390/1024 px, notatnik i konsolę.
