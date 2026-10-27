// Preview na tym samym origin co produkcja musi mieć własny dziennik i katalog.
const requestedNamespace = globalThis.document?.querySelector('meta[name="benger-storage-namespace"]')?.content;
export const STORAGE_NAMESPACE = ['preview-etap-3', 'preview-etap-4', 'preview-etap-5', 'preview-etap-6','preview-etap-7','preview-etap-8','preview-etap-9','preview-etap-10','preview-etap-11','preview-etap-12','preview-etap-13'].includes(requestedNamespace) ? requestedNamespace : '';
const prefix = STORAGE_NAMESPACE ? `benger.${STORAGE_NAMESPACE}` : 'benger';
export const NUTRITION_STORAGE_KEY = `${prefix}.nutrition.v1`;
export const PRODUCT_DB_NAME = STORAGE_NAMESPACE ? `BengerDB-${STORAGE_NAMESPACE}` : 'BengerDB';
