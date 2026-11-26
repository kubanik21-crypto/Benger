# Benger — import przepisów JSON v1 (Etap 4A)

Ten dokument jest instrukcją dla użytkownika i czatu Dieta w projekcie TRENINGI
KUBA 2.0. Nie wymaga znajomości kodu Bengera. Specyfikacja obejmuje niezależny
import biblioteki przepisów, nie backup, jadłospis ani dziennik rzeczywistego jedzenia.

## Jak użyć

W nowej wersji Bengera: **Przepisy → Importuj przepisy → wybierz plik JSON**.
Sprawdź nazwy, składniki, ilości, makro, źródła i ostrzeżenia, zaznacz przepisy,
a następnie wybierz „Importuj wybrane przepisy”. Anulowanie nie zapisuje niczego.
Import działa offline na Androidzie i w przeglądarce z IndexedDB, bez OAuth.

Nowe kompletne przepisy bez ostrzeżeń są zaznaczone. Aktualizacje, przepisy
niekompletne i ostrzeżenia wymagają świadomego zaznaczenia. Błędne rekordy i
identyczne duplikaty są nieaktywne. Zaznaczenie aktualizacji oznacza zgodę na
zastąpienie bieżącej bazy i zachowanie poprzedniej wersji w historii.

Import nie dodaje posiłków do dziennika, nie zmienia treningów, celów, pomiarów
ani Google Sheets. Po imporcie używa się standardowego „Zrób jak zapisano” /
„Dostosuj tę porcję”. Niekompletne przepisy trzeba uzupełnić przed zapisem spożycia.

## Kontrakt pliku

UTF-8 JSON, bez Markdown, BOM i komentarzy. Rozmiar do **2 MiB**. Obiekt główny:

| Pole | Typ | Wymagane | Znaczenie |
| --- | --- | --- | --- |
| format | string | tak | Dokładnie `benger.recipe-package` |
| schemaVersion | integer | tak | Dokładnie `1` |
| namespace | string | tak | Stała przestrzeń właściciela, np. `dieta-kuba` |
| label | string | nie | Etykieta paczki/grupy, maks. 200 znaków |
| recipes | array | tak | 1–50 przepisów |

Identyfikatory namespace/externalId/id: 1–100 znaków, pierwszy alfanumeryczny,
pozostałe litery ASCII, cyfry, kropka, podkreślenie lub myślnik. Nie zmieniaj
namespace między tygodniami. W paczce nie może być powtórzonych externalId.
Nie dodawaj nieudokumentowanych pól. Wszystkie limity liczą długość tekstu w JS
(UTF-16), a limit pliku dotyczy bajtów UTF-8.

### Przepis

Wymagane: `externalId`, `version`, `name`, `meal`, `servings`, `ingredients`, `steps`.

- `externalId`: stały identyfikator dania, np. `spicy-miso-ramen`. Zmiana gramatury
  nie tworzy nowego externalId. Ten sam identyfikator w innej namespace to inny przepis.
- `version`: liczba całkowita 1–1000000. Zwiększaj przy zmianie treści przepisu,
  także źródeł, wariantów czy etykiety paczki. Wersja zewnętrzna nie jest numerem
  wersji aplikacji ani wewnętrznej bazy Bengera.
- `name`: 1–200 znaków, nie sam biały tekst.
- `meal`: `breakfast`, `lunch`, `dinner` lub `snack`.
- `servings`: dodatnia liczba, maks. 10000. Dopuszczalne porcje ułamkowe.
- `ingredients`: 1–100 składników całego przygotowania, nie jednej porcji.
- `steps`: 0–100 kroków w kolejności. Każdy to string 1–1000 znaków albo obiekt
  `{"text":"…","durationMinutes":5,"temperatureC":180}`. Czas i temperatura
  są opcjonalne; czas >0 do 10080 minut, temperatura 0–350°C.

Opcjonalne:

- `source`: `{"label":"Nazwa źródła","url":"https://…"}`. label 1–240 znaków,
  url do 500 znaków, wyłącznie HTTP(S), bez loginu i hasła. URL nie jest pobierany.
