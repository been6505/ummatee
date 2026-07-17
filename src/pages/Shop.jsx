import { useEffect, useMemo, useState } from 'react' // useMemo/useState สำหรับ state, useEffect สำหรับ placeholder ค้นหาที่วนสินค้าอัตโนมัติ
import { useProducts, hasDiscount, discountPercent, groupProductsByName, dedupeSortSizes, SHOP_SIZES_BY_CATEGORY, effectivePrice } from '../data/shop.js' // hook ดึงรายการสินค้าจาก Firestore + ตัวช่วยคำนวณราคาส่วนลด/รวมกลุ่มสินค้าชื่อเดียวกัน
import FadeUp from '../components/FadeUp.jsx' // คอมโพเนนต์ wrapper ทำ animation เลื่อนขึ้นตอนแสดงผล
import Footer from '../components/Footer.jsx' // ส่วน Footer ท้ายหน้า
import InAppBrowserWarning from '../components/InAppBrowserWarning.jsx'
import { useLang } from '../i18n.jsx' // hook อ่านภาษาปัจจุบันของผู้ใช้ (th/en/ar)
import { useNavigate } from '../navContext' // ฟังก์ชันเปลี่ยนหน้าแบบ SPA (ไป /um-shop/:productId)
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBagShopping, faShareNodes, faCheck } from '@fortawesome/free-solid-svg-icons'

// หน้าร้านค้า Um Shop (/um-shop) — แสดงสินค้าทั้งหมด ค้นหา/กรองหมวดหมู่/เรียงราคา และแชร์รูปสินค้าลงโซเชียลได้
// คลิกที่สินค้าเพื่อไปหน้ารายละเอียดสินค้า (/um-shop/:productId) พร้อมแกลเลอรีรูป เลือกจำนวน และเพิ่มลงตะกร้า

import { optImg } from '../utils/cloudinaryUrl.js'
const THB = (n) => '฿' + Number(n || 0).toLocaleString('th-TH') // ฟังก์ชันแปลงตัวเลขเป็นรูปแบบราคาบาท เช่น ฿1,234

const T = { // อ็อบเจกต์เก็บข้อความแปลภาษา แยกตามภาษา (th/en/ar)
  th: { // ข้อความภาษาไทย
    badge: 'Um Shop', // ป้าย badge บนหัวหน้า
    h1: 'สินค้าจากมูลนิธิอุมมะตี', // หัวข้อใหญ่
    p: 'เลือกซื้อสินค้าเพื่อสนับสนุนภารกิจของมูลนิธิ — รายได้นำไปช่วยเหลือผู้ยากไร้', // คำบรรยายใต้หัวข้อ
    searchPh: 'ค้นหา', // placeholder ของช่องค้นหา
    allCat: 'ทุกหมวดหมู่', // ตัวเลือก "ทุกหมวดหมู่" ใน dropdown
    sortNew: 'ใหม่ล่าสุด', sortPriceAsc: 'ราคา: ต่ำ-สูง', sortPriceDesc: 'ราคา: สูง-ต่ำ', sortName: 'ชื่อสินค้า A-Z', // ตัวเลือกการเรียงลำดับ
    color: 'สี', size: 'ขนาด', stock: 'คงเหลือ', out: 'สินค้าหมด', share: 'แชร์', shared: 'คัดลอกลิงก์แล้ว ✓', sold: 'ขายแล้ว', soldUnit: 'ชิ้น', // ป้ายข้อความย่อยต่างๆ
    empty: 'ยังไม่มีสินค้าในขณะนี้', // ข้อความตอนไม่มีสินค้า
  },
  en: { // ข้อความภาษาอังกฤษ
    badge: '🛍️ Um Shop', // ป้าย badge บนหัวหน้า
    h1: 'Ummatee Foundation Products', // หัวข้อใหญ่
    p: 'Shop to support the foundation\'s mission — proceeds help those in need', // คำบรรยายใต้หัวข้อ
    searchPh: 'Search products...', // placeholder ของช่องค้นหา
    allCat: 'All categories', // ตัวเลือก "ทุกหมวดหมู่"
    sortNew: 'Newest', sortPriceAsc: 'Price: low to high', sortPriceDesc: 'Price: high to low', sortName: 'Name A-Z', // ตัวเลือกการเรียงลำดับ
    color: 'Color', size: 'Size', stock: 'In stock', out: 'Out of stock', share: 'Share', shared: 'Link copied ✓', sold: 'Sold', soldUnit: 'pcs', // ป้ายข้อความย่อยต่างๆ
    empty: 'No products available yet', // ข้อความตอนไม่มีสินค้า
  },
  ar: { // ข้อความภาษาอาหรับ
    badge: '🛍️ Um Shop', // ป้าย badge บนหัวหน้า
    h1: 'منتجات مؤسسة أمّتي', // หัวข้อใหญ่
    p: 'تسوّق لدعم مهمة المؤسسة — تذهب العائدات لمساعدة المحتاجين', // คำบรรยายใต้หัวข้อ
    searchPh: 'البحث عن المنتجات...', // placeholder ของช่องค้นหา
    allCat: 'كل الفئات', // ตัวเลือก "ทุกหมวดหมู่"
    sortNew: 'الأحدث', sortPriceAsc: 'السعر: من الأقل', sortPriceDesc: 'السعر: من الأعلى', sortName: 'الاسم أ-ي', // ตัวเลือกการเรียงลำดับ
    color: 'اللون', size: 'المقاس', stock: 'المتوفر', out: 'غير متوفر', share: 'مشاركة', shared: 'تم نسخ الرابط ✓', sold: 'مُباع', soldUnit: 'قطعة', // ป้ายข้อความย่อยต่างๆ
    empty: 'لا توجد منتجات حالياً', // ข้อความตอนไม่มีสินค้า
  },
}
export const SHOP_T = T // ให้หน้าอื่น (ส่วน "สินค้าที่น่าสนใจ" ในหน้ารายละเอียดสินค้า) ใช้ label ชุดเดียวกับ ProductCard ได้

