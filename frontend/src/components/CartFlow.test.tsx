import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { CART_KEY } from '../lib/cart'
import { CHECKOUT_KEY, clearCheckout } from '../lib/checkoutAttempt'

const id = '1234567890abcdef12345678'
const product = { id, name: 'The Balcony Grow Box', slug: 'the-balcony-grow-box', description: 'A planter for your small kitchen garden.', category: 'Planters', priceCents: 6800, compareAtPriceCents: null, currency: 'usd', inventory: 2, featured: true, badge: '', images: [{ url: '/images/planter.jpg', alt: 'Terracotta planter with herbs' }], highlights: ['A matching tray'], createdAt: '', updatedAt: '' }
const nativeShow = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal')
const nativeClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close')
beforeAll(() => Object.defineProperties(HTMLDialogElement.prototype, {
  showModal: { configurable: true, value(this: HTMLDialogElement) { this.setAttribute('open', '') } },
  close: { configurable: true, value(this: HTMLDialogElement) { this.removeAttribute('open'); queueMicrotask(() => this.dispatchEvent(new Event('close'))) } },
}))
afterAll(() => {
  for (const [name, descriptor] of [['showModal', nativeShow], ['close', nativeClose]] as const) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor)
    else Reflect.deleteProperty(HTMLDialogElement.prototype, name)
  }
})
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); clearCheckout(); window.history.replaceState(null, '', '/products/the-balcony-grow-box'); vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true }))) })
afterEach(() => vi.unstubAllGlobals())
const response = (data: unknown, status = 200) => ({ ok: status < 400, status, json: async () => data })
function mockApi(options: { inventory?: number; checkout?: (body: Record<string, unknown>) => unknown; order?: () => unknown; quoteFails?: () => boolean } = {}) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/catalog') return response({ categories: [], editorEnabled: false, databaseConnected: true, currency: 'usd', badges: [] })
    if (url.startsWith('/api/products/')) return response({ product: { ...product, inventory: options.inventory ?? 2 } })
    if (url === '/api/cart') {
      if (options.quoteFails?.()) return response({ error: { message: 'Bag service unavailable' } }, 503)
      const { items } = JSON.parse(String(init?.body))
      return response({ items: items.map((item: { productId: string; quantity: number }) => ({ ...item, product, maxQuantity: 2, issue: null, lineTotalCents: 6800 * item.quantity })), totalCents: items.reduce((total: number, item: { quantity: number }) => total + 6800 * item.quantity, 0), currency: 'usd', fingerprint: 'f'.repeat(64), canCheckout: items.length > 0, checkoutEnabled: true, testMode: true })
    }
    if (url === '/api/checkout') return options.checkout?.(JSON.parse(String(init?.body))) ?? response({ error: { code: 'CART_CHANGED', message: 'Prices or availability changed. Review your bag and try again.' } }, 409)
    if (url.startsWith('/api/checkout/')) return response({ order: options.order?.() })
    throw new Error(`Unexpected URL: ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}
async function addProduct() {
  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: 'Add to bag' }))
  const dialog = await screen.findByRole('dialog', { name: 'Your little garden.' })
  await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Test checkout' })).toBeEnabled())
  return dialog
}

describe('bag and checkout flow', () => {
  it('adds products, updates quantities and server totals, persists the bag, and removes explicitly', async () => {
    mockApi()
    const dialog = await addProduct()
    expect(within(dialog).getByText('1 good thing in your bag')).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: `Increase quantity of ${product.name}` }))
    expect(await within(dialog).findByText('$136')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: `Increase quantity of ${product.name}` })).toBeDisabled()
    expect(JSON.parse(localStorage.getItem(CART_KEY)!).items).toEqual([{ productId: id, quantity: 2 }])
    fireEvent.click(within(dialog).getByRole('button', { name: `Remove ${product.name} from bag` }))
    expect(within(dialog).getByRole('heading', { name: /Good things/ })).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Test checkout' })).not.toBeInTheDocument()
  })
  it('disables adding an unavailable product', async () => {
    mockApi({ inventory: 0 }); render(<App />)
    expect(await screen.findByRole('button', { name: 'Out of stock' })).toBeDisabled()
  })
  it('sends IDs and quantities only, and recovers honestly when the quote changes', async () => {
    const fetchMock = mockApi()
    const dialog = await addProduct()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Test checkout' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Prices or availability changed')
    const [, init] = fetchMock.mock.calls.find(([url]) => url === '/api/checkout')!
    const body = JSON.parse(String(init?.body))
    expect(Object.keys(body).sort()).toEqual(['attemptId', 'fingerprint', 'items'])
    expect(body.items).toEqual([{ productId: id, quantity: 1 }])
    expect(sessionStorage.getItem(CHECKOUT_KEY)).toBeNull()
  })
  it('reuses the checkout attempt after a network error, even when the drawer is reopened', async () => {
    const attemptIds: string[] = []
    mockApi({ checkout: body => { attemptIds.push(String(body.attemptId)); throw new TypeError('offline') } })
    const dialog = await addProduct()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Test checkout' }))
    await within(dialog).findByRole('alert')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close bag' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Open bag, 1 item' }))
    const continueCheckout = await screen.findByRole('button', { name: 'Continue test checkout' })
    await waitFor(() => expect(continueCheckout).toBeEnabled())
    fireEvent.click(continueCheckout)
    await waitFor(() => expect(attemptIds.length).toBe(2))
    expect(new Set(attemptIds).size).toBe(1)
  })
  it('allows retry when current bag data is unavailable', async () => {
    let failed = true
    mockApi({ quoteFails: () => failed })
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Add to bag' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Bag service unavailable')
    expect(screen.getByRole('button', { name: 'Test checkout' })).toBeDisabled()
    failed = false
    fireEvent.click(screen.getByRole('button', { name: /Refresh bag/ }))
    expect(await screen.findByText('$68')).toBeInTheDocument()
  })
  it('keeps the bag on an unverified success URL and clears purchased quantities only after server confirmation', async () => {
    let paid = false
    localStorage.setItem(CART_KEY, JSON.stringify({ items: [{ productId: id, quantity: 2 }], completedOrders: [] }))
    window.history.replaceState(null, '', '/checkout/success?order_id=test-order&token=secret')
    mockApi({ order: () => ({ id: 'test-order', reference: 'RW-TEST', state: paid ? 'paid' : 'open', totalCents: 6800, checkoutUrl: null, testMode: true, items: [{ productId: id, name: product.name, slug: product.slug, image: product.images[0], unitPriceCents: 6800, quantity: 1 }] }) })
    render(<App />)
    await screen.findByRole('button', { name: 'Check again' })
    expect(screen.getByRole('button', { name: 'Open bag, 2 items' })).toBeInTheDocument()
    paid = true
    fireEvent.click(screen.getByRole('button', { name: 'Check again' }))
    expect(await screen.findByRole('heading', { name: /You’re growing/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open bag, 1 item' })).toBeInTheDocument()
  })
})
