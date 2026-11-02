import { useId, useState } from 'react'
import type { Category } from '../lib/catalog'
import { Icon } from './Icon'
import { Modal } from './Modal'
import { useDismissDialog } from './dialogContext'

export type CatalogFilters = { category: string; inStock: boolean; sort: string }

export function FilterSheet({ categories, current, onApply, onDismiss }: {
  categories: Category[]; current: CatalogFilters; onApply: (filters: CatalogFilters) => void; onDismiss: () => void
}) {
  const titleId = useId()
  return <Modal labelledBy={titleId} closeLabel="Close filters" className="filter-modal" onDismiss={onDismiss}><FilterSheetContent categories={categories} current={current} onApply={onApply} titleId={titleId} /></Modal>
}

function FilterSheetContent({ categories, current, onApply, titleId }: { categories: Category[]; current: CatalogFilters; onApply: (filters: CatalogFilters) => void; titleId: string }) {
  const dismiss = useDismissDialog()
  const [draft, setDraft] = useState(current)
  return <div className="filter-sheet-content">
    <span className="sheet-handle" aria-hidden="true" />
    <span className="eyebrow">MAKE IT YOUR KIND OF GREEN</span><h2 id={titleId}>Filter & sort.</h2>
    <fieldset className="sheet-category-options"><legend>Find your thing</legend><button type="button" aria-pressed={!draft.category} onClick={() => setDraft(previous => ({ ...previous, category: '' }))}>All good things</button>{categories.map(item => <button type="button" key={item.name} aria-pressed={draft.category === item.name} onClick={() => setDraft(previous => ({ ...previous, category: item.name }))}>{item.name}<span>{item.count}</span></button>)}</fieldset>
    <label className="sheet-sort">Sort by<select value={draft.sort} onChange={event => setDraft(previous => ({ ...previous, sort: event.target.value }))}><option value="featured">Our favorites</option><option value="newest">Newest arrivals</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="name">Name: A–Z</option></select></label>
    <label className="sheet-stock"><span><strong>In stock only</strong><small>Just the good things available now.</small></span><input type="checkbox" checked={draft.inStock} onChange={event => setDraft(previous => ({ ...previous, inStock: event.target.checked }))} /></label>
    <div className="filter-sheet-actions"><button type="button" className="text-link" onClick={() => setDraft({ category: '', inStock: false, sort: 'featured' })}>Reset</button><button type="button" className="button button-dark" onClick={() => { onApply(draft); dismiss() }}>Show results <Icon name="arrow" size={18} /></button></div>
  </div>
}
