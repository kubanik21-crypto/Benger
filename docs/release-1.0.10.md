# Benger 1.0.10 — Koszykarski tydzień

Nagłówek pokazuje lokalną datę i polski dzień tygodnia, np. `10.11.2026 Wtorek`, zamiast „Dzisiaj”.

Widżet Androida pokazuje tablicę „Ty : Rywale”, siedem dni oraz autorską scenę boiska. Pięć poziomów oprawy obejmuje boisko, trybuny, światła i rzut do kosza. Poziom rośnie lub spada razem z przewagą w bieżącym tygodniu. Każdy poniedziałek zaczyna nowy mecz 0:0. To zmieniająca się ilustracja, bez ciągłej animacji i pracy renderera w tle.

## Punktacja v1

- Kalorie od 90% do 110% celu obowiązującego danego dnia: +2. Granice włącznie. Powyżej: 2 dla rywali już dzisiaj. Poniżej: 2 dla rywali dopiero po końcu dnia. Puste wpisy nie oznaczają spożycia 0 kcal: dzień ma „jedzenie nieuzupełnione” i nie dostaje automatycznej wygranej.
- Wszystkie zaplanowane treningi/Mobility danego dnia ukończone i zapisane z powiązaniem kalendarza: +2 łącznie. Niezapisane wykonanie po końcu dnia: 2 dla rywali. Dzień bez planu nie traci punktów.
- Każdy pomiar przypadający wg włączonych przypomnień (waga/ciśnienie/obwody): +1 za zapis na tę datę, po zakończeniu dnia 1 dla rywali za brak. Kilka pomiarów tego samego typu nie mnoży punktów. Wyłączone przypomnienia nie tworzą obowiązków.
- Masa w kg i jej spadek/wzrost nie wpływają na punkty; nie premiujemy samego chudnięcia. B/T/W nie punktujemy w tej pierwszej wersji.
- Dzień: wygrana / przegrana / remis wg punktów, z osobnym oznaczeniem nieuzupełnionego jedzenia. Dzisiejszy wynik zawsze tymczasowy. Tydzień to suma rzeczywistych punktów, nie liczby wygranych dni. Niedopisane jedzenie nie anuluje punktów za wykonany trening/pomiar.
- Poziomy według Twojej przewagi punktów: brak przewagi = rozgrzewka (1); 1–2 = boisko (2); 3–5 = trybuny (3); 6–9 = światła (4); ≥10 = pełna hala (5). Utrata przewagi obniża poziom. Poziom nie przechodzi na kolejny tydzień.

## Historia i dane

Zasady przechowuje `basketball-match-v1` w istniejącym `meta` BengerDB: dzień, ówczesny cel kcal, identyfikatory zaplanowanych sesji i typy należnych pomiarów. Tolerancja/punktacja są przypięte do wersji 1. Dziś i następne siedem dni aktualizują się z aktualnych ustawień; minione dni zachowują założenia. Korekty dziennika, pomiarów i wykonania treningu przeliczają wynik z rzeczywistych źródeł. Nie kopiujemy makro, historii ćwiczeń ani zdjęć.

Historia zaczyna się przy pierwszym otwarciu tej wersji; nie wymyślamy dawnych zasad. Przewidywane zasady pozwalają domknąć dzień przy otwarciu po kilku dniach. Jeśli aplikacja nie była otwierana dłużej niż prognoza, nieznane dni są neutralne „brak zapisanych założeń”. Limit historii zasad: 3650 dni (około 10 lat), bez automatycznego kasowania. UI pokazuje do 8 ostatnich tygodni; dane pozostają w backupie.

Backup v8 otrzymuje opcjonalne `basketballMatch`; starsze kopie zachowują lokalną historię gry. Merge: lokalne zasady konfliktujących dat wygrywają. Replace: historia z kopii zastępuje lokalną. Walidacja i rollback korzystają z dotychczasowej transakcji importu. Przy braku trwałej pamięci nie potwierdzamy zapisu.

## Telefon

Zainstaluj APK na dotychczasowej aplikacji, nie odinstalowuj jej. Otwórz Bengera. Istniejący widżet odświeży się. Mniejsze rozmiary pokazują skróconą wersję: data, wynik, boisko, dni, kcal i skróty posiłku/wagi. Powiększenie pokazuje także pełny opis treningu i celu. Dotknij wyniku/boiska, aby otworzyć zasady i historię w Więcej → Ustawienia. Skróty posiłku, wagi i treningu działają jak wcześniej.

Odświeżanie pozostaje lokalne: po zmianach danych i otwarciu aplikacji, natomiast Android okresowo odrysowuje zapisaną kopię. Widoczna godzina to ostatnie przeliczenie. Po północy i w poniedziałek wybierana jest właściwa dzienna kopia meczu; po wyczerpaniu prognozy widżet prosi o otwarcie Bengera. ↻ otwiera aplikację i pobiera świeże dane. Brak nowych uprawnień, sieci, kont, usług i zależności. Grafika respektuje systemowy motyw Androida.