- `tags`: do 20 tekstów po 1–40 znaków.
- `preparationMinutes`: dodatnia liczba do 10080, czas całego przygotowania.
- `finalWeight`: rzeczywista końcowa masa **całego gotowego dania** w g, >0 do 1e7.
- `finalVolume`: rzeczywista końcowa objętość całego dania w ml, >0 do 1e7.
  Nie zgaduj ich z sumy mas surowych składników. Bez tych pól dodawanie przepisu
  działa w porcjach, a wartości na 100 g/ml gotowego dania pozostają nieznane.
- `expectedNutrition`: `{"total":{…}|null,"perServing":{…}|null}`. To opcjonalne
  wartości kontrolne, nigdy główne źródło makro. Oba klucze są wymagane, jeśli
  obiekt występuje. Makro zawiera dokładnie kcal/protein/fat/carbs, liczby ≥0.
- `variants`: do 20 wariantów opisanych poniżej.

### Składnik

Wymagane: `id`, `name`, `amount`, `unit`.

- `id`: stały identyfikator składnika w tym przepisie, np. `chicken`, nie numer
  losowany przy każdym eksporcie. Musi być unikalny w składnikach przepisu.
- `name`: semantyczna nazwa 1–240 znaków, niezależna od marki/produktu handlowego.
- `amount`: dodatnia liczba do 100000, albo **null**, jeśli ilość jest nieznana.
  Zero nie oznacza „do smaku”. Taką ilość zapisuj jako null.
- `unit`: jedna z jednostek w tabeli niżej. Nie używaj kg, l, `szt.`, polskich
  odmian nazw ani opisów w polu unit. Przelicz znane kg/l na g/ml przed eksportem.

Opcjonalne:

- `productId`: istniejący identyfikator Bengera do 240 znaków, np. `custom:…`.
  Podawaj tylko rzeczywisty, znany identyfikator. Nie zgaduj go z nazwy.
- `massState`: `raw`, `cooked`, `unspecified` (domyślne). Określa stan ilości
  składnika. **Nie uruchamia przelicznika surowe ↔ gotowane**. Dane produktu i
  makro muszą odnosić się do tego samego stanu. Sprawdza to autor pliku.
- `nutrition`: null albo obiekt opisany poniżej.
- `baseAmount` i `baseUnit`: występują razem i tylko dla jednostek domowych,
  przy znanej dodatniej amount. baseAmount to końcowa ilość w g/ml **dla całej
  zadeklarowanej ilości**, nie masa jednej sztuki. Np. amount 2 piece,
  baseAmount 112, baseUnit g oznacza łącznie 112 g, a nie 224 g.
  Nie podawaj tych pól dla unit g/ml. Bez jednoznacznej konwersji składnik
  pozostanie nierozwiązany. Nie zgaduj mas sztuk ani gęstości.

| unit | Znaczenie |
| --- | --- |
| g / ml | Gramy / mililitry, jednostka podstawowa |
| piece | sztuka |
| slice / slab | kromka / plaster |
| tablespoon / teaspoon | łyżka / łyżeczka |
| cup / mug | szklanka / kubek |
| package / serving | opakowanie / porcja produktu |
| handful / scoop | garść / miarka |

Jednostki domowe i ich jawne ilości zostają zachowane w opisie składnika. Do
obliczeń i standardowej edycji Bengera trafia ilość bazowa, jeśli jest znana.
Importer nie zapisuje tych konwersji jako globalnych definicji porcji produktu.

### Wartości odżywcze składnika

Jedyny dopuszczalny format deklaracji:

```json
{"unit":"g","per100":{"kcal":100,"protein":10,"fat":0,"carbs":15},"source":{"label":"DANE SYNTETYCZNE — przykład struktury, nie wartości prawdziwej żywności"}}
```

Wartości dotyczą **100 g albo 100 ml**, nigdy podanej ilości składnika. B/T/W są
w gramach, kcal w kilokaloriach. source.label jest wymagane; URL opcjonalny.
W przykładzie powyżej liczby są wyłącznie syntetyczne, nie wolno przypisywać ich
realnym produktom. Używaj rzeczywistej etykiety lub wiarygodnej bazy. Sama obecność
opisu źródła nie potwierdza prawdziwości danych; importer nie weryfikuje stron WWW.

