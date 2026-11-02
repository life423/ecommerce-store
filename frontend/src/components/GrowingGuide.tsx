import { useId, useState } from 'react'
import { CatalogImage } from './CatalogImage'
import { Icon } from './Icon'
import { Modal } from './Modal'
import { useDismissDialog } from './dialogContext'

const spaces = [
  { id: 'windowsill', label: 'A windowsill', title: 'A little ledge. A fresh beginning.', space: 'A small spot by the window can be the start of a growing ritual. Keep your first setup simple, with room to watch it change.', beginning: 'Explore our compact growing kits, or start with a seed collection and a pot you already love. Check each product’s included items before adding it to your bag.', category: 'Growing kits', action: 'Explore growing kits', image: '/images/greens.jpg', alt: 'Fresh microgreens in speckled growing trays' },
  { id: 'balcony', label: 'A balcony', title: 'Make a little room for green.', space: 'A balcony, a quiet corner, a place to pause. Picture one planter first, then build your collection around the space you actually have.', beginning: 'Our Balcony Grow Box offers a place to begin. Pair a planter with seeds or tools, and review the dimensions and growing requirements for the plants you choose.', category: 'Planters', action: 'Explore planters', image: '/images/planter.jpg', alt: 'A terracotta planter filled with herbs' },
  { id: 'indoors', label: 'An indoor corner', title: 'Bring your growing habit inside.', space: 'A countertop or shelf can give your next project a place of its own. Choose a setup that suits your space and your everyday routine.', beginning: 'Meet the Countertop Garden: a growing lamp and a pair of pots. Seeds and growing medium are sold separately, so you can choose your own small beginning.', category: 'Growing kits', action: 'Explore indoor growing', image: '/images/light.jpg', alt: 'A growing lamp above two terracotta herb pots' },
]
export function GrowingGuide({ onDismiss }: { onDismiss: () => void }) {
  const titleId = useId()
  return <Modal labelledBy={titleId} closeLabel="Close growing guide" className="growing-guide-modal" onDismiss={onDismiss}><GuideContent titleId={titleId} /></Modal>
}
function GuideContent({ titleId }: { titleId: string }) {
  const [selected, setSelected] = useState('windowsill')
  const space = spaces.find(space => space.id === selected)!
  const dismiss = useDismissDialog()
  return <div className="growing-guide-layout">
    <div className="growing-guide-photos"><figure><CatalogImage src="/images/hero.jpg" alt="A sunlit balcony garden with terracotta pots" width="1536" height="1024" sizes="(max-width: 760px) 50vw, 350px" /><figcaption>A little closer to green.</figcaption></figure><figure key={space.image}><CatalogImage src={space.image} alt={space.alt} width="1254" height="1254" sizes="(max-width: 760px) 50vw, 350px" /><figcaption>Your next small beginning.</figcaption></figure></div>
    <div className="growing-guide-copy"><span className="eyebrow">THE REWILD GROWING GUIDE</span><h2 id={titleId}>Your little garden<br />starts <em>right here.</em></h2><p className="guide-intro">You don’t need a big garden. Just a place to begin.</p>
      <fieldset className="guide-space-options"><legend>Where would you like to grow?</legend>{spaces.map(item => <button type="button" key={item.id} aria-pressed={item.id === selected} onClick={() => setSelected(item.id)}>{item.label}<Icon name="check" size={14} /></button>)}</fieldset>
      <div className="guide-space-result" key={space.id} aria-live="polite" aria-atomic="true"><h3>{space.title}</h3><div className="guide-columns"><div><span className="guide-number">01 / YOUR SPACE</span><p>{space.space}</p></div><div><span className="guide-number">02 / YOUR SMALL BEGINNING</span><p>{space.beginning}</p></div></div></div>
      <a className="button button-dark guide-cta" href={`/?category=${encodeURIComponent(space.category)}#collection`} onClick={() => dismiss(true)}>{space.action}<Icon name="arrow" size={18} /></a><p className="guide-note">Fictional products. Real possibilities. Start small, make it yours.</p>
    </div>
  </div>
}
