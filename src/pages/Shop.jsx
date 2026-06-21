import { useMemo, useState } from 'react' // ใช้ useMemo สำหรับคำนวณค่าที่แคชไว้ และ useState สำหรับ state
import { useProducts } from '../data/shop.js' // hook ดึงรายการสินค้าจาก Firestore
import FadeUp from '../components/FadeUp.jsx' // คอมโพเนนต์ wrapper ทำ animation เลื่อนขึ้นตอนแสดงผล
import Footer from '../components/Footer.jsx' // ส่วน Footer ท้ายหน้า
import { useLang } from '../i18n.jsx' // hook อ่านภาษาปัจจุบันของผู้ใช้ (th/en/ar)
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBagShopping, faLink, faCheck } from '@fortawesome/free-solid-svg-icons'

// หน้าร้านค้า Um Shop (/um-shop) — แสดงสินค้าทั้งหมด ค้นหา/กรองหมวดหมู่/เรียงราคา และแชร์รูปสินค้าลงโซเชียลได้
// คลิกที่สินค้าเพื่อเปิดหน้ารายละเอียดขนาดใหญ่ พร้อมแกลเลอรีรูปและปุ่ม "สนใจสินค้า" ไปที่ LINE

const LINE_URL = 'https://line.me/R/ti/p/@745bvvgx' // ลิงก์บัญชี LINE OA ของมูลนิธิ ใช้เปิดแชทตอนกด "สนใจสินค้า"

const THB = (n) => '฿' + Number(n || 0).toLocaleString('th-TH') // ฟังก์ชันแปลงตัวเลขเป็นรูปแบบราคาบาท เช่น ฿1,234

const T = { // อ็อบเจกต์เก็บข้อความแปลภาษา แยกตามภาษา (th/en/ar)
  th: { // ข้อความภาษาไทย
    badge: '🛍️ Um Shop', // ป้าย badge บนหัวหน้า
    h1: 'สินค้าจากมูลนิธิอุมมะตี', // หัวข้อใหญ่
    p: 'เลือกซื้อสินค้าเพื่อสนับสนุนภารกิจของมูลนิธิ — รายได้นำไปช่วยเหลือผู้ยากไร้', // คำบรรยายใต้หัวข้อ
    searchPh: 'ค้นหาสินค้า...', // placeholder ของช่องค้นหา
    allCat: 'ทุกหมวดหมู่', // ตัวเลือก "ทุกหมวดหมู่" ใน dropdown
    sortNew: 'ใหม่ล่าสุด', sortPriceAsc: 'ราคา: ต่ำ-สูง', sortPriceDesc: 'ราคา: สูง-ต่ำ', sortName: 'ชื่อสินค้า A-Z', // ตัวเลือกการเรียงลำดับ
    color: 'สี', size: 'ขนาด', stock: 'คงเหลือ', out: 'สินค้าหมด', share: 'แชร์', shared: 'คัดลอกลิงก์แล้ว ✓', // ป้ายข้อความย่อยต่างๆ
    empty: 'ยังไม่มีสินค้าในขณะนี้', // ข้อความตอนไม่มีสินค้า
    interested: 'สนใจสินค้า', close: 'ปิด', // ปุ่ม "สนใจสินค้า" และปุ่ม "ปิด"
    lineMsg: (name) => `สนใจสินค้า: ${name}`, // ข้อความที่ส่งไปทาง LINE พร้อมชื่อสินค้า
  },
  en: { // ข้อความภาษาอังกฤษ
    badge: '🛍️ Um Shop', // ป้าย badge บนหัวหน้า
    h1: 'Ummatee Foundation Products', // หัวข้อใหญ่
    p: 'Shop to support the foundation\'s mission — proceeds help those in need', // คำบรรยายใต้หัวข้อ
    searchPh: 'Search products...', // placeholder ของช่องค้นหา
    allCat: 'All categories', // ตัวเลือก "ทุกหมวดหมู่"
    sortNew: 'Newest', sortPriceAsc: 'Price: low to high', sortPriceDesc: 'Price: high to low', sortName: 'Name A-Z', // ตัวเลือกการเรียงลำดับ
    color: 'Color', size: 'Size', stock: 'In stock', out: 'Out of stock', share: 'Share', shared: 'Link copied ✓', // ป้ายข้อความย่อยต่างๆ
    empty: 'No products available yet', // ข้อความตอนไม่มีสินค้า
    interested: 'I\'m interested', close: 'Close', // ปุ่ม "สนใจสินค้า" และปุ่ม "ปิด"
    lineMsg: (name) => `Interested in: ${name}`, // ข้อความที่ส่งไปทาง LINE พร้อมชื่อสินค้า
  },
  ar: { // ข้อความภาษาอาหรับ
    badge: '🛍️ Um Shop', // ป้าย badge บนหัวหน้า
    h1: 'منتجات مؤسسة أمّتي', // หัวข้อใหญ่
    p: 'تسوّق لدعم مهمة المؤسسة — تذهب العائدات لمساعدة المحتاجين', // คำบรรยายใต้หัวข้อ
    searchPh: 'البحث عن المنتجات...', // placeholder ของช่องค้นหา
    allCat: 'كل الفئات', // ตัวเลือก "ทุกหมวดหมู่"
    sortNew: 'الأحدث', sortPriceAsc: 'السعر: من الأقل', sortPriceDesc: 'السعر: من الأعلى', sortName: 'الاسم أ-ي', // ตัวเลือกการเรียงลำดับ
    color: 'اللون', size: 'المقاس', stock: 'المتوفر', out: 'غير متوفر', share: 'مشاركة', shared: 'تم نسخ الرابط ✓', // ป้ายข้อความย่อยต่างๆ
    empty: 'لا توجد منتجات حالياً', // ข้อความตอนไม่มีสินค้า
    interested: 'مهتم بالمنتج', close: 'إغلاق', // ปุ่ม "สนใจสินค้า" และปุ่ม "ปิด"
    lineMsg: (name) => `مهتم بـ: ${name}`, // ข้อความที่ส่งไปทาง LINE พร้อมชื่อสินค้า
  },
}