Wszystkie cztery wartości muszą być znane i liczbowe. Jeśli brakuje którejkolwiek,
ustaw całe nutrition na **null** albo pomiń to pole. Nie wpisuj zer za brakujące
wartości. Nie ma obsługi częściowego makro pojedynczego składnika w silniku v1.

Granice produktu odziedziczone z Bengera: g → kcal 0–1000, każda makro 0–100,
suma makro ≤101; ml → kcal 0–2500, każda makro 0–250, suma makro ≤300. Dalsze
limity wartości całego przepisu zabezpieczają przed przepełnieniami. Nie wyliczaj
kcal z 4/4/9 zamiast podanych danych etykiety; istniejący silnik skaluje deklarację.

Hierarchia i konflikty:

1. Jawny productId dostępny lokalnie: wykorzystujemy jego snapshot. Jeśli plik
   podaje też per100, muszą być identyczne oraz mieć zgodną jednostkę.
2. Sprzeczne per100: ostrzeżenie, przepis domyślnie niezaznaczony; zaznaczenie
   pozwala użyć **nowego** własnego produktu z deklaracji pliku. Oryginał nie jest
   nadpisywany. Nowy identyfikator zależy od namespace, nazwy, jednostki i per100.
3. Brak dostępnego ID + pełne per100 ze źródłem: nowy produkt własny w istniejącym
   magazynie produktów. Taki sam produkt w paczce jest współdzielony.
4. Sama nazwa nie uprawnia do automatycznego dopasowania. Wspólny resolver lokalny
   może znaleźć propozycje; składnik pozostaje nierozwiązany do świadomej edycji.
5. Brak ilości, konwersji, zgodności jednostki albo per100: nierozwiązany składnik.
   Można zapisać niekompletny przepis; nie można udawać pełnego makro.

Bez automatycznej konwersji g↔ml i bez pobierania danych z sieci. Sól i przyprawy
nie są automatycznie wykluczane z obliczeń.

### Jedno obliczenie, jeden silnik

Benger używa własnego deterministycznego silnika:

`makro składnika = per100 × końcowa ilość bazowa / 100`

`cały przepis = suma snapshotów składników`

`jedna porcja = cały przepis / servings`

Przy finalWeight/finalVolume liczy analogicznie wartości na 100 g/ml gotowego
przepisu. Ilość household z baseAmount nie jest ponownie mnożona przez amount.
Nie ma podwójnego skalowania. Do obliczeń nie zaokrąglamy; ekran zaokrągla widok.

Jeżeli którykolwiek niewykluczony składnik ma braki: total/perServing/per100 są
null, complete=false, a knownTotal pokazuje wyłącznie znaną część — nie całość.
Prawdziwe zera są poprawne i mogą dać kompletny przepis z 0 kcal.
expectedNutrition jest tylko asercją: różnica >1 kcal albo >0,1 g makro powoduje
ostrzeżenie. Nigdy nie nadpisuje obliczeń ani nie uzupełnia brakujących składników.

### Warianty

Wariant nie duplikuje bazy. Każdy ma id, name i overrides (do 100 operacji).
Dozwolone operacje formatu v1:

- `{"type":"UPDATE_AMOUNT","ingredientId":"chicken","amount":250}`
- `{"type":"REMOVE","ingredientId":"optional-topping"}`

ingredientId musi istnieć w bazie; jedna operacja na dany składnik w wariancie.
UPDATE_AMOUNT działa tylko dla rozwiązanego składnika i ilości w jego jednostce
bazowej. Dla domowych jednostek podaj końcową liczbę g/ml, nie liczbę sztuk.
REMOVE może dotyczyć także składnika nierozwiązanego. Inne operacje (zamiana/
dodawanie) wykonuje się później w istniejącym edytorze Bengera; format v1 nie
wprowadza ich dodatkowej składni.

Wariant jest przypięty do konkretnej lokalnej wersji bazy. Aktualizacja importu
dodaje warianty nowej wersji, zachowując stare i ich bazę w historii. Nie usuwa
lokalnych wariantów. Starsze mogą wymagać standardowej weryfikacji bazy w UI.

