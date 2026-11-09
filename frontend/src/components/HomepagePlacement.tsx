import { useEffect, useState } from 'react'
import { api, ApiError } from '../lib/catalog'
import type { AdminProduct } from '../lib/catalog'
import { useResource } from '../lib/useResource'

type Selection = { id: string; name: string; available: boolean }

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
  const { data, error, loading } = useResource<{ selection: Selection | null }>('/admin/homepage-product', attempt + productRefresh)
  const selection = data?.selection
  const isSelected = Boolean(product && product.id === selection?.id)
  const canFeature = Boolean(product?.status === 'active' && product.inventory > 0)

  useEffect(() => {
    if (error?.status === 401) onSessionExpired()
  }, [error, onSessionExpired])

  async function choose(productId: string | null) {
    if (saving || loading) return
    setSaving(true)
    setSaveError('')
    setNotice('')
    try {
      await api('/admin/homepage-product', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      })
      setAttempt(value => value + 1)
      setNotice(productId ? 'Homepage product updated.' : 'Automatic selection restored.')
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) onSessionExpired()
      else setSaveError(failure instanceof ApiError ? failure.message : 'Unable to update the homepage product.')
    } finally {
      setSaving(false)
    }
  }

  return <section className="homepage-placement" aria-labelledby="homepage-placement-title">
    <h3 id="homepage-placement-title">Homepage product</h3>
    {error ? <div role="alert">
      <p>{error.message}</p>
      <button type="button" className="text-link" onClick={() => setAttempt(value => value + 1)}>Retry homepage settings</button>
    </div> : <>
      <p>{!data ? 'Loading homepage settings…' : selection
        ? <>Selected for the homepage: <strong>{selection.name}</strong>.{!selection.available && ' The store shows an available product until this one is back.'}</>
        : 'The store automatically shows an in-stock product.'}</p>
      {product && !isSelected && <p>{editing ? 'Save your edits before featuring this product.'
        : !canFeature ? 'Publish this product and add stock to feature it.'
          : 'Feature this product in the main spot at the top of the homepage.'}</p>}
      {!product && <p>Choose a published, in-stock product from your list to feature it here.</p>}
      <div className="homepage-placement-actions">
        {product && !isSelected && <button type="button" className="button button-secondary"
          disabled={!data || !canFeature || editing || saving || loading}
          onClick={() => void choose(product.id)}>Feature on homepage</button>}
        {selection && <button type="button" className="button button-secondary" disabled={saving || loading}
          onClick={() => void choose(null)}>Use automatic selection</button>}
      </div>
    </>}
    {saving && <p role="status">Updating homepage…</p>}
    {notice && <p role="status">{notice}</p>}
    {saveError && <p role="alert" className="error-notice">{saveError}</p>}
  </section>
}
