# Benger 1.0.0 — release candidate

Benger to lokalna aplikacja PWA do żywienia, przepisów, progresu i treningu. Wersja 1.0 obejmuje dziennik żywieniowy, głos/tekst/skaner, katalog produktów i porcje domowe, przepisy i ich porcje w dzienniku, cele i Dashboard, masę/ciśnienie/obwody/zdjęcia, trening, Mobility, kalendarz, Exercise Guide, PWA/offline i backup.

## Exercise Guide

60/60 wbudowanych ćwiczeń ma polskie ustawienie, wykonanie, cue, błędy i oddech. 54 lekkie sceny ruchu korzystają z tych samych prymitywów sylwetki i sprzętu; nie są 54 oddzielnymi plikami SVG. Ilustracje powstają lokalnie na żądanie. Tekst jest niezależny od ilustracji. SVG ma title/desc, kolory motywu i etykiety START/KONIEC.

Instrukcja jest dostępna z biblioteki, planu/edytora, aktywnego treningu i Mobility. Native dialog nie zapisuje danych i nie przebudowuje serii. Odpoczynek, czas ćwiczenia i całkowity czas treningu nadal biegną. Po zamknięciu wraca focus/scroll; kg/reps/RIR pozostają. Własne ćwiczenia pokazują wyłącznie własną notatkę oraz sprzęt/mode. Notatki użytkownika/fizjoterapeuty są wyświetlane osobno, dosłownie.

## Stabilność danych i aktualizacja

Bazą jest sprawdzony zielony post-merge `origin/main`:
`f960d296e82d2e8d088b7f4fca61c37fb41f9597`.

Produkcja pozostaje pod https://kubanik21-crypto.github.io/Benger/ z kluczami `benger.nutrition.v1`, `BengerDB` i `BengerDB-progress`. Nie przenosimy profilu do nowego namespace. Audyt obecnego gh-pages potwierdził starszy statyczny ROOT oraz oddzielne katalogi preview. Profile preview nie są produkcją i nie są automatycznie scalane z ROOT-em; jeśli zawierają dane do zachowania w produkcji, można przenieść je dotychczasowym eksportem/importem v7 przed wycofaniem ich adresów. Cleanup usuwa tylko pliki statyczne, nie ich localStorage/IndexedDB. Guide jest statyczny; backup pozostaje **v7**, import v1–v7 jest zachowany.

Test aktualizacji uruchamia przypięty rzeczywisty kod/worker bazy, tworzy bogaty profil z diary Product+Recipe, custom/usage/favorites/porcjami, recipes/history/draft, celami, settings, pomiarami/zdjęciem, planami/rutynami/custom exercise, calendar rules/exception, completed i active workout/Mobility ze scheduled references oraz timerem. Następnie instaluje produkcyjny artifact 1.0, ręcznie aktywuje worker i porównuje pełny backup. Motyw i onboarding pozostają poprawne, Guide działa także offline.

## Release pipeline

`package.json` jest źródłem wersji, `app-version.js` generuje build. `build:web` tworzy czysty artefakt z dokładnym SHA, manifestem, metadanymi wydania, kompletnym SW cache i notices. Produkcja nie zawiera diagnostycznych HTML, laboratoriów, fixture ani namespace/bannerów wersji etapowych. Pozostają w repo dla testów i rozwoju.

Workflow `Deploy production` uruchamia się po zakończeniu `Tests`, wyłącznie dla sukcesu normalnego push/merge na main w tym repo. Pobiera dokładny przetestowany SHA. Weryfikuje bieżący main przed buildem, a publisher powtarza kontrolę przed publikacją. Serializacja workflow i nie-forcowany push chronią przed nadpisaniem nowszego wydania przez starszy przebieg. Jeśli SHA się zdezaktualizował, deployment jest pomijany. PR/fork/release branch/failing Tests nie mogą publikować.

Publisher przygotowuje osobny detached worktree gh-pages, zastępuje wyłącznie opublikowane statyczne pliki czystym ROOT-em i usuwa stare katalogi preview. Nie dotyka źródeł ani danych użytkownika. Test dry-run używa tymczasowego lokalnego repo/bare remote, potwierdzając cleanup i brak push publikacji. W tej gałęzi nie wykonujemy wdrożenia ROOT, PR, merge ani taga. Po finalnym merge i zielonym Tests produkcja publikuje się automatycznie; tag v1.0.0 jest osobną czynnością wydającego.

Ostatnia kontrola main jest bezpośrednio przed push. Przy zmianie main w bardzo małym oknie po tej kontroli nie da się transakcyjnie zablokować dwóch niezależnych refów przez zwykłe Pages; serializacja i fast-forward chronią jednak przed opublikowaniem starszego A **po** nowszym wdrożeniu B. Konflikt z innym writerem gh-pages kończy się bezpiecznym błędem push, nie force overwrite. Nie należy dalej publikować archiwalnych gałęzi etapowych.

## PWA, bezpieczeństwo i licencje

Manifest zachowuje id/start_url/scope `./`, standalone, rzeczywiste 192/512 PNG i maskable safe-zone. Root podkatalogu /Benger/ zachowuje tożsamość instalacji. Automatyczne testy nie udają systemowego UI instalacji Androida.

Service worker cache jest wersjonowany i ograniczony do własnego scope. Guide, shell i dane lokalne działają offline. Aktualizacja jest ręczna, nie wymusza reloadu w trakcie edycji. Stare zainstalowane preview mogą zachować własny cache offline po usunięciu ich plików z gh-pages; nie kasujemy zdalnie danych ani rejestracji przeglądarki.

Nowe teksty są renderowane przez textContent/SVG DOM. Import zachowuje safeTree, limity i rollback. Aparat/mikrofon pozostają po jawnej akcji. Brak telemetry, kont, naszego backendu i synchronizacji. Speech może korzystać z usługi przeglądarki, a OFF z sieci przy wyszukiwaniu/barcode/zdjęciach produktów. Nie obiecujemy, że nic nigdy nie opuszcza urządzenia.

Audyt notices: OFF ODbL/DbCL/zdjęcia CC BY-SA, USDA public domain/CC0, ZXing Browser MIT, ZXing Library Apache-2.0, ts-custom-error MIT. To rzeczywiście używane źródła/dependency; Guide dodaje wyłącznie własną treść i schematy, bez dodatkowych licencji obrazów.

## Znane ograniczenia

- Dane lokalne, bez synchronizacji urządzeń; regularny backup jest ważny.
- Speech i zewnętrzne produkty bez cache mogą wymagać internetu.
- Kalendarz nie ma powiadomień i obsługuje raz / wybrane dni tygodnia.
- Guide jest schematyczną instrukcją, nie indywidualną poradą trenerską lub medyczną.
