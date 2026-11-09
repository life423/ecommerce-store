import { createHash, randomBytes } from 'node:crypto'
import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { CatalogError } from '../catalog/product.js'
import { ORDER_STATES } from '../commerce/order.js'
import { staffUsername, verifyStaffPassword } from './accounts.js'

const cookieName = 'rewild_staff'
const sessionDuration = 8 * 60 * 60 * 1000
const orderPageSize = 15

function sessionKey(req) {
  const entries = (req.get('Cookie') ?? '').split(';').map(part => part.trim())
  const token = entries.find(part => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1)
  return /^[a-f0-9]{64}$/.test(token ?? '') ? hashToken(token) : null
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

function signInRequired() {
  return new CatalogError(401, 'STAFF_REQUIRED', 'Sign in to access the staff workspace.')
}

function summarizeOrder(order) {
  return {
    id: order._id,
    reference: `RW-${order._id.slice(0, 8).toUpperCase()}`,
    state: order.state,
    currency: order.currency,
    totalCents: order.totalCents,
    createdAt: order.createdAt,
    paidAt: order.paidAt ?? null,
    items: order.items.map(({ name, quantity, unitPriceCents }) => ({ name, quantity, unitPriceCents })),
  }
}

export function staffRoutes({ Staff, StaffSession, Order, databaseStatus, storeUrl }) {
  const router = Router()
  const cookieOptions = { httpOnly: true, sameSite: 'strict', secure: storeUrl.startsWith('https:'), path: '/api/admin' }
  const signInLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: { error: { code: 'RATE_LIMITED', message: 'Too many sign-in attempts. Try again in 15 minutes.' } },
  })

  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store')
    if (!['GET', 'HEAD'].includes(req.method) &&
        (req.get('Origin') !== storeUrl || req.get('Sec-Fetch-Site') === 'cross-site')) {
      throw new CatalogError(403, 'STAFF_ORIGIN', 'Use the staff workspace on the storefront origin.')
    }
    next()
  })

  function requireDatabase() {
    if (!Staff || !StaffSession || databaseStatus() !== 'connected') {
      throw new CatalogError(503, 'STAFF_UNAVAILABLE', 'The staff workspace is temporarily unavailable.')
    }
  }

  router.post('/sign-in', signInLimit, async (req, res) => {
    requireDatabase()
    if (!req.is('application/json')) throw new CatalogError(415, 'JSON_REQUIRED', 'Send a JSON sign-in request.')
    const username = typeof req.body?.username === 'string' ? req.body.username.trim().toLowerCase() : ''
    const password = req.body?.password
    if (!staffUsername.test(username) || typeof password !== 'string' || !password || password.length > 256) {
      throw new CatalogError(401, 'INVALID_CREDENTIALS', 'Check your username and password.')
    }
    const staff = await Staff.findOne({ username, active: true }).select('+passwordHash').lean()
    if (!await verifyStaffPassword(password, staff?.passwordHash) || !staff) {
      throw new CatalogError(401, 'INVALID_CREDENTIALS', 'Check your username and password.')
    }

    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + sessionDuration)
    const previousKey = sessionKey(req)
    if (previousKey) await StaffSession.deleteOne({ _id: previousKey })
    await StaffSession.create({ _id: hashToken(token), staffId: staff._id, expiresAt })
    res.cookie(cookieName, token, { ...cookieOptions, maxAge: sessionDuration })
    res.json({ staff: { username: staff.username, expiresAt } })
  })

  router.use(async (req, res, next) => {
    const key = sessionKey(req)
    if (!key) throw signInRequired()
    requireDatabase()
    const session = await StaffSession.findOne({ _id: key, expiresAt: { $gt: new Date() } }).lean()
    if (!session) throw signInRequired()
    const staff = await Staff.findOne({ _id: session.staffId, active: true }).select('username').lean()
    if (!staff) throw signInRequired()
    res.locals.staff = { username: staff.username, expiresAt: session.expiresAt }
    res.locals.staffSessionKey = key
    next()
  })

  router.get('/session', (_req, res) => res.json({ staff: res.locals.staff }))
  router.post('/sign-out', async (_req, res) => {
    await StaffSession.deleteOne({ _id: res.locals.staffSessionKey })
    res.clearCookie(cookieName, cookieOptions).json({ staff: null })
  })

  router.get('/orders', async (req, res) => {
    if (!Order) throw new CatalogError(503, 'ORDERS_UNAVAILABLE', 'Test orders are temporarily unavailable.')
    const { page: rawPage = '1', state } = req.query
    if (typeof rawPage !== 'string' || !/^[1-9]\d{0,3}$/.test(rawPage) ||
        (state !== undefined && !ORDER_STATES.includes(state)) ||
        Object.keys(req.query).some(key => !['page', 'state'].includes(key))) {
      throw new CatalogError(400, 'INVALID_QUERY', 'Choose a valid order page and payment status.')
    }
    const page = Number(rawPage)
    const filter = state ? { state } : {}
    const [orders, total] = await Promise.all([
      Order.find(filter).select('state currency totalCents createdAt paidAt items.name items.quantity items.unitPriceCents')
        .sort({ createdAt: -1, _id: -1 }).skip((page - 1) * orderPageSize).limit(orderPageSize).lean(),
      Order.countDocuments(filter),
    ])
    res.json({ items: orders.map(summarizeOrder), page, pages: Math.ceil(total / orderPageSize), total })
  })

  return router
}