// การ์ดโครง (skeleton) ระหว่างรอ Firestore โหลด — กันจอว่าง/กระพริบ ให้เห็นเค้าโครงล่วงหน้าเหมือน Shopee
export function SkeletonCard() {
  return (
    <div className="shop-card shop-card-skeleton" aria-hidden="true">
      <div className="shop-img sk-block" />
      <div className="shop-body">
        <div className="sk-line sk-line-sm" />
        <div className="sk-line sk-line-lg" />
        <div className="sk-line sk-line-md" />
      </div>
    </div>
  )
}

export function ProductCard({ g, t, onOpen }) { // การ์ดสินค้าหนึ่งใบในตะแกรงสินค้า — g คือกลุ่มสินค้าชื่อเดียวกัน (อาจมีหลายสี/ขนาดคนละ doc), t คือข้อความแปลภาษา, onOpen เรียกเมื่อคลิกเพื่อเปิดรายละเอียด
  // ใช้ร่วมกันทั้งหน้ารายการสินค้า (/um-shop) และส่วน "สินค้าที่น่าสนใจ" ท้ายหน้ารายละเอียดสินค้า
  const [shared, setShared] = useState(false) // state บอกว่าพึ่งคัดลอกลิงก์แชร์ไปหรือยัง (เพื่อแสดงเครื่องหมาย ✓ ชั่วคราว)
  const { primary, variants, totalStock, totalSold, minPrice, maxPrice, anyDiscount } = g
  const img = variants.find((v) => v.images?.length)?.images?.[0] // ใช้รูปแรกที่เจอในกลุ่ม (เผื่อ variant แรกสุดยังไม่อัพรูป)
  const multiVariant = variants.length > 1

  const share = async (e) => { // ฟังก์ชันแชร์สินค้า เมื่อกดปุ่มแชร์บนการ์ด — แนบทั้งรูปสินค้าและลิงก์ไปด้วยกัน
    e.stopPropagation() // กันไม่ให้ event ลอยไปกระตุ้น onClick ของการ์ด (ซึ่งจะเปิดหน้ารายละเอียด)
    const url = `${window.location.origin}/um-shop/${primary.productId || primary.id}` // สร้างลิงก์ตรงไปยังหน้ารายละเอียดสินค้านี้
    const shareData = { title: primary.name, text: `${primary.name} ${minPrice ? THB(minPrice) : ''}`, url } // ข้อมูลที่จะส่งให้ Web Share API

    // ลองแนบรูปสินค้าไปด้วย (โหลดรูปมาแปลงเป็นไฟล์) — เบราว์เซอร์ที่รองรับแชร์ไฟล์ (มือถือส่วนใหญ่) จะแชร์ภาพ+ลิงก์พร้อมกัน
    if (img && navigator.share && navigator.canShare) {
      try {
        const res = await fetch(optImg(img, 800))
        const blob = await res.blob()
        const file = new File([blob], 'product.jpg', { type: blob.type || 'image/jpeg' })
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ ...shareData, files: [file] })
          return
        }
      } catch { /* โหลด/แชร์รูปไม่สำเร็จ — ไปแชร์แบบไม่มีรูปต่อด้านล่างแทน */ }
    }
    if (navigator.share) { // ถ้าเบราว์เซอร์รองรับ Web Share API (มักเป็นมือถือ)
      try { await navigator.share(shareData); return } catch { /* cancelled */ } // เปิดหน้าต่างแชร์ของระบบ ถ้าผู้ใช้กดยกเลิกก็ไม่ทำอะไรต่อ
    }
    try { // ถ้าไม่รองรับ Web Share API ให้คัดลอกลิงก์ลง clipboard แทน
      await navigator.clipboard.writeText(url) // คัดลอกลิงก์
      setShared(true) // ตั้งสถานะว่าคัดลอกแล้ว เพื่อโชว์เครื่องหมาย ✓
      setTimeout(() => setShared(false), 1800) // หลัง 1.8 วินาที ให้กลับมาแสดงไอคอนแชร์ตามปกติ
    } catch { /* noop */ } // ถ้าคัดลอกไม่สำเร็จ ก็ไม่ทำอะไร
  }

  const outOfStock = totalStock <= 0 // หมดสต็อกก็ต่อเมื่อทุก variant ในกลุ่มหมดพร้อมกัน
  const maxDiscountPercent = anyDiscount ? Math.max(...variants.filter(hasDiscount).map(discountPercent)) : 0
  // variant ที่ราคาต่ำสุด (คือตัวที่กำหนด minPrice) — ใช้หาราคาเต็มเดิมของมันมาขีดฆ่าคู่กัน (anchoring effect)
  const cheapestVariant = variants.reduce((a, b) => (effectivePrice(a) <= effectivePrice(b) ? a : b))
  // รวมสี/ขนาดจากทุก variant ในกลุ่ม ไว้โชว์คร่าวๆ ในการ์ด (เลือกจริงในหน้ารายละเอียด)
  const colorsUnion = [...new Set(variants.flatMap((v) => v.colors || []))]
  // หมวดหมู่ที่มีลิสต์ไซซ์มาตรฐาน (เสื้อ) โชว์ครบทุกไซซ์เรียงตามลำดับเดียวกับหน้ารายละเอียด แทนการรวมแบบไม่เรียงลำดับ
  const sizesUnion = SHOP_SIZES_BY_CATEGORY[primary.category] || dedupeSortSizes(variants.flatMap((v) => v.sizes || []), primary.category)
  // รวมสต็อกต่อไซซ์จากทุก variant ในกลุ่ม — ไซซ์ไหนรวมแล้ว 0 ให้แสดงจางลง (แต่ยังคงอยู่ ไม่ซ่อน)
  // ถ้า doc ไหนไม่มี sizeStock (ยังไม่ได้กรอกสต็อกแยกไซซ์) ใช้ลิสต์ "sizes" ที่เปิดขายแทนเป็นสัญญาณหยาบๆ (ไซซ์ที่ไม่อยู่ในนั้นถือว่าไม่มี)
  const sizeStockUnion = {}
  let hasSizeStockData = false
  variants.forEach((v) => {
    if (v.sizeStock) {
      hasSizeStockData = true
      Object.entries(v.sizeStock).forEach(([sz, qty]) => { sizeStockUnion[sz] = (sizeStockUnion[sz] || 0) + (Number(qty) || 0) })
    } else if (v.sizes?.length) {
      hasSizeStockData = true
      v.sizes.forEach((sz) => { sizeStockUnion[sz] = (sizeStockUnion[sz] || 0) + 1 })
    }
  })

  return ( // ส่วนแสดงผลของการ์ดสินค้า
    <FadeUp className="shop-card" id={primary.id} onClick={() => onOpen(primary)} role="button" tabIndex={0}> {/* การ์ดทั้งใบคลิกได้ — เรียก onOpen เพื่อเปิดรายละเอียดสินค้านี้ */}
      <div className="shop-img"> {/* ส่วนแสดงรูปภาพของการ์ด */}
        {img ? <img src={optImg(img, 500)} alt={primary.name} loading="lazy" /> : <div className="shop-img-ph"><FontAwesomeIcon icon={faBagShopping} /></div>} {/* แสดงรูปจริงถ้ามี ไม่มีก็แสดงไอคอนแทน */}
        {outOfStock && <span className="shop-badge-out">{t.out}</span>} {/* ป้าย "สินค้าหมด" แสดงเมื่อทุก variant หมด */}
        {!outOfStock && anyDiscount && <span className="shop-badge-discount">-{maxDiscountPercent}%</span>} {/* ป้ายเปอร์เซ็นต์ส่วนลดสูงสุดในกลุ่ม */}
        {multiVariant && <span className="shop-badge-variants">{variants.length} ตัวเลือก</span>} {/* บอกว่ามีให้เลือกหลายสี/ขนาด */}
        <button className="shop-share" onClick={share} title={t.share} aria-label={t.share}> {/* ปุ่มแชร์ลิงก์สินค้า */}
          {shared ? <FontAwesomeIcon icon={faCheck} /> : <FontAwesomeIcon icon={faShareNodes} />}
        </button>
      </div>
      <div className="shop-body"> {/* ส่วนข้อมูลข้อความของการ์ด */}
        {primary.category && <span className="shop-cat">{primary.category}</span>} {/* แท็กหมวดหมู่สินค้า ถ้ามี */}
        <h4 className="shop-name">{primary.name}</h4> {/* ชื่อสินค้า */}
        {minPrice != null && ( // ราคาสินค้า — มีส่วนลดจริงโชว์ราคาเต็มขีดฆ่าคู่กับราคาลด (anchoring effect) ราคาต่างกันในกลุ่มโชว์แค่ราคาต่ำสุด ไม่มีคำนำหน้า
          <div className="shop-price">
            {hasDiscount(cheapestVariant) && <span className="shop-price-old">{THB(cheapestVariant.price)}</span>}
            {THB(minPrice)}
          </div>
        )}

        {colorsUnion.length > 0 && ( // แสดงแถวสี ถ้ามีตัวเลือกสี (รวมทุก variant)
          <div className="shop-meta-row"><span className="shop-meta-label">{t.color}:</span> {colorsUnion.join(', ')}</div>
        )}
        {sizesUnion.length > 0 && ( // แสดงแถวขนาด ครบทุกไซซ์มาตรฐาน — ไซซ์ไหนหมด (สต็อกรวม 0) แสดงจางลงแทนการซ่อน
          <div className="shop-meta-row">
            <span className="shop-meta-label">{t.size}:</span>{' '}
            {sizesUnion.map((sz, i) => {
              const dim = hasSizeStockData && (sizeStockUnion[sz] || 0) <= 0
              return (
                <span key={sz} style={dim ? { opacity: .4 } : undefined}>
                  {sz}{i < sizesUnion.length - 1 ? ', ' : ''}
                </span>
              )
            })}
          </div>
        )}
        {primary.description && <p className="shop-desc">{primary.description}</p>} {/* คำอธิบายสินค้า ถ้ามี */}

        <div className="shop-card-foot">
          <span className={`shop-stock ${outOfStock ? 'out' : ''}`}>{t.stock}: {totalStock}</span> {/* รวมสต็อกทุก variant ในกลุ่ม */}
          {totalSold > 0 && <span className="shop-sold">{t.sold} {totalSold} {t.soldUnit}</span>} {/* ยอดขาย — social proof, โชว์เฉพาะเมื่อเคยขายแล้ว */}
        </div>
      </div>
    </FadeUp>
  )
}

