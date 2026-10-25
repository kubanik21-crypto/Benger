import { PRODUCTS } from '../nutrition.js?v=0dd26ac7e3d5bd2730a15f6f4680b1b2cf734d65';
import { copyProduct, searchProducts } from '../product-model.js?v=0dd26ac7e3d5bd2730a15f6f4680b1b2cf734d65';

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
