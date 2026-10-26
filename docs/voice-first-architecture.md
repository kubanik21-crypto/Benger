# Voice-first: kontrakty dopasowania produktów

Pierwotne kontrakty ProductResolver powstały w Etapie 3. W Etapie 4 połączono je z adapterem SpeechRecognition, nową warstwą MealUnderstanding i edytorem propozycji. Aktualna instrukcja i ograniczenia: [voice-entry.md](voice-entry.md). Bez AI i płatnej transkrypcji.

## Przepływ i granice

```text
SpeechToText (Web Speech, continuous=false / interimResults=true)
  → rawTranscript
TranscriptNormalizer → normalizedTranscript
FoodTokenizer / FoodSegmentation
MealUnderstanding (parser regułowy, bez AI)
  → {meal, intents: [{id, query, amount, unit, barcode?}]}
ProductResolver (istniejący moduł)
  → istniejący Product + confidence + alternatives + reason
NutritionData / nutrition.js
  → calculatePortion(Product, amount)
MealProposal / meal-resolution.js
  → osobne pozycje, porcje i niepewne dopasowania
Potwierdzenie użytkownika
  → istniejący zapis snapshotów dziennika
```

Transkrypcja przekazuje tekst, nie produkty ani makro. Parser przekazuje tożsamość/ilość/jednostkę i kod posiłku, nie wartości odżywcze. Resolver nie rozumie całej wypowiedzi i nie zapisuje posiłku. Obliczenia nie pytają API. Historyczny dziennik korzysta wyłącznie ze snapshotów, bez ponownego dopasowania.

`meal-parser.js` pozostaje zgodnym, testowanym modułem historycznym. Nowy ekran używa `meal-understanding.js`, a `voice-entry.js` łączy intencje z resolverem i modułem propozycji. Głos i tekst mają wspólny dalszy przepływ.

## Intencja wejściowa

```js
{
  id: 'skyr-1',
  query: 'skyr waniliowy pilos',
  amount: 150,
  unit: 'g'
}
```

`id` identyfikuje wiersz propozycji, nie produkt ani wpis dziennika. `amount` musi być skończoną dodatnią liczbą; `unit` to g/ml zgodne z Product. Parser/formularz odpowiada za zamianę tekstu ilości na liczbę. Resolver może przyjąć sam query do wyszukania tożsamości, ale bez ilości/jednostki nie powstaje gotowa porcja. Nie zgadujemy gramów banana, wielkości szklanki ani gęstości mleka.

Pola `nutrition`, `per100` lub podobne przekazane przez przyszły parser/AI są ignorowane. Dane pochodzą wyłącznie z walidowanego Product w repozytorium. Fikcyjne produkty testowe nie są katalogiem aplikacji.

## ProductResolver

```js
const resolver = createProductResolver({ repository });
const resolution = await resolver.resolve(intent, { allowExternal: false, signal });
// {product, confidence, alternatives, reason, requiresConfirmation: true}
```

Dokładny barcode jest rozstrzygany przed frazą. Dla query kolejność preferencji to pamięć jawnego wyboru → ostatnie → ulubione → lokalny/cache. Dopiero jawne `allowExternal: true` pozwala na search przez repozytorium. Odczyty podlegają wspólnemu limiterowi, TTL i obsłudze błędów; resolver nie wykonuje własnego fetch.

| Confidence | Warunek | Zachowanie przyszłego UI |
| --- | --- | --- |
| HIGH | Dokładny barcode albo wcześniejszy wybór co najmniej dwa razy i co najmniej 75% zgodnej historii frazy | Przygotuj do szybkiej końcowej weryfikacji |
| MEDIUM | Jedyny zgodny produkt lub pojedynczy jawny wybór | Pokaż do potwierdzenia z nazwą/marką i jednostką |
| LOW | Kilka zgodnych marek/wariantów, brak wyniku lub konflikt jednostki | Nie wybieraj produktu; pokaż do pięciu propozycji albo poproś o brakującą informację |

To deterministyczne reguły, nie model probabilistyczny. Ulubiony/recent ma priorytet na liście, ale sam nie usuwa niejednoznaczności. Pamięć może wskazać wcześniej wybrany produkt mimo braku dokładnej zgodności tokenów nazwy; nadal obowiązuje zgodna jednostka i brak jawnego konfliktu procentu. Bez pamięci dopasowanie jest konserwatywne: pełne tokeny nazwy/marki, bez odmiany polskich słów i fuzzy matching. Wszystkie wyniki wymagają weryfikacji, także HIGH.

## Lokalna pamięć jawnych wyborów

```js
await resolver.rememberUserChoice('mleko 2%', product.id);
// IndexedDB selections:
// {key: 'mleko 2%', choices: [{productId, count: 1, lastUsedAt: 179...}]}
```