export default function Shop() { // คอมโพเนนต์หลักของหน้า /um-shop
  const { lang } = useLang() // ภาษาปัจจุบันของผู้ใช้
  const t = T[lang] || T.th // ข้อความแปลภาษาตามภาษาปัจจุบัน ถ้าไม่พบให้ใช้ภาษาไทยเป็นค่าเริ่มต้น
  const { products, loading } = useProducts() // ดึงรายการสินค้าทั้งหมดและสถานะกำลังโหลดจาก Firestore
  const go = useNavigate() // เปลี่ยนหน้าไปหน้ารายละเอียดสินค้า

  const [search, setSearch] = useState('') // ข้อความค้นหาที่ผู้ใช้พิมพ์
  const [category, setCategory] = useState('all') // หมวดหมู่ที่เลือกกรอง (เริ่มต้น = ทั้งหมด)
  const [sort, setSort] = useState('new') // ลำดับการเรียงสินค้า (เริ่มต้น = ใหม่ล่าสุด)
  const openDetail = (p) => go('shop-detail', p.productId || p.id) // ไปหน้ารายละเอียดสินค้า (/um-shop/:productId)

  // สินค้าที่แอดมินปิดการแสดงผล (active === false) จะไม่แสดงในหน้าร้านสาธารณะ — สินค้าเก่าที่ไม่มีฟิลด์นี้ถือว่าเปิดอยู่
  const visibleProducts = useMemo(() => products.filter((p) => p.active !== false), [products])

  const categories = useMemo(() => { // คำนวณรายชื่อหมวดหมู่ทั้งหมดที่มีในสินค้า (คำนวณใหม่เมื่อ products เปลี่ยน)
    const set = new Set(visibleProducts.map((p) => p.category).filter(Boolean)) // เก็บหมวดหมู่ที่ไม่ซ้ำกัน (ตัดค่าว่าง/undefined ออก)
    return [...set] // แปลง Set เป็น array เพื่อใช้ render
  }, [visibleProducts])

  // รวมสินค้าชื่อเดียวกัน (คนละสี/ขนาด คนละ doc) ให้เป็นการ์ดเดียวก่อนกรอง/เรียง
  const groups = useMemo(() => groupProductsByName(visibleProducts), [visibleProducts])

  // placeholder ช่องค้นหาที่วนแสดงชื่อสินค้าจริงไปเรื่อยๆ (เช่น 'ค้นหาสินค้า... เช่น "เสื้อลายมะกอก"') ให้ผู้ใช้เห็นตัวอย่างว่าพิมพ์อะไรได้บ้าง
  const sampleNames = useMemo(() => [...new Set(groups.map((g) => g.name).filter(Boolean))].slice(0, 12), [groups])
  const [phIndex, setPhIndex] = useState(0)
  useEffect(() => {
    if (sampleNames.length === 0) return
    const id = setInterval(() => setPhIndex((i) => (i + 1) % sampleNames.length), 2200)
    return () => clearInterval(id)
  }, [sampleNames])
  const searchPlaceholder = sampleNames.length > 0 ? `${t.searchPh} "${sampleNames[phIndex]}"` : t.searchPh

  const filtered = useMemo(() => { // คำนวณกลุ่มสินค้าที่ผ่านการค้นหา/กรอง/เรียงลำดับ (คำนวณใหม่เมื่อ dependency เปลี่ยน)
    const s = search.trim().toLowerCase() // ข้อความค้นหา ตัดช่องว่างและแปลงเป็นตัวพิมพ์เล็กเพื่อเทียบแบบไม่สนตัวพิมพ์
    return groups
      .filter((g) => (category === 'all' ? true : g.primary.category === category)) // กรองตามหมวดหมู่ที่เลือก (ถ้าเลือก "ทั้งหมด" ให้ผ่านทุกตัว)
      .filter((g) => !s || [g.name, g.primary.description, g.primary.category].some((x) => (x || '').toLowerCase().includes(s))) // กรองตามคำค้นหา จากชื่อ/คำอธิบาย/หมวดหมู่
      .sort((a, b) => { // เรียงลำดับกลุ่มสินค้าตามตัวเลือกที่ผู้ใช้เลือก
        if (sort === 'priceAsc') return a.minPrice - b.minPrice // ราคาน้อยไปมาก (ใช้ราคาต่ำสุดในกลุ่ม)
        if (sort === 'priceDesc') return b.minPrice - a.minPrice // ราคามากไปน้อย (ใช้ราคาต่ำสุดในกลุ่ม)
        if (sort === 'name') return (a.name || '').localeCompare(b.name || '') // เรียงตามชื่อ A-Z
        return (b.primary.createdAt || 0) - (a.primary.createdAt || 0) // ค่าเริ่มต้น: ใหม่ล่าสุดก่อน (เรียงตามวันที่สร้างจากมากไปน้อย)
      })
  }, [groups, search, category, sort])

  return ( // ส่วนแสดงผลของหน้า Shop ทั้งหมด
    <main className="page"> {/* คอนเทนเนอร์หลักของหน้า */}
      <section className="page-band shop-page-band"> {/* แถบหัวหน้า — พื้นหลังโปสเตอร์ MEGA SALE เต็มภาพ ไม่มีข้อความทับ (โปสเตอร์มีข้อความอยู่แล้ว) */}
        {/* h1 ซ่อนไว้เพื่อ SEO/accessibility (โครงสร้างหน้าควรมี h1 เดียว) แต่ไม่แสดงผลทับโปสเตอร์ */}
        <h1 style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>{t.h1}</h1>
      </section>

      <section className="section"> {/* ส่วนเนื้อหาหลัก: แถบควบคุมและตะแกรงสินค้า */}
        <div className="wrap"> {/* กรอบจำกัดความกว้างเนื้อหา */}
          <InAppBrowserWarning />
          <div className="shop-toolbar"> {/* แถบเครื่องมือ: ค้นหา/กรองหมวดหมู่/เรียงลำดับ */}
            <input
              type="search" // กล่องค้นหาแบบ search input (มีปุ่ม X ล้างค่าในบางเบราว์เซอร์)
              className="shop-search"
              placeholder={searchPlaceholder} // ข้อความตัวอย่างในช่องค้นหา — วนโชว์ชื่อสินค้าจริงไปเรื่อยๆ
              value={search} // ค่าปัจจุบันผูกกับ state search
              onChange={(e) => setSearch(e.target.value)} // อัปเดต state เมื่อผู้ใช้พิมพ์
            />
            {categories.length > 0 && ( // แสดง dropdown หมวดหมู่ เฉพาะเมื่อมีหมวดหมู่ให้เลือก
              <select value={category} onChange={(e) => setCategory(e.target.value)}> {/* dropdown เลือกหมวดหมู่ */}
                <option value="all">{t.allCat}</option> {/* ตัวเลือก "ทุกหมวดหมู่" */}
                {categories.map((c) => <option key={c} value={c}>{c}</option>)} {/* ตัวเลือกแต่ละหมวดหมู่ */}
              </select>
            )}
            <select value={sort} onChange={(e) => setSort(e.target.value)}> {/* dropdown เลือกลำดับการเรียง */}
              <option value="new">{t.sortNew}</option> {/* เรียงตามใหม่ล่าสุด */}
              <option value="priceAsc">{t.sortPriceAsc}</option> {/* เรียงราคาต่ำไปสูง */}
              <option value="priceDesc">{t.sortPriceDesc}</option> {/* เรียงราคาสูงไปต่ำ */}
              <option value="name">{t.sortName}</option> {/* เรียงตามชื่อ A-Z */}
            </select>
            <button type="button" className="shop-myorders-btn" onClick={() => go('shop-my-orders')}>
              📦 คำสั่งซื้อของฉัน
            </button>
          </div>

          {!loading && filtered.length === 0 && ( // ถ้าโหลดเสร็จแล้วและไม่มีสินค้าที่ตรงตามเงื่อนไข ให้แสดงข้อความว่างเปล่า
            <p style={{ textAlign: 'center', color: 'var(--ink-soft)', padding: '40px 0' }}>{t.empty}</p>
          )}

          <div className="shop-grid"> {/* ตะแกรงแสดงการ์ดสินค้าทั้งหมด */}
            {loading
              ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />) // ระหว่างโหลด โชว์การ์ดโครง 8 ใบกันจอว่าง
              : filtered.map((g) => <ProductCard key={g.key} g={g} t={t} onOpen={openDetail} />)} {/* แสดงการ์ดกลุ่มสินค้าทุกกลุ่มที่ผ่านการกรอง คลิกแล้วไปหน้ารายละเอียด */}
          </div>
        </div>
      </section>

      <Footer /> {/* ส่วนท้ายหน้า */}
    </main>
  )
}
