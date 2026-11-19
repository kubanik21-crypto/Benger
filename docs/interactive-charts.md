# Wykresy

`chart-model.js` przygotowuje bez mutacji wspólną domenę czasu, niezależne osie i ograniczony zestaw punktów. `charts.js` rysuje SVG i obsługuje wybór punktu, legendę, zakresy, dialog powiększenia, statystyki i tabelę. Historyczny eksport `chart` w progress-ui.js pozostaje kompatybilny z istniejącymi wywołaniami.

Wspólny renderer wykorzystują: Dziennik (kcal, przełączane B/T/W, średnia masy), Progres (masa i średnia 7 dni, ciśnienie/tętno, obwody) oraz historia ćwiczeń (objętość serii roboczych). Żaden wykres nie zapisuje ani nie kopiuje danych do nowej bazy. Backup i migracje nie wymagają zmian.

Każdy punkt używa zapisanej daty; pora pomiaru jest przekazywana jako lokalna godzina na neutralnej osi UTC, co zapobiega przesuwaniu dat przez strefę przeglądarki. Nie jest to konwersja chwili pomiaru na UTC, ponieważ model źródłowy przechowuje lokalne daty/godziny. Wspólna domena czasu zachowuje rzeczywiste odstępy i wyrównuje serie. Identyczne daty/godziny zachowują wszystkie wartości; odczyt pokazuje je razem. Objętość ćwiczeń korzysta z dat sesji bez wymyślania godzin.

Zakresy wewnętrzne kończą się na ostatnim punkcie wybranego okresu i obejmują pełne dni kalendarzowe. Dziennik zachowuje nadrzędny zakres do dnia dziennika, a masa dotychczasowy wybór zakresu do ostatniego pomiaru. Granica 1000 najnowszych punktów na serię jest jawnie opisana. Dane poza zakresem i ukryte serie nie uczestniczą w statystykach.

Żywienie i objętość mają bazową skalę od zera. Masa i obwody mają dopasowaną skalę z opisanymi wartościami. Tętno korzysta z prawej osi, bez mieszania ud./min z mmHg. Dane bez wpisów nie są dopisywane jako zera. Dłuższe przerwy w dzienniku przerywają linię; trend masy pozostaje linią między rzeczywistymi pomiarami. Krzywa celu jest schodkowa i zawiera daty faktycznych zmian effectiveFrom, również gdy w danym dniu nie było wpisu.

Statystyki to liczba terminów, średnia dostępnych punktów, zakres i różnica ostatniego względem pierwszego. Nie są automatyczną oceną zdrowia, kompletności diety ani dowodem przyczynowym. Istniejący silnik średniej masy z 7 dni pozostaje bez zmian.

Dostępność: SVG title/desc, tekstowy odczyt aria-live, natywne checkboxy i przyciski, dostępna tabela, dialog zamykany Escape z powrotem fokusu, kolory tokenów light/dark. Wybór dotykiem wykorzystuje odwrotną macierz SVG, więc działa również po zmianie rozmiaru i przy zachowaniu proporcji obrazu. Powiększenie zachowuje wybrany zakres i widoczne serie. Bez panowania nad globalnymi gestami przewijania lub orientacją telefonu.