function ProductCard({ p, t, onOpen }) { // การ์ดสินค้าหนึ่งใบในตะแกรงสินค้า — p คือข้อมูลสินค้า, t คือข้อความแปลภาษา, onOpen เรียกเมื่อคลิกเพื่อเปิดรายละเอียด
  const [shared, setShared] = useState(false) // state บอกว่าพึ่งคัดลอกลิงก์แชร์ไปหรือยัง (เพื่อแสดงเครื่องหมาย ✓ ชั่วคราว)
  const img = p.images?.[0] // รูปภาพแรกของสินค้า (ใช้แสดงในการ์ด)

  const share = async (e) => { // ฟังก์ชันแชร์สินค้า เมื่อกดปุ่มแชร์บนการ์ด
    e.stopPropagation() // กันไม่ให้ event ลอยไปกระตุ้น onClick ของการ์ด (ซึ่งจะเปิดหน้ารายละเอียด)
    const url = `${window.location.origin}/um-shop#${p.id}` // สร้างลิงก์ตรงไปยังสินค้านี้
    const shareData = { title: p.name, text: `${p.name} ${p.price ? THB(p.price) : ''}`, url } // ข้อมูลที่จะส่งให้ Web Share API
    if (navigator.share) { // ถ้าเบราว์เซอร์รองรับ Web Share API (มักเป็นมือถือ)
      try { await navigator.share(shareData); return } catch { /* cancelled */ } // เปิดหน้าต่างแชร์ของระบบ ถ้าผู้ใช้กดยกเลิกก็ไม่ทำอะไรต่อ
    }
    try { // ถ้าไม่รองรับ Web Share API ให้คัดลอกลิงก์ลง clipboard แทน
      await navigator.clipboard.writeText(url) // คัดลอกลิงก์
      setShared(true) // ตั้งสถานะว่าคัดลอกแล้ว เพื่อโชว์เครื่องหมาย ✓
      setTimeout(() => setShared(false), 1800) // หลัง 1.8 วินาที ให้กลับมาแสดงไอคอนแชร์ตามปกติ
    } catch { /* noop */ } // ถ้าคัดลอกไม่สำเร็จ ก็ไม่ทำอะไร
  }

  const outOfStock = (p.stock ?? 0) <= 0 // ตรวจว่าสินค้าหมดสต็อกหรือไม่ (stock เป็น 0 หรือไม่มีค่า)

  return ( // ส่วนแสดงผลของการ์ดสินค้า
    <FadeUp className="shop-card" id={p.id} onClick={() => onOpen(p)} role="button" tabIndex={0}> {/* การ์ดทั้งใบคลิกได้ — เรียก onOpen เพื่อเปิดรายละเอียดสินค้านี้ */}
      <div className="shop-img"> {/* ส่วนแสดงรูปภาพของการ์ด */}
        {img ? <img src={img} alt={p.name} loading="lazy" /> : <div className="shop-img-ph"><FontAwesomeIcon icon={faBagShopping} /></div>} {/* แสดงรูปจริงถ้ามี ไม่มีก็แสดงไอคอนแทน */}
        {outOfStock && <span className="shop-badge-out">{t.out}</span>} {/* ป้าย "สินค้าหมด" แสดงเมื่อ stock <= 0 */}
        <button className="shop-share" onClick={share} title={t.share} aria-label={t.share}> {/* ปุ่มแชร์ลิงก์สินค้า */}
          {shared ? <FontAwesomeIcon icon={faCheck} /> : <FontAwesomeIcon icon={faLink} />}
        </button>
      </div>
      <div className="shop-body"> {/* ส่วนข้อมูลข้อความของการ์ด */}
        {p.category && <span className="shop-cat">{p.category}</span>} {/* แท็กหมวดหมู่สินค้า ถ้ามี */}
        <h4 className="shop-name">{p.name}</h4> {/* ชื่อสินค้า */}
        {p.price != null && <div className="shop-price">{THB(p.price)}</div>} {/* ราคาสินค้า ถ้ามีการตั้งราคา */}
        {p.description && <p className="shop-desc">{p.description}</p>} {/* คำอธิบายสินค้า ถ้ามี */}
        {p.colors?.length > 0 && ( // แสดงแถวสี ถ้าสินค้ามีตัวเลือกสี
          <div className="shop-meta-row"><span className="shop-meta-label">{t.color}:</span> {p.colors.join(', ')}</div> // รวมรายชื่อสีด้วยจุลภาค
        )}
        {p.sizes?.length > 0 && ( // แสดงแถวขนาด ถ้าสินค้ามีตัวเลือกขนาด
          <div className="shop-meta-row"><span className="shop-meta-label">{t.size}:</span> {p.sizes.join(', ')}</div> // รวมรายชื่อขนาดด้วยจุลภาค
        )}
        {p.stock != null && ( // แสดงจำนวนคงเหลือ ถ้ามีการระบุ stock
          <div className={`shop-stock ${outOfStock ? 'out' : ''}`}>{t.stock}: {p.stock}</div> // เพิ่มคลาส "out" ถ้าสินค้าหมด เพื่อให้ CSS เปลี่ยนสี
        )}
      </div>
    </FadeUp>
  )
}

