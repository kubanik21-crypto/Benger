# Benger

Pierwszy prototyp osobistego dziennika jedzenia na Androida.

## Uruchomienie

Wymaga Node.js 22 lub nowszego. Bez zależności do instalacji.

```sh
cd /workspace/Benger
npm start
```

Domyślny port: 3000; można ustawić zmienną PORT. Na telefonie aplikację należy udostępnić przez HTTPS. W Chrome na Androidzie można dodać stronę do ekranu głównego. Nie skonfigurowano jeszcze publicznego hostingu.

## Obsługa

Wybierz datę i rodzaj posiłku, dotknij mikrofonu i opowiedz po polsku. Sprawdź transkrypcję i zapisz. Gdy dyktowanie przeglądarki nie działa, użyj mikrofonu klawiatury Androida w polu notatki. Możesz usuwać wpisy i eksportować dziennik do JSON.

Dane są przechowywane w localStorage wyłącznie w tej przeglądarce i pod danym adresem strony. Wyczyszczenie danych przeglądarki usuwa dziennik; eksportuj kopie. Brak synchronizacji i importu. Dyktowanie może przesyłać dźwięk do usługi dostawcy przeglądarki, zależnie od jej implementacji. Nie jest gwarantowane działanie offline.

To prototyp notatnika głosowego: nie rozpoznaje jeszcze produktów ani porcji i nie oblicza kalorii. Mikrofon wymaga zgody, obsługi Web Speech API i bezpiecznego połączenia. Działanie mikrofonu na fizycznym telefonie pozostaje do weryfikacji.