## Idempotencja, wersje i historia

Para namespace + externalId deterministycznie wyznacza lokalny UUID. Identyfikator
składnika zależy także od jego id. Numer version nie zmienia ID bazy ani składnika.
Benger zachowuje metadane importInfo (wersja zewnętrzna i fingerprinty) w zwykłym
modelu Recipe; nie tworzy drugiej biblioteki ani indeksu wymagającego osobnego backupu.

- Identyczna wersja/treść: pominięcie, także gdy baza została później edytowana lokalnie.
- Ta sama wersja, inna treść: błąd. Zwiększ version w pliku.
- Wyższa wersja: propozycja aktualizacji, domyślnie niezaznaczona. Lokalna edycja
  dodatkowo ostrzega. Poprzednia baza zachowuje się jako normalna Recipe History.
- Niższa wersja: blokada cofnięcia.
- Podobna nazwa i inny externalId/namespace: ostrzeżenie, bez scalania.
- Zmiana biblioteki po podglądzie: cały zapis odrzucony; przygotuj podgląd ponownie.

Historyczne wpisy dziennika są niezależnymi Meal Snapshots. Aktualizacja bazy,
produktów albo wariantów nie przelicza ich kalorii, ilości i produktów.

## Walidacja i atomowość

Błędny envelope/JSON/duplikaty externalId blokują plik. Błąd pojedynczego przepisu
jest pokazany w jego wierszu; poprawne wiersze można wybrać. Limity: 50 przepisów,
100 składników i 100 kroków na przepis, 20 wariantów, głębokość JSON ≤20,
zakazane klucze __proto__/prototype/constructor. Nieznane pola są błędem.

Wybrany zestaw zapisuje się jedną transakcją IndexedDB recipes/recipeHistory/meta,
wraz z nowymi produktami i wariantami. Quota, przerwanie lub konflikt wycofuje
całość. Podgląd nie zapisuje produktów. Podczas zapisu przycisk anulowania jest
nieaktywny; zabicie procesu pozwala IndexedDB zakończyć albo wycofać transakcję.
Nie ma częściowego zapisu udawanego jako pełny sukces.

Limity istniejącej biblioteki: 1000 przepisów, 2000 historii, 2000 wariantów,
1000 produktów własnych. Import nie usuwa starej historii, żeby zmieścić nową;
przy przekroczeniu limitu odmawia zapisu. Nie ma nowej bazy ani migracji destrukcyjnej.
Stare backupy działają; zwykły backup v8 zachowuje nowe metadane i warianty dzięki
istniejącemu modelowi. Nie zmieniono formatu/implementacji backupu.

## Instrukcja dla czatu Dieta — bez Codexa

1. Przyjmij na stałe namespace `dieta-kuba`. Dla dania zachowuj externalId i stałe id
   składników między kolejnymi tygodniami. Nowy tydzień nie oznacza nowego ID dania.
2. Zapytaj o rzeczywiste ilości całego przygotowania i liczbę porcji. Nie mieszaj
   surowego/gotowego produktu. Nie zgaduj masy sztuki ani końcowej masy potrawy.
3. Użyj wyłącznie potwierdzonych wartości per100 z podanym źródłem. Gdy ich nie
   masz: nutrition:null, nawet jeżeli znasz przybliżone kcal dania. Nie wymyślaj ID.
4. Utwórz JSON zgodny z poniższym schematem. Bez tekstu przed/po, bez komentarzy,
   bez ogrodzenia Markdown w pobieranym pliku. Nazwa np. `benger-recipes.json`.
5. Przy aktualizacji zachowaj ID i zwiększ version. Nie duplikuj bazy z powodu
   jednej porcji; warianty stosuj do zapisywalnych odmian, zwykłe wykonanie dostosuj
   później w Bengerze. Nie umieszczaj dziennika spożycia ani danych użytkownika.
6. Przekaż użytkownikowi plik oraz krótką listę braków i źródeł. Użytkownik otwiera
   Importuj przepisy, sprawdza podgląd i sam zatwierdza zapis.

