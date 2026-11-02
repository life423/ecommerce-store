import type { Product } from '../lib/catalog'
import { useCart } from '../lib/cartContext'
import { Icon } from './Icon'

export function AddToCart({ product, beforeOpen }: { product: Product; beforeOpen?: () => void }) {
  const cart = useCart()
  const quantity = cart.items.find(item => item.productId === product.id)?.quantity ?? 0
  const unavailable = product.inventory === 0
  const atLimit = quantity >= Math.min(10, product.inventory)
  return <button type="button" className="button button-dark add-to-bag" disabled={unavailable || atLimit} onClick={() => { cart.add(product); beforeOpen?.(); cart.open() }}>
    <span>{unavailable ? 'Out of stock' : atLimit ? 'All available are in your bag' : 'Add to bag'}</span><Icon name={unavailable ? 'leaf' : 'plus'} size={19} />
  </button>
}
