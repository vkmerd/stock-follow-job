import { createWriteStream, mkdirSync, existsSync } from 'fs'
import { join, extname } from 'path'
import { randomUUID } from 'crypto'
import { pipeline } from 'stream/promises'

function getPublicBaseUrl(req) {
  // Production'da her zaman canlı URL — localde request'ten üret
  const configured = process.env.PUBLIC_BASE_URL || process.env.APP_URL || ''
  if (configured) return configured.replace(/\/$/, '').replace(/\/api$/, '')

  // NODE_ENV production ama URL tanımlanmamışsa VITE_API_URL'den üret
  if (process.env.NODE_ENV === 'production' && process.env.VITE_API_URL) {
    return process.env.VITE_API_URL.replace(/\/$/, '').replace(/\/api$/, '')
  }

  // Local: request header'larından üret
  const proto = String(req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim()
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3001').split(',')[0].trim()
  return `${proto}://${host}`.replace(/\/$/, '')
}

// Uploads klasörünü garantile
const UPLOADS_DIR = join(process.cwd(), 'uploads')
if (!existsSync(UPLOADS_DIR)) mkdirSync(UPLOADS_DIR, { recursive: true })

const IZIN_VERILEN = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.mp4', '.webm', '.mov', '.m4v', '.avi', '.mkv']
const MAX_BOYUT = 20 * 1024 * 1024 // 20 MB

export default async function uploadRoutes(app) {

  // Statik dosya servisi — /uploads/xxx.jpg erişimi
  app.get('/uploads/:dosya', async (req, reply) => {
    const { dosya } = req.params
    // Path traversal koruması
    if (dosya.includes('..') || dosya.includes('/')) {
      return reply.status(400).send({ hata: 'Geçersiz dosya adı' })
    }
    const yol = join(UPLOADS_DIR, dosya)
    return reply.sendFile(dosya, UPLOADS_DIR)
  })

  // Resim yükle — multipart/form-data
  app.post('/upload', async (req, reply) => {
    try {
      const data = await req.file()
      if (!data) return reply.status(400).send({ hata: 'Dosya bulunamadı' })

      let uzanti = extname(data.filename || '').toLowerCase()
      if (!uzanti && data.mimetype) {
        if (data.mimetype.includes('mp4')) uzanti = '.mp4'
        else if (data.mimetype.includes('webm')) uzanti = '.webm'
        else if (data.mimetype.includes('quicktime')) uzanti = '.mov'
        else if (data.mimetype.includes('x-m4v')) uzanti = '.m4v'
        else if (data.mimetype.includes('avi')) uzanti = '.avi'
        else if (data.mimetype.includes('matroska')) uzanti = '.mkv'
      }
      if (!IZIN_VERILEN.includes(uzanti)) {
        return reply.status(400).send({ hata: `İzin verilmeyen format. İzinliler: ${IZIN_VERILEN.join(', ')}` })
      }

      const dosyaAdi = `${randomUUID()}${uzanti}`
      const hedef   = join(UPLOADS_DIR, dosyaAdi)

      // Boyut sınırı kontrolü ile kaydet
      let boyut = 0
      const yazici = createWriteStream(hedef)

      for await (const chunk of data.file) {
        boyut += chunk.length
        if (boyut > MAX_BOYUT) {
          yazici.destroy()
          return reply.status(413).send({ hata: `Dosya çok büyük. Maksimum: ${MAX_BOYUT / 1024 / 1024}MB` })
        }
        yazici.write(chunk)
      }
      await new Promise((res, rej) => {
        yazici.end()
        yazici.on('finish', res)
        yazici.on('error', rej)
      })

      const url = `${getPublicBaseUrl(req)}/uploads/${dosyaAdi}`
      return reply.status(201).send({
        url,
        dosyaAdi,
        boyut,
        tip: data.mimetype,
      })
    } catch (err) {
      app.log.error('Upload hatası:', err)
      return reply.status(500).send({ hata: 'Yükleme başarısız: ' + err.message })
    }
  })

  // Çoklu yükleme — birden fazla dosya
  app.post('/upload/coklu', async (req, reply) => {
    const urlList = []
    const parts = req.files()

    for await (const data of parts) {
      const uzanti = extname(data.filename).toLowerCase()
      if (!IZIN_VERILEN.includes(uzanti)) continue

      const dosyaAdi = `${randomUUID()}${uzanti}`
      const hedef   = join(UPLOADS_DIR, dosyaAdi)
      const yazici  = createWriteStream(hedef)

      let boyut = 0
      for await (const chunk of data.file) {
        boyut += chunk.length
        if (boyut > MAX_BOYUT) { yazici.destroy(); break }
        yazici.write(chunk)
      }
      await new Promise((res) => { yazici.end(); yazici.on('finish', res); yazici.on('error', res) })
      urlList.push(`${getPublicBaseUrl(req)}/uploads/${dosyaAdi}`)
    }

    return reply.status(201).send({ urls: urlList, sayi: urlList.length })
  })
}