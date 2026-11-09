import { useId, useState } from 'react'
import type { Product } from '../lib/catalog'
import { money } from '../lib/catalog'
import { useResource } from '../lib/useResource'
import { Icon } from './Icon'
import { Modal } from './Modal'
import { useDismissDialog } from './dialogContext'
import { AddToCart } from './AddToCart'
import { ProductPhotos } from './ProductPhotos'
import { ProductAtAGlance } from './ProductAtAGlance'

export function QuickView({ product: preview, onDismiss }: { product: Product; onDismiss: () => void }) {
  const titleId = useId()
  return <Modal labelledBy={titleId} closeLabel="Close quick view" className="quick-view-modal" onDismiss={onDismiss}><QuickViewContent preview={preview} titleId={titleId} /></Modal>
}

function QuickViewContent({ preview, titleId }: { preview: Product; titleId: string }) {
  const dismiss = useDismissDialog()
  const [attempt, setAttempt] = useState(0)
  const { data, loading, error } = useResource<{ product: Product }>(`/products/${encodeURIComponent(preview.slug)}`, attempt)
  const product = data?.product
  return (
    <div className="product-presentation quick-view-layout">
      <header className="product-presentation-heading">
        <span className="eyebrow">{product?.category ?? preview.category}</span>
        <h2 id={titleId}>{product?.name ?? preview.name}</h2>
      </header>
      <ProductPhotos images={product?.images ?? preview.images} sizes="(max-width: 760px) 100vw, 420px" />
      <div className="product-presentation-copy">
        {loading ? <div className="quick-view-loading" role="status"><span className="loading-dot" /> Getting a fresh look…</div>
          : error || !product ? <div className="quick-view-error" role="alert"><p>{error?.message ?? 'This product is unavailable.'}</p><button className="text-link" onClick={() => setAttempt(value => value + 1)}>Try again <Icon name="arrow" size={16} /></button></div>
            : <>
              <div className="detail-price">
                {money(product.priceCents)}
                {product.compareAtPriceCents && <s>{money(product.compareAtPriceCents)}</s>}
                <span>USD</span>
              </div>
              <div className={`inventory-status ${product.inventory === 0 ? 'unavailable' : ''}`}>
                <span />
                {product.inventory === 0 ? 'Out of stock' : product.inventory <= 5 ? `${product.inventory} available` : 'In stock'}
              </div>
              <div className="quick-view-actions">
                <AddToCart product={product} beforeOpen={() => dismiss(true)} />
                <a className="button button-secondary" href={`/products/${product.slug}`}>
                  View product details <Icon name="arrow" size={16} />
                </a>
              </div>
              <p className="detail-description">{product.description}</p>
              <ProductAtAGlance highlights={product.highlights} heading="h3" />
              <button type="button" className="quick-view-continue" onClick={() => dismiss()}>Keep browsing</button>
            </>}
      </div>
    </div>
  )
}
