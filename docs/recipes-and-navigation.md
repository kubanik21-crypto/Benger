# Etap 8: przepisy i nawigacja

## Nawigacja i zachowanie danych formularzy

Pięć hash routes: `#/dziennik` (domyślna), `#/przepisy`, `#/produkty`, `#/historia`, `#/wiecej`. Hash routing działa na GitHub Pages również w podkatalogu, bez reguł backendu. Nieznany route wraca do Dziennika. Back/forward i reload obsługują tę samą nawigację. Sekcje DOM są ukrywane, a nie odtwarzane: data, propozycja posiłku, formularze i szkic pozostają. Zmiana sekcji kończy nagrywanie i skanowanie, nie usuwa propozycji.

Mobile ma dolną nawigację z safe-area i celami minimum 44 px; desktop od 1024 px ma sidebar. Aktywna pozycja ma aria-current, a przejście ustawia focus na nagłówku. Produkty zawierają dotychczasowy katalog, custom i aparat; Historia grupuje snapshoty dziennika według daty; Więcej zawiera ustawienia, backup, PWA i źródła danych.

## Modele i obliczenia

Recipe nie jest Product. Zawiera UUID, nazwę, createdAt/updatedAt, status, ingredients, steps, yield, nutrition, notes, version oraz zdarzenia zaakceptowane przez użytkownika. Ingredient ma własny UUID, originalText/query, resolutionStatus, excludedFromNutrition i snapshot produktu/porcji/makro. Step ma UUID, tekst, createdAt i kolejność. Yield zawiera opcjonalne servings, finalWeight w g i finalVolume w ml.

DRAFT oznacza edytowany szkic. READY wymaga rozwiązania wszystkich niewykluczonych składników. INCOMPLETE pozostaje poprawnym zapisanym przepisem, lecz nie udaje kompletnego makro. Pokazujemy sumę znanych składników osobno; pełne total i wartości pochodne są wtedy null. Wykluczenie jest zawsze jawne i widoczne. Nie zgadujemy masy cebuli ani odparowania wody.

`sumNutrition()` sumuje snapshoty. Per serving = total / servings, per100g = total / finalWeight * 100, analogicznie per100ml. Masa surowych składników nie zastępuje masy gotowej potrawy. Odrzucamy NaN, Infinity, niepoprawne yield i przepełnienia. Zmiana katalogu, custom product lub porcji nie zmienia zapisanych składników/historycznych wersji.

## Szkice, wersje i migracja

IndexedDB BengerDB (w preview osobny namespace) przechodzi z v2 na v3, dodając stores recipes, recipeDrafts, recipeHistory bez kasowania istniejących stores. Dotychczasowy localStorage dziennika nie jest migrowany ani czyszczony.

Autosave zapisuje zaakceptowane zmiany i edycje formularza w kolejce. Komunikat sukcesu pojawia się po zapisie. Numer revision blokuje nadpisanie szkicu przez starszą kartę; baseVersion blokuje finalizację edycji nieaktualnej wersji. Usunięty szkic nie jest odtwarzany przez spóźniony zapis. Awaria magazynu zachowuje bieżącą edycję w pamięci i pokazuje błąd, zamiast udawać trwały zapis. Niezatwierdzona transkrypcja jest propozycją, nie trwałym składnikiem.

Finalizacja atomowo zapisuje nowy przepis, poprzednią wersję w historii i usuwa właściwy szkic. Edycja tworzy nowy szkic; duplikacja tworzy nową tożsamość i niezależne ID składników/kroków. Usunięcie wymaga potwierdzenia. Historia wersji przechowuje pełne snapshoty, UI pokazuje ich podsumowania. Wyszukiwanie lokalne obejmuje nazwę i składniki.

Limity: 1000 przepisów, 100 szkiców, 200 składników i 300 kroków/zaakceptowanych zdarzeń na przepis; historia zachowuje ostatnie 2000 wersji globalnie. Nazwa do 200 znaków, wypowiedź do 2000, krok do 1000, notatki do 5000. Brak IndexedDB blokuje trwały zapis przepisów i jest komunikowany.

## Gotowanie, głos i wspólne resolvery

RecipeUnderstanding jest deterministyczne: NAME, INGREDIENT, STEP, INGREDIENT_AND_STEP, YIELD, NOTE, UNKNOWN. Zachowuje raw i normalized; używa TranscriptNormalizer, polskich liczb i istniejącego rozumienia jedzenia. Obsługuje kg/l, ułamki słowne, łyżki/łyżeczki oraz typowe czasowniki. Temperatura i czas pozostają instrukcją. Użytkownik może zmienić typ lub tekst przed zaakceptowaniem, bez ponownego nagrywania.

