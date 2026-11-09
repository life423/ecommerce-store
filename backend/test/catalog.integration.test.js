import assert from 'node:assert/strict'
import { once } from 'node:events'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import mongoose from 'mongoose'
import { createApp } from '../src/app.js'
import { createProductModel, validateProduct } from '../src/catalog/product.js'
import { createHomepageModel } from '../src/catalog/homepage.js'
import { sampleProducts } from '../src/catalog/samples.js'
import { expandedSampleProducts } from '../src/catalog/expanded-samples.js'
import { createStaffModels, hashStaffPassword } from '../src/staff/accounts.js'
import { createOrderModel } from '../src/commerce/order.js'

test('catalog integration with real MongoDB', { skip: !process.env.TEST_MONGO_URI }, async t => {
  // Every run owns a fresh database; it never clears the application database.
  const connection = await mongoose.createConnection(process.env.TEST_MONGO_URI, { dbName: `rewild_test_${randomUUID().replaceAll('-', '')}` }).asPromise()
  t.after(async () => { await connection.dropDatabase(); await connection.close() })
  const Product = createProductModel(connection)
  const HomepageSelection = createHomepageModel(connection)
  const staffModels = createStaffModels(connection)
  const { Staff, StaffSession } = staffModels
  const Order = createOrderModel(connection)
  await Promise.all([Product, HomepageSelection, Order, Staff, StaffSession].map(model => model.init()))
  await Product.create(sampleProducts.map(validateProduct))
  const credentials = { username: 'test-owner', password: 'disposable-integration-test-password' }
  const staff = await Staff.create({ username: credentials.username, passwordHash: await hashStaffPassword(credentials.password) })
  let database = 'connected'
  const server = createApp({ productModel: Product, homepageModel: HomepageSelection, databaseStatus: () => database, staffModels, orderModel: Order }).listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => new Promise(resolve => server.close(resolve)))
  const base = `http://127.0.0.1:${server.address().port}/api`
  const headers = { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' }
  const send = async (path, method = 'GET', body, extra = {}) => {
    const response = await fetch(`${base}${path}`, { method, headers: { ...headers, ...extra }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
    return { status: response.status, data: await response.json(), headers: response.headers }
  }
  let created
  const draft = { ...sampleProducts[0], name: 'Test Garden', sku: 'RW-TEST-NEW', slug: 'test-garden', status: 'draft' }

  await t.test('requires staff sign-in and issues a private session cookie', async () => {
    for (const path of ['/admin/session', '/admin/products', '/admin/orders']) {
      assert.equal((await send(path, 'GET', undefined, { 'X-Catalog-Editor': 'local' })).status, 401)
    }
    assert.equal((await send('/admin/sign-in', 'POST', credentials, { Origin: 'https://attacker.example' })).status, 403)
    assert.equal((await send('/admin/sign-in', 'POST', { ...credentials, password: 'wrong' })).status, 401)
    const signedIn = await send('/admin/sign-in', 'POST', credentials)
    assert.equal(signedIn.status, 200)
    assert.equal(signedIn.data.staff.username, credentials.username)
    assert.match(signedIn.headers.get('set-cookie'), /HttpOnly/i)
    assert.match(signedIn.headers.get('set-cookie'), /SameSite=Strict/i)
    assert.match(signedIn.headers.get('set-cookie'), /Path=\/api\/admin/i)
    assert.equal(signedIn.headers.get('cache-control'), 'no-store')
    headers.Cookie = signedIn.headers.get('set-cookie').split(';')[0]
    assert.equal((await send('/admin/session')).status, 200)
  })

  await t.test('lists, sorts, filters, paginates, and escapes search patterns', async () => {
    const all = await send('/products?sort=price-asc&limit=2')
    assert.equal(all.status, 200)
    assert.equal(all.data.pagination.total, 6)
    assert.equal(all.data.items.length, 2)
    assert.ok(all.data.items[0].priceCents <= all.data.items[1].priceCents)
    assert.equal(all.data.items[0].sku, undefined)
    const kits = await send('/products?category=Growing%20kits&inStock=true')
    assert.equal(kits.data.items.length, 1)
    assert.equal((await send('/products?q=.*')).data.items.length, 0)
    assert.equal((await send('/products?q=balcony')).data.pagination.total > 0, true)
    assert.equal((await send('/products?page=2&limit=2')).data.items.length, 2)
    for (const query of ['limit=10000', 'page=-1', 'q=a&q=b', 'sort=constructor', 'sort=__proto__', 'minPrice=5000&maxPrice=100', 'status=draft', 'q[$ne]=x']) {
      assert.equal((await send(`/products?${query}`)).status, 400, query)
    }
  })
  await t.test('curates products across categories and composes with stock and category filters', async () => {
    const windowsill = await send('/products?space=windowsill')
    assert.equal(windowsill.status, 200)
    assert.deepEqual(windowsill.data.items.map(item => item.slug).sort(), ['the-kitchen-garden-seeds', 'the-windowsill-greens-kit'])

    const available = await send('/products?space=windowsill&inStock=true')
    assert.deepEqual(available.data.items.map(item => item.slug), ['the-kitchen-garden-seeds'])
    const planters = await send('/products?space=balcony&category=Planters')
    assert.deepEqual(planters.data.items.map(item => item.slug), ['the-balcony-grow-box'])

    assert.equal((await send('/products?space=constructor')).status, 400)
    assert.equal((await send('/admin/products?space=balcony')).status, 400)
  })
  await t.test('requires explicit editor access and blocks cross-site requests', async () => {
    assert.equal((await fetch(`${base}/admin/products`)).status, 401)
    assert.equal((await send('/admin/products', 'POST', draft, { Origin: '' })).status, 403)
    assert.equal((await send('/admin/products', 'POST', draft, { Origin: 'https://attacker.example' })).status, 403)
    assert.equal((await send('/admin/products', 'POST', draft, { 'Sec-Fetch-Site': 'cross-site' })).status, 403)
    assert.equal((await send('/admin/products', 'POST', draft, { 'Content-Type': 'text/plain' })).status, 415)
  })
  await t.test('creates a persistent draft and keeps it private', async () => {
    const result = await send('/admin/products', 'POST', draft)
    assert.equal(result.status, 201)
    created = result.data.product
    assert.equal(created.version, 0)
    assert.equal((await send('/products/test-garden')).status, 404)
    assert.equal((await send('/products')).data.pagination.total, 6)
    assert.equal((await send(`/admin/products/${created.id}`)).data.product.sku, draft.sku)
    assert.equal(await Product.countDocuments({ sku: draft.sku }), 1)
  })
  await t.test('validates writes and enforces unique SKU and slug indexes', async () => {
    assert.equal((await send('/admin/products', 'POST', { ...draft, priceCents: 12.34 })).status, 422)
    assert.equal((await send('/admin/products', 'POST', { ...draft, slug: 'different-slug' })).status, 409)
    assert.equal((await send('/admin/products', 'POST', { ...draft, sku: 'DIFFERENT-SKU' })).status, 409)
    assert.equal((await send('/admin/products', 'POST', { ...draft, __v: 99 })).status, 422)
  })
  await t.test('publishes a draft and prevents lost updates', async () => {
    const result = await send(`/admin/products/${created.id}`, 'PUT', { ...draft, status: 'active', version: created.version })
    assert.equal(result.status, 200)
    assert.equal(result.data.product.version, 1)
    assert.equal((await send('/products/test-garden')).status, 200)
    assert.equal((await send(`/admin/products/${created.id}`, 'PUT', { ...draft, version: 0 })).status, 409)
    assert.equal((await send(`/admin/products/${created.id}`, 'PUT', draft)).status, 422)
    assert.equal((await send('/admin/products/bad-id', 'PUT', draft)).status, 404)
  })
  await t.test('archives without deleting the stored product', async () => {
    assert.equal((await send(`/admin/products/${created.id}`, 'PUT', { ...draft, status: 'archived', version: 1 })).status, 200)
    assert.equal((await send('/products/test-garden')).status, 404)
    assert.equal((await Product.findById(created.id)).status, 'archived')
    const info = await send('/catalog')
    assert.equal(info.data.categories.reduce((sum, item) => sum + item.count, 0), 6)
  })
  await t.test('pins one staff-selected homepage product and falls back when it cannot be bought', async () => {
    const path = '/admin/homepage-product'
    const catalogPath = '/products?sort=featured&inStock=true&limit=1'
    const hero = async () => (await send('/homepage-product')).data.product
    const automatic = (await send(catalogPath)).data.items[0]
    const choices = (await send('/admin/products?status=active&inStock=true')).data.items.filter(item => item.id !== automatic.id)
    const [first, second] = choices
    const firstChoice = { productId: first.id }

    assert.deepEqual(await hero(), automatic)
    assert.equal((await send(path, 'PUT', firstChoice, { Cookie: '' })).status, 401)
    assert.equal((await send(path, 'PUT', firstChoice, { Origin: 'https://attacker.example' })).status, 403)
    assert.equal((await send(path, 'PUT', { productId: { $ne: null } })).status, 422)
    assert.equal((await send(path, 'PUT', { productId: created.id })).status, 422)
    assert.equal((await send(path, 'PUT', firstChoice)).status, 200)
    assert.equal((await hero()).id, first.id)
    assert.equal((await hero()).sku, undefined)
    assert.equal((await send(catalogPath)).data.items[0].id, automatic.id)

    assert.equal((await send(path, 'PUT', { productId: second.id })).status, 200)
    assert.equal((await hero()).id, second.id)
    await Product.updateOne({ _id: second.id }, { inventory: 0 })
    assert.deepEqual((await send(path)).data.selection, { id: second.id, name: second.name, available: false })
    assert.equal((await hero()).id, automatic.id)
    assert.equal((await send(path, 'PUT', { productId: second.id })).status, 422)
    await Product.updateOne({ _id: second.id }, { inventory: second.inventory })
    assert.equal((await hero()).id, second.id)
    await Product.updateOne({ _id: second.id }, { status: 'archived' })
    assert.equal((await hero()).id, automatic.id)
    await Product.updateOne({ _id: second.id }, { status: 'active' })

    assert.equal((await send(path, 'PUT', { productId: null })).status, 200)
    assert.deepEqual((await send(path)).data, { selection: null })
    assert.equal((await hero()).id, automatic.id)
  })
  await t.test('recommends live complements and fills unavailable slots without duplicates', async () => {
    const suggested = ['genovese-basil-seeds', 'indoor-potting-blend', 'cream-ledge-watering-can']
    await Product.create(expandedSampleProducts.filter(item => suggested.includes(item.slug)).map(validateProduct))

    const path = '/products/the-balcony-grow-box/related'
    const related = await send(path)
    assert.equal(related.status, 200)
    assert.deepEqual(related.data.items.map(item => item.slug), suggested)
    assert.ok(related.data.items.every(item => item.inventory > 0 && item.sku === undefined))

    const fromBlend = await send('/products/indoor-potting-blend/related')
    assert.equal(fromBlend.data.items.length, 3)
    assert.ok(fromBlend.data.items.every(item => item.slug !== 'indoor-potting-blend'))

    await Product.updateOne({ slug: 'indoor-potting-blend' }, { status: 'archived' })
    await Product.updateOne({ slug: 'cream-ledge-watering-can' }, { inventory: 0 })
    const fallback = await send(path)
    assert.deepEqual(fallback.data.items.map(item => item.slug), ['genovese-basil-seeds', 'the-everyday-tool-set', 'the-slow-pour'])
    assert.equal((await send('/products/indoor-potting-blend/related')).status, 404)
  })
  await t.test('lists and filters test orders without exposing guest checkout credentials', async () => {
    const product = await Product.findOne({ sku: sampleProducts[0].sku }).lean()
    for (const state of ['open', 'paid']) {
      await Order.create({
        _id: randomUUID(), attemptId: randomUUID(), requestHash: 'request', tokenHash: 'private-hash',
        returnToken: 'private-token', checkoutUrl: 'https://checkout.stripe.com/private', sessionId: `private-${state}`,
        items: [{ productId: product._id, name: product.name, slug: product.slug, quantity: 1, unitPriceCents: 6800 }],
        totalCents: 6800, state, ...(state === 'paid' ? { paidAt: new Date() } : {}),
      })
    }
    const all = await send('/admin/orders')
    assert.equal(all.data.total, 2)
    const paid = await send('/admin/orders?state=paid')
    assert.equal(paid.status, 200)
    assert.equal(paid.data.total, 1)
    assert.equal(paid.data.items[0].state, 'paid')
    assert.ok(paid.data.items[0].paidAt)
    assert.deepEqual(paid.data.items[0].items, [{ name: product.name, quantity: 1, unitPriceCents: 6800 }])
    assert.doesNotMatch(JSON.stringify(all.data), /private-|tokenHash|sessionId|checkoutUrl/)
    assert.equal((await send('/admin/orders?state=unknown')).status, 400)
    assert.equal((await send('/admin/orders', 'POST', {})).status, 404)
  })
  await t.test('rejects signed-out, expired, and disabled staff sessions', async () => {
    assert.equal((await send('/admin/sign-out', 'POST')).status, 200)
    assert.equal((await send('/admin/orders')).status, 401)
    assert.equal(await StaffSession.countDocuments(), 0)

    async function signInAgain() {
      const response = await send('/admin/sign-in', 'POST', credentials)
      assert.equal(response.status, 200)
      headers.Cookie = response.headers.get('set-cookie').split(';')[0]
    }
    await signInAgain()
    await StaffSession.updateMany({}, { expiresAt: new Date(Date.now() - 1000) })
    assert.equal((await send('/admin/products')).status, 401)
    await signInAgain()
    await Staff.updateOne({ _id: staff._id }, { active: false })
    assert.equal((await send('/admin/orders')).status, 401)
  })
  await t.test('fails clearly instead of buffering queries when MongoDB is unavailable', async () => {
    database = 'disconnected'
    assert.equal((await send('/products')).status, 503)
    assert.equal((await send('/ready')).status, 503)
  })
})
