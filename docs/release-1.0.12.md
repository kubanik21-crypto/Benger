# Benger 1.0.12 — Ruchomy rzut

Widżet ma nowy przycisk ▶: odtwarza krótki rzut piłki po łuku do kosza. Rzut uruchamia się także po wzroście Twojej liczby punktów w tym samym tygodniu. Pierwsze wczytanie, zwykłe odświeżenie bez nowych punktów, strata punktów i rozpoczęcie nowego tygodnia nie uruchamiają automatycznej animacji. Sam pokaz rzutu nie przyznaje punktów.

Podgląd areny po dotknięciu boiska ma przycisk „Odtwórz rzut” / „Powtórz rzut”. Piłka obraca się, leci po krzywej i opada za siatkę. Ciało zawodnika pozostaje w fotograficznej pozycji zakończenia rzutu; nie jest to animacja całej sylwetki. Odtwarzanie jest jednorazowe, trwa 1,5 sekundy i można je powtórzyć. Zamknięcie podglądu lub ukrycie aplikacji zatrzymuje jego klatki. Przy ograniczeniu ruchu wyświetlany jest spokojny kadr końcowy.

## Android

Widget korzysta z 13 skończonych aktualizacji RemoteViews (około 8 klatek/s), a podgląd w aplikacji z requestAnimationFrame. Nie polegamy na automatycznym odtwarzaniu GIF ani stale przewijanym ViewFlipperze. Po klipie widżet wraca do właściwej sceny poziomu. Szybkie kolejne odtworzenia anulują poprzednie; nowy zapis danych, obrót/zmiana rozmiaru i usunięcie widżetu przerywają animację. Usunięcie ostatniego widżetu nie zostawia animacji w tle.

Wykonanie jest ograniczone do 1,5 s + krótkiego kadru końcowego, z terminem bezpieczeństwa 3 s, maksymalnie czterema widżetami jednocześnie i kolejką 16 żądań. Wątek pomocniczy wygasa po sekundzie bezczynności. Broadcast używa goAsync/finish w finally. Brak nowego serwisu, alarmu, powiadomienia, uprawnienia ani pętli bez końca. Systemowe wyłączenie animacji jest respektowane. Launcher może ograniczać liczbę odświeżeń — płynność widgetu wymaga testu na rzeczywistym Samsungu. Przerwanie procesu przez Androida może przerwać klip; kolejne otwarcie/odświeżenie przywraca zwykłą scenę i dane.

## Dane i grafiki

Punktacja, historia, namespace i backup v8 pozostają bez zmian. Animacji nie zapisujemy w danych użytkownika. Geometryczne parametry rzutu są współdzielone w `arena-shot.json` między Androidem i podglądem JS. Nowa fotograficzna scena jest oryginalną wygenerowaną grafiką z fikcyjnym zawodnikiem, bez widocznej piłki; ruchoma piłka jest renderowana deterministycznie. WebP jest lokalny (około 145 KiB). Brak runtime AI, sieciowych obrazów, nowych zależności lub backendu. Dotychczasowe pięć scen poziomów pozostaje dostępne.

Aktualizacja APK na istniejącym Bengerze. Nie odinstalowuj aplikacji. Otwórz Bengera po aktualizacji, a następnie sprawdź ▶ na widżecie oraz przycisk odtwarzania w podglądzie areny.
