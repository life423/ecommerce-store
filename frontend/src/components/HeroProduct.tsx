import { money } from '../lib/catalog'
import type { Product } from '../lib/catalog'
import { useResource } from '../lib/useResource'
import { AddToCart } from './AddToCart'
import { CatalogImage } from './CatalogImage'

export function HeroProduct() {
  const { data, loading } = useResource<{ product: Product | null }>('/homepage-product')
  const product = data?.product

  if (loading) return <div className="hero-feature-placeholder" aria-hidden="true" />
  if (!product) {
    return <div className="hero-image">
      <CatalogImage src="/images/hero.jpg" sizes="50vw" alt="A sunlit city balcony filled with herbs and terracotta planters" width="1536" height="1024" />
    </div>
  }

  const photo = product.images[0]
  return <article className="hero-feature" aria-label="Featured product">
    <div className="hero-feature-photo">
      <CatalogImage src={photo?.url ?? '/product-placeholder.svg'} alt={photo?.alt ?? ''} sizes="(max-width: 760px) 30vw, 50vw" fetchPriority="high" />
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
}