Nieprawidłowe przykłady: amount:"200" (tekst), unit:"kg", amount:0, servings:0,
protein:null wewnątrz pełnego per100, brak source przy per100, makro ujemne,
powtórzone id składników, productId odgadnięte z nazwy, wyższa gramatura bez
zwiększenia version. Źle znane makro oznacz nutrition:null, nie kompletem zer.

## Przykłady i formalny schemat

Poniższe pliki są również dostępne osobno w `docs/examples/recipe-import/`.
To szablony do uzupełnienia, nie zweryfikowany jadłospis. Unknowns są celowe;
nie przypisano realnym potrawom zmyślonych wartości odżywczych.

### Jeden przepis

```json
{
  "format": "benger.recipe-package",
  "schemaVersion": 1,
  "namespace": "dieta-kuba",
  "label": "Przykłady importu — uzupełnij produkty",
  "recipes": [
    {
      "externalId": "owsianka",
      "version": 1,
      "name": "Owsianka do uzupełnienia",
      "meal": "breakfast",
      "servings": 2,
      "ingredients": [
        {
          "id": "oats",
          "name": "płatki owsiane",
          "amount": 140,
          "unit": "g",
          "massState": "raw",
          "nutrition": null
        },
        {
          "id": "milk",
          "name": "mleko",
          "amount": 400,
          "unit": "ml",
          "nutrition": null
        }
      ],
      "steps": [
        "Połącz płatki z mlekiem.",
        "Gotuj do preferowanej konsystencji."
      ],
      "preparationMinutes": 10,
      "tags": [
        "przykład"
      ],
      "expectedNutrition": {
        "total": null,
        "perServing": null
      }
    }
  ]
}
```

### Zestaw siedmiu przepisów — szablony

```json
{
  "format": "benger.recipe-package",
  "schemaVersion": 1,
  "namespace": "dieta-kuba",
  "label": "Przykłady importu — uzupełnij produkty",
  "recipes": [
    {
      "externalId": "example-1",
      "version": 1,
      "name": "Owsianka — szablon do uzupełnienia",
      "meal": "breakfast",
      "servings": 2,
      "ingredients": [
        {
          "id": "main",
          "name": "płatki owsiane",
          "amount": 100,
          "unit": "g",
          "nutrition": null
        }
      ],
      "steps": [
        "Dostosuj składniki i instrukcję przed użyciem."
      ],
      "preparationMinutes": 10,
      "tags": [
        "przykład"
      ],
      "expectedNutrition": {
        "total": null,
        "perServing": null
      }
    },
    {
      "externalId": "example-2",
      "version": 1,
      "name": "Sałatka z kurczakiem — szablon do uzupełnienia",
      "meal": "dinner",
      "servings": 2,
      "ingredients": [
        {
          "id": "main",
          "name": "kurczak",
          "amount": 100,
          "unit": "g",
          "nutrition": null
        }
      ],
      "steps": [
        "Dostosuj składniki i instrukcję przed użyciem."
      ],
      "preparationMinutes": 10,
      "tags": [
        "przykład"
      ],
      "expectedNutrition": {
        "total": null,
        "perServing": null
      }
    },
    {
      "externalId": "example-3",
      "version": 1,
      "name": "Ryż z warzywami — szablon do uzupełnienia",
      "meal": "lunch",
      "servings": 2,
      "ingredients": [
        {
          "id": "main",
          "name": "ryż suchy",
          "amount": 100,
          "unit": "g",
          "nutrition": null
        }
      ],
      "steps": [
        "Dostosuj składniki i instrukcję przed użyciem."
      ],
      "preparationMinutes": 10,
      "tags": [
        "przykład"
      ],
      "expectedNutrition": {
        "total": null,
        "perServing": null
      }
    },
    {
      "externalId": "example-4",
      "version": 1,
      "name": "Makaron z pomidorami — szablon do uzupełnienia",
      "meal": "lunch",
      "servings": 2,
      "ingredients": [
        {
          "id": "main",
          "name": "makaron suchy",
          "amount": 100,
          "unit": "g",
          "nutrition": null
        }
      ],
      "steps": [
        "Dostosuj składniki i instrukcję przed użyciem."
      ],
      "preparationMinutes": 10,
      "tags": [
        "przykład"
      ],
      "expectedNutrition": {
        "total": null,
        "perServing": null
      }
    },
    {
      "externalId": "example-5",
      "version": 1,
      "name": "Kanapki — szablon do uzupełnienia",
      "meal": "breakfast",
      "servings": 2,
      "ingredients": [
        {
          "id": "main",
          "name": "chleb",
          "amount": 100,
          "unit": "g",
          "nutrition": null
        }
      ],
      "steps": [
        "Dostosuj składniki i instrukcję przed użyciem."
      ],
      "preparationMinutes": 10,
      "tags": [
        "przykład"
      ],
      "expectedNutrition": {
        "total": null,
        "perServing": null
      }
    },
    {
      "externalId": "example-6",
      "version": 1,
      "name": "Sałatka z fetą — szablon do uzupełnienia",
      "meal": "dinner",
      "servings": 2,
      "ingredients": [
        {
          "id": "main",
          "name": "feta",
          "amount": 100,
          "unit": "g",
          "nutrition": null
        }
      ],
      "steps": [
        "Dostosuj składniki i instrukcję przed użyciem."
      ],
      "preparationMinutes": 10,
      "tags": [
        "przykład"
      ],
      "expectedNutrition": {
        "total": null,
        "perServing": null
      }
    },
    {
      "externalId": "example-7",
      "version": 1,
      "name": "Skyr z owocami — szablon do uzupełnienia",
      "meal": "snack",
      "servings": 2,
      "ingredients": [
        {
          "id": "main",
          "name": "skyr",
          "amount": 100,
          "unit": "g",
          "nutrition": null
        }
      ],
      "steps": [
        "Dostosuj składniki i instrukcję przed użyciem."
      ],
      "preparationMinutes": 10,
      "tags": [
        "przykład"
      ],
      "expectedNutrition": {
        "total": null,
        "perServing": null
      }
    }
  ]
}
```

