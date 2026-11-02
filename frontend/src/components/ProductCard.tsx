import { useId, useRef, useState } from 'react'
import { money } from '../lib/catalog'
import type { Product } from '../lib/catalog'
import { Icon } from './Icon'
import { CatalogImage } from './CatalogImage'
import { AddToCart } from './AddToCart'

export function ProductCard({ product, onQuickView }: { product: Product; onQuickView: (product: Product) => void }) {
  const [hovered, setHovered] = useState(false)
  const [pinned, setPinned] = useState(false)
  const toggle = useRef<HTMLButtonElement>(null)
  const detailsId = useId()
  const flipped = hovered || pinned
  return <article className="product-card">
    <div className="product-media" data-flipped={flipped} onPointerEnter={event => { if (event.pointerType === 'mouse' && window.matchMedia('(hover: hover) and (pointer: fine)').matches) setHovered(true) }} onPointerLeave={() => setHovered(false)} onKeyDown={event => { if (event.key === 'Escape' && flipped) { event.preventDefault(); setPinned(false); setHovered(false); toggle.current?.focus() } }}>
      <div className="product-flip-stage"><div className="product-flip-inner">
        <div className="product-flip-front" aria-hidden={flipped} inert={flipped ? true : undefined}>
          <a href={`/products/${product.slug}`} className="product-image-link" aria-label={`Explore ${product.name}`}>
            <CatalogImage src={product.images[0].url} alt={product.images[0].alt} loading="lazy" width="600" height="600" />
            {product.inventory === 0 ? <span className="product-badge sold-out">Out of stock</span> : product.badge ? <span className="product-badge">{product.badge}</span> : null}
          </a>
          <span className="card-flip-hint"><Icon name="flip" size={13} /> A little more to love</span>
        </div>
        <div id={detailsId} className="product-flip-back" aria-hidden={!flipped} inert={!flipped ? true : undefined} onFocusCapture={() => setPinned(true)}>
          <span className="eyebrow">MADE FOR YOUR LITTLE WORLD</span>
          <p className="flip-description">{product.description.split(/(?<=\.)\s/).slice(0, 1).join(' ')}</p>
          <ul>{product.highlights.slice(0, 2).map(item => <li key={item}><Icon name="check" size={14} />{item}</li>)}</ul>
          <AddToCart product={product} />
        </div>
      </div></div>
      <div className="flip-card-actions"><button ref={toggle} type="button" className="flip-toggle" aria-label={`Show ${flipped ? 'photo' : 'details'} for ${product.name}`} aria-pressed={flipped} aria-controls={detailsId} onClick={() => { setPinned(!flipped); setHovered(false) }}><Icon name="flip" size={16} /><span className="flip-label">{flipped ? 'Photo' : 'Details'}</span></button>
        <button type="button" className="quick-look-button" aria-label={`Quick look at ${product.name}`} aria-haspopup="dialog" onClick={() => onQuickView(product)}><Icon name="eye" size={17} /><span>Quick look</span></button></div>
    </div>
    <div className="product-card-copy"><div className="product-category">{product.category}</div>
    <div className="product-info"><h3><a href={`/products/${product.slug}`}>{product.name}</a></h3><span className="price">{money(product.priceCents)}</span></div>
    {product.compareAtPriceCents && <p className="old-price"><span className="sr-only">Original price </span><s>{money(product.compareAtPriceCents)}</s></p>}
    <div className={`card-stock ${product.inventory === 0 ? 'card-stock-unavailable' : ''}`}><span />{product.inventory === 0 ? 'Currently out of stock' : product.inventory <= 5 ? `${product.inventory} available` : 'Ready to grow'}</div>
    </div>
  </article>
}
