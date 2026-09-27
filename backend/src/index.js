import { config as loadEnv } from 'dotenv'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import staticFiles from '@fastify/static'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { shopifyOtomatikSenkronBaslat } from './jobs/shopifyAutoSync.js'
import { shopifySiparisSenkronBaslat } from './jobs/shopifyOrderSync.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

loadEnv({ path: join(__dirname, '..', '.env') })
loadEnv({ path: join(__dirname, '..', '..', '.env') })

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
export const prisma = new PrismaClient({ adapter })

const app = Fastify({ logger: true })
export const APP_VERSION = '2.0.0'

async function start() {
  await app.register(cors, {
    origin: ['http://localhost:5173', 'http://localhost:3000', 'https://panel.vegacantastore.com'],
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  })

  await app.register(multipart, {
limits: { fileSize: 150 * 1024 * 1024, files: 10 }
  })

  await app.register(staticFiles, {
    root:   join(__dirname, '..', 'uploads'),
    prefix: '/uploads/',
    decorateReply: false,
  })

  await app.register(import('./routes/urunler.js'),             { prefix: '/api' })
  await app.register(import('./routes/magazalar.js'),           { prefix: '/api' })
  await app.register(import('./routes/satislar.js'),            { prefix: '/api' })
  await app.register(import('./routes/pos.js'),                 { prefix: '/api' })
  await app.register(import('./routes/stok.js'),                { prefix: '/api' })
  await app.register(import('./routes/iadeler.js'),             { prefix: '/api' })
  await app.register(import('./routes/siparisler.js'),          { prefix: '/api' })
  await app.register(import('./routes/musteriler.js'),          { prefix: '/api' })
  await app.register(import('./routes/kullanicilar.js'),        { prefix: '/api' })
  await app.register(import('./routes/ayarlar.js'),             { prefix: '/api' })
  await app.register(import('./routes/cari.js'),                { prefix: '/api' })
  await app.register(import('./routes/banka.js'),               { prefix: '/api' })
  await app.register(import('./routes/katalog.js'),             { prefix: '/api' })
  await app.register(import('./routes/masraf.js'),              { prefix: '/api' })
  await app.register(import('./routes/kasa.js'),                { prefix: '/api' })
  await app.register(import('./routes/degisim.js'),             { prefix: '/api' })
  await app.register(import('./routes/silverpolo-products.js'), { prefix: '/api' })
  await app.register(import('./routes/nasbag-products.js'),     { prefix: '/api' })
  await app.register(import('./routes/marka-urunleri.js'),      { prefix: '/api' })
  await app.register(import('./routes/shopify.js'),             { prefix: '/api' })
  await app.register(import('./routes/shopify-oto-senkron.js'), { prefix: '/api' })
  await app.register(import('./routes/upload.js'),              { prefix: '/api' })

  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date(),
    version: APP_VERSION,
    shopify: { durum: '/api/shopify/durum', urunler: '/api/shopify/urunler' }
  }))

  app.get('/api/health', async () => ({
    status: 'ok',
    timestamp: new Date(),
    version: APP_VERSION,
    shopify: { durum: '/api/shopify/durum', urunler: '/api/shopify/urunler' }
  }))

  await app.listen({ port: Number(process.env.PORT) || 3001, host: '0.0.0.0' })
  console.log('🚀 Vega API: ' + process.env.VITE_API_URL)

  shopifyOtomatikSenkronBaslat()
  shopifySiparisSenkronBaslat()
}

start().catch(err => { console.error(err); process.exit(1) })


app.addContentTypeParser(
  'application/json',
  { parseAs: 'buffer' },
  (req, body, done) => {
    req.rawBody = body.toString('utf8')
    try { done(null, JSON.parse(req.rawBody)) }
    catch (e) { done(e) }
  }
)