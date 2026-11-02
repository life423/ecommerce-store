import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Product } from '../lib/catalog'
import type { CartItem } from '../lib/cart'
import { CART_KEY, cartReducer, emptyCart, parseCart } from '../lib/cart'
import { CartContext } from '../lib/cartContext'
import { CartDrawer } from './CartDrawer'

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, undefined, () => { try { return parseCart(localStorage.getItem(CART_KEY)) } catch { return emptyCart } })
  const [isOpen, setOpen] = useState(false)
  const [storageAvailable, setStorageAvailable] = useState(true)
  const frame = useRef(0)
  useEffect(() => {
    try { localStorage.setItem(CART_KEY, JSON.stringify(state)) } catch { queueMicrotask(() => setStorageAvailable(false)) }
  }, [state])
  useEffect(() => {
    const sync = (event: StorageEvent) => { if (event.key === CART_KEY) dispatch({ type: 'sync', state: parseCart(event.newValue) }) }
    window.addEventListener('storage', sync)
    return () => { window.removeEventListener('storage', sync); cancelAnimationFrame(frame.current) }
  }, [])
  // Let the previous dialog unmount before handing focus/body locking to the bag.
  const open = useCallback(() => { cancelAnimationFrame(frame.current); frame.current = requestAnimationFrame(() => setOpen(true)) }, [])
  const close = useCallback(() => setOpen(false), [])
  const add = useCallback((product: Product) => { if (product.inventory > 0) dispatch({ type: 'add', productId: product.id, max: product.inventory }) }, [])
  const setQuantity = useCallback((productId: string, quantity: number) => dispatch({ type: 'quantity', productId, quantity }), [])
  const completePurchase = useCallback((orderId: string, items: CartItem[]) => dispatch({ type: 'paid', orderId, items }), [])
  const value = useMemo(() => ({ items: state.items, count: state.items.reduce((total, item) => total + item.quantity, 0), isOpen, storageAvailable, add, setQuantity, open, close, completePurchase }), [state.items, isOpen, storageAvailable, add, setQuantity, open, close, completePurchase])
  return <CartContext value={value}>{children}{isOpen && <CartDrawer onDismiss={close} />}</CartContext>
}
