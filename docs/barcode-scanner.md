# Aparat i kody kreskowe — Etap 6

`barcode-scanner.js` jest adapterem kamery, niezależnym od produktów. UI przekazuje wynik do istniejącego `ProductRepository.getProductByBarcode()`:

kamera → walidacja / rozwinięcie UPC-E → własny produkt → cache → OFF Product API → brak wyniku → formularz z wpisanym kodem.

Nie ma text search dla dokładnego kodu. Obsługiwane formaty: EAN-13, EAN-8, UPC-A i UPC-E. UPC-E jest rozwijany do UPC-A przed sprawdzeniem cyfry kontrolnej i lookupem; prefiksy zer są porównywane przez wspólny barcodeKey.

## Native i fallback

Najpierw sprawdzamy BarcodeDetector i getSupportedFormats. Natywny adapter wybieramy, gdy obsługuje cztery wymagane formaty. W przeciwnym razie dynamicznie ładujemy lokalny UMD `@zxing/browser` **0.2.1**, 441 121 bajtów. Nie ma runtime CDN. Bundle pochodzi z przypiętej paczki npm; integralność tarballa SHA-512 zweryfikowano z dist.integrity. W repo zachowano MIT Browser, Apache-2.0 Library i MIT ts-custom-error; są też publikowane obok aplikacji.

Samo precache'owanie pliku dla offline nie wykonuje jego JavaScript. Przeglądarka z odpowiednim natywnym detectorem nie ładuje go do środowiska wykonania. ZXing jest ograniczony hintami do czterech formatów. Zwykłe błędy klatki NotFound/Checksum/Format są rozpoznawane przez getKind i nie kończą skanowania. Nie zapisujemy wideo, zdjęć ani klatek w storage i nie wysyłamy ich na serwer.

## Cykl życia i prywatność

Kamera uruchamia się tylko po kliknięciu „Skanuj kod”, preferuje `facingMode: environment`, `audio: false`. Pokazujemy wideo, ramkę i widoczny przycisk Anuluj. Pierwszy prawidłowy wynik unieważnia generację sesji i zatrzymuje detekcję, controls oraz wszystkie tracks. To zapobiega wielokrotnym lookupom tego samego kodu.

Stream zatrzymujemy również po Anuluj/Escape, zamknięciu dialogu, pagehide, schowaniu strony, błędzie i 45 sekundach bez wyniku. Spóźniony getUserMedia po anulowaniu natychmiast zamyka uzyskany stream. Komunikaty obejmują odmowę dostępu, brak aparatu, zajęty aparat, niedostępny fallback i brak odczytu. Zawsze pozostaje ręczne wpisanie kodu. Latarka nie jest jeszcze implementowana.

## Offline

Natywna detekcja lub precache'owany ZXing działa lokalnie. Własny lub zapisany OFF produkt rozwiązuje się bez requestu. Gdy kodu nie ma lokalnie, UI wyjaśnia potrzebę połączenia i pozwala utworzyć własny produkt. Zdjęcia OFF nie są wymagane do działania.

## Diagnostyka i test Samsunga

`barcode-test-lab.html`: dostępność BarcodeDetector, formaty, faktycznie wybrany silnik, zgoda kamery, kod, źródło/status odpowiedzi i czas. Bez zapisu obrazu. W testach używamy mocka detectora z prawdziwym MediaStream z canvas oraz realnego vendored ZXing odczytującego piksele EAN-13. Nie zastępuje to testu ostrości, oświetlenia i tylnej kamery telefonu.

Sprawdź na Samsungu: dobry nadruk EAN-13, krótki EAN-8, UPC, odmowę zgody, Anuluj, przejście do innej aplikacji, brak internetu i kod własnego produktu. Dla UPC-E sprawdź też poprawność rozwiniętego UPC-A. Odczyt syntetycznych pikseli w CI nie dowodzi skuteczności na każdym fizycznym opakowaniu.
