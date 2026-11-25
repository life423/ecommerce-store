import { useState } from 'react'
import { CatalogImage } from './CatalogImage'
import { Icon } from './Icon'
import { Reveal } from './Reveal'

const photos = [
  {
    image: '/images/demo-basil-windowsill-kit.jpg',
    alt: 'A small terracotta pot, a packet of basil seeds, and a coir growing disk',
    caption: 'Start with a seed',
  },
  {
    image: '/images/hero.jpg',
    alt: 'A sunlit city balcony filled with herbs and terracotta planters',
    caption: 'Find your little corner',
  },
  {
    image: '/images/demo-linen-grow-bag-duo.jpg',
    alt: 'Basil and cherry tomatoes growing in two linen grow bags',
    caption: 'Watch it grow',
  },
]

export function ApproachStory({ onOpenGuide }: { onOpenGuide: () => void }) {
  const [selectedPhoto, setSelectedPhoto] = useState<number | null>(null)
  const [hoveredPhoto, setHoveredPhoto] = useState<number | null>(null)
  const activePhoto = hoveredPhoto ?? selectedPhoto

  return (
    <section id="approach" className="approach-story page-width" aria-labelledby="approach-title">
      <Reveal className="approach-panel">
        <div className="approach-copy">
          <span className="eyebrow">OUR APPROACH</span>
          <h2 id="approach-title">Start with the space <em>you have.</em></h2>
          <p>A pot of basil on a bright windowsill. Tomatoes in a grow bag by the balcony door. Start with one spot you pass every day and a plant you’re curious to grow.</p>
          <div className="approach-actions">
            <button
              type="button"
              className="button button-dark"
              aria-haspopup="dialog"
              onClick={event => {
                event.currentTarget.focus({ preventScroll: true })
                onOpenGuide()
              }}
            >
              Open the Growing Guide <Icon name="arrow" size={18} />
            </button>
            <a className="text-link" href="/?category=Growing+kits#collection">Browse growing kits</a>
          </div>
        </div>
        <div className="approach-photos">
          <div className="approach-composition" role="group" aria-label="Growing in small spaces"
            data-active={activePhoto !== null || undefined}
            onKeyDown={event => {
              if (event.key === 'Escape') {
                setSelectedPhoto(null)
                setHoveredPhoto(null)
              }
            }}>
            {photos.map((photo, index) => <button
              key={photo.image}
              type="button"
              className="approach-photo"
              aria-label={`Bring “${photo.caption}” photo to front`}
              aria-pressed={activePhoto === index}
              data-active={activePhoto === index || undefined}
              onPointerEnter={event => { if (event.pointerType === 'mouse') setHoveredPhoto(index) }}
              onPointerLeave={() => setHoveredPhoto(null)}
              onFocus={() => { setSelectedPhoto(index); setHoveredPhoto(null) }}
              onClick={() => setSelectedPhoto(index)}
            >
              <CatalogImage
                src={photo.image}
                alt={photo.alt}
                width={960}
                height={640}
                sizes="(max-width: 760px) 60vw, (max-width: 1340px) 30vw, 390px"
                loading="lazy"
                decoding="async"
              />
              <span className="approach-photo-caption">{photo.caption}</span>
            </button>)}
          </div>
          <p className="approach-photo-hint">Hover, tap, or focus a photo to bring it closer.</p>
        </div>
      </Reveal>
    </section>
  )
}
