# Nowy podpis Androida — odzyskiwanie 1.0.6

Właściciel 6 listopada 2026 jawnie zaakceptował nowy podpis, po stwierdzeniu braku poprzedniego prywatnego klucza.

Poprzedni certyfikat APK 1.0.5 fb2651d: `015487cda5f2738abb6e814780f37a6271da720df5284e8a50f4bbb1f5bc7531`.
Nowy certyfikat: `56ab7cec22d03e1a368ec28aa4d01c67e15973675f0fdf28bb8f4d4ba1f3ecf2`.

To nie jest zgodna aktualizacja starego APK: Android odrzuci podmianę przy innym podpisie. Zachowujemy applicationId, origin oraz format danych; nie obchodzimy weryfikacji podpisu.

Przed jednorazową reinstalacją wymagane: pełne testy, podpisany release APK, sprawdzenie odtwarzania pełnego backupu oraz świeży eksport z działającej starej aplikacji. Nie odinstalowywać aplikacji przed zakończeniem tych kroków. Eksport właściciela nie jest fixture i nie wolno publikować go w repozytorium.

Nowy prywatny PKCS12 i hasło przechowywane są poza repozytorium. Osobny ZIP z kluczem, hasłem i opisem jest przeznaczony wyłącznie do prywatnego pobrania przez właściciela. Nie umieszczać go w publicznych gałęziach pobrań APK, release assets, logach ani zwykłej kopii kodu. Zachować co najmniej dwie prywatne kopie, np. w menedżerze haseł i na zaszyfrowanym nośniku. Plik APK zawiera wyłącznie publiczny certyfikat.

Kolejne aktualizacje muszą używać tego nowego klucza. Opcjonalna automatyzacja GitHub Actions korzysta z istniejącego sekretu BENGER_ANDROID_SIGNING_BUNDLE; nie zapisujemy wartości sekretu w Git.
