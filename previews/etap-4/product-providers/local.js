import { PRODUCTS } from '../nutrition.js?v=604eb6266ad289ce68114ab3dc2993b2908f816f';
import { copyProduct, searchProducts } from '../product-model.js?v=604eb6266ad289ce68114ab3dc2993b2908f816f';

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
