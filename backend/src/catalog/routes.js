import { Router } from 'express'
import { BADGES, CATEGORIES, CatalogError, publicProduct, STATUSES, validateProduct } from './product.js'
import { findRelatedProducts } from './related.js'
import { homepageLimit, homepagePlacement, homepageProductIds } from './homepage.js'

const featuredSort = { featured: -1, createdAt: -1, _id: 1 }
const availableProducts = { status: 'active', inventory: { $gt: 0 } }

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
  const sorts = { featured: featuredSort, newest: { createdAt: -1, _id: 1 }, 'price-asc': { priceCents: 1, _id: 1 }, 'price-desc': { priceCents: -1, _id: 1 }, name: { name: 1, _id: 1 } }
  const sortKey = query.sort ?? 'featured'
  if (!Object.hasOwn(sorts, sortKey)) throw new CatalogError(400, 'INVALID_QUERY', 'Unsupported sort order.')
  const sort = sorts[sortKey]
  return { filter, sort, page: integer('page', 1, 1, 10_000), limit: integer('limit', 12, 1, 48) }
}

export function catalogRoutes({ Product, HomepageSelection, databaseStatus, editorEnabled }) {
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

  router.use(['/products', '/admin/products', '/homepage-product', '/admin/homepage-product'], (_req, _res, next) => {
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

  router.get('/homepage-product', async (_req, res) => {
    const choice = await HomepageSelection.findById(homepagePlacement).lean()
    const ids = homepageProductIds(choice)
    const pinned = ids.length ? await Product.find({ _id: { $in: ids }, ...availableProducts }).lean() : []
    const byId = new Map(pinned.map(product => [String(product._id), product]))
    const products = ids.map(id => byId.get(String(id))).filter(Boolean).map(product => publicProduct(product))
    if (!products.length) {
      const fallback = await Product.findOne(availableProducts).sort(featuredSort).lean()
      if (fallback) products.push(publicProduct(fallback))
    }
    res.set('Cache-Control', 'no-store').json({ product: products[0] ?? null, products })
  })

  // The app mounts staff authorization before these routes.
  router.use(['/admin/products', '/admin/homepage-product'], (req, res, next) => {
    if (!res.locals.staff) throw new CatalogError(401, 'STAFF_REQUIRED', 'Sign in to access the staff workspace.')
    if (['POST', 'PUT'].includes(req.method) && !req.is('application/json')) throw new CatalogError(415, 'JSON_REQUIRED', 'Send a JSON request.')
    next()
  })
  router.get('/admin/homepage-product', async (_req, res) => {
    const choice = await HomepageSelection.findById(homepagePlacement).lean()
    const ids = homepageProductIds(choice)
    const products = ids.length ? await Product.find({ _id: { $in: ids } }).select('name status inventory').lean() : []
    const byId = new Map(products.map(product => [String(product._id), product]))
    const selections = ids.map(id => {
      const product = byId.get(String(id))
      return { id: String(id), name: product?.name ?? 'Removed product', available: product?.status === 'active' && product.inventory > 0 }
    })
    res.json({ selections, limit: homepageLimit, revision: choice?.revision ?? 0 })
  })
  router.put('/admin/homepage-product', async (req, res) => {
    const { productIds, revision } = req.body ?? {}
    if (!Array.isArray(productIds) || productIds.length > homepageLimit ||
      productIds.some(id => typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id)) ||
      !Number.isSafeInteger(revision) || revision < 0) {
      throw new CatalogError(422, 'INVALID_HOMEPAGE_SELECTION', `Choose up to ${homepageLimit} products.`)
    }
    const ids = productIds.map(id => id.toLowerCase())
    if (new Set(ids).size !== ids.length) throw new CatalogError(422, 'DUPLICATE_PRODUCT', 'Choose each product once.')

    const choice = await HomepageSelection.findById(homepagePlacement).lean()
    const conflict = new CatalogError(409, 'HOMEPAGE_SELECTION_CHANGED', 'The homepage lineup changed in another session. Review the latest lineup and try again.')
    if ((choice?.revision ?? 0) !== revision) throw conflict
    const previousIds = new Set(homepageProductIds(choice).map(String))
    const added = ids.filter(id => !previousIds.has(id))
    if (added.length && await Product.countDocuments({ _id: { $in: added }, ...availableProducts }) !== added.length) {
      throw new CatalogError(422, 'PRODUCT_UNAVAILABLE', 'Choose published products that are in stock.')
    }
    try {
      const filter = { _id: homepagePlacement, revision: choice?.revision ?? { $exists: false } }
      const result = await HomepageSelection.updateOne(filter, {
        $set: { productIds: ids, revision: revision + 1 },
        $unset: { productId: '' },
      }, { upsert: !choice, runValidators: true })
      if (!result.matchedCount && !result.upsertedCount) throw conflict
    } catch (error) {
      if (error.code === 11000) throw conflict
      throw error
    }
    res.json({ revision: revision + 1 })
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
