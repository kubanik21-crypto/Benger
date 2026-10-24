export class ProductError extends Error {
  constructor(code, retryAfterMs = 0) {
    super(code);
    this.name = 'ProductError';
    this.code = code;
    this.retryAfterMs = retryAfterMs;
  }
}

export function productErrorMessage(error) {
  return {
    query: 'Wpisz przynajmniej 3 znaki nazwy produktu.',
    barcode: 'Podaj prawidłowy kod EAN/UPC: 8, 12, 13 lub 14 cyfr wraz z cyfrą kontrolną.',
    'rate-limit': 'Open Food Facts ogranicza liczbę zapytań. Odczekaj chwilę i spróbuj ponownie.',
    throttle: 'Zapytania wysyłamy z przerwą. Odczekaj kilka sekund przed kolejnym wyszukaniem.',
    timeout: 'Open Food Facts nie odpowiedziało na czas. Pokazuję produkty zapisane lokalnie.',
    offline: 'Brak połączenia. Pokazuję produkty zapisane lokalnie.',
    network: 'Nie można połączyć się z Open Food Facts. Pokazuję produkty zapisane lokalnie.',
    server: 'Open Food Facts jest chwilowo niedostępne. Pokazuję produkty zapisane lokalnie.',
    response: 'Nie udało się odczytać danych Open Food Facts. Pokazuję produkty zapisane lokalnie.',
    cancelled: 'Wyszukiwanie zostało anulowane.',
  }[error?.code] ?? 'Nie udało się pobrać produktów. Spróbuj ponownie.';
}