### Aktualizacja tego samego przepisu (version 2)

```json
{
  "format": "benger.recipe-package",
  "schemaVersion": 1,
  "namespace": "dieta-kuba",
  "label": "Przykłady importu — uzupełnij produkty",
  "recipes": [
    {
      "externalId": "owsianka",
      "version": 2,
      "name": "Owsianka do uzupełnienia",
      "meal": "breakfast",
      "servings": 2,
      "ingredients": [
        {
          "id": "oats",
          "name": "płatki owsiane",
          "amount": 160,
          "unit": "g",
          "massState": "raw",
          "nutrition": null
        },
        {
          "id": "milk",
          "name": "mleko",
          "amount": 400,
          "unit": "ml",
          "nutrition": null
        }
      ],
      "steps": [
        "Połącz płatki z mlekiem.",
        "Gotuj do preferowanej konsystencji."
      ],
      "preparationMinutes": 10,
      "tags": [
        "przykład"
      ],
      "expectedNutrition": {
        "total": null,
        "perServing": null
      }
    }
  ]
}
```

### Przepis z wariantem

```json
{
  "format": "benger.recipe-package",
  "schemaVersion": 1,
  "namespace": "dieta-kuba",
  "label": "Przykłady importu — uzupełnij produkty",
  "recipes": [
    {
      "externalId": "owsianka-z-wariantem",
      "version": 1,
      "name": "Owsianka do uzupełnienia",
      "meal": "breakfast",
      "servings": 2,
      "ingredients": [
        {
          "id": "oats",
          "name": "płatki owsiane",
          "amount": 140,
          "unit": "g",
          "massState": "raw",
          "nutrition": null
        },
        {
          "id": "milk",
          "name": "mleko",
          "amount": 400,
          "unit": "ml",
          "nutrition": null
        }
      ],
      "steps": [
        "Połącz płatki z mlekiem.",
        "Gotuj do preferowanej konsystencji."
      ],
      "preparationMinutes": 10,
      "tags": [
        "przykład"
      ],
      "expectedNutrition": {
        "total": null,
        "perServing": null
      },
      "variants": [
        {
          "id": "without-milk",
          "name": "Bez mleka — uzupełnij płyn osobno",
          "overrides": [
            {
              "type": "REMOVE",
              "ingredientId": "milk"
            }
          ]
        }
      ]
    }
  ]
}
```