function ProductDetail({ p, t, onClose }) { // หน้าต่างรายละเอียดสินค้าแบบ modal — p คือสินค้าที่เลือก, onClose เรียกเมื่อปิด modal
  const images = p.images?.length ? p.images : [] // รายการรูปภาพทั้งหมดของสินค้า (ถ้าไม่มีให้เป็น array เปล่า)
  const [active, setActive] = useState(0) // index ของรูปที่กำลังแสดงอยู่ในแกลเลอรี
  const outOfStock = (p.stock ?? 0) <= 0 // ตรวจว่าสินค้าหมดสต็อกหรือไม่
  const lineHref = `${LINE_URL}?text=${encodeURIComponent(t.lineMsg(p.name))}` // ลิงก์เปิด LINE พร้อมข้อความที่กรอกไว้ล่วงหน้า ระบุชื่อสินค้า

  return ( // ส่วนแสดงผลของ modal รายละเอียดสินค้า
    <div className="shop-modal-backdrop" onClick={onClose}> {/* พื้นหลังมืดครอบทั้งจอ — คลิกพื้นหลังเพื่อปิด modal */}
      <div className="shop-modal" onClick={(e) => e.stopPropagation()}> {/* กล่อง modal — กันคลิกภายในไม่ให้ทะลุไปปิด modal */}
        <button className="shop-modal-close" onClick={onClose} aria-label={t.close}>×</button> {/* ปุ่มปิด modal มุมขวาบน */}
        <div className="shop-modal-body"> {/* เนื้อหา modal แบ่งเป็น 2 คอลัมน์ */}
          <div className="shop-modal-gallery"> {/* คอลัมน์ซ้าย: แกลเลอรีรูปภาพ */}
            <div className="shop-modal-main"> {/* รูปหลักที่กำลังแสดง */}
              {images[active] // ถ้ามีรูปในตำแหน่ง active
                ? <img src={images[active]} alt={p.name} /> // แสดงรูปนั้น
                : <div className="shop-img-ph"><FontAwesomeIcon icon={faBagShopping} /></div>} {/* ถ้าไม่มีรูปเลย แสดงไอคอนแทน */}
              {outOfStock && <span className="shop-badge-out">{t.out}</span>} {/* ป้าย "สินค้าหมด" ทับบนรูปหลัก */}
            </div>
            {images.length > 1 && ( // แสดงแถวรูปย่อย เฉพาะเมื่อมีรูปมากกว่า 1 รูป
              <div className="shop-modal-thumbs"> {/* แถวรูปย่อยให้คลิกเปลี่ยนรูปหลัก */}
                {images.map((img, i) => ( // วนสร้างปุ่มรูปย่อยสำหรับทุกรูป
                  <button
                    key={i} // ใช้ index เป็น key เพราะรูปไม่มี id เฉพาะ
                    className={`shop-modal-thumb ${i === active ? 'active' : ''}`} // ใส่คลาส active ให้รูปที่กำลังเลือกอยู่
                    onClick={() => setActive(i)} // คลิกแล้วเปลี่ยนรูปหลักไปเป็นรูปนี้
                  >
                    <img src={img} alt="" /> {/* รูปย่อย ไม่ต้องมี alt เพราะเป็นภาพตกแต่ง/ตัวเลือก */}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="shop-modal-info"> {/* คอลัมน์ขวา: รายละเอียดสินค้าและปุ่มติดต่อ */}
            {p.category && <span className="shop-cat">{p.category}</span>} {/* แท็กหมวดหมู่ ถ้ามี */}
            <h2 className="shop-modal-name">{p.name}</h2> {/* ชื่อสินค้า (ตัวใหญ่) */}
            {p.price != null && <div className="shop-modal-price">{THB(p.price)}</div>} {/* ราคาสินค้า ถ้ามี */}
            {p.description && <p className="shop-modal-desc">{p.description}</p>} {/* คำอธิบายสินค้าแบบเต็ม */}
            {p.colors?.length > 0 && ( // แสดงแถวสี ถ้ามีตัวเลือกสี
              <div className="shop-meta-row"><span className="shop-meta-label">{t.color}:</span> {p.colors.join(', ')}</div>
            )}
            {p.sizes?.length > 0 && ( // แสดงแถวขนาด ถ้ามีตัวเลือกขนาด
              <div className="shop-meta-row"><span className="shop-meta-label">{t.size}:</span> {p.sizes.join(', ')}</div>
            )}
            {p.stock != null && ( // แสดงจำนวนคงเหลือ ถ้ามีการระบุ
              <div className={`shop-stock ${outOfStock ? 'out' : ''}`}>{t.stock}: {p.stock}</div>
            )}
            <a className="shop-interest-btn" href={lineHref} target="_blank" rel="noopener noreferrer"> {/* ปุ่ม "สนใจสินค้า" เปิดแชท LINE แท็บใหม่ */}
              💬 {t.interested}
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Shop() { // คอมโพเนนต์หลักของหน้า /um-shop
  const { lang } = useLang() // ภาษาปัจจุบันของผู้ใช้
  const t = T[lang] || T.th // ข้อความแปลภาษาตามภาษาปัจจุบัน ถ้าไม่พบให้ใช้ภาษาไทยเป็นค่าเริ่มต้น
  const { products, loading } = useProducts() // ดึงรายการสินค้าทั้งหมดและสถานะกำลังโหลดจาก Firestore

  const [search, setSearch] = useState('') // ข้อความค้นหาที่ผู้ใช้พิมพ์
  const [category, setCategory] = useState('all') // หมวดหมู่ที่เลือกกรอง (เริ่มต้น = ทั้งหมด)
  const [sort, setSort] = useState('new') // ลำดับการเรียงสินค้า (เริ่มต้น = ใหม่ล่าสุด)
  const [selected, setSelected] = useState(null) // สินค้าที่ถูกเลือกเพื่อเปิดดูรายละเอียด (null = ไม่ได้เปิด modal)

  const categories = useMemo(() => { // คำนวณรายชื่อหมวดหมู่ทั้งหมดที่มีในสินค้า (คำนวณใหม่เมื่อ products เปลี่ยน)
    const set = new Set(products.map((p) => p.category).filter(Boolean)) // เก็บหมวดหมู่ที่ไม่ซ้ำกัน (ตัดค่าว่าง/undefined ออก)
    return [...set] // แปลง Set เป็น array เพื่อใช้ render
  }, [products])

  const filtered = useMemo(() => { // คำนวณรายการสินค้าที่ผ่านการค้นหา/กรอง/เรียงลำดับ (คำนวณใหม่เมื่อ dependency เปลี่ยน)
    const s = search.trim().toLowerCase() // ข้อความค้นหา ตัดช่องว่างและแปลงเป็นตัวพิมพ์เล็กเพื่อเทียบแบบไม่สนตัวพิมพ์
    return products
      .filter((p) => (category === 'all' ? true : p.category === category)) // กรองตามหมวดหมู่ที่เลือก (ถ้าเลือก "ทั้งหมด" ให้ผ่านทุกตัว)
      .filter((p) => !s || [p.name, p.description, p.category].some((x) => (x || '').toLowerCase().includes(s))) // กรองตามคำค้นหา จากชื่อ/คำอธิบาย/หมวดหมู่
      .sort((a, b) => { // เรียงลำดับสินค้าตามตัวเลือกที่ผู้ใช้เลือก
        if (sort === 'priceAsc') return (a.price || 0) - (b.price || 0) // ราคาน้อยไปมาก
        if (sort === 'priceDesc') return (b.price || 0) - (a.price || 0) // ราคามากไปน้อย
        if (sort === 'name') return (a.name || '').localeCompare(b.name || '') // เรียงตามชื่อ A-Z
        return (b.createdAt || 0) - (a.createdAt || 0) // ค่าเริ่มต้น: ใหม่ล่าสุดก่อน (เรียงตามวันที่สร้างจากมากไปน้อย)
      })
  }, [products, search, category, sort])

  return ( // ส่วนแสดงผลของหน้า Shop ทั้งหมด
    <main className="page"> {/* คอนเทนเนอร์หลักของหน้า */}
      <section className="page-band"> {/* แถบหัวหน้าสีพื้นหลังเข้ม */}
        <div className="fc-pattern hero-pattern"></div> {/* ลายพื้นหลังตกแต่ง */}
        <div className="inner"> {/* กล่องเนื้อหากลางของแถบหัว */}
          <span className="badge">{t.badge}</span> {/* ป้าย badge "Um Shop" */}
          <h1>{t.h1}</h1> {/* หัวข้อใหญ่ของหน้า */}
          <p>{t.p}</p> {/* คำบรรยายใต้หัวข้อ */}
        </div>
      </section>

      <section className="section"> {/* ส่วนเนื้อหาหลัก: แถบควบคุมและตะแกรงสินค้า */}
        <div className="wrap"> {/* กรอบจำกัดความกว้างเนื้อหา */}
          <div className="shop-toolbar"> {/* แถบเครื่องมือ: ค้นหา/กรองหมวดหมู่/เรียงลำดับ */}
            <input
              type="search" // กล่องค้นหาแบบ search input (มีปุ่ม X ล้างค่าในบางเบราว์เซอร์)
              className="shop-search"
              placeholder={t.searchPh} // ข้อความตัวอย่างในช่องค้นหา
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
          </div>

          {!loading && filtered.length === 0 && ( // ถ้าโหลดเสร็จแล้วและไม่มีสินค้าที่ตรงตามเงื่อนไข ให้แสดงข้อความว่างเปล่า
            <p style={{ textAlign: 'center', color: 'var(--ink-soft)', padding: '40px 0' }}>{t.empty}</p>
          )}

          <div className="shop-grid"> {/* ตะแกรงแสดงการ์ดสินค้าทั้งหมด */}
            {filtered.map((p) => <ProductCard key={p.id} p={p} t={t} onOpen={setSelected} />)} {/* แสดงการ์ดสินค้าทุกตัวที่ผ่านการกรอง คลิกแล้วตั้ง selected เพื่อเปิด modal */}
          </div>
        </div>
      </section>

      {selected && <ProductDetail p={selected} t={t} onClose={() => setSelected(null)} />} {/* แสดง modal รายละเอียดสินค้า เมื่อมีสินค้าถูกเลือก */}

      <Footer /> {/* ส่วนท้ายหน้า */}
    </main>
  )
}
