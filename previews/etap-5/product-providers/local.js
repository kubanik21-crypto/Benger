import { PRODUCTS } from '../nutrition.js?v=9ced9ffbe1b6f10152fb33d5432ccc0a4b8aed43';
import { copyProduct, searchProducts } from '../product-model.js?v=9ced9ffbe1b6f10152fb33d5432ccc0a4b8aed43';

// Zachowany katalog demonstracyjny. Bez dopisywania niezweryfikowanych wartości.
export function getLocalProducts() {
  return PRODUCTS.map(product => copyProduct({
    ...product, source: 'benger', sourceId: product.id, barcode: null, brand: null,
    basis: 'declared', imageUrl: null, quantity: null, updatedAt: null,
  }));
}

export function createLocalProvider() {
  return {
    source: 'benger',
    search: async query => searchProducts(getLocalProducts(), query),
    getById: id => getLocalProducts().find(product => product.id === id) ?? null,
    getProductByBarcode: async () => null,
    list: getLocalProducts,
  };
}
