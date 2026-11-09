import { useId, useState } from 'react'
import type { Product } from '../lib/catalog'
import { money } from '../lib/catalog'
import { useResource } from '../lib/useResource'
import { CatalogImage } from './CatalogImage'
import { Icon } from './Icon'

function SetupCard({ product }: { product: Product }) {
  const title = useId()
  const summary = useId()
  const image = product.images[0]

  return (
    <li>
      <a className="setup-card" href={`/products/${encodeURIComponent(product.slug)}`} aria-labelledby={title} aria-describedby={summary}>
        <div className="setup-card-photo">
          <CatalogImage
            src={image.url}
            alt={image.alt}
            width={480}
            height={480}
            loading="lazy"
            decoding="async"
            sizes="(max-width: 360px) 90vw, (max-width: 540px) 45vw, (max-width: 1340px) 31vw, 400px"
          />
        </div>
        <h3 id={title}>{product.name}</h3>
        <div className="setup-card-summary" id={summary}>
          <span className="setup-card-price">
            {money(product.priceCents)}
            {product.compareAtPriceCents && <s><span className="sr-only">Original price </span>{money(product.compareAtPriceCents)}</s>}
          </span>
          <span className="inventory-status">
            <span aria-hidden="true" />
            {product.inventory <= 5 ? `${product.inventory} available` : 'In stock'}
          </span>
        </div>
        <span className="setup-card-action" aria-hidden="true">View product <Icon name="arrow" size={17} /></span>
      </a>
    </li>
  )
}

export function RelatedProducts({ slug }: { slug: string }) {
  const title = useId()
  const [attempt, setAttempt] = useState(0)
  const { data, error, loading } = useResource<{ items: Product[] }>(`/products/${encodeURIComponent(slug)}/related`, attempt)
  const items = data?.items ?? []
  if (!loading && !error && items.length === 0) return null

  return (
    <section className="product-setup" aria-labelledby={title}>
      <div className="section-heading">
        <div>
          <span className="eyebrow">GROW WELL TOGETHER</span>
          <h2 id={title}>Complete your setup</h2>
        </div>
        <p>A few good things to grow alongside this one.</p>
      </div>
      {loading ? <p className="setup-status" role="status">Finding things that go well together…</p>
        : error ? (
          <div className="setup-status">
            <p role="status">We couldn’t load suggestions right now.</p>
            <button type="button" className="button button-secondary" onClick={() => setAttempt(value => value + 1)}>Try again</button>
          </div>
        ) : (
          <ul className="setup-grid" role="list">
            {items.map(product => <SetupCard key={product.id} product={product} />)}
          </ul>
        )}
    </section>
  )
}
