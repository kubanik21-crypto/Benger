# Etap 5B — raport implementacji i walidacji 1.0.25

Gałąź: `feature/local-sync-export`, baza `540344f`. Zmiany logiczne:

- `b2ffd43`: ścisła walidacja, transakcyjny import, mapowania i metadane backupu v10.
- `aa27b0f`: interfejs podglądu, karta bloku, cele przypięte do realizacji, integracyjne testy IndexedDB i offline.
- `143ec97`: dodatkowe zabezpieczenia uzgadniania, merge archiwów i dokumentacja 5B.
- Commit wydania z komunikatem `[picker-test-apk]`: wersja 1.0.25, kontrola wyższego versionCode oraz dotychczasowa ścieżka artefaktu CI do lokalnego podpisania.

Architektura, instrukcja dla czatu Treningi, ograniczenia, bezpieczny odbiór i szczegóły backupu: [training-plan-import-5b.md](training-plan-import-5b.md). Kontrakt: [training-plan-import-spec.md](training-plan-import-spec.md). Przykłady: [examples/training-plans](examples/training-plans/README.md).

## Wyniki lokalne

| Kontrola | Wynik | Charakter testu |
|---|---|---|
| Pełne `npm test` | 1925/1925 | Node, dane syntetyczne; 57 testów nowego rdzenia/katalogu |
| Pełne `npm run test:browser` | 402/402 | Prawdziwy Chromium, izolowane profile i IndexedDB, ok. 9 min 39 s |
| Końcowa regresja importu i smoke wydania | 5/5 | Chromium po zmianie wersji, offline boot pod `/` i `/Benger/` |
| Android `testDebugUnitTest` | 64/64, 7 klas | Lokalne JVM/JUnit, bez fizycznego urządzenia |
| Android `lintRelease`, `lintDebug` | Sukces | Release: 0 Error/Fatal, 35 Warning; brak zmiany natywnego kodu funkcjonalnego |
| `assembleRelease` | Sukces | Niepodpisany lokalny build kontrolny 1.0.25, versionCode 28641518 |
| `assembleDebugAndroidTest` | Sukces | Kompilacja testowego APK; testy instrumentacyjne nie zostały uruchomione na urządzeniu |
| Formalne przykłady 5A | Sukces | 16 jednostek, cztery aktualizacje, zgodny SHA-256, ucięcie/tamper odrzucone |
| `node --check` zmienionych modułów; `git diff --check` | Sukces | Kontrola składni i patcha |

Pełna regresja Chromium rozpoczęła się przed ostatnimi doprecyzowaniami rdzenia i wersji. Zmienione ścieżki są dodatkowo sprawdzane testami Node i końcową regresją importu/backupów/UI. CI powtarza pełne Node i Chromium na dokładnym commicie artefaktu, przed zbudowaniem pakietu do dystrybucji.

Testy obejmują: miesięczny blok, kolejny miesiąc, cztery aktualizowane jednostki, no-op, stabilne ID, przesunięcie daty, konflikt wersji, downgrade, brak ćwiczenia/capability, limit bazy, nową definicję Mobility, lokalne edycje/usunięcia/pominięcia, ochronę active/completed/timera, stare cele i definicje przy nowszym katalogu, null i zero, cele cardio, zgodność publicznego katalogu, v10 replace/merge, pending przy scaleniu nowszego archiwum, kwarantannę po starym backupie i rollback.

Dwa nowe testy Chromium obejmują rzeczywisty abort transakcji po części wystawionych zapisów i bezpieczne ponowienie, nieaktualny podgląd, UI importu pliku, offline, cele obok pustych rzeczywistych serii, zapis rzeczywistej serii, zakończenie, historię, odtworzenie v10 i brak planned records w eksporcie RAW DATA. Pozostała pełna regresja obejmuje importy żywieniowe, Smart Sync/bezczynność, kalendarz, przypomnienia, backupy wcześniejszych formatów i istniejące realizacje treningów.

## Zgodność aktualizacji i artefakt

Zweryfikowany punkt odniesienia: podpisany Benger **1.0.24 / 28635755** z `483d7da`. ApplicationId: `io.github.kubanik21crypto.benger`. Certyfikat poprzedniego APK, istniejącego klucza i przypiętego odcisku repozytorium jest zgodny:

`56ab7cec22d03e1a368ec28aa4d01c67e15973675f0fdf28bb8f4d4ba1f3ecf2`.

Nie wygenerowano nowego klucza. Wydanie testowe pozostaje 1.0.25, a pipeline wymaga versionCode **większego niż 28635755**. Dokładny code, commit i SHA-256 właściwego APK zawiera `metadata.json` artefaktu CI; code jest wyznaczany przy kompilacji i może różnić się od lokalnego buildu kontrolnego.

Lokalny build kontrolny nie korzysta z sekretu Pickera i **nie jest udostępniany do instalacji**. Właściwy artefakt musi powstać w istniejącym zadaniu `recipe-picker-test`, z włączonym OAuth i Pickerem projektu `481332161595`. Klucz jest dostępny wyłącznie w kroku kompilacji CI, bez wypisywania jego wartości i bez przenoszenia prywatnego certyfikatu podpisującego do GitHub.

Po powodzeniu CI pobierz ZIP **Benger-UNSIGNED-1.0.25-…** z sekcji Artifacts i przekaż go w tym czacie. **Nie instaluj pliku UNSIGNED.** Po transferze można lokalnie podpisać oryginalny APK istniejącym kluczem, zweryfikować podpis, aplikację, code i sumy oraz udostępnić instalowalną aktualizację. Nie jest to nowe uprawnienie ani ponowna konfiguracja Google. Instalacja na fizycznym telefonie pozostaje częścią odbioru użytkownika.

Nie scalono z main, nie wdrożono produkcji, nie zapisano danych do arkuszy i nie zmieniono Google Cloud. BUG-02 Phone Link pozostaje osobnym otwartym zagadnieniem.
