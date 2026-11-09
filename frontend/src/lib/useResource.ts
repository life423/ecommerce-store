import { useEffect, useState } from 'react'
import { api, ApiError } from './catalog'

export function useResource<T>(path: string, refresh = 0) {
  const [result, setResult] = useState<{ data: T | null; error: ApiError | null; loading: boolean }>({ data: null, error: null, loading: true })
  useEffect(() => {
    const controller = new AbortController()
    let active = true
    const timeout = setTimeout(() => controller.abort(new DOMException('Connection timed out', 'TimeoutError')), 10_000)
    async function load() {
      setResult(previous => ({ ...previous, loading: true, error: null }))
      try {
        const data = await api<T>(path, { signal: controller.signal })
        if (active) setResult({ data, error: null, loading: false })
      } catch (error) {
        if (active) setResult({ data: null, error: error instanceof ApiError ? error : new ApiError('The connection timed out. Please try again.'), loading: false })
      } finally { clearTimeout(timeout) }
    }
    void load()
    return () => { active = false; clearTimeout(timeout); controller.abort() }
  }, [path, refresh])
  return result
}
