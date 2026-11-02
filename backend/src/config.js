export function readConfig(env = process.env) {
  const port = Number(env.PORT ?? 3000)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535')
  }

  const nodeEnv = env.NODE_ENV ?? 'development'
  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    throw new Error('NODE_ENV must be development, test, or production')
  }

  const mongoUri = env.MONGO_URI?.trim() || undefined
  if (mongoUri && !/^mongodb(?:\+srv)?:\/\//.test(mongoUri)) {
    throw new Error('MONGO_URI must be a MongoDB connection URI')
  }

  if (env.ENABLE_CATALOG_EDITOR && !['true', 'false'].includes(env.ENABLE_CATALOG_EDITOR)) {
    throw new Error('ENABLE_CATALOG_EDITOR must be true or false')
  }
  if (nodeEnv === 'production' && env.ENABLE_CATALOG_EDITOR === 'true') {
    throw new Error('The local catalog editor cannot be enabled in production')
  }
  const stripeSecretKey = env.STRIPE_SECRET_KEY?.trim() || undefined
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET?.trim() || undefined
  if (stripeSecretKey && !/^(sk|rk)_test_[A-Za-z0-9]+$/.test(stripeSecretKey)) throw new Error('STRIPE_SECRET_KEY must be a test-mode secret or restricted key. Live payments are disabled.')
  if (webhookSecret && !/^whsec_[A-Za-z0-9]+$/.test(webhookSecret)) throw new Error('STRIPE_WEBHOOK_SECRET must be a webhook signing secret')
  const storeUrl = env.STORE_URL?.trim() || 'http://localhost:5173'
  let url
  try { url = new URL(storeUrl) } catch { throw new Error('STORE_URL must be a valid storefront origin') }
  if (!['http:', 'https:'].includes(url.protocol) || url.origin !== storeUrl || url.username || url.password || (url.protocol === 'http:' && !['localhost', '127.0.0.1'].includes(url.hostname))) throw new Error('STORE_URL must be an HTTPS origin or loopback HTTP origin, without a path or trailing slash')
  return { port, host: env.HOST || '127.0.0.1', nodeEnv, mongoUri, stripeSecretKey, webhookSecret, storeUrl, editorEnabled: nodeEnv === 'development' && env.ENABLE_CATALOG_EDITOR === 'true' }
}
