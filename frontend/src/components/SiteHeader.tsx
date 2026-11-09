import { useEffect, useId, useRef, useState } from 'react'
import { Icon } from './Icon'
import { Modal } from './Modal'
import { useDismissDialog } from './dialogContext'
import { useCart } from '../lib/cartContext'

export function SiteHeader({ editorEnabled, isStudio, overHero, onOpenGuide }: {
  editorEnabled: boolean
  isStudio: boolean
  overHero: boolean
  onOpenGuide: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const cart = useCart()
  const titleId = useId()
  const shell = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const header = shell.current!
    let frame = 0

    // The compact state and progress are visual. Update them together without rendering React on scroll.
    function measure() {
      frame = 0
      const page = document.scrollingElement ?? document.documentElement
      const range = page.scrollHeight - page.clientHeight
      const offset = Math.max(0, page.scrollTop)
      const progress = range <= 0 || offset === 0 ? 0 : offset >= range - 1 ? 1 : offset / range
      header.toggleAttribute('data-compact', offset > 50)
      header.style.setProperty('--scroll-progress', String(progress))
    }

    function scheduleMeasure() {
      if (!frame) frame = requestAnimationFrame(measure)
    }

    measure()
    window.addEventListener('scroll', scheduleMeasure, { passive: true })
    window.addEventListener('resize', scheduleMeasure)
    window.addEventListener('pageshow', scheduleMeasure)
    // Catalog filters and async content can change the document height without scrolling.
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleMeasure)
    observer?.observe(document.body)
    return () => {
      cancelAnimationFrame(frame)
      observer?.disconnect()
      window.removeEventListener('scroll', scheduleMeasure)
      window.removeEventListener('resize', scheduleMeasure)
      window.removeEventListener('pageshow', scheduleMeasure)
    }
  }, [])

  return <>
    <div ref={shell} className="site-header-shell" id="top" data-over-hero={overHero || undefined}>
      <div className="site-header-surface">
        <header className="site-header page-width">
          <a href="/" className="wordmark" aria-label="REWILD home"><Icon name="leaf" size={27} />REWILD<span>®</span></a>
          <nav className="desktop-navigation" aria-label="Main navigation">
            <a className={!isStudio ? 'nav-active' : ''} href="/#collection">Shop all</a>
            <a href="/?category=Growing+kits#collection">Growing kits</a>
            <button type="button" className="guide-nav-button" aria-haspopup="dialog" onClick={onOpenGuide}>Growing guide</button>
            <a href="/#approach">Our approach</a>
          </nav>
          <div className="header-actions">
            {editorEnabled && <a href="/studio" className="studio-link">Product studio <span>↗</span></a>}
            <a className="icon-button header-search" aria-label="Search the collection" href="/#catalog-search"><Icon name="search" /></a>
            <button
              type="button"
              className="bag-toggle icon-button"
              aria-label={`Open bag, ${cart.count} ${cart.count === 1 ? 'item' : 'items'}`}
              aria-haspopup="dialog"
              aria-expanded={cart.isOpen}
              onClick={event => {
                event.currentTarget.focus({ preventScroll: true })
                cart.open()
              }}
            >
              <Icon name="bag" />
              {cart.count > 0 && <span key={cart.count} className="bag-count" aria-hidden="true">{cart.count}</span>}
            </button>
            <button
              type="button"
              className="menu-toggle icon-button"
              aria-label="Open navigation"
              aria-expanded={menuOpen}
              aria-haspopup="dialog"
              onClick={event => {
                event.currentTarget.focus({ preventScroll: true })
                setMenuOpen(true)
              }}
            >
              <Icon name="menu" />
            </button>
          </div>
        </header>
        <div className="site-scroll-progress" aria-hidden="true" />
      </div>
    </div>
    {menuOpen && <Modal labelledBy={titleId} closeLabel="Close navigation" className="navigation-modal" onDismiss={() => setMenuOpen(false)}><MobileNavigation editorEnabled={editorEnabled} titleId={titleId} onOpenGuide={onOpenGuide} /></Modal>}
  </>
}

function MobileNavigation({ editorEnabled, titleId, onOpenGuide }: { editorEnabled: boolean; titleId: string; onOpenGuide: () => void }) {
  const dismiss = useDismissDialog()
  const links = [
    { href: '/#collection', label: 'All good things', note: 'Find your next small beginning' },
    { href: '/?category=Growing+kits#collection', label: 'Growing kits', note: 'A good place to get started' },
    { href: '/#approach', label: 'Our approach', note: 'A little green, a little closer to home' },
  ]
  return <div className="mobile-navigation-content">
      <span className="eyebrow">A LITTLE CLOSER TO GREEN</span><h2 id={titleId}>Find your<br /><em>little garden.</em></h2>
      <nav aria-label="Mobile navigation">{links.map((link, index) => <a key={link.href} href={link.href} onClick={() => dismiss(true)}><span className="menu-number">0{index + 1}</span><span><strong>{link.label}</strong><small>{link.note}</small></span><Icon name="arrow" /></a>)}</nav>
      <button className="mobile-guide-link" aria-haspopup="dialog" onClick={() => { dismiss(true); onOpenGuide() }}><Icon name="leaf" size={19} /><span>Find your growing space</span><Icon name="arrow" size={17} /></button>
      {editorEnabled && <a className="mobile-studio-link" href="/studio" onClick={() => dismiss(true)}>Product studio <Icon name="arrow" size={17} /></a>}
      <div className="mobile-menu-footnote"><Icon name="leaf" size={28} /><p>Small beginnings.<br />Good things.</p></div>
    </div>
}
