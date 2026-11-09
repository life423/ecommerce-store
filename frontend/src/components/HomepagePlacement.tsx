import { useEffect, useState } from 'react'
import { api, ApiError } from '../lib/catalog'
import type { AdminProduct } from '../lib/catalog'
import { useResource } from '../lib/useResource'

type Selection = { id: string; name: string; available: boolean }
type Lineup = { selections: Selection[]; limit: number; revision: number }

export function HomepagePlacement({ product, productRefresh, editing, onSessionExpired }: {
  product: AdminProduct | null
  productRefresh: number
  editing: boolean
  onSessionExpired: () => void
}) {
  const [attempt, setAttempt] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [notice, setNotice] = useState('')
  const { data, error, loading } = useResource<Lineup>('/admin/homepage-product', attempt + productRefresh)
  const selections = data?.selections ?? []
  const ids = selections.map(selection => selection.id)
  const isSelected = product && ids.includes(product.id)
  const canFeature = Boolean(product?.status === 'active' && product.inventory > 0)
  const full = data ? selections.length >= data.limit : false
  const busy = saving || loading

  useEffect(() => {
    if (error?.status === 401) onSessionExpired()
  }, [error, onSessionExpired])

  async function save(productIds: string[]) {
    if (!data || busy) return
    setSaving(true)
    setSaveError('')
    setNotice('')
    try {
      await api('/admin/homepage-product', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds, revision: data.revision }),
      })
      setAttempt(value => value + 1)
      setNotice(productIds.length ? 'Homepage lineup updated.' : 'Automatic selection restored.')
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) onSessionExpired()
      else {
        if (failure instanceof ApiError && failure.status === 409) setAttempt(value => value + 1)
        setSaveError(failure instanceof ApiError ? failure.message : 'Unable to update the homepage lineup.')
      }
    } finally {
      setSaving(false)
    }
  }

  function moveUp(index: number) {
    const reordered = [...ids]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(index - 1, 0, moved)
    void save(reordered)
  }

  return <section className="homepage-placement" aria-labelledby="homepage-placement-title">
    <h3 id="homepage-placement-title">Homepage products</h3>
    {error ? <div role="alert">
      <p>{error.message}</p>
      <button type="button" className="text-link" onClick={() => setAttempt(value => value + 1)}>Retry homepage settings</button>
    </div> : <>
      <p>{!data ? 'Loading homepage settings…' : selections.length
        ? `${selections.length} of ${data.limit} slots used. Shoppers see available products in this order.`
        : `Choose up to ${data.limit} products. The store shows an in-stock product automatically when the lineup is empty.`}</p>
      {selections.length > 0 && <ol className="homepage-lineup" aria-label="Homepage lineup">
        {selections.map((selection, index) => <li key={selection.id}>
          <div><strong>{selection.name}</strong>{!selection.available && <span>Hidden until active and in stock</span>}</div>
          <div className="homepage-placement-actions">
            <button type="button" className="button button-secondary" aria-label={`Move ${selection.name} up`}
              disabled={index === 0 || busy} onClick={() => moveUp(index)}>Move up</button>
            <button type="button" className="button button-secondary" aria-label={`Remove ${selection.name} from homepage`}
              disabled={busy} onClick={() => void save(ids.filter(id => id !== selection.id))}>Remove</button>
          </div>
        </li>)}
      </ol>}
      {!product && <p>Open a published, in-stock product from your list to add it.</p>}
      {product && !isSelected && <p>{editing ? 'Save your edits before adding this product.'
        : !canFeature ? 'Publish this product and add stock to feature it.'
          : full ? 'Remove a product to make room for another.'
            : `Add ${product.name} to the homepage lineup.`}</p>}
      <div className="homepage-placement-actions">
        {product && !isSelected && <button type="button" className="button button-secondary"
          disabled={!data || !canFeature || editing || busy || full}
          onClick={() => void save([...ids, product.id])}>Add to homepage</button>}
        {selections.length > 0 && <button type="button" className="button button-secondary" disabled={busy}
          onClick={() => void save([])}>Use automatic selection</button>}
      </div>
    </>}
    {saving && <p role="status">Updating homepage…</p>}
    {notice && <p role="status">{notice}</p>}
    {saveError && <p role="alert" className="error-notice">{saveError}</p>}
  </section>
}
