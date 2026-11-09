import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import mongoose from 'mongoose'

export const staffUsername = /^[a-z0-9][a-z0-9._-]{2,39}$/
const derive = promisify(scrypt)
const scryptOptions = { N: 2 ** 15, r: 8, p: 3, maxmem: 64 * 1024 * 1024 }

const account = new mongoose.Schema({
  username: { type: String, required: true, unique: true, match: staffUsername },
  passwordHash: { type: String, required: true, select: false },
  active: { type: Boolean, default: true },
}, { timestamps: true })

const session = new mongoose.Schema({
  _id: String,
  staffId: { type: mongoose.Schema.Types.ObjectId, required: true },
  expiresAt: { type: Date, required: true, expires: 0 },
})

export function createStaffModels(connection = mongoose.connection) {
  return {
    Staff: connection.models.Staff ?? connection.model('Staff', account),
    StaffSession: connection.models.StaffSession ?? connection.model('StaffSession', session),
  }
}

export async function hashStaffPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const hash = await derive(password, salt, 64, scryptOptions)
  return `${salt}:${hash.toString('hex')}`
}

export async function verifyStaffPassword(password, stored) {
  // Spend the same KDF work for an unknown username.
  const credentials = /^([a-f0-9]{32}):([a-f0-9]{128})$/.exec(stored ?? '')
  const salt = credentials?.[1] ?? '0'.repeat(32)
  const hash = await derive(password, salt, 64, scryptOptions)
  const expected = credentials ? Buffer.from(credentials[2], 'hex') : Buffer.alloc(64)
  return timingSafeEqual(hash, expected) && Boolean(credentials)
}
