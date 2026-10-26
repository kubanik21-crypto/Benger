import { PRODUCTS } from '../nutrition.js?v=a2b2ae0f9c17630acc9006699ed8d0be6c8b098f';
import { copyProduct, searchProducts } from '../product-model.js?v=a2b2ae0f9c17630acc9006699ed8d0be6c8b098f';

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
