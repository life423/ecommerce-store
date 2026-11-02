import { describe, expect, it } from 'vitest'
import { cartReducer, emptyCart, parseCart } from './cart'
const a = '1234567890abcdef12345678', b = 'abcdef1234567890abcdef12'
describe('persistent bag', () => {
  it('recovers safely from invalid storage and sanitizes duplicate, excessive and invalid entries', () => {
    expect(parseCart('{broken')).toEqual(emptyCart)
    expect(parseCart(JSON.stringify({ items: [{ productId: a, quantity: 7 }, { productId: a, quantity: 9 }, { productId: b, quantity: -1 }, { productId: 'bad', quantity: 1 }] })).items).toEqual([{ productId: a, quantity: 10 }])
  })
  it('caps additions by known inventory and the per-product limit, and removes explicitly', () => {
    let state = cartReducer(emptyCart, { type: 'add', productId: a, max: 1 })
    state = cartReducer(state, { type: 'add', productId: a, max: 1 })
    expect(state.items).toEqual([{ productId: a, quantity: 1 }])
    expect(cartReducer(state, { type: 'quantity', productId: a, quantity: 0 }).items).toEqual([])
    expect(cartReducer(state, { type: 'quantity', productId: a, quantity: 1.5 })).toEqual(state)
  })
  it('subtracts only confirmed purchased quantities, preserves later additions, and handles duplicate completion once', () => {
    const state = { items: [{ productId: a, quantity: 4 }, { productId: b, quantity: 2 }], completedOrders: [] }
    const action = { type: 'paid' as const, orderId: 'test-order', items: [{ productId: a, quantity: 2 }] }
    const paid = cartReducer(state, action)
    expect(paid.items).toEqual([{ productId: a, quantity: 2 }, { productId: b, quantity: 2 }])
    expect(cartReducer(paid, action)).toBe(paid)
  })
})
