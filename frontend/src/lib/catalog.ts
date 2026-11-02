export type Category = { name: string; count: number }
export type Product = {
  id: string; name: string; slug: string; description: string; category: string
  priceCents: number; compareAtPriceCents: number | null; currency: 'usd'
  inventory: number; featured: boolean; badge: string
  images: { url: string; alt: string }[]; highlights: string[]
  createdAt: string; updatedAt: string
}
export type AdminProduct = Product & { sku: string; status: 'draft' | 'active' | 'archived'; version: number }
export type ProductInput = Omit<AdminProduct, 'id' | 'createdAt' | 'updatedAt' | 'version'> & { version?: number }
export type CatalogInfo = { categories: Category[]; currency: 'usd'; editorEnabled: boolean; databaseConnected: boolean; badges: string[] }
export type ProductList<T = Product> = { items: T[]; pagination: { page: number; limit: number; total: number; pages: number } }

export class ApiError extends Error {
  fields: Record<string, string>
  status: number
  code: string
  constructor(message: string, fields: Record<string, string> = {}, status = 500, code = 'UNKNOWN') {
    super(message)
    this.fields = fields
    this.status = status
    this.code = code
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api${path}`, { ...options, signal: options.signal ?? AbortSignal.timeout(10_000) })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError('We could not connect. Please try again in a moment.')
  }
  const data = await response.json().catch(() => { throw new ApiError('The store is temporarily unavailable. Please try again.') })
  if (!response.ok) throw new ApiError(data.error?.message ?? 'Something went wrong. Please try again.', data.error?.fields, response.status, data.error?.code)
  return data as T
}

export function money(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100)
}

export function centsFromInput(value: string): number | null {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return null
  const [whole, fraction = ''] = value.split('.')
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  return Number.isSafeInteger(cents) ? cents : null
}

export const editorHeaders = { 'Content-Type': 'application/json', 'X-Catalog-Editor': 'local' }