Normalizacja zachowuje znaczenie liczb/procentów: `MLEKO 2 procent`, `mleko 2,0%` i `mleko 2 %` mają ten sam klucz. `2%` nie jest `12%`, `Pilos` nie jest `Superpilos`. Nie wyliczamy procentu z pola fat.

UI uczy po kliknięciu konkretnego wyniku wyszukiwania lub jawnym zatwierdzeniu całej widocznej propozycji. Ten sam wybór nie jest ponownie liczony przy zatwierdzeniu. Samo wyszukiwanie, wnioskowanie i otwarcie listy nie uczą. Nie wymaga zapisu do dziennika, a „ostatnie” nadal powstają dopiero po udanym zapisie. `rememberUserChoice` wymaga istniejącego produktu w repozytorium. Licznik i czas są aktualizowane w transakcji IndexedDB; alternatywne wybory pozostają widoczne w historii frazy. Najwyżej 200 fraz po 5 produktów, licznik ograniczony do miliona. Powiązane produkty nie wypadają ze zwykłego cache; uczenie nie odnawia daty pobrania.

Upgrade bazy v1→v2 dodaje `selections`, bez usuwania produktów/ulubionych/ostatnich. Preview ma oddzielną bazę i klucze od root. Przy zablokowanym IndexedDB pamięć jest tylko w karcie, z widocznym ostrzeżeniem. Dane wyborów nie trafiają do OFF ani żadnego serwera.

## Propozycja wielu produktów bez poprawiania całego posiłku

```js
const proposal = await resolveMealIntents(intents, { resolver });
const updated = await confirmMealItem(proposal, 'milk-1', chosenProductId, { repository });
const summary = summarizeMealProposal(updated);
```

`resolveMealIntents` obsługuje do 20 wierszy o unikalnych ID. Domyślnie pracuje lokalnie. Opcjonalne `allowExternal: true` daje najwyżej jeden search dla nierozpoznanej pozycji, zamiast requestu na każdy fragment wypowiedzi. Pozostałe wymagają świadomego wyboru lub osobnej akcji wyszukiwania. Dokładny kod może być pobrany przez resolver po jawnym zezwoleniu; lista posiłku obecnie używa budżetu dla nierozpoznanych fraz, bez automatycznych lookupów kodów.

Propozycja zachowuje każdą intencję, wynik dopasowania, porcję (lub null) oraz stan potwierdzenia. `confirmMealItem` odczytuje prawdziwy produkt z katalogu i wymienia tylko wskazany wiersz. Niezgodne jednostki blokują potwierdzenie. `summarizeMealProposal` zwraca sumę rozpoznanych porcji i osobno liczbę nierozstrzygniętych; nie udaje pełnej sumy posiłku.

Test architektury ma cztery intencje: płatki, mleko, banan, skyr. Trzy porcje są gotowe, mleko ma kilka możliwych marek. Potwierdzenie wyłącznie mleka zachowuje pozostałe trzy. Dane skyra w tym teście są fikcyjne, nie opublikowane jako produkt spożywczy.

## Integracja w Etapie 4

1. Rozszerz MealUnderstanding do wyjścia `{meal, intents, issues}` bez zmiany resolvera i obliczeń; zachowaj stare testy parsera.
2. Zbuduj edytor propozycji oparty na ID wiersza, z listą tylko niepewnych dopasowań. Zmiana ilości unieważnia jedną porcję; zmiana daty/posiłku aktualizuje kontekst propozycji.
3. Po zatwierdzeniu wszystkich wymaganych wierszy przekaż istniejące snapshoty do wspólnego zapisu dziennika. Samo wyszukanie lub HIGH nigdy nie zapisuje wpisu.
4. Dodaj osobny adapter SpeechToText. Zmiana dostawcy transkrypcji nie może zmienić kontraktu intencji, źródła makro ani modelu historii.

Powyższe cztery kroki zrealizowano w Etapie 4 z adapterem Web Speech. Pozostałe silniki transkrypcji są przyszłymi zamiennikami. Pozostają znane ograniczenia localStorage przy idealnie równoczesnym zapisie, brak synchronizacji urządzeń i brak gwarancji zimnego uruchomienia offline. Nie dodano kont, backendu ani płatnej usługi.

## Etap 5

Wdrożono normalizację, segmentację bez przecinków, niezależne structureConfidence, ochronę wariantów, podobne potwierdzone frazy i jawne aliasy. Pamięć IndexedDB v2 pozostaje zgodna wstecz; historia diagnostyczna jest osobna od dziennika. Szczegółowy kontrakt, kolejność resolvera i ograniczenia: [Smart Voice Understanding](smart-voice-understanding.md). Lab nie jest zewnętrzną usługą transkrypcji i nie wysyła historii.
