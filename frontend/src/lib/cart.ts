export type CartItem = { productId: string; quantity: number }
export type CartState = { items: CartItem[]; completedOrders: string[] }
export const CART_KEY = 'rewild.bag.v1'
export const emptyCart: CartState = { items: [], completedOrders: [] }
export function parseCart(raw: string | null): CartState {
  try {
    const data = JSON.parse(raw ?? '{}')
    const items: CartItem[] = []
    if (Array.isArray(data?.items)) for (const item of data.items) {
      if (item && typeof item.productId === 'string' && /^[a-f\d]{24}$/i.test(item.productId) && Number.isInteger(item.quantity) && item.quantity > 0) {
        const id = item.productId.toLowerCase(), previous = items.find(line => line.productId === id)
        if (previous) previous.quantity = Math.min(10, previous.quantity + item.quantity)
        else if (items.length < 20) items.push({ productId: id, quantity: Math.min(10, item.quantity) })
      }
    }
    return { items, completedOrders: Array.isArray(data?.completedOrders) ? data.completedOrders.filter((id: unknown) => typeof id === 'string').slice(-100) : [] }
  } catch { return emptyCart }
}
export type CartAction = { type: 'quantity'; productId: string; quantity: number } | { type: 'add'; productId: string; max: number } | { type: 'sync'; state: CartState } | { type: 'paid'; orderId: string; items: CartItem[] }
export function cartReducer(state: CartState, action: CartAction): CartState {
  if (action.type === 'sync') return action.state
  if (action.type === 'paid') {
    if (state.completedOrders.includes(action.orderId)) return state
    return { items: state.items.map(line => ({ ...line, quantity: Math.max(0, line.quantity - (action.items.find(item => item.productId === line.productId)?.quantity ?? 0)) })).filter(line => line.quantity > 0), completedOrders: [...state.completedOrders, action.orderId].slice(-100) }
  }
  const previous = state.items.find(item => item.productId === action.productId)
  const quantity = action.type === 'add' ? Math.min(10, action.max, (previous?.quantity ?? 0) + 1) : action.quantity
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 10 || (!previous && state.items.length >= 20)) return state
  return { ...state, items: quantity === 0 ? state.items.filter(item => item.productId !== action.productId)
    : previous ? state.items.map(item => item.productId === action.productId ? { ...item, quantity } : item) : [...state.items, { productId: action.productId, quantity }] }
}
