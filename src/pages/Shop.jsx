import { useMemo, useState } from 'react'
import { useProducts } from '../data/shop.js'
import FadeUp from '../components/FadeUp.jsx'
import Footer from '../components/Footer.jsx'
import { useLang } from '../i18n.jsx'

// หน้าร้านค้า Um Shop (/um-shop) — แสดงสินค้าทั้งหมด ค้นหา/กรองหมวดหมู่/เรียงราคา และแชร์รูปสินค้าลงโซเชียลได้

const THB = (n) => '฿' + Number(n || 0).toLocaleString('th-TH')

const T = {
  th: {
    badge: '🛍️ Um Shop',
    h1: 'สินค้าจากมูลนิธิอุมมะตี',
    p: 'เลือกซื้อสินค้าเพื่อสนับสนุนภารกิจของมูลนิธิ — รายได้นำไปช่วยเหลือผู้ยากไร้',
    searchPh: 'ค้นหาสินค้า...',
    allCat: 'ทุกหมวดหมู่',
    sortNew: 'ใหม่ล่าสุด', sortPriceAsc: 'ราคา: ต่ำ-สูง', sortPriceDesc: 'ราคา: สูง-ต่ำ', sortName: 'ชื่อสินค้า A-Z',
    color: 'สี', size: 'ขนาด', stock: 'คงเหลือ', out: 'สินค้าหมด', share: 'แชร์', shared: 'คัดลอกลิงก์แล้ว ✓',
    empty: 'ยังไม่มีสินค้าในขณะนี้',
  },
  en: {
    badge: '🛍️ Um Shop',
    h1: 'Ummatee Foundation Products',
    p: 'Shop to support the foundation\'s mission — proceeds help those in need',
    searchPh: 'Search products...',
    allCat: 'All categories',
    sortNew: 'Newest', sortPriceAsc: 'Price: low to high', sortPriceDesc: 'Price: high to low', sortName: 'Name A-Z',
    color: 'Color', size: 'Size', stock: 'In stock', out: 'Out of stock', share: 'Share', shared: 'Link copied ✓',
    empty: 'No products available yet',
  },
  ar: {
    badge: '🛍️ Um Shop',
    h1: 'منتجات مؤسسة أمّتي',
    p: 'تسوّق لدعم مهمة المؤسسة — تذهب العائدات لمساعدة المحتاجين',
    searchPh: 'البحث عن المنتجات...',
    allCat: 'كل الفئات',
    sortNew: 'الأحدث', sortPriceAsc: 'السعر: من الأقل', sortPriceDesc: 'السعر: من الأعلى', sortName: 'الاسم أ-ي',
    color: 'اللون', size: 'المقاس', stock: 'المتوفر', out: 'غير متوفر', share: 'مشاركة', shared: 'تم نسخ الرابط ✓',
    empty: 'لا توجد منتجات حالياً',
  },
}

function ProductCard({ p, t }) {
  const [shared, setShared] = useState(false)
  const img = p.images?.[0]

  const share = async () => {
    const url = `${window.location.origin}/um-shop#${p.id}`
    const shareData = { title: p.name, text: `${p.name} ${p.price ? THB(p.price) : ''}`, url }
    if (navigator.share) {
      try { await navigator.share(shareData); return } catch { /* cancelled */ }
    }
    try {
      await navigator.clipboard.writeText(url)
      setShared(true)
      setTimeout(() => setShared(false), 1800)
    } catch { /* noop */ }
  }

  const outOfStock = (p.stock ?? 0) <= 0

  return (
    <FadeUp className="shop-card" id={p.id}>
      <div className="shop-img">
        {img ? <img src={img} alt={p.name} loading="lazy" /> : <div className="shop-img-ph">🛍️</div>}
        {outOfStock && <span className="shop-badge-out">{t.out}</span>}
        <button className="shop-share" onClick={share} title={t.share} aria-label={t.share}>
          {shared ? '✓' : '🔗'}
        </button>
      </div>
      <div className="shop-body">
        {p.category && <span className="shop-cat">{p.category}</span>}
        <h4 className="shop-name">{p.name}</h4>
        {p.price != null && <div className="shop-price">{THB(p.price)}</div>}
        {p.description && <p className="shop-desc">{p.description}</p>}
        {p.colors?.length > 0 && (
          <div className="shop-meta-row"><span className="shop-meta-label">{t.color}:</span> {p.colors.join(', ')}</div>
        )}
        {p.sizes?.length > 0 && (
          <div className="shop-meta-row"><span className="shop-meta-label">{t.size}:</span> {p.sizes.join(', ')}</div>
        )}
        {p.stock != null && (
          <div className={`shop-stock ${outOfStock ? 'out' : ''}`}>{t.stock}: {p.stock}</div>
        )}
      </div>
    </FadeUp>
  )
}

export default function Shop() {
  const { lang } = useLang()
  const t = T[lang] || T.th
  const { products, loading } = useProducts()

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [sort, setSort] = useState('new')

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category).filter(Boolean))
    return [...set]
  }, [products])

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    return products
      .filter((p) => (category === 'all' ? true : p.category === category))
      .filter((p) => !s || [p.name, p.description, p.category].some((x) => (x || '').toLowerCase().includes(s)))
      .sort((a, b) => {
        if (sort === 'priceAsc') return (a.price || 0) - (b.price || 0)
        if (sort === 'priceDesc') return (b.price || 0) - (a.price || 0)
        if (sort === 'name') return (a.name || '').localeCompare(b.name || '')
        return (b.createdAt || 0) - (a.createdAt || 0)
      })
  }, [products, search, category, sort])

  return (
    <main className="page">
      <section className="page-band">
        <div className="fc-pattern hero-pattern"></div>
        <div className="inner">
          <span className="badge">{t.badge}</span>
          <h1>{t.h1}</h1>
          <p>{t.p}</p>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="shop-toolbar">
            <input
              type="search"
              className="shop-search"
              placeholder={t.searchPh}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {categories.length > 0 && (
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="all">{t.allCat}</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="new">{t.sortNew}</option>
              <option value="priceAsc">{t.sortPriceAsc}</option>
              <option value="priceDesc">{t.sortPriceDesc}</option>
              <option value="name">{t.sortName}</option>
            </select>
          </div>

          {!loading && filtered.length === 0 && (
            <p style={{ textAlign: 'center', color: 'var(--ink-soft)', padding: '40px 0' }}>{t.empty}</p>
          )}

          <div className="shop-grid">
            {filtered.map((p) => <ProductCard key={p.id} p={p} t={t} />)}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
