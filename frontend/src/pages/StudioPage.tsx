import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { api, ApiError, centsFromInput, money } from '../lib/catalog'
import type { AdminProduct, CatalogInfo, ProductInput, ProductList } from '../lib/catalog'
import { useResource } from '../lib/useResource'
import { Icon } from '../components/Icon'
import { HomepagePlacement } from '../components/HomepagePlacement'

type Form = { name: string; slug: string; sku: string; description: string; category: string; price: string; originalPrice: string; inventory: string; status: 'draft' | 'active' | 'archived'; featured: boolean; badge: string; images: { url: string; alt: string }[]; highlights: string }
const blank = (): Form => ({ name: '', slug: '', sku: '', description: '', category: 'Growing kits', price: '', originalPrice: '', inventory: '0', status: 'draft', featured: false, badge: '', images: [{ url: '', alt: '' }], highlights: '' })
const toForm = (product: AdminProduct): Form => ({ name: product.name, slug: product.slug, sku: product.sku, description: product.description, category: product.category, price: (product.priceCents / 100).toFixed(2), originalPrice: product.compareAtPriceCents === null ? '' : (product.compareAtPriceCents / 100).toFixed(2), inventory: String(product.inventory), status: product.status, featured: product.featured, badge: product.badge, images: product.images.map(image => ({ ...image })), highlights: product.highlights.join('\n') })

