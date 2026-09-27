# Sunucuda hâlâ aynı hata — ne eksik?

Canlı site kontrolü (panel.vegacantastore.com):

| Adres | Şu an | Olması gereken |
|-------|--------|----------------|
| `/api/shopify/durum` | **404** | JSON (bagli: true/false) |
| `/api/health` | **404** | version: **2.0.0** |
| `/api/shopify/urunler` | Eski kod + token yok | Yeni kod + shpat_ |

**Ana dizinde `npm run build` sadece panel arayüzünü (`dist/`) üretir.**  
API (backend) ayrı bir Node sürecidir; build onu güncellemez.

---

## Doğru sıra (SSH ile sunucuda)

Projenin tam yolunu kendinize göre değiştirin (`/var/www/VegaCanta` gibi).

```bash
cd /var/www/VegaCanta
git pull origin main

# ─── 1) BACKEND (zorunlu) ───
cd backend
nano .env
```

`.env` içinde **mutlaka** olsun:

```env
SHOPIFY_STORE_URL=https://vega-canta-store.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_BURAYA
SHOPIFY_API_VERSION=2025-01
DATABASE_URL=...
PORT=3001
```

```bash
npm install
npx prisma generate
pm2 restart vega-api
# PM2 yoksa: pm2 start src/index.js --name vega-api
# veya: nohup npm run start &
cd ..

# ─── 2) PANEL (dist) ───
npm install
npm run build
cp -r dist/* /var/www/panel-public/
# veya hosting panelinde dist içeriğini public_html'e yükle
```

---

## 30 saniyelik test

Tarayıcıda açın:

1. https://panel.vegacantastore.com/api/health  
   → `"version":"2.0.0"` **görmelisiniz**  
   → 404 ise backend hâlâ eski / restart edilmedi

2. https://panel.vegacantastore.com/api/shopify/durum  
   → 404 değil, JSON gelmeli

3. Panel → Shopify Ürünleri

---

## Sık yapılan hata

| Yaptınız | Etki |
|----------|------|
| Sadece `git pull` + ana dizin `npm run build` | Sadece `dist/` güncellenir |
| `dist/`'i public_html'e attınız | Panel görünümü yenilenir |
| **backend restart + .env yapmadınız** | API eski kalır → **aynı hatalar** |

---

## PM2 kontrol

```bash
pm2 list
pm2 logs vega-api --lines 30
```

`vega-api` yoksa veya eski klasörden çalışıyorsa yanlış dizindesiniz demektir.

```bash
pm2 describe vega-api
# "exec cwd" hangi klasör? Orada git pull yapılmış olmalı
```

---

## cPanel kullanıyorsanız

1. **File Manager** → `backend/.env` düzenle (`SHOPIFY_ACCESS_TOKEN`)
2. **Setup Node.js App** → uygulamayı **Restart**
3. **public_html** → `dist` dosyalarını yükle (build çıktısı)

Node uygulamasının **Application root** = `backend` klasörü olmalı.

---

## Token hatırlatma

- `shpat_` → `.env` içine
- `shpss_` → yazmayın (Partners secret)
