import { useEffect, useId, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { api, ApiError, money } from '../lib/catalog'
import { useCart } from '../lib/cartContext'
import { useCartQuote } from '../lib/useCartQuote'
import { CatalogImage } from './CatalogImage'
import { Icon } from './Icon'
import { Modal } from './Modal'
import { QuantityControl } from './QuantityControl'
import { useDismissDialog } from './dialogContext'
import { clearCheckout, readCheckout, saveCheckout } from '../lib/checkoutAttempt'
import type { CheckoutAttempt } from '../lib/checkoutAttempt'
import type { CheckoutOrder } from '../pages/CheckoutPage'

export function CartDrawer({ onDismiss }: { onDismiss: () => void }) {
  const titleId = useId()
  return <Modal labelledBy={titleId} closeLabel="Close bag" className="cart-modal" onDismiss={onDismiss}><CartContent titleId={titleId} /></Modal>
}
function CartContent({ titleId }: { titleId: string }) {
  const cart = useCart(), dismiss = useDismissDialog()
  const { completePurchase } = cart
  const [refresh, setRefresh] = useState(0)
  const { quote, loading, error } = useCartQuote(cart.items, refresh)
  const [checkingOut, setCheckingOut] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [pending, setPending] = useState<CheckoutAttempt | null>(readCheckout)
  const [pendingOrder, setPendingOrder] = useState<CheckoutOrder | null>(null)
  const [pendingLoading, setPendingLoading] = useState(Boolean(pending?.orderId))
  const attempt = useRef<CheckoutAttempt | null>(pending)
  const busy = useRef(false)
  const visibleItems = pendingOrder?.items ?? cart.items
  const count = visibleItems.reduce((total, item) => total + item.quantity, 0)

  useEffect(() => {
    if (!pending?.orderId || !pending.token) return
    let active = true
    api<{ order: CheckoutOrder }>(`/checkout/${pending.orderId}`, { headers: { Authorization: `Bearer ${pending.token}` } }).then(({ order }) => {
      if (!active) return
      if (order.state === 'paid') completePurchase(order.id, order.items)
      if (['paid', 'expired', 'failed'].includes(order.state)) { clearCheckout(); attempt.current = null; setPending(null); setRefresh(value => value + 1) }
      else setPendingOrder(order)
    }).catch(() => { if (active) setCheckoutError('We could not check your existing checkout. Retry safely below.') })
      .finally(() => { if (active) setPendingLoading(false) })
    return () => { active = false }
  }, [pending, completePurchase])

  function navigate(url: string) {
    const destination = new URL(url)
    if (destination.protocol !== 'https:' || destination.hostname !== 'checkout.stripe.com') throw new Error('Invalid checkout destination')
    window.location.assign(url)
  }

  async function releaseCheckout() {
    if (!pending?.orderId || !pending.token || busy.current) return
    busy.current = true; setCheckingOut(true); setCheckoutError(null)
    try {
      const { order } = await api<{ order: CheckoutOrder }>(`/checkout/${pending.orderId}/cancel`, { method: 'POST', headers: { Authorization: `Bearer ${pending.token}`, 'Content-Type': 'application/json' }, body: '{}' })
      if (order.state === 'paid') completePurchase(order.id, order.items)
      if (!['paid', 'expired', 'failed'].includes(order.state)) throw new Error('Checkout is still open')
      clearCheckout(); attempt.current = null; setPending(null); setPendingOrder(null); setRefresh(value => value + 1)
    } catch { setCheckoutError('We could not release this checkout yet. Please try again.') }
    finally { busy.current = false; setCheckingOut(false) }
  }

  async function checkout() {
    if (busy.current || pendingLoading || !quote?.checkoutEnabled || (!pending && (loading || !quote.canCheckout))) return
    busy.current = true; setCheckingOut(true); setCheckoutError(null)
    if (pendingOrder?.state === 'open' && pendingOrder.checkoutUrl) { navigate(pendingOrder.checkoutUrl); return }
    if (!attempt.current) attempt.current = { id: crypto.randomUUID(), items: cart.items, fingerprint: quote.fingerprint }
    saveCheckout(attempt.current)
    setPending(attempt.current)
    try {
      const result = await api<{ url: string; orderId: string; token: string }>('/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: attempt.current.items, fingerprint: attempt.current.fingerprint, attemptId: attempt.current.id }) })
      attempt.current = { ...attempt.current, orderId: result.orderId, token: result.token }
      saveCheckout(attempt.current)
      navigate(result.url)
    } catch (error) {
      setCheckoutError(error instanceof ApiError ? error.message : 'Checkout could not open. Please try again.')
      if (error instanceof ApiError && [409, 422].includes(error.status) && error.code !== 'CHECKOUT_BUSY') { attempt.current = null; clearCheckout(); setPending(null) }
      setRefresh(value => value + 1)
      busy.current = false; setCheckingOut(false)
    }
  }

  return <>
    <div className="cart-heading"><span className="eyebrow">YOUR NEXT SMALL BEGINNING</span><h2 id={titleId}>Your little garden<span>.</span></h2><p><Icon name="leaf" size={15} /><span>{count} {count === 1 ? 'good thing' : 'good things'} {pendingOrder ? 'reserved for checkout' : 'in your bag'}</span></p></div>
    {cart.items.length === 0 && !pending ? <div className="cart-empty"><div className="cart-empty-art"><Icon name="leaf" size={55} /><span /><span /></div><span className="eyebrow">A LITTLE ROOM FOR POSSIBILITY</span><h3>Good things<br />start with one.</h3><p>A growing kit. A few seeds. Your next little ritual is waiting.</p><button className="button button-dark" onClick={() => dismiss()}>Keep exploring <Icon name="arrow" size={18} /></button></div>
      : <>
        <div className="cart-scroll"><div className="cart-test-note"><Icon name="spark" size={20} /><p>A little practice. Zero real charges.<span>This bag uses Stripe test checkout.</span></p></div>
          {pending && <div className="cart-pending" role="status"><strong>{pendingLoading ? 'Checking your existing checkout…' : pendingOrder ? 'Your test checkout is waiting.' : 'Let’s finish opening your checkout.'}</strong><p>{pendingOrder ? `${pendingOrder.items.reduce((n, line) => n + line.quantity, 0)} reserved good things · ${money(pendingOrder.totalCents)}. Continue at the original prices or release them to edit your bag.` : 'Retrying safely reuses the same checkout. Your saved bag is kept.'}</p>{pending.orderId && <button disabled={checkingOut || pendingLoading} onClick={() => void releaseCheckout()}>Release & edit bag <Icon name="back" size={14} /></button>}</div>}
          {error && <div className="cart-error" role="alert"><p>{error}</p><button className="text-link" onClick={() => setRefresh(value => value + 1)}>Refresh bag <Icon name="arrow" size={16} /></button></div>}
          <ul className="cart-lines" aria-label="Bag items" aria-busy={loading} inert={pending ? true : undefined}>{visibleItems.map((item, index) => {
            const line = quote?.items.find(line => line.productId === item.productId)
            const reserved = pendingOrder?.items.find(line => line.productId === item.productId)
            const product = reserved ? { name: reserved.name, slug: reserved.slug, priceCents: reserved.unitPriceCents, images: [reserved.image], category: line?.product?.category ?? 'Reserved good thing' } : line?.product
            const name = product?.name ?? (loading ? 'Getting your good thing…' : 'Unavailable product')
            return <li className="cart-line" key={item.productId} style={{ '--line-delay': `${Math.min(index * 65, 260)}ms` } as CSSProperties}>
              <div className="cart-line-image">{product ? <a href={`/products/${product.slug}`}><CatalogImage src={product.images[0].url} alt={product.images[0].alt} width="120" height="140" sizes="100px" /></a> : <Icon name="leaf" size={28} />}</div>
              <div className="cart-line-copy"><span className="eyebrow">{product?.category ?? 'REWILD'}</span><h3>{product ? <a href={`/products/${product.slug}`}>{product.name}</a> : name}</h3><span className="cart-unit-price">{product ? money(product.priceCents) : '—'} <small>each</small></span><div className="cart-line-controls"><QuantityControl name={name} quantity={item.quantity} max={line?.maxQuantity ?? 10} onChange={quantity => cart.setQuantity(item.productId, quantity)} /><button className="cart-remove" aria-label={`Remove ${name} from bag`} onClick={() => cart.setQuantity(item.productId, 0)}>Remove</button></div>
                {line?.issue && !loading && !pending && <p className="cart-line-issue">{line.issue}{line.maxQuantity > 0 && item.quantity > line.maxQuantity && <button onClick={() => cart.setQuantity(item.productId, line.maxQuantity)}>Use {line.maxQuantity}</button>}</p>}
              </div>
            </li>
          })}</ul>
          <details className="cart-delivery"><summary><span><Icon name="box" size={18} /> Shipping & the little details</span><Icon name="plus" size={16} /></summary><div><p>Complimentary demo shipping to US addresses. Tax is not applied in this test store.</p><p>Use test contact and address details at checkout. These fictional products will never ship.</p></div></details>
          {!cart.storageAvailable && <p className="cart-line-issue">Your browser could not save this bag. Keep this tab open while you shop.</p>}
        </div>
        <div className="cart-footer"><div className="cart-subtotal"><span>{pendingOrder ? 'Reserved subtotal' : 'Bag subtotal'} <small>USD</small></span><strong key={loading ? 'refreshing' : quote?.totalCents}>{pendingOrder ? money(pendingOrder.totalCents) : loading ? 'Updating…' : quote ? money(quote.totalCents) : '—'}</strong></div><div className="cart-shipping-row"><span>Demo shipping</span><span>On us</span></div>
          <div role="status" className="cart-status">{pending ? 'Continue safely, or release your reserved items to edit.' : loading ? 'Checking the latest prices & availability…' : !quote?.canCheckout && !error ? 'A little update is needed above before checkout.' : !quote?.checkoutEnabled && !error ? 'Test checkout is being connected. Your bag stays saved.' : 'A little green, one step closer.'}</div>
          {checkoutError && <p className="cart-checkout-error" role="alert">{checkoutError}</p>}
          <button className="button button-dark checkout-button" disabled={pendingLoading || checkingOut || !quote?.checkoutEnabled || (!pending && (loading || !quote.canCheckout))} onClick={() => void checkout()}>{checkingOut ? <><span className="loading-dot" /> Opening Stripe…</> : <><Icon name="lock" size={17} /><span>{pending ? 'Continue test checkout' : 'Test checkout'}</span><Icon name="arrow" size={18} /></>}</button>
          <div className="checkout-trust"><span>Secure checkout with <strong>stripe</strong></span><span className="test-mode-pill">TEST MODE</span></div>
        </div>
      </>}
  </>
}
