import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { CatalogError, publicProduct } from '../catalog/product.js'

const hash = value => createHash('sha256').update(value).digest('hex')
const fail = (status, code, message) => { throw new CatalogError(status, code, message) }
export const MAX_QUANTITY = 10
export function validateItems(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || !Array.isArray(body.items) || body.items.length > 20) fail(422, 'INVALID_CART', 'Use up to 20 different products in your bag.')
  const seen = new Set()
  const items = body.items.map(item => {
    if (!item || Object.keys(item).some(key => !['productId', 'quantity'].includes(key)) || !/^[a-f\d]{24}$/i.test(item.productId) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_QUANTITY) fail(422, 'INVALID_CART', 'Each bag item needs a valid product and a quantity from 1 to 10.')
    const productId = item.productId.toLowerCase()
    if (seen.has(productId)) fail(422, 'INVALID_CART', 'Combine duplicate products into one bag item.')
    seen.add(productId)
    return { productId, quantity: item.quantity }
  })
  return items.sort((a, b) => a.productId.localeCompare(b.productId))
}

/** Inventory holds live on the product so reserving/releasing each line is atomic.
 * Multi-line failures compensate; durable orders allow interrupted work to resume.
 * No replica set or multi-document transaction is required for this local stack. */
export function createCommerce({ Product, Order, stripe, storeUrl, webhookSecret, logger = console }) {
  const enabled = Boolean(stripe && webhookSecret)

  async function quote(items) {
    const products = await Product.find({ _id: { $in: items.map(item => item.productId) }, status: 'active' }).lean()
    const lines = items.map(item => {
      const product = products.find(p => String(p._id) === item.productId)
      const maxQuantity = product ? Math.min(MAX_QUANTITY, product.inventory) : 0
      const issue = !product ? 'This product is no longer available.' : maxQuantity === 0 ? 'This good thing is out of stock.' : item.quantity > maxQuantity ? `Only ${maxQuantity} available. Update the quantity to continue.` : null
      return { ...item, product: product ? publicProduct(product) : null, maxQuantity, issue, lineTotalCents: product ? product.priceCents * item.quantity : 0 }
    })
    const fingerprint = hash(JSON.stringify(lines.map(line => [line.productId, line.quantity, line.product?.priceCents ?? null])))
    return { items: lines, totalCents: lines.reduce((total, line) => total + line.lineTotalCents, 0), currency: 'usd', fingerprint,
      canCheckout: lines.length > 0 && lines.every(line => !line.issue), checkoutEnabled: enabled, testMode: true }
  }

  async function release(order) {
    for (const item of order.items) {
      await Product.updateOne({ _id: item.productId, checkoutHolds: { $elemMatch: { orderId: order._id, quantity: item.quantity } } },
        { $inc: { inventory: item.quantity, __v: 1 }, $pull: { checkoutHolds: { orderId: order._id } } })
    }
    await Order.updateOne({ _id: order._id, state: { $in: ['failed', 'expired'] } }, { $set: { cleanupComplete: true } })
  }

  function assertSession(order, session) {
    if (session.livemode !== false || session.mode !== 'payment' || session.metadata?.orderId !== order._id || session.currency !== 'usd' || session.amount_total !== order.totalCents || (order.sessionId && order.sessionId !== session.id)) {
      fail(409, 'SESSION_MISMATCH', 'This checkout could not be verified. Please contact the store owner.')
    }
  }

  async function reconcile(order, session) {
    assertSession(order, session)
    // A webhook can arrive before the create-session response is saved.
    await Order.updateOne({ _id: order._id, sessionId: { $exists: false } }, { $set: { sessionId: session.id } })
    if (session.status === 'complete' && session.payment_status === 'paid') {
      if (['failed', 'expired'].includes(order.state)) fail(409, 'ORDER_CONFLICT', 'This payment needs review by the store owner.')
      for (const item of order.items) {
        // Removing a hold commits already-decremented stock; repeated delivery is harmless.
        await Product.updateOne({ _id: item.productId }, { $pull: { checkoutHolds: { orderId: order._id } } })
      }
      await Order.updateOne({ _id: order._id, state: { $in: ['creating', 'open'] } }, { $set: { state: 'paid', paidAt: new Date(), cleanupComplete: true, checkoutUrl: null } })
    } else if (session.status === 'expired' && order.state !== 'paid') {
      await Order.updateOne({ _id: order._id, state: { $ne: 'paid' } }, { $set: { state: 'expired', checkoutUrl: null } })
      await release(order)
    }
    return Order.findById(order._id).lean()
  }

  async function reserveAndCreate(order) {
    if (order.expiresAt.getTime() < Date.now() - 23 * 60 * 60 * 1000) {
      // Never re-create an ambiguous session outside Stripe's idempotency window.
      fail(503, 'RECONCILIATION_REQUIRED', 'This checkout needs review by the store owner.')
    }
    for (const item of order.items) {
      const held = await Product.exists({ _id: item.productId, 'checkoutHolds.orderId': order._id })
      if (held) continue
      const product = await Product.findOneAndUpdate({ _id: item.productId, status: 'active', priceCents: item.unitPriceCents, currency: 'usd', inventory: { $gte: item.quantity }, 'checkoutHolds.orderId': { $ne: order._id } },
        { $inc: { inventory: -item.quantity, __v: 1 }, $push: { checkoutHolds: { orderId: order._id, quantity: item.quantity } } })
      if (!product) {
        if (await Product.exists({ _id: item.productId, 'checkoutHolds.orderId': order._id })) continue
        await Order.updateOne({ _id: order._id }, { $set: { state: 'failed' } })
        await release(order)
        fail(409, 'CART_CHANGED', 'Availability or prices changed. Review your bag and try again.')
      }
    }
    let session
    const previouslyAttempted = order.stripeAttempted
    await Order.updateOne({ _id: order._id }, { $set: { stripeAttempted: true } })
    try {
      session = await stripe.checkout.sessions.create(order.sessionParams, { idempotencyKey: `rewild:${order._id}` })
    } catch (error) {
      if (!previouslyAttempted && ['StripeInvalidRequestError', 'StripeAuthenticationError', 'StripePermissionError'].includes(error.type)) {
        await Order.updateOne({ _id: order._id }, { $set: { state: 'failed' } })
        await release(order)
      }
      // Network/server failures may have created a session. Keep holds and retry
      // the exact saved parameters and idempotency key, rather than releasing stock.
      logger.error('Stripe checkout creation failed', { type: error.type ?? 'network_error', code: error.code })
      fail(503, 'CHECKOUT_RETRY', 'Checkout could not connect. Your bag is safe. Please try again shortly.')
    }
    assertSession(order, session)
    await Order.updateOne({ _id: order._id, state: 'creating' }, { $set: { state: 'open', sessionId: session.id, checkoutUrl: session.url, leaseUntil: null } })
    if (session.status !== 'open') return reconcile(order, session)
    return Order.findById(order._id).lean()
  }

  const publicOrder = order => ({ id: order._id, reference: `RW-${order._id.slice(0, 8).toUpperCase()}`, state: order.state, testMode: true, currency: 'usd', totalCents: order.totalCents, checkoutUrl: order.state === 'open' ? order.checkoutUrl : null,
    items: order.items.map(item => ({ productId: String(item.productId), name: item.name, slug: item.slug, image: item.image, unitPriceCents: item.unitPriceCents, quantity: item.quantity })), paidAt: order.paidAt ?? null })

  async function createCheckout(body) {
    if (!enabled) fail(503, 'CHECKOUT_UNAVAILABLE', 'Test checkout is being connected. Your bag will stay saved.')
    if (Object.keys(body ?? {}).some(key => !['items', 'fingerprint', 'attemptId'].includes(key))) fail(422, 'INVALID_CART', 'Send products and quantities, not client prices.')
    const items = validateItems(body)
    if (!items.length || !/^[a-f\d]{64}$/.test(body.fingerprint) || !/^[a-f\d-]{36}$/i.test(body.attemptId)) fail(422, 'INVALID_CART', 'Review your bag before checking out.')
    const requestHash = hash(JSON.stringify([items, body.fingerprint]))
    let order = await Order.findOne({ attemptId: body.attemptId }).select('+returnToken').lean()
    if (order && order.requestHash !== requestHash) fail(409, 'ATTEMPT_CHANGED', 'Your bag changed. Review it before starting a new checkout.')
    if (!order) {
      const cart = await quote(items)
      if (!cart.canCheckout || cart.fingerprint !== body.fingerprint) fail(409, 'CART_CHANGED', 'Prices or availability changed. Review your bag and try again.')
      const id = randomUUID(), token = randomBytes(32).toString('hex')
      const expiresAt = new Date(Date.now() + 35 * 60 * 1000)
      const snapshots = cart.items.map(line => ({ productId: line.productId, name: line.product.name, slug: line.product.slug, image: line.product.images[0], unitPriceCents: line.product.priceCents, quantity: line.quantity }))
      const sessionParams = {
        mode: 'payment', payment_method_types: ['card'], client_reference_id: id, metadata: { orderId: id, store: 'rewild' },
        line_items: snapshots.map(line => ({ quantity: line.quantity, price_data: { currency: 'usd', unit_amount: line.unitPriceCents, product_data: { name: line.name } } })),
        expires_at: Math.floor(expiresAt.getTime() / 1000),
        success_url: `${storeUrl}/checkout/success?order_id=${id}&token=${token}`,
        cancel_url: `${storeUrl}/checkout/cancel?order_id=${id}&token=${token}`,
        shipping_address_collection: { allowed_countries: ['US'] },
        shipping_options: [{ shipping_rate_data: { type: 'fixed_amount', fixed_amount: { amount: 0, currency: 'usd' }, display_name: 'Demo shipping · no shipment' } }],
        custom_text: { submit: { message: 'REWILD portfolio demo. Test payments only. No real charge or shipment. Tax is not applied in this test store.' } },
        branding_settings: { display_name: 'REWILD', background_color: '#fffefb', button_color: '#293e2f' },
      }
      try {
        order = (await Order.create({ _id: id, attemptId: body.attemptId, requestHash, tokenHash: hash(token), returnToken: token, items: snapshots,
          totalCents: cart.totalCents, expiresAt, leaseUntil: new Date(Date.now() + 60_000), sessionParams })).toObject()
      } catch (error) {
        if (error.code === 11000) fail(409, 'CHECKOUT_BUSY', 'Checkout is already opening. Please try again shortly.')
        throw error
      }
      order = { ...await reserveAndCreate(order), returnToken: token }
    } else if (order.state === 'creating') {
      const locked = await Order.findOneAndUpdate({ _id: order._id, state: 'creating', leaseUntil: { $lte: new Date() } }, { $set: { leaseUntil: new Date(Date.now() + 60_000) } }).select('+returnToken').lean()
      if (!locked) fail(409, 'CHECKOUT_BUSY', 'Checkout is already opening. Please try again shortly.')
      order = { ...await reserveAndCreate(locked), returnToken: locked.returnToken }
    } else if (order.sessionId) {
      const token = order.returnToken
      order = { ...await reconcile(order, await stripe.checkout.sessions.retrieve(order.sessionId)), returnToken: token }
    }
    if (order.state !== 'open' || !order.checkoutUrl) fail(409, 'CHECKOUT_CLOSED', 'This checkout has finished. Review your bag to start a new one.')
    const url = new URL(order.checkoutUrl)
    if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com') fail(503, 'INVALID_CHECKOUT_URL', 'Checkout is temporarily unavailable.')
    return { url: order.checkoutUrl, orderId: order._id, token: order.returnToken }
  }

  async function getOrder(id, token, cancel = false) {
    if (!/^[a-f\d-]{36}$/i.test(id) || !/^[a-f\d]{64}$/.test(token ?? '')) fail(404, 'ORDER_NOT_FOUND', 'This checkout could not be found.')
    let order = await Order.findOne({ _id: id, tokenHash: hash(token) }).lean()
    if (!order) fail(404, 'ORDER_NOT_FOUND', 'This checkout could not be found.')
    if (order.sessionId && stripe) {
      try {
        let session = await stripe.checkout.sessions.retrieve(order.sessionId)
        if (cancel && session.status === 'open') {
          try { session = await stripe.checkout.sessions.expire(session.id) }
          catch { session = await stripe.checkout.sessions.retrieve(session.id) }
        }
        order = await reconcile(order, session)
      } catch (error) {
        if (error instanceof CatalogError) throw error
        logger.error('Stripe checkout verification failed', { type: error.type ?? 'network_error' })
        fail(503, 'CHECKOUT_RETRY', 'We could not confirm checkout with Stripe yet. Please try again.')
      }
    }
    return publicOrder(order)
  }

  async function webhook(raw, signature) {
    if (!enabled) fail(503, 'CHECKOUT_UNAVAILABLE', 'Webhook configuration is incomplete.')
    let event
    try { event = stripe.webhooks.constructEvent(raw, signature, webhookSecret) }
    catch { fail(400, 'INVALID_SIGNATURE', 'Invalid webhook signature.') }
    if (event.livemode !== false) fail(400, 'LIVE_EVENT_REJECTED', 'Only test events are accepted.')
    if (['checkout.session.completed', 'checkout.session.expired', 'checkout.session.async_payment_succeeded'].includes(event.type)) {
      const session = event.data.object
      if (session.metadata?.store !== 'rewild') return
      const order = await Order.findById(session.metadata.orderId).lean()
      if (!order) fail(503, 'ORDER_NOT_READY', 'Order not ready. Retry this event.')
      // Fetch Stripe's current state, so delayed/out-of-order event payloads cannot
      // roll a paid order back or release stock belonging to a completed payment.
      await reconcile(order, await stripe.checkout.sessions.retrieve(session.id))
    }
  }

  async function recover() {
    if (!enabled) return
    const pending = await Order.find({ $or: [{ state: 'creating', leaseUntil: { $lte: new Date() } }, { state: 'open' }, { state: { $in: ['failed', 'expired'] }, cleanupComplete: false }] }).sort({ updatedAt: 1 }).limit(50).lean()
    for (const order of pending) {
      try {
        if (['failed', 'expired'].includes(order.state)) await release(order)
        else if (order.sessionId) await reconcile(order, await stripe.checkout.sessions.retrieve(order.sessionId))
        else {
          const locked = await Order.findOneAndUpdate({ _id: order._id, state: 'creating', leaseUntil: { $lte: new Date() } }, { $set: { leaseUntil: new Date(Date.now() + 60_000) } }).lean()
          if (locked) await reserveAndCreate(locked)
        }
      } catch (error) { logger.error('Checkout recovery needs retry', { orderId: order._id, code: error.code ?? 'RECOVERY_FAILED' }) }
    }
  }
  return { quote, createCheckout, getOrder, webhook, recover, enabled }
}
