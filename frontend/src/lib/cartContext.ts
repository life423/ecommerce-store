import { createContext, useContext } from 'react'
import type { Product } from './catalog'
import type { CartItem } from './cart'

type CartContextValue = {
  items: CartItem[]; count: number; isOpen: boolean; storageAvailable: boolean
  add: (product: Product) => void; setQuantity: (productId: string, quantity: number) => void
  open: () => void; close: () => void
  completePurchase: (orderId: string, items: CartItem[]) => void
}
export const CartContext = createContext<CartContextValue | null>(null)
export function useCart() {
  const value = useContext(CartContext)
  if (!value) throw new Error('Cart controls require CartProvider')
  return value
}
