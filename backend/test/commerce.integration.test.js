import assert from 'node:assert/strict'
import { once } from 'node:events'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import mongoose from 'mongoose'
import Stripe from 'stripe'
import { createApp } from '../src/app.js'
import { createProductModel, validateProduct } from '../src/catalog/product.js'
import { createOrderModel } from '../src/commerce/order.js'
import { createCommerce } from '../src/commerce/service.js'
import { readConfig } from '../src/config.js'
import { sampleProducts } from '../src/catalog/samples.js'

test('payment configuration rejects live keys and unsafe redirect origins', () => {
  for (const key of ['sk_live_never', 'rk_live_never', 'pk_test_never', 'not-a-key']) assert.throws(() => readConfig({ STRIPE_SECRET_KEY: key }), /test-mode/)
  for (const origin of ['https://example.com/path', 'http://example.com', 'https://user:password@example.com', 'https://example.com/']) assert.throws(() => readConfig({ STORE_URL: origin }), /STORE_URL/)
  assert.equal(readConfig({ STRIPE_SECRET_KEY: 'sk_test_placeholder', STORE_URL: 'http://localhost:5173' }).storeUrl, 'http://localhost:5173')
})

test('commerce integration with MongoDB and a deterministic Stripe transport', { skip: !process.env.TEST_MONGO_URI }, async t => {
  const connection = await mongoose.createConnection(process.env.TEST_MONGO_URI, { dbName: `rewild_commerce_test_${randomUUID().replaceAll('-', '')}` }).asPromise()
  t.after(async () => { await connection.dropDatabase(); await connection.close() })
  const Product = createProductModel(connection), Order = createOrderModel(connection)
  await Promise.all([Product.init(), Order.init()])
  await Product.create(sampleProducts.map(validateProduct))
  const products = await Product.find().sort({ priceCents: 1 }).lean()
  const seed = products[0], scarce = products.find(product => product.inventory === 4)
  const sdk = new Stripe('sk_test_placeholder')
  const sessions = new Map(), keys = new Map(), calls = []
  let failNext = null, loseNextResponse = false
  const stripe = {
    webhooks: sdk.webhooks,
    checkout: { sessions: {
      async create(params, options) {
        calls.push({ params, options })
        if (failNext) { const type = failNext; failNext = null; throw Object.assign(new Error('Transport failure'), { type }) }
        if (!keys.has(options.idempotencyKey)) {
          const id = `cs_test_${randomUUID().replaceAll('-', '')}`
          const total = params.line_items.reduce((sum, line) => sum + line.quantity * line.price_data.unit_amount, 0)
          sessions.set(id, { id, livemode: false, mode: 'payment', status: 'open', payment_status: 'unpaid', currency: 'usd', amount_total: total, metadata: params.metadata, url: `https://checkout.stripe.com/c/pay/${id}` })
          keys.set(options.idempotencyKey, id)
        }
        if (loseNextResponse) { loseNextResponse = false; throw Object.assign(new Error('Lost response'), { type: 'StripeConnectionError' }) }
        return sessions.get(keys.get(options.idempotencyKey))
      },
      async retrieve(id) { assert.ok(sessions.has(id)); return sessions.get(id) },
      async expire(id) { const session = sessions.get(id); if (session.status !== 'open') throw new Error('Already closed'); session.status = 'expired'; session.url = null; return session },
    } },
  }
  const webhookSecret = 'whsec_placeholder'
  const commerce = createCommerce({ Product, Order, stripe, webhookSecret, storeUrl: 'http://localhost:5173', logger: { error() {} } })
  const server = createApp({ productModel: Product, commerce, databaseStatus: () => 'connected' }).listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => new Promise(resolve => server.close(resolve)))
  const base = `http://127.0.0.1:${server.address().port}/api`
  const request = async (path, body, headers = {}) => {
    const response = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
    return { status: response.status, data: await response.json() }
  }
  const bag = (product = seed, quantity = 1) => [{ productId: String(product._id), quantity }]
  const payload = async (items = bag()) => ({ items, fingerprint: (await commerce.quote(items)).fingerprint, attemptId: randomUUID() })
  const auth = order => ({ Authorization: `Bearer ${order.token}` })
  const stock = async product => (await Product.findById(product._id)).inventory
  async function event(type, session, extra = {}) {
    const body = JSON.stringify({ id: `evt_${randomUUID()}`, object: 'event', livemode: false, type, data: { object: session }, ...extra })
    const response = await fetch(`${base}/stripe/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'stripe-signature': sdk.webhooks.generateTestHeaderString({ payload: body, secret: webhookSecret }) }, body })
    return response.status
  }

  await t.test('quotes authoritative prices and flags unavailable, archived, and excessive quantities', async () => {
    const quote = await request('/cart', { items: bag(seed, 2) })
    assert.equal(quote.status, 200)
    assert.equal(quote.data.totalCents, seed.priceCents * 2)
    assert.equal(quote.data.canCheckout, true)
    assert.equal(quote.data.items[0].product.checkoutHolds, undefined)
    assert.equal((await request('/cart', { items: bag(products.find(product => !product.inventory)) })).data.canCheckout, false)
    assert.equal((await request('/cart', { items: bag(scarce, 5) })).data.items[0].maxQuantity, 4)
    assert.equal((await request('/cart', { items: [{ productId: '000000000000000000000000', quantity: 1 }] })).data.items[0].product, null)
    for (const items of [[...bag(), ...bag()], bag(seed, 0), bag(seed, 11), bag(seed, 1.5), [{ productId: 'bad', quantity: 1 }]]) assert.equal((await request('/cart', { items })).status, 422)
    assert.equal((await request('/cart', { items: bag(), totalCents: 1 })).status, 422)
    assert.equal((await request('/cart', { items: bag() }, { Origin: 'https://attacker.example' })).status, 403)
  })
  let checkout, session
  await t.test('creates one hosted test session with database prices and rejects changed quotes or client totals', async () => {
    const input = await payload()
    assert.equal((await request('/checkout', { ...input, totalCents: 1 })).status, 422)
    assert.equal((await request('/checkout', { ...input, fingerprint: '0'.repeat(64) })).status, 409)
    checkout = (await request('/checkout', input)).data
    assert.match(checkout.url, /^https:\/\/checkout.stripe.com\//)
    session = sessions.get(keys.get(`rewild:${checkout.orderId}`))
    assert.equal(await stock(seed), seed.inventory - 1)
    assert.equal(calls.at(-1).params.line_items[0].price_data.unit_amount, seed.priceCents)
    assert.deepEqual(calls.at(-1).params.allowed_payment_method_types, ['card'])
    assert.equal(calls.at(-1).params.payment_method_types, undefined)
    assert.equal(calls.at(-1).params.success_url.startsWith('http://localhost:5173/checkout/success'), true)
    const repeat = await request('/checkout', input)
    assert.equal(repeat.data.orderId, checkout.orderId)
    assert.equal(await stock(seed), seed.inventory - 1)
    assert.equal((await request('/checkout', { ...input, items: bag(seed, 2) })).status, 409)
  })
  await t.test('guest order lookup requires its secret and an unpaid return never marks the order paid', async () => {
    assert.equal((await request(`/checkout/${checkout.orderId}`)).status, 404)
    const response = await request(`/checkout/${checkout.orderId}`, undefined, auth(checkout))
    assert.equal(response.data.order.state, 'open')
    assert.equal(response.data.order.tokenHash, undefined)
    assert.equal(response.data.order.returnToken, undefined)
    assert.equal(response.data.order.customer_email, undefined)
  })
  await t.test('verifies raw webhook signatures and rejects live events', async () => {
    assert.equal((await fetch(`${base}/stripe/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'stripe-signature': 'forged' }, body: '{}' })).status, 400)
    assert.equal(await event('checkout.session.completed', session, { livemode: true }), 400)
    assert.equal((await Order.findById(checkout.orderId)).state, 'open')
  })
  await t.test('confirms payment and commits inventory exactly once across duplicate and stale webhook deliveries', async () => {
    session.status = 'complete'; session.payment_status = 'paid'
    assert.deepEqual(await Promise.all([event('checkout.session.completed', session), event('checkout.session.completed', session)]), [200, 200])
    assert.equal((await Order.findById(checkout.orderId)).state, 'paid')
    assert.equal(await stock(seed), seed.inventory - 1)
    assert.equal((await Product.findById(seed._id)).checkoutHolds.length, 0)
    assert.equal(await event('checkout.session.expired', { ...session, status: 'expired' }), 200)
    assert.equal((await request(`/checkout/${checkout.orderId}/cancel`, {}, auth(checkout))).data.order.state, 'paid')
    assert.equal(await stock(seed), seed.inventory - 1)
  })
  await t.test('prevents concurrent overselling and releases cancelled holds only once', async () => {
    const [a, b] = await Promise.all([payload(bag(scarce, 3)), payload(bag(scarce, 3))])
    // Direct service calls avoid exercising rate limits instead of the stock race.
    const results = await Promise.allSettled([commerce.createCheckout(a), commerce.createCheckout(b)])
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
    assert.equal(await stock(scarce), 1)
    const success = results.find(result => result.status === 'fulfilled').value
    await Promise.all([commerce.getOrder(success.orderId, success.token, true), commerce.getOrder(success.orderId, success.token, true)])
    assert.equal(await stock(scarce), 4)
  })
  await t.test('compensates all reserved lines when Stripe definitively rejects creation', async () => {
    const beforeSeed = await stock(seed)
    failNext = 'StripeInvalidRequestError'
    await assert.rejects(commerce.createCheckout(await payload([...bag(seed), ...bag(scarce)])), error => error.status === 503)
    assert.equal(await stock(seed), beforeSeed)
    assert.equal(await stock(scarce), 4)
  })
  await t.test('recovers an ambiguous network failure using the same parameters and idempotency key', async () => {
    const input = await payload(bag(scarce, 2))
    loseNextResponse = true
    await assert.rejects(commerce.createCheckout(input), error => error.code === 'CHECKOUT_RETRY')
    assert.equal(await stock(scarce), 2)
    await Order.updateOne({ attemptId: input.attemptId }, { $set: { leaseUntil: new Date(0) } })
    failNext = 'StripeAuthenticationError'
    await assert.rejects(commerce.createCheckout(input), error => error.code === 'CHECKOUT_RETRY')
    assert.equal(await stock(scarce), 2, 'an authentication failure cannot release a possibly live session from an earlier ambiguous request')
    await Order.updateOne({ attemptId: input.attemptId }, { $set: { leaseUntil: new Date(0) } })
    const recovered = await commerce.createCheckout(input)
    assert.equal(await stock(scarce), 2)
    assert.deepEqual(calls.at(-1), calls.at(-2))
    await commerce.getOrder(recovered.orderId, recovered.token, true)
    assert.equal(await stock(scarce), 4)
  })
  await t.test('recovery releases an expired checkout without relying on a browser return or webhook', async () => {
    const order = await commerce.createCheckout(await payload(bag(scarce)))
    sessions.get(keys.get(`rewild:${order.orderId}`)).status = 'expired'
    await commerce.recover()
    assert.equal(await stock(scarce), 4)
    assert.equal((await Order.findById(order.orderId)).state, 'expired')
  })
})
