import assert from 'node:assert/strict'
import { once } from 'node:events'
import { after, before, test } from 'node:test'
import { createApp } from '../src/app.js'
import { readConfig } from '../src/config.js'

let server
let baseUrl
let database = 'disabled'

before(async () => {
  server = createApp({ databaseStatus: () => database }).listen(0, '127.0.0.1')
  await once(server, 'listening')
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(() => new Promise((resolve, reject) => {
  server.close(error => error ? reject(error) : resolve())
}))

test('liveness returns JSON, disables caching, and applies security headers', async () => {
  const response = await fetch(`${baseUrl}/api/health`)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { status: 'ok', service: 'store-api' })
  assert.equal(response.headers.get('x-powered-by'), null)
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
  assert.equal(response.headers.get('cache-control'), 'no-store')
})

test('readiness distinguishes an optional database from a disconnected required one', async () => {
  for (const [state, status] of [['disabled', 200], ['connected', 200], ['disconnected', 503]]) {
    database = state
    const response = await fetch(`${baseUrl}/api/ready`)
    assert.equal(response.status, status)
    assert.deepEqual(await response.json(), {
      status: status === 200 ? 'ready' : 'not_ready', database: state,
    })
  }
  database = 'disabled'
})

test('unknown routes return a consistent JSON error', async () => {
  const response = await fetch(`${baseUrl}/api/missing`)
  assert.equal(response.status, 404)
  assert.deepEqual(await response.json(), { error: { code: 'NOT_FOUND', message: 'Route not found' } })
})

test('malformed and oversized bodies are rejected without exposing a stack trace', async () => {
  for (const [body, status, code] of [
    ['{"broken":', 400, 'INVALID_JSON'],
    [JSON.stringify({ value: 'x'.repeat(17_000) }), 413, 'BODY_TOO_LARGE'],
  ]) {
    const response = await fetch(`${baseUrl}/api/example`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
    })
    assert.equal(response.status, status)
    const payload = await response.json()
    assert.equal(payload.error.code, code)
    assert.equal(payload.error.stack, undefined)
  }
})

test('configuration rejects invalid ports, environments, and database schemes', () => {
  assert.equal(readConfig({}).port, 3000)
  assert.equal(readConfig({}).mongoUri, undefined)
  for (const port of ['', '0', '65536', '1.5', 'abc']) {
    assert.throws(() => readConfig({ PORT: port }), /PORT/)
  }
  assert.throws(() => readConfig({ NODE_ENV: 'prod' }), /NODE_ENV/)
  assert.throws(() => readConfig({ MONGO_URI: 'https://example.com' }), /MONGO_URI/)
  assert.equal(readConfig({ MONGO_URI: 'mongodb://localhost/store' }).mongoUri, 'mongodb://localhost/store')
})
