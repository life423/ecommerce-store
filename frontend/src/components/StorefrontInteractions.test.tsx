import { StrictMode } from 'react'
import { cleanup, fireEvent, render as baseRender, screen, waitFor } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Product } from '../lib/catalog'
import { FilterSheet } from './FilterSheet'
import { QuickView } from './QuickView'
import { ProductCard } from './ProductCard'
import { GrowingGuide } from './GrowingGuide'
import { CartProvider } from './CartProvider'
import type { ReactNode } from 'react'
const render = (ui: ReactNode) => baseRender(<CartProvider>{ui}</CartProvider>)

const product: Product = { id: '123', name: 'The Balcony Grow Box', slug: 'the-balcony-grow-box', description: 'A planter for your small kitchen garden.', category: 'Planters', priceCents: 6800, compareAtPriceCents: null, currency: 'usd', inventory: 12, featured: true, badge: '', images: [{ url: '/images/planter.jpg', alt: 'Terracotta planter with herbs' }], highlights: ['A matching tray'], createdAt: '', updatedAt: '' }
const current = { category: '', inStock: false, sort: 'featured' }
const categories = [{ name: 'Planters', count: 1 }]
const nativeShow = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal')
const nativeClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close')

// jsdom has no dialog lifecycle. This shim tests React state/cleanup only;
// native focus containment, Escape, and scrolling are verified in the browser.
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
beforeEach(() => vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true }))))
afterEach(() => { cleanup(); vi.unstubAllGlobals(); document.body.style.overflow = '' })

describe('storefront interactions', () => {
  it('flips product faces with an explicit control and Escape while keeping price and product links available', () => {
    render(<ProductCard product={product} onQuickView={() => {}} />)
    const flip = screen.getByRole('button', { name: `Show details for ${product.name}` })
    expect(screen.queryByRole('button', { name: 'Add to bag' })).not.toBeInTheDocument()
    fireEvent.click(flip)
    expect(flip).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Add to bag' })).toBeEnabled()
    expect(screen.getByText('$68')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: product.name })).toBeInTheDocument()
    fireEvent.keyDown(flip, { key: 'Escape' })
    expect(flip).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByRole('button', { name: 'Add to bag' })).not.toBeInTheDocument()
    expect(flip).toHaveFocus()
  })
  it('adapts the growing guide and collection link to the selected space', () => {
    render(<GrowingGuide onDismiss={() => {}} />)
    expect(screen.getByRole('button', { name: 'A windowsill' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'A balcony' }))
    expect(screen.getByRole('button', { name: 'A balcony' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('link', { name: 'Explore planters' })).toHaveAttribute('href', '/?category=Planters#collection')
    expect(screen.getByRole('heading', { name: 'Make a little room for green.' })).toBeInTheDocument()
  })
  it('keeps filter edits local until Show results, and resets the draft', async () => {
    const apply = vi.fn(), dismiss = vi.fn()
    const view = render(<FilterSheet categories={categories} current={current} onApply={apply} onDismiss={dismiss} />)
    fireEvent.click(screen.getByRole('button', { name: /Planters/ }))
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'price-asc' } })
    expect(apply).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Close filters' }))
    await waitFor(() => expect(dismiss).toHaveBeenCalledOnce())
    expect(apply).not.toHaveBeenCalled()
    view.unmount()
    render(<FilterSheet categories={categories} current={{ category: 'Planters', inStock: true, sort: 'price-desc' }} onApply={apply} onDismiss={dismiss} />)
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
    fireEvent.click(screen.getByRole('button', { name: 'Show results' }))
    expect(apply).toHaveBeenCalledWith(current)
  })

  it('applies category, stock and sort together', () => {
    const apply = vi.fn()
    render(<FilterSheet categories={categories} current={current} onApply={apply} onDismiss={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /Planters/ }))
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'price-asc' } })
    fireEvent.click(screen.getByRole('button', { name: 'Show results' }))
    expect(apply).toHaveBeenCalledWith({ category: 'Planters', inStock: true, sort: 'price-asc' })
  })

  it('fetches current prices and stock before displaying them in quick look', async () => {
    let respond!: (response: unknown) => void
    const fetchMock = vi.fn(() => new Promise(resolve => { respond = resolve }))
    vi.stubGlobal('fetch', fetchMock)
    render(<QuickView product={product} onDismiss={() => {}} />)
    expect(screen.getByRole('status')).toHaveTextContent('Getting a fresh look')
    expect(screen.queryByText('$68')).not.toBeInTheDocument()
    respond({ ok: true, json: async () => ({ product: { ...product, priceCents: 7200, inventory: 0 } }) })
    expect(await screen.findByText('$72')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Out of stock' })).toBeDisabled()
    expect(fetchMock).toHaveBeenCalledWith('/api/products/the-balcony-grow-box', expect.objectContaining({ signal: expect.any(AbortSignal) }))
  })

  it('allows retry after a quick-look failure and restores scroll and focus on cleanup in StrictMode', async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError('offline')).mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValue({ ok: true, json: async () => ({ product }) })
    vi.stubGlobal('fetch', fetchMock)
    const trigger = document.createElement('button')
    document.body.append(trigger)
    trigger.focus()
    document.body.style.overflow = 'scroll'
    const dismiss = vi.fn()
    const view = baseRender(<StrictMode><CartProvider><QuickView product={product} onDismiss={dismiss} /></CartProvider></StrictMode>)
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not connect')
    expect(dismiss).not.toHaveBeenCalled()
    expect(document.body.style.overflow).toBe('hidden')
    fireEvent.click(screen.getByRole('button', { name: /Try again/ }))
    expect(await screen.findByText('$68')).toBeInTheDocument()
    view.unmount()
    expect(document.body.style.overflow).toBe('scroll')
    expect(trigger).toHaveFocus()
    trigger.remove()
  })

  it('shows fetched photos and all facts in quick look, and resets close-up when a new photo is picked', async () => {
    const image = { url: '/images/planter-detail.jpg', alt: 'Close view of the drip tray' }
    const highlights = ['Terracotta planter', 'Matching drip tray', 'Fits a small balcony', 'Plants sold separately']
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ product: { ...product, images: [...product.images, image], highlights } }),
    }))
    render(<QuickView product={product} onDismiss={() => {}} />)

    const secondPhoto = await screen.findByRole('button', { name: `View photo 2: ${image.alt}` })
    const closeUp = screen.getByRole('button', { name: 'Close-up' })
    fireEvent.click(closeUp)
    expect(closeUp).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(secondPhoto)
    expect(secondPhoto).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('img', { name: image.alt })).toHaveAttribute('src', image.url)
    expect(closeUp).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('region', { name: 'At a glance' })).toHaveTextContent('Plants sold separately')
  })
})
