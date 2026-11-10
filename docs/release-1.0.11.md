# Benger 1.0.11 — Realistyczna arena

Nowe oryginalne grafiki zastępują schematyczne sylwetki: realistyczni fikcyjni zawodnicy w zielonych i bursztynowych strojach, perspektywa hali, odbicia na parkiecie, szklana tablica i pięć scen od rozgrzewki do meczu przy pełnych trybunach. Poziomy i punktacja pozostają zgodne z 1.0.10; istniejąca historia nie jest przeliczana według nowych zasad.

Atlas wszystkich pięciu scen jest zapisany lokalnie jako WebP 1024 × 1536 (około 296 KiB). Nie ma sieciowego pobierania grafik, nowych usług ani zależności. Grafiki powstały na potrzeby Bengera za pomocą generowania obrazów; aplikacja nie wywołuje AI. Postacie są fikcyjne, bez celowego wykorzystania wizerunku prawdziwego sportowca lub logotypu zespołu. Pochodzenie i hash: `docs/assets/basketball-arena.md`.

Widżet: większy nacisk na tablicę wyniku, czytelniejsza informacja o przewadze, oprawa zgodna z motywem telefonu oraz przyciski skrótów. Duży układ przeznacza pozostałe miejsce na arenę, a kompaktowy mieści podstawowe dane i skróty. Nagłówek nadal ma datę i polski dzień tygodnia.

Dotknięcie boiska otwiera większy podgląd Twojej aktualnej areny. Można też użyć „Zobacz swoją arenę” w Więcej → Ustawienia. Podgląd ma krótkie, jednorazowe wejście; respektuje ograniczenie ruchu i nie zmienia wyniku ani danych. Zamknięcie wraca do aplikacji. W widżecie scena zmienia się wraz z poziomem; mała zmiana kadru następuje tylko przy zmianie punktów. Nie ma ciągłego renderowania, serwisu ani timera animacji w tle.

Tylko aktualizacja APK. Ten sam podpis, applicationId i magazyn danych. Bez reinstalacji i bez zmiany backupu v8. Historia, cele, posiłki i treningi pozostają w istniejących źródłach. Produkcyjny frontend i Worker pozostają bez zmian.
