/**
 * Sunucu deploy sonrası kontrol listesi (yerel veya production URL ile).
 * Kullanım: node scripts/deploy-check.js
 *            API_BASE=https://panel.vegacantastore.com node scripts/deploy-check.js
 */
const BASE = (process.env.API_BASE || 'https://panel.vegacantastore.com').replace(/\/$/, '')

const paths = [
  { path: '/api/health', expect: (j) => j.version },
  { path: '/api/shopify/durum', expect: (j) => 'bagli' in j },
  { path: '/api/shopify/urunler?first=1', expect: (j) => j.success !== undefined || j.hata }
]

async function check({ path, expect }) {
  const url = `${BASE}${path}`
  try {
    const res = await fetch(url)
    const text = await res.text()
    let json
    try { json = JSON.parse(text) } catch { json = { raw: text.slice(0, 200) } }
    const ok = res.ok && expect(json)
    console.log(ok ? '✓' : '✗', res.status, path, ok ? '' : JSON.stringify(json).slice(0, 120))
    return ok
  } catch (e) {
    console.log('✗', path, e.message)
    return false
  }
}

console.log('Kontrol:', BASE, '\n')
let passed = 0
for (const p of paths) {
  if (await check(p)) passed++
}
console.log(`\n${passed}/${paths.length} geçti`)
if (passed < paths.length) {
  console.log('\n/api/shopify/durum 404 ise: sunucuda backend kodunu güncelleyip API\'yi yeniden başlatın.')
  console.log('bagli:false ise: backend/.env içine SHOPIFY_ACCESS_TOKEN=shpat_... ekleyin.')
  process.exit(1)
}
