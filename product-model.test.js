import test from 'node:test';
import assert from 'node:assert/strict';
import { barcodeKey, copyProduct, deduplicateProducts, isProduct, normalizeBarcode, safeImageUrl, searchProducts } from './product-model.js';
import { getTestProducts } from './tests/fixtures/nutrition-products.mjs';
import { calculatePortion } from './nutrition.js';

test('fixtures custom mają pełny model i niezależne kopie', () => {
  const products = getTestProducts();
  assert.equal(products.length, 4);
  assert.ok(products.every(isProduct));
  assert.equal(products[0].id, 'custom:test-oats');
  assert.deepEqual(calculatePortion(products[0], 50), { kcal: 185, protein: 6.5, fat: 3.5, carbs: 30 });
  assert.equal(products[3].unit, 'ml');
  assert.equal(products[0].barcode, null);
  assert.equal(products[0].imageUrl, null);
  products[0].per100.kcal = 1;
  assert.equal(getTestProducts()[0].per100.kcal, 370);
});

test('EAN/UPC/GTIN zachowują zera i weryfikują sumę kontrolną', () => {
  for (const barcode of ['3017620422003', '5901234123457', '01234565', '036000291452', '0036000291452']) {
    assert.equal(normalizeBarcode(barcode), barcode);
  }
  assert.equal(normalizeBarcode('590 1234 123457'), '5901234123457');
  assert.equal(barcodeKey('036000291452'), barcodeKey('0036000291452'));
  for (const barcode of ['', 'abc', '3017620422004', '123', null, 5901234123457, '123456789012345678']) assert.equal(normalizeBarcode(barcode), null);
});

test('deduplikacja po kodzie i źródle nie scala różnych kodów o tej samej nazwie', () => {
  const product = getTestProducts()[0];
  const first = { ...product, id: 'off:1', source: 'openfoodfacts', sourceId: '1', barcode: '036000291452' };
  const same = { ...first, id: 'other:2', source: 'other', sourceId: '2', barcode: '0036000291452' };
  const other = { ...first, id: 'off:3', sourceId: '3', barcode: '5901234123457' };
  assert.equal(deduplicateProducts([first, same, other, product, product]).length, 3);
});

test('walidacja odrzuca NaN, nieskończoność, niepełne i nierealne dane', () => {
  const product = getTestProducts()[0];
  for (const value of [NaN, Infinity, -1, null, undefined, '', '50', true, 1001]) {
    assert.equal(isProduct({ ...product, per100: { ...product.per100, kcal: value } }), false);
  }
  assert.equal(isProduct({ ...product, per100: { kcal: 500, protein: 70, fat: 70, carbs: 70 } }), false);
  assert.throws(() => copyProduct({ ...product, name: '' }));
  const clone = copyProduct({ ...product, hugeRawResponse: 'not copied' });
  assert.equal(Object.hasOwn(clone, 'hugeRawResponse'), false);
});

test('URL zdjęcia jest ograniczony do HTTPS i serwera zdjęć OFF', () => {
  const valid = 'https://images.openfoodfacts.org/images/products/123/front_pl.200.jpg';
  assert.equal(safeImageUrl(valid), valid);
  for (const url of ['javascript:alert(1)', 'data:image/png;base64,a', 'https://evil.example/a.jpg', 'http://images.openfoodfacts.org/images/products/a.jpg', 'https://user:pass@images.openfoodfacts.org/images/products/a.jpg']) assert.equal(safeImageUrl(url), null);
});

test('lokalne wyszukiwanie uwzględnia polskie znaki, markę i limit', () => {
  assert.equal(searchProducts(getTestProducts(), 'PLATKI')[0].id, 'custom:test-oats');
  assert.equal(searchProducts(getTestProducts(), 'nieznane').length, 0);
  assert.equal(searchProducts(getTestProducts(), '', 2).length, 2);
  const branded = { ...getTestProducts()[3], brand: 'Łaciate' };
  assert.equal(searchProducts([branded], 'mleko laciate 2%').length, 1);
});

test('nie zakłada gęstości 1 g/ml przy walidacji wartości na 100 ml', () => {
  const liquid = { ...getTestProducts()[3], per100: { kcal: 450, protein: 0, fat: 0, carbs: 110 } };
  assert.equal(isProduct(liquid), true);
  assert.equal(calculatePortion(liquid, 200).carbs, 220);
  assert.equal(isProduct({ ...liquid, unit: 'g' }), false);
});
test('unreasonable per100ml values are rejected without enforcing density1',()=>{const p={...getTestProducts()[3],per100:{kcal:1e7,protein:0,fat:0,carbs:0}};assert.equal(isProduct(p),false);});
