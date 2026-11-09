import mongoose from 'mongoose'
import { access } from 'node:fs/promises'
import { readConfig } from '../config.js'
import { createProductModel, validateProduct } from './product.js'
import { sampleProducts } from './samples.js'
import { expandedSampleProducts } from './expanded-samples.js'

const config = readConfig()
if (!config.mongoUri) throw new Error('Set MONGO_URI before seeding the catalog. See backend/.env.example.')
if (config.nodeEnv === 'production') throw new Error('Demo products cannot be seeded in production.')

const products = [...sampleProducts, ...expandedSampleProducts].map(validateProduct)
const publicDirectory = new URL('../../../frontend/public/', import.meta.url)
await Promise.all(expandedSampleProducts.flatMap(({ images: [{ url }] }) => {
  const path = url.slice(1)
  return [path, path.replace(/\.jpg$/, '-480.jpg')].map(file => access(new URL(file, publicDirectory)))
}))

try {
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 5000 })
  const Product = createProductModel()
  await Product.init()
  let added = 0
  for (const data of products) {
    const now = new Date()
    const result = await Product.updateOne(
      { sku: data.sku },
      { $setOnInsert: { ...data, __v: 0, createdAt: now, updatedAt: now } },
      { upsert: true, runValidators: true, timestamps: false },
    )
    added += result.upsertedCount
  }
  console.log(`Added ${added} REWILD demo products. Existing products were preserved.`)
} finally {
  await mongoose.disconnect()
}