### Formalny JSON Schema (Draft 2020-12)

Osobny plik: `docs/recipe-import.schema.json`. Schemat opisuje strukturę;
unikalność ID w tablicach, zgodność sum makro, referencje wariantów, URL bez
loginu/hasła i konflikty biblioteki są dodatkowo sprawdzane przez importer.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "urn:benger:recipe-package:1",
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "format": {
      "const": "benger.recipe-package"
    },
    "schemaVersion": {
      "const": 1
    },
    "namespace": {
      "type": "string",
      "pattern": "^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$"
    },
    "label": {
      "type": "string",
      "minLength": 1,
      "maxLength": 200,
      "pattern": "\\S"
    },
    "recipes": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/recipe"
      },
      "minItems": 1,
      "maxItems": 50
    }
  },
  "required": [
    "format",
    "schemaVersion",
    "namespace",
    "recipes"
  ],
  "$defs": {
    "macros": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "kcal": {
          "type": "number",
          "minimum": 0,
          "maximum": 10000000000.0
        },
        "protein": {
          "type": "number",
          "minimum": 0,
          "maximum": 10000000000.0
        },
        "fat": {
          "type": "number",
          "minimum": 0,
          "maximum": 10000000000.0
        },
        "carbs": {
          "type": "number",
          "minimum": 0,
          "maximum": 10000000000.0
        }
      },
      "required": [
        "kcal",
        "protein",
        "fat",
        "carbs"
      ]
    },
    "source": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "label": {
          "type": "string",
          "minLength": 1,
          "maxLength": 240,
          "pattern": "\\S"
        },
        "url": {
          "type": "string",
          "maxLength": 500,
          "pattern": "^https?://",
          "format": "uri"
        }
      },
      "required": [
        "label"
      ]
    },
    "nutrition": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "unit": {
          "enum": [
            "g",
            "ml"
          ]
        },
        "per100": {
          "$ref": "#/$defs/macros"
        },
        "source": {
          "$ref": "#/$defs/source"
        }
      },
      "required": [
        "unit",
        "per100",
        "source"
      ]
    },
    "ingredient": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "id": {
          "type": "string",
          "pattern": "^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$"
        },
        "name": {
          "type": "string",
          "minLength": 1,
          "maxLength": 240,
          "pattern": "\\S"
        },
        "amount": {
          "anyOf": [
            {
              "type": "number",
              "exclusiveMinimum": 0,
              "maximum": 100000
            },
            {
              "type": "null"
            }
          ]
        },
        "unit": {
          "enum": [
            "g",
            "ml",
            "piece",
            "slice",
            "slab",
            "tablespoon",
            "teaspoon",
            "cup",
            "mug",
            "package",
            "serving",
            "handful",
            "scoop"
          ]
        },
        "baseAmount": {
          "type": "number",
          "exclusiveMinimum": 0,
          "maximum": 100000
        },
        "baseUnit": {
          "enum": [
            "g",
            "ml"
          ]
        },
        "massState": {
          "enum": [
            "raw",
            "cooked",
            "unspecified"
          ]
        },
        "productId": {
          "type": "string",
          "minLength": 1,
          "maxLength": 240,
          "pattern": "\\S"
        },
        "nutrition": {
          "anyOf": [
            {
              "$ref": "#/$defs/nutrition"
            },
            {
              "type": "null"
            }
          ]
        }
      },
      "required": [
        "id",
        "name",
        "amount",
        "unit"
      ],
      "dependentRequired": {
        "baseAmount": [
          "baseUnit"
        ],
        "baseUnit": [
          "baseAmount"
        ]
      },
      "allOf": [
        {
          "if": {
            "anyOf": [
              {
                "required": [
                  "baseAmount"
                ]
              },
              {
                "required": [
                  "baseUnit"
                ]
              }
            ]
          },
          "then": {
            "properties": {
              "unit": {
                "enum": [
                  "piece",
                  "slice",
                  "slab",
                  "tablespoon",
                  "teaspoon",
                  "cup",
                  "mug",
                  "package",
                  "serving",
                  "handful",
                  "scoop"
                ]
              },
              "amount": {
                "type": "number",
                "exclusiveMinimum": 0,
                "maximum": 100000
              }
            }
          }
        }
      ]
    },
    "step": {
      "oneOf": [
        {
          "type": "string",
          "minLength": 1,
          "maxLength": 1000,
          "pattern": "\\S"
        },
        {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "text": {
              "type": "string",
              "minLength": 1,
              "maxLength": 1000,
              "pattern": "\\S"
            },
            "durationMinutes": {
              "type": "number",
              "exclusiveMinimum": 0,
              "maximum": 10080
            },
            "temperatureC": {
              "type": "number",
              "minimum": 0,
              "maximum": 350
            }
          },
          "required": [
            "text"
          ]
        }
      ]
    },
    "variant": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "id": {
          "type": "string",
          "pattern": "^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$"
        },
        "name": {
          "type": "string",
          "minLength": 1,
          "maxLength": 200,
          "pattern": "\\S"
        },
        "overrides": {
          "type": "array",
          "items": {
            "oneOf": [
              {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "type": {
                    "const": "UPDATE_AMOUNT"
                  },
                  "ingredientId": {
                    "type": "string",
                    "pattern": "^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$"
                  },
                  "amount": {
                    "type": "number",
                    "exclusiveMinimum": 0,
                    "maximum": 100000
                  }
                },
                "required": [
                  "type",
                  "ingredientId",
                  "amount"
                ]
              },
              {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "type": {
                    "const": "REMOVE"
                  },
                  "ingredientId": {
                    "type": "string",
                    "pattern": "^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$"
                  }
                },
                "required": [
                  "type",
                  "ingredientId"
                ]
              }
            ]
          },
          "minItems": 0,
          "maxItems": 100
        }
      },
      "required": [
        "id",
        "name",
        "overrides"
      ]
    },
    "recipe": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "externalId": {
          "type": "string",
          "pattern": "^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$"
        },
        "version": {
          "type": "integer",
          "minimum": 1,
          "maximum": 1000000
        },
        "name": {
          "type": "string",
          "minLength": 1,
          "maxLength": 200,
          "pattern": "\\S"
        },
        "meal": {
          "enum": [
            "breakfast",
            "lunch",
            "dinner",
            "snack"
          ]
        },
        "servings": {
          "type": "number",
          "exclusiveMinimum": 0,
          "maximum": 10000
        },
        "ingredients": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/ingredient"
          },
          "minItems": 1,
          "maxItems": 100
        },
        "steps": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/step"
          },
          "minItems": 0,
          "maxItems": 100
        },
        "source": {
          "$ref": "#/$defs/source"
        },
        "tags": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1,
            "maxLength": 40,
            "pattern": "\\S"
          },
          "minItems": 0,
          "maxItems": 20
        },
        "preparationMinutes": {
          "type": "number",
          "exclusiveMinimum": 0,
          "maximum": 10080
        },
        "variants": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/variant"
          },
          "minItems": 0,
          "maxItems": 20
        },
        "expectedNutrition": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "total": {
              "anyOf": [
                {
                  "$ref": "#/$defs/macros"
                },
                {
                  "type": "null"
                }
              ]
            },
            "perServing": {
              "anyOf": [
                {
                  "$ref": "#/$defs/macros"
                },
                {
                  "type": "null"
                }
              ]
            }
          },
          "required": [
            "total",
            "perServing"
          ]
        },
        "finalWeight": {
          "type": "number",
          "exclusiveMinimum": 0,
          "maximum": 10000000
        },
        "finalVolume": {
          "type": "number",
          "exclusiveMinimum": 0,
          "maximum": 10000000
        }
      },
      "required": [
        "externalId",
        "version",
        "name",
        "meal",
        "servings",
        "ingredients",
        "steps"
      ]
    }
  }
}
```
