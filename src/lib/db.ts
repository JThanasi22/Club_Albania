import { PrismaClient } from '@prisma/client'

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined
}

// Fallback URL for deployment - use environment variable if available, otherwise use hardcoded
const DATABASE_URL = process.env.DATABASE_URL || 'mongodb+srv://jordthanasi_db_user:Partizani15%24@clubalbania.wanfjrm.mongodb.net/volleyball-team?retryWrites=true&w=majority&appName=Clubalbania&tls=true&tlsAllowInvalidCertificates=true'

export const db = global.prisma ?? new PrismaClient({
  datasourceUrl: DATABASE_URL,
  log: [],
})

if (process.env.NODE_ENV !== 'production') global.prisma = db
