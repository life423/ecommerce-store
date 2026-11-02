import { spawn } from 'node:child_process'
import { readFile, writeFile, chmod } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

// Keep CLI credentials in its own store. Only the listener signing secret is
// written to this checkout's ignored server env file; never print it.
const envPath = fileURLToPath(new URL('../backend/.env', import.meta.url))
const child = spawn('stripe', ['listen', '--events', 'checkout.session.completed,checkout.session.expired,checkout.session.async_payment_succeeded', '--forward-to', 'http://127.0.0.1:3000/api/stripe/webhook'], { stdio: ['ignore', 'pipe', 'pipe'] })
let saved = false, buffer = ''
async function consume(chunk) {
  buffer = (buffer + chunk.toString()).slice(-8000)
  const secret = /whsec_[A-Za-z0-9]+/.exec(buffer)?.[0]
  if (secret && !saved) {
    saved = true
    let env = await readFile(envPath, 'utf8').catch(() => '')
    const line = `STRIPE_WEBHOOK_SECRET=${secret}`
    env = /^STRIPE_WEBHOOK_SECRET=.*$/m.test(env) ? env.replace(/^STRIPE_WEBHOOK_SECRET=.*$/m, line) : `${env.trimEnd()}\n${line}\n`
    await writeFile(envPath, env.trimStart(), { mode: 0o600 })
    await chmod(envPath, 0o600)
    console.log('Stripe test webhook forwarding is ready. Signing secret saved in ignored backend/.env. Restart the backend to load it (Docker: docker compose up -d --force-recreate backend).')
  }
  for (const line of chunk.toString().split('\n')) {
    if (/--> |<-- |ERROR|error/i.test(line)) console.log(line.replace(/whsec_[A-Za-z0-9]+/g, '[redacted]'))
  }
}
child.stdout.on('data', chunk => { void consume(chunk).catch(() => console.error('Could not save webhook configuration.')) })
child.stderr.on('data', chunk => { void consume(chunk).catch(() => console.error('Could not save webhook configuration.')) })
child.on('error', () => { console.error('Install the official Stripe CLI and run stripe login before starting the listener.'); process.exitCode = 1 })
child.on('exit', code => { if (!saved) console.error('Stripe listener stopped before it was ready. Check stripe login.'); process.exitCode = code ?? 1 })
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal))
