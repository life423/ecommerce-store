import { randomBytes } from 'node:crypto'
import mongoose from 'mongoose'
import { readConfig } from '../config.js'
import { createStaffModels, hashStaffPassword, staffUsername } from './accounts.js'

const username = process.argv[2]?.trim().toLowerCase() ?? ''
if (process.argv.length !== 3 || !staffUsername.test(username)) {
  console.error('Usage: npm run staff:create -w backend -- <username> (3–40 letters, numbers, dots, underscores, or hyphens)')
  process.exit(1)
}

try {
  const { mongoUri } = readConfig()
  if (!mongoUri) throw new Error('Set MONGO_URI before creating a staff account.')
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 })
  const { Staff } = createStaffModels()
  await Staff.init()
  const password = randomBytes(24).toString('base64url')
  await Staff.create({ username, passwordHash: await hashStaffPassword(password) })
  console.log(`Username: ${username}\nPassword: ${password}`)
} catch (error) {
  console.error(error.code === 11000
    ? 'That staff username already exists.'
    : 'Could not create the staff account. Check the database configuration and availability.')
  process.exitCode = 1
} finally {
  await mongoose.disconnect()
}
