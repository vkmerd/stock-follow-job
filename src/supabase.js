import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://zlehpnlmxytxzwquqirc.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpsZWhwbmxteHl0eHp3cXVxaXJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5MDYzODAsImV4cCI6MjA5MjQ4MjM4MH0.WFyTwEV6jnQNmVpnEmQby6z8b7hoGCNrTP-ae8kl8B8'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ─── AUTH ─────────────────────────────────────────────────────
export async function girisYap(email, sifre) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: sifre })
  if(error) throw error
  return data
}

export async function cikisYap() {
  await supabase.auth.signOut()
}

export async function mevcutKullanici() {
  const { data: { user } } = await supabase.auth.getUser()
  if(!user) return null
  const { data: profil } = await supabase.from('profiller').select('*').eq('id', user.id).single()
  return profil
}

export async function sifreDegistir(yeniSifre) {
  const { error } = await supabase.auth.updateUser({ password: yeniSifre })
  if(error) throw error
}

export async function kulllanicilariGetir() {
  const { data, error } = await supabase.from('profiller').select('*').order('created_at', { ascending: false })
  if(error) throw error
  return data
}

// ─── ÜRÜNLER ──────────────────────────────────────────────────
// Supabase sütun adlarını → uygulama formatına çevir
function donustur(u) {
  return {
    ...u,
    altKategori: u.alt_kategori  || u.altKategori  || "",
    alisF:       u.alis_fiyati   || u.alisF         || 0,
    satisF:      u.satis_fiyati  || u.satisF        || 0,
    aciklama:    u.notlar        || u.aciklama      || "",
    kritikStok:  u.kritik_stok   || u.kritikStok    || 3,
    varyantlar:  (u.varyantlar   || []),
  }
}

export async function urunleriGetir() {
  const { data, error } = await supabase
    .from('urunler')
    .select('*, varyantlar(*)')
    .order('kod', { ascending: true })  // ← created_at yerine kod
  
  if(error) throw error
  return (data || []).map(donustur)
}

export async function sonKoduGetir() {
  const { data } = await supabase
    .from('urunler')
    .select('kod')
    .like('kod', 'V-%')
    .order('kod', { ascending: false })
    .limit(1)
    .maybeSingle()
  
  if(!data || !data.kod) return 'V-00001'
  const sayi = parseInt(data.kod.replace('V-', '')) + 1
  return `V-${String(sayi).padStart(5, '0')}`
}

export async function urunKaydet(form) {
  const satirVeri = {
    kod:          form.kod,
    barkod:       form.barkod,
    ad:           form.ad,
    marka:        form.marka,
    kategori:     form.kategori,
    alt_kategori: form.altKategori || "",
    alis_fiyati:  parseFloat(form.alisF)  || 0,
    satis_fiyati: parseFloat(form.satisF) || 0,
    kdv:          form.kdv || 18,
    notlar:       form.aciklama || "",
    kritik_stok:  form.kritikStok || 3,
  }

  let urun

  if(form.supabaseId) {
    // ── GÜNCELLEME — mevcut kayıt ──
    const { data, error } = await supabase
      .from('urunler')
      .update(satirVeri)
      .eq('id', form.supabaseId)
      .select()
      .single()
    if(error) throw error
    urun = data
  } else {
    // ── YENİ KAYIT — insert ──
    const { data, error } = await supabase
      .from('urunler')
      .insert(satirVeri)
      .select()
      .single()
    if(error) throw error
    urun = data
  }

  // Varyantları kaydet
  if(form.varyantlar?.length > 0) {
    // Önce bu ürüne ait eski varyantları sil
    await supabase.from('varyantlar').delete().eq('urun_id', urun.id)

    const { error: vErr } = await supabase
      .from('varyantlar')
      .insert(form.varyantlar.map(v => ({
        urun_id: urun.id,
        renk:    v.renk,
        beden:   v.beden,
        magaza:  v.magaza,
        adet:    v.adet || 0,
        barkod:  v.barkod,
      })))
    if(vErr) throw vErr
  }

  return urun
}

export async function urunSil(id) {
  const { error } = await supabase.from('urunler').delete().eq('id', id)
  if(error) throw error
}

// ─── MÜŞTERİLER ───────────────────────────────────────────────
export async function musterileriGetir() {
  const { data, error } = await supabase
    .from('musteriler')
    .select('*')
    .order('created_at', { ascending: false })
  if(error) throw error
  return data
}

export async function musteriKaydet(form) {
  const { data, error } = await supabase
    .from('musteriler')
    .upsert(form)
    .select()
    .single()
  if(error) throw error
  return data
}

// ─── SİPARİŞLER ───────────────────────────────────────────────
export async function siparisleriGetir() {
  const { data, error } = await supabase
    .from('siparisler')
    .select('*')
    .order('created_at', { ascending: false })
  if(error) throw error
  return data
}

export async function siparisDurumGuncelle(id, durum) {
  const { error } = await supabase
    .from('siparisler')
    .update({ durum })
    .eq('id', id)
  if(error) throw error
}

// ─── SATIŞLAR ─────────────────────────────────────────────────
export async function satisKaydet(satis, kalemler) {
  const { data, error } = await supabase
    .from('satislar')
    .insert(satis)
    .select()
    .single()
  if(error) throw error

  const { error: kErr } = await supabase
    .from('satis_kalemleri')
    .insert(kalemler.map(k => ({ ...k, satis_id: data.id })))
  if(kErr) throw kErr
  return data
}

// ─── MAĞAZALAR ────────────────────────────────────────────────
export async function magazalariGetir() {
  const { data, error } = await supabase.from('magazalar').select('*').eq('aktif', true).order('ad')
  if(error) throw error
  return data
}

