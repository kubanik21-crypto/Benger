# Oddzielny adapter wyszukiwarki OFF — przygotowany, nie wdrożony

## Potwierdzona przyczyna

Pomiar z GitHub Actions obejmował odpowiedzi HTTP także ukryte przez CORS w Chromium:

- world CGI: naprzemiennie 200 z `Access-Control-Allow-Origin: *` i 503 bez tego nagłówka; Node z prawidłowym User-Agent również dostał 503;
- polski CGI i API v2 z filtrem marki: 503 bez CORS;
- Search-a-licious: HTTP 200 i JSON z serwera, ale brak CORS dla GitHub Pages. Browser nie może odczytać odpowiedzi;
- serwerowy Search-a-licious dla „Mięsne Specjały”: 12 dopasowań, w tym rzeczywisty produkt 28077565 (140 kcal, B 20, T 6, W 1,5 /100 g).

To nie jest problem, który rozwiąże czyszczenie telefonu, ustawienie `no-cors` lub zmiana nagłówka requestu. Klient nie może dopisać nagłówka CORS do odpowiedzi serwera. Nie stosujemy JSONP, cudzych publicznych proxy ani wyłączania zabezpieczeń przeglądarki.

## Przygotowany komponent

`workers/off-search/worker.js` jest samodzielnym Workerem, bez AI, bazy, płatnych API, bindingów i bibliotek npm. Nie jest Workerem AI i nie wolno nadpisywać nim żadnego istniejącego Workera. Nazwa testowa: **benger-off-search-preview**.

Ścieżka: browser → oddzielny adapter → oficjalny Search-a-licious. Adapter ustawia własny User-Agent Bengera, wywołuje wyłącznie stały endpoint OFF i dodaje CORS dla dopuszczonego origin także przy błędach. Frontend nadal normalizuje dane przez istniejący `normalizeOffProduct`, ProductRepository i calculatePortion. Nutrition z indeksu bez jawnej podstawy ml pozostaje w g; nie wymyślamy gęstości. Barcode nadal korzysta z dotychczasowego Product API.

## Ograniczenia i bezpieczeństwo

- Tylko GET `/search?q=...`, OPTIONS oraz GET `/health`; żadnego arbitralnego upstream URL, zapisu czy uploadu.
- Q: 3–120 znaków, limit długości, odrzucenie znaków kontrolnych, duplikatów i obcych parametrów. Operatory języka zapytań są escapowane.
- Pierwsze 20 wyników, ograniczone fields i odpowiedź do 512 KiB; zwracamy tylko potrzebne pola.
- Timeout 8 s, brak automatycznych retry, zachowanie 429/Retry-After i cooldown.
- Limit 10 wywołań upstream/minutę na instancję oraz ograniczenie szybkich wywołań z IP. Limiter w RAM jest best effort, nie jest globalnym rozproszonym limitem. OFF 429 nadal obowiązuje.
- To publiczny, ograniczony endpoint odczytu; CORS nie jest uwierzytelnianiem i Origin można sfałszować poza browserem. Dla większego/publicznego ruchu potrzebny jest osobny audyt limitów. Na koncie Free wyczerpanie darmowej kwoty może zatrzymać usługę; nie włączamy płatnego planu.
- Nie zapisujemy logów, IP ani zapytań do bazy. IP w pamięci służy wyłącznie limiterowi. Brak AI i telemetry. Operator hostingu ma zwykły dostęp infrastrukturalny do ruchu.
- Dziennik, przepisy, zdjęcia i pomiary nie trafiają do Workera; wysyłana jest wyłącznie fraza wyszukiwania produktu.
- Dane pozostają danymi OFF/ODbL. Search-a-licious jest tylko innym indeksem tego samego źródła; jego świeżości nie należy mylić ze świeżością Product API. Nie kopiujemy kodu serwera Search-a-licious.

## Jednorazowe uruchomienie — wymagana autoryzacja właściciela

Nie wykonano deploymentu Cloudflare ani nie zmieniono produkcji. Potrzebne jest konto Cloudflare Free i logowanie/autoryzacja. Nie jest potrzebny klucz OFF ani Workers AI.

Wariant dashboard: utworzyć nowy Worker **benger-off-search-preview**, wkleić cały `worker.js` jako moduł i opublikować na workers.dev. Kod jest samodzielny, a domyślny dozwolony origin to `https://kubanik21-crypto.github.io`. Nie wybierać istniejącego Workera AI. Publiczny URL będzie miał postać `https://benger-off-search-preview.<subdomena>.workers.dev`.

Wariant CLI po zalogowaniu: deploy z `workers/off-search/wrangler.toml`, używając oficjalnego Wrangler; nie wymaga dodawania zależności do aplikacji. Nie aktywować płatnego planu.

Po utworzeniu Workera jego publiczny URL z `/search` ustawia się jako repozytoryjną **zmienną**, nie sekret, `BENGER_OFF_SEARCH_PREVIEW_URL`. Build wstrzykuje URL wyłącznie do preview off-commercial-search. Publisher ma warunek wymagający tej zmiennej; bez niej nie publikuje kolejnego pozornie naprawionego preview. Produkcyjny build ignoruje tę zmienną i zachowuje dotychczasową konfigurację.

Następnie trzeba wykonać rzeczywisty test wdrożonego Workera i preview. Sukces lokalnych mocków albo uruchomienia kodu Workera w Node nie jest sukcesem deploymentu Cloudflare. Aktualny plan konta i dostępność darmowej usługi muszą być sprawdzone przy autoryzacji; nie obiecujemy bezwarunkowej dostępności usługi zewnętrznej.

## Testy

Unit: origin/method/query/SSRF guard, whitelista pól, 429/cooldown/timeout/rozmiar JSON, prototype pollution, wspólna normalizacja Product i brak zgadywania ml. Browser: natywny fetch z odpowiedzią rzeczywistej implementacji Workera (mockowany upstream), CORS, zapis porcji do dziennika, jawny refresh, checkbox off, czytelne 503 i niezmieniony barcode.

`scripts/off-bridge-live.mjs` wykonuje kod Workera w Node z prawdziwym zapytaniem do OFF, bez mockowania upstream. Raport jawnie oznacza `deployed:false` — potrzebny jest jeszcze deployment i test w Cloudflare. `scripts/off-connection-diagnostic.mjs` pozwala ręcznie powtórzyć porównanie oficjalnych endpointów, z przerwami i zatrzymaniem po 429.

## Podłączenie testowe

Właściciel podał publiczny endpoint `https://benger-off-search-preview.kubanik-21.workers.dev/search`. Workflow preview używa go jawnie jako publicznej konfiguracji (nie sekretu). Zastępuje to wcześniejszy krok ustawiania zmiennej repozytorium. Publikacja wymaga sukcesu testów i rzeczywistego wywołania wdrożonego adaptera, z poprawnym CORS i znormalizowanymi produktami. Produkcyjny build nadal nie otrzymuje endpointu.
