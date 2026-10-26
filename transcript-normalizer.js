import { normalizeText } from './product-model.js';
import { normalizeFoodQuery } from './food-query.js';
import { replaceSpokenNumbers } from './polish-numbers.js';

// Normalizacja językowa, bez produktów, makro, domyślnych porcji i utraty oryginału.
export function normalizeTranscript(rawTranscript) {
  if (typeof rawTranscript !== 'string') throw new TypeError('Transkrypcja musi być tekstem.');
  if (rawTranscript.length > 2000) throw new RangeError('Transkrypcja może mieć najwyżej 2000 znaków.');
  let text = normalizeText(rawTranscript.replace(/\r?\n/g, ';')).replace(/[–−]/g, '-');
  text = replaceSpokenNumbers(text);
  text = normalizeFoodQuery(text);
  text = text.replace(/\b(\d+(?:[.,]\d+)?)\s+proc\b\.?/g, (_, value) => `${Number(value.replace(',', '.'))}%`);
  text = text.replace(/\b(\d+(?:[.,]\d+)?)\s*(gramow|gramy|grama|gram|mililitrow|mililitry|mililitra|mililitr)\b/g,
    (_, value, unit) => `${value} ${unit.startsWith('gram') ? 'g' : 'ml'}`);
  // „mili” ma sens tylko przy jawnej ilości i rozpoznawalnej nazwie płynu w tej samej frazie.
  text = text.replace(/\b(\d+(?:[.,]\d+)?)\s+(mili|mil)\b(?=\s+(?:mleka|mleko|kefiru|kefir|wody|woda|soku|sok|napoju|napoj)\b)/g, '$1 ml');
  text = text.replace(/\b((?:mleka|mleko|kefiru|kefir|wody|woda|soku|sok|napoju|napoj)\b[^,;]*?)\s+(\d+(?:[.,]\d+)?)\s+(mili|mil)\b/g, '$1 $2 ml');
  return { rawTranscript, normalizedTranscript: text };
}