// ─── POS TERMİNALLER ─────────────────────────────────────────
export async function posTerminalleriniGetir() {
  const { data, error } = await supabase
    .from('pos_terminaller').select('*, magazalar(id, ad)')
    .eq('aktif', true).order('ad')
  if(error) throw error
  return (data || []).map(t => ({
    ...t,
    magaza:     t.magazalar?.ad || '',
    terminalno: t.terminal_no   || '',
    komisyon: { 1:t.komisyon_pesin||0, 2:t.komisyon_2||0, 3:t.komisyon_3||0, 6:t.komisyon_6||0, 9:t.komisyon_9||0, 12:t.komisyon_12||0 }
  }))
}

export async function posTerminaliKaydet(form) {
  const d = {
    ad: form.ad, banka: form.banka, terminal_no: form.terminalno||'',
    magaza_id: form.magaza_id||null, aktif: form.aktif??true,
    komisyon_pesin:form.komisyon?.[1]||0, komisyon_2:form.komisyon?.[2]||0,
    komisyon_3:form.komisyon?.[3]||0,     komisyon_6:form.komisyon?.[6]||0,
    komisyon_9:form.komisyon?.[9]||0,     komisyon_12:form.komisyon?.[12]||0,
  }
  if(form.supabaseId||(form.id?.length===36)) {
    const { data, error } = await supabase.from('pos_terminaller').update(d).eq('id',form.supabaseId||form.id).select().single()
    if(error) throw error; return data
  } else {
    const { data, error } = await supabase.from('pos_terminaller').insert(d).select().single()
    if(error) throw error; return data
  }
}

// ─── SATIŞLAR (YENİ) ──────────────────────────────────────────
export async function satislariGetir(magazaId) {
  let q = supabase.from('satislar').select('*, satis_kalemler(*), satis_odemeler(*)')
    .order('tarih', { ascending: false }).limit(200)
  if(magazaId) q = q.eq('magaza_id', magazaId)
  const { data, error } = await q
  if(error) throw error
  return (data || []).map(s => ({
    ...s, fisNo:s.fis_no, araToplam:s.ara_toplam,
    genelIndirim:s.genel_indirim_oran, genelIndirimTutar:s.genel_indirim_tutar,
    kdvToplam:s.kdv_toplam, genelToplam:s.genel_toplam, paraUstu:s.para_ustu,
    kalemler:(s.satis_kalemler||[]).map(k=>({...k,urunAd:k.urun_ad,birimFiyat:k.birim_fiyat,indirim:k.indirim_oran})),
    odemeler:(s.satis_odemeler||[]).map(o=>({...o,posId:o.pos_id,taksit:o.taksit_sayisi,komisyon:o.komisyon_oran,komisyonTutar:o.komisyon_tutar,netTahsilat:o.net_tahsilat})),
  }))
}

export async function supabaseSatisKaydet(satis, kalemler, odemeler) {
  const { data: s, error: sErr } = await supabase.from('satislar').insert({
    fis_no:satis.fisNo, magaza_id:satis.magaza_id||null, kasiyer:satis.kasiyer||'Admin',
    musteri:satis.musteri||null, notlar:satis.notlar||null,
    ara_toplam:satis.araToplam, genel_indirim_oran:satis.genelIndirim,
    genel_indirim_tutar:satis.genelIndirimTutar, kdv_toplam:satis.kdvToplam,
    genel_toplam:satis.genelToplam, para_ustu:satis.paraUstu||0,
    tarih:new Date().toISOString(),
  }).select().single()
  if(sErr) throw sErr

  if(kalemler.length>0) {
    const { error:kErr } = await supabase.from('satis_kalemler').insert(
      kalemler.map(k=>({ satis_id:s.id, urun_id:k.urunId||null, urun_ad:k.urunAd,
        renk:k.renk, beden:k.beden, adet:k.adet, birim_fiyat:k.birimFiyat,
        indirim_oran:k.indirim||0, toplam:k.toplam }))
    )
    if(kErr) throw kErr
  }

  if(odemeler.length>0) {
    const { error:oErr } = await supabase.from('satis_odemeler').insert(
      odemeler.map(o=>({ satis_id:s.id, tip:o.tip, tutar:Number(o.tutar)||0,
        pos_id:o.posId||null, banka:o.banka||null, taksit_sayisi:o.taksit||1,
        komisyon_oran:o.komisyon||0, komisyon_tutar:o.komisyonTutar||0,
        net_tahsilat:o.netTahsilat||Number(o.tutar)||0 }))
    )
    if(oErr) throw oErr
  }
  return s
}

export async function stokDus(urunId, renk, beden, magaza, adet) {
  const { data, error } = await supabase.from('varyantlar').select('id, adet')
    .eq('urun_id',urunId).eq('renk',renk).eq('beden',beden).eq('magaza',magaza).single()
  if(error) { console.warn('Stok varyant bulunamadı:', renk, beden, magaza); return }
  await supabase.from('varyantlar').update({ adet: Math.max(0,(data.adet||0)-adet) }).eq('id',data.id)
}
export async function stokHareketKaydet(hareket) {
  const { error } = await supabase.from('stok_hareketler').insert(hareket)
  if(error) throw error
}

export async function sonFisNosuGetir() {
  const { data } = await supabase
    .from('satislar')
    .select('fis_no')
    .order('tarih', { ascending: false })
    .limit(1)
    .maybeSingle()
  
  if(!data || !data.fis_no) return 'F-0001'
  const sayi = parseInt(data.fis_no.replace('F-', '')) + 1
  return `F-${String(sayi).padStart(4, '0')}`
}