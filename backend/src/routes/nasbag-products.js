const NASBAG_XML_URL = 'https://nascanta.com/veripaylasim.aspx?ID=4'
// Nas Bag'in istek sınırını aşmamak için XML'i bellekte önbelleğe alıyoruz —
// her sekme yenilemesinde kaynağa gitmek yerine günde bir kez çekiyoruz.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 saat

let cache = { xml: null, fetchedAt: 0 }

export default async function nasbagProductsRoutes(app) {
  app.get('/nasbag-urunler', async (req, reply) => {
    const bayat = !cache.xml || (Date.now() - cache.fetchedAt) > CACHE_TTL_MS

    if (bayat) {
      try {
        const response = await fetch(NASBAG_XML_URL, {
          method: 'GET',
          headers: { 'Content-Type': 'text/xml' }
        })
        if (!response.ok) {
          throw new Error(`Nas Bag sunucusu hata döndürdü: ${response.status}`)
        }
        cache = { xml: await response.text(), fetchedAt: Date.now() }
      } catch (error) {
        app.log.error('Nas Bag XML çekilirken hata:', error)
        if (!cache.xml) {
          return reply.status(500).send({ error: 'XML verisi çekilemedi: ' + error.message })
        }
        // Kaynağa ulaşılamadıysa elimizdeki (bayat) önbelleği döndür, tamamen boş kalmasın.
      }
    }

    reply.header('Content-Type', 'text/xml').send(cache.xml)
  })
}
