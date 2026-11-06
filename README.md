# Benger 1.0.6 — odzyskane wydanie Android

APK: Benger-1.0.6-657934e.apk
Kod: recovery/benger-1.0.6, commit 657934e7a1dd0792d5b290bdfd3cc3a84b35ace3.

1500 testów Node, 325 testów Chromium, Tests i Android APK na GitHubie zakończone sukcesem. Lokalny assembleRelease + lintRelease oraz apksigner zakończone sukcesem.

## Ważne: nowy podpis

Właściciel zaakceptował nowy podpis po utracie starego klucza. Android nie potraktuje tej paczki jako aktualizacji starej instalacji 1.0.5. Nie obchodzimy tej kontroli.

1. W starej aplikacji wykonaj świeży pełny eksport danych. Zachowaj plik poza aplikacją, np. w Pobranych i prywatnej chmurze. Upewnij się, że plik istnieje.
2. Pobierz nowy APK. Dopiero po zabezpieczeniu eksportu odinstaluj starą aplikację i zainstaluj nową. Odinstalowanie usuwa lokalne dane.
3. W nowej aplikacji: Więcej → Dane i backup → import pełnego pliku. Zatwierdź import i sprawdź dziennik, przepisy, treningi oraz progres.
4. Ponownie włącz przypomnienia i zaakceptuj uprawnienie Androida, jeśli chcesz z nich korzystać. Zezwolenia systemowe nie przechodzą przez backup.

Odtworzenie dostarczonego backupu v8 zweryfikowano w odizolowanym profilu Chromium: zgodne sekcje dziennika, przepisów, historii, wariantów, własnych produktów, porcji, celów, ustawień, treningów i kalendarza oraz trwałość po przeładowaniu. Test nie jest uruchomieniem fizycznego Samsunga.

To wydanie nie zmienia produkcyjnego main, WWW ani Workera AI. Prywatny klucz i dane użytkownika nie są częścią tego repozytorium ani APK.
