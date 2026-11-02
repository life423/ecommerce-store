import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createProductModel, slugify, validateProduct, validImageUrl } from '../src/catalog/product.js'
import { sampleProducts } from '../src/catalog/samples.js'
import { readConfig } from '../src/config.js'

test('products normalize identity and retain exact Stripe-compatible integer cents', () => {
  const data = validateProduct({ ...sampleProducts[0], name: 'Café Garden', slug: '', sku: 'rw-test-01', priceCents: 1999 })
  assert.equal(data.slug, 'cafe-garden')
  assert.equal(data.sku, 'RW-TEST-01')
  assert.equal(data.priceCents, 1999)
  assert.equal(data.currency, 'usd')
  assert.equal(slugify(' A   little garden! '), 'a-little-garden')
})

test('request validation rejects unsafe fields, float prices, stock, URLs, and sale prices', () => {
  for (const patch of [
    { priceCents: 19.99 }, { priceCents: -100 }, { priceCents: '1900' },
    { inventory: 1.5 }, { inventory: -1 }, { currency: 'eur' }, { status: 'unknown' },
    { compareAtPriceCents: 100 }, { $set: { inventory: 100 } }, { images: [] },
    { images: [{ url: 'javascript:alert(1)', alt: 'Unsafe' }] }, { category: 'Unlisted' },
  ]) assert.throws(() => validateProduct({ ...sampleProducts[0], ...patch }), error => error.code === 'VALIDATION_ERROR')
  assert.equal(validImageUrl('https://example.com/photo.jpg'), true)
  assert.equal(validImageUrl('/images/tools.jpg'), true)
  assert.equal(validImageUrl('/images/../../private.jpg'), false)
  assert.equal(validImageUrl('data:image/svg+xml,<svg/>'), false)
})

test('Mongoose independently validates schema invariants', async () => {
  const Product = createProductModel()
  await new Product(validateProduct(sampleProducts[0])).validate()
  await assert.rejects(new Product({ ...sampleProducts[0], priceCents: 129.5 }).validate(), error => error.name === 'ValidationError' && !!error.errors.priceCents)
  await assert.rejects(new Product({ ...sampleProducts[0], compareAtPriceCents: 100 }).validate(), error => error.name === 'ValidationError' && !!error.errors.compareAtPriceCents)
})

test('local catalog editing cannot be enabled in production', () => {
  assert.equal(readConfig({ NODE_ENV: 'development', ENABLE_CATALOG_EDITOR: 'true' }).editorEnabled, true)
  assert.equal(readConfig({ NODE_ENV: 'production' }).editorEnabled, false)
  assert.throws(() => readConfig({ NODE_ENV: 'production', ENABLE_CATALOG_EDITOR: 'true' }), /cannot be enabled/)
  assert.throws(() => readConfig({ ENABLE_CATALOG_EDITOR: 'yes' }), /true or false/)
})
