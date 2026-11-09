import { useEffect, useState } from 'react'
import { money } from '../lib/catalog'
import { useResource } from '../lib/useResource'
import { Icon } from '../components/Icon'

const states = {
  creating: 'Preparing checkout',
  open: 'Awaiting payment',
  paid: 'Paid',
  expired: 'Expired',
  failed: 'Checkout failed',
}
type OrderState = keyof typeof states
type Order = {
  id: string
  reference: string
  state: OrderState
  currency: 'usd'
  totalCents: number
  createdAt: string
  paidAt: string | null
  items: { name: string; quantity: number; unitPriceCents: number }[]
}
type OrderPage = { items: Order[]; page: number; pages: number; total: number }
const formatDate = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

export function StaffOrders({ onSessionExpired }: { onSessionExpired: () => void }) {
  const [state, setState] = useState('')
  const [page, setPage] = useState(1)
  const [attempt, setAttempt] = useState(0)
  const params = new URLSearchParams({ page: String(page) })
  if (state) params.set('state', state)
  const { data, error, loading } = useResource<OrderPage>(`/admin/orders?${params}`, attempt)
  useEffect(() => { if (error?.status === 401) onSessionExpired() }, [error, onSessionExpired])

  return <section aria-labelledby="staff-orders-title">
    <div className="studio-heading">
      <div><span className="eyebrow">STRIPE TEST MODE</span><h1 id="staff-orders-title">Test orders</h1>
        <p>Review orders recorded by REWILD and their latest recorded payment status.</p></div>
      <button className="button button-secondary" type="button" disabled={loading} onClick={() => setAttempt(value => value + 1)}>Refresh orders</button>
    </div>
    <div className="staff-order-tools">
      <label>Payment status<select value={state} onChange={event => { setState(event.target.value); setPage(1) }}>
        <option value="">All statuses</option>
        {Object.entries(states).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      {!loading && data && <span role="status">{data.total} {data.total === 1 ? 'order' : 'orders'}</span>}
    </div>
    {loading ? <p className="staff-orders-notice" role="status">Loading test orders…</p>
      : error ? <p className="error-notice" role="alert">{error.message}</p>
        : data?.items.length ? <ul className="staff-order-list" aria-label="Test orders">
          {data.items.map(order => <li key={order.id}><OrderCard order={order} /></li>)}
        </ul>
          : <p className="staff-orders-notice">{state ? 'No test orders match this status.' : 'Test checkouts will appear here once they’re started.'}</p>}
    {!loading && data && (data.pages > 1 || page > 1) && <nav className="pagination" aria-label="Order pages">
      <button type="button" disabled={page === 1} onClick={() => setPage(value => value - 1)}>Previous</button>
      <span>Page {data.page} of {Math.max(data.pages, 1)}</span>
      <button type="button" disabled={page >= data.pages} onClick={() => setPage(value => value + 1)}>Next</button>
    </nav>}
  </section>
}

function OrderCard({ order }: { order: Order }) {
  return <details className="staff-order">
    <summary>
      <span><strong>{order.reference}</strong><time dateTime={order.createdAt}>{formatDate.format(new Date(order.createdAt))}</time></span>
      <span className={`staff-payment-status payment-${order.state}`}>{states[order.state]}</span>
      <span className="staff-order-amount">{money(order.totalCents)} <small>{order.currency.toUpperCase()}</small></span>
      <Icon name="plus" size={18} />
    </summary>
    <div className="staff-order-details">
      <ul aria-label="Order items">
        {order.items.map((item, index) => <li key={index}>
          <span>{item.quantity} × {item.name}</span><span>{money(item.unitPriceCents * item.quantity)}</span>
        </li>)}
      </ul>
      {order.paidAt && <p>Payment verified <time dateTime={order.paidAt}>{formatDate.format(new Date(order.paidAt))}</time></p>}
    </div>
  </details>
}
