import { useRef, useState } from 'react'
import { money } from '../lib/catalog'
import type { Product } from '../lib/catalog'
import { useResource } from '../lib/useResource'
import { AddToCart } from './AddToCart'
import { CatalogImage } from './CatalogImage'
import { Icon } from './Icon'

export function HeroProduct() {
  const { data, loading } = useResource<{ products: Product[] }>('/homepage-product')
  const [index, setIndex] = useState(0)
  const touchStart = useRef<{ id: number; x: number; y: number } | null>(null)
  const swiped = useRef(false)
  const products = data?.products ?? []
  const product = products[index]
  const multiple = products.length > 1

  if (loading) return <div className="hero-feature-placeholder" aria-hidden="true" />
  if (!product) {
    return <div className="hero-image">
      <CatalogImage src="/images/hero.jpg" sizes="50vw" alt="A sunlit city balcony filled with herbs and terracotta planters" width="1536" height="1024" />
    </div>
  }

  const photo = product.images[0]
  function step(direction: number) {
    setIndex(current => (current + direction + products.length) % products.length)
  }

  return <section className="hero-carousel" aria-label="Featured products" aria-roledescription={multiple ? 'carousel' : undefined}>
    <article className={`hero-feature${multiple ? ' hero-feature-swipeable' : ''}`} aria-label="Featured product"
      onPointerDown={event => {
        swiped.current = false
        if (multiple && event.isPrimary && event.pointerType === 'touch') {
          touchStart.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
        }
      }}
      onPointerCancel={() => { touchStart.current = null }}
      onPointerUp={event => {
        const start = touchStart.current
        if (!start || start.id !== event.pointerId) return
        touchStart.current = null
        const dx = event.clientX - start.x
        const dy = event.clientY - start.y
        if (Math.abs(dx) < 40 || Math.abs(dx) <= Math.abs(dy)) return
        swiped.current = true
        step(dx < 0 ? 1 : -1)
      }}
      onClickCapture={event => {
        if (!swiped.current || event.detail === 0) return
        event.preventDefault()
        event.stopPropagation()
      }}>
      <div className="hero-feature-photo">
        <CatalogImage key={product.id} src={photo?.url ?? '/product-placeholder.svg'} alt={photo?.alt ?? ''} sizes="(max-width: 760px) 30vw, 50vw" fetchPriority={index === 0 ? 'high' : 'auto'} />
      </div>
      <div className="hero-feature-copy">
        <div className="hero-feature-facts">
          <span className="eyebrow">From the collection</span>
          <a href={`/products/${product.slug}`}>{product.name}</a>
          <span className="hero-feature-price">{money(product.priceCents)}</span>
        </div>
        <AddToCart product={product} />
      </div>
    </article>
    {multiple && <div className="hero-carousel-controls" role="group" aria-label="Featured product controls">
      <button type="button" className="button button-secondary" aria-label="Previous featured product" onClick={() => step(-1)}><Icon name="back" size={18} /></button>
      <span role="status">
        <span aria-hidden="true">{index + 1} / {products.length}</span>
        <span className="sr-only">{product.name}, {index + 1} of {products.length}</span>
      </span>
      <button type="button" className="button button-secondary" aria-label="Next featured product" onClick={() => step(1)}><Icon name="arrow" size={18} /></button>
    </div>}
  </section>
}
