import { shopSpaces } from '../lib/shopSpaces'
import { CatalogImage } from './CatalogImage'
import { Icon } from './Icon'
import { Reveal } from './Reveal'

export function ShopBySpace() {
  return (
    <section id="shop-by-space" className="shop-spaces page-width" aria-labelledby="shop-spaces-title">
      <Reveal>
        <div className="section-heading shop-spaces-heading">
          <div>
            <span className="eyebrow">THE SMALL-SPACE EDIT</span>
            <h2 id="shop-spaces-title">Shop by space</h2>
          </div>
          <p>Find growing essentials for the space you have.</p>
        </div>
      </Reveal>
      <Reveal>
        <ul className="shop-spaces-grid">
          {shopSpaces.map((space, index) => (
            <li key={space.id}>
              <a className="shop-space-card" href={`/?space=${space.id}#collection`}>
                <CatalogImage
                  src={space.image}
                  alt=""
                  aria-hidden="true"
                  width={1254}
                  height={1254}
                  loading="lazy"
                  decoding="async"
                  sizes={index === 0
                    ? '(max-width: 600px) 100vw, (max-width: 1340px) 58vw, 745px'
                    : '(max-width: 600px) 100vw, (max-width: 1340px) 39vw, 495px'}
                />
                <div className="shop-space-caption">
                  <div>
                    <h3>{space.name}</h3>
                    <p>{space.description}</p>
                  </div>
                  <span className="shop-space-arrow" aria-hidden="true"><Icon name="arrow" size={19} /></span>
                </div>
              </a>
            </li>
          ))}
        </ul>
      </Reveal>
    </section>
  )
}
