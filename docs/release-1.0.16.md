# Benger 1.0.16 — czyste nazwy składników z OCR

Punktory listy (np. •, * lub błędnie rozpoznane «) i końcowe separatory ilości (—, – czy →) nie zostają już w nazwie składnika. Przykład: „« marchew — 180 g” daje nazwę „marchew”, 180 g.

Czyszczenie dotyczy wyłącznie brzegów nazwy po istniejącym parserze ilości. Nie zmienia wartości/jednostek, procentów w „mleko 2%” ani wewnętrznych łączników w nazwach. „Odczytano” nadal pokazuje surowy tekst jako pomoc przy sprawdzaniu wyniku. Powiązanie produktu korzysta z istniejącego globalnego resolvera.

Odczytaj screen ponownie po aktualizacji. Wcześniej zapisane przepisy i historyczne wpisy nie są automatycznie przepisywane. Aktualizacja zachowuje podpis, magazyn danych i format backupu. Działa lokalnie/offline; bez zmian backendu lub Workera AI. Zawiera wszystkie wcześniejsze funkcje 1.0.15.
