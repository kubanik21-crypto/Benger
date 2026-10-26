// Preview na tym samym origin co produkcja musi mieć własny dziennik, notatki i katalog.
const requestedNamespace = globalThis.document?.querySelector('meta[name="benger-storage-namespace"]')?.content;
export const STORAGE_NAMESPACE = ['preview-etap-3', 'preview-etap-4', 'preview-etap-5'].includes(requestedNamespace) ? requestedNamespace : '';
const prefix = STORAGE_NAMESPACE ? `benger.${STORAGE_NAMESPACE}` : 'benger';
export const NUTRITION_STORAGE_KEY = `${prefix}.nutrition.v1`;
export const NOTES_STORAGE_KEY = `${prefix}.meals.v1`;
export const PRODUCT_DB_NAME = STORAGE_NAMESPACE ? `BengerDB-${STORAGE_NAMESPACE}` : 'BengerDB';
