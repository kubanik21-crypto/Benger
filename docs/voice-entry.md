# Etap 4 — dodawanie posiłku głosem

> Benger is a voice-first nutrition diary. Manual entry is a fallback, not the primary product experience.

To założenie kieruje architekturą: użytkownik mówi cały posiłek, aplikacja przygotowuje propozycję, a ręczna wyszukiwarka rozstrzyga tylko brakujące produkty. Bez AI, płatnych API, kont i nowego backendu.

## Moduły i przepływ

```text
speech-recognition.js → final transcript
                       ↓
tekst wpisany ręcznie → meal-understanding.js + polish-numbers.js
                       ↓
{meal, intents: [{id, query, amount, unit, amountApproximate, issues}]}
                       ↓
product-resolver.js → product-repository.js → local / cache / OFF
                       ↓
meal-resolution.js → osobne pozycje + rzeczywiste porcje
                       ↓
voice-entry.js + meal-proposal-ui.js → weryfikacja i edycja
                       ↓
„Dodaj cały posiłek” → app.js → jeden zapis snapshotów dziennika
```

Speech adapter nie zna parsera ani źródła produktów. Rozumienie posiłku nie korzysta z DOM, fetch ani nutrition. Resolver pozostaje jedynym automatycznym mechanizmem dopasowania. Ręczna lista wyników w wierszu jest jawnym wyborem użytkownika, nie drugim resolverem. Makro jest zawsze pobierane z walidowanego Product i przeliczane wyłącznie w `nutrition.js`.

## Mikrofon

Domyślny język: `pl-PL`, opcja fabryki pozwala go zmienić bez nowego UI. Wykrywamy standardowy `SpeechRecognition` i starszy `webkitSpeechRecognition`, tylko w bezpiecznym kontekście. Recognition jest tworzone dla każdej sesji, z `continuous=false`, `interimResults=true` i jedną alternatywą.

- Naciśnij „Powiedz posiłek”; system przeglądarki może zapytać o dostęp do mikrofonu.
- Mów cały posiłek. Interim i final są wyświetlane w ograniczonej do 2000 znaków transkrypcji, bez analizy każdego fragmentu.
- Naciśnij „Zakończ”. `stop()` próbuje uzyskać końcowy wynik; analiza następuje po `end`, tylko dla finalnego tekstu. Sam final w trwającej sesji nie uruchamia OFF.
- „Anuluj” wywołuje abort bez analizy i zapisu. Przed abort usuwamy handlery, aby późny result/end nie wskrzesił sesji.
- Limit sesji to 45 s, oczekiwania po stop 10 s. Timeout przerywa usługę i zostawia fallback tekstowy; niczego nie zapisuje automatycznie.

Stany: gotowy, słucham, przetwarzam, zakończono, anulowano, brak uprawnień, brak mowy, timeout, błąd usługi, brak obsługi. Status ma `aria-live`, przyciski są klawiaturowe, mikrofon ma co najmniej 88 px wysokości i widoczny focus. Animacja respektuje prefers-reduced-motion. Druga sesja nie może wystartować podczas pierwszej. Handlery i timery są usuwane przy każdym zakończeniu, błędzie i anulowaniu; pagehide również przerywa pracę.

## Kumulacyjne wyniki i jedno źródło transkrypcji

Kontrakt zweryfikowany 26.10.2026 w [MDN results](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognitionEvent/results) i [MDN resultIndex](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognitionEvent/resultIndex): results zawiera wszystkie finalne wyniki sesji oraz aktualne interim. resultIndex wskazuje pierwszy zmieniony indeks. Interim może zostać zastąpiony, sfinalizowany albo usunięty z końca listy; final według specyfikacji pozostaje stabilny.

Adapter przechowuje osobne kopie `{text, isFinal}` pod indeksami wyników, bez referencji do mutowalnych obiektów browsera. Aktualizuje ogon od resultIndex, zachowuje niezmieniony prefiks i skraca listę, gdy browser wycofuje interim. Pierwszy event z indeksem większym od zera uzupełnia brakujący prefiks; brak lub niepoprawny resultIndex jest traktowany jako pełna migawka od zera. Jeżeli dostawca nietypowo deklaruje zmianę starego segmentu od jego indeksu, zastępujemy ten wpis zamiast dopisywać tekst. Niezadeklarowana mutacja wcześniejszych obiektów nie zmienia już zapisanej kopii prefiksu.

