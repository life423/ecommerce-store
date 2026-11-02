import { useEffect, useState } from 'react'
import type { CatalogInfo } from './lib/catalog'
import { useResource } from './lib/useResource'
import { CatalogPage } from './pages/CatalogPage'
import { ProductPage } from './pages/ProductPage'
import { StudioPage } from './pages/StudioPage'
import { Icon } from './components/Icon'
import { SiteHeader } from './components/SiteHeader'
import { CartProvider } from './components/CartProvider'
import { CheckoutPage } from './pages/CheckoutPage'
import { GrowingGuide } from './components/GrowingGuide'

export default function App() {
  return <CartProvider><Storefront /></CartProvider>
}

function Storefront() {
  const [guideOpen, setGuideOpen] = useState(false)
  function openGuide() { requestAnimationFrame(() => setGuideOpen(true)) }
  // A new document's hash may be resolved before the client-rendered target exists.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      let id: string
      try { id = decodeURIComponent(window.location.hash.slice(1)) } catch { return }
      if (!id) return
      const target = document.getElementById(id)
      target?.scrollIntoView({ behavior: 'instant', block: 'start' })
      if (target instanceof HTMLInputElement) target.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(frame)
  }, [])
  const catalog = useResource<CatalogInfo>('/catalog')
  const path = window.location.pathname.replace(/\/$/, '')
  const isStudio = path === '/studio'
  const productMatch = /^\/products\/([^/]+)$/.exec(path)
  return <>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <div className="announcement"><span>A LITTLE GREENER. A LITTLE CLOSER TO HOME.</span><span>Meet your new growing habit <span aria-hidden="true">↗</span></span></div>
    <SiteHeader editorEnabled={catalog.data?.editorEnabled ?? false} isStudio={isStudio} onOpenGuide={openGuide} />
    <div id="main-content" tabIndex={-1}>
      {path === '' ? <main><CatalogPage catalog={catalog.data} onOpenGuide={openGuide} /></main>
        : productMatch ? <ProductPage slug={productMatch[1]} />
          : ['/checkout/success', '/checkout/cancel'].includes(path) ? <CheckoutPage cancel={path.endsWith('/cancel')} />
          : isStudio ? catalog.loading ? <main className="page-width empty-state" aria-busy="true"><p>Opening your product studio…</p></main> : catalog.data ? <StudioPage catalog={catalog.data} /> : <main className="page-width empty-state" role="alert"><h1>The studio is taking a pause.</h1><p>{catalog.error?.message}</p><a href="/studio" className="text-link">Try again <Icon name="arrow" /></a></main>
            : <main className="page-width empty-state"><h1>Let’s get you growing again.</h1><p>This page isn’t here, but your next little garden might be.</p><a className="button button-dark" href="/">Back to the store <Icon name="arrow" /></a></main>}
    </div>
    {guideOpen && <GrowingGuide onDismiss={() => setGuideOpen(false)} />}
    <footer className="site-footer"><div className="page-width footer-top"><div><a href="/" className="wordmark">REWILD<span>®</span></a><p>Small beginnings. Good things.</p></div><a href="/#collection">Find your little garden <Icon name="arrow" /></a></div><div className="page-width footer-bottom"><span>© {new Date().getFullYear()} REWILD · A portfolio concept.</span><span>Fictional products. Stripe test mode. No real charges or shipments.</span></div></footer>
  </>
}
