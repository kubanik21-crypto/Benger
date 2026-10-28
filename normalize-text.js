export function normalizeText(value) {
  return String(value ?? '').normalize('NFKD').replace(/\p{M}/gu, '').replace(/ł/g, 'l')
    .replace(/Ł/g, 'L').toLowerCase().replace(/\s+/g, ' ').trim();
}
