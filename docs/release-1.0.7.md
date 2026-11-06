# Benger 1.0.7 — skanowanie przy wyborze składników

Przycisk „Zeskanuj produkt” jest dostępny bez opuszczania edytowanego przepisu: przy dodawaniu i uzupełnianiu składników, zamianie produktu w przepisie oraz dostosowywaniu porcji przed wpisem do dziennika. Jest też dostępny w pozycjach propozycji posiłku z tekstu lub głosu. Katalog i ręczne budowanie posiłku zachowują dotychczasowy skaner.

Skanowanie korzysta z istniejącego BarcodeDetector/ZXing i ProductRepository: własny kod → cache → OFF. Kod można również wpisać ręcznie. Nie ma drugiego resolvera ani nowych źródeł makro. Ilość trzeba sprawdzić i świadomie zatwierdzić; g/ml nie są przeliczane bez danych.

Kamera uruchamia się wyłącznie po kliknięciu. Po odczycie, anulowaniu, zmianie ekranu lub przejściu aplikacji do tła jest zatrzymywana. Anulowanie zachowuje składnik i edytowaną ilość; spóźniony wynik nie jest stosowany do zamkniętego panelu.

Backup pozostaje v8, dane i magazyny nie zmieniają się. Android używa tego samego nowego podpisu co 1.0.6: instalacja na 1.0.6 jest zwykłą aktualizacją, bez usuwania aplikacji. Przejście ze starego podpisu 1.0.5 nadal wymaga zabezpieczenia świeżego pełnego backupu i jednorazowej reinstalacji.

Bez zmian Workera AI i produkcyjnego main.
