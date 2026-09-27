# Shopify ürün entegrasyonu — hızlı kurulum

Vega panelinde (**panel.vegacantastore.com**) ürün göstermek için backend sunucusundaki `backend/.env` dosyasını doldurursunuz. Uygulama arayüzüne URL/token yazılmaz.

## Hangi URL?

| Adres | Ne için? |
|--------|----------|
| `https://vega-canta-store.myshopify.com` | **Bunu** `SHOPIFY_STORE_URL` olarak kullanın (kendi mağaza adınızla) |
| `https://panel.vegacantastore.com` | Sizin Vega paneli — Shopify API adresi **değil** |
| `https://vegacantastore.com` | Müşteri vitrin siteniz — API adresi **değil** |

Mağaza adını bulmak: **Shopify Admin → Ayarlar → Mağaza ayrıntıları** → `*.myshopify.com` satırı.

## shpss_ mi shpat_ mi?

| Kod | Anlamı | Vega'da kullanılır mı? |
|-----|--------|-------------------------|
| `shpss_...` | **Client Secret** (Partners / uygulama gizli anahtarı) | **Hayır** |
| `shpat_...` | **Admin API access token** | **Evet** |

Sadece `shpss_` görüyorsanız muhtemelen **dev.shopify.com Partners** panelindesiniz. Ürün çekmek için mağaza admininde **Custom app** kurup `shpat_` almanız gerekir.

## shpat_ token alma (adım adım)

1. https://admin.shopify.com → kendi mağazanız
2. **Ayarlar → Uygulamalar ve satış kanalları**
3. **Uygulama geliştir** (Develop apps) → **Uygulama oluştur**
4. **Admin API erişim kapsamları** → en az `read_products` (yazmak için `write_products`)
5. **Uygulamayı yükle** (Install app)
6. **Admin API access token** → **Göster** → `shpat_...` kopyala (bir kez gösterilir)

## backend/.env örneği

```env
SHOPIFY_STORE_URL=https://vega-canta-store.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_xxxxxxxxxxxxxxxxxxxxxxxx
SHOPIFY_API_VERSION=2025-01
```

Kaydettikten sonra API sunucusunu yeniden başlatın.

## Test

```text
GET https://panel.vegacantastore.com/api/shopify/durum
GET https://panel.vegacantastore.com/api/shopify/urunler
```

`durum` yanıtında `bagli: true` olmalı.
