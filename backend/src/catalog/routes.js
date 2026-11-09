import { Router } from 'express'
import { BADGES, CATEGORIES, CatalogError, publicProduct, STATUSES, validateProduct } from './product.js'
import { findRelatedProducts } from './related.js'

const spaceProducts = {
  balcony: ['RW-PLANTER-01', 'RW-TOOLS-01'],
  windowsill: ['RW-GREENS-01', 'RW-SEEDS-01'],
  indoors: ['RW-KIT-01', 'RW-WATER-01'],
}

function parseQuery(query, admin) {
  const allowed = ['q', 'category', 'sort', 'page', 'limit', 'inStock', 'minPrice', 'maxPrice', admin ? 'status' : 'space']
  for (const [key, value] of Object.entries(query)) {
    if (!allowed.includes(key) || typeof value !== 'string') throw new CatalogError(400, 'INVALID_QUERY', 'Unsupported catalog filter.')
  }
  const filter = admin ? {} : { status: 'active' }
  if (query.space !== undefined) {
    if (!Object.hasOwn(spaceProducts, query.space)) throw new CatalogError(400, 'INVALID_QUERY', 'Invalid growing space.')
    filter.sku = { $in: spaceProducts[query.space] }
  }
  if (admin && query.status) {
    if (!STATUSES.includes(query.status)) throw new CatalogError(400, 'INVALID_QUERY', 'Invalid product status.')
    filter.status = query.status
  }
  if (query.category) {
    if (!CATEGORIES.includes(query.category)) throw new CatalogError(400, 'INVALID_QUERY', 'Invalid product category.')
    filter.category = query.category
  }
  if (query.q) {
    if (query.q.length > 100) throw new CatalogError(400, 'INVALID_QUERY', 'Search must be 100 characters or fewer.')
    const escaped = query.q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    filter.$or = ['name', 'description', ...(admin ? ['sku'] : [])].map(field => ({ [field]: { $regex: escaped, $options: 'i' } }))
  }
  if (query.inStock !== undefined) {
    if (!['true', 'false'].includes(query.inStock)) throw new CatalogError(400, 'INVALID_QUERY', 'inStock must be true or false.')
    if (query.inStock === 'true') filter.inventory = { $gt: 0 }
  }
  function integer(key, fallback, min, max) {
    if (query[key] === undefined) return fallback
    if (!/^\d+$/.test(query[key])) throw new CatalogError(400, 'INVALID_QUERY', `${key} must be a whole number.`)
    const value = Number(query[key])
    if (!Number.isSafeInteger(value) || value < min || value > max) throw new CatalogError(400, 'INVALID_QUERY', `${key} is out of range.`)
    return value
  }
  const minPrice = integer('minPrice', undefined, 0, 10_000_000)
  const maxPrice = integer('maxPrice', undefined, 0, 10_000_000)
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) throw new CatalogError(400, 'INVALID_QUERY', 'Minimum price must not exceed maximum price.')
  if (minPrice !== undefined || maxPrice !== undefined) filter.priceCents = { ...(minPrice !== undefined ? { $gte: minPrice } : {}), ...(maxPrice !== undefined ? { $lte: maxPrice } : {}) }
  const sorts = { featured: { featured: -1, createdAt: -1, _id: 1 }, newest: { createdAt: -1, _id: 1 }, 'price-asc': { priceCents: 1, _id: 1 }, 'price-desc': { priceCents: -1, _id: 1 }, name: { name: 1, _id: 1 } }
  const sortKey = query.sort ?? 'featured'
  if (!Object.hasOwn(sorts, sortKey)) throw new CatalogError(400, 'INVALID_QUERY', 'Unsupported sort order.')
  const sort = sorts[sortKey]
  return { filter, sort, page: integer('page', 1, 1, 10_000), limit: integer('limit', 12, 1, 48) }
}

