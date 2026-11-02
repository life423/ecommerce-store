import mongoose from 'mongoose'

export const CATEGORIES = ['Growing kits', 'Planters', 'Seeds', 'Tools & care']
export const STATUSES = ['draft', 'active', 'archived']
export const BADGES = ['', 'New', 'Starter favorite']

export class CatalogError extends Error {
  constructor(status, code, message, fields) {
    super(message)
    Object.assign(this, { status, code, fields })
  }
}

export function slugify(name) {
  return name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 140).replace(/-$/, '')
}

export function validImageUrl(value) {
  if (typeof value !== 'string' || value.length > 1000) return false
  if (/^\/images\/[a-zA-Z0-9_-]+\.(png|jpe?g|webp|avif)$/.test(value)) return true
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password
  } catch { return false }
}

export function validateProduct(input) {
  const fields = {}
  const allowed = ['name', 'slug', 'sku', 'description', 'category', 'priceCents', 'compareAtPriceCents', 'currency', 'inventory', 'status', 'featured', 'badge', 'images', 'highlights', 'version']
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new CatalogError(422, 'VALIDATION_ERROR', 'Provide a product object.')
  }
  for (const key of Object.keys(input)) if (!allowed.includes(key)) fields[key] = 'Unknown field.'
  function string(key, max, min = 1) {
    const value = typeof input[key] === 'string' ? input[key].trim() : ''
    if (value.length < min || value.length > max) fields[key] = `Use ${min}–${max} characters.`
    return value
  }
  const name = string('name', 120, 3)
  const slug = input.slug === undefined || input.slug === '' ? slugify(name) : string('slug', 140)
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) fields.slug = 'Use lowercase letters, numbers, and single hyphens.'
  const sku = string('sku', 48, 3).toUpperCase()
  if (!/^[A-Z0-9][A-Z0-9-]{2,47}$/.test(sku)) fields.sku = 'Use 3–48 letters, numbers, or hyphens.'
  const description = string('description', 4000, 20)
  const category = input.category
  if (!CATEGORIES.includes(category)) fields.category = 'Choose a supported category.'
  const { priceCents, inventory } = input
  if (!Number.isSafeInteger(priceCents) || priceCents < 100 || priceCents > 10_000_000) fields.priceCents = 'Use whole cents between 100 and 10000000.'
  if (!Number.isSafeInteger(inventory) || inventory < 0 || inventory > 1_000_000) fields.inventory = 'Use a whole stock count between 0 and 1000000.'
  const compareAtPriceCents = input.compareAtPriceCents ?? null
  if (compareAtPriceCents !== null && (!Number.isSafeInteger(compareAtPriceCents) || compareAtPriceCents <= priceCents || compareAtPriceCents > 10_000_000)) fields.compareAtPriceCents = 'The original price must exceed the current price.'
  const currency = input.currency ?? 'usd'
  if (currency !== 'usd') fields.currency = 'This catalog currently uses USD.'
  const status = input.status ?? 'draft'
  if (!STATUSES.includes(status)) fields.status = 'Choose draft, active, or archived.'
  const featured = input.featured ?? false
  if (typeof featured !== 'boolean') fields.featured = 'Use true or false.'
  const badge = input.badge ?? ''
  if (!BADGES.includes(badge)) fields.badge = 'Choose a supported badge.'
  const images = input.images
  if (!Array.isArray(images) || images.length < 1 || images.length > 5 || images.some(image =>
    !image || typeof image !== 'object' || !validImageUrl(image.url) || typeof image.alt !== 'string'
    || !image.alt.trim() || image.alt.length > 160 || Object.keys(image).some(key => !['url', 'alt'].includes(key)))) {
    fields.images = 'Add 1–5 images with HTTPS or local /images/ URLs and descriptive alt text.'
  }
  const highlights = input.highlights ?? []
  if (!Array.isArray(highlights) || highlights.length > 6 || highlights.some(item => typeof item !== 'string' || !item.trim() || item.length > 160)) fields.highlights = 'Use up to six short product highlights.'
  if (Object.keys(fields).length) throw new CatalogError(422, 'VALIDATION_ERROR', 'Check the highlighted product fields.', fields)
  return { name, slug, sku, description, category, priceCents, compareAtPriceCents, currency, inventory, status, featured, badge,
    images: images.map(image => ({ url: image.url, alt: image.alt.trim() })), highlights: highlights.map(item => item.trim()) }
}

const integer = { validator: Number.isSafeInteger, message: 'Must be a whole number.' }
const imageSchema = new mongoose.Schema({
  url: { type: String, required: true, validate: validImageUrl },
  alt: { type: String, required: true, trim: true, maxlength: 160 },
}, { _id: false, strict: 'throw' })

const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 3, maxlength: 120 },
  slug: { type: String, required: true, maxlength: 140, match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ },
  sku: { type: String, required: true, uppercase: true, match: /^[A-Z0-9][A-Z0-9-]{2,47}$/ },
  description: { type: String, required: true, minlength: 20, maxlength: 4000 },
  category: { type: String, required: true, enum: CATEGORIES },
  priceCents: { type: Number, required: true, min: 100, max: 10_000_000, validate: integer },
  compareAtPriceCents: { type: Number, default: null, min: 100, max: 10_000_000, validate: value => value === null || Number.isSafeInteger(value) },
  currency: { type: String, enum: ['usd'], default: 'usd' },
  inventory: { type: Number, required: true, min: 0, max: 1_000_000, validate: integer },
  checkoutHolds: { type: [new mongoose.Schema({ orderId: { type: String, required: true }, quantity: { type: Number, required: true, min: 1, max: 10, validate: integer } }, { _id: false })], default: [] },
  status: { type: String, enum: STATUSES, default: 'draft' },
  featured: { type: Boolean, default: false },
  badge: { type: String, enum: BADGES, default: '' },
  images: { type: [imageSchema], required: true, validate: value => value.length >= 1 && value.length <= 5 },
  highlights: { type: [{ type: String, maxlength: 160 }], validate: value => value.length <= 6 },
}, { timestamps: true, strict: 'throw', optimisticConcurrency: true })

schema.pre('validate', function () {
  if (this.compareAtPriceCents !== null && this.compareAtPriceCents <= this.priceCents) {
    this.invalidate('compareAtPriceCents', 'The original price must exceed the current price.')
  }
})
schema.index({ slug: 1 }, { unique: true })
schema.index({ sku: 1 }, { unique: true })
schema.index({ status: 1, category: 1, priceCents: 1, _id: 1 })
schema.index({ status: 1, featured: -1, createdAt: -1, _id: 1 })

export function createProductModel(connection = mongoose.connection) {
  return connection.models.Product ?? connection.model('Product', schema)
}

export function publicProduct(product, admin = false) {
  const { _id, name, slug, description, category, priceCents, compareAtPriceCents, currency, inventory, featured, badge, images, highlights, createdAt, updatedAt } = product
  return { id: String(_id), name, slug, description, category, priceCents, compareAtPriceCents, currency,
    inventory, featured, badge, images, highlights, createdAt, updatedAt,
    ...(admin ? { sku: product.sku, status: product.status, version: product.__v } : {}) }
}
