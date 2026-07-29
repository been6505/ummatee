import { useEffect, useMemo, useState } from 'react'
import { useProducts, hasDiscount, discountPercent, dedupeSortSizes, SHOP_SIZES_BY_CATEGORY, groupProductsByName } from '../data/shop.js'
import { addToCart, useCartCount } from '../data/cart.js'
import Footer from '../components/Footer.jsx'
import { ProductCard, SHOP_T } from './Shop.jsx'
import { useLang } from '../i18n.jsx'
import { useNavigate } from '../navContext'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBagShopping, faArrowLeft, faMinus, faPlus, faCartPlus, faCheck, faCartShopping, faComments, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'

// เปิดวิดเจ็ตแชทหน้าเว็บ (ChatWidget.jsx mount อยู่ที่ App.jsx) ผ่าน custom event — หน้านี้ไม่ได้ import ตัว widget ตรงๆ
// แนบข้อมูลสินค้าไปด้วย (การ์ดสินค้า) เผื่อลูกค้าทักถามรายละเอียดจากสินค้านั้น — แอดมินจะได้รู้ทันทีว่าถามเรื่องอะไร
const openChatWithProduct = (product) => window.dispatchEvent(new CustomEvent('ummatee-open-chat', { detail: { product } }))

// หน้ารายละเอียดสินค้า (/um-shop/:productId) — แกลเลอรีหลายรูป + ปุ่มเพิ่ม/ลดจำนวน + แถบล่างลอย (แชท / เพิ่มตะกร้า / ราคา)
// รองรับค้นหาสินค้าทั้งจาก productId (um001, um002, ...) หรือ Firestore doc id (สินค้าเก่าก่อนมี productId)

import { optImg } from '../utils/cloudinaryUrl.js'
const THB = (n) => '฿' + Number(n || 0).toLocaleString('th-TH')

const T = {
  th: {
    back: 'กลับไปหน้าร้านค้า', color: 'สี', size: 'ขนาด', type: 'ประเภท', stock: 'คงเหลือ', out: 'สินค้าหมด',
    pickColor: 'กรุณาเลือกสี', pickSize: 'กรุณาเลือกขนาด', pickType: 'กรุณาเลือกประเภท',
    alertOk: 'ตกลง', alertTitle: 'ยังเลือกไม่ครบ',
    qty: 'จำนวน', addToCart: 'เพิ่มลงตะกร้า', added: 'เพิ่มลงตะกร้าแล้ว ✓', chat: 'แชท', viewCart: 'ดูตะกร้าสินค้า',
    notFound: 'ไม่พบสินค้านี้', notFoundDesc: 'สินค้าอาจถูกลบหรือย้ายไปแล้ว', related: 'สินค้าที่น่าสนใจ',
  },
  en: {
    back: 'Back to shop', color: 'Color', size: 'Size', type: 'Type', stock: 'In stock', out: 'Out of stock',
    pickColor: 'Please select a color', pickSize: 'Please select a size', pickType: 'Please select a type',
    alertOk: 'OK', alertTitle: 'Selection required',
    qty: 'Quantity', addToCart: 'Add to cart', added: 'Added to cart ✓', chat: 'Chat', viewCart: 'View cart',
    notFound: 'Product not found', notFoundDesc: 'This product may have been removed or moved.', related: 'You may also like',
  },
  ar: {
    back: 'العودة للمتجر', color: 'اللون', size: 'المقاس', type: 'النوع', stock: 'المتوفر', out: 'غير متوفر',
    pickColor: 'يرجى اختيار اللون', pickSize: 'يرجى اختيار المقاس', pickType: 'يرجى اختيار النوع',
    alertOk: 'حسناً', alertTitle: 'الاختيار مطلوب',
    qty: 'الكمية', addToCart: 'أضف إلى السلة', added: 'أُضيف إلى السلة ✓', chat: 'تواصل عبر LINE', viewCart: 'عرض السلة',
    notFound: 'المنتج غير موجود', notFoundDesc: 'ربما تمت إزالة هذا المنتج أو نقله.', related: 'منتجات قد تعجبك',
  },
}