`onTranscript({text, final, interim})` przekazuje gotowy tekst w kolejności segmentów. UI wyłącznie zastępuje nim wartość pola oraz podgląd na żywo. Po end oba widoki otrzymują wyłącznie final. Nie ma append między eventami, deduplikacji słów/liczb ani zmian parsera. Prawdziwe powtórzenie „250 ml mleka i 250 ml kefiru” musi pozostać bez zmian.

Sama standardowa sekwencja kumulacyjnych eventów z raportu działała także przed poprawką; stary kod zerował bufor w każdym evencie, ale ponownie czytał całą listę bez resultIndex. Dodane testy obejmują również nieoczekiwaną mutację wcześniejszego obiektu, korektę zadeklarowaną od indeksu 0, kilka final, dłuższe wypowiedzi, puste segmenty i reset sesji. Bez surowych eventów z fizycznego Samsunga nie przypisujemy jego konkretnego błędnego ciągu jednej niepotwierdzonej postaci payloadu. Ponowny test urządzenia pozostaje weryfikacją zachowania rzeczywistej usługi mowy.

## Kompatybilność i prywatność

Źródła odczytane 25.10.2026: [MDN SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition), [MDN Browser Compatibility Data](https://github.com/mdn/browser-compat-data/blob/main/api/SpeechRecognition.json), [specyfikacja](https://webaudio.github.io/web-speech-api/#speechreco-section).

BCD wskazuje Chrome 139+ dla standardowego interfejsu i webkit od Chrome 33; Safari ma webkit od 14.1. Firefox jest oznaczony jako preview. Nie oznacza to, że każda przeglądarka oparta na Chromium ma działający serwer rozpoznawania. Szczególnie kompilacje Chromium bez usługi Google mogą zwrócić service/network error mimo obecności API. Na Androidzie rekomendowany pierwszy test to aktualny Chrome na HTTPS. Wsparcie języka, sieć, uprawnienia systemu i polityki urządzenia mogą ograniczyć działanie.

Benger nie używa MediaRecorder, nie tworzy pliku audio i nie zapisuje nagrań. Usługa browserowa może przesyłać audio do dostawcy rozpoznawania; MDN wskazuje takie zachowanie np. w Chrome. Informacja jest stale widoczna przed pierwszym kliknięciem. Nie wymuszamy ani nie obiecujemy lokalnego rozpoznawania offline. Benger nie utrwala również historii transkrypcji — dziennik przechowuje wyłącznie zatwierdzone pozycje. Wyszukiwanie nierozpoznanego produktu wysyła tylko jego query do OFF, nie całą wypowiedź, dziennik lub pamięć wyborów.

Brak API, odmowa zgody i błąd usługi pozostawiają aktywny formularz tekstowy. Nie są błędem całej aplikacji. Tekst używa dokładnie tego samego understandMeal → ProductResolver → propozycja. Eksperymentalny notatnik i jego mikrofon usunięto z aplikacji; dawne dane pozostają nietknięte w localStorage.

## Rozumienie posiłku

Normalizacja: wielkość liter, diakrytyka do dopasowania, dziwne spacje, nowe linie jako separatory, znaki minus oraz procenty. Wykrywanie posiłku jest niezależne od ilości i produktów. Obsługiwane kody: breakfast/lunch/dinner/snack. Gdy nazwy nie ma, używamy wybranego posiłku w UI, bez sprawdzania godziny. Sprzeczne nazwy posiłków wymagają poprawienia opisu; pojedyncze wiersze można przypisać do różnych posiłków po analizie jednoznacznego tekstu.

Segmenty rozdzielają przecinki poza liczbami dziesiętnymi, średniki, nowe linie, „i” i „oraz”. Ilość może stać przed nazwą lub za nią, także `80g` / `250ml`. Wspieramy g/gram/gramy/gramów i ml/mililitr/mililitry/mililitrów oraz cyfrowe wartości dziesiętne `50,5` i `50.5`.

Mały słownik odmian kanonizuje typowe nazwy, np. płatków owsianych, banana, mleka, jogurtu naturalnego, kurczaka, ryżu, oliwy i skyra. To słownik języka, nie katalog makro. Słowne liczby całkowite 0–999 są odczytywane tylko przed jednostką lub procentami; nazwa „cola zero” pozostaje nazwą. „Około”, „jakieś” i „mniej więcej” ustawiają amountApproximate, bez zmiany wartości liczbowej.

Przykłady intencji:

| Opis | Query / ilość / jednostka |
| --- | --- |
| 80 gram płatków owsianych | platki owsiane / 80 / g |
| mleko 2% 250 ml | mleko 2% / 250 / ml |
| banana około 120 gram | banan / 120 / g, przybliżone |
| skyr waniliowy Pilos 150 g | skyr waniliowy pilos / 150 / g |
| zjadłem banana | banan / null / null — podaj ilość |

Nie zgadujemy sztuk, szklanek, łyżek, gramatury ani gęstości. Brak jednostki w `banan 120` nie staje się automatycznie porcją. Nie ma dowolnej fleksji, korekty literówek, ułamków słownych ani pełnego NLP. Nieobsługiwane nazwy pozostają w propozycji, do doprecyzowania. Jeden opis ma najwyżej 2000 znaków i 20 pozycji.

## Dopasowanie i limity

ProductResolver zachowuje kolejność: dokładny kod, zapamiętany wybór frazy, ostatnie, ulubione, lokalne/cache, opcjonalnie search. HIGH/MEDIUM/LOW pozostają wewnętrznymi regułami. UI pokazuje „Rozpoznano”, „Sprawdź”, „Nie znaleziono” lub „Podaj ilość”, bez technicznych procentów pewności.

Początkowa analiza wykonuje lokalne dopasowanie dla wszystkich intencji i najwyżej jeden zewnętrzny search dla poprawnej, ale nierozpoznanej pozycji. Brak gramatury lub błąd parsowania nie wywołuje automatycznego wyszukiwania dla tej pozycji. Pozostałe produkty można wyszukać indywidualnie przyciskiem lub Enter w wierszu. Brak requestów przy wpisywaniu i interim, wspólne limity 6,5 s search / 4,5 s barcode i cache pozostają aktywne. Równoległa wyszukiwarka ręczna korzysta z tej samej instancji repozytorium.

Zmiana tekstu/daty/domyslnego posiłku unieważnia propozycję i anuluje analizę. Wyszukiwania wierszy mają własne abort/revision; stara odpowiedź nie może nadpisać poprawionego wiersza ani innych pozycji. Edycja ilości nie wykonuje fetch ani zapisu IndexedDB.

## Częściowa weryfikacja

Każdy wiersz zachowuje stałe ID. Niepewny produkt ma do pięciu propozycji lub wyszukiwarkę. Ilość i jednostka są edytowalne bez przebudowy pozostałych kart. Wybór innego produktu pobiera rzeczywisty model z repozytorium. Jeżeli ma inną jednostkę, ilość jest czyszczona i trzeba ją podać ponownie; g nie staje się ml.

Suma obejmuje wyłącznie gotowe porcje i pokazuje „3 z 4 produktów rozpoznane”. Niepełna lub błędna pozycja blokuje zapis całego zestawu. Zmiana jednej pozycji nie usuwa pozostałych. Transkrypcję można ręcznie poprawić i przeanalizować ponownie; wtedy świadomie powstaje nowa propozycja całego tekstu.

Pamięć ProductResolver uczy po jawnym wyborze produktu, albo po udanym zatwierdzeniu całej widocznej propozycji. Wybór w wierszu nie jest drugi raz liczony przy zapisie tego samego zestawu. Samo rozpoznanie nie uczy. Przechowujemy wyłącznie lokalne fraza → productId → count/lastUsedAt; pamięć nie trafia na serwer.

## Atomowy zapis

Przed zapisem kontrolujemy aktualność źródłowego tekstu, daty i domyślnego posiłku, również gdy programowa zmiana nie wysłała zdarzenia DOM. Zestaw musi być kompletny, mieć poprawną sumę i dostępny dziennik.

`app.js` przygotowuje wszystkie snapshoty i wszystkie ID, sprawdza ich poprawność i unikalność. Następnie odczytuje aktualny dziennik i wykonuje jeden localStorage.setItem. Błąd drugiego ID lub setItem oznacza brak częściowego zapisu i zachowanie propozycji do ponowienia. Po sukcesie podwójne kliknięcie nie może dodać zestawu ponownie. Każdy wpis ma własny posiłek i kopię niezaokrąglonych makro. Cache i pamięć wyborów aktualizują się niezależnie po zapisie; ich awaria nie udaje awarii już zapisanego posiłku.

Atomowość oznacza jeden zapis zestawu w tej karcie. Nadal pozostaje wcześniej zaakceptowany race condition przy dokładnie jednoczesnej operacji całego localStorage w dwóch kartach. Nie wprowadzono blokad ani migracji dziennika do IndexedDB.

## UI i preview

Na desktopie panel głosu i propozycja tworzą dwie kolumny w ograniczonej szerokości; na mobile jedną. Mikrofon jest głównym działaniem, tekst i ręczne wyszukiwanie są drugorzędne. Widoki sprawdzamy na 320, 390, 430, 1024 i 1440 px, z etykietami, touch targetami i bez przewijania poziomego.

Preview: https://kubanik21-crypto.github.io/Benger/previews/etap-4/ . Namespace `preview-etap-4`: klucze `benger.preview-etap-4.*`, baza `BengerDB-preview-etap-4`. Dane produkcji i preview Etapu 3 pozostają odrębne. Publikacja zmienia wyłącznie podkatalog previews/etap-4, bez root i bez PR. Względne importy i SHA zasobów działają pod project site. Nie dodano service workera.

## Testy i ręczna weryfikacja

`npm test` obejmuje ponad 50 pełnych zdań z oczekiwanymi intencjami, braki/formaty, dotychczasowe moduły i mockowany Speech adapter: support, start/stop/abort, final/interim, uprawnienia, no-speech, service/network, timeout i cleanup. Testy deadline nie wymagają rzeczywistego czekania.

`npm run test:browser` uruchamia serialnie wcześniejsze regresje i osobny voice-entry.browser.test.js. OFF jest przechwytywane przez CDP, Speech API wstrzyknięte; nie ma prawdziwego mikrofonu w CI ani requestów do produkcyjnego OFF. Testy sprawdzają zapis/reload, wybory, częściowe sumy, mieszane posiłki, jednostki, walidację, błędy, offline, XSS, limity i layout. Brak realnej transkrypcji w CI jest jawnym ograniczeniem testu, nie dowodem działania dostawcy głosu na urządzeniu.

Ręczny test Android/HTTPS: uruchom preview, kliknij mikrofon i powiedz „Na śniadanie zjadłem 80 gram płatków owsianych, 250 ml mleka 2% i banana 120 gram”. Zakończ, sprawdź transkrypcję i trzy wiersze, popraw jedną ilość, zatwierdź, odśwież. Osobno sprawdź odmowę zgody i niepewny skyr. Pierwsze trzy produkty mogą pochodzić z jawnie oznaczonego katalogu edukacyjnego; produkt markowy należy zweryfikować z etykietą/OFF. Bez internetu tekst i zapisane produkty mogą działać w już załadowanej aplikacji, ale usługa mowy i zimny start offline nie są gwarantowane.

## Wybór trybu po teście Samsunga (26.10.2026)

Domyślnie używamy trybu B: continuous=false, interimResults=true. Raport urządzenia pokazał jedną aktualizowaną hipotezę pod indeksem 0 oraz jeden final dla całego posiłku po około 7,4 s, bez duplikacji. W trybie A usługa dostarczała rosnące wersje frazy jako kolejne final. Nie usuwamy słów ani liczb heurystycznie. Diagnostyka nadal pozwala jawnie wybrać A/B/C.

Jedna wypowiedź to jedna sesja. Usługa może zakończyć sesję po naturalnej pauzie; nie restartujemy mikrofonu automatycznie. Sprawdź finalny tekst: w przesłanym raporcie zabrakło separatora między płatkami a mlekiem oraz deklaracji 2 procent. Nie odtwarzamy ich przez zgadywanie; tekst można poprawić przed ponowną analizą.
