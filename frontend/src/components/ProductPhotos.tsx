import { useId, useState } from 'react'
import type { Product } from '../lib/catalog'
import { CatalogImage } from './CatalogImage'
import { Icon } from './Icon'

export function ProductPhotos({ images, sizes }: { images: Product['images']; sizes: string }) {
  const frameId = useId()
  const [selected, setSelected] = useState(0)
  const [closeUpUrl, setCloseUpUrl] = useState<string | null>(null)
  const index = selected < images.length ? selected : 0
  const image = images[index]
  if (!image) return null

  const closeUp = closeUpUrl === image.url
  return (
    <div className="product-photos" role="group" aria-label="Product photos">
      <div id={frameId} className="product-photo-frame" data-close-up={closeUp}>
        <CatalogImage src={image.url} alt={image.alt} width={1254} height={1254} sizes={sizes} />
      </div>
      <div className="product-photo-controls">
        <p className="product-photo-count" aria-live={images.length > 1 ? 'polite' : undefined} aria-atomic="true">
          Photo {index + 1} of {images.length}
          {images.length > 1 && <span className="sr-only">. {image.alt}</span>}
        </p>
        <button
          type="button"
          className="button button-secondary photo-close-up"
          aria-pressed={closeUp}
          aria-controls={frameId}
          onClick={() => setCloseUpUrl(closeUp ? null : image.url)}
        >
          <Icon name="search" size={17} /> Close-up
        </button>
      </div>
      {images.length > 1 && (
        <div className="product-photo-rail" role="group" aria-label="Choose a product photo">
          {images.map((item, position) => (
            <button
              key={`${position}-${item.url}`}
              type="button"
              aria-label={`View photo ${position + 1}: ${item.alt}`}
              aria-pressed={position === index}
              aria-controls={frameId}
              onClick={() => { setSelected(position); setCloseUpUrl(null) }}
            >
              <CatalogImage src={item.url} alt="" aria-hidden="true" width={56} height={56} sizes="56px" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
