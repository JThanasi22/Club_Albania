import { PrismaClient } from '@prisma/client'

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined
}

// MongoDB connection URL - check if env var is a valid MongoDB URL, otherwise use fallback

// Use environment variable only if it's a valid MongoDB URL
const DATABASE_URL = (process.env.DATABASE_URL?.startsWith('mongo') === true)
  ? process.env.DATABASE_URL
  : process.env.MONGODB_URL

export const db = global.prisma ?? new PrismaClient({
  datasourceUrl: DATABASE_URL,
  log: [],
})

if (process.env.NODE_ENV !== 'production') global.prisma = db
