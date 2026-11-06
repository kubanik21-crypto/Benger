# Odzyskany frontend fb2651d

Źródło: APK 1.0.5 dostarczony przez właściciela projektu. Podpis APK v2 RSA/SHA256 i digest całej zawartości zostały sprawdzone; certyfikat zgadza się z zachowanym publicznym pinem Androida. Hash APK oraz manifest plików są w `fb2651d-assets.json`.

Odzyskano własne moduły JavaScript, dane planu listopadowego, powiadomienia, warianty przepisów, paczkę 9 przepisów i poprawki dopasowania produktów. Cofnięto wyłącznie transformacje builda (parametry SHA importów, meta native/build). Zachowano źródłowy moduł namespace dla izolacji preview i ponownie generuje się listę precache.

Brakujące fragmenty natywnego projektu (wznowienie aplikacji, otwieranie ustawień powiadomień, ikona, włączenie przypiętego pluginu 8.3.1 i jego licencji, usunięcie uprawnienia dokładnych alarmów) zostały odtworzone na zachowanej bazie Androida cc1cbfc. To rekonstrukcja, nie odzyskanie oryginalnego pliku Java z APK.

Prywatny eksport użytkownika przeszedł walidator backupu v8 odzyskanej wersji. Nie importowano go do produkcji ani nie zapisano w repozytorium. Testy w Git mają korzystać wyłącznie z syntetycznych profili. Oryginalny prywatny klucz podpisu nie jest możliwy do odzyskania z publicznego certyfikatu/APK; bez niego nie podpisujemy aktualizacji istniejącej instalacji.

Kolejne zmiany 1.0.6 są nową implementacją nakładaną na odzyskaną bazę. Nie należy twierdzić, że odzyskano stare niewypchnięte commity 1.0.6 lub oryginalne testy utraconych zmian.
