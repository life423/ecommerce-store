import mongoose from 'mongoose'

export const homepagePlacement = 'homepage'

const schema = new mongoose.Schema({
  _id: { type: String, enum: [homepagePlacement] },
  productId: { type: mongoose.Schema.Types.ObjectId, default: null },
}, { versionKey: false, strict: 'throw' })

export function createHomepageModel(connection = mongoose.connection) {
  return connection.models.HomepageSelection ?? connection.model('HomepageSelection', schema)
}
