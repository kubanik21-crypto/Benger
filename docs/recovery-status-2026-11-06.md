# Benger — stan odzyskania, 6 listopada 2026

Ten dokument rozdziela kod potwierdzony w odzyskanym Git od zmian opisanych w rozmowie, których plików obecnie nie mamy. Nie oznacza wydania ani pełnego odzyskania 1.0.6.

## Potwierdzone w odzyskanym repozytorium

- `origin/main`: `41ae0a36171b59d53a296d6b9884312c9019f06d`, aplikacja 1.0.5.
- Główne moduły Etapów 1–14, Exercise Guide, przepisy/dziennik/progres/trening/Mobility/kalendarz, PWA/offline/backup.
- Globalny resolver produktów i poprawki komercyjnego wyszukiwania OFF są przodkami main.
- Rozwijane posiłki i edycja ilości istniejących wpisów: zawarte w main.
- Bazowy Android/Capacitor: `origin/feature/android-apk`, `cc1cbfc2ed573479081e9e8c514486243110bcf0`. Nie jest to najnowszy APK używany na telefonie.
- Starszy publiczny plik APK: gałąź `android-apk-downloads`. Nie zastępować nim nowszej działającej aplikacji.
- Pozostałe historyczne gałęzie, w tym eksperyment konwersacyjnych przepisów. AI było później odłożone; nie uruchamiać usług ani wdrożeń AI podczas odzyskiwania.

## Zrobione wcześniej lokalnie, lecz obecnie nieodzyskane

Wymienione SHA pochodzą z wcześniejszych potwierdzeń w rozmowie. Sprawdzono, że nie ma ich w pobranych obiektach Git.

| Zmiana | Ostatni znany commit | Stan |
|---|---|---|
| Plan Listopad 2026 — nogi/core/Mobility, kalendarz, progresja i deload | `d5e82bb`, poprawka rund `08276b6` | Było w APK; brak w odzyskanym Git |
| Lokalne powiadomienia o treningach i ustawienia Androida | `658af65` | Było w APK; brak w odzyskanym Git |
| Bezpieczniejsze dopasowanie składników (ziemniaki nie bułki), wybór właściwego mięsa, paginacja kandydatów | `016124a` | Było w APK; brak w odzyskanym Git |
| Recipe Base → Variant/Overrides → immutable Meal Snapshot; szybka zmiana składników, backup v8 | `3f305c4` | Było w APK; brak w odzyskanym Git |
| Paczka 9 przepisów „Plan 26.10–01.11.2026”, stabilne ID i bezpieczne powiązanie produktów | `fb2651d` | Było w APK; brak w odzyskanym Git |
| Budowanie posiłku, sticky search/bar, panel ilości, miary użytkownika i ostatnia jednostka, poprawki PWA update | `2e634de`, `a8b0d79`, `42cc9af964634a670bbe0eaf887d676832a092b4` | Przygotowane 1.0.6; nigdy nie potwierdzono wydania produkcyjnego; brak plików w odzyskanym Git |

Po ostatnim potwierdzonym commicie mogły pozostać drobne niezapisane poprawki izolacji formularza. Nie ma podstaw, by twierdzić, że rozmowa jest pełnym backupem tych plików.

Zachowany na komputerze/telefonie APK `Benger-1.0.5-fb2651d.apk` może pomóc odzyskać spakowany frontend: własne JS/HTML/CSS/dane w `assets/public`. Nie zastąpi całego repozytorium, testów, historii Git ani prywatnego klucza podpisu. Danych użytkownika nie należy publikować. Nie zmieniać instalacji telefonu na starszą aplikację podczas odzyskiwania.

## Jeszcze niewykonane

1. Odzyskanie brakujących plików ze starego środowiska albo z zachowanych APK; następnie rekonstrukcja brakujących testów i porównanie zachowania.
2. Potwierdzenie i zabezpieczenie prywatnego klucza podpisu APK. Katalog `/workspace/artifacts` nie został przywrócony. Nie generować zamiennego klucza dla istniejącej instalacji.
3. Integracja i produkcyjne wydanie 1.0.6 po odtworzeniu i pełnych testach. Nie uznawać obecnego backupu main 1.0.5 za wdrożoną 1.0.6.
4. Kopia niezależna od GitHuba (GitLab lub prywatny dysk chmurowy), po skonfigurowaniu autoryzacji.
5. Pozostałe rodzaje przypomnień i widgety — nie zostały potwierdzone jako wdrożone.

## Priorytet dalszej pracy

Najpierw kopia kodu i dokumentacja odtworzenia, osobno backup danych z telefonu i klucza podpisu. Potem odzyskanie nowszego frontendu z najnowszego APK, sprawdzenie różnic i pełna regresja. Dopiero później dokończenie budowania posiłków i wydanie. Nie rozpoczynać kolejnego dużego modułu.
