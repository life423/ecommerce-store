import { useEffect, useRef, useState } from 'react'
import type { Product } from '../lib/catalog'
import { useCart } from '../lib/cartContext'
import { Icon } from './Icon'

export function AddToCart({ product }: { product: Product }) {
  const cart = useCart()
  const [addedProductId, setAddedProductId] = useState<string | null>(null)
  const confirmationTimer = useRef(0)
  useEffect(() => () => window.clearTimeout(confirmationTimer.current), [])
  const quantity = cart.items.find(item => item.productId === product.id)?.quantity ?? 0
  const unavailable = product.inventory === 0
  const atLimit = quantity >= Math.min(10, product.inventory)
  const added = addedProductId === product.id

  function add() {
    cart.add(product)
    setAddedProductId(product.id)
    window.clearTimeout(confirmationTimer.current)
    confirmationTimer.current = window.setTimeout(() => setAddedProductId(null), 2000)
  }

  return <button type="button" className="button button-dark add-to-bag" disabled={unavailable || atLimit} onClick={add}>
    <span aria-live="polite" aria-atomic="true">{unavailable ? 'Out of stock' : added ? 'Added to bag' : atLimit ? 'All available are in your bag' : 'Add to bag'}</span><Icon name={unavailable ? 'leaf' : added ? 'check' : 'plus'} size={19} />
  </button>
}
