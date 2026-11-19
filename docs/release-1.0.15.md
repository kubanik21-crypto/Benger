# Benger 1.0.15 — lepszy import składników ze stron

- Odczyt szuka rzeczywistego nagłówka „Składniki” i granicy „Przygotowanie”, również bez dwukropka i przy drobnych błędach OCR.
- Gdy rozpozna układ strony, ponownie odczytuje sam obszar listy zamiast całej strony.
- Pasek przeglądarki, adresy, przyciski, przypadkowe napisy i instrukcje gotowania nie są automatycznie listą składników.
- Przed odczytem widać podgląd. Można zaznaczyć samą listę palcem albo suwakami; dla kilku obrazów zaznaczenia są niezależne.
- Liczba w „3 czubate łyżki” pozostaje 3. Opis miary jest zachowany; masa nie jest zgadywana.
- Gdy nie ma wiarygodnych składników, zapis jest zablokowany i można poprawić obszar lub tekst.

OCR nadal działa lokalnie/offline. To nie jest gwarancja bezbłędnego rozpoznania każdej strony: sprawdź nazwy, ilości i jednostki przed zatwierdzeniem. Dane, historia i backup pozostają zgodne; wersja zawiera również wykresy z 1.0.14. Bez nowych uprawnień, zależności sieciowych lub backendu.
