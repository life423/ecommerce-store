import { useEffect, useState } from 'react'
import type { Product } from './catalog'
import { api, ApiError } from './catalog'
import type { CartItem } from './cart'

export type CartQuote = { items: (CartItem & { product: Product | null; maxQuantity: number; issue: string | null; lineTotalCents: number })[]; totalCents: number; currency: 'usd'; fingerprint: string; canCheckout: boolean; checkoutEnabled: boolean; testMode: true }
export function useCartQuote(items: CartItem[], refresh: number) {
  const key = JSON.stringify(items)
  const [state, setState] = useState<{ key: string; quote: CartQuote | null; loading: boolean; error: string | null }>({ key: '', quote: null, loading: true, error: null })
  useEffect(() => {
    const controller = new AbortController()
    let active = true
    const timeout = setTimeout(() => controller.abort(), 10_000)
    const debounce = setTimeout(async () => {
      setState(previous => ({ ...previous, loading: true, error: null }))
      try {
        const quote = await api<CartQuote>('/cart', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: JSON.parse(key) }), signal: controller.signal })
        if (active) setState({ key, quote, loading: false, error: null })
      } catch (error) {
        if (active) setState({ key, quote: null, loading: false, error: error instanceof ApiError ? error.message : 'Your bag could not refresh. Please try again.' })
      } finally { clearTimeout(timeout) }
    }, 120)
    return () => { active = false; clearTimeout(debounce); clearTimeout(timeout); controller.abort() }
  }, [key, refresh])
  return { quote: state.quote, loading: state.loading || state.key !== key, error: state.key === key ? state.error : null }
}
