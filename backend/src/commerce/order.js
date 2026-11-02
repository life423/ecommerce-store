import mongoose from 'mongoose'

const line = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, required: true },
  name: { type: String, required: true }, slug: { type: String, required: true },
  image: { url: String, alt: String },
  unitPriceCents: { type: Number, required: true }, quantity: { type: Number, required: true },
}, { _id: false })
const schema = new mongoose.Schema({
  _id: String, attemptId: { type: String, required: true }, requestHash: { type: String, required: true },
  tokenHash: { type: String, required: true }, returnToken: { type: String, required: true, select: false },
  items: { type: [line], required: true }, totalCents: { type: Number, required: true }, currency: { type: String, default: 'usd' },
  state: { type: String, enum: ['creating', 'open', 'paid', 'expired', 'failed'], default: 'creating' },
  sessionId: String, checkoutUrl: String, sessionParams: mongoose.Schema.Types.Mixed,
  expiresAt: Date, leaseUntil: Date, cleanupComplete: { type: Boolean, default: false }, paidAt: Date,
  stripeAttempted: { type: Boolean, default: false },
}, { timestamps: true, strict: 'throw' })
schema.index({ attemptId: 1 }, { unique: true })
schema.index({ sessionId: 1 }, { unique: true, sparse: true })
schema.index({ state: 1, expiresAt: 1 })

export function createOrderModel(connection = mongoose.connection) {
  return connection.models.Order ?? connection.model('Order', schema)
}
