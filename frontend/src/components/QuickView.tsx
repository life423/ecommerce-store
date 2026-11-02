import { useId, useState } from 'react'
import type { Product } from '../lib/catalog'
import { money } from '../lib/catalog'
import { useResource } from '../lib/useResource'
import { CatalogImage } from './CatalogImage'
import { Icon } from './Icon'
import { Modal } from './Modal'
import { useDismissDialog } from './dialogContext'
import { AddToCart } from './AddToCart'

export function QuickView({ product: preview, onDismiss }: { product: Product; onDismiss: () => void }) {
  const titleId = useId()
  return <Modal labelledBy={titleId} closeLabel="Close quick view" className="quick-view-modal" onDismiss={onDismiss}><QuickViewContent preview={preview} titleId={titleId} /></Modal>
}

function QuickViewContent({ preview, titleId }: { preview: Product; titleId: string }) {
  const dismiss = useDismissDialog()
  const [attempt, setAttempt] = useState(0)
  const [imageIndex, setImageIndex] = useState(0)
  const { data, loading, error } = useResource<{ product: Product }>(`/products/${encodeURIComponent(preview.slug)}`, attempt)
  const product = data?.product
  const image = product?.images[imageIndex] ?? product?.images[0] ?? preview.images[0]

  return <div className="quick-view-layout">
      <div className="quick-view-visual">
        <CatalogImage key={image.url} src={image.url} alt={image.alt} width="1254" height="1254" sizes="(max-width: 760px) 100vw, 480px" />
        <span className="quick-view-caption"><Icon name="leaf" size={16} /> A little closer look.</span>
        {product && product.images.length > 1 && <div className="quick-view-gallery" aria-label="Product images">{product.images.map((item, index) => <button type="button" key={`${item.url}-${index}`} aria-label={`View image ${index + 1}`} aria-pressed={imageIndex === index} onClick={() => setImageIndex(index)}><CatalogImage src={item.url} alt="" width="64" height="64" sizes="64px" /></button>)}</div>}
      </div>
      <div className="quick-view-copy">
        <span className="eyebrow">{product?.category ?? preview.category}</span>
        <h2 id={titleId}>{product?.name ?? preview.name}</h2>
        {loading ? <div className="quick-view-loading" role="status"><span className="loading-dot" /> Getting a fresh look…</div>
          : error || !product ? <div className="quick-view-error" role="alert"><p>{error?.message ?? 'This product is unavailable.'}</p><button className="text-link" onClick={() => setAttempt(value => value + 1)}>Try again <Icon name="arrow" size={16} /></button></div>
            : <>
              <div className="quick-view-price"><span>{money(product.priceCents)}</span>{product.compareAtPriceCents && <s>{money(product.compareAtPriceCents)}</s>}<small>USD</small></div>
              <p className="quick-view-description">{product.description}</p>
              <div className={`inventory-status ${product.inventory === 0 ? 'unavailable' : ''}`}><span />{product.inventory === 0 ? 'Out of stock' : product.inventory <= 5 ? `${product.inventory} available` : 'In stock'}</div>
              {product.highlights.length > 0 && <ul className="quick-view-highlights">{product.highlights.slice(0, 3).map(item => <li key={item}><Icon name="check" size={16} />{item}</li>)}</ul>}
              <AddToCart product={product} beforeOpen={() => dismiss(true)} />
              <a className="quick-view-product-link" href={`/products/${product.slug}`}>Meet your next good thing <Icon name="arrow" size={16} /></a>
              <button className="quick-view-continue" onClick={() => dismiss()}>Keep browsing</button>
            </>}
      </div>
    </div>
}