Głos używa istniejącego adaptera pl-PL, continuous=false, interimResults=true. Krótkie nagranie kończy się propozycją. Nie zmieniamy SpeechRecognition ani nie deduplikujemy wypowiedzianych słów. Brak usługi głosowej ma fallback tekstowy. Audio nie jest zapisywane, wysyłane przez Benger do własnego serwera ani objęte telemetrią; sama usługa rozpoznawania przeglądarki może wymagać sieci.

ProductResolver i PortionResolver są wspólne z Dziennikiem. Jedna wypowiedź może wykonać najwyżej jedno automatyczne wyszukanie zewnętrzne; jawny wybór lub wyszukiwanie użytkownika pozostaje możliwe. Potwierdzenie typowej porcji nie tworzy porcji USER automatycznie. Składnik bez wiarygodnego produktu/ilości pozostaje unresolved. Zdanie o podsmażaniu na oliwie dodaje ilościową oliwę i pełną instrukcję, ale nie wymyśla masy cebuli. Dodanie kurczaka już obecnego w przepisie bez nowej ilości może być krokiem, nie kolejną porcją.

Ręczne dodawanie korzysta z sekcji Produkty i tego samego kalkulatora, barcode oraz formularza wyboru porcji. Przycisk dodaje snapshot do aktywnego szkicu. Mikrofon pozostaje główną akcją sesji. Lista jest ukryta podczas edycji/szczegółów; powrót zachowuje zapisany szkic.

## Offline, backup i bezpieczeństwo

Istniejący service worker precache obejmuje nowe moduły i laboratoria. Po przygotowaniu offline działają przepisy, szkice, historia, lokalny katalog, custom, cache i tekstowe rozumienie. Nie obiecujemy offline SpeechRecognition ani nieznanych produktów OFF. Preview używa scope `/Benger/previews/etap-8/` i namespace preview-etap-8; nie przejmuje produkcji.

Backup schemaVersion 2 obejmuje recipes, recipeDrafts, recipeHistory oraz dotychczasowe dane. Import przyjmuje wersje 1 i 2, domyślnie łączy; zastąpienie wymaga potwierdzenia i wyjaśnia, że dane nieobecne w pliku zostaną usunięte. Eksport/import czeka na autosave. Walidacja przed zapisem, journal i rollback obejmują wszystkie stores oraz dziennik. Przed importem zamknij inne karty. Brak danych recipes w starym backupie nie kasuje przepisów przy merge.

Nie używamy dynamicznego innerHTML dla danych. Walidacja odrzuca prototype pollution, duplikaty ID, nieprawidłową kolejność kroków, złe wersje, niezgodne makro i niefinitywne liczby; obowiązują istniejące limity wielkości pliku backupu. Nie dodano backendu, API key, AI ani kont.

## Samsung: akceptacja na prawdziwym urządzeniu

1. Otwórz preview i sprawdź dolną nawigację oraz klikalność wszystkich pięciu sekcji.
2. Sprawdź przycisk Android Back i ponowne przejście forward.
3. W Dzienniku dodaj posiłek głosem i zatwierdź.
4. W Produktach zeskanuj kod; sprawdź wybór i zatrzymanie kamery.
5. Utwórz przepis i nazwij go.
6. Uruchom „Gotuj z Bengerem”.
7. Powiedz „Dodaję 500 g piersi z kurczaka”; wybierz produkt, zatwierdź.
8. Powiedz „Dodaję 2 łyżki oliwy”; sprawdź dokładną lub typową porcję i zatwierdź.
9. Dodaj głosem krok „Gotuję 20 minut”; sprawdź, że nie jest składnikiem.
10. Poczekaj na zapis szkicu, odśwież i wznów tę samą sesję.
11. Ustaw 4 porcje i finalizuj po rozwiązaniu lub jawnym wykluczeniu braków.
12. Sprawdź szczegóły, makro, edycję i niezależny duplikat.
13. Po gotowości offline wyłącz sieć i otwórz zapisany przepis/szkic.
14. Przy aktualizacji PWA sprawdź, że dane pozostały; wykonaj eksport zapasowy.

Headless Chromium nie zastępuje tych testów. Wake Lock, timery, konta, synchronizacja i dodawanie porcji przepisu do dziennika nie są częścią tej implementacji. Składniki niejednoznaczne wymagają użytkownika; rozumienie języka jest regułowe.
