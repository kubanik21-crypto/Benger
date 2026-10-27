# Cele i Dashboard — Etap 11

Dashboard `#/dziennik` odczytuje istniejący dziennik (snapshoty produktów i przepisów) oraz `measurements` z bazy Progres. Nie kopiuje dziennika, przepisów ani zdjęć do nowej bazy. Nie ładuje Blobów zdjęć do agregacji. Skróty otwierają istniejące formularze Progres, a mikrofon jest tym samym przyciskiem i tym samym flow rozpoznawania.

## Historia celów

W istniejącym IndexedDB, store `meta`, rekord `goal-periods-v1` zawiera maks. 1000 okresów:

```json
{"id":"uuid","effectiveFrom":"2026-10-26","nutrition":{"kcal":2000,"protein":120},"weight":{"kg":75,"targetDate":"2027-01-01"},"body":{"waist":80}}
```

Każde pole celu jest opcjonalne. Pusty nowy okres wyłącza cele od tej daty. Okres jest pełną definicją (nie patchem poprzedniego). Opcja „Wczytaj poprzednie cele” pozwala jawnie przenieść pozostałe wartości. Wyszukiwanie celu dnia wybiera ostatni okres `effectiveFrom <= day`; przyszły cel nie wpływa na starszy raport. Okres kończy się przed początkiem następnego. Nie usuwamy starych okresów. Dzisiejszy okres można skorygować po potwierdzeniu; starszych nie zastępujemy. Jawne utworzenie okresu ze wsteczną datą wpływa na raporty od wskazanej daty — formularz uprzedza o tym.

Odczyt/modyfikacja rekordu odbywa się w transakcji IndexedDB; dwie karty dodające różne okresy nie nadpisują się. Błąd walidacji lub quota przerywa transakcję, nie degradując celów do ulotnej pamięci. Powrót do karty/nawigacja odświeża podsumowania.

## Agregacja

Dzień odniesienia to data wybrana w Dzienniku, domyślnie lokalne dzisiaj. Dane późniejsze niż ta data nie są używane. Dzień bez wpisów pokazuje 0 zapisanych kcal i pozycji; średnia tygodnia pozostaje „brak danych”, jeśli cały tydzień jest pusty.

- Dzień: `sumNutrition` z historycznych `nutrition` snapshotów, niezależnie od źródła; posiłki = liczba różnych kodów posiłków, pozycje = liczba wpisów.
- Tydzień: 7 dni kalendarzowych z końcem w dacie Dziennika. Średnie kcal/B/T/W wyłącznie z dni mających wpisy; pokazujemy ich liczbę. Nie wnioskujemy, że zapis obejmuje całą dietę.
- Realizacja celu: średnia dziennych procentów `zapisane / cel obowiązujący tego dnia`, tylko z dni z wpisami i właściwym celem. Każde makro ma własny mianownik i liczbę dni. Nie dzielimy przez zero. Wynik może przekroczyć 100%; bez wartościowania.
- Masa: najpierw średnia wszystkich pomiarów danego dnia, następnie średnia tych dziennych średnich w oknie 7 dni. Powtórne ważenie jednego dnia nie zwiększa jego znaczenia. Zmiana = średnia bieżących 7 dni minus średnia poprzednich 7 dni; potrzebne są dane w obu oknach. Dni bez pomiarów pomijamy. Różnica do celu pochodzi z ostatniego pomiaru.
- Ciśnienie: ostatni pomiar wg daty/godziny, bez diagnozy lub klasyfikacji.
- Wykresy 7/30/90 dni korzystają z SVG Progres. Oś X odpowiada faktycznym datom; dni bez wpisów nie stają się zerami. Daty i wartości są także dostępne tekstowo. Trend masy to krocząca średnia dziennych mas z poprzednich 7 dni kalendarzowych.

Jedzenie i masa są prezentowane obok siebie, bez automatycznych wniosków przyczynowych.

## Backup / offline / aktualizacja

Backup v4 zawiera `data.goals`; starsza aplikacja powinna odrzucić nieznaną wersję, zamiast po cichu zgubić cele. Import wersji 1–3 pozostaje obsługiwany. Brak pola celów w starym backupie zachowuje istniejącą historię. Merge zachowuje obecny okres przy konflikcie ID lub daty; replace zastępuje historię, jeśli pole jest obecne. Walidacja poprzedza zapis, a istniejący journal/rollback obejmuje cele razem z innymi metadanymi i danymi Progres.

Moduły są częścią precache app shell. Po przygotowaniu offline działają cele, dashboard i raporty; nie obiecujemy offline SpeechRecognition. Preview `preview-etap-11` ma osobną przestrzeń localStorage/IndexedDB i scope SW `/Benger/previews/etap-11/`. Nie zmienia produkcji.

Test aktualizacji uruchamia kod Etapu 10 przypięty do `019190a3399fe4c07b2d0355088c41bf79fde465`, zapisuje dane/przepisy/pomiary/zdjęcie, a następnie aktualizuje SW do obecnego shellu po kliknięciu użytkownika. Porównuje pełny eksport semantycznie. Fixture jest tylko testowa, niepublikowana.

## Ograniczenia i Samsung

Dane są lokalne i wymagają backupu. Cele są deklaracją użytkownika, bez kalkulatora zapotrzebowania i porad medycznych. Wpisy nie muszą reprezentować pełnej diety. Starszy okres nie ma edycji/usuwania; można dodać nowy okres. Brak synchronizacji urządzeń i telemetryki, brak nowych kosztów/dependencies.

1. Otwórz preview, sprawdź SHA i pięć pozycji menu.
2. Sprawdź pusty Dashboard i mikrofon na pierwszym ekranie.
3. W Więcej ustaw częściowe cele, następnie wczytaj je do nowego okresu.
4. Dodaj produkt i porcję przepisu; sprawdź kcal/B/T/W i liczbę pozycji.
5. Przełącz datę przez granicę okresów celów, sprawdź historyczny cel.
6. Dodaj masę, ciśnienie i obwód przez skróty; wróć przyciskiem Wstecz.
7. Rozwiń tydzień, przełącz 7/30/90 dni, sprawdź daty wykresów.
8. Odśwież, uruchom offline po gotowości PWA i sprawdź Dashboard.
9. Eksportuj backup, sprawdź przywrócenie celów i pomiarów na preview.
10. Sprawdź, że zdjęcia, przepisy, produkty i voice nadal działają.
