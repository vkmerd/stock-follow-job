# Vega Panel — sunucuya güncelleme (Shopify dahil)

`panel.vegacantastore.com` adresinde **404 /api/shopify/durum** görüyorsanız sunucuda **eski backend** çalışıyordur. Bu repodaki `backend` klasörünü yükleyip API’yi yeniden başlatmanız gerekir.

## 1. Sunucuda `backend/.env`

```env
PORT=3001
DATABASE_URL=postgresql://...
SHOPIFY_STORE_URL=https://vega-canta-store.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_VegaProd_uygulamasindan_aldiginiz_token
SHOPIFY_API_VERSION=2025-01
```

Token: **Shopify Admin → Ayarlar → Uygulamalar → VegaProd (veya Custom app) → Yükle → Admin API access token** (`shpat_`).

`shpss_` yazmayın.

## 2. Backend güncelle ve başlat

```bash
cd backend
npm install
npx prisma generate
npm run start
```

PM2 örneği: `pm2 restart vega-api`

Nginx örneği: `location /api { proxy_pass http://127.0.0.1:3001; }`

## 3. Frontend (panel arayüzü)

```bash
npm install
npm run build
```

`dist/` çıktısını panel sitenizin web root’una kopyalayın.

## 4. Deploy doğrulama

```bash
API_BASE=https://panel.vegacantastore.com node scripts/deploy-check.js
```

Beklenen:

- `GET /api/health` → `"version": "2.0.0"`
- `GET /api/shopify/durum` → JSON (`bagli: true/false`, 404 değil)
- `GET /api/shopify/urunler` → ürün listesi veya yapılandırma hatası mesajı

## 5. VegaProd (Shopify Partners)

- **Uygulama URL:** `https://panel.vegacantastore.com`
- **Yönlendirme URL:** `https://panel.vegacantastore.com` (veya boş)
- Ürün çekmek için panel URL’sine OAuth şart değil; `shpat_` + `.env` yeterli.

## Sık sorunlar

| Belirti | Çözüm |
|--------|--------|
| `Route GET:/api/shopify/durum not found` | Backend 2.0 deploy edilmemiş → adım 2 |
| `SHOPIFY_ACCESS_TOKEN ayarlanmamış` | `.env` + API restart |
| `shpss_` hatası | `shpat_` kullanın |
| Panel açılıyor API yok | Nginx `/api` → port 3001 |
