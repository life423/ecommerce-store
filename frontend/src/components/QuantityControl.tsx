import { Icon } from './Icon'
export function QuantityControl({ name, quantity, max, onChange }: { name: string; quantity: number; max: number; onChange: (quantity: number) => void }) {
  return <div className="quantity-control" role="group" aria-label={`Quantity for ${name}`}>
    <button type="button" aria-label={`Decrease quantity of ${name}`} disabled={quantity <= 1} onClick={() => onChange(quantity - 1)}><Icon name="minus" size={15} /></button>
    <span key={quantity} className="quantity-value" aria-live="polite" aria-atomic="true">{quantity}</span>
    <button type="button" aria-label={`Increase quantity of ${name}`} disabled={quantity >= max} onClick={() => onChange(quantity + 1)}><Icon name="plus" size={15} /></button>
  </div>
}
