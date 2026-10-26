import { PRODUCTS } from '../nutrition.js?v=cb88bcb8935dca82e7d48b0b2d139eb14453d8be';
import { copyProduct, searchProducts } from '../product-model.js?v=cb88bcb8935dca82e7d48b0b2d139eb14453d8be';

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
