import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CatalogInfo, Product, ProductList } from '../lib/catalog'
import { useResource } from '../lib/useResource'
import { shopSpaces } from '../lib/shopSpaces'
import { ProductCard } from '../components/ProductCard'
import { Icon } from '../components/Icon'
import { CatalogImage } from '../components/CatalogImage'
import { QuickView } from '../components/QuickView'
import { Reveal } from '../components/Reveal'
import { FilterSheet } from '../components/FilterSheet'
import { ShopBySpace } from '../components/ShopBySpace'
import { ApproachStory } from '../components/ApproachStory'
import type { CatalogFilters } from '../components/FilterSheet'

export function CatalogPage({ catalog, onOpenGuide }: { catalog: CatalogInfo | null; onOpenGuide: () => void }) {
  const initial = new URLSearchParams(window.location.search)
  const [category, setCategory] = useState(initial.get('category') ?? '')
  const [spaceId, setSpaceId] = useState(initial.get('space'))
  const space = shopSpaces.find(item => item.id === spaceId)
  const [query, setQuery] = useState(initial.get('q') ?? '')
  const [search, setSearch] = useState(query)
  const [sort, setSort] = useState(initial.get('sort') ?? 'featured')
  const [inStock, setInStock] = useState(initial.get('inStock') === 'true')
  const [page, setPage] = useState(Number(initial.get('page')) > 0 ? Number(initial.get('page')) : 1)
  const [attempt, setAttempt] = useState(0)
  const [quickView, setQuickView] = useState<Product | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const collection = useRef<HTMLElement>(null)
  const resultsSummary = useRef<HTMLSpanElement>(null)
  const restoreApproach = useRef(window.location.hash === '#approach')
  useEffect(() => {
    const timer = setTimeout(() => setSearch(query), 300)
    return () => clearTimeout(timer)
  }, [query])
  const params = new URLSearchParams({ sort, page: String(page), limit: '6' })
  if (space) params.set('space', space.id)
  if (category) params.set('category', category)
  if (search.trim()) params.set('q', search.trim())
  if (inStock) params.set('inStock', 'true')
  const queryString = params.toString()
  const products = useResource<ProductList>(`/products?${queryString}`, attempt)
  useLayoutEffect(() => {
    if (products.loading || !restoreApproach.current) return
    restoreApproach.current = false
    // The loaded catalog can change the height above the story after the initial hash scroll.
    if (window.location.hash === '#approach') {
      document.getElementById('approach')?.scrollIntoView({ behavior: 'instant', block: 'start' })
    }
  }, [products.loading])
  useEffect(() => { window.history.replaceState(null, '', `${window.location.pathname}?${queryString}${window.location.hash}`) }, [queryString])
  function chooseCategory(value: string) { setCategory(value); setPage(1) }
  function reset() { setQuery(''); setSearch(''); setCategory(''); setSpaceId(null); setInStock(false); setSort('featured'); setPage(1) }
  function applyFilters(filters: CatalogFilters) { setCategory(filters.category); setInStock(filters.inStock); setSort(filters.sort); setPage(1) }
  const filterCount = Number(!!category) + Number(inStock) + Number(sort !== 'featured')
  const total = products.data?.pagination.total ?? 0
  const hasActiveFilters = Boolean(space || category || inStock || search)

  return <>
    <section className="hero">
      <div className="hero-copy">
        <span className="eyebrow"><span className="tiny-star">✳</span> A little space. A lot of possibility.</span>
        <h1><span className="hero-title-line"><span>Good things</span></span><span className="hero-title-line"><span>start <em>small.</em></span></span></h1>
        <p>A windowsill. A balcony. A little corner of your world.<br className="desktop-break" /> Growing kits, seeds, and tools to bring it to life.</p>
        <a className="button button-dark" href="#collection">Find your little garden <Icon name="arrow" /></a>
        <button type="button" className="hero-guide-link" aria-haspopup="dialog" onClick={onOpenGuide}>New to growing? Find your starting point <Icon name="arrow" size={16} /></button>
        <div className="hero-footnote"><span className="hand-drawn-leaf"><Icon name="leaf" size={24} /></span> For the growers. And the not-yet-growers.</div>
      </div>
      <div className="hero-image"><CatalogImage src="/images/hero.jpg" sizes="(max-width: 420px) 100vw, 50vw" alt="A sunlit city balcony filled with herbs and terracotta planters" width="1536" height="1024" fetchPriority="high" /><div className="hero-image-note"><span>Less scrolling.<br /><em>More growing.</em></span><span>01 / THE SMALL-SPACE EDIT</span></div></div>
    </section>
    <div className="values-strip"><span><Icon name="leaf" size={17} /> Small-space friendly</span><span>Good tools. Simple beginnings.</span><span>Grow a little, every day.</span><span className="values-end">Rooted in possibility <span>↗</span></span></div>

    <ShopBySpace />

    <section id="collection" className="collection page-width" ref={collection}>
      <Reveal><div className="section-heading"><div><span className="eyebrow">THE GROWING COLLECTION</span><h2>A little green goes a long way.</h2></div><p>Thoughtful essentials for your<br />next small beginning.</p></div></Reveal>
      <div className="mobile-category-strip" aria-label="Browse categories"><button aria-pressed={!category} onClick={() => chooseCategory('')}>All good things</button>{(catalog?.categories ?? []).map(item => <button key={item.name} aria-label={`Browse ${item.name}`} aria-pressed={category === item.name} onClick={() => chooseCategory(item.name)}>{item.name}</button>)}</div>
      <div className="catalog-layout">
        <aside className="filters" aria-label="Product filters">
          <h3>Find your thing</h3>
          <div className="category-list">
            <button aria-label="Show all products" aria-pressed={!category} onClick={() => chooseCategory('')}><span>All good things</span><span>{catalog?.categories.reduce((sum, item) => sum + item.count, 0) ?? '—'}</span></button>
            {(catalog?.categories ?? []).map(item => <button key={item.name} aria-label={`Filter by ${item.name}`} aria-pressed={category === item.name} onClick={() => chooseCategory(item.name)}><span>{item.name}</span><span>{item.count}</span></button>)}
          </div>
          <label className="stock-filter"><input type="checkbox" checked={inStock} onChange={event => { setInStock(event.target.checked); setPage(1) }} /> In stock only</label>
          <div className="filter-note"><Icon name="leaf" size={26} /><p>No garden?<br /><em>No problem.</em></p><span>Every great grower<br />starts somewhere.</span><button onClick={() => chooseCategory('Growing kits')}>Explore growing kits <Icon name="arrow" size={15} /></button></div>
        </aside>
        <div className="catalog-results">
          <div className="catalog-toolbar"><label className="search-field"><Icon name="search" size={18} /><input id="catalog-search" type="search" aria-label="Search products" placeholder="Find your next good thing…" maxLength={100} value={query} onChange={event => { setQuery(event.target.value); setPage(1) }} /></label><label className="sort-field"><span className="sr-only">Sort products</span><select value={sort} onChange={event => { setSort(event.target.value); setPage(1) }}><option value="featured">Our favorites</option><option value="newest">Newest arrivals</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="name">Name: A–Z</option></select></label><button type="button" className="mobile-filter-trigger" aria-haspopup="dialog" onClick={() => setFiltersOpen(true)}><Icon name="sliders" size={18} /><span>Filters</span>{filterCount > 0 && <span className="filter-count">{filterCount}</span>}</button></div>
          <div className="results-line" role="status" aria-live="polite"><span ref={resultsSummary} tabIndex={-1}>{products.error ? 'Collection unavailable' : products.loading ? 'Gathering good things…' : `${total} good ${total === 1 ? 'thing' : 'things'}${category ? ` · ${category}` : ''}`}</span>{(hasActiveFilters || sort !== 'featured') && <button onClick={reset}>Clear filters <Icon name="close" size={12} /></button>}</div>
          {hasActiveFilters && <div className="active-filters" aria-label="Active filters">
            {space && <button type="button" className="space-filter-chip" aria-label={`Remove ${space.name.toLowerCase()} filter`} onClick={() => {
              setSpaceId(null)
              setPage(1)
              resultsSummary.current?.focus({ preventScroll: true })
            }}>
              <Icon name="check" size={15} /><span>{space.name}</span><Icon name="close" size={16} />
            </button>}
            {category && <button aria-label={`Remove ${category} filter`} onClick={() => chooseCategory('')}>{category}<Icon name="close" size={12} /></button>}
            {inStock && <button aria-label="Remove in-stock filter" onClick={() => { setInStock(false); setPage(1) }}>In stock<Icon name="close" size={12} /></button>}
            {search && <button aria-label="Clear search" onClick={() => { setQuery(''); setSearch(''); setPage(1) }}>“{search}”<Icon name="close" size={12} /></button>}
          </div>}
          {products.error ? <div className="empty-state" role="alert"><Icon name="leaf" size={32} /><h3>A little pause in the growing.</h3><p>{products.error.message}</p><button className="button button-dark" onClick={() => setAttempt(value => value + 1)}>Try again <Icon name="arrow" /></button></div>
            : products.loading && !products.data ? <div className="product-grid" aria-busy="true">{Array.from({ length: 6 }, (_, i) => <div className="product-skeleton" key={i}><div /><span /><span /></div>)}</div>
              : products.data?.items.length ? <div className={`product-grid ${products.loading ? 'is-refreshing' : ''}`} aria-busy={products.loading} inert={products.loading}>{products.data.items.map((product, index) => <Reveal key={product.id} delay={Math.min(index * 55, 220)} className="catalog-card-entry"><ProductCard product={product} onQuickView={setQuickView} /></Reveal>)}</div>
                : <div className="empty-state"><Icon name="leaf" size={36} /><h3>Nothing growing here. Yet.</h3><p>Try another search or make room for all good things.</p><button className="button button-dark" onClick={reset}>See all products <Icon name="arrow" /></button></div>}
          {products.data && products.data.pagination.pages > 1 && !products.loading && <nav className="pagination" aria-label="Catalog pages"><button disabled={page === 1} onClick={() => { setPage(value => value - 1); collection.current?.scrollIntoView() }}>Previous</button><span>Page {page} of {products.data.pagination.pages}</span><button disabled={page >= products.data.pagination.pages} onClick={() => { setPage(value => value + 1); collection.current?.scrollIntoView() }}>Next <Icon name="arrow" size={16} /></button></nav>}
        </div>
      </div>
    </section>
    <ApproachStory onOpenGuide={onOpenGuide} />
    {quickView && <QuickView key={quickView.id} product={quickView} onDismiss={() => setQuickView(null)} />}
    {filtersOpen && <FilterSheet categories={catalog?.categories ?? []} current={{ category, inStock, sort }} onApply={applyFilters} onDismiss={() => setFiltersOpen(false)} />}
  </>
}
