import mongoose from 'mongoose'

export const homepagePlacement = 'homepage'
export const homepageLimit = 3

const schema = new mongoose.Schema({
  _id: { type: String, enum: [homepagePlacement] },
  productId: { type: mongoose.Schema.Types.ObjectId, default: null },
  productIds: { type: [mongoose.Schema.Types.ObjectId], default: undefined },
  revision: { type: Number, default: 0 },
}, { versionKey: false, strict: 'throw' })

export function createHomepageModel(connection = mongoose.connection) {
  return connection.models.HomepageSelection ?? connection.model('HomepageSelection', schema)
}

export function homepageProductIds(choice) {
  return choice?.productIds ?? (choice?.productId ? [choice.productId] : [])
}
