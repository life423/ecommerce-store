import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { CatalogError } from '../catalog/product.js'
import { validateItems } from './service.js'

export function commerceRoutes({ commerce, databaseStatus, storeUrl }) {
  const router = Router()
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next() })
  router.get('/checkout/config', (_req, res) => res.json({ enabled: commerce?.enabled ?? false, testMode: true }))
  router.use(['/cart', '/checkout'], rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'A little pause. Please try again in a minute.' } } }), (_req, _res, next) => {
    if (!commerce || databaseStatus() !== 'connected') throw new CatalogError(503, 'DATABASE_UNAVAILABLE', 'Your bag is temporarily unavailable. Please try again.')
    next()
  })
  router.use(['/cart', '/checkout'], (req, _res, next) => {
    if (req.method !== 'POST') return next()
    const origin = req.get('Origin')
    const allowed = [storeUrl, 'http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173', 'http://127.0.0.1:4173']
    if (req.get('Sec-Fetch-Site') === 'cross-site' || (origin && !allowed.includes(origin))) throw new CatalogError(403, 'ORIGIN_FORBIDDEN', 'Open checkout from this storefront.')
    if (!req.is('application/json')) throw new CatalogError(415, 'JSON_REQUIRED', 'Send a JSON bag object.')
    next()
  })
  router.post('/cart', async (req, res) => {
    if (Object.keys(req.body ?? {}).some(key => key !== 'items')) throw new CatalogError(422, 'INVALID_CART', 'Send product IDs and quantities only.')
    res.json(await commerce.quote(validateItems(req.body)))
  })
  router.post('/checkout', rateLimit({ windowMs: 60_000, limit: 10, legacyHeaders: false }), async (req, res) => res.json(await commerce.createCheckout(req.body)))
  router.get('/checkout/:id', async (req, res) => res.json({ order: await commerce.getOrder(req.params.id, req.get('Authorization')?.replace(/^Bearer /, '')) }))
  router.post('/checkout/:id/cancel', async (req, res) => res.json({ order: await commerce.getOrder(req.params.id, req.get('Authorization')?.replace(/^Bearer /, ''), true) }))
  return router
}
