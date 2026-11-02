import { useEffect, useState } from 'react'
import { api, ApiError, money } from '../lib/catalog'
import { useCart } from '../lib/cartContext'
import { CatalogImage } from '../components/CatalogImage'
import { Icon } from '../components/Icon'
import { clearCheckout, readCheckout } from '../lib/checkoutAttempt'

export type CheckoutOrder = { id: string; reference: string; state: 'creating' | 'open' | 'paid' | 'expired' | 'failed'; totalCents: number; testMode: true; checkoutUrl: string | null; items: { productId: string; name: string; slug: string; image: { url: string; alt: string }; unitPriceCents: number; quantity: number }[] }
export function CheckoutPage({ cancel }: { cancel: boolean }) {
  const params = new URLSearchParams(window.location.search)
  const id = params.get('order_id') ?? '', token = params.get('token') ?? ''
  const [order, setOrder] = useState<CheckoutOrder | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)
  const { completePurchase, open } = useCart()
  useEffect(() => {
    let active = true, timer: ReturnType<typeof setTimeout>
    let polls = 0
    async function check() {
      try {
        const result = await api<{ order: CheckoutOrder }>(`/checkout/${encodeURIComponent(id)}${cancel ? '/cancel' : ''}`, { ...(cancel ? { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{}' } : { headers: { Authorization: `Bearer ${token}` } }) })
        if (!active) return
        setOrder(result.order); setError(null); setLoading(false)
        if (['paid', 'expired', 'failed'].includes(result.order.state) && readCheckout()?.orderId === id) clearCheckout()
        if (result.order.state === 'paid') completePurchase(result.order.id, result.order.items)
        else if (['creating', 'open'].includes(result.order.state) && !cancel && polls++ < 6) timer = setTimeout(() => void check(), 2000)
      } catch (error) {
        if (active) { setError(error instanceof ApiError ? error.message : 'We could not check this payment yet.'); setLoading(false) }
      }
    }
    void check()
    return () => { active = false; clearTimeout(timer) }
  }, [id, token, cancel, attempt, completePurchase])
  const paid = order?.state === 'paid'
  const cancelled = order?.state === 'expired' || order?.state === 'failed'
  return <main className="page-width checkout-page"><div className="checkout-progress" aria-label="Checkout progress"><span><Icon name="check" size={14} /> Your bag</span><i /><span><Icon name={paid ? 'check' : 'lock'} size={14} /> Test checkout</span><i /><span className={paid ? 'is-complete' : ''}>A greener beginning</span></div>
    <section className="checkout-result"><div className={`checkout-result-symbol ${paid ? 'is-paid' : ''}`}><Icon name={paid ? 'check' : cancelled ? 'leaf' : 'lock'} size={34} /></div><span className="eyebrow">{paid ? 'A SMALL BEGINNING. A GOOD FEELING.' : cancelled ? 'NO RUSH. GOOD THINGS TAKE TIME.' : 'YOUR LITTLE GARDEN'}</span><h1>{loading ? 'Checking your checkout…' : error ? 'A little pause.' : paid ? <>You’re growing<br /><em>good things.</em></> : cancelled ? <>Your garden<br /><em>can wait.</em></> : <>One little<br /><em>moment.</em></>}</h1>
      <p>{error ?? (paid ? 'Your test payment is confirmed. A little practice for something bigger.' : cancelled ? 'Checkout was cancelled or expired. Your bag is still here, ready whenever you are.' : 'We’re checking with Stripe. Your bag stays saved until payment is confirmed.')}</p>
      <div className="checkout-demo-note"><span className="test-mode-pill">STRIPE TEST MODE</span><span>No real charge. No shipment.</span></div>
      {!loading && !paid && <div className="checkout-result-actions"><button className="button button-dark" onClick={open}>Back to your bag <Icon name="arrow" size={18} /></button>{!cancelled && <button className="text-link" onClick={() => { setLoading(true); setAttempt(value => value + 1) }}>Check again</button>}</div>}
      {paid && <a className="button button-dark" href="/#collection">Keep growing <Icon name="arrow" size={18} /></a>}
    </section>
    {order && <aside className="checkout-receipt"><div className="receipt-heading"><span className="eyebrow">{paid ? 'YOUR TEST ORDER' : 'YOUR GOOD THINGS'}</span><span>{order.reference}</span></div><ul>{order.items.map(item => <li key={item.productId}><CatalogImage src={item.image.url} alt={item.image.alt} width="80" height="80" sizes="72px" /><div><a href={`/products/${item.slug}`}>{item.name}</a><small>Quantity {item.quantity}</small></div><span>{money(item.unitPriceCents * item.quantity)}</span></li>)}</ul><div className="receipt-total"><span>{paid ? 'Test payment total' : 'Bag total'} <small>USD</small></span><strong>{money(order.totalCents)}</strong></div><p>Demo shipping included. Tax not applied. Fictional products, real practice.</p></aside>}
  </main>
}
