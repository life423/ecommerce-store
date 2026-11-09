import { useState } from 'react'
import type { Product } from '../lib/catalog'
import { money } from '../lib/catalog'
import { useResource } from '../lib/useResource'
import { Icon } from '../components/Icon'
import { AddToCart } from '../components/AddToCart'
import { ProductPhotos } from '../components/ProductPhotos'
import { ProductAtAGlance } from '../components/ProductAtAGlance'

export function ProductPage({ slug }: { slug: string }) {
  const [attempt, setAttempt] = useState(0)
  const { data, error, loading } = useResource<{ product: Product }>(`/products/${encodeURIComponent(slug)}`, attempt)
  if (loading) return <main className="page-width detail-loading" aria-busy="true"><div className="product-skeleton"><div /></div><p>Getting to know your next good thing…</p></main>
  if (error || !data) return <main className="page-width empty-state" role="alert"><h1>{error?.status === 404 ? 'This little thing has wandered off.' : 'A little pause in the growing.'}</h1><p>{error?.message}</p>{error?.status !== 404 && <button className="button button-dark" onClick={() => setAttempt(value => value + 1)}>Try again</button>}<a className="text-link" href="/#collection">Back to all good things <Icon name="arrow" /></a></main>
  const product = data.product
  return (
    <main className="page-width product-page">
      <a className="breadcrumb" href={`/?category=${encodeURIComponent(product.category)}#collection`}>
        <Icon name="back" size={17} /> {product.category}
      </a>
      <div className="product-presentation product-detail">
        <header className="product-presentation-heading">
          <span className="eyebrow">{product.category}</span>
          <h1>{product.name}</h1>
        </header>
        <ProductPhotos key={product.id} images={product.images} sizes="(max-width: 760px) 100vw, 50vw" />
        <div className="product-presentation-copy">
          <div className="detail-price">
            {money(product.priceCents)}
            {product.compareAtPriceCents && <s>{money(product.compareAtPriceCents)}</s>}
            <span>USD</span>
          </div>
          <div className={`inventory-status ${product.inventory === 0 ? 'unavailable' : ''}`}>
            <span />
            {product.inventory === 0 ? 'Currently resting · out of stock'
              : product.inventory <= 5 ? `${product.inventory} available` : 'In stock, ready for your little garden'}
          </div>
          <div className="product-purchase">
            <AddToCart product={product} />
            <p><Icon name="lock" size={14} /> Stripe test checkout · no real charges or shipments</p>
          </div>
          <p className="detail-description">{product.description}</p>
          <ProductAtAGlance highlights={product.highlights} />
          <a className="text-link product-keep-exploring" href="/#collection">Keep exploring <Icon name="arrow" /></a>
        </div>
      </div>
    </main>
  )
}