export default function ShopProductDetail({ productId }) {
  const { lang } = useLang()
  const t = T[lang] || T.th
  const go = useNavigate()
  const cartCount = useCartCount()
  const { products, loading } = useProducts()

  // สินค้าที่แอดมินปิดการแสดงผล (active === false) เข้าถึงตรงด้วยลิงก์ไม่ได้เช่นกัน — สินค้าเก่าที่ไม่มีฟิลด์นี้ถือว่าเปิดอยู่
  const linkedProduct = useMemo(
    () => products.find((p) => p.active !== false && (p.productId === productId || p.id === productId)),
    [products, productId]
  )

  // สินค้าชื่อเดียวกัน (คนละสี/ขนาด คนละ doc) — ถ้ามีมากกว่า 1 ให้เลือก "สี" คือเลือก doc ไหนกันแน่
  const groupVariants = useMemo(
    () => (linkedProduct ? products.filter((p) => p.active !== false && (p.name || '').trim() === (linkedProduct.name || '').trim()) : []),
    [products, linkedProduct]
  )
  const hasVariantGroup = groupVariants.length > 1

  const [activeImage, setActiveImage] = useState(0)
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)
  const [selVariantId, setSelVariantId] = useState(null) // doc ที่เลือกอยู่ (โหมดกลุ่มหลาย doc)
  const [selColor, setSelColor] = useState('') // สีที่เลือก (โหมด doc เดียวมีหลายสีในฟิลด์เดียว — ของเดิม)
  const [selSize, setSelSize] = useState('')
  const [selType, setSelType] = useState('') // ประเภท (แขนสั้น/แขนยาว/เด็กเล็ก) — คนละ doc กันในกลุ่มเดียวกัน เหมือนสี
  const [variantError, setVariantError] = useState('')

  // เปลี่ยนสินค้า (URL เปลี่ยน) → เริ่มต้นใหม่ที่ variant ตรงกับลิงก์ที่เปิดมา
  useEffect(() => {
    setSelVariantId(linkedProduct?.id || null)
    setActiveImage(0)
    setQty(1)
    setSelColor('')
    setSelSize('')
    setSelType(linkedProduct?.type || '')
    setVariantError('')
  }, [linkedProduct?.id])

  const product = hasVariantGroup
    ? (groupVariants.find((p) => p.id === selVariantId) || linkedProduct)
    : linkedProduct

  // ป้ายชื่อสี ของแต่ละ variant (doc) ในกลุ่ม — ใช้ colors ของ doc นั้นถ้ามี ไม่งั้น fallback เป็นรหัสสินค้า/ลำดับ
  const variantLabel = (v, i) => (v.colors?.length ? v.colors.join('/') : (v.productId || `ตัวเลือกที่ ${i + 1}`))

  // ประเภท — มีให้เลือกก็ต่อเมื่อ doc ในกลุ่มเดียวกันมีมากกว่า 1 ประเภทจริง (เช่น แขนสั้น/แขนยาว/เด็กเล็ก)
  const typesUnion = useMemo(() => [...new Set(groupVariants.map((v) => v.type).filter(Boolean))], [groupVariants])
  const hasTypes = typesUnion.length > 1
  // ตัวเลือกสี/variant ต้องกรองด้วยประเภทที่เลือกก่อน — กันไม่ให้ "แขนสั้นสีดำ" กับ "แขนยาวสีดำ" (คนละ doc) ขึ้นเป็นชิปสีซ้ำกัน
  const variantsForType = useMemo(
    () => (hasTypes && selType ? groupVariants.filter((v) => v.type === selType) : groupVariants),
    [groupVariants, hasTypes, selType]
  )

  // ตัดชิปสีซ้ำออก — สินค้าบางกลุ่ม (เช่นเสื้อ) มีหลาย doc สีเดียวกันแต่ต่างขนาด/ล็อต ไม่ต้องขึ้นชิปซ้ำ
  // ต้องอยู่เหนือ early return ของ loading/not-found เสมอ ไม่งั้นจำนวน hook ที่เรียกจะไม่เท่ากันระหว่าง render (React error #310)
  const dedupedGroupVariants = useMemo(() => {
    const seen = new Set()
    return variantsForType.filter((v, i) => {
      const label = variantLabel(v, i)
      if (seen.has(label)) return false
      seen.add(label)
      return true
    })
  }, [variantsForType])
  const dedupedColors = useMemo(() => [...new Set(product?.colors || [])], [product])
  // ขนาด — หมวดหมู่ที่มีลิสต์มาตรฐาน (เสื้อ: S,M,L,XL,2XL,3XL) โชว์ครบทุกไซซ์เสมอ แม้สินค้าเก่าที่ยังไม่มี sizeStock
  // (แค่ปิดปุ่มไม่ได้ถ้าไม่รู้สต็อกแยกไซซ์) ไซซ์ไหนหมด (มี sizeStock แล้วและ =0) ปิดปุ่มแทนการซ่อนไปเลย
  const dedupedSizes = useMemo(() => {
    return SHOP_SIZES_BY_CATEGORY[product?.category] || dedupeSortSizes(product?.sizes, product?.category)
  }, [product])

  // สินค้าที่น่าสนใจ — สุ่ม 3 ชิ้นจากสินค้าที่แสดงผลอยู่ (active) ไม่รวมสินค้ากลุ่มปัจจุบัน เลือกหมวดหมู่เดียวกันก่อนถ้ามีพอ ไม่งั้นใช้ทั้งร้าน
  const relatedGroups = useMemo(() => {
    const others = products.filter((p) => p.active !== false && (p.name || '').trim() !== (linkedProduct?.name || '').trim())
    const groups = groupProductsByName(others)
    const sameCategory = groups.filter((g) => g.primary.category === linkedProduct?.category)
    const pool = sameCategory.length >= 3 ? sameCategory : groups
    // สุ่มลำดับแบบ Fisher–Yates เบาๆ ให้เปลี่ยนหน้าตาทุกครั้งที่เข้า ไม่ใช่โชว์ 3 ชิ้นเดิมซ้ำๆ
    const shuffled = [...pool]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled.slice(0, 4)
  }, [products, linkedProduct])

  const backToShop = (e) => { e.preventDefault(); go('shop') }
  const viewCart = () => go('shop-cart')
  const openProduct = (p) => go('shop-detail', p.productId || p.id)

  // ระหว่างโหลด โชว์โครงหน้า (รูป + แถวข้อความ) แทนจอว่าง — กันหน้าขาวกระพริบตอนเข้าหน้าสินค้าครั้งแรก
  if (loading) {
    return (
      <main className="page shop-detail-page">
        <section className="section"><div className="wrap">
          <div className="shop-detail-body">
            <div className="shop-modal-gallery"><div className="shop-modal-main sk-block" /></div>
            <div className="shop-modal-info">
              <div className="sk-line sk-line-sm" />
              <div className="sk-line sk-line-lg" style={{ height: 28 }} />
              <div className="sk-line sk-line-md" />
              <div className="sk-line sk-line-md" />
              <div className="sk-line sk-line-sm" />
            </div>
          </div>
        </div></section>
      </main>
    )
  }

  if (!linkedProduct) {
    return (
      <main className="page">
        <section className="section"><div className="wrap" style={{ textAlign: 'center', padding: '80px 0' }}>
          <h2>{t.notFound}</h2>
          <p style={{ color: 'var(--ink-soft)', marginBottom: 20 }}>{t.notFoundDesc}</p>
          <a href="/um-shop" onClick={backToShop} className="shop-interest-btn" style={{ background: 'var(--green-mid)' }}>
            <FontAwesomeIcon icon={faArrowLeft} /> {t.back}
          </a>
        </div></section>
        <Footer />
      </main>
    )
  }

  const images = product.images?.length ? product.images : []

  // เปิดแชทพร้อมแนบการ์ดสินค้าที่กำลังดูอยู่ — ใช้ราคาที่ตรงกับที่ลูกค้าเห็นจริง (ลดแล้วถ้ามีส่วนลด)
  const handleOpenChat = () => openChatWithProduct({
    name: product.name,
    price: hasDiscount(product) ? product.discountPrice : product.price,
    image: images[0] ? optImg(images[0], 300) : undefined,
    url: window.location.href,
  })
  const hasSizes = dedupedSizes.length > 0
  // ไซซ์นี้ยังมีของไหม — ใช้ข้อมูลสต็อกที่แม่นสุดที่มี: sizeStock (จำนวนแยกไซซ์เป๊ะๆ) ถ้ามี
  // ไม่มีก็ดูจากลิสต์ "sizes" ที่ doc นี้บันทึกไว้ว่าเปิดขายไซซ์ไหนบ้าง (เช่น เด็กเล็กอาจไม่มี XL/2XL/3XL เลย)
  // ถ้าไม่มีข้อมูลอะไรเลยจริงๆ ค่อย fallback เป็นเปิดให้เลือกได้หมด (กันปิดมั่วตอนไม่รู้ข้อมูล)
  const isSizeAvailable = (sz) => {
    if (product.sizeStock) return (Number(product.sizeStock[sz]) || 0) > 0
    if (product.sizes?.length) return product.sizes.includes(sz)
    return true
  }
  // สต็อกที่ใช้จริง — ถ้าเลือกไซซ์แล้วและสินค้ามี sizeStock ให้ใช้ของไซซ์นั้นเป๊ะๆ (เหมือน Shopee ที่ตัวเลข "คงเหลือ"/จำนวนซื้อสูงสุด เปลี่ยนตามตัวเลือกที่กด)
  // ไม่งั้น fallback เป็น stock รวมของสินค้าเหมือนเดิม (สินค้าที่ไม่มีไซซ์ หรือยังไม่ได้เลือกไซซ์)
  const effectiveStock = (hasSizes && selSize && product.sizeStock) ? (Number(product.sizeStock[selSize]) || 0) : product.stock
  const outOfStock = (effectiveStock ?? 0) <= 0
  const maxQty = Number.isFinite(effectiveStock) && effectiveStock > 0 ? effectiveStock : 99

  const dec = () => setQty((q) => Math.max(1, q - 1))
  const inc = () => setQty((q) => Math.min(maxQty, q + 1))

  const hasColors = hasVariantGroup || (product.colors?.length || 0) > 0
  const selectedLabel = hasVariantGroup ? variantLabel(product, groupVariants.indexOf(product)) : null

  const selectVariant = (v) => {
    setSelVariantId(v.id)
    setActiveImage(0)
    setQty(1)
    setSelSize('')
    setVariantError('')
  }

  // เปลี่ยนประเภท (แขนสั้น/แขนยาว/เด็กเล็ก) — พยายามคงสีเดิมไว้ถ้าประเภทใหม่มีสีเดียวกัน ไม่งั้นเลือกตัวแรกที่ยังมีของ
  const selectType = (typ) => {
    setSelType(typ)
    const candidates = groupVariants.filter((v) => v.type === typ)
    const matchByColor = selectedLabel && candidates.find((v, i) => variantLabel(v, i) === selectedLabel)
    const next = matchByColor || candidates.find((v) => (v.stock ?? 0) > 0) || candidates[0]
    if (next) { setSelVariantId(next.id); setActiveImage(0); setQty(1) }
    setSelSize('')
    setVariantError('')
  }

  const handleAddToCart = () => {
    if (outOfStock) return
    // สินค้าที่มีตัวเลือก ต้องเลือกก่อนเพิ่มลงตะกร้า — ไม่งั้นแอดมินไม่รู้ว่าลูกค้าต้องการแบบไหน
    if (hasTypes && !selType) { setVariantError(t.pickType); return }
    if (hasVariantGroup && !selVariantId) { setVariantError(t.pickColor); return }
    if (!hasVariantGroup && (product.colors?.length || 0) > 0 && !selColor) { setVariantError(t.pickColor); return }
    if (hasSizes && !selSize) { setVariantError(t.pickSize); return }
    if (hasSizes && selSize && !isSizeAvailable(selSize)) { setVariantError(t.pickSize); return }
    setVariantError('')
    const colorForCart = hasVariantGroup
      ? variantLabel(product, groupVariants.findIndex((v) => v.id === product.id))
      : selColor
    addToCart(product, qty, { color: colorForCart, size: selSize })
    setAdded(true)
    setTimeout(() => setAdded(false), 1800)
  }

  return (
    <>
    {/* แจ้งเตือนกลางจอตอนกดเพิ่มลงตะกร้าโดยยังเลือกตัวเลือกไม่ครบ
        เดิมเป็นข้อความแดงเล็กๆ ใต้รายการตัวเลือก ซึ่งลูกค้ามองไม่เห็นเพราะปุ่มเพิ่มลงตะกร้า
        อยู่แถบล่างที่ลอยติดจอ (คนละที่กับข้อความ) กดแล้วเหมือนปุ่มไม่ทำงาน
        z-index ต้องสูงกว่า .shop-detail-bar (500) ไม่งั้นโดนแถบล่างทับ */}
    {variantError && (
      <div className="shop-alert-overlay" role="dialog" aria-modal="true" onClick={() => setVariantError('')}>
        <div className="shop-alert" onClick={(e) => e.stopPropagation()}>
          <div className="shop-alert-icon"><FontAwesomeIcon icon={faTriangleExclamation} /></div>
          <h3>{t.alertTitle}</h3>
          <p>{variantError}</p>
          <button type="button" className="shop-alert-btn" onClick={() => setVariantError('')} autoFocus>
            {t.alertOk}
          </button>
        </div>
      </div>
    )}
    <main className="page shop-detail-page">
      <section className="section">
        <div className="wrap">
          <a href="/um-shop" onClick={backToShop} className="shop-detail-back">
            <FontAwesomeIcon icon={faArrowLeft} /> {t.back}
          </a>

          <div className="shop-detail-body">
            <div className="shop-modal-gallery">
              <div className="shop-modal-main">
                {images[activeImage]
                  ? <img src={optImg(images[activeImage], 900)} alt={product.name} />
                  : <div className="shop-img-ph"><FontAwesomeIcon icon={faBagShopping} /></div>}
                {outOfStock && <span className="shop-badge-out">{t.out}</span>}
                {!outOfStock && hasDiscount(product) && <span className="shop-badge-discount">-{discountPercent(product)}%</span>}
              </div>
              {images.length > 1 && (
                <div className="shop-modal-thumbs">
                  {images.map((img, i) => (
                    <button
                      key={i}
                      className={`shop-modal-thumb ${i === activeImage ? 'active' : ''}`}
                      onClick={() => setActiveImage(i)}
                      aria-label={`รูปที่ ${i + 1}`}
                    >
                      <img src={optImg(img, 160)} alt="" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="shop-modal-info">
              {product.category && <span className="shop-cat">{product.category}</span>}
              <h1 className="shop-modal-name">{product.name}</h1>
              {product.price != null && ( // ราคา — ในเนื้อหา (ไม่ใช่แถบปุ่มลอย) โชว์ราคาเต็มขีดฆ่าคู่กับราคาลด (anchoring effect) ให้เห็นว่าลดจริง
                hasDiscount(product)
                  ? <div className="shop-modal-price"><span className="shop-price-old">{THB(product.price)}</span> {THB(product.discountPrice)}</div>
                  : <div className="shop-modal-price">{THB(product.price)}</div>
              )}
              {product.description && <p className="shop-modal-desc">{product.description}</p>}
              {hasTypes && ( // ชิปเลือกประเภท (แขนสั้น/แขนยาว/เด็กเล็ก) — เลือกก่อนสี เพราะกรองสีที่ขึ้นตามประเภทที่เลือก
                <div className="shop-meta-row">
                  <span className="shop-meta-label">{t.type}:</span>
                  <div className="variant-chip-wrap">
                    {typesUnion.map((typ) => (
                      <button key={typ} type="button" className={`variant-chip ${selType === typ ? 'selected' : ''}`}
                        onClick={() => selectType(typ)}>{typ}</button>
                    ))}
                  </div>
                </div>
              )}
              {hasColors && ( // ชิปเลือกสี — ย้ายมาไว้เหนือแถวจำนวน ให้เลือกตัวเลือกทั้งหมดต่อเนื่องกันก่อนกดเพิ่มลงตะกร้า
                <div className="shop-meta-row">
                  <span className="shop-meta-label">{t.color}:</span>
                  <div className="variant-chip-wrap">
                    {hasVariantGroup
                      ? dedupedGroupVariants.map((v, i) => {
                          const outOfStockV = (v.stock ?? 0) <= 0
                          const isSelected = variantLabel(v, i) === selectedLabel
                          return (
                            <button
                              key={v.id} type="button"
                              className={`variant-chip ${isSelected ? 'selected' : ''} ${outOfStockV ? 'disabled' : ''}`}
                              disabled={outOfStockV}
                              onClick={() => selectVariant(v)}
                            >{variantLabel(v, i)}</button>
                          )
                        })
                      : dedupedColors.map((c) => (
                          <button key={c} type="button" className={`variant-chip ${selColor === c ? 'selected' : ''}`}
                            onClick={() => { setSelColor(c); setVariantError('') }}>{c}</button>
                        ))}
                  </div>
                </div>
              )}
              {hasSizes && (
                <div className="shop-meta-row">
                  <span className="shop-meta-label">{t.size}:</span>
                  <div className="variant-chip-wrap">
                    {dedupedSizes.map((sz) => {
                      const available = isSizeAvailable(sz)
                      return (
                        <button
                          key={sz} type="button" disabled={!available}
                          className={`variant-chip ${selSize === sz ? 'selected' : ''} ${!available ? 'disabled' : ''}`}
                          onClick={() => { setSelSize(sz); setQty(1); setVariantError('') }}
                        >{sz}</button>
                      )
                    })}
                  </div>
                </div>
              )}
              {/* ข้อความเตือนย้ายไปเป็นกล่องกลางจอแล้ว (ดู .shop-alert ด้านบน) — ไม่โชว์ซ้ำตรงนี้
                  เพราะปุ่ม "เพิ่มลงตะกร้า" อยู่แถบล่างที่ลอยติดจอ ผู้ใช้มองไม่เห็นข้อความตรงนี้อยู่ดี */}
              {effectiveStock != null && (
                <div className={`shop-stock ${outOfStock ? 'out' : ''}`}>{t.stock}: {effectiveStock}</div>
              )}

              {!outOfStock && (
                <div className="shop-qty-row">
                  <span className="shop-meta-label">{t.qty}:</span>
                  <div className="shop-qty-stepper">
                    <button type="button" onClick={dec} disabled={qty <= 1} aria-label="ลดจำนวน"><FontAwesomeIcon icon={faMinus} /></button>
                    <span>{qty}</span>
                    <button type="button" onClick={inc} disabled={qty >= maxQty} aria-label="เพิ่มจำนวน"><FontAwesomeIcon icon={faPlus} /></button>
                  </div>
                </div>
              )}

              {/* จอกว้าง — แถบราคา/ปุ่มเดียวกัน วางไว้ในพื้นที่ว่างท้ายคอลัมน์ข้อมูล (margin-top:auto ดันลงล่างสุดของการ์ด) แทนแถบลอยแบบมือถือ */}
              <div className="shop-detail-inline-bar">
                <button type="button" onClick={handleOpenChat} className="shop-detail-inline-line" aria-label={t.chat}>
                  <FontAwesomeIcon icon={faComments} /> {t.chat}
                </button>
                <div className="shop-detail-bar-price">
                  <span className="shop-detail-bar-price-now">{THB(hasDiscount(product) ? product.discountPrice : product.price)}</span>
                </div>
                <div className="shop-detail-inline-actions">
                  <button type="button" className="shop-detail-inline-cart" onClick={handleAddToCart} disabled={outOfStock}>
                    <FontAwesomeIcon icon={added ? faCheck : faCartPlus} />
                    {outOfStock ? t.out : added ? t.added : t.addToCart}
                  </button>
                  <button type="button" className="shop-detail-inline-viewcart" onClick={viewCart} aria-label={t.viewCart}>
                    <FontAwesomeIcon icon={faCartShopping} />
                    {cartCount > 0 && <span className="shop-detail-cart-badge">{cartCount}</span>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {relatedGroups.length > 0 && (
          <div className="wrap shop-related">
            <h3 className="shop-related-title">{t.related}</h3>
            <div className="shop-grid shop-grid-4col">
              {relatedGroups.map((g) => (
                <ProductCard key={g.key} g={g} t={SHOP_T[lang] || SHOP_T.th} onOpen={openProduct} />
              ))}
            </div>
          </div>
        )}
      </section>
    </main>

    {/* แถบล่างลอย แบบ Shopee — ทักไลน์ / เพิ่มลงตะกร้า / ราคาตัวใหญ่หนา แทนปุ่มเพิ่มตะกร้าเดิมในเนื้อหา
        อยู่นอก <main className="page"> โดยตั้งใจ — .page มี CSS animation ที่ทิ้ง transform ค้างไว้ (matrix identity แทนที่จะเป็น none)
        ทำให้กลายเป็น containing block ของ position:fixed ลูกข้างใน เลื่อนตามเนื้อหาแทนที่จะติดขอบจอจริง
        อยู่ก่อน Footer เสมอ — บนจอกว้างจะไม่ fixed แล้ว (ดู shop.css) เลยต้องอยู่ตำแหน่งนี้พอดีเพื่อให้ติดขอบล่างการ์ดสินค้า ไม่ใช่ลอยทับ Footer */}
    <div className="shop-detail-bar">
      <button type="button" onClick={handleOpenChat} className="shop-detail-bar-line" aria-label={t.chat}>
        <FontAwesomeIcon icon={faComments} />
        <span>{t.chat}</span>
      </button>
      <div className="shop-detail-bar-price">
        <span className="shop-detail-bar-price-now">{THB(hasDiscount(product) ? product.discountPrice : product.price)}</span>
      </div>
      <button
        type="button"
        className="shop-detail-bar-cart"
        onClick={handleAddToCart}
        disabled={outOfStock}
      >
        <FontAwesomeIcon icon={added ? faCheck : faCartPlus} />
        {outOfStock ? t.out : added ? t.added : t.addToCart}
      </button>
      <button type="button" className="shop-detail-bar-viewcart" onClick={viewCart} aria-label={t.viewCart}>
        <FontAwesomeIcon icon={faCartShopping} />
        {cartCount > 0 && <span className="shop-detail-cart-badge">{cartCount}</span>}
      </button>
    </div>
    <Footer />
    </>
  )
}
