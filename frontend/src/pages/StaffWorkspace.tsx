import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api, ApiError } from '../lib/catalog'
import type { CatalogInfo } from '../lib/catalog'
import { useResource } from '../lib/useResource'
import { Icon } from '../components/Icon'
import { StudioPage } from './StudioPage'
import { StaffOrders } from './StaffOrders'

type StaffSession = { username: string; expiresAt: string }
type SessionResponse = { staff: StaffSession }

export function StaffWorkspace({ catalog, catalogLoading, orders }: {
  catalog: CatalogInfo | null
  catalogLoading: boolean
  orders: boolean
}) {
  const [attempt, setAttempt] = useState(0)
  const session = useResource<SessionResponse>('/admin/session', attempt)
  const [override, setOverride] = useState<StaffSession | null>()
  const staff = override === undefined ? session.data?.staff : override
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState('')
  const requireSignIn = useCallback(() => { setOverride(null) }, [])

  useEffect(() => {
    if (!staff) return
    const remaining = new Date(staff.expiresAt).getTime() - Date.now()
    const timer = window.setTimeout(requireSignIn, Math.max(remaining, 0))
    return () => window.clearTimeout(timer)
  }, [staff, requireSignIn])

  async function signOut() {
    setSigningOut(true)
    setSignOutError('')
    try {
      await api('/admin/sign-out', { method: 'POST' })
      requireSignIn()
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) requireSignIn()
      else setSignOutError('We couldn’t sign you out. Try again.')
    } finally {
      setSigningOut(false)
    }
  }

  if (!staff) {
    if (override === undefined && session.loading) {
      return <main className="page-width empty-state"><p role="status">Checking your staff session…</p></main>
    }
    if (override === undefined && session.error && session.error.status !== 401) {
      return <main className="page-width empty-state">
        <h1>Staff workspace unavailable</h1>
        <p role="alert">{session.error.message}</p>
        <button type="button" className="button button-dark" onClick={() => setAttempt(value => value + 1)}>Try again</button>
      </main>
    }
    return <StaffSignIn onSignedIn={setOverride} />
  }

  return <main className="page-width studio-page">
    <div className="staff-bar">
      <nav aria-label="Staff workspace">
        <a href="/studio" aria-current={!orders ? 'page' : undefined}>Products</a>
        <a href="/studio/orders" aria-current={orders ? 'page' : undefined}>Test orders</a>
      </nav>
      <div className="staff-account">
        <span>Signed in as <strong>{staff.username}</strong></span>
        <button type="button" className="button button-secondary" disabled={signingOut} onClick={() => void signOut()}>
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </div>
    {signOutError && <p role="alert" className="error-notice">{signOutError}</p>}
    {orders ? <StaffOrders onSessionExpired={requireSignIn} />
      : catalogLoading ? <p role="status">Opening the product studio…</p>
        : catalog?.databaseConnected ? <StudioPage catalog={catalog} onSessionExpired={requireSignIn} />
          : <section className="empty-state"><h1>Product studio</h1><p>The catalog is temporarily unavailable.</p><a href="/studio" className="button button-secondary">Reload catalog</a></section>}
  </main>
}

function StaffSignIn({ onSignedIn }: { onSignedIn: (staff: StaffSession) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const fields = new FormData(event.currentTarget)
    setError('')
    setBusy(true)
    try {
      const { staff } = await api<SessionResponse>('/admin/sign-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: fields.get('username'), password: fields.get('password') }),
      })
      onSignedIn(staff)
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : 'Sign-in failed. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return <main className="page-width staff-sign-in">
    <form className="product-form" onSubmit={signIn}>
      <Icon name="lock" size={24} />
      <span className="eyebrow">REWILD STAFF WORKSPACE</span>
      <h1>Staff sign-in</h1>
      <p>Sign in to manage products and review Stripe test orders.</p>
      {error && <p className="error-notice" role="alert">{error}</p>}
      <fieldset disabled={busy}>
        <label>Username<input name="username" autoComplete="username" autoCapitalize="none" maxLength={40} required /></label>
        <label>Password<input name="password" type="password" autoComplete="current-password" maxLength={256} required /></label>
        <button type="submit" className="button button-dark">{busy ? 'Signing in…' : 'Sign in'} <Icon name="arrow" size={18} /></button>
      </fieldset>
    </form>
  </main>
}
