import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { centsFromInput, money } from './lib/catalog'

const product = { id: '123', name: 'The Balcony Grow Box', slug: 'the-balcony-grow-box', sku: 'RW-BOX-01', description: 'A beautiful planter for growing a small kitchen garden.', category: 'Planters', priceCents: 6800, compareAtPriceCents: null, currency: 'usd', inventory: 12, status: 'active', version: 0, featured: true, badge: '', images: [{ url: '/images/planter.jpg', alt: 'Terracotta planter with herbs' }], highlights: ['A matching tray'], createdAt: '', updatedAt: '' }
const catalog = { categories: [{ name: 'Planters', count: 1 }, { name: 'Growing kits', count: 0 }], editorEnabled: true, databaseConnected: true, currency: 'usd', badges: ['', 'New'] }
const result = (items = [product]) => ({ items, pagination: { page: 1, limit: 6, total: items.length, pages: 1 } })
function mockApi(handler?: (url: string, options?: RequestInit) => unknown) {
  const mock = vi.fn(async (url: string, options?: RequestInit) => ({ ok: true, status: 200, json: async () => url === '/api/catalog' ? catalog : handler ? handler(url, options) : result() }))
  vi.stubGlobal('fetch', mock)
  return mock
}
beforeEach(() => window.history.replaceState(null, '', '/'))

describe('storefront catalog', () => {
  it('restores an initial section anchor after React renders and focuses the search field', async () => {
    const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView')
    const scroll = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scroll })
    try {
      window.history.replaceState(null, '', '/#catalog-search')
      mockApi()
      render(<App />)
      await waitFor(() => expect(scroll).toHaveBeenCalledWith({ behavior: 'instant', block: 'start' }))
      expect(screen.getByRole('searchbox')).toHaveFocus()
    } finally {
      if (original) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', original)
      else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView')
    }
  })
  it('renders actual API products and sends category and stock filters to the server', async () => {
    const fetchMock = mockApi()
    render(<App />)
    const collection = within(screen.getByRole('region', { name: 'Shop the collection.' }))
    expect(await collection.findByRole('heading', { name: product.name })).toBeInTheDocument()
    expect(collection.getByText('$68')).toBeInTheDocument()
    const featured = within(await screen.findByRole('article', { name: 'Featured product' }))
    expect(featured.getByRole('link', { name: product.name })).toHaveAttribute('href', '/products/the-balcony-grow-box')
    expect(featured.getByText('$68')).toBeInTheDocument()
    expect(featured.getByRole('button', { name: 'Add to bag' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Filter by Planters' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => url.includes('category=Planters'))).toBe(true))
    fireEvent.click(screen.getByRole('checkbox', { name: 'In stock only' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => url.includes('category=Planters') && url.includes('inStock=true'))).toBe(true))
  })
  it('offers recovery when the catalog fails and displays an empty result honestly', async () => {
    let fails = true
    mockApi(() => { if (fails) throw new TypeError('offline'); return result([]) })
    render(<App />)
    expect(await screen.findByRole('alert')).toHaveTextContent('A little pause')
    fails = false
    fireEvent.click(screen.getByRole('button', { name: /Try again/ }))
    expect(await screen.findByText('Nothing growing here. Yet.')).toBeInTheDocument()
  })
  it('opens a shareable space filter and removes it without clearing the category', async () => {
    window.history.replaceState(null, '', '/?space=balcony&category=Planters')
    const fetchMock = mockApi()
    render(<App />)

    expect(screen.getByRole('link', { name: /the windowsill/i })).toHaveAttribute('href', '/?space=windowsill#collection')
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => url.includes('space=balcony') && url.includes('category=Planters'))).toBe(true))
    fireEvent.click(screen.getByRole('button', { name: 'Remove the balcony filter' }))
    await waitFor(() => {
      const [lastRequest] = fetchMock.mock.calls.slice(-1)
      expect(lastRequest?.[0]).toContain('category=Planters')
      expect(lastRequest?.[0]).not.toContain('space=')
    })
    expect(window.location.search).not.toContain('space=')
  })
  it('debounces search and keeps the selected filters in the URL', async () => {
    const fetchMock = mockApi()
    render(<App />)
    await screen.findByRole('heading', { name: product.name })
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'basil' } })
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => url.includes('q=basil'))).toBe(true))
    expect(window.location.search).toContain('q=basil')
  })
  it('shows the product detail and out-of-stock state without a fake purchase action', async () => {
    window.history.replaceState(null, '', '/products/the-balcony-grow-box')
    mockApi(() => ({ product: { ...product, inventory: 0 } }))
    render(<App />)
    expect(await screen.findByRole('heading', { name: product.name })).toBeInTheDocument()
    expect(screen.getByText(/out of stock/)).toBeInTheDocument()
    expect(screen.getByText(/No real charges or shipments/)).toBeInTheDocument()
  })
})

describe('product studio', () => {
  it('opens the editor for a signed-in staff member and saves a draft in cents', async () => {
    window.history.replaceState(null, '', '/studio')
    let saved: Record<string, unknown> | undefined
    const fetchMock = mockApi((url, options) => {
      if (url === '/api/admin/session') return { staff: { username: 'test-owner', expiresAt: new Date(Date.now() + 60000).toISOString() } }
      if (options?.method === 'POST') { saved = JSON.parse(String(options.body)); return { product: { ...product, ...saved } } }
      return result([])
    })
    render(<App />)
    await screen.findByRole('heading', { name: 'A new good thing' })
    fireEvent.change(screen.getByLabelText('Product name'), { target: { value: 'A new planter' } })
    fireEvent.change(screen.getByLabelText('SKU'), { target: { value: 'RW-NEW-01' } })
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: product.description } })
    fireEvent.change(screen.getByLabelText('Price · USD'), { target: { value: '19.99' } })
    fireEvent.change(screen.getByLabelText('Image 1 URL'), { target: { value: '/images/planter.jpg' } })
    fireEvent.change(screen.getByLabelText('Image 1 description'), { target: { value: 'A planter' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create product' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Product created.')
    expect(saved?.priceCents).toBe(1999)
    expect(saved?.status).toBe('draft')
    expect(fetchMock.mock.calls.some(([url, options]) => url === '/api/admin/products' && options?.method === 'POST')).toBe(true)
  })
  it('rejects fractional cents before posting a product', async () => {
    expect(centsFromInput('19.99')).toBe(1999)
    expect(centsFromInput('0.29')).toBe(29)
    expect(centsFromInput('19.999')).toBe(null)
    expect(centsFromInput('1e3')).toBe(null)
    expect(money(1999)).toBe('$19.99')
  })
})
