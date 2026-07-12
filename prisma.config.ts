import { defineConfig } from 'prisma/config'
import fs from 'fs'
import path from 'path'
import dns from 'dns'

if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first')
}

function loadDotEnv() {
  const filenames = ['.env.local', '.env']
  for (const filename of filenames) {
    try {
      const envPath = path.resolve(process.cwd(), filename)
      if (fs.existsSync(envPath)) {
        const envConfig = fs.readFileSync(envPath, 'utf8')
        for (const line of envConfig.split('\n')) {
          const trimmed = line.trim()
          if (!trimmed || trimmed.startsWith('#')) continue
          
          const match = trimmed.match(/^([\w.-]+)\s*=\s*(.*)?$/)
          if (match) {
            const key = match[1]
            let value = match[2] || ''
            
            if (value.startsWith('"') && value.endsWith('"')) {
              value = value.slice(1, -1)
            } else if (value.startsWith("'") && value.endsWith("'")) {
              value = value.slice(1, -1)
            }
            
            if (!process.env[key]) {
              process.env[key] = value
            }
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to manually load ${filename} file:`, error)
    }
  }
}

loadDotEnv()

const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: dbUrl,
  },
  migrations: {
    path: 'prisma/migrations',
    seed: 'node prisma/seed.cjs',
  },
})
