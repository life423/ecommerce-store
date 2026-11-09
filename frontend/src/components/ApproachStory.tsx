import { CatalogImage } from './CatalogImage'
import { Icon } from './Icon'
import { Reveal } from './Reveal'

export function ApproachStory({ onOpenGuide }: { onOpenGuide: () => void }) {
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
          <figure className="approach-photo approach-photo-seeds">
            <CatalogImage
              src="/images/demo-basil-windowsill-kit.jpg"
              alt="A small terracotta pot, a packet of basil seeds, and a coir growing disk"
              width={960}
              height={960}
              sizes="(max-width: 760px) 50vw, (max-width: 1340px) 30vw, 390px"
              loading="lazy"
              decoding="async"
            />
          </figure>
          <figure className="approach-photo approach-photo-growth">
            <CatalogImage
              src="/images/demo-linen-grow-bag-duo.jpg"
              alt="Basil and cherry tomatoes growing in two linen grow bags"
              width={960}
              height={960}
              sizes="(max-width: 760px) 50vw, (max-width: 1340px) 27vw, 340px"
              loading="lazy"
              decoding="async"
            />
          </figure>
        </div>
      </Reveal>
    </section>
  )
}
