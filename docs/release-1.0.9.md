# Benger 1.0.9 — Widżet Dzisiaj

Android: lokalny widżet ekranu głównego z dzisiejszymi kaloriami, celem i pozostałą ilością oraz treningiem z kalendarza / aktywną sesją. Skróty otwierają dodawanie posiłku i pomiaru wagi. Nie uruchamiają mikrofonu ani nie zapisują danych automatycznie.

Po aktualizacji APK przytrzymaj puste miejsce na ekranie głównym → Widżety → Benger. Możesz też użyć przycisku w Więcej → Ustawienia. Wymagane miejsce: około 4 × 4 pola; widżet można powiększyć.

## Dane i odświeżanie

Źródłem prawdy pozostają istniejący dziennik, okresy celów i treningi w BengerDB. Widżet przechowuje wyłącznie prywatną, pochodną kopię podsumowania ośmiu dni, bez zdjęć i pomiarów zdrowia. Dane nie opuszczają urządzenia. Backup pozostaje v8; kopia widżetu nie wymaga eksportu i odtwarza się po otwarciu aplikacji.

Po zmianie danych lub powrocie do Bengera aplikacja aktualizuje widżet. Android okresowo odrysowuje zapisaną kopię (co najmniej 30 minut, system może opóźnić). Przycisk ↻ otwiera Bengera i przelicza świeże dane. Widoczna data/godzina wskazuje ostatnie przeliczenie, nie odrysowanie.

Po północy wybierany jest aktualny lokalny dzień z zapisanej kopii; nigdy wczorajsze kalorie. Po wyczerpaniu ośmiodniowego zakresu, przy braku kopii albo błędzie odczytu widżet prosi o otwarcie aplikacji. Zmiany kalendarza wykonane w aplikacji odświeżają kopię; zamknięty WebView nie czyta IndexedDB w tle.

Kolory respektują systemowy jasny/ciemny motyw Androida (nie niezależne ustawienie motywu wnętrza aplikacji). Brak nowych uprawnień, usług, kont, zależności i synchronizacji. Sam widżet nie jest formularzem edycji.