export function catalogRoutes({ Product, databaseStatus, editorEnabled }) {
  const router = Router()

  router.get('/catalog', async (_req, res) => {
    const connected = databaseStatus() === 'connected'
    const counts = connected ? await Product.aggregate([
      { $match: { status: 'active' } }, { $group: { _id: '$category', count: { $sum: 1 } } },
    ]) : []
    res.set('Cache-Control', 'no-store').json({
      categories: CATEGORIES.map(name => ({ name, count: counts.find(item => item._id === name)?.count ?? 0 })),
      currency: 'usd', editorEnabled, databaseConnected: connected, badges: BADGES,
    })
  })

  router.use(['/products', '/admin/products'], (_req, _res, next) => {
    if (databaseStatus() !== 'connected') return next(new CatalogError(503, 'DATABASE_UNAVAILABLE', 'The catalog is temporarily unavailable. Please try again.'))
    next()
  })

  async function list(req, res, admin = false) {
    const { filter, sort, page, limit } = parseQuery(req.query, admin)
    const [products, total] = await Promise.all([
      Product.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
      Product.countDocuments(filter),
    ])
    res.set('Cache-Control', 'no-store').json({ items: products.map(product => publicProduct(product, admin)),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
  }
  async function findActiveProduct(slug) {
    if (!/^[a-z0-9-]{1,140}$/.test(slug)) throw new CatalogError(404, 'NOT_FOUND', 'Product not found.')
    const product = await Product.findOne({ slug, status: 'active' }).lean()
    if (!product) throw new CatalogError(404, 'NOT_FOUND', 'Product not found.')
    return product
  }

  router.get('/products', (req, res) => list(req, res))
  router.get('/products/:slug', async (req, res) => {
    const product = await findActiveProduct(req.params.slug)
    res.json({ product: publicProduct(product) })
  })
  router.get('/products/:slug/related', async (req, res) => {
    const product = await findActiveProduct(req.params.slug)
    const related = await findRelatedProducts(Product, product)
    res.set('Cache-Control', 'no-store').json({ items: related.map(item => publicProduct(item)) })
  })

  // Local development tool only. Never enabled in production by server configuration.
  // A custom header and strict same-origin checks block cross-site browser writes.
  router.use('/admin', (req, _res, next) => {
    if (!editorEnabled) throw new CatalogError(403, 'EDITOR_DISABLED', 'The local product studio is disabled.')
    if (req.get('X-Catalog-Editor') !== 'local') throw new CatalogError(403, 'EDITOR_FORBIDDEN', 'Use the local product studio.')
    const origin = req.get('Origin')
    if (origin) {
      const allowed = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173', 'http://127.0.0.1:4173']
      if (!allowed.includes(origin)) throw new CatalogError(403, 'EDITOR_FORBIDDEN', 'This origin cannot access the product studio.')
    }
    if (req.get('Sec-Fetch-Site') === 'cross-site') throw new CatalogError(403, 'EDITOR_FORBIDDEN', 'Cross-site access is not allowed.')
    if (['POST', 'PUT'].includes(req.method) && !req.is('application/json')) throw new CatalogError(415, 'JSON_REQUIRED', 'Send a JSON product object.')
    next()
  })
  router.get('/admin/products', (req, res) => list(req, res, true))
  router.get('/admin/products/:id', async (req, res) => {
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) throw new CatalogError(404, 'NOT_FOUND', 'Product not found.')
    const product = await Product.findById(req.params.id).lean()
    if (!product) throw new CatalogError(404, 'NOT_FOUND', 'Product not found.')
    res.json({ product: publicProduct(product, true) })
  })
  router.post('/admin/products', async (req, res) => {
    const data = validateProduct(req.body)
    const product = await Product.create(data)
    res.status(201).location(`/api/products/${product.slug}`).json({ product: publicProduct(product.toObject(), true) })
  })
  router.put('/admin/products/:id', async (req, res) => {
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) throw new CatalogError(404, 'NOT_FOUND', 'Product not found.')
    const data = validateProduct(req.body)
    if (!Number.isSafeInteger(req.body.version) || req.body.version < 0) throw new CatalogError(422, 'VALIDATION_ERROR', 'A valid product version is required.', { version: 'Reload the product before editing.' })
    const product = await Product.findOneAndUpdate({ _id: req.params.id, __v: req.body.version }, {
      $set: data, $inc: { __v: 1 },
    }, { returnDocument: 'after', runValidators: true }).lean()
    if (!product) {
      if (!await Product.exists({ _id: req.params.id })) throw new CatalogError(404, 'NOT_FOUND', 'Product not found.')
      throw new CatalogError(409, 'VERSION_CONFLICT', 'This product changed in another session. Reload it before saving.')
    }
    res.json({ product: publicProduct(product, true) })
  })
  return router
}
