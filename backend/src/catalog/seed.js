import mongoose from 'mongoose'
import { readConfig } from '../config.js'
import { createProductModel, validateProduct } from './product.js'
import { sampleProducts } from './samples.js'

const config = readConfig()
if (!config.mongoUri) throw new Error('Set MONGO_URI before seeding the catalog. See backend/.env.example.')
if (config.nodeEnv === 'production') throw new Error('Demo products cannot be seeded in production.')
try {
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 5000 })
  const Product = createProductModel()
  await Product.init()
  let added = 0
  for (const sample of sampleProducts) {
    const data = validateProduct(sample)
    const result = await Product.updateOne({ sku: data.sku }, { $setOnInsert: { ...data, __v: 0 } }, { upsert: true, runValidators: true })
    added += result.upsertedCount
  }
  console.log(`Added ${added} REWILD demo products. Existing products were preserved.`)
} finally {
  await mongoose.disconnect()
}
