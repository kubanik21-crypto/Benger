import { readdirSync } from 'node:fs';
// Jawna lista publikacji: bez serwera, testów, fixture, .git i konfiguracji.
export const PUBLIC_ASSETS = [
  'barcode-test-lab.html','catalog-diagnostics.html','pwa-diagnostics.html','stage6-diagnostics.js',
  'portion-diagnostics.html','portion-test-lab.html','portion-diagnostics.js','recipe-test-lab.html','recipe-diagnostics.html','recipe-diagnostics.js','navigation.js','diary-history.js','recipe-id.js','recipe-model.js','recipe-nutrition.js','recipe-repository.js','recipe-understanding.js','recipe-session.js','recipe-ui.js','recipe-resolver.js','recipe-portion-resolver.js','recipe-proposal-ui.js','recipe-diary-ui.js','diary-entry.js','storage-health.js','recipe-diary-test-lab.html','recipe-diary-test-lab.js','backup.js','backup-ui.js','portion-model.js','portion-resolver.js','portion-references.js','portion-repository.js','portion-settings-ui.js','product-providers/usda-portions.js','product-providers/source-portions.js',
  'service-worker.js','sw-assets.js','pwa.js','barcode-scanner.js','barcode-utils.js','custom-product-ui.js',
  'icons/icon-192.png','icons/icon-512.png','vendor/zxing/zxing-browser-0.2.1.min.js',
  'vendor/zxing/LICENSE-browser.txt','vendor/zxing/LICENSE-library.txt','vendor/zxing/LICENSE-ts-custom-error.txt',
  'product-providers/usda.js','product-providers/custom.js',
  ...readdirSync(new URL('../data/usda/',import.meta.url)).filter(file=>/^(?:index|metadata|chunk-\d{4}|portion-index|portion-\d{4})\.json$/.test(file)).sort().map(file=>'data/usda/'+file),
  'index.html', 'style.css', 'app.js', 'app-storage.js', 'nutrition.js',
  'manifest.webmanifest', 'product-model.js', 'product-errors.js', 'product-cache.js',
  'product-repository.js', 'product-search-ui.js', 'legacy-product-references.js',
  'product-providers/open-food-facts.js', 'product-providers/off-http.js', 'product-providers/off-search.js',
  'speech-diagnostics.html', 'speech-diagnostics.js', 'speech-recognition.js', 'polish-numbers.js', 'meal-understanding.js', 'meal-proposal-ui.js', 'voice-entry.js',
  'transcript-normalizer.js','food-tokenizer.js','food-segmentation.js','food-language.js','product-variants.js','analysis-history.js','voice-corpus.js','voice-test-lab.html','voice-test-lab.js',
  'food-query.js', 'product-resolver.js', 'meal-resolution.js', 'off-diagnostics.html', 'off-diagnostics.js', 'off-search-diagnostics.js',
];
