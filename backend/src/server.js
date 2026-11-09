import mongoose from 'mongoose'
import { createApp } from './app.js'
import { readConfig } from './config.js'
import { createProductModel } from './catalog/product.js'
import { createHomepageModel } from './catalog/homepage.js'
import Stripe from 'stripe'
import { createOrderModel } from './commerce/order.js'
import { createCommerce } from './commerce/service.js'
import { createStaffModels } from './staff/accounts.js'

let config
try {
  config = readConfig()
} catch (error) {
  console.error(error.message)
  process.exit(1)
}

mongoose.set('bufferCommands', false)

if (config.mongoUri) {
  try {
    await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 5000 })
    console.log('MongoDB connected')
  } catch {
    // Never log connection URIs: they can include credentials.
    console.error('MongoDB connection failed. Check MONGO_URI and database availability.')
    process.exit(1)
  }
} else {
  console.log('MONGO_URI is unset; database features are disabled.')
}

const Product = createProductModel()
const HomepageSelection = createHomepageModel()
const Order = createOrderModel()
const staffModels = config.nodeEnv === 'production' ? {} : createStaffModels()
if (config.mongoUri) await Promise.all([Product, HomepageSelection, Order, ...Object.values(staffModels)].map(model => model.init()))
const stripe = config.stripeSecretKey ? new Stripe(config.stripeSecretKey, { timeout: 10_000, maxNetworkRetries: 2 }) : null
const commerce = createCommerce({ Product, Order, stripe, storeUrl: config.storeUrl, webhookSecret: config.webhookSecret })
console.log(commerce.enabled ? 'Stripe test checkout enabled' : 'Stripe test checkout awaiting server configuration')
const app = createApp({
  productModel: Product,
  homepageModel: HomepageSelection,
  orderModel: Order,
  staffModels,
  nodeEnv: config.nodeEnv,
  commerce, storeUrl: config.storeUrl,
  editorEnabled: config.editorEnabled,
  databaseStatus: () => !config.mongoUri
    ? 'disabled'
    : mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
})

const server = app.listen(config.port, config.host, () => {
  console.log(`Store API listening on http://${config.host}:${config.port}`)
})

let recovering = false
async function recoverCheckouts() {
  if (recovering || mongoose.connection.readyState !== 1) return
  recovering = true
  try { await commerce.recover() } catch { console.error('Checkout recovery will retry') }
  finally { recovering = false }
}
const recoveryTimer = setInterval(() => void recoverCheckouts(), 30_000)
recoveryTimer.unref()
void recoverCheckouts()

server.on('error', async (error) => {
  console.error(`API failed to listen: ${error.code ?? 'unknown error'}`)
  await mongoose.disconnect()
  process.exit(1)
})

let shuttingDown = false
function shutdown(signal) {
  if (shuttingDown) return
  shuttingDown = true
  clearInterval(recoveryTimer)
  console.log(`${signal}: shutting down`)
  const deadline = setTimeout(() => process.exit(1), 10_000)
  deadline.unref()
  server.close(async () => {
    try {
      await mongoose.disconnect()
      clearTimeout(deadline)
      process.exit(0)
    } catch {
      console.error('Database disconnect failed')
      process.exit(1)
    }
  })
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