export function StudioPage({ catalog, onSessionExpired }: { catalog: CatalogInfo; onSessionExpired: () => void }) {
  const [refresh, setRefresh] = useState(0)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<AdminProduct | null>(null)
  const [form, setForm] = useState<Form>(blank)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const [notice, setNotice] = useState('')
  const errorSummary = useRef<HTMLDivElement>(null)
  useEffect(() => { if (error) errorSummary.current?.focus() }, [error])
  useEffect(() => {
    const timer = window.setTimeout(() => { setSearch(query.trim()); setPage(1) }, 250)
    return () => window.clearTimeout(timer)
  }, [query])
  const params = new URLSearchParams({ limit: '12', page: String(page), sort: 'newest' })
  if (search) params.set('q', search)
  const products = useResource<ProductList<AdminProduct>>(`/admin/products?${params}`, refresh)
  useEffect(() => {
    if (products.error?.status === 401 || error?.status === 401) onSessionExpired()
  }, [products.error, error, onSessionExpired])

  function choose(product: AdminProduct | null) {
    if (dirty && !window.confirm('Discard the unsaved changes to this product?')) return
    setSelected(product); setForm(product ? toForm(product) : blank()); setDirty(false); setError(null); setNotice('')
  }
  function change<K extends keyof Form>(key: K, value: Form[K]) {
    setForm(previous => ({ ...previous, [key]: value })); setDirty(true); setNotice('')
  }
  async function reloadProduct() {
    if (!selected) return
    try {
      const data = await api<{ product: AdminProduct }>(`/admin/products/${selected.id}`)
      setSelected(data.product); setForm(toForm(data.product)); setDirty(false); setError(null); setRefresh(value => value + 1)
    } catch (failure) { setError(failure instanceof ApiError ? failure : new ApiError('Unable to reload the product.')) }
  }
  async function save(event: FormEvent) {
    event.preventDefault()
    if (saving) return
    setError(null); setNotice('')
    const priceCents = centsFromInput(form.price)
    const compareAtPriceCents = form.originalPrice ? centsFromInput(form.originalPrice) : null
    const fields: Record<string, string> = {}
    if (priceCents === null) fields.priceCents = 'Enter a dollar amount with up to two decimal places.'
    if (form.originalPrice && compareAtPriceCents === null) fields.compareAtPriceCents = 'Enter a dollar amount with up to two decimal places.'
    if (!/^\d+$/.test(form.inventory)) fields.inventory = 'Enter a whole stock count.'
    if (Object.keys(fields).length) { setError(new ApiError('Check the highlighted fields.', fields, 422)); return }
    const body: ProductInput = { name: form.name, slug: form.slug, sku: form.sku, description: form.description, category: form.category, priceCents: priceCents!, compareAtPriceCents, currency: 'usd', inventory: Number(form.inventory), status: form.status, featured: form.featured, badge: form.badge, images: form.images, highlights: form.highlights.split('\n').map(value => value.trim()).filter(Boolean), ...(selected ? { version: selected.version } : {}) }
    setSaving(true)
    try {
      const data = await api<{ product: AdminProduct }>(selected ? `/admin/products/${selected.id}` : '/admin/products', {
        method: selected ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      setSelected(data.product); setForm(toForm(data.product)); setDirty(false); setNotice(selected ? 'Product saved.' : 'Product created.'); setRefresh(value => value + 1)
    } catch (failure) { setError(failure instanceof ApiError ? failure : new ApiError('Unable to save the product.')) }
    finally { setSaving(false) }
  }
  const fieldError = (key: string) => error?.fields[key] ? <span className="field-error" id={`error-${key}`}>{error.fields[key]}</span> : null
  const invalid = (key: string) => ({ 'aria-invalid': !!error?.fields[key], 'aria-describedby': error?.fields[key] ? `error-${key}` : undefined })

  return <>
    <div className="studio-heading"><div><span className="eyebrow">BEHIND THE GREEN</span><h1>Product studio.</h1><p>A little care for everything in your collection.</p></div><a className="text-link" href="/">View the storefront <Icon name="arrow" /></a></div>
    <div className="studio-note"><Icon name="leaf" size={19} /> Only active products appear in the store.</div>
    <div className="studio-layout"><aside className="studio-list"><div className="studio-list-heading"><h2>Your products</h2><button className="icon-button" onClick={() => choose(null)} aria-label="Add a new product"><Icon name="plus" /></button></div>
      <label className="studio-search"><span>Find a product</span>
        <input type="search" placeholder="Name or SKU" maxLength={100} value={query} onChange={event => setQuery(event.target.value)} />
      </label>
      {products.loading && <p className="muted">Loading your collection…</p>}
      {products.error && <div role="alert"><p>{products.error.message}</p><button className="text-link" onClick={() => setRefresh(value => value + 1)}>Try again</button></div>}
      {products.data?.items.map(product => <button key={product.id} className={`studio-product ${selected?.id === product.id ? 'selected' : ''}`} onClick={() => choose(product)}><img src={product.images[0].url} alt="" width="54" height="54" /><span><strong>{product.name}</strong><small>{money(product.priceCents)} · {product.inventory} in stock</small><span className={`status-pill status-${product.status}`}>{product.status}</span></span></button>)}
      {!products.loading && products.data?.items.length === 0 && <p className="muted">{search ? 'No products match your search.' : 'Your first good thing starts here. Add a product to get growing.'}</p>}
      {products.data && products.data.pagination.pages > 1 && <div className="pagination"><button disabled={page === 1} onClick={() => setPage(value => value - 1)}>Previous</button><span>{page}/{products.data.pagination.pages}</span><button disabled={page >= products.data.pagination.pages} onClick={() => setPage(value => value + 1)}>Next</button></div>}
    </aside><form className="product-form" onSubmit={save} noValidate>
      <div className="form-heading"><div><h2>{selected ? 'Edit product' : 'A new good thing'}</h2><p>{selected ? selected.sku : 'Start as a draft. Publish when you are ready.'}</p></div>{selected?.status === 'active' && <a href={`/products/${selected.slug}`} className="text-link">Preview <Icon name="arrow" size={16} /></a>}</div>
      <HomepagePlacement product={selected} productRefresh={refresh} editing={dirty || saving} onSessionExpired={onSessionExpired} />
      {notice && <div role="status" className="success-notice"><Icon name="check" size={18} />{notice}</div>}
      {error && <div role="alert" ref={errorSummary} tabIndex={-1} className="error-notice"><p>{error.message}</p>{error.status === 409 && error.message.includes('another session') && <button type="button" className="text-link" onClick={() => void reloadProduct()}>Reload latest product</button>}</div>}
      <fieldset disabled={saving}>
        <div className="form-grid">
          <label className="full-width">Product name<input value={form.name} maxLength={120} onChange={event => change('name', event.target.value)} {...invalid('name')} />{fieldError('name')}</label>
          <label>SKU<input value={form.sku} maxLength={48} placeholder="RW-KIT-02" onChange={event => change('sku', event.target.value)} {...invalid('sku')} />{fieldError('sku')}</label>
          <label>Category<select value={form.category} onChange={event => change('category', event.target.value)}>{catalog.categories.map(category => <option key={category.name}>{category.name}</option>)}</select>{fieldError('category')}</label>
          <label className="full-width">Product URL slug<input value={form.slug} maxLength={140} placeholder="Leave blank to generate from the name" onChange={event => change('slug', event.target.value)} {...invalid('slug')} />{fieldError('slug')}</label>
          <label className="full-width">Description<textarea rows={5} maxLength={4000} value={form.description} onChange={event => change('description', event.target.value)} {...invalid('description')} />{fieldError('description')}</label>
          <label>Price · USD<input inputMode="decimal" placeholder="42.00" value={form.price} onChange={event => change('price', event.target.value)} {...invalid('priceCents')} />{fieldError('priceCents')}</label>
          <label>Original price · optional<input inputMode="decimal" placeholder="Leave blank if not on sale" value={form.originalPrice} onChange={event => change('originalPrice', event.target.value)} {...invalid('compareAtPriceCents')} />{fieldError('compareAtPriceCents')}</label>
          <label>Stock quantity<input inputMode="numeric" value={form.inventory} onChange={event => change('inventory', event.target.value)} {...invalid('inventory')} />{fieldError('inventory')}</label>
          <label>Status<select value={form.status} onChange={event => change('status', event.target.value as Form['status'])}><option value="draft">Draft · hidden from the store</option><option value="active">Active · visible in the store</option><option value="archived">Archived · hidden from the store</option></select></label>
          <label>Product badge<select value={form.badge} onChange={event => change('badge', event.target.value)}>{catalog.badges.map(badge => <option key={badge} value={badge}>{badge || 'No badge'}</option>)}</select></label>
          <label className="checkbox-label"><input type="checkbox" checked={form.featured} onChange={event => change('featured', event.target.checked)} /> Feature in our favorites</label>
        </div>
        <div className="image-fields"><h3>Product images</h3><p>Use a public HTTPS image URL, or a bundled image such as /images/planter.jpg. Add descriptive alt text.</p>{fieldError('images')}
          {form.images.map((image, index) => <div className="image-field-row" key={index}><span className="image-number">{String(index + 1).padStart(2, '0')}</span><div><label>Image {index + 1} URL<input value={image.url} onChange={event => change('images', form.images.map((item, i) => i === index ? { ...item, url: event.target.value } : item))} /></label><label>Image {index + 1} description<input value={image.alt} maxLength={160} onChange={event => change('images', form.images.map((item, i) => i === index ? { ...item, alt: event.target.value } : item))} /></label></div>{form.images.length > 1 && <button className="icon-button" type="button" aria-label={`Remove image ${index + 1}`} onClick={() => change('images', form.images.filter((_, i) => i !== index))}><Icon name="close" size={17} /></button>}</div>)}
          {form.images.length < 5 && <button type="button" className="text-link" onClick={() => change('images', [...form.images, { url: '', alt: '' }])}><Icon name="plus" size={16} /> Add another image</button>}
        </div>
        <label className="highlights-field">Product highlights <span className="muted">One per line, up to six.</span><textarea rows={4} value={form.highlights} onChange={event => change('highlights', event.target.value)} {...invalid('highlights')} />{fieldError('highlights')}</label>
        <div className="form-actions"><span>{dirty ? 'You have unsaved changes.' : selected ? 'All changes saved.' : 'Drafts stay behind the scenes.'}</span><button type="submit" className="button button-dark">{saving ? 'Saving…' : selected ? 'Save changes' : 'Create product'}<Icon name="arrow" size={18} /></button></div>
      </fieldset>
    </form></div>
  </>
}
