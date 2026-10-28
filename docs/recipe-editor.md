# Przepisy — dopracowany edytor bez AI

Bieżący zakres nie zawiera modelu językowego, czatu, backendu inferencji ani Cloudflare. Nie wymaga kluczy, konta czy konfiguracji środowiska. Dotychczasowe dane i wersjonowanie przepisów pozostają w lokalnej bazie.

## Dodawanie składnika

Przepisy → Nowy przepis / Gotuj z Bengerem → **+ Dodaj składnik z katalogu**. Wyszukaj i jawnie wybierz produkt, podaj ilość oraz jednostkę, sprawdź obliczone makro, kliknij **Użyj składnika**. Można używać produktów własnych, USDA i istniejącej integracji OFF; wyszukiwanie internetowe następuje na żądanie i korzysta z dotychczasowych limitów/cache.

Przycisk **Wybierz produkt i ilość** przy istniejącym składniku pozwala go poprawić bez interpretowania zdania. Dla znanego produktu formularz otwiera jego aktualną porcję. Akceptacja zmienia tylko edytowany szkic; zapisane wpisy dziennika są niezależnymi snapshotami. Anulowanie nie zapisuje pustego składnika. Zero, liczby ujemne i niepoprawny format nie pozwalają zatwierdzić porcji. Polski przecinek jest obsługiwany przez istniejące kontrolki porcji.

Brak gramów nie jest zastępowany zgadywaniem gęstości lub masy sztuki. Porcje domowe korzystają z dotychczasowego PortionResolver i wymagają właściwej definicji. Oryginalny parser i dyktowanie nadal istnieją jako dodatkowa metoda, ale ręczne dodawanie z katalogu w ogóle ich nie wywołuje. Nie obiecujemy nowego rozumienia swobodnego polskiego bez AI.

## Kroki

Każdy krok ma numer, treść, przyciski przesuwania w górę/dół i usuwania. Opcjonalne pola to czas w minutach i temperatura w °C. Nie trzeba ich wpisywać. Przesuwanie zachowuje ID, treść i metadane, a kolejność jest ponumerowana od nowa. Czas musi być dodatni (do 10 080 min), temperatura 0–350°C. Niepoprawna zmiana pokazuje błąd i nie jest zapisywana.

## Dane i bezpieczeństwo

Zachowane są obecne UUID, autosave z kontrolą rewizji IndexedDB, wersje i historia. Picker zapisuje dopiero po zatwierdzeniu; jeśli szkic zmienił się w trakcie otwartego formularza, nie nadpisuje nowszych zmian. Kroki mają tylko opcjonalne metadane — stare przepisy bez nich nadal są prawidłowe, nie zmieniamy namespace ani wersji backupu (v7). Duplikowanie remapuje opcjonalne powiązania krok–składnik na nowe ID. Historyczny dziennik nie jest przeliczany po edycji.

Nowe moduły: `recipe-editor.js` (czyste operacje kroków), `recipe-ingredient-picker.js` (istniejące karty produktów i PortionResolver), testy `recipe-editor.test.js` i `recipe-editor.browser.test.js`. Integracja w `recipe-ui.js`, publiczna lista modułów i cache SW. Brak nowych bibliotek i zewnętrznych usług AI.

## Testy

`npm test`, `npm run test:browser`, `git diff --check`.

Szybki zestaw: `npm run build:pwa` oraz `node --test recipe-editor.test.js recipe-editor.browser.test.js`.

Nowe przypadki: ręczny wybór z katalogu bez parsera, edycja ilości, zero, anulowanie, kolejność i tożsamość kroków, czas/temperatura, niepoprawne liczby, brak nieaktualnych handlerów po zmianie kolejności, duplikat i relacje, mobile 320/390, reload offline, backup v7 i brak endpointów/UI AI.
