import express from 'express'
import helmet from 'helmet'
import { catalogRoutes } from './catalog/routes.js'
import { CatalogError } from './catalog/product.js'
import { commerceRoutes } from './commerce/routes.js'
import { staffRoutes } from './staff/routes.js'

export function createApp({ databaseStatus = () => 'disabled', logger = console, productModel, homepageModel, editorEnabled = false, commerce, staffModels, orderModel, nodeEnv = 'development', storeUrl = 'http://localhost:5173' } = {}) {
  const app = express()
  app.disable('x-powered-by')
  app.use(helmet())
  // Signature verification must see the exact bytes, before the JSON parser.
  app.post('/api/stripe/webhook', express.raw({ type: 'application/json', limit: '256kb' }), async (req, res) => {
    res.set('Cache-Control', 'no-store')
    if (!commerce || databaseStatus() !== 'connected') throw new CatalogError(503, 'CHECKOUT_UNAVAILABLE', 'Webhook is not ready.')
    await commerce.webhook(req.body, req.get('stripe-signature'))
    res.json({ received: true })
  })
  app.use(express.json({ limit: '16kb' }))

  app.get('/api/health', (_req, res) => {
    res.set('Cache-Control', 'no-store').json({ status: 'ok', service: 'store-api' })
  })

  app.get('/api/ready', (_req, res) => {
    const database = databaseStatus()
    const ready = database === 'disabled' || database === 'connected'
    res.set('Cache-Control', 'no-store').status(ready ? 200 : 503).json({
      status: ready ? 'ready' : 'not_ready',
      database,
    })
  })

  app.use('/api', commerceRoutes({ commerce, databaseStatus, storeUrl }))
  if (nodeEnv === 'production') {
    app.use('/api/admin', (_req, res) => {
      res.set('Cache-Control', 'no-store')
      throw new CatalogError(404, 'STAFF_UNAVAILABLE', 'The staff workspace is available in local development.')
    })
  } else {
    app.use('/api/admin', staffRoutes({ ...staffModels, Order: orderModel, databaseStatus, storeUrl }))
  }
  app.use('/api', catalogRoutes({ Product: productModel, HomepageSelection: homepageModel, databaseStatus, editorEnabled }))

  app.use((_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } })
  })

  // Express requires four parameters to recognize error middleware.
  // eslint-disable-next-line no-unused-vars
  app.use((error, _req, res, _next) => {
    if (error instanceof CatalogError) {
      return res.status(error.status).json({ error: { code: error.code, message: error.message, ...(error.fields ? { fields: error.fields } : {}) } })
    }
    if (error.code === 11000) {
      const key = Object.keys(error.keyPattern ?? {})[0] ?? 'slug or SKU'
      return res.status(409).json({ error: { code: 'DUPLICATE_PRODUCT', message: `A product with that ${key} already exists.`, fields: { [key]: 'Must be unique.' } } })
    }
    if (error.name === 'ValidationError' || error.name === 'StrictModeError') {
      return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'The product could not be validated.' } })
    }
    if (error.type === 'entity.parse.failed') {
      return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Invalid JSON body' } })
    }
    if (error.type === 'entity.too.large') {
      return res.status(413).json({ error: { code: 'BODY_TOO_LARGE', message: 'Request body exceeds 16 KB' } })
    }
    logger.error('Unhandled request error', error)
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } })
  })

  return app
}
