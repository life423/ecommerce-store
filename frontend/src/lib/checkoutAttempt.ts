import type { CartItem } from './cart'
export const CHECKOUT_KEY = 'rewild.checkout.v1'
export type CheckoutAttempt = { id: string; items: CartItem[]; fingerprint: string; orderId?: string; token?: string }
let memory: CheckoutAttempt | null = null
export function readCheckout(): CheckoutAttempt | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(CHECKOUT_KEY) ?? 'null')
    return value && typeof value.id === 'string' && Array.isArray(value.items) && typeof value.fingerprint === 'string' ? value : null
  } catch { return memory }
}
export function saveCheckout(value: CheckoutAttempt) { memory = value; try { sessionStorage.setItem(CHECKOUT_KEY, JSON.stringify(value)) } catch { /* Keep the in-memory attempt if browser storage is restricted. */ } }
export function clearCheckout() { memory = null; try { sessionStorage.removeItem(CHECKOUT_KEY) } catch { /* Private-storage restrictions must not break checkout. */ } }
